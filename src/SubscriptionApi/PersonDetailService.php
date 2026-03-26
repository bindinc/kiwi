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
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getPerson(string|int $personId, string $credentialName): array
    {
        $credential = $this->configProvider->getConfig()->getCredential($credentialName);
        $payload = $this->personSearchClient->getPerson($personId, $credential->name);

        return $this->personSearchResultNormalizer->normalizeDetailPerson($payload, $credential, (string) $personId);
    }
}
