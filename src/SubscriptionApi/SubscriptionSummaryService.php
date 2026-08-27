<?php

declare(strict_types=1);

namespace App\SubscriptionApi;

use App\Webabo\HupApiConfigProvider;

final class SubscriptionSummaryService
{
    public const STATE_LOADED = 'loaded';
    public const STATE_UNAVAILABLE = 'unavailable';

    public function __construct(
        private readonly HupApiConfigProvider $configProvider,
        private readonly PersonSearchClient $personSearchClient,
        private readonly SubscriptionOrderNormalizer $subscriptionOrderNormalizer,
    ) {
    }

    /**
     * @param list<array{personId: string, credentialKey: string}> $persons
     * @return list<array{
     *     personId: string,
     *     credentialKey: string,
     *     state: string,
     *     activeCount: int|null,
     *     activeSubscriptions: list<array{magazine: string}>,
     *     inactiveSubscription: array{magazine: string}|null
     * }>
     */
    public function summarize(array $persons): array
    {
        $summaries = [];

        foreach ($persons as $person) {
            $summaries[] = $this->summarizePerson($person['personId'], $person['credentialKey']);
        }

        return $summaries;
    }

    /**
     * @return array{
     *     personId: string,
     *     credentialKey: string,
     *     state: string,
     *     activeCount: int|null,
     *     activeSubscriptions: list<array{magazine: string}>,
     *     inactiveSubscription: array{magazine: string}|null
     * }
     */
    private function summarizePerson(string $personId, string $credentialKey): array
    {
        try {
            $credential = $this->configProvider->getConfig()->getCredential($credentialKey);
            $ordersPayload = $this->personSearchClient->getOrders($personId, $credential->name);
            $subscriptions = $this->subscriptionOrderNormalizer->normalizeOrders($ordersPayload, $credential);
        } catch (SubscriptionApiResponseException|\RuntimeException) {
            return $this->unavailableSummary($personId, $credentialKey);
        }

        $activeSubscriptions = [];
        $inactiveSubscription = null;

        foreach ($subscriptions as $subscription) {
            $magazine = (string) ($subscription['magazine'] ?? '');
            if ('active' === ($subscription['status'] ?? null)) {
                $activeSubscriptions[] = ['magazine' => $magazine];
                continue;
            }

            if (null === $inactiveSubscription) {
                $inactiveSubscription = ['magazine' => $magazine];
            }
        }

        return [
            'personId' => $personId,
            'credentialKey' => $credentialKey,
            'state' => self::STATE_LOADED,
            'activeCount' => count($activeSubscriptions),
            'activeSubscriptions' => $activeSubscriptions,
            'inactiveSubscription' => $inactiveSubscription,
        ];
    }

    /**
     * @return array{
     *     personId: string,
     *     credentialKey: string,
     *     state: string,
     *     activeCount: null,
     *     activeSubscriptions: list<array{magazine: string}>,
     *     inactiveSubscription: null
     * }
     */
    private function unavailableSummary(string $personId, string $credentialKey): array
    {
        return [
            'personId' => $personId,
            'credentialKey' => $credentialKey,
            'state' => self::STATE_UNAVAILABLE,
            'activeCount' => null,
            'activeSubscriptions' => [],
            'inactiveSubscription' => null,
        ];
    }
}
