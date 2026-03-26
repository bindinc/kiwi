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
        $failedCredentials = [];
        $lastException = null;

        foreach ($this->findSearchableCredentials() as $credential) {
            try {
                $credentialQuery = $this->buildCredentialQuery($queryParameters);
                $payload = $this->personSearchClient->search($credentialQuery, $credential->name);

                $results[] = new CredentialPersonSearchResult($credential, $payload);
            } catch (\Throwable $exception) {
                $failedCredentials[] = $credential->name;
                $lastException = $exception;
            }
        }

        if ([] === $results && [] !== $failedCredentials) {
            throw new \RuntimeException(sprintf(
                'Subscription API personsearch mislukte voor alle zoekbare credentials: %s.',
                implode(', ', $failedCredentials),
            ), 0, $lastException);
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
    private function buildCredentialQuery(array $queryParameters): array
    {
        unset($queryParameters['divisionid'], $queryParameters['divisionId']);

        return $queryParameters;
    }
}
