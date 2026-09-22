<?php

declare(strict_types=1);

namespace App\OutboxSession;

use App\CustomerWorkSession\CustomerReference;
use App\Http\ApiProblemException;
use App\Security\BusinessAccess;
use App\Service\PocStateService;
use App\Service\SubscriptionQueueService;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Session\Session;
use Symfony\Component\HttpFoundation\Session\Storage\MockArraySessionStorage;

/** Runs existing local business validation on an isolated projection, never the live session. */
final class DeferredCustomerWrites
{
    private const OPERATIONS = ['createCustomer', 'updateCustomer', 'createContactHistoryEntry',
        'updateDeliveryRemarks', 'createEditorialComplaint', 'updateSubscription',
        'createSubscriptionComplaint', 'completeWinback', 'processDeceasedActions',
        'completeRestitutionTransfer', 'createArticleOrder'];

    public function __construct(private readonly SessionOutbox $outbox, private readonly PocStateService $state) {}

    public function stage(Request $request, string $operation, mixed ...$arguments): array
    {
        BusinessAccess::requireSessionWrite($request->getSession());
        if (!in_array($operation, self::OPERATIONS, true)) throw new \LogicException('Unsupported deferred operation');
        $this->rejectTechnicalData($arguments);
        $customerId = 'createCustomer' === $operation ? null : $arguments[0];
        $customer = null !== $customerId ? $this->state->getCustomer($request->getSession(), (int) $customerId) : null;
        $temporaryId = $this->temporaryId($request);
        $reference = CustomerReference::fromArray($customer ?? ['id' => $temporaryId])->toArray();
        if ('createArticleOrder' === $operation && null === $customerId && $request->headers->has('X-Kiwi-Outbox-Id') && !$request->headers->has('X-Kiwi-Change-Id')) {
            $arguments[0] = $temporaryId;
        }
        $base = $customer ? [$this->cleanPreview($customer)] : [];
        return $this->outbox->save($request, $reference, $operation, $arguments, $base,
            fn (array $changes, array $base, string $selected) => $this->project($request, $changes, $base, $selected, (int) $reference['personId']));
    }

    public function subscription(Request $request, array $payload, SubscriptionQueueService $queue): array
    {
        BusinessAccess::requireSessionWrite($request->getSession());
        $normalized = $queue->normalizeQueuePayload($request->getSession(), $payload);
        unset($normalized['customerContext']);
        $this->rejectTechnicalData($normalized);
        $person = $normalized['recipient']['person'];
        $person['id'] = $normalized['recipient']['personId'] ?? $this->temporaryId($request);
        $person['credentialKey'] = $normalized['recipient']['credentialKey'] ?? $person['credentialKey'] ?? '';
        $reference = CustomerReference::fromArray($person)->toArray();
        if ('' === $reference['credentialKey'] && null !== ($normalized['recipient']['personId'] ?? null)) {
            $person = $this->state->getCustomer($request->getSession(), (int) $reference['personId']);
        }
        $base = [$this->cleanPreview($person)];
        return $this->outbox->save($request, $reference, 'subscription.create', [$normalized], $base,
            fn (array $changes, array $base, string $selected) => $this->project($request, $changes, $base, $selected, (int) $reference['personId']));
    }

    private function project(Request $request, array $changes, array $base, string $selected, int $customerId): array
    {
        $scratch = new Session(new MockArraySessionStorage());
        $scratch->set(\App\Security\AuthorizationContext::SESSION_KEY, BusinessAccess::requireSessionWrite($request->getSession())->toArray());
        $scratch->set('kiwi_outbox_projection', true);
        $scratch->set('kiwi_poc_state', ['customers' => $base, 'counters' => ['customer_id' => $customerId]]);
        $response = [];
        foreach ($changes as $change) {
            $operation = $change['operation'];
            if ('subscription.create' === $operation) {
                $result = $this->projectSubscription($scratch, $change, $customerId);
            } else {
                if (!in_array($operation, self::OPERATIONS, true)) throw new \LogicException('Unsupported stored operation');
                $before = $this->state->getCustomerState($scratch)['customers'];
                $this->validateBusinessChange($operation, $change['arguments'], $before);
                $projection = $scratch->get('kiwi_poc_state');
                foreach (['article_order_id', 'contact_history_id', 'subscription_id'] as $counter) $projection['counters'][$counter] = $this->numericId($change['id']);
                $scratch->set('kiwi_poc_state', $projection);
                $result = $this->state->previewOperation($scratch, $operation, $change['arguments'], $change['recordedAt']);
                if ('createCustomer' === $operation) $scratch->set('kiwi_outbox_new_customer_applied', true);
                if ($selected === $change['id'] && $before === $this->state->getCustomerState($scratch)['customers']) {
                    throw new ApiProblemException(422, 'outbox_no_changes', 'Er zijn geen gewijzigde gegevens om op te slaan.');
                }
            }
            if ($selected === $change['id']) $response = $result;
        }
        return ['response' => $response, 'customers' => $this->state->getCustomerState($scratch)['customers']];
    }

    private function projectSubscription(Session $scratch, array $change, int $customerId): array
    {
        $payload = $change['arguments'][0];
        $state = $scratch->get('kiwi_poc_state');
        foreach ($state['customers'] as &$customer) {
            if ((string) $customer['id'] !== (string) $customerId) continue;
            if (null === $payload['recipient']['personId'] && !$scratch->get('kiwi_outbox_new_customer_applied', false)) {
                $customer = array_replace($customer, $payload['recipient']['person']);
                $scratch->set('kiwi_outbox_new_customer_applied', true);
            }
            $customer['subscriptions'] ??= [];
            $customer['subscriptions'][] = $payload['subscription'] + ['id' => $this->numericId($change['id']), 'provisional' => true];
        }
        unset($customer);
        $scratch->set('kiwi_poc_state', $state);
        return ['status' => 'queued', 'submissionId' => $change['id'], 'summary' => ['recipient' => $payload['recipient'], 'requester' => $payload['requester'], 'offer' => $payload['offer'], 'subscription' => $payload['subscription']]];
    }

    private function validateBusinessChange(string $operation, array $arguments, array $customers): void
    {
        $customerId = is_int($arguments[0] ?? null) ? $arguments[0] : 0;
        $customer = array_column($customers, null, 'id')[$customerId] ?? [];
        $valid = true;
        if ('createContactHistoryEntry' === $operation) {
            $entry = $arguments[1];
            $valid = '' !== trim((string) ($entry['type'] ?? '')) && '' !== trim((string) ($entry['description'] ?? ''));
        }
        if ('updateDeliveryRemarks' === $operation) {
            $valid = ($customer['deliveryRemarks']['default'] ?? '') !== $arguments[1];
        }
        if ('processDeceasedActions' === $operation) {
            $subscriptions = array_column($customer['subscriptions'] ?? [], null, 'id');
            $valid = [] !== $arguments[1];
            foreach ($arguments[1] as $action) {
                $valid = $valid && isset($subscriptions[$action['subscriptionId'] ?? 0])
                    && in_array($action['action'] ?? null, ['transfer', 'cancel_refund'], true);
            }
        }
        if (!$valid) throw new ApiProblemException(422, 'outbox_no_changes', 'Sla een geldige zakelijke wijziging op.');
    }

    private function temporaryId(Request $request): int
    {
        $actor = BusinessAccess::requireSessionWrite($request->getSession());
        if ($request->headers->has('X-Kiwi-Outbox-Id')) {
            $existing = $this->outbox->get((int) $request->headers->get('X-Kiwi-Outbox-Id'));
            return (int) $existing['customerReference']['personId'];
        }
        return $this->numericId($actor->tenant.'|'.$actor->actor.'|'.$request->headers->get('X-Kiwi-New-Customer-Id', $request->headers->get('Idempotency-Key', '')));
    }

    private function numericId(string $key): int { return 1000000000000 + (int) hexdec(substr(hash('sha256', $key), 0, 10)); }

    private function cleanPreview(array $customer): array
    {
        unset($customer['outboxSession'], $customer['outbox'], $customer['provisional'], $customer['addressValidation'], $customer['editing']);
        return $customer;
    }

    private function rejectTechnicalData(array $values): void
    {
        foreach ($values as $key => $value) {
            if (is_string($key) && preg_match('/^(authorization|password|access_token|refresh_token|id_token|client_secret|cookie|roles|tenant)$/i', $key)) {
                throw new ApiProblemException(400, 'invalid_business_payload', 'Technical authentication data is not business data');
            }
            if (is_array($value)) $this->rejectTechnicalData($value);
        }
    }
}
