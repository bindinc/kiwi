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
     * @param list<string> $allowedDivisionIds
     * @param list<string> $allowedMandants
     * @return array<int, CredentialPersonSearchResult>
     */
    public function search(array $queryParameters, array $allowedDivisionIds = [], array $allowedMandants = []): array
    {
        $results = [];
        $failedCredentials = [];
        $lastException = null;

        foreach ($this->findSearchableCredentials($allowedDivisionIds, $allowedMandants) as $credential) {
            try {
                $credentialQuery = $this->buildCredentialQuery($queryParameters, $credential);
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
     * @param list<string> $allowedDivisionIds
     * @param list<string> $allowedMandants
     * @return array<int, HupApiCredential>
     */
    private function findSearchableCredentials(array $allowedDivisionIds, array $allowedMandants): array
    {
        $searchableCredentials = [];
        $normalizedDivisionIds = $this->normalizeScopeValues($allowedDivisionIds);
        $normalizedMandants = $this->normalizeScopeValues($allowedMandants);

        foreach ($this->configProvider->getConfig()->getCredentials() as $credential) {
            $supportsPersonLookup = true === $credential->supportsPersonLookup;
            if (!$supportsPersonLookup) {
                continue;
            }

            if (!$this->matchesCredentialSearchScope($credential, $normalizedDivisionIds, $normalizedMandants)) {
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

        if (null !== $credential->divisionId && '' !== trim($credential->divisionId)) {
            $queryParameters['divisionid'] = trim($credential->divisionId);
        }

        return $queryParameters;
    }

    /**
     * @param list<string> $allowedDivisionIds
     * @param list<string> $allowedMandants
     */
    private function matchesCredentialSearchScope(
        HupApiCredential $credential,
        array $allowedDivisionIds,
        array $allowedMandants,
    ): bool {
        $hasDivisionScope = [] !== $allowedDivisionIds;
        $hasMandantScope = [] !== $allowedMandants;
        if (!$hasDivisionScope && !$hasMandantScope) {
            return true;
        }

        $credentialDivisionId = $this->normalizeScopeValue($credential->divisionId);
        $credentialMandant = $this->normalizeScopeValue($credential->mandant);
        $matchesDivisionScope = $hasDivisionScope
            && null !== $credentialDivisionId
            && \in_array($credentialDivisionId, $allowedDivisionIds, true);
        $matchesMandantScope = $hasMandantScope
            && null !== $credentialMandant
            && \in_array($credentialMandant, $allowedMandants, true);

        return $matchesDivisionScope || $matchesMandantScope;
    }

    /**
     * @param list<string> $values
     * @return list<string>
     */
    private function normalizeScopeValues(array $values): array
    {
        $normalizedValues = [];

        foreach ($values as $value) {
            $normalizedValue = $this->normalizeScopeValue($value);
            if (null === $normalizedValue || \in_array($normalizedValue, $normalizedValues, true)) {
                continue;
            }

            $normalizedValues[] = $normalizedValue;
        }

        return $normalizedValues;
    }

    private function normalizeScopeValue(?string $value): ?string
    {
        if (null === $value) {
            return null;
        }

        $normalizedValue = strtoupper(trim($value));

        return '' !== $normalizedValue ? $normalizedValue : null;
    }
}
