<?php

declare(strict_types=1);

namespace App\Webabo;

use App\Entity\WebaboOffer;
use App\Repository\WebaboOfferRepository;
use Doctrine\ORM\EntityManagerInterface;

final class WebaboOfferSynchronizer
{
    public function __construct(
        private readonly WebaboOfferClient $offerClient,
        private readonly WebaboOfferRepository $repository,
        private readonly EntityManagerInterface $entityManager,
    ) {
    }

    /**
     * @return array{fetched: int, inserted: int, updated: int, removed: int}
     */
    public function sync(): array
    {
        $offers = $this->offerClient->fetchOffers();
        $normalizedOffers = $this->normalizeOfferList($offers);
        if ([] === $normalizedOffers) {
            throw new \RuntimeException('Webabo leverde geen bruikbare offers op om te synchroniseren.');
        }

        $existingBySalesCode = $this->repository->findAllIndexedBySalesCode();
        $seenSalesCodes = [];
        $syncedAt = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        $inserted = 0;
        $updated = 0;

        foreach ($normalizedOffers as $offer) {
            $salesCode = strtolower(trim((string) ($offer['salesCode'] ?? '')));
            if ('' === $salesCode) {
                continue;
            }

            $entity = $existingBySalesCode[$salesCode] ?? null;
            if (null === $entity) {
                $entity = new WebaboOffer((string) $offer['salesCode']);
                ++$inserted;
                $this->entityManager->persist($entity);
            } else {
                ++$updated;
            }

            $entity->refreshFromWebaboPayload($offer, $syncedAt);
            $seenSalesCodes[$salesCode] = true;
        }

        $removed = 0;
        foreach ($existingBySalesCode as $salesCode => $entity) {
            if (isset($seenSalesCodes[$salesCode])) {
                continue;
            }

            ++$removed;
            $this->entityManager->remove($entity);
        }

        $this->entityManager->flush();

        return [
            'fetched' => count($normalizedOffers),
            'inserted' => $inserted,
            'updated' => $updated,
            'removed' => $removed,
        ];
    }

    /**
     * @param list<array<string, mixed>> $offers
     * @return list<array<string, mixed>>
     */
    private function normalizeOfferList(array $offers): array
    {
        $normalized = [];

        foreach ($offers as $offer) {
            $salesCode = trim((string) ($offer['salesCode'] ?? ''));
            $title = trim((string) ($offer['title'] ?? ''));
            if ('' === $salesCode || '' === $title) {
                continue;
            }

            $normalized[strtolower($salesCode)] = $offer + [
                'salesCode' => $salesCode,
                'title' => $title,
            ];
        }

        /** @var list<array<string, mixed>> */
        return array_values($normalized);
    }
}
