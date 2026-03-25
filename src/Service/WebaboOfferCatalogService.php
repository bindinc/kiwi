<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\WebaboOffer;
use App\Repository\WebaboOfferRepository;
use App\Webabo\WebaboOfferCacheSchemaManager;

final class WebaboOfferCatalogService
{
    public function __construct(
        private readonly WebaboOfferRepository $repository,
        private readonly WebaboOfferCacheSchemaManager $schemaManager,
        private readonly PocCatalogService $fallbackCatalog,
    ) {
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function search(string $query = '', string $barcode = '', int $limit = 20): array
    {
        $safeLimit = max(1, min($limit, 250));
        $normalizedBarcode = preg_replace('/\D+/', '', $barcode) ?? '';
        if ('' !== $normalizedBarcode) {
            return $this->searchByBarcode($normalizedBarcode, $safeLimit);
        }

        if (!$this->schemaManager->hasCacheTable()) {
            return [];
        }

        $offers = $this->repository->searchSuggestions($query, $safeLimit);
        return array_map(fn (WebaboOffer $offer): array => $this->mapOfferToApiPayload($offer), $offers);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function searchByBarcode(string $barcode, int $limit): array
    {
        if (!$this->schemaManager->hasCacheTable()) {
            return [];
        }

        $matches = [];

        foreach ($this->repository->findAllActive() as $offer) {
            if ($this->extractBarcodeFromPayload($offer->getRawPayload()) !== $barcode) {
                continue;
            }

            $matches[] = $this->mapOfferToApiPayload($offer);

            if (count($matches) >= $limit) {
                break;
            }
        }

        return $matches;
    }

    /**
     * @return array<string, mixed>
     */
    private function mapOfferToApiPayload(WebaboOffer $offer): array
    {
        $rawPayload = $offer->getRawPayload();
        $allChannelCodes = array_keys($this->fallbackCatalog->getWerfsleutelChannels());
        $allowedChannels = $this->extractAllowedChannelsFromPayload($rawPayload);

        if ([] === $allowedChannels) {
            $allowedChannels = $allChannelCodes;
        }

        return [
            'offerId' => $rawPayload['offerId'] ?? null,
            'orderChoiceKey' => $rawPayload['orderChoiceKey'] ?? null,
            'salesCode' => $offer->getSalesCode(),
            'title' => $offer->getTitle(),
            'description' => $offer->getDescription(),
            'additionalDescription' => $offer->getAdditionalDescription(),
            'webDescription' => $offer->getWebDescription(),
            'price' => $offer->getPrice(),
            'barcode' => $this->extractBarcodeFromPayload($rawPayload),
            'magazine' => $this->inferMagazineFromTitle($offer->getTitle()),
            'isActive' => $offer->isCurrentlyActive(),
            'allowedChannels' => $allowedChannels,
            'subscriptionCode' => $offer->getSubscriptionCode(),
            'productCode' => $offer->getProductCode(),
            'credentialKey' => $offer->getCredentialKey(),
            'validFrom' => $offer->getValidFrom()?->format(\DateTimeInterface::ATOM),
            'validUntil' => $offer->getValidUntil()?->format(\DateTimeInterface::ATOM),
            'syncedAt' => $offer->getSyncedAt()->format(\DateTimeInterface::ATOM),
            'source' => 'webabo-cache',
        ];
    }

    /**
     * @param array<string, mixed> $payload
     * @return list<string>
     */
    private function extractAllowedChannelsFromPayload(array $payload): array
    {
        $candidateLists = [
            $payload['allowedChannels'] ?? null,
            $payload['channels'] ?? null,
            $payload['offerChannels'] ?? null,
        ];

        foreach ($candidateLists as $candidateList) {
            if (!\is_array($candidateList)) {
                continue;
            }

            $normalizedChannels = array_values(array_filter(
                array_map(static function (mixed $value): string {
                    if (!\is_string($value)) {
                        return '';
                    }

                    return trim($value);
                }, $candidateList),
                static fn (string $value): bool => '' !== $value,
            ));

            if ([] !== $normalizedChannels) {
                return $normalizedChannels;
            }
        }

        return [];
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function extractBarcodeFromPayload(array $payload): string
    {
        $barcode = $this->findFirstStringByKeys($payload, ['barcode', 'ean', 'eanCode', 'eanNumber']);

        return preg_replace('/\D+/', '', $barcode ?? '') ?? '';
    }

    /**
     * @param array<string, mixed> $payload
     * @param list<string> $keys
     */
    private function findFirstStringByKeys(array $payload, array $keys): ?string
    {
        foreach ($keys as $key) {
            $candidate = $payload[$key] ?? null;
            if (!\is_scalar($candidate)) {
                continue;
            }

            $normalizedCandidate = trim((string) $candidate);
            if ('' !== $normalizedCandidate) {
                return $normalizedCandidate;
            }
        }

        foreach ($payload as $value) {
            if (!\is_array($value)) {
                continue;
            }

            $nestedMatch = $this->findFirstStringByKeys($value, $keys);
            if (null !== $nestedMatch) {
                return $nestedMatch;
            }
        }

        return null;
    }

    private function inferMagazineFromTitle(string $title): string
    {
        $normalizedTitle = strtolower($title);

        if (str_contains($normalizedTitle, 'avrobode')) {
            return 'Avrobode';
        }

        if (str_contains($normalizedTitle, 'mikrogids')) {
            return 'Mikrogids';
        }

        if (str_contains($normalizedTitle, 'ncrv')) {
            return 'Ncrvgids';
        }

        if (str_contains($normalizedTitle, 'televizier')) {
            return 'Televizier';
        }

        if (str_contains($normalizedTitle, 'klassiek')) {
            return 'Klassiek';
        }

        return 'Onbekend';
    }
}
