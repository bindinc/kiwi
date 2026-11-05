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
        $item = $request->headers->has('X-Kiwi-Outbox-Id')
            ? $this->outbox->get((int) $request->headers->get('X-Kiwi-Outbox-Id'))
            : null;
        $normalized = $this->restoreSubscriptionCopyOrigins($normalized, $item, $request->headers->get('X-Kiwi-Change-Id'));
        $base = [];
        foreach (['recipient', 'requester'] as $roleName) {
            if ($normalized[$roleName]['sameAsRecipient'] ?? false) {
                $normalized[$roleName]['customerReference'] = $normalized['recipient']['customerReference'];
                continue;
            }
            $role = $normalized[$roleName];
            $reference = $this->subscriptionPersonReference($request, $role, $roleName, $normalized['offer']['mandant'], $item);
            $normalized[$roleName]['customerReference'] = $reference;
            if ('requester' === $roleName) {
                continue;
            }
            $person = $role['person'];
            if ('' === $reference['credentialKey'] && null !== $role['personId']) {
                $person = $this->state->getCustomer($request->getSession(), (int) $reference['personId']);
            }
            $person['id'] = (int) $reference['personId'];
            $person['mandant'] = $reference['mandant'];
            $base[] = $this->cleanPreview($person);
        }
        $reference = $normalized['recipient']['customerReference'];
        return $this->outbox->save($request, $reference, 'subscription.create', [$normalized], $base,
            fn (array $changes, array $base, string $selected) => $this->project($request, $changes, $base, $selected, (int) $reference['personId']));
    }

    /** A correction may edit copied details without selecting the source customer again. */
    private function restoreSubscriptionCopyOrigins(array $payload, ?array $item, ?string $changeId): array
    {
        if (null === $item || null === $changeId) return $payload;
        foreach ($item['changes'] as $change) {
            if ($change['id'] !== $changeId || 'subscription.create' !== $change['operation']) continue;
            foreach (['recipient', 'requester'] as $roleName) {
                $role = $payload[$roleName];
                $source = $change['arguments'][0][$roleName]['copiedFromCustomerReference'] ?? null;
                if ('new' === $role['mode'] && !isset($role['copiedFromCustomerReference']) && null !== $source) {
                    $payload[$roleName]['copiedFromCustomerReference'] = CustomerReference::fromArray($source)->toArray();
                }
            }
            break;
        }
        return $payload;
    }

    private function subscriptionPersonReference(Request $request, array $role, string $roleName, string $mandant, ?array $item): array
    {
        if (null !== $role['personId']) {
            return CustomerReference::fromArray(['personId' => $role['personId']] + $role['person'])->toArray();
        }
        if (null !== $item) {
            $reference = $item['customerReference'];
            $source = $role['copiedFromCustomerReference'] ?? null;
            foreach ($item['changes'] as $change) {
                $isSubscription = 'subscription.create' === $change['operation'];
                $storedRole = $isSubscription ? $change['arguments'][0][$roleName] : [];
                $storedSource = CustomerReference::fromArray($storedRole['copiedFromCustomerReference'] ?? null);
                $sameSource = $storedSource?->toArray() === $source;
                $sameMandant = $reference['mandant'] === $mandant;
                if ('new' !== ($storedRole['mode'] ?? null) || !$sameSource || !$sameMandant) continue;
                if ('recipient' === $roleName) return $reference;
                if (null !== $source) {
                    return CustomerReference::fromArray($storedRole['customerReference'])->toArray();
                }
            }
            if ('recipient' === $roleName) {
                throw new ApiProblemException(409, 'outbox_customer_mismatch',
                    'Deze bestelling hoort bij een andere klant of mandant. Voeg deze toe in een aparte klantsessie.');
            }
        }

        $actor = BusinessAccess::requireSessionWrite($request->getSession());
        $group = $request->headers->get('X-Kiwi-New-Customer-Id',
            $request->headers->get('X-Kiwi-Workflow-Session-Id', $request->headers->get('Idempotency-Key', '')));
        $identity = [$actor->tenant, $actor->actor, $group, $mandant, $roleName];
        $source = $role['copiedFromCustomerReference'] ?? null;
        if (null !== $source) {
            $identity[] = $source;
        } elseif ('requester' === $roleName) {
            // Different payers in one recipient session must retain independent identities.
            foreach (['firstName', 'lastName', 'postalCode', 'houseNumber'] as $field) {
                $identity[] = strtoupper(trim((string) ($role['person'][$field] ?? '')));
            }
        }
        return CustomerReference::fromArray(['id' => $this->numericId(SessionOutbox::json($identity)),
            'sourceSystem' => 'kiwi', 'mandant' => $mandant])->toArray();
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
        $appliedPeople = $scratch->get('kiwi_outbox_subscription_people', []);
        foreach (['recipient', 'requester'] as $roleName) {
            $role = $payload[$roleName];
            if (null !== $role['personId'] || ($role['sameAsRecipient'] ?? false)) continue;
            $reference = $role['customerReference'];
            $identity = SessionOutbox::json($reference);
            if (isset($appliedPeople[$identity])) continue;
            $person = $role['person'] + ['id' => (int) $reference['personId'], 'subscriptions' => []];
            $found = false;
            foreach ($state['customers'] as &$customer) {
                if ((string) $customer['id'] !== $reference['personId']) continue;
                $customer = array_replace($customer, $person);
                $found = true;
                break;
            }
            unset($customer);
            if (!$found) $state['customers'][] = $person;
            $appliedPeople[$identity] = true;
        }
        $scratch->set('kiwi_outbox_subscription_people', $appliedPeople);
        foreach ($state['customers'] as &$customer) {
            if ((string) $customer['id'] !== (string) $customerId) continue;
            $customer['subscriptions'] ??= [];
            $customer['subscriptions'][] = $payload['subscription'] + ['id' => $this->numericId($change['id']), 'provisional' => true,
                'requesterPersonId' => $payload['requester']['customerReference']['personId'],
                'requesterReference' => $payload['requester']['customerReference']];
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
