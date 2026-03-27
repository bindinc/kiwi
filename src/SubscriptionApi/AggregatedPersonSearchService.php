<?php

declare(strict_types=1);

namespace App\SubscriptionApi;

use App\Webabo\HupApiConfigProvider;

final class AggregatedPersonSearchService
{
    public function __construct(
        private readonly HupApiConfigProvider $configProvider,
        private readonly MultiCredentialPersonSearchService $multiCredentialPersonSearchService,
        private readonly PersonSearchResultNormalizer $personSearchResultNormalizer,
    ) {
    }

    public function isAvailable(): bool
    {
        try {
            $config = $this->configProvider->getConfig();
        } catch (\RuntimeException) {
            return false;
        }

        if (null === $config->ppaBaseUrl || '' === trim($config->ppaBaseUrl)) {
            return false;
        }

        foreach ($config->getCredentials() as $credential) {
            if (true === $credential->supportsPersonLookup) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param array<string, string> $filters
     * @param list<string> $allowedDivisionIds
     * @param list<string> $allowedMandants
     * @return array<string, mixed>
     */
    public function search(
        array $filters,
        int $page,
        int $pageSize,
        string $sortBy = 'name',
        array $allowedDivisionIds = [],
        array $allowedMandants = [],
    ): array {
        $safePage = max(1, $page);
        $safePageSize = max(1, min($pageSize, 200));
        $upstreamQuery = $this->buildUpstreamQuery($filters, $safePage, $safePageSize);
        $normalizedFilters = $this->normalizeFilters($filters);

        $normalizedItems = [];
        foreach ($this->multiCredentialPersonSearchService->search(
            $upstreamQuery,
            $allowedDivisionIds,
            $allowedMandants,
        ) as $searchResult) {
            $content = $searchResult->payload['content'] ?? null;
            if (!\is_array($content)) {
                continue;
            }

            foreach ($content as $rawPerson) {
                if (!\is_array($rawPerson)) {
                    continue;
                }

                if (!$this->matchesRawPersonAgainstFilters($rawPerson, $normalizedFilters)) {
                    continue;
                }

                $normalizedItems[] = $this->personSearchResultNormalizer->normalizePerson($rawPerson, $searchResult->credential);
            }
        }

        $this->sortItems($normalizedItems, $sortBy);

        $offset = ($safePage - 1) * $safePageSize;

        return [
            'items' => array_slice($normalizedItems, $offset, $safePageSize),
            'page' => $safePage,
            'pageSize' => $safePageSize,
            'total' => count($normalizedItems),
        ];
    }

    /**
     * @param array<string, string> $filters
     * @return array<string, scalar|null>
     */
    private function buildUpstreamQuery(array $filters, int $page, int $pageSize): array
    {
        $requestedWindowSize = $page * $pageSize;

        return [
            'page' => 0,
            'pagesize' => $requestedWindowSize,
            'postcode' => $this->normalizeNullableString($filters['postalCode'] ?? null),
            'houseno' => $this->normalizeNullableString($filters['houseNumber'] ?? null),
            'name' => $this->normalizeNullableString($filters['name'] ?? null),
            'phone' => $this->normalizeNullableString($filters['phone'] ?? null),
            'email' => $this->normalizeNullableString($filters['email'] ?? null),
        ];
    }

    /**
     * @param array<string, string> $filters
     * @return array{postalCode:string, houseNumber:string, name:string, phone:string, email:string}
     */
    private function normalizeFilters(array $filters): array
    {
        return [
            'postalCode' => $this->normalizePostalCode($filters['postalCode'] ?? null),
            'houseNumber' => $this->normalizeCaseInsensitiveString($filters['houseNumber'] ?? null),
            'name' => $this->normalizeCaseInsensitiveString($filters['name'] ?? null),
            'phone' => $this->normalizePhone($filters['phone'] ?? null),
            'email' => $this->normalizeCaseInsensitiveString($filters['email'] ?? null),
        ];
    }

    /**
     * @param array<string, mixed> $rawPerson
     * @param array{postalCode:string, houseNumber:string, name:string, phone:string, email:string} $filters
     */
    private function matchesRawPersonAgainstFilters(array $rawPerson, array $filters): bool
    {
        $matchesPostalCode = '' === $filters['postalCode']
            || $this->normalizePostalCode($rawPerson['postCode'] ?? null) === $filters['postalCode'];
        $matchesHouseNumber = '' === $filters['houseNumber']
            || $this->normalizeCaseInsensitiveString($rawPerson['houseNo'] ?? null) === $filters['houseNumber'];
        $matchesName = $this->matchesNameFilter($rawPerson, $filters['name']);
        $matchesPhone = $this->matchesPhoneFilter($rawPerson['phone'] ?? null, $filters['phone']);
        $matchesEmail = $this->matchesEmailFilter($rawPerson, $filters['email']);

        return $matchesPostalCode && $matchesHouseNumber && $matchesName && $matchesPhone && $matchesEmail;
    }

    /**
     * @param array<string, mixed> $rawPerson
     */
    private function matchesNameFilter(array $rawPerson, string $nameFilter): bool
    {
        if ('' === $nameFilter) {
            return true;
        }

        $firstName = $this->normalizeCaseInsensitiveString($rawPerson['firstName'] ?? null);
        $lastName = $this->normalizeCaseInsensitiveString($rawPerson['name'] ?? null);
        $nameCandidates = array_filter([
            $firstName,
            $lastName,
            trim(sprintf('%s %s', $firstName, $lastName)),
        ], static fn (string $value): bool => '' !== $value);

        foreach ($nameCandidates as $candidate) {
            if (str_contains($candidate, $nameFilter)) {
                return true;
            }
        }

        return false;
    }

    private function matchesPhoneFilter(mixed $rawPhoneNumbers, string $phoneFilter): bool
    {
        if ('' === $phoneFilter) {
            return true;
        }

        foreach ($this->normalizeStringList($rawPhoneNumbers, [$this, 'normalizePhone']) as $phoneNumber) {
            if (str_contains($phoneNumber, $phoneFilter)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param array<string, mixed> $rawPerson
     */
    private function matchesEmailFilter(array $rawPerson, string $emailFilter): bool
    {
        if ('' === $emailFilter) {
            return true;
        }

        foreach ($this->extractRawEmailAddresses($rawPerson) as $emailAddress) {
            if (str_contains($emailAddress, $emailFilter)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param list<array<string, mixed>> $items
     */
    private function sortItems(array &$items, string $sortBy): void
    {
        usort($items, function (array $left, array $right) use ($sortBy): int {
            return match ($sortBy) {
                'postal' => $this->compareStrings($left['postalCode'] ?? null, $right['postalCode'] ?? null),
                'subscriptions' => $this->compareBySubscriptions($left, $right),
                default => $this->compareByName($left, $right),
            };
        });
    }

    /**
     * @param array<string, mixed> $left
     * @param array<string, mixed> $right
     */
    private function compareByName(array $left, array $right): int
    {
        $lastNameComparison = $this->compareStrings($left['lastName'] ?? null, $right['lastName'] ?? null);
        if (0 !== $lastNameComparison) {
            return $lastNameComparison;
        }

        return $this->compareStrings($left['firstName'] ?? null, $right['firstName'] ?? null);
    }

    /**
     * @param array<string, mixed> $left
     * @param array<string, mixed> $right
     */
    private function compareBySubscriptions(array $left, array $right): int
    {
        $leftActiveCount = $this->countActiveSubscriptions($left['subscriptions'] ?? null);
        $rightActiveCount = $this->countActiveSubscriptions($right['subscriptions'] ?? null);
        if ($leftActiveCount !== $rightActiveCount) {
            return $rightActiveCount <=> $leftActiveCount;
        }

        return $this->compareByName($left, $right);
    }

    /**
     * @param mixed $subscriptions
     */
    private function countActiveSubscriptions(mixed $subscriptions): int
    {
        if (!\is_array($subscriptions)) {
            return 0;
        }

        return count(array_filter($subscriptions, static fn (mixed $subscription): bool => \is_array($subscription) && 'active' === ($subscription['status'] ?? null)));
    }

    private function compareStrings(mixed $left, mixed $right): int
    {
        return strcasecmp(
            $this->normalizeNullableString($left) ?? '',
            $this->normalizeNullableString($right) ?? '',
        );
    }

    private function normalizePostalCode(mixed $value): string
    {
        $normalized = $this->normalizeNullableString($value);
        if (null === $normalized) {
            return '';
        }

        return strtoupper(str_replace(' ', '', $normalized));
    }

    private function normalizeCaseInsensitiveString(mixed $value): string
    {
        $normalized = $this->normalizeNullableString($value);
        if (null === $normalized) {
            return '';
        }

        return strtolower($normalized);
    }

    private function normalizePhone(mixed $value): string
    {
        if (!\is_string($value)) {
            return '';
        }

        return preg_replace('/\D+/', '', $value) ?? '';
    }

    /**
     * @param callable(mixed): string $normalizer
     * @return list<string>
     */
    private function normalizeStringList(mixed $values, callable $normalizer): array
    {
        if (!\is_array($values)) {
            return [];
        }

        $normalizedValues = [];
        foreach ($values as $value) {
            $normalizedValue = $normalizer($value);
            if ('' === $normalizedValue) {
                continue;
            }

            $normalizedValues[] = $normalizedValue;
        }

        return $normalizedValues;
    }

    /**
     * @param array<string, mixed> $rawPerson
     * @return list<string>
     */
    private function extractRawEmailAddresses(array $rawPerson): array
    {
        $emailAddresses = array_merge(
            $this->normalizeStringList($rawPerson['eMail'] ?? null, [$this, 'normalizeCaseInsensitiveString']),
            $this->normalizeStringList($rawPerson['geteMail'] ?? null, [$this, 'normalizeCaseInsensitiveString']),
        );

        return array_values(array_unique($emailAddresses));
    }

    private function normalizeNullableString(mixed $value): ?string
    {
        if (!\is_string($value)) {
            return null;
        }

        $normalized = trim($value);

        return '' !== $normalized ? $normalized : null;
    }
}
