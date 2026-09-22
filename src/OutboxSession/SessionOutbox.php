<?php

declare(strict_types=1);

namespace App\OutboxSession;

use App\Http\ApiProblemException;
use App\Security\AuthorizationContext;
use App\Security\BusinessAccess;
use Doctrine\DBAL\Connection;
use Symfony\Component\HttpFoundation\Request;

/** Shared database state, never PHP-session or pod-local delivery state. */
final class SessionOutbox
{
    public function __construct(private readonly Connection $db, private readonly BusinessAccess $access) {}

    public static function managesAll(AuthorizationContext $actor): bool
    {
        return [] !== array_intersect($actor->roles, ['bink8s.app.kiwi.admin', 'bink8s.app.kiwi.supervisor']);
    }

    public function list(int $limit = 20, int $offset = 0): array
    {
        $actor = $this->access->context();
        $this->expire();
        [$where, $params] = $this->visibility($actor);
        $where .= " AND status NOT IN ('completed','cancelled')";
        $rows = $this->db->fetchAllAssociative('SELECT * FROM customer_outbox_sessions WHERE '.$where.' ORDER BY id DESC LIMIT '.max(1, min($limit, 100)).' OFFSET '.max(0, $offset), $params);
        return ['items' => array_map(fn ($row) => $this->present($row, $actor, false), $rows),
            'total' => (int) $this->db->fetchOne('SELECT COUNT(*) FROM customer_outbox_sessions WHERE '.$where, $params)];
    }

    public function findSubmission(string $key): ?array
    {
        $actor = $this->access->context();
        $row = $this->db->fetchAssociative('SELECT response, session_id FROM customer_outbox_receipts WHERE tenant = ? AND actor = ? AND request_key = ?', [$actor->tenant, $actor->actor, $key]);
        if (!$row) return null;
        $this->readable((int) $row['session_id'], $actor);
        return self::decode($row['response']);
    }

    public function get(int $id): array
    {
        $actor = $this->access->context();
        $this->expire();
        return $this->present($this->readable($id, $actor), $actor);
    }

    /** Preview callback validates the complete replacement sequence without external writes. */
    public function save(Request $request, array $reference, string $operation, array $arguments, array $baseCustomers, callable $preview): array
    {
        $actor = $this->access->context();
        $this->access->requireWrite();
        $this->requireEnabled();
        $key = $this->requestKey($request);
        $changeId = trim((string) $request->headers->get('X-Kiwi-Change-Id', $key));
        if ('' === $changeId || strlen($changeId) > 128) $this->problem(400, 'invalid_change_id');
        $customerKey = hash('sha256', self::json($reference));
        $originalInput = json_decode($request->getContent(), true);
        $fingerprint = hash('sha256', self::json([$reference, $operation, is_array($originalInput) ? $originalInput : $arguments, $changeId]));

        return $this->db->transactional(function () use ($request, $reference, $operation, $arguments, $baseCustomers, $preview, $actor, $key, $changeId, $customerKey, $fingerprint): array {
            $this->lock('receipt', $actor->tenant.'|'.$actor->actor.'|'.$key);
            $receipt = $this->receipt($actor, $key, $fingerprint);
            if (null !== $receipt) return $receipt;
            if ('updateCustomer' === $operation && !is_array($arguments[1] ?? null)) $this->problem(422, 'invalid_customer_change');
            if ('updateSubscription' === $operation && !is_array($arguments[2] ?? null)) $this->problem(422, 'invalid_subscription_change');
            if (!$request->headers->has('X-Kiwi-Change-Id')) {
                $callerCustomer = $baseCustomers[0] ?? [];
                if ('updateCustomer' === $operation && $callerCustomer) {
                    $arguments[1] = array_filter($arguments[1], static fn ($value, $field) => ($callerCustomer[$field] ?? null) !== $value, ARRAY_FILTER_USE_BOTH);
                    if ([] === $arguments[1]) $this->problem(422, 'outbox_no_changes');
                }
                if ('updateSubscription' === $operation && $callerCustomer) {
                    $subscriptions = array_column($callerCustomer['subscriptions'] ?? [], null, 'id');
                    $previous = $subscriptions[$arguments[1]] ?? [];
                    $arguments[2] = array_filter($arguments[2], static fn ($value, $field) => ($previous[$field] ?? null) !== $value, ARRAY_FILTER_USE_BOTH);
                    if ([] === $arguments[2]) $this->problem(422, 'outbox_no_changes');
                }
            }
            $this->lock('customer', $actor->tenant.'|'.$customerKey);
            $this->expire();
            $requestedId = $request->headers->get('X-Kiwi-Outbox-Id');
            if (null !== $requestedId) {
                $row = $this->readable((int) $requestedId, $actor, true);
                if ($row['customer_key'] !== $customerKey) $this->problem(409, 'outbox_customer_mismatch');
                $this->requireEditable($row);
                $this->checkRevision($request, $row);
            } else {
                $row = $this->db->fetchAssociative("SELECT * FROM customer_outbox_sessions WHERE tenant = ? AND customer_key = ? AND status IN ('pending','paused') FOR UPDATE", [$actor->tenant, $customerKey]);
                // Existing contributors must supply a revision. New contributors may only append.
                if ($row) $this->requireEditable($row);
                if ($row && $this->isContributor($row, $actor)) $this->checkRevision($request, $row);
            }
            if (in_array($operation, ['updateCustomer', 'updateSubscription'], true)) {
                $fieldIndex = 'updateCustomer' === $operation ? 1 : 2;
                if (!is_array($arguments[$fieldIndex] ?? null) || [] === $arguments[$fieldIndex]) $this->problem(422, 'outbox_no_changes');
            }
            $changes = $row ? self::decode($row['changes']) : [];
            $base = $row ? self::decode($row['base_customers']) : $baseCustomers;
            if ($row && !$this->canRead($row, $actor)) {
                foreach ($changes as $previous) {
                    if ($previous['operation'] !== $operation) continue;
                    $overlap = match ($operation) {
                        'updateCustomer' => array_intersect_key($previous['arguments'][1], $arguments[1]),
                        'updateSubscription' => $previous['arguments'][1] === $arguments[1] ? array_intersect_key($previous['arguments'][2], $arguments[2]) : [],
                        'updateDeliveryRemarks', 'processDeceasedActions', 'completeRestitutionTransfer', 'completeWinback' => ['shared' => true],
                        default => [],
                    };
                    if ([] !== $overlap) $this->problem(409, 'outbox_contribution_conflict', 'Deze gegevens zijn al gewijzigd in een gedeelde sessie. Laat een supervisor de wijzigingen afstemmen. Je invoer blijft behouden.');
                }
            }
            $replacement = ['id' => $changeId, 'operation' => $operation, 'arguments' => $arguments,
                'actor' => $actor->actor, 'tenant' => $actor->tenant, 'roles' => $actor->roles,
                'recordedAt' => gmdate(DATE_ATOM),
                'authorizedUntil' => $actor->expiresAt];
            $replaced = false;
            foreach ($changes as $index => $change) {
                if ($change['id'] !== $changeId) continue;
                if (!$row || !$this->canRead($row, $actor)) $this->problem(404, 'outbox_session_not_found');
                if ($change['operation'] !== $operation) $this->problem(409, 'outbox_operation_mismatch');
                $this->checkRevision($request, $row);
                if (in_array($operation, ['updateCustomer', 'updateSubscription'], true)) {
                    $fieldIndex = 'updateCustomer' === $operation ? 1 : 2;
                    $currentCustomer = self::decode($row['preview_customers'])[0] ?? [];
                    $currentValues = $currentCustomer;
                    if ('updateSubscription' === $operation) {
                        $subscriptions = array_column($currentCustomer['subscriptions'] ?? [], null, 'id');
                        $currentValues = $subscriptions[$arguments[1]] ?? [];
                    }
                    $originalFields = $change['arguments'][$fieldIndex];
                    $arguments[$fieldIndex] = array_filter($arguments[$fieldIndex], static fn ($value, $field) => array_key_exists($field, $originalFields) || ($currentValues[$field] ?? null) !== $value, ARRAY_FILTER_USE_BOTH);
                    $replacement['arguments'] = $arguments;
                    foreach (array_slice($changes, $index + 1) as $later) {
                        $sameTarget = $later['operation'] === $operation && ('updateCustomer' === $operation || $later['arguments'][1] === $arguments[1]);
                        if ($sameTarget && array_intersect_key($later['arguments'][$fieldIndex], $arguments[$fieldIndex])) {
                            $this->problem(409, 'outbox_later_change_conflict', 'Een latere wijziging past dezelfde velden aan. Bewerk de laatste wijziging voor deze gegevens. Je invoer blijft behouden.');
                        }
                    }
                }
                if (self::json($change['arguments']) === self::json($arguments)) $this->problem(422, 'outbox_no_changes');
                $replacement['recordedAt'] = $change['recordedAt'];
                $changes[$index] = $replacement;
                $replaced = true;
                break;
            }
            if (!$replaced) $changes[] = $replacement;
            if (count($changes) > 200 || strlen(self::json($changes)) > 1000000) $this->problem(422, 'outbox_session_too_large');
            $calculated = $preview($changes, $base, $changeId);
            if (!is_array($calculated['response'] ?? null) || !is_array($calculated['customers'] ?? null)) {
                throw new \LogicException('Invalid outbox projection');
            }
            $contributors = $row ? self::decode($row['contributors']) : [];
            if (!in_array($actor->actor, $contributors, true)) $contributors[] = $actor->actor;
            if (!$row) {
                $id = (int) $this->db->fetchOne("INSERT INTO customer_outbox_sessions (tenant, customer_key, customer_reference, creator, contributors, status, available_at, base_customers) VALUES (?, ?, ?::jsonb, ?, ?::jsonb, 'pending', clock_timestamp() + interval '60 seconds', ?::jsonb) RETURNING id", [$actor->tenant, $customerKey, self::json($reference), $actor->actor, self::json($contributors), self::json($base)]);
            } else {
                $id = (int) $row['id'];
            }
            $this->db->executeStatement("UPDATE customer_outbox_sessions SET changes = ?::jsonb, preview_customers = ?::jsonb, contributors = ?::jsonb, revision = revision + 1, updated_at = clock_timestamp(), available_at = CASE WHEN status = 'paused' THEN available_at ELSE clock_timestamp() + interval '60 seconds' END WHERE id = ?", [self::json($changes), self::json($calculated['customers']), self::json($contributors), $id]);
            $profile = $request->getSession()->get('oidc_auth_profile', []);
            $label = is_string($profile['name'] ?? null) ? $profile['name'] : $actor->actor;
            $this->db->executeStatement('UPDATE customer_outbox_sessions SET contributor_labels = contributor_labels || ?::jsonb WHERE id = ?', [self::json([$actor->actor => $label]), $id]);
            $saved = $this->readable($id, $actor);
            $this->audit($saved, $actor, $replaced ? 'correct' : 'append');
            $response = $calculated['response'];
            $response['outbox'] = $this->present($saved, $actor);
            $response['outbox']['changeId'] = $changeId;
            $response['provisional'] = true;
            $this->storeReceipt($actor, $key, $fingerprint, $id, $response);
            return $response;
        });
    }

    public function action(Request $request, int $id, string $action): array
    {
        $actor = $this->access->context();
        $this->access->requireWrite();
        $this->requireEnabled();
        $key = $this->requestKey($request);
        if (!in_array($action, ['reopen', 'pause', 'resume', 'cancel'], true)) $this->problem(400, 'invalid_outbox_action');
        $fingerprint = hash('sha256', self::json([$id, $action]));
        return $this->db->transactional(function () use ($request, $id, $action, $actor, $key, $fingerprint): array {
            $this->lock('receipt', $actor->tenant.'|'.$actor->actor.'|'.$key);
            $receipt = $this->receipt($actor, $key, $fingerprint);
            if (null !== $receipt) return $receipt;
            $this->expire();
            $row = $this->readable($id, $actor, true);
            $this->requireEditable($row);
            $this->checkRevision($request, $row);
            if ('cancel' === $action && !self::managesAll($actor)) $this->problem(403, 'outbox_delete_forbidden');
            $status = match ($action) { 'cancel' => 'cancelled', 'resume' => 'pending', default => 'paused' };
            $this->db->executeStatement("UPDATE customer_outbox_sessions SET status = ?, revision = revision + 1, updated_at = clock_timestamp(), available_at = CASE WHEN ? = 'pending' THEN clock_timestamp() + interval '60 seconds' ELSE available_at END WHERE id = ?", [$status, $status, $id]);
            $row = $this->readable($id, $actor);
            $this->audit($row, $actor, $action);
            $response = $this->present($row, $actor);
            $this->storeReceipt($actor, $key, $fingerprint, $id, $response);
            return $response;
        });
    }

    public function overlayCustomers(array $customers): array
    {
        $actor = $this->access->context();
        [$where, $params] = $this->visibility($actor);
        $rows = $this->db->fetchAllAssociative("SELECT * FROM customer_outbox_sessions WHERE $where AND customer_reference->>'credentialKey' = '' AND status NOT IN ('completed','cancelled') ORDER BY id", $params);
        $byId = array_column($customers, null, 'id');
        foreach ($rows as $row) {
            foreach (self::decode($row['preview_customers']) as $customer) {
                $customer['provisional'] = true;
                $customer['outboxSession'] = $this->present($row, $actor, false);
                $byId[$customer['id']] = $customer;
            }
        }
        return array_values($byId);
    }

    public function overlayExternalCustomer(array $customer): array
    {
        $reference = \App\CustomerWorkSession\CustomerReference::fromArray($customer);
        if (!$reference) return $customer;
        $actor = $this->access->context();
        [$where, $params] = $this->visibility($actor);
        $params[] = hash('sha256', self::json($reference->toArray()));
        $rows = $this->db->fetchAllAssociative("SELECT * FROM customer_outbox_sessions WHERE $where AND customer_key = ? AND status NOT IN ('completed','cancelled') ORDER BY id", $params);
        foreach ($rows as $row) {
            $customer['outboxSession'] = $this->present($row, $actor, false);
            foreach (self::decode($row['changes']) as $change) {
                if ('subscription.create' !== $change['operation']) continue;
                $customer['subscriptions'][] = $change['arguments'][0]['subscription'] + ['id' => 'outbox-'.$change['id'], 'provisional' => true];
                $customer['provisional'] = true;
            }
        }
        return $customer;
    }

    private function visibility(AuthorizationContext $actor): array
    {
        if (self::managesAll($actor)) return ['tenant = ?', [$actor->tenant]];
        if (!$actor->canWrite()) return ['tenant = ? AND FALSE', [$actor->tenant]];
        return ['tenant = ? AND contributors @> ?::jsonb', [$actor->tenant, self::json([$actor->actor])]];
    }

    private function readable(int $id, AuthorizationContext $actor, bool $lock = false): array
    {
        $row = $this->db->fetchAssociative('SELECT * FROM customer_outbox_sessions WHERE id = ? AND tenant = ?'.($lock ? ' FOR UPDATE' : ''), [$id, $actor->tenant]);
        if (!$row || !$this->canRead($row, $actor)) $this->problem(404, 'outbox_session_not_found');
        return $row;
    }

    private function canRead(array $row, AuthorizationContext $actor): bool
    {
        return $row['tenant'] === $actor->tenant && (self::managesAll($actor) || ($actor->canWrite() && $this->isContributor($row, $actor)));
    }

    private function isContributor(array $row, AuthorizationContext $actor): bool
    {
        return in_array($actor->actor, self::decode($row['contributors']), true);
    }

    private function checkRevision(Request $request, array $row): void
    {
        if ((string) $row['revision'] !== $request->headers->get('X-Kiwi-Outbox-Revision')) {
            $this->problem(409, 'outbox_revision_conflict', 'De sessie is gewijzigd. Je invoer blijft behouden. Laad de actuele sessie en pas je wijziging opnieuw toe.');
        }
    }

    private function requireEditable(array $row): void
    {
        $deadlinePassed = 'pending' === $row['status'] && 1 === (int) $this->db->fetchOne('SELECT CASE WHEN ?::timestamptz <= clock_timestamp() THEN 1 ELSE 0 END', [$row['available_at']]);
        if ($deadlinePassed || !in_array($row['status'], ['pending', 'paused'], true)) $this->problem(409, 'outbox_session_closed', 'Deze sessie staat klaar voor verwerking en kan niet meer worden aangepast.');
    }

    private function present(array $row, AuthorizationContext $actor, bool $details = true): array
    {
        $changes = self::decode($row['changes']);
        $customers = self::decode($row['preview_customers']);
        $reference = self::decode($row['customer_reference']);
        $customer = current(array_filter($customers, fn ($c) => (string) ($c['id'] ?? '') === $reference['personId'])) ?: [];
        $editable = $actor->canWrite() && in_array($row['status'], ['pending', 'paused'], true);
        $result = ['id' => (int) $row['id'], 'revision' => (int) $row['revision'], 'status' => $row['status'],
            'customerReference' => $reference, 'creator' => $row['creator'], 'contributors' => self::decode($row['contributors']), 'contributorLabels' => self::decode($row['contributor_labels']),
            'availableAt' => (new \DateTimeImmutable($row['available_at']))->format('Y-m-d\\TH:i:s.uP'), 'updatedAt' => (new \DateTimeImmutable($row['updated_at']))->format(DATE_ATOM), 'serverTime' => (new \DateTimeImmutable())->format('Y-m-d\\TH:i:s.uP'),
            'summary' => ['customer' => trim(implode(' ', array_filter([$customer['firstName'] ?? '', $customer['middleName'] ?? '', $customer['lastName'] ?? '']))) ?: 'Klant '.$reference['personId'], 'changeCount' => count($changes)],
            'capabilities' => ['edit' => $editable, 'pause' => $editable, 'resume' => $editable, 'delete' => $editable && self::managesAll($actor)]];
        if ($details) {
            $result['customers'] = $customers;
            $result['changes'] = array_map(static function ($change) { unset($change['roles'], $change['authorizedUntil'], $change['tenant']); return $change; }, $changes);
        }
        return $result;
    }

    private function expire(): void
    {
        $this->db->executeStatement("UPDATE customer_outbox_sessions SET status = 'ready', revision = revision + 1 WHERE status = 'pending' AND available_at <= clock_timestamp()");
    }

    private function lock(string $scope, string $key): void
    {
        $this->db->executeQuery('SELECT pg_advisory_xact_lock(hashtext(?), hashtext(?))', ['kiwi-outbox-'.$scope, $key]);
    }

    private function requestKey(Request $request): string
    {
        $key = trim((string) $request->headers->get('Idempotency-Key', ''));
        if ('' === $key || strlen($key) > 128) $this->problem(428, 'outbox_idempotency_required', 'Ververs Kiwi voordat je wijzigingen opslaat.');
        return $key;
    }

    private function receipt(AuthorizationContext $actor, string $key, string $fingerprint): ?array
    {
        $row = $this->db->fetchAssociative('SELECT fingerprint, response, session_id FROM customer_outbox_receipts WHERE tenant = ? AND actor = ? AND request_key = ?', [$actor->tenant, $actor->actor, $key]);
        if (!$row) return null;
        $this->readable((int) $row['session_id'], $actor);
        if ($row['fingerprint'] !== $fingerprint) $this->problem(409, 'outbox_idempotency_conflict');
        return self::decode($row['response']);
    }

    private function storeReceipt(AuthorizationContext $actor, string $key, string $fingerprint, int $id, array $response): void
    {
        $this->db->insert('customer_outbox_receipts', ['tenant' => $actor->tenant, 'actor' => $actor->actor, 'request_key' => $key, 'fingerprint' => $fingerprint, 'session_id' => $id, 'response' => self::json($response)]);
    }

    private function audit(array $row, AuthorizationContext $actor, string $action): void
    {
        $this->db->insert('customer_outbox_audit', ['session_id' => $row['id'], 'actor' => $actor->actor, 'action' => $action, 'revision' => $row['revision']]);
    }

    private function requireEnabled(): void
    {
        if ('0' === getenv('KIWI_OUTBOX_ACCEPT_WRITES')) $this->problem(503, 'outbox_writes_paused');
    }

    public static function json(array $value): string
    {
        // PostgreSQL JSONB reorders object keys; identity and retries must not depend on key order.
        if (!array_is_list($value)) ksort($value);
        foreach ($value as $key => $child) {
            if (is_array($child)) $value[$key] = self::decode(self::json($child));
        }
        return json_encode($value, JSON_THROW_ON_ERROR);
    }
    public static function decode(string $value): array { return json_decode($value, true, 512, JSON_THROW_ON_ERROR); }
    private function problem(int $status, string $code, ?string $message = null): never { throw new ApiProblemException($status, $code, $message ?? $code); }
}
