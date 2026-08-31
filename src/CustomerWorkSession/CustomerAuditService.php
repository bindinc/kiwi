<?php

declare(strict_types=1);

namespace App\CustomerWorkSession;

use App\Entity\CustomerAuditEvent;
use App\Http\ApiProblemException;
use App\Http\RequestCorrelationId;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\Request;

final class CustomerAuditService
{
    private bool $schemaReady = false;

    public function __construct(
        private readonly CustomerAuditSchemaManager $schemaManager,
        private readonly EntityManagerInterface $entityManager,
        private readonly RequestCorrelationId $requestCorrelationId,
    ) {
    }

    /**
     * @param array<string, mixed> $currentUserContext
     * @param array<string, mixed> $filters
     */
    public function recordSearchPerformed(
        Request $request,
        array $currentUserContext,
        array $filters,
        int $resultCount,
    ): void {
        $filterFields = [];
        foreach ($filters as $fieldName => $value) {
            $hasValue = \is_array($value) ? [] !== $value : '' !== trim((string) $value);
            if ($hasValue) {
                $filterFields[] = (string) $fieldName;
            }
        }

        $this->record(
            $request,
            $currentUserContext,
            CustomerAuditAction::SearchPerformed,
            CustomerAuditResult::Success,
            CustomerReference::fromRequestHeaders($request),
            [
                'filterFields' => $filterFields,
                'resultCount' => max(0, $resultCount),
            ],
        );
    }

    /**
     * @param array<string, mixed> $currentUserContext
     * @param array<string, mixed> $customer
     */
    public function recordProfileOpened(
        Request $request,
        array $currentUserContext,
        array $customer,
        string|int $fallbackPersonId,
    ): void {
        $customerReference = CustomerReference::fromArray($customer, $fallbackPersonId);
        if (null === $customerReference) {
            throw new ApiProblemException(500, 'customer_reference_missing', 'Customer reference is incomplete');
        }

        $this->record(
            $request,
            $currentUserContext,
            CustomerAuditAction::ProfileOpened,
            CustomerAuditResult::Success,
            $customerReference,
        );
    }

    /**
     * @param array<string, mixed> $currentUserContext
     * @param array<string, mixed> $payload
     */
    public function recordSessionReset(Request $request, array $currentUserContext, array $payload): void
    {
        $requestId = $this->requestCorrelationId->getOrCreate($request);
        $requestContext = CustomerRequestContext::fromRequest($request, 'server-'.$requestId, $payload);
        if (null === $requestContext->customerReference) {
            throw new ApiProblemException(400, 'customer_reference_missing', 'customerReference is required');
        }

        $this->record(
            $request,
            $currentUserContext,
            CustomerAuditAction::SessionReset,
            CustomerAuditResult::Success,
            $requestContext->customerReference,
            [],
            $requestContext,
        );
    }

    /**
     * @param array<string, mixed> $currentUserContext
     * @param array<string, mixed> $metadata
     */
    private function record(
        Request $request,
        array $currentUserContext,
        CustomerAuditAction $action,
        CustomerAuditResult $result,
        ?CustomerReference $customerReference,
        array $metadata = [],
        ?CustomerRequestContext $requestContext = null,
    ): void {
        $requestId = $this->requestCorrelationId->getOrCreate($request);
        $requestContext ??= CustomerRequestContext::fromRequest($request, 'server-'.$requestId);

        try {
            $this->ensureSchema();
            $this->entityManager->persist(new CustomerAuditEvent(
                $this->resolveActorIdentifier($currentUserContext),
                $action,
                $result,
                $requestContext->workflowSessionId,
                $requestContext->contextGeneration,
                $requestId,
                $customerReference,
                $metadata,
                new \DateTimeImmutable('now', new \DateTimeZone('UTC')),
            ));
            $this->entityManager->flush();
        } catch (ApiProblemException $exception) {
            throw $exception;
        } catch (\Throwable $exception) {
            throw new ApiProblemException(
                503,
                'customer_audit_unavailable',
                'Customer audit logging is temporarily unavailable',
            );
        }
    }

    private function ensureSchema(): void
    {
        if ($this->schemaReady) {
            return;
        }

        $this->schemaManager->ensureSchema();
        $this->schemaReady = true;
    }

    /**
     * @param array<string, mixed> $currentUserContext
     */
    private function resolveActorIdentifier(array $currentUserContext): string
    {
        $identity = \is_array($currentUserContext['identity'] ?? null)
            ? $currentUserContext['identity']
            : [];
        foreach (['email', 'full_name'] as $fieldName) {
            $value = $identity[$fieldName] ?? null;
            if (\is_string($value) && '' !== trim($value)) {
                return trim($value);
            }
        }

        return 'unknown-authenticated-user';
    }
}
