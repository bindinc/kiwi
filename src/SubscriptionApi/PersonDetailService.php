<?php

declare(strict_types=1);

namespace App\SubscriptionApi;

use App\Webabo\HupApiConfigProvider;

final class PersonDetailService
{
    public function __construct(
        private readonly HupApiConfigProvider $configProvider,
        private readonly PersonSearchClient $personSearchClient,
        private readonly PersonSearchResultNormalizer $personSearchResultNormalizer,
        private readonly SubscriptionOrderNormalizer $subscriptionOrderNormalizer,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getPerson(string|int $personId, string $credentialName): array
    {
        $credential = $this->configProvider->getConfig()->getCredential($credentialName);
        $payload = $this->personSearchClient->getPerson($personId, $credential->name);
        $normalizedPerson = $this->personSearchResultNormalizer->normalizeDetailPerson($payload, $credential, (string) $personId);

        $normalizedPerson['subscriptions'] = $this->loadSubscriptions($personId, $credential);

        return $normalizedPerson;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function loadSubscriptions(string|int $personId, \App\Webabo\HupApiCredential $credential): array
    {
        try {
            $ordersPayload = $this->personSearchClient->getOrders($personId, $credential->name);
        } catch (SubscriptionApiResponseException|\RuntimeException) {
            // Keep customer selection usable even when order enrichment is temporarily unavailable.
            return [];
        }

        return $this->subscriptionOrderNormalizer->normalizeOrders($ordersPayload, $credential);
    }
}
