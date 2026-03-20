<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\WerfsleutelOffer;
use App\Repository\WerfsleutelOfferRepository;
use App\Webabo\WerfsleutelCatalogSchemaManager;

final class WerfsleutelCatalogService
{
    /**
     * @var array<string, array<string, mixed>>|null
     */
    private ?array $legacyMetadataBySalesCode = null;

    /**
     * @var array<string, array<string, mixed>>|null
     */
    private ?array $legacyMetadataByBarcode = null;

    public function __construct(
        private readonly WerfsleutelOfferRepository $repository,
        private readonly WerfsleutelCatalogSchemaManager $schemaManager,
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
            return $this->fallbackCatalog->searchWerfsleutels($query, '', $safeLimit);
        }

        $offers = $this->repository->searchSuggestions($query, $safeLimit);
        if ([] === $offers) {
            return $this->fallbackCatalog->searchWerfsleutels($query, '', $safeLimit);
        }

        return array_map(fn (WerfsleutelOffer $offer): array => $this->mapOfferToApiPayload($offer), $offers);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function searchByBarcode(string $barcode, int $limit): array
    {
        $legacyMatch = $this->getLegacyWerfsleutelByBarcode($barcode);
        if (null === $legacyMatch) {
            return $this->fallbackCatalog->searchWerfsleutels('', $barcode, $limit);
        }

        if ($this->schemaManager->hasCacheTable()) {
            $cachedOffer = $this->repository->findOneBySalesCode((string) ($legacyMatch['salesCode'] ?? ''));
            if (null !== $cachedOffer) {
                return [$this->mapOfferToApiPayload($cachedOffer, $legacyMatch)];
            }
        }

        return [$legacyMatch];
    }

    /**
     * @param array<string, mixed>|null $legacyMetadata
     * @return array<string, mixed>
     */
    private function mapOfferToApiPayload(WerfsleutelOffer $offer, ?array $legacyMetadata = null): array
    {
        $legacyMetadata ??= $this->getLegacyWerfsleutelBySalesCode($offer->getSalesCode());
        $allChannelCodes = array_keys($this->fallbackCatalog->getWerfsleutelChannels());
        $allowedChannels = [];

        if (\is_array($legacyMetadata['allowedChannels'] ?? null)) {
            $allowedChannels = array_values(array_filter(
                array_map(static fn (mixed $value): string => \is_string($value) ? trim($value) : '', $legacyMetadata['allowedChannels']),
                static fn (string $value): bool => '' !== $value,
            ));
        }

        if ([] === $allowedChannels) {
            $allowedChannels = $allChannelCodes;
        }

        return [
            'offerId' => $offer->getRawPayload()['offerId'] ?? null,
            'orderChoiceKey' => $offer->getRawPayload()['orderChoiceKey'] ?? null,
            'salesCode' => $offer->getSalesCode(),
            'title' => $offer->getTitle(),
            'price' => $offer->getPrice(),
            'barcode' => (string) ($legacyMetadata['barcode'] ?? ''),
            'magazine' => (string) ($legacyMetadata['magazine'] ?? $this->inferMagazineFromTitle($offer->getTitle())),
            'isActive' => $offer->isCurrentlyActive(),
            'allowedChannels' => $allowedChannels,
            'subscriptionCode' => $offer->getSubscriptionCode(),
            'productCode' => $offer->getProductCode(),
            'validFrom' => $offer->getValidFrom()?->format(\DateTimeInterface::ATOM),
            'validUntil' => $offer->getValidUntil()?->format(\DateTimeInterface::ATOM),
            'syncedAt' => $offer->getSyncedAt()->format(\DateTimeInterface::ATOM),
            'source' => 'webabo-cache',
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function getLegacyWerfsleutelBySalesCode(string $salesCode): ?array
    {
        $this->warmLegacyMetadataIndexes();
        $normalizedSalesCode = strtolower(trim($salesCode));

        return $this->legacyMetadataBySalesCode[$normalizedSalesCode] ?? null;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function getLegacyWerfsleutelByBarcode(string $barcode): ?array
    {
        $this->warmLegacyMetadataIndexes();

        return $this->legacyMetadataByBarcode[$barcode] ?? null;
    }

    private function warmLegacyMetadataIndexes(): void
    {
        if (null !== $this->legacyMetadataBySalesCode && null !== $this->legacyMetadataByBarcode) {
            return;
        }

        $this->legacyMetadataBySalesCode = [];
        $this->legacyMetadataByBarcode = [];

        foreach ($this->fallbackCatalog->getWerfsleutels() as $item) {
            $salesCode = strtolower(trim((string) ($item['salesCode'] ?? '')));
            if ('' !== $salesCode) {
                $this->legacyMetadataBySalesCode[$salesCode] = $item;
            }

            $barcode = preg_replace('/\D+/', '', (string) ($item['barcode'] ?? '')) ?? '';
            if ('' !== $barcode) {
                $this->legacyMetadataByBarcode[$barcode] = $item;
            }
        }
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
