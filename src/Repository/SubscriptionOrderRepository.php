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
    public function findRecent(int $limit, ?\App\Security\AuthorizationContext $actor = null): array
    {
        $safeLimit = max(1, min($limit, 50));

        // Filter in PostgreSQL before applying the limit; JSON is historical immutable data.
        if (null !== $actor) {
            $params = [$actor->tenant];
            $where = "request_payload->'authorization'->>'tenant' = ?";
            if (!\App\OutboxSession\SessionOutbox::managesAll($actor)) {
                if (!$actor->canWrite()) return [];
                $where .= " AND request_payload->'authorization'->>'actor' = ?";
                $params[] = $actor->actor;
            }
            $ids = $this->getEntityManager()->getConnection()->fetchFirstColumn(
                'SELECT id FROM subscription_orders WHERE '.$where.' ORDER BY queued_at DESC, id DESC LIMIT '.$safeLimit, $params);
            return array_values(array_filter(array_map(fn ($id) => $this->findOneDetailed((int) $id), $ids)));
        }
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
