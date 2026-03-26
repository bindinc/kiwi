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
     * @return array<string, mixed>
     */
    public function search(array $filters, int $page, int $pageSize, string $sortBy = 'name'): array
    {
        $safePage = max(1, $page);
        $safePageSize = max(1, min($pageSize, 200));
        $upstreamQuery = $this->buildUpstreamQuery($filters, $safePage, $safePageSize);

        $normalizedItems = [];
        foreach ($this->multiCredentialPersonSearchService->search($upstreamQuery) as $searchResult) {
            foreach ($this->personSearchResultNormalizer->normalizeCredentialResult($searchResult) as $normalizedPerson) {
                $normalizedItems[] = $normalizedPerson;
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

    private function normalizeNullableString(mixed $value): ?string
    {
        if (!\is_string($value)) {
            return null;
        }

        $normalized = trim($value);

        return '' !== $normalized ? $normalized : null;
    }
}
