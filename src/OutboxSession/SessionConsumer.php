<?php

declare(strict_types=1);

namespace App\OutboxSession;

use Doctrine\DBAL\Connection;

/** Contract harness for SC-187756. No production sender is registered by this feature. */
final class SessionConsumer
{
    public function __construct(private readonly Connection $db) {}

    public function claim(): ?array
    {
        if ('0' === getenv('KIWI_OUTBOX_ACCEPT_WRITES')) return null;
        return $this->db->transactional(function (): ?array {
            $this->db->executeStatement("UPDATE customer_outbox_sessions SET status = 'ready', revision = revision + 1 WHERE status = 'pending' AND available_at <= clock_timestamp()");
            $row = $this->db->fetchAssociative(<<<'SQL'
SELECT s.* FROM customer_outbox_sessions s
WHERE s.status = 'ready' AND NOT EXISTS (
    SELECT 1 FROM customer_outbox_sessions previous
    WHERE previous.tenant = s.tenant AND previous.customer_key = s.customer_key
      AND previous.id < s.id AND previous.status NOT IN ('completed','cancelled')
)
ORDER BY s.id FOR UPDATE OF s SKIP LOCKED LIMIT 1
SQL);
            if (!$row) return null;
            $this->db->executeStatement("UPDATE customer_outbox_sessions SET status = 'processing', revision = revision + 1 WHERE id = ?", [$row['id']]);
            return ['contractVersion' => 1, 'sessionId' => (int) $row['id'], 'tenant' => $row['tenant'],
                'customerReference' => SessionOutbox::decode($row['customer_reference']),
                'changes' => array_map(fn ($change) => $change + ['idempotencyKey' => 'session-'.$row['id'].'-'.$change['id']], SessionOutbox::decode($row['changes']))];
        });
    }

    /** Verifier must check current roles, source versions, and dependencies before each effect. */
    public function consume(array $contract, callable $verify, callable $send): void
    {
        $id = $contract['sessionId'];
        $this->db->executeQuery('SELECT pg_advisory_lock(hashtext(?), hashtext(?))', ['kiwi-outbox-consumer', (string) $id]);
        try {
            $row = $this->db->fetchAssociative('SELECT * FROM customer_outbox_sessions WHERE id = ?', [$id]);
            if (!$row || 'processing' !== $row['status'] || [] !== SessionOutbox::decode($row['progress'])) {
                throw new \LogicException('A started or finished session requires reconciliation, not replay');
            }
            $storedChanges = array_map(fn ($change) => $change + ['idempotencyKey' => 'session-'.$id.'-'.$change['id']], SessionOutbox::decode($row['changes']));
            $matchesSnapshot = 1 === ($contract['contractVersion'] ?? null)
                && $row['tenant'] === ($contract['tenant'] ?? null)
                && SessionOutbox::decode($row['customer_reference']) === ($contract['customerReference'] ?? null)
                && $storedChanges === ($contract['changes'] ?? null);
            if (!$matchesSnapshot) throw new \LogicException('The consumer must use the immutable claimed contract');
            $this->consumeClaim($contract, $verify, $send);
        } finally {
            $this->db->executeQuery('SELECT pg_advisory_unlock(hashtext(?), hashtext(?))', ['kiwi-outbox-consumer', (string) $id]);
        }
    }

    private function consumeClaim(array $contract, callable $verify, callable $send): void
    {
        $id = $contract['sessionId'];
        $progress = [];
        foreach ($contract['changes'] as $change) {
            try {
                $allowed = ($change['authorizedUntil'] ?? 0) > time() && $verify($contract, $change);
            } catch (\Throwable) {
                $allowed = false;
            }
            if (!$allowed) {
                $this->finish($id, 'failed', $progress);
                return;
            }
            // Persist intent before I/O. A crashed/uncertain step cannot be blindly retried.
            $progress[] = ['id' => $change['id'], 'status' => 'started'];
            $this->finish($id, 'processing', $progress);
            try {
                $outcome = $send($contract, $change);
            } catch (\Throwable) {
                $this->finish($id, 'uncertain', $progress);
                return;
            }
            $last = count($progress) - 1;
            $outcome = in_array($outcome, ['completed', 'failed'], true) ? $outcome : 'uncertain';
            $progress[$last]['status'] = $outcome;
            if ('completed' !== $outcome) {
                $this->finish($id, 'failed' === $outcome ? 'failed' : 'uncertain', $progress);
                return;
            }
            $this->finish($id, 'processing', $progress);
        }
        $this->finish($id, 'completed', $progress);
    }

    private function finish(int $id, string $status, array $progress): void
    {
        $updated = $this->db->executeStatement("UPDATE customer_outbox_sessions SET status = ?, progress = ?::jsonb, updated_at = clock_timestamp() WHERE id = ? AND status = 'processing'", [$status, SessionOutbox::json($progress), $id]);
        if (1 !== $updated) throw new \LogicException('Session is no longer claimed');
    }
}
