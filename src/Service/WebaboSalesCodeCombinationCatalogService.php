<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\WebaboOffer;
use App\Http\ApiProblemException;
use App\Repository\WebaboOfferRepository;
use App\Webabo\WebaboOfferCacheSchemaManager;
use App\Webabo\WebaboSalesCodeCombinationProviderInterface;

final class WebaboSalesCodeCombinationCatalogService
{
    private const LEGACY_CHANNEL_ALIASES = [
        'TM/IN' => 'TM/IB',
    ];

    private const CHANNEL_DETAIL_BY_CODE = [
        'EM' => 'E-mail',
        'ET' => 'Eigen titels',
        'IB' => 'Inbound',
        'IN' => 'Inbound',
        'IS' => 'Interne sites',
        'OL' => 'Online',
        'OU' => 'Outbound',
        'PR' => 'Print',
        'TM' => 'Telemarketing',
    ];

    private const CHANNEL_FAMILY_BY_CODE = [
        'EM' => ['label' => 'E-mail', 'icon' => 'mail'],
        'OL' => ['label' => 'Online', 'icon' => 'web'],
        'PR' => ['label' => 'Print', 'icon' => 'print'],
        'TM' => ['label' => 'Telemarketing', 'icon' => 'phone'],
    ];

    /**
     * @var array<string, list<array<string, mixed>>>
     */
    private array $requestCache = [];

    public function __construct(
        private readonly WebaboOfferCacheSchemaManager $webaboOfferCacheSchemaManager,
        private readonly WebaboOfferRepository $webaboOfferRepository,
        private readonly WebaboSalesCodeCombinationProviderInterface $combinationProvider,
        private readonly PocCatalogService $fallbackCatalog,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getOfferSalesCodeCombinations(string $salesCode): array
    {
        $offer = $this->findCachedOffer($salesCode);
        if (null === $offer) {
            throw new ApiProblemException(404, 'offer_not_found', 'Offer not found');
        }

        $dynamicLookup = $this->buildDynamicCombinationLookup($offer);
        $items = $dynamicLookup['items'];
        $warning = $dynamicLookup['warning'];
        $usedFallback = false;
        if ([] === $items) {
            $fallbackItems = $this->buildFallbackCombinationItems($offer);
            if ([] !== $fallbackItems) {
                $items = $fallbackItems;
                $usedFallback = true;
            }
        }

        return [
            'salesCode' => $offer->getSalesCode(),
            'title' => $offer->getTitle(),
            'productCode' => $offer->getProductCode(),
            'credentialKey' => $offer->getCredentialKey(),
            'items' => $items,
            'total' => count($items),
            'usedFallback' => $usedFallback,
            'warning' => $warning,
        ];
    }

    private function findCachedOffer(string $salesCode): ?WebaboOffer
    {
        if (!$this->webaboOfferCacheSchemaManager->hasCacheTable()) {
            return null;
        }

        try {
            return $this->webaboOfferRepository->findOneBySalesCode($salesCode);
        } catch (\Throwable $exception) {
            throw new ApiProblemException(
                503,
                'webabo_cache_unavailable',
                'De Webabo offercache is tijdelijk niet beschikbaar.',
            );
        }
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function buildDynamicCombinationLookup(WebaboOffer $offer): array
    {
        $productCode = $this->normalizeNullableString($offer->getProductCode());
        $credentialKey = $this->normalizeNullableString($offer->getCredentialKey());
        if (null === $productCode || null === $credentialKey) {
            return [
                'items' => [],
                'warning' => null,
            ];
        }

        $referenceDate = new \DateTimeImmutable('today', new \DateTimeZone('Europe/Amsterdam'));
        $requestCacheKey = sprintf('%s|%s|%s', $credentialKey, $productCode, $referenceDate->format('Y-m-d'));
        if (!isset($this->requestCache[$requestCacheKey])) {
            try {
                $this->requestCache[$requestCacheKey] = $this->combinationProvider->fetchCombinations(
                    $credentialKey,
                    $productCode,
                    $referenceDate,
                );
            } catch (\Throwable $exception) {
                return [
                    'items' => [],
                    'warning' => 'Live kanaalcombinaties konden niet geladen worden.',
                ];
            }
        }

        $normalizedSalesCode = strtolower($offer->getSalesCode());
        $items = [];
        $seenKeys = [];

        foreach ($this->requestCache[$requestCacheKey] as $row) {
            $rowSalesCode = strtolower(trim((string) ($row['salesCode'] ?? '')));
            if ('' === $rowSalesCode || $rowSalesCode !== $normalizedSalesCode) {
                continue;
            }

            $codes = $this->extractChannelCodes($row);
            if ([] === $codes) {
                continue;
            }

            $combinationKey = implode('/', $codes);
            if (isset($seenKeys[$combinationKey])) {
                continue;
            }

            $seenKeys[$combinationKey] = true;
            $items[] = $this->buildCombinationItem(
                $codes,
                $this->normalizeNullableString($row['description'] ?? null) ?? $offer->getTitle(),
                'webabo-salescodecombinations',
            );
        }

        return [
            'items' => $items,
            'warning' => null,
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function buildFallbackCombinationItems(WebaboOffer $offer): array
    {
        $rawPayload = $offer->getRawPayload();
        $candidateLists = [
            $rawPayload['allowedChannels'] ?? null,
            $rawPayload['channels'] ?? null,
            $rawPayload['offerChannels'] ?? null,
        ];

        $items = [];
        $seenKeys = [];
        foreach ($candidateLists as $candidateList) {
            if (!\is_array($candidateList)) {
                continue;
            }

            foreach ($candidateList as $candidate) {
                if (!\is_string($candidate)) {
                    continue;
                }

                $codes = $this->normalizeCombinationCodes(explode('/', $candidate));
                if ([] === $codes) {
                    continue;
                }

                $combinationKey = implode('/', $codes);
                if (isset($seenKeys[$combinationKey])) {
                    continue;
                }

                $seenKeys[$combinationKey] = true;
                $items[] = $this->buildCombinationItem(
                    $codes,
                    $offer->getTitle(),
                    'offer-fallback',
                );
            }

            if ([] !== $items) {
                return $items;
            }
        }

        return [];
    }

    /**
     * @param list<string> $codes
     * @return array<string, mixed>
     */
    private function buildCombinationItem(array $codes, string $description, string $source): array
    {
        $combinationKey = implode('/', $codes);
        $presentation = $this->resolveChannelPresentation($codes);
        $detail = implode(' / ', array_map(
            static fn (string $code): string => self::CHANNEL_DETAIL_BY_CODE[$code] ?? $code,
            $codes,
        ));

        return [
            'key' => $combinationKey,
            'codes' => $codes,
            'displayCode' => implode(' / ', $codes),
            'label' => $presentation['label'],
            'icon' => $presentation['icon'],
            'detail' => $detail,
            'description' => $description,
            'source' => $source,
        ];
    }

    /**
     * @param list<string> $codes
     * @return array{label: string, icon: string}
     */
    private function resolveChannelPresentation(array $codes): array
    {
        $channelCatalog = $this->fallbackCatalog->getWerfsleutelChannels();
        $fullKey = implode('/', $codes);
        $exactCatalogEntry = $channelCatalog[$fullKey] ?? null;
        if (\is_array($exactCatalogEntry)) {
            return [
                'label' => $this->normalizeNullableString($exactCatalogEntry['label'] ?? null) ?? 'Kanaalcombinatie',
                'icon' => $this->normalizeNullableString($exactCatalogEntry['icon'] ?? null) ?? 'route',
            ];
        }

        $prefixKey = implode('/', array_slice($codes, 0, 2));
        $catalogLookupKey = self::LEGACY_CHANNEL_ALIASES[$prefixKey] ?? $prefixKey;
        $prefixCatalogEntry = $channelCatalog[$catalogLookupKey] ?? null;
        if (\is_array($prefixCatalogEntry)) {
            return [
                'label' => $this->normalizeNullableString($prefixCatalogEntry['label'] ?? null) ?? 'Kanaalcombinatie',
                'icon' => $this->normalizeNullableString($prefixCatalogEntry['icon'] ?? null) ?? 'route',
            ];
        }

        $firstCode = $codes[0] ?? '';
        $family = self::CHANNEL_FAMILY_BY_CODE[$firstCode] ?? null;
        if (\is_array($family)) {
            return $family;
        }

        return [
            'label' => 'Kanaalcombinatie',
            'icon' => 'route',
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return list<string>
     */
    private function extractChannelCodes(array $row): array
    {
        $candidates = [];

        foreach ($row as $key => $value) {
            if (!\is_string($key) || !preg_match('/^salesChannel(\d+)$/', $key, $matches)) {
                continue;
            }

            $index = (int) $matches[1];
            $candidates[$index] = $value;
        }

        if ([] === $candidates) {
            return [];
        }

        ksort($candidates);

        return $this->normalizeCombinationCodes($candidates);
    }

    /**
     * @param iterable<mixed> $rawCodes
     * @return list<string>
     */
    private function normalizeCombinationCodes(iterable $rawCodes): array
    {
        $codes = [];

        foreach ($rawCodes as $rawCode) {
            if (!\is_scalar($rawCode)) {
                continue;
            }

            $normalizedCode = strtoupper(trim((string) $rawCode));
            if ('' === $normalizedCode) {
                continue;
            }

            $codes[] = $normalizedCode;
        }

        return array_values(array_unique($codes));
    }

    private function normalizeNullableString(mixed $value): ?string
    {
        if (!\is_scalar($value)) {
            return null;
        }

        $normalized = trim((string) $value);

        return '' !== $normalized ? $normalized : null;
    }
}
