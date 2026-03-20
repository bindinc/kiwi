<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\WebaboOffer;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<WebaboOffer>
 */
final class WebaboOfferRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, WebaboOffer::class);
    }

    /**
     * @return array<string, WebaboOffer>
     */
    public function findAllIndexedBySalesCode(): array
    {
        $indexed = [];

        foreach ($this->findAll() as $offer) {
            $indexed[strtolower($offer->getSalesCode())] = $offer;
        }

        return $indexed;
    }

    /**
        * @return list<WebaboOffer>
     */
    public function searchSuggestions(string $query, int $limit): array
    {
        $normalizedQuery = strtolower(trim($query));
        $safeLimit = max(1, min($limit, 250));
        $now = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        $qb = $this->createQueryBuilder('offer')
            ->andWhere('(offer.validFrom IS NULL OR offer.validFrom <= :now)')
            ->andWhere('(offer.validUntil IS NULL OR offer.validUntil >= :now)')
            ->setParameter('now', $now)
            ->setMaxResults($safeLimit);

        if ('' === $normalizedQuery) {
            $qb
                ->orderBy('offer.salesCode', 'ASC');

            return array_values($qb->getQuery()->getResult());
        }

        $containsQuery = '%'.$normalizedQuery.'%';
        $prefixQuery = $normalizedQuery.'%';
        $qb
            ->addSelect(
                "CASE
                    WHEN LOWER(offer.salesCode) = :exactQuery THEN 0
                    WHEN LOWER(offer.salesCode) LIKE :prefixQuery THEN 1
                    WHEN LOWER(offer.title) LIKE :prefixQuery THEN 2
                    ELSE 3
                END AS HIDDEN matchRank"
            )
            ->andWhere(
                $qb->expr()->orX(
                    'LOWER(offer.salesCode) LIKE :containsQuery',
                    'LOWER(offer.title) LIKE :containsQuery',
                    'LOWER(COALESCE(offer.subscriptionCode, \'\')) LIKE :containsQuery',
                    'LOWER(COALESCE(offer.productCode, \'\')) LIKE :containsQuery'
                )
            )
            ->setParameter('exactQuery', $normalizedQuery)
            ->setParameter('prefixQuery', $prefixQuery)
            ->setParameter('containsQuery', $containsQuery)
            ->orderBy('matchRank', 'ASC')
            ->addOrderBy('offer.salesCode', 'ASC');

        return array_values($qb->getQuery()->getResult());
    }

    public function findOneBySalesCode(string $salesCode): ?WebaboOffer
    {
        $normalizedSalesCode = strtolower(trim($salesCode));
        if ('' === $normalizedSalesCode) {
            return null;
        }

        return $this->createQueryBuilder('offer')
            ->andWhere('LOWER(offer.salesCode) = :salesCode')
            ->setParameter('salesCode', $normalizedSalesCode)
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /**
        * @return list<WebaboOffer>
     */
    public function findAllActive(?\DateTimeImmutable $reference = null): array
    {
        $now = $reference ?? new \DateTimeImmutable('now', new \DateTimeZone('UTC'));

        return array_values($this->createQueryBuilder('offer')
            ->andWhere('(offer.validFrom IS NULL OR offer.validFrom <= :now)')
            ->andWhere('(offer.validUntil IS NULL OR offer.validUntil >= :now)')
            ->setParameter('now', $now)
            ->orderBy('offer.salesCode', 'ASC')
            ->getQuery()
            ->getResult());
    }
}
