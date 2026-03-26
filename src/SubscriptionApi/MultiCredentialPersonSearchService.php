<?php

declare(strict_types=1);

namespace App\SubscriptionApi;

use App\Webabo\HupApiConfigProvider;
use App\Webabo\HupApiCredential;

final class MultiCredentialPersonSearchService
{
    public function __construct(
        private readonly HupApiConfigProvider $configProvider,
        private readonly PersonSearchClient $personSearchClient,
    ) {
    }

    /**
     * @param array<string, scalar|null> $queryParameters
     * @return array<int, CredentialPersonSearchResult>
     */
    public function search(array $queryParameters): array
    {
        $results = [];

        foreach ($this->findSearchableCredentials() as $credential) {
            $credentialQuery = $this->buildCredentialQuery($queryParameters, $credential);
            $payload = $this->personSearchClient->search($credentialQuery, $credential->name);

            $results[] = new CredentialPersonSearchResult($credential, $payload);
        }

        return $results;
    }

    /**
     * @return array<int, HupApiCredential>
     */
    private function findSearchableCredentials(): array
    {
        $searchableCredentials = [];

        foreach ($this->configProvider->getConfig()->getCredentials() as $credential) {
            $supportsPersonLookup = true === $credential->supportsPersonLookup;
            if (!$supportsPersonLookup) {
                continue;
            }

            $searchableCredentials[] = $credential;
        }

        return $searchableCredentials;
    }

    /**
     * @param array<string, scalar|null> $queryParameters
     * @return array<string, scalar|null>
     */
    private function buildCredentialQuery(array $queryParameters, HupApiCredential $credential): array
    {
        unset($queryParameters['divisionid'], $queryParameters['divisionId']);

        if (null !== $credential->mandant) {
            $queryParameters['divisionid'] = $credential->mandant;
        }

        return $queryParameters;
    }
}
