<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\SubscriptionOrder;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<SubscriptionOrder>
 */
final class SubscriptionOrderRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, SubscriptionOrder::class);
    }

    public function findOneBySubmissionId(string $submissionId): ?SubscriptionOrder
    {
        $normalizedSubmissionId = trim($submissionId);
        if ('' === $normalizedSubmissionId) {
            return null;
        }

        return $this->createQueryBuilder('subscriptionOrder')
            ->leftJoin('subscriptionOrder.outboxEvents', 'outboxEvent')
            ->addSelect('outboxEvent')
            ->andWhere('subscriptionOrder.submissionId = :submissionId')
            ->setParameter('submissionId', $normalizedSubmissionId)
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }

    public function findOneDetailed(int $orderId): ?SubscriptionOrder
    {
        return $this->createQueryBuilder('subscriptionOrder')
            ->leftJoin('subscriptionOrder.outboxEvents', 'outboxEvent')
            ->addSelect('outboxEvent')
            ->andWhere('subscriptionOrder.id = :orderId')
            ->setParameter('orderId', $orderId)
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /**
     * @return list<SubscriptionOrder>
     */
    public function findRecent(int $limit): array
    {
        $safeLimit = max(1, min($limit, 50));

        /** @var list<SubscriptionOrder> */
        return array_values($this->createQueryBuilder('subscriptionOrder')
            ->leftJoin('subscriptionOrder.outboxEvents', 'outboxEvent')
            ->addSelect('outboxEvent')
            ->orderBy('subscriptionOrder.queuedAt', 'DESC')
            ->addOrderBy('subscriptionOrder.id', 'DESC')
            ->setMaxResults($safeLimit)
            ->getQuery()
            ->getResult());
    }
}
