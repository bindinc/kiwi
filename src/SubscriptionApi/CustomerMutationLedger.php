<?php

declare(strict_types=1);

namespace App\SubscriptionApi;

use App\Http\ApiProblemException;
use App\Security\AuthorizationContext;
use Doctrine\DBAL\Connection;

/** Shared durable intent and duplicate detection, with no customer field values. */
final class CustomerMutationLedger
{
    public const SCHEMA = <<<'SQL'
CREATE TABLE IF NOT EXISTS customer_mutations (
    actor TEXT NOT NULL,
    request_key VARCHAR(64) NOT NULL,
    mandant TEXT NOT NULL,
    credential_key TEXT NOT NULL,
    person_id TEXT NOT NULL,
    resource_id TEXT,
    operation VARCHAR(32) NOT NULL,
    field_names JSONB NOT NULL,
    correlation_id VARCHAR(64) NOT NULL,
    authorization_expires_at BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMPTZ,
    outcome VARCHAR(16) NOT NULL CHECK (outcome IN ('intent', 'success', 'denied', 'failed', 'unknown')),
    PRIMARY KEY (actor, request_key)
)
SQL;

    public function __construct(private readonly Connection $connection) {}

    public function begin(AuthorizationContext $actor, string $key, string $mandant, string $credential,
        string $personId, ?string $resourceId, string $operation, array $fields, string $correlation): void
    {
        if ($actor->expiresAt <= time() || !$actor->canWrite()) {
            throw new ApiProblemException(403, 'authorization_expired', 'Sign in again before starting a mutation');
        }
        if ($this->connection->getTransactionNestingLevel() !== 0) {
            throw new ApiProblemException(503, 'mutation_audit_unavailable', 'Audit intent must be committed before a source mutation');
        }
        try {
            $inserted = $this->connection->executeStatement(
                "INSERT INTO customer_mutations (actor, request_key, mandant, credential_key, person_id, resource_id, operation, field_names, correlation_id, authorization_expires_at, outcome) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'intent') ON CONFLICT (actor, request_key) DO NOTHING",
                [$actor->tenant.':'.$actor->actor, $key, $mandant, $credential, $personId, $resourceId, $operation,
                    json_encode(array_values($fields), JSON_THROW_ON_ERROR), $correlation, $actor->expiresAt],
            );
        } catch (\Throwable) {
            throw new ApiProblemException(503, 'mutation_audit_unavailable', 'Mutation audit storage is unavailable');
        }
        if (1 !== $inserted) {
            // Never replay, including after a timeout, process crash or changed payload.
            throw new ApiProblemException(409, 'duplicate_mutation', 'This request was already submitted; reload the source before continuing');
        }
    }

    public function finish(AuthorizationContext $actor, string $key, string $outcome): void
    {
        if (!in_array($outcome, ['success', 'denied', 'failed', 'unknown'], true)) {
            throw new \InvalidArgumentException('Invalid mutation outcome');
        }
        try {
            $updated = $this->connection->executeStatement(
                "UPDATE customer_mutations SET outcome = ?, finished_at = CURRENT_TIMESTAMP WHERE actor = ? AND request_key = ? AND outcome = 'intent'",
                [$outcome, $actor->tenant.':'.$actor->actor, $key],
            );
            if (1 !== $updated) throw new \RuntimeException('Missing intent');
        } catch (\Throwable) {
            // Intent remains durable and blocks retries, even if the result cannot be stored.
            throw new ApiProblemException(503, 'mutation_outcome_unknown', 'The result could not be recorded; reload the source before continuing');
        }
    }
}
