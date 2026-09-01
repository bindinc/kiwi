<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\CustomerAuditEvent;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<CustomerAuditEvent>
 */
final class CustomerAuditEventRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, CustomerAuditEvent::class);
    }

    public function deleteBefore(\DateTimeImmutable $cutoff): int
    {
        return $this->createQueryBuilder('auditEvent')
            ->delete()
            ->andWhere('auditEvent.occurredAt < :cutoff')
            ->setParameter('cutoff', $cutoff)
            ->getQuery()
            ->execute();
    }
}
