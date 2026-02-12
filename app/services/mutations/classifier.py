from __future__ import annotations

import requests

TRANSIENT_STATUS_CODES = {408, 425, 429, 500, 502, 503, 504}
PERMANENT_STATUS_CODES = {400, 401, 403, 404, 409, 410, 422}


class DispatchOutcome:
    def __init__(
        self,
        *,
        success: bool,
        retryable: bool,
        failure_class: str | None,
        error_code: str | None = None,
        error_message: str | None = None,
        http_status: int | None = None,
    ) -> None:
        self.success = success
        self.retryable = retryable
        self.failure_class = failure_class
        self.error_code = error_code
        self.error_message = error_message
        self.http_status = http_status


def delivered(http_status: int | None) -> DispatchOutcome:
    return DispatchOutcome(
        success=True,
        retryable=False,
        failure_class=None,
        http_status=http_status,
    )


def classify_http_status(http_status: int, response_body: str | None = None) -> DispatchOutcome:
    if 200 <= http_status < 300:
        return delivered(http_status)

    if http_status in TRANSIENT_STATUS_CODES:
        return DispatchOutcome(
            success=False,
            retryable=True,
            failure_class="transient",
            error_code=f"http_{http_status}",
            error_message=response_body or f"HTTP {http_status}",
            http_status=http_status,
        )

    if http_status in PERMANENT_STATUS_CODES:
        return DispatchOutcome(
            success=False,
            retryable=False,
            failure_class="permanent",
            error_code=f"http_{http_status}",
            error_message=response_body or f"HTTP {http_status}",
            http_status=http_status,
        )

    return DispatchOutcome(
        success=False,
        retryable=False,
        failure_class="manual_review_required",
        error_code=f"http_{http_status}",
        error_message=response_body or f"HTTP {http_status}",
        http_status=http_status,
    )


def classify_request_exception(error: Exception) -> DispatchOutcome:
    transient_exception_types = (
        requests.exceptions.Timeout,
        requests.exceptions.ConnectionError,
    )

    if isinstance(error, transient_exception_types):
        return DispatchOutcome(
            success=False,
            retryable=True,
            failure_class="transient",
            error_code=error.__class__.__name__,
            error_message=str(error),
            http_status=None,
        )

    if isinstance(error, requests.exceptions.RequestException):
        return DispatchOutcome(
            success=False,
            retryable=False,
            failure_class="manual_review_required",
            error_code=error.__class__.__name__,
            error_message=str(error),
            http_status=None,
        )

    return DispatchOutcome(
        success=False,
        retryable=False,
        failure_class="manual_review_required",
        error_code=error.__class__.__name__,
        error_message=str(error),
        http_status=None,
    )
