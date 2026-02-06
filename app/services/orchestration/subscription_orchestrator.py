"""Subscription orchestration with idempotency and queued fallback."""

from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
import json
import os
from typing import Any

from db.repositories import AuditEventsRepository, OperationRequestsRepository, OutboundJobsRepository
from services.hup.webabo.subscription_gateway import (
    RetryableUpstreamError,
    ValidationUpstreamError,
    WebAboSubscriptionGateway,
)
from utils.logging_config import redact_sensitive_data


@dataclass(frozen=True)
class OrchestrationResponse:
    http_status: int
    payload: dict[str, Any]


def _canonical_payload_hash(payload: dict[str, Any]) -> str:
    serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return sha256(serialized.encode("utf-8")).hexdigest()


class SubscriptionOrchestrator:
    """Coordinates idempotent subscription handling and queue fallback."""

    def __init__(
        self,
        *,
        operation_repo: OperationRequestsRepository | None = None,
        jobs_repo: OutboundJobsRepository | None = None,
        audit_repo: AuditEventsRepository | None = None,
        gateway: WebAboSubscriptionGateway | None = None,
    ) -> None:
        self.operation_repo = operation_repo or OperationRequestsRepository()
        self.jobs_repo = jobs_repo or OutboundJobsRepository()
        self.audit_repo = audit_repo or AuditEventsRepository()
        self.gateway = gateway or WebAboSubscriptionGateway()

        self.sync_timeout_ms = int(os.environ.get("KIWI_SYNC_SUBSCRIPTION_TIMEOUT_MS", "2500"))
        self.max_attempts = int(os.environ.get("KIWI_QUEUE_MAX_ATTEMPTS", "8"))

    def submit(
        self,
        *,
        request_id: str,
        payload: dict[str, Any],
        actor_id: str | None,
        correlation_id: str,
    ) -> OrchestrationResponse:
        payload_hash = _canonical_payload_hash(payload)

        existing = self.operation_repo.get_by_request_id(request_id)
        if existing is not None:
            existing_hash = existing.get("payload_hash")
            if existing_hash != payload_hash:
                return OrchestrationResponse(
                    http_status=409,
                    payload={
                        "status": "conflict",
                        "requestId": request_id,
                        "message": "Idempotency key already used with different payload",
                    },
                )

            return self._existing_response(existing)

        self.operation_repo.create_request(
            request_id=request_id,
            operation_type="subscription_create",
            payload_hash=payload_hash,
            status="pending",
            correlation_id=correlation_id,
        )
        self.audit_repo.append_event(
            event_type="subscription.requested",
            actor_id=actor_id,
            entity_type="subscription_request",
            entity_id=request_id,
            request_id=request_id,
            correlation_id=correlation_id,
            before_redacted=None,
            after_redacted=redact_sensitive_data(payload),
            metadata_json={"mode": "sync-first"},
        )

        try:
            upstream_response = self.gateway.create_subscription(
                payload,
                timeout_ms=self.sync_timeout_ms,
            )
        except RetryableUpstreamError as exc:
            job_id = self.jobs_repo.enqueue_job(
                request_id=request_id,
                job_type="subscription_create",
                ordering_key=str(payload.get("userId") or request_id),
                payload_json={
                    "subscriptionPayload": payload,
                    "correlationId": correlation_id,
                },
                max_attempts=self.max_attempts,
            )
            self.operation_repo.update_status(
                request_id=request_id,
                status="queued",
                result_json={"jobId": job_id, "status": "pending"},
            )
            self.audit_repo.append_event(
                event_type="subscription.queued",
                actor_id=actor_id,
                entity_type="subscription_request",
                entity_id=request_id,
                request_id=request_id,
                correlation_id=correlation_id,
                before_redacted=None,
                after_redacted={"jobId": job_id, "reason": str(exc)},
                metadata_json=None,
            )
            return OrchestrationResponse(
                http_status=202,
                payload={
                    "status": "pending",
                    "requestId": request_id,
                    "jobId": job_id,
                },
            )
        except ValidationUpstreamError as exc:
            self.operation_repo.update_status(
                request_id=request_id,
                status="failed",
                error_json={"message": exc.message, "details": exc.details},
                completed=True,
            )
            self.audit_repo.append_event(
                event_type="subscription.failed",
                actor_id=actor_id,
                entity_type="subscription_request",
                entity_id=request_id,
                request_id=request_id,
                correlation_id=correlation_id,
                before_redacted=None,
                after_redacted={"error": exc.message},
                metadata_json={"statusCode": exc.status_code},
            )
            return OrchestrationResponse(
                http_status=exc.status_code,
                payload={
                    "status": "failed",
                    "requestId": request_id,
                    "error": exc.message,
                },
            )

        subscription_id = upstream_response.get("subscriptionId") or upstream_response.get("id")
        self.operation_repo.update_status(
            request_id=request_id,
            status="succeeded",
            result_json={"upstream": upstream_response, "subscriptionId": subscription_id},
            completed=True,
        )
        self.audit_repo.append_event(
            event_type="subscription.succeeded",
            actor_id=actor_id,
            entity_type="subscription_request",
            entity_id=request_id,
            request_id=request_id,
            correlation_id=correlation_id,
            before_redacted=None,
            after_redacted={"subscriptionId": subscription_id},
            metadata_json=None,
        )

        return OrchestrationResponse(
            http_status=201,
            payload={
                "status": "succeeded",
                "requestId": request_id,
                "subscriptionId": subscription_id,
            },
        )

    def get_request_status(self, request_id: str) -> OrchestrationResponse:
        existing = self.operation_repo.get_by_request_id(request_id)
        if existing is None:
            return OrchestrationResponse(
                http_status=404,
                payload={"status": "not_found", "requestId": request_id},
            )

        status = existing.get("status")
        if status == "succeeded":
            result = existing.get("result_json") or {}
            return OrchestrationResponse(
                http_status=200,
                payload={
                    "status": "succeeded",
                    "requestId": request_id,
                    "result": result,
                },
            )

        if status in {"pending", "queued", "processing"}:
            return OrchestrationResponse(
                http_status=200,
                payload={
                    "status": "pending",
                    "requestId": request_id,
                    "result": existing.get("result_json"),
                },
            )

        return OrchestrationResponse(
            http_status=200,
            payload={
                "status": "failed",
                "requestId": request_id,
                "error": existing.get("error_json"),
            },
        )

    def _existing_response(self, existing: dict[str, Any]) -> OrchestrationResponse:
        status = existing.get("status")
        request_id = existing.get("request_id")

        if status == "succeeded":
            result = existing.get("result_json") or {}
            return OrchestrationResponse(
                http_status=201,
                payload={
                    "status": "succeeded",
                    "requestId": request_id,
                    "subscriptionId": result.get("subscriptionId"),
                },
            )

        if status in {"pending", "queued", "processing"}:
            result = existing.get("result_json") or {}
            return OrchestrationResponse(
                http_status=202,
                payload={
                    "status": "pending",
                    "requestId": request_id,
                    "jobId": result.get("jobId"),
                },
            )

        return OrchestrationResponse(
            http_status=200,
            payload={
                "status": "failed",
                "requestId": request_id,
                "error": existing.get("error_json"),
            },
        )
