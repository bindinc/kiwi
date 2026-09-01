<?php

declare(strict_types=1);

namespace App\CustomerWorkSession;

use Symfony\Component\HttpFoundation\Request;

final readonly class CustomerRequestContext
{
    public function __construct(
        public string $workflowSessionId,
        public int $contextGeneration,
        public ?CustomerReference $customerReference,
    ) {
        if ('' === trim($workflowSessionId)) {
            throw new \InvalidArgumentException('workflowSessionId must not be empty.');
        }
        if ($contextGeneration < 0) {
            throw new \InvalidArgumentException('contextGeneration must not be negative.');
        }
    }

    /**
     * @param array<string, mixed>|null $payload
     */
    public static function fromRequest(Request $request, string $fallbackWorkflowSessionId, ?array $payload = null): self
    {
        $payload ??= [];
        $workflowSessionId = self::normalizeWorkflowSessionId(
            $payload['workflowSessionId'] ?? $request->headers->get('X-Kiwi-Workflow-Session-Id'),
            $fallbackWorkflowSessionId,
        );
        $contextGeneration = self::normalizeGeneration(
            $payload['contextGeneration'] ?? $request->headers->get('X-Kiwi-Context-Generation'),
        );
        $customerReferencePayload = \is_array($payload['customerReference'] ?? null)
            ? $payload['customerReference']
            : null;
        $customerReference = CustomerReference::fromArray($customerReferencePayload)
            ?? CustomerReference::fromRequestHeaders($request);

        return new self($workflowSessionId, $contextGeneration, $customerReference);
    }

    /**
     * @return array{workflowSessionId: string, contextGeneration: int, customerReference: array<string, string>|null}
     */
    public function toArray(): array
    {
        return [
            'workflowSessionId' => $this->workflowSessionId,
            'contextGeneration' => $this->contextGeneration,
            'customerReference' => $this->customerReference?->toArray(),
        ];
    }

    private static function normalizeWorkflowSessionId(mixed $value, string $fallback): string
    {
        $workflowSessionId = \is_string($value) ? trim($value) : '';
        if ('' === $workflowSessionId || strlen($workflowSessionId) > 128) {
            return $fallback;
        }

        return $workflowSessionId;
    }

    private static function normalizeGeneration(mixed $value): int
    {
        if (!\is_int($value) && !(\is_string($value) && ctype_digit($value))) {
            return 0;
        }

        return max(0, (int) $value);
    }
}
