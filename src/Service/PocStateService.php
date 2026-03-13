<?php

declare(strict_types=1);

namespace App\Service;

use App\Http\ApiProblemException;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\Session\SessionInterface;

final class PocStateService
{
    private const SESSION_STATE_KEY = 'kiwi_poc_state';

    /**
     * @var array<string, mixed>|null
     */
    private ?array $defaultState = null;

    public function __construct(
        private readonly PocCatalogService $catalog,
        #[Autowire('%kernel.project_dir%')]
        private readonly string $projectDir,
    ) {
    }

    /**
     * @param array<string, string> $filters
     * @return array<string, mixed>
     */
    public function searchCustomers(SessionInterface $session, array $filters, int $page, int $pageSize): array
    {
        $state = $this->getState($session);
        $customers = $state['customers'] ?? [];
        if (!\is_array($customers)) {
            $customers = [];
        }

        $filtered = $this->sortAndFilterCustomers(
            $customers,
            $filters['postalCode'] ?? '',
            $filters['houseNumber'] ?? '',
            $filters['name'] ?? '',
            $filters['phone'] ?? '',
            $filters['email'] ?? '',
            $filters['sortBy'] ?? 'name',
        );

        return $this->paginate($filtered, $page, $pageSize);
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function createCustomer(SessionInterface $session, array $payload): array
    {
        $state = $this->getState($session);
        $customer = $payload;
        $customer['id'] = $this->nextCounter($state, 'customer_id');
        $customer['subscriptions'] ??= [];
        $customer['articles'] ??= [];
        $customer['contactHistory'] ??= [];
        $state['customers'][] = $customer;
        $this->saveState($session, $state);

        return $customer;
    }

    /**
     * @return array<string, mixed>
     */
    public function getCustomerState(SessionInterface $session): array
    {
        $state = $this->getState($session);

        return [
            'customers' => $state['customers'] ?? [],
        ];
    }

    /**
     * @param array<int, array<string, mixed>> $customers
     * @return array<string, mixed>
     */
    public function replaceCustomers(SessionInterface $session, array $customers): array
    {
        $state = $this->getState($session);
        $state['customers'] = $customers;
        $this->saveState($session, $state);

        return [
            'status' => 'ok',
            'count' => count($customers),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function getCustomer(SessionInterface $session, int $customerId): array
    {
        $state = $this->getState($session);
        $index = $this->findCustomerIndex($state, $customerId);
        if (null === $index) {
            throw new ApiProblemException(404, 'customer_not_found', 'Customer not found');
        }

        return $state['customers'][$index];
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function updateCustomer(SessionInterface $session, int $customerId, array $payload): array
    {
        $state = $this->getState($session);
        $index = $this->findCustomerIndex($state, $customerId);
        if (null === $index) {
            throw new ApiProblemException(404, 'customer_not_found', 'Customer not found');
        }

        foreach ($payload as $key => $value) {
            $state['customers'][$index][$key] = $value;
        }

        $customer = $state['customers'][$index];
        $this->saveState($session, $state);

        return $customer;
    }

    /**
     * @return array<string, mixed>
     */
    public function getContactHistory(SessionInterface $session, int $customerId, int $page, int $pageSize): array
    {
        $customer = $this->getCustomer($session, $customerId);
        $history = $customer['contactHistory'] ?? [];
        if (!\is_array($history)) {
            $history = [];
        }

        usort(
            $history,
            static fn (array $left, array $right): int => strcmp((string) ($right['date'] ?? ''), (string) ($left['date'] ?? '')),
        );

        return $this->paginate($history, $page, $pageSize);
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function createContactHistoryEntry(SessionInterface $session, int $customerId, array $payload): array
    {
        $state = $this->getState($session);
        $entry = $this->appendContactHistory($state, $customerId, $payload);
        if (null === $entry) {
            throw new ApiProblemException(404, 'customer_not_found', 'Customer not found');
        }

        $this->saveState($session, $state);

        return $entry;
    }

    /**
     * @return array<string, mixed>
     */
    public function updateDeliveryRemarks(SessionInterface $session, int $customerId, string $defaultRemark, string $updatedBy): array
    {
        $state = $this->getState($session);
        $index = $this->findCustomerIndex($state, $customerId);
        if (null === $index) {
            throw new ApiProblemException(404, 'customer_not_found', 'Customer not found');
        }

        $now = $this->utcNowIso();
        $customer = $state['customers'][$index];
        $remarks = $customer['deliveryRemarks'] ?? [
            'default' => '',
            'lastUpdated' => null,
            'history' => [],
        ];
        if (!\is_array($remarks)) {
            $remarks = [
                'default' => '',
                'lastUpdated' => null,
                'history' => [],
            ];
        }

        $previous = (string) ($remarks['default'] ?? '');
        if ($previous !== $defaultRemark) {
            $history = $remarks['history'] ?? [];
            if (!\is_array($history)) {
                $history = [];
            }

            array_unshift($history, [
                'date' => $now,
                'remark' => $defaultRemark,
                'updatedBy' => $updatedBy,
            ]);
            $remarks['history'] = $history;

            $this->appendContactHistory($state, $customerId, [
                'type' => 'Bezorgvoorkeuren gewijzigd',
                'date' => $now,
                'description' => sprintf('Bezorgvoorkeuren bijgewerkt: "%s"', '' !== $defaultRemark ? $defaultRemark : '(leeg)'),
            ]);
        }

        $remarks['default'] = $defaultRemark;
        $remarks['lastUpdated'] = $now;
        $state['customers'][$index]['deliveryRemarks'] = $remarks;
        $this->saveState($session, $state);

        return [
            'deliveryRemarks' => $remarks,
        ];
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function createEditorialComplaint(SessionInterface $session, int $customerId, array $payload): array
    {
        $magazine = trim((string) ($payload['magazine'] ?? ''));
        $complaintType = strtolower(trim((string) ($payload['type'] ?? 'klacht')));
        $category = strtolower(trim((string) ($payload['category'] ?? 'overig')));
        $description = trim((string) ($payload['description'] ?? ''));
        $edition = trim((string) ($payload['edition'] ?? ''));
        $followup = (bool) ($payload['followup'] ?? false);

        if ('' === $magazine) {
            throw new ApiProblemException(400, 'invalid_payload', 'magazine is required');
        }

        if ('' === $description) {
            throw new ApiProblemException(400, 'invalid_payload', 'description is required');
        }

        $typeLabels = [
            'klacht' => 'Klacht',
            'opmerking' => 'Opmerking',
            'suggestie' => 'Suggestie',
            'compliment' => 'Compliment',
        ];
        $categoryLabels = [
            'inhoud' => 'Inhoud artikel',
            'foto' => 'Foto/afbeelding',
            'fout' => 'Fout in tekst',
            'programma' => 'TV/Radio programma',
            'puzzel' => 'Puzzel',
            'advertentie' => 'Advertentie',
            'overig' => 'Overig',
        ];

        $historyDescription = sprintf(
            '%s voor redactie %s - %s. %s',
            $typeLabels[$complaintType] ?? 'Melding',
            $magazine,
            $categoryLabels[$category] ?? 'Overig',
            $description,
        );
        if ('' !== $edition) {
            $historyDescription .= sprintf(' Editie: %s.', $edition);
        }
        if ($followup) {
            $historyDescription .= ' Klant verwacht terugkoppeling.';
        }

        $state = $this->getState($session);
        $entry = $this->appendContactHistory($state, $customerId, [
            'type' => sprintf('Redactie %s', $typeLabels[$complaintType] ?? 'Melding'),
            'description' => $historyDescription,
        ]);
        if (null === $entry) {
            throw new ApiProblemException(404, 'customer_not_found', 'Customer not found');
        }

        $this->saveState($session, $state);

        return ['entry' => $entry];
    }

    /**
     * @return array<string, mixed>
     */
    public function getArticleOrders(SessionInterface $session, int $customerId): array
    {
        $customer = $this->getCustomer($session, $customerId);
        $orders = $customer['articles'] ?? [];
        if (!\is_array($orders)) {
            $orders = [];
        }

        usort(
            $orders,
            static fn (array $left, array $right): int => strcmp((string) ($right['orderDate'] ?? ''), (string) ($left['orderDate'] ?? '')),
        );

        return [
            'items' => $orders,
            'total' => count($orders),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function getCallQueue(SessionInterface $session): array
    {
        $state = $this->getState($session);

        return $this->getCallQueueFromState($state);
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function writeCallQueue(SessionInterface $session, array $payload): array
    {
        $state = $this->getState($session);
        $queue = $this->getCallQueueFromState($state);
        foreach ($payload as $key => $value) {
            $queue[$key] = $value;
        }
        $state['call_queue'] = $queue;
        $this->saveState($session, $state);

        return $queue;
    }

    /**
     * @return array<string, mixed>
     */
    public function clearCallQueue(SessionInterface $session): array
    {
        $state = $this->getState($session);
        $state['call_queue'] = $this->defaultCallQueue();
        $this->saveState($session, $state);

        return $state['call_queue'];
    }

    /**
     * @return array<string, mixed>
     */
    public function generateDebugQueue(SessionInterface $session, int $queueSize, string $queueMix): array
    {
        $state = $this->getState($session);
        $queueSize = max(0, min($queueSize, 100));
        $mix = strtolower(trim($queueMix));
        $knownPercentage = [
            'mostly_known' => 0.8,
            'mostly_anonymous' => 0.2,
            'all_known' => 1.0,
            'all_anonymous' => 0.0,
            'balanced' => 0.5,
        ][$mix] ?? 0.5;

        $services = array_keys($this->catalog->getServiceNumbers());
        $customers = $state['customers'] ?? [];
        if (!\is_array($customers)) {
            $customers = [];
        }

        $queue = [];
        for ($index = 0; $index < $queueSize; ++$index) {
            $serviceNumber = $services[$index % count($services)];
            $waitTime = 30 + (($index * 41) % 271);
            $isKnown = [] !== $customers && (($index % 10) / 10) < $knownPercentage;
            if ($isKnown) {
                $customer = $customers[$index % count($customers)];
                $queue[] = $this->buildQueueEntry($state, (int) ($customer['id'] ?? 0), 'known', $serviceNumber, $waitTime);
                continue;
            }

            $queue[] = $this->buildQueueEntry($state, null, 'anonymous', $serviceNumber, $waitTime);
        }

        $state['call_queue'] = [
            'enabled' => [] !== $queue,
            'queue' => $queue,
            'currentPosition' => 0,
            'autoAdvance' => true,
        ];
        $this->saveState($session, $state);

        return $state['call_queue'];
    }

    /**
     * @return array<string, mixed>
     */
    public function acceptNextCall(SessionInterface $session): array
    {
        $state = $this->getState($session);
        $queue = $this->getCallQueueFromState($state);
        $items = $queue['queue'] ?? [];
        if (!\is_array($items) || [] === $items) {
            throw new ApiProblemException(400, 'queue_empty', 'No callers in queue');
        }

        $nextEntry = array_shift($items);
        if (!\is_array($nextEntry)) {
            throw new ApiProblemException(400, 'queue_empty', 'No callers in queue');
        }

        $callSession = $this->getCallSessionFromState($state);
        $callSession['active'] = true;
        $callSession['callerType'] = $nextEntry['callerType'] ?? 'anonymous';
        $callSession['serviceNumber'] = $nextEntry['serviceNumber'] ?? null;
        $callSession['waitTime'] = $nextEntry['waitTime'] ?? 0;
        $callSession['startTime'] = $this->currentTimestampMs();
        $callSession['customerId'] = $nextEntry['customerId'] ?? null;
        $callSession['customerName'] = $nextEntry['customerName'] ?? null;
        $callSession['pendingIdentification'] = null;
        $callSession['recordingActive'] = false;
        $callSession['totalHoldTime'] = 0;
        $callSession['holdStartTime'] = null;
        $callSession['onHold'] = false;

        $queue['enabled'] = [] !== $items;
        $queue['queue'] = array_values($items);
        $state['call_queue'] = $queue;
        $state['call_session'] = $callSession;
        $this->saveState($session, $state);

        return [
            'accepted' => $nextEntry,
            'call_session' => $callSession,
            'call_queue' => $queue,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function getCallSessionSnapshot(SessionInterface $session): array
    {
        $state = $this->getState($session);

        return [
            'call_session' => $this->getCallSessionFromState($state),
            'last_call_session' => $state['last_call_session'] ?? null,
        ];
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function writeCallSession(SessionInterface $session, array $payload): array
    {
        $state = $this->getState($session);
        $callSession = $this->getCallSessionFromState($state);
        foreach ($payload as $key => $value) {
            $callSession[$key] = $value;
        }
        $state['call_session'] = $callSession;
        $this->saveState($session, $state);

        return $callSession;
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function startDebugCall(SessionInterface $session, array $payload): array
    {
        $state = $this->getState($session);
        $callSession = $this->getCallSessionFromState($state);
        $customerId = $payload['customerId'] ?? null;
        $callerType = $payload['callerType'] ?? 'anonymous';
        if (null !== $customerId && \in_array($callerType, ['known', 'identified'], true)) {
            $callerType = 'identified';
        }

        $callSession['active'] = true;
        $callSession['callerType'] = $callerType;
        $callSession['customerId'] = $customerId;
        $callSession['customerName'] = $payload['customerName'] ?? null;
        $callSession['serviceNumber'] = $payload['serviceNumber'] ?? null;
        $callSession['waitTime'] = $payload['waitTime'] ?? 0;
        $callSession['startTime'] = $this->currentTimestampMs();
        $callSession['pendingIdentification'] = null;
        $callSession['recordingActive'] = false;
        $callSession['totalHoldTime'] = 0;
        $callSession['holdStartTime'] = null;
        $callSession['onHold'] = false;

        $state['call_session'] = $callSession;
        $this->saveState($session, $state);

        return $callSession;
    }

    /**
     * @return array<string, mixed>
     */
    public function identifyCaller(SessionInterface $session, int $customerId): array
    {
        $state = $this->getState($session);
        $customerIndex = $this->findCustomerIndex($state, $customerId);
        if (null === $customerIndex) {
            throw new ApiProblemException(404, 'customer_not_found', 'Customer not found');
        }

        $callSession = $this->getCallSessionFromState($state);
        if (true !== ($callSession['active'] ?? false)) {
            throw new ApiProblemException(400, 'no_active_call', 'No active call session');
        }

        $customer = $state['customers'][$customerIndex];
        $fullName = trim(sprintf(
            '%s %s %s',
            (string) ($customer['firstName'] ?? ''),
            (string) ($customer['middleName'] ?? ''),
            (string) ($customer['lastName'] ?? ''),
        ));

        $callSession['callerType'] = 'identified';
        $callSession['customerId'] = $customerId;
        $callSession['customerName'] = $fullName;
        $state['call_session'] = $callSession;

        $this->appendContactHistory($state, $customerId, [
            'type' => 'call_identified',
            'description' => sprintf(
                'Beller geïdentificeerd tijdens %s call',
                $callSession['serviceNumber'] ?? 'service',
            ),
        ]);

        $this->saveState($session, $state);

        return $callSession;
    }

    /**
     * @return array<string, mixed>
     */
    public function holdCall(SessionInterface $session): array
    {
        $state = $this->getState($session);
        $callSession = $this->getCallSessionFromState($state);
        if (true !== ($callSession['active'] ?? false)) {
            throw new ApiProblemException(400, 'no_active_call', 'No active call session');
        }

        $callSession['onHold'] = true;
        $callSession['holdStartTime'] = $this->currentTimestampMs();
        $state['call_session'] = $callSession;
        $this->saveState($session, $state);

        return $callSession;
    }

    /**
     * @return array<string, mixed>
     */
    public function resumeCall(SessionInterface $session): array
    {
        $state = $this->getState($session);
        $callSession = $this->getCallSessionFromState($state);
        if (true !== ($callSession['active'] ?? false)) {
            throw new ApiProblemException(400, 'no_active_call', 'No active call session');
        }

        $holdStart = $callSession['holdStartTime'] ?? null;
        if (null !== $holdStart) {
            $holdDuration = max(0, intdiv($this->currentTimestampMs() - (int) $holdStart, 1000));
            $callSession['totalHoldTime'] = (int) ($callSession['totalHoldTime'] ?? 0) + $holdDuration;
        }

        $callSession['onHold'] = false;
        $callSession['holdStartTime'] = null;
        $state['call_session'] = $callSession;
        $this->saveState($session, $state);

        return $callSession;
    }

    /**
     * @return array<string, mixed>
     */
    public function endCall(SessionInterface $session, bool $forcedByCustomer): array
    {
        $state = $this->getState($session);
        $callSessionBefore = $this->getCallSessionFromState($state);
        if (true !== ($callSessionBefore['active'] ?? false)) {
            throw new ApiProblemException(400, 'no_active_call', 'No active call session');
        }

        $customerId = $callSessionBefore['customerId'] ?? null;
        if (null !== $customerId) {
            $startTime = $callSessionBefore['startTime'] ?? null;
            $callDuration = null !== $startTime ? max(0, intdiv($this->currentTimestampMs() - (int) $startTime, 1000)) : 0;
            $reason = $forcedByCustomer ? 'call_ended_by_customer' : 'call_ended_by_agent';
            $this->appendContactHistory($state, (int) $customerId, [
                'type' => $reason,
                'description' => sprintf(
                    '%s call beëindigd (duur: %ds, wacht: %ss)',
                    (string) ($callSessionBefore['serviceNumber'] ?? ''),
                    $callDuration,
                    (int) ($callSessionBefore['waitTime'] ?? 0),
                ),
            ]);
        }

        $state['call_session'] = $this->defaultCallSession();
        if (true === ($callSessionBefore['active'] ?? false) && null !== ($callSessionBefore['startTime'] ?? null)) {
            $state['last_call_session'] = [
                'customerId' => $callSessionBefore['customerId'] ?? null,
                'customerName' => $callSessionBefore['customerName'] ?? null,
                'serviceNumber' => $callSessionBefore['serviceNumber'] ?? null,
                'waitTime' => $callSessionBefore['waitTime'] ?? 0,
                'startTime' => $callSessionBefore['startTime'],
                'callDuration' => max(0, intdiv($this->currentTimestampMs() - (int) $callSessionBefore['startTime'], 1000)),
                'totalHoldTime' => $callSessionBefore['totalHoldTime'] ?? 0,
            ];
        }

        $this->saveState($session, $state);

        return [
            'call_session' => $state['call_session'],
            'last_call_session' => $state['last_call_session'] ?? null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function saveDisposition(
        SessionInterface $session,
        string $category,
        string $outcome,
        string $notes,
        bool $followUpRequired,
        ?string $followUpDate,
        string $followUpNotes,
    ): array {
        $state = $this->getState($session);
        $lastCall = $state['last_call_session'] ?? null;
        if (!\is_array($lastCall)) {
            throw new ApiProblemException(400, 'missing_call_session', 'No completed call is available');
        }

        $customerId = $lastCall['customerId'] ?? null;
        if (null !== $customerId) {
            $description = sprintf('%s: %s', $category, $outcome);
            if ('' !== $notes) {
                $description .= ' - '.$notes;
            }
            $this->appendContactHistory($state, (int) $customerId, [
                'type' => 'call_disposition',
                'date' => $this->utcNowIso(),
                'description' => $description,
            ]);

            if ($followUpRequired && null !== $followUpDate && '' !== trim($followUpDate)) {
                $this->appendContactHistory($state, (int) $customerId, [
                    'type' => 'follow_up_scheduled',
                    'date' => $this->utcNowIso(),
                    'description' => sprintf(
                        'Follow-up gepland voor %s: %s',
                        $followUpDate,
                        '' !== $followUpNotes ? $followUpNotes : 'Geen notities',
                    ),
                ]);
            }
        }

        $this->saveState($session, $state);

        return [
            'status' => 'saved',
            'category' => $category,
            'outcome' => $outcome,
        ];
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function updateSubscription(SessionInterface $session, int $customerId, int $subscriptionId, array $payload): array
    {
        $state = $this->getState($session);
        [$customerIndex, $subscriptionIndex] = $this->findSubscriptionLocation($state, $customerId, $subscriptionId);

        foreach ($payload as $key => $value) {
            $state['customers'][$customerIndex]['subscriptions'][$subscriptionIndex][$key] = $value;
        }

        $subscription = $state['customers'][$customerIndex]['subscriptions'][$subscriptionIndex];
        $this->saveState($session, $state);

        return ['subscription' => $subscription];
    }

    /**
     * @return array<string, mixed>
     */
    public function createSubscriptionComplaint(SessionInterface $session, int $customerId, int $subscriptionId, string $reason): array
    {
        $state = $this->getState($session);
        [$customerIndex, $subscriptionIndex] = $this->findSubscriptionLocation($state, $customerId, $subscriptionId);
        $subscription = $state['customers'][$customerIndex]['subscriptions'][$subscriptionIndex];

        $reasonText = [
            'not_received' => 'niet ontvangen',
            'damaged' => 'beschadigd',
            'lost' => 'kwijt',
            'other' => 'anders',
        ][$reason] ?? 'anders';

        $entry = $this->appendContactHistory($state, $customerId, [
            'type' => 'Editie verzonden',
            'description' => sprintf(
                'Laatste editie van %s opnieuw verzonden. Reden: %s.',
                (string) ($subscription['magazine'] ?? ''),
                $reasonText,
            ),
        ]);

        $this->saveState($session, $state);

        return [
            'subscription' => $subscription,
            'entry' => $entry,
        ];
    }

    /**
     * @param array<string, mixed> $offer
     * @return array<string, mixed>
     */
    public function completeWinback(SessionInterface $session, int $customerId, int $subscriptionId, ?string $result, array $offer): array
    {
        $state = $this->getState($session);
        [$customerIndex, $subscriptionIndex] = $this->findSubscriptionLocation($state, $customerId, $subscriptionId);
        $subscription = $state['customers'][$customerIndex]['subscriptions'][$subscriptionIndex];

        if ('accepted' === $result) {
            $entry = $this->appendContactHistory($state, $customerId, [
                'type' => 'Winback succesvol',
                'description' => sprintf(
                    'Klant accepteerde winback aanbod: %s. Abonnement %s blijft actief.',
                    $offer['title'] ?? 'Aanbod',
                    $subscription['magazine'] ?? '',
                ),
            ]);
            $this->saveState($session, $state);

            return [
                'status' => 'retained',
                'subscription' => $subscription,
                'entry' => $entry,
            ];
        }

        array_splice($state['customers'][$customerIndex]['subscriptions'], $subscriptionIndex, 1);
        $entry = $this->appendContactHistory($state, $customerId, [
            'type' => 'Abonnement opgezegd',
            'description' => sprintf(
                'Klant heeft abonnement %s opgezegd na winback poging.',
                $subscription['magazine'] ?? '',
            ),
        ]);
        $this->saveState($session, $state);

        return [
            'status' => 'cancelled',
            'subscriptionId' => $subscriptionId,
            'entry' => $entry,
        ];
    }

    /**
     * @param array<int, array<string, mixed>> $actions
     * @return array<string, mixed>
     */
    public function processDeceasedActions(SessionInterface $session, int $customerId, array $actions): array
    {
        $state = $this->getState($session);
        $customerIndex = $this->findCustomerIndex($state, $customerId);
        if (null === $customerIndex) {
            throw new ApiProblemException(404, 'customer_not_found', 'Customer not found');
        }

        $processed = [];
        foreach ($actions as $action) {
            if (!\is_array($action) || !is_numeric($action['subscriptionId'] ?? null)) {
                continue;
            }

            $subscriptionId = (int) $action['subscriptionId'];
            $subscriptionIndex = $this->findSubscriptionIndex($state['customers'][$customerIndex], $subscriptionId);
            if (null === $subscriptionIndex) {
                continue;
            }

            $operation = $action['action'] ?? null;
            if ('transfer' === $operation) {
                $transferData = \is_array($action['transferData'] ?? null) ? $action['transferData'] : [];
                $state['customers'][$customerIndex]['subscriptions'][$subscriptionIndex]['status'] = 'transferred';
                $state['customers'][$customerIndex]['subscriptions'][$subscriptionIndex]['transferredTo'] = $transferData + [
                    'transferDate' => $this->utcNowIso(),
                ];
                unset($state['customers'][$customerIndex]['subscriptions'][$subscriptionIndex]['refundInfo']);
                $processed[] = [
                    'subscriptionId' => $subscriptionId,
                    'status' => 'transferred',
                ];
                continue;
            }

            $refundData = \is_array($action['refundData'] ?? null) ? $action['refundData'] : [];
            $state['customers'][$customerIndex]['subscriptions'][$subscriptionIndex]['status'] = 'restituted';
            $state['customers'][$customerIndex]['subscriptions'][$subscriptionIndex]['endDate'] = $this->utcNowIso();
            $state['customers'][$customerIndex]['subscriptions'][$subscriptionIndex]['refundInfo'] = [
                'email' => $refundData['email'] ?? null,
                'notes' => $refundData['notes'] ?? '',
                'refundDate' => $this->utcNowIso(),
            ];
            $processed[] = [
                'subscriptionId' => $subscriptionId,
                'status' => 'restituted',
            ];
        }

        $this->appendContactHistory($state, $customerId, [
            'type' => 'Overlijden - Meerdere Abonnementen',
            'description' => 'Abonnementen verwerkt i.v.m. overlijden.',
        ]);
        $this->saveState($session, $state);

        return ['processed' => $processed];
    }

    /**
     * @param array<string, mixed> $transferData
     * @return array<string, mixed>
     */
    public function completeRestitutionTransfer(SessionInterface $session, int $customerId, int $subscriptionId, array $transferData): array
    {
        $state = $this->getState($session);
        [$customerIndex, $subscriptionIndex] = $this->findSubscriptionLocation($state, $customerId, $subscriptionId);

        $state['customers'][$customerIndex]['subscriptions'][$subscriptionIndex]['status'] = 'transferred';
        $state['customers'][$customerIndex]['subscriptions'][$subscriptionIndex]['transferredTo'] = $transferData + [
            'transferDate' => $this->utcNowIso(),
        ];
        unset($state['customers'][$customerIndex]['subscriptions'][$subscriptionIndex]['refundInfo']);

        $subscription = $state['customers'][$customerIndex]['subscriptions'][$subscriptionIndex];
        $this->appendContactHistory($state, $customerId, [
            'type' => 'Restitutie Ongedaan - Abonnement Overgezet',
            'description' => sprintf(
                'Restitutie van %s ongedaan gemaakt en abonnement overgezet.',
                $subscription['magazine'] ?? '',
            ),
        ]);

        $this->saveState($session, $state);

        return ['subscription' => $subscription];
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function createSubscriptionSignup(SessionInterface $session, array $payload): array
    {
        if (isset($payload['customerId']) || isset($payload['customer'])) {
            throw new ApiProblemException(
                400,
                'invalid_payload',
                'Legacy customerId/customer payload is not supported; use recipient/requester instead',
            );
        }

        $recipientRaw = $payload['recipient'] ?? null;
        $requesterRaw = $payload['requester'] ?? null;
        $subscriptionPayload = \is_array($payload['subscription'] ?? null) ? $payload['subscription'] : [];
        $contactEntry = \is_array($payload['contactEntry'] ?? null) ? $payload['contactEntry'] : null;

        if ([] === $subscriptionPayload) {
            throw new ApiProblemException(400, 'invalid_payload', 'subscription payload is required');
        }

        $recipientSpec = $this->parseRolePayload($recipientRaw, 'recipient', false);
        $requesterSpec = $this->parseRolePayload($requesterRaw, 'requester', true);

        $state = $this->getState($session);
        $recipient = $this->resolveExistingRolePerson($state, $recipientSpec, 'recipient');
        $requester = 'same_as_recipient' === $requesterSpec['mode']
            ? null
            : $this->resolveExistingRolePerson($state, $requesterSpec, 'requester');

        $createdRecipient = false;
        if (null === $recipient) {
            $recipient = $this->createCustomerInState($state, $recipientSpec['person_payload']);
            $createdRecipient = true;
        }

        $createdRequester = false;
        if ('same_as_recipient' === $requesterSpec['mode']) {
            $requester = $recipient;
        } elseif (null === $requester) {
            $requester = $this->createCustomerInState($state, $requesterSpec['person_payload']);
            $createdRequester = true;
        }

        $subscription = [
            'id' => $subscriptionPayload['id'] ?? $this->nextCounter($state, 'subscription_id'),
            'magazine' => $subscriptionPayload['magazine'] ?? null,
            'duration' => $subscriptionPayload['duration'] ?? null,
            'durationLabel' => $subscriptionPayload['durationLabel'] ?? null,
            'startDate' => $subscriptionPayload['startDate'] ?? null,
            'status' => $subscriptionPayload['status'] ?? 'active',
            'lastEdition' => $subscriptionPayload['lastEdition'] ?? $this->utcTodayIso(),
            'recipientPersonId' => (int) $recipient['id'],
            'requesterPersonId' => (int) $requester['id'],
        ];
        $recipient['subscriptions'] ??= [];
        $recipient['subscriptions'][] = $subscription;
        $this->replaceCustomerInState($state, $recipient);

        [$recipientEntry, $requesterEntry] = $this->buildSignupHistoryEntries(
            $subscriptionPayload,
            (int) $recipient['id'],
            (int) $requester['id'],
            $contactEntry,
        );

        $this->appendContactHistory($state, (int) $recipient['id'], $recipientEntry);
        if (null !== $requesterEntry) {
            $this->appendContactHistory($state, (int) $requester['id'], $requesterEntry);
        }

        $recipient = $this->readCustomerFromState($state, (int) $recipient['id']);
        $requester = $this->readCustomerFromState($state, (int) $requester['id']);
        $this->saveState($session, $state);

        return [
            'recipient' => $recipient,
            'requester' => $requester,
            'subscription' => $subscription,
            'createdRecipient' => $createdRecipient,
            'createdRequester' => $createdRequester,
        ];
    }

    /**
     * @param array<string, mixed> $payload
     * @param array<string, mixed>|null $customerPayload
     * @param array<string, mixed> $orderPayload
     * @param array<string, mixed>|null $contactEntry
     * @return array<string, mixed>
     */
    public function createArticleOrder(
        SessionInterface $session,
        ?int $customerId,
        ?array $customerPayload,
        array $orderPayload,
        ?array $contactEntry,
    ): array {
        if ([] === $orderPayload) {
            throw new ApiProblemException(400, 'invalid_payload', 'order payload is required');
        }

        $items = \is_array($orderPayload['items'] ?? null) ? $orderPayload['items'] : [];
        $quote = $this->catalog->quoteArticleOrder($items, $orderPayload['couponCode'] ?? null);

        $state = $this->getState($session);
        $customer = null;
        $createdCustomer = false;

        if (null !== $customerId) {
            $customer = $this->readCustomerFromState($state, $customerId);
        } else {
            if (null === $customerPayload || [] === $customerPayload) {
                throw new ApiProblemException(400, 'invalid_payload', 'customer payload is required when customerId is not provided');
            }

            $customer = $this->createCustomerInState($state, $customerPayload);
            $createdCustomer = true;
        }

        $order = [
            'id' => $orderPayload['id'] ?? $this->nextCounter($state, 'article_order_id'),
            'orderDate' => $orderPayload['orderDate'] ?? $this->utcTodayIso(),
            'desiredDeliveryDate' => $orderPayload['desiredDeliveryDate'] ?? null,
            'deliveryStatus' => $orderPayload['deliveryStatus'] ?? 'ordered',
            'trackingNumber' => $orderPayload['trackingNumber'] ?? null,
            'paymentStatus' => $orderPayload['paymentStatus'] ?? 'paid',
            'paymentMethod' => $orderPayload['paymentMethod'] ?? 'iDEAL',
            'paymentDate' => $orderPayload['paymentDate'] ?? $this->utcTodayIso(),
            'actualDeliveryDate' => $orderPayload['actualDeliveryDate'] ?? null,
            'returnDeadline' => $orderPayload['returnDeadline'] ?? null,
            'notes' => $orderPayload['notes'] ?? '',
            'items' => $quote['items'],
            'subtotal' => $quote['subtotal'],
            'discounts' => $quote['discounts'],
            'totalDiscount' => $quote['totalDiscount'],
            'total' => $quote['total'],
            'couponCode' => $quote['couponCode'] ?? null,
        ];

        $customer['articles'] ??= [];
        $customer['articles'][] = $order;
        $this->replaceCustomerInState($state, $customer);

        if (null !== $contactEntry) {
            $this->appendContactHistory($state, (int) $customer['id'], $contactEntry);
        }

        $customer = $this->readCustomerFromState($state, (int) $customer['id']);
        $this->saveState($session, $state);

        return [
            'customer' => $customer,
            'order' => $order,
            'createdCustomer' => $createdCustomer,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function resetState(SessionInterface $session): array
    {
        $state = $this->deepCopyDefaultState();
        $this->saveState($session, $state);

        return [
            'status' => 'ok',
            'message' => 'POC state reset',
            'customers' => $state['customers'] ?? [],
            'call_queue' => $state['call_queue'] ?? [],
            'call_session' => $state['call_session'] ?? [],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function getBootstrapState(SessionInterface $session): array
    {
        $state = $this->getState($session);

        return [
            'customers' => $state['customers'] ?? [],
            'call_queue' => $state['call_queue'] ?? [],
            'call_session' => $state['call_session'] ?? [],
            'last_call_session' => $state['last_call_session'] ?? null,
            'catalog' => $this->catalog->getCatalogBootstrap(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function getState(SessionInterface $session): array
    {
        $state = $session->get(self::SESSION_STATE_KEY);
        if (!\is_array($state)) {
            $state = $this->deepCopyDefaultState();
            $this->saveState($session, $state);
        }

        return $state;
    }

    /**
     * @param array<string, mixed> $state
     */
    private function saveState(SessionInterface $session, array $state): void
    {
        $session->set(self::SESSION_STATE_KEY, $state);
    }

    /**
     * @return array<string, mixed>
     */
    private function deepCopyDefaultState(): array
    {
        return json_decode(
            json_encode($this->loadDefaultState(), \JSON_THROW_ON_ERROR),
            true,
            512,
            \JSON_THROW_ON_ERROR,
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function loadDefaultState(): array
    {
        if (null !== $this->defaultState) {
            return $this->defaultState;
        }

        $raw = file_get_contents($this->projectDir.'/fixtures/default_state.json');
        if (false === $raw) {
            $this->defaultState = [];

            return $this->defaultState;
        }

        $decoded = json_decode($raw, true);
        $this->defaultState = \is_array($decoded) ? $decoded : [];

        return $this->defaultState;
    }

    /**
     * @param array<int, array<string, mixed>> $items
     * @return array<string, mixed>
     */
    private function paginate(array $items, int $page, int $pageSize): array
    {
        $safePage = max(1, $page);
        $safeSize = max(1, min($pageSize, 200));
        $total = count($items);
        $start = ($safePage - 1) * $safeSize;

        return [
            'items' => array_slice($items, $start, $safeSize),
            'page' => $safePage,
            'pageSize' => $safeSize,
            'total' => $total,
        ];
    }

    /**
     * @param array<int, array<string, mixed>> $customers
     * @return array<int, array<string, mixed>>
     */
    private function sortAndFilterCustomers(
        array $customers,
        string $postalCode,
        string $houseNumber,
        string $name,
        string $phone,
        string $email,
        string $sortBy,
    ): array {
        $normalizedPostal = strtoupper(trim($postalCode));
        $normalizedHouse = trim($houseNumber);
        $normalizedName = strtolower(trim($name));
        $normalizedPhone = preg_replace('/\D+/', '', $phone) ?? '';
        $normalizedEmail = strtolower(trim($email));

        $filtered = array_values(array_filter($customers, static function (array $customer) use (
            $normalizedPostal,
            $normalizedHouse,
            $normalizedName,
            $normalizedPhone,
            $normalizedEmail,
        ): bool {
            if ('' !== $normalizedPostal && strtoupper((string) ($customer['postalCode'] ?? '')) !== $normalizedPostal) {
                return false;
            }

            if ('' !== $normalizedHouse && (string) ($customer['houseNumber'] ?? '') !== $normalizedHouse) {
                return false;
            }

            if ('' !== $normalizedName) {
                $candidates = [
                    (string) ($customer['firstName'] ?? ''),
                    (string) ($customer['lastName'] ?? ''),
                    trim(sprintf('%s %s', (string) ($customer['firstName'] ?? ''), (string) ($customer['lastName'] ?? ''))),
                    trim(sprintf(
                        '%s %s %s',
                        (string) ($customer['firstName'] ?? ''),
                        (string) ($customer['middleName'] ?? ''),
                        (string) ($customer['lastName'] ?? ''),
                    )),
                ];

                $matched = false;
                foreach ($candidates as $candidate) {
                    if (str_contains(strtolower($candidate), $normalizedName)) {
                        $matched = true;
                        break;
                    }
                }

                if (!$matched) {
                    return false;
                }
            }

            if ('' !== $normalizedPhone) {
                $customerPhone = preg_replace('/\D+/', '', (string) ($customer['phone'] ?? '')) ?? '';
                if (!str_contains($customerPhone, $normalizedPhone)) {
                    return false;
                }
            }

            if ('' !== $normalizedEmail && !str_contains(strtolower((string) ($customer['email'] ?? '')), $normalizedEmail)) {
                return false;
            }

            return true;
        }));

        if ('postal' === $sortBy) {
            usort($filtered, static fn (array $left, array $right): int => strcmp((string) ($left['postalCode'] ?? ''), (string) ($right['postalCode'] ?? '')));

            return $filtered;
        }

        if ('subscriptions' === $sortBy) {
            usort($filtered, static function (array $left, array $right): int {
                $leftCount = count(array_filter(
                    $left['subscriptions'] ?? [],
                    static fn (array $subscription): bool => 'active' === ($subscription['status'] ?? null),
                ));
                $rightCount = count(array_filter(
                    $right['subscriptions'] ?? [],
                    static fn (array $subscription): bool => 'active' === ($subscription['status'] ?? null),
                ));

                return $rightCount <=> $leftCount;
            });

            return $filtered;
        }

        usort($filtered, static fn (array $left, array $right): int => [
            strtolower((string) ($left['lastName'] ?? '')),
            strtolower((string) ($left['firstName'] ?? '')),
        ] <=> [
            strtolower((string) ($right['lastName'] ?? '')),
            strtolower((string) ($right['firstName'] ?? '')),
        ]);

        return $filtered;
    }

    /**
     * @param array<string, mixed> $state
     */
    private function nextCounter(array &$state, string $key): int
    {
        $state['counters'] ??= [];
        $current = (int) ($state['counters'][$key] ?? 1);
        $state['counters'][$key] = $current + 1;

        return $current;
    }

    private function utcNowIso(): string
    {
        return (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->format(\DateTimeInterface::ATOM);
    }

    private function utcTodayIso(): string
    {
        return (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->format('Y-m-d');
    }

    private function currentTimestampMs(): int
    {
        return (int) round(microtime(true) * 1000);
    }

    /**
     * @param array<string, mixed> $state
     */
    private function findCustomerIndex(array $state, int $customerId): ?int
    {
        $customers = $state['customers'] ?? [];
        if (!\is_array($customers)) {
            return null;
        }

        foreach ($customers as $index => $customer) {
            if ((int) ($customer['id'] ?? -1) === $customerId) {
                return $index;
            }
        }

        return null;
    }

    /**
     * @param array<string, mixed> $state
     * @return array<string, mixed>
     */
    private function readCustomerFromState(array $state, int $customerId): array
    {
        $index = $this->findCustomerIndex($state, $customerId);
        if (null === $index) {
            throw new ApiProblemException(404, 'customer_not_found', 'Customer not found');
        }

        return $state['customers'][$index];
    }

    /**
     * @param array<string, mixed> $state
     * @return array<string, mixed>|null
     */
    private function appendContactHistory(array &$state, int $customerId, array $entry): ?array
    {
        $customerIndex = $this->findCustomerIndex($state, $customerId);
        if (null === $customerIndex) {
            return null;
        }

        $normalized = [
            'id' => $entry['id'] ?? $this->nextCounter($state, 'contact_history_id'),
            'type' => $entry['type'] ?? 'default',
            'date' => $entry['date'] ?? $this->utcNowIso(),
            'description' => $entry['description'] ?? '',
        ];

        $history = $state['customers'][$customerIndex]['contactHistory'] ?? [];
        if (!\is_array($history)) {
            $history = [];
        }
        array_unshift($history, $normalized);
        $state['customers'][$customerIndex]['contactHistory'] = $history;

        return $normalized;
    }

    /**
     * @param array<string, mixed> $state
     * @return array<string, mixed>
     */
    private function getCallQueueFromState(array &$state): array
    {
        if (!isset($state['call_queue']) || !\is_array($state['call_queue'])) {
            $state['call_queue'] = $this->defaultCallQueue();
        }

        return $state['call_queue'];
    }

    /**
     * @return array<string, mixed>
     */
    private function defaultCallQueue(): array
    {
        return [
            'enabled' => false,
            'queue' => [],
            'currentPosition' => 0,
            'autoAdvance' => true,
        ];
    }

    /**
     * @param array<string, mixed> $state
     * @return array<string, mixed>
     */
    private function getCallSessionFromState(array &$state): array
    {
        if (!isset($state['call_session']) || !\is_array($state['call_session'])) {
            $state['call_session'] = $this->defaultCallSession();
        }

        return $state['call_session'];
    }

    /**
     * @return array<string, mixed>
     */
    private function defaultCallSession(): array
    {
        return [
            'active' => false,
            'callerType' => 'anonymous',
            'customerId' => null,
            'customerName' => null,
            'serviceNumber' => null,
            'waitTime' => 0,
            'startTime' => null,
            'pendingIdentification' => null,
            'recordingActive' => false,
            'totalHoldTime' => 0,
            'holdStartTime' => null,
            'onHold' => false,
        ];
    }

    /**
     * @param array<string, mixed> $state
     * @return array<string, mixed>
     */
    private function buildQueueEntry(array &$state, ?int $customerId, string $callerType, string $serviceNumber, int $waitTime): array
    {
        $customerName = 'Anonieme Beller';
        if (null !== $customerId) {
            $customerIndex = $this->findCustomerIndex($state, $customerId);
            if (null !== $customerIndex) {
                $customer = $state['customers'][$customerIndex];
                $middleName = trim((string) ($customer['middleName'] ?? ''));
                $customerName = trim(sprintf(
                    '%s %s %s',
                    (string) ($customer['firstName'] ?? ''),
                    $middleName,
                    (string) ($customer['lastName'] ?? ''),
                ));
                if ('' === $customerName) {
                    $customerName = sprintf('Klant %d', $customerId);
                }
            }
        }

        return [
            'id' => sprintf('queue_%d', $this->nextCounter($state, 'queue_id')),
            'callerType' => $callerType,
            'customerId' => $customerId,
            'customerName' => $customerName,
            'serviceNumber' => $serviceNumber,
            'waitTime' => $waitTime,
            'queuedAt' => $this->currentTimestampMs(),
            'priority' => 1,
        ];
    }

    /**
     * @param array<string, mixed> $customer
     */
    private function findSubscriptionIndex(array $customer, int $subscriptionId): ?int
    {
        $subscriptions = $customer['subscriptions'] ?? [];
        if (!\is_array($subscriptions)) {
            return null;
        }

        foreach ($subscriptions as $index => $subscription) {
            if ((int) ($subscription['id'] ?? -1) === $subscriptionId) {
                return $index;
            }
        }

        return null;
    }

    /**
     * @param array<string, mixed> $state
     * @return array{0: int, 1: int}
     */
    private function findSubscriptionLocation(array $state, int $customerId, int $subscriptionId): array
    {
        $customerIndex = $this->findCustomerIndex($state, $customerId);
        if (null === $customerIndex) {
            throw new ApiProblemException(404, 'customer_not_found', 'Customer not found');
        }

        $subscriptionIndex = $this->findSubscriptionIndex($state['customers'][$customerIndex], $subscriptionId);
        if (null === $subscriptionIndex) {
            throw new ApiProblemException(404, 'subscription_not_found', 'Subscription not found');
        }

        return [$customerIndex, $subscriptionIndex];
    }

    /**
     * @param array<string, mixed> $rolePayload
     * @return array<string, mixed>
     */
    private function parseRolePayload(mixed $rolePayload, string $roleName, bool $allowSameAsRecipient): array
    {
        if (!\is_array($rolePayload)) {
            throw new ApiProblemException(400, 'invalid_payload', sprintf('%s must be an object', $roleName));
        }

        $hasPersonId = null !== ($rolePayload['personId'] ?? null) && '' !== (string) ($rolePayload['personId'] ?? '');
        $hasPersonPayload = \is_array($rolePayload['person'] ?? null);
        $hasSameAsRecipient = $allowSameAsRecipient && true === ($rolePayload['sameAsRecipient'] ?? false);

        $selectedModes = (int) $hasPersonId + (int) $hasPersonPayload + (int) $hasSameAsRecipient;
        if (1 !== $selectedModes) {
            $allowed = $allowSameAsRecipient ? 'personId, person, or sameAsRecipient=true' : 'personId or person';
            throw new ApiProblemException(400, 'invalid_payload', sprintf('%s must contain exactly one of %s', $roleName, $allowed));
        }

        if ($hasSameAsRecipient) {
            return ['mode' => 'same_as_recipient'];
        }

        if ($hasPersonId) {
            if (!is_numeric($rolePayload['personId'])) {
                throw new ApiProblemException(400, 'invalid_payload', sprintf('%s.personId must be an integer', $roleName));
            }

            $personId = (int) $rolePayload['personId'];
            if ($personId < 1) {
                throw new ApiProblemException(400, 'invalid_payload', sprintf('%s.personId must be >= 1', $roleName));
            }

            return [
                'mode' => 'existing',
                'person_id' => $personId,
            ];
        }

        $personPayload = $rolePayload['person'];
        if (!\is_array($personPayload) || [] === $personPayload) {
            throw new ApiProblemException(400, 'invalid_payload', sprintf('%s.person must be a non-empty object', $roleName));
        }

        return [
            'mode' => 'new',
            'person_payload' => $personPayload,
        ];
    }

    /**
     * @param array<string, mixed> $state
     * @param array<string, mixed> $roleSpec
     * @return array<string, mixed>|null
     */
    private function resolveExistingRolePerson(array $state, array $roleSpec, string $roleName): ?array
    {
        if ('existing' !== ($roleSpec['mode'] ?? null)) {
            return null;
        }

        $person = $this->readCustomerFromState($state, (int) $roleSpec['person_id']);
        if ([] === $person) {
            throw new ApiProblemException(404, 'customer_not_found', sprintf('%s person not found', $roleName));
        }

        return $person;
    }

    /**
     * @param array<string, mixed> $state
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    private function createCustomerInState(array &$state, array $payload): array
    {
        $customer = $payload;
        $customer['id'] = $this->nextCounter($state, 'customer_id');
        $customer['subscriptions'] ??= [];
        $customer['articles'] ??= [];
        $customer['contactHistory'] ??= [];
        $state['customers'][] = $customer;

        return $customer;
    }

    /**
     * @param array<string, mixed> $state
     * @param array<string, mixed> $customer
     */
    private function replaceCustomerInState(array &$state, array $customer): void
    {
        $customerIndex = $this->findCustomerIndex($state, (int) ($customer['id'] ?? 0));
        if (null === $customerIndex) {
            throw new ApiProblemException(404, 'customer_not_found', 'Customer not found');
        }

        $state['customers'][$customerIndex] = $customer;
    }

    /**
     * @param array<string, mixed> $subscriptionPayload
     * @param array<string, mixed>|null $contactEntry
     * @return array{0: array<string, mixed>, 1: array<string, mixed>|null}
     */
    private function buildSignupHistoryEntries(
        array $subscriptionPayload,
        int $recipientId,
        int $requesterId,
        ?array $contactEntry,
    ): array {
        $magazine = $subscriptionPayload['magazine'] ?? 'Onbekend magazine';
        $duration = $subscriptionPayload['durationLabel'] ?? $subscriptionPayload['duration'] ?? 'onbekende looptijd';

        if (null !== $contactEntry) {
            $recipientEntry = $contactEntry;
            $recipientEntry['type'] ??= 'Nieuw abonnement';
            $baseDescription = trim((string) ($recipientEntry['description'] ?? ''));
        } else {
            $recipientEntry = ['type' => 'Nieuw abonnement'];
            $baseDescription = sprintf('Abonnement %s (%s) aangemaakt.', $magazine, $duration);
        }

        if ($requesterId !== $recipientId) {
            $recipientEntry['description'] = '' !== $baseDescription
                ? sprintf('%s Aangevraagd/betaald door persoon #%d.', $baseDescription, $requesterId)
                : sprintf('Aangevraagd/betaald door persoon #%d.', $requesterId);

            return [
                $recipientEntry,
                [
                    'type' => 'Abonnement aangevraagd',
                    'description' => sprintf('Abonnement %s (%s) aangevraagd/betaald voor persoon #%d.', $magazine, $duration, $recipientId),
                ],
            ];
        }

        $recipientEntry['description'] = $baseDescription;

        return [$recipientEntry, null];
    }
}
