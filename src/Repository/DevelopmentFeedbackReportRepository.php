<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\DevelopmentFeedbackReport;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<DevelopmentFeedbackReport>
 */
final class DevelopmentFeedbackReportRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, DevelopmentFeedbackReport::class);
    }

    public function countCreatedByUserSince(string $createdByUserId, \DateTimeImmutable $since): int
    {
        return (int) $this->createQueryBuilder('report')
            ->select('COUNT(report.id)')
            ->andWhere('report.createdByUserId = :createdByUserId')
            ->andWhere('report.createdAt >= :since')
            ->setParameter('createdByUserId', $createdByUserId)
            ->setParameter('since', $since)
            ->getQuery()
            ->getSingleScalarResult();
    }

    public function findWithScreenshotByPublicId(string $publicId): ?DevelopmentFeedbackReport
    {
        return $this->createQueryBuilder('report')
            ->leftJoin('report.screenshot', 'screenshot')
            ->addSelect('screenshot')
            ->andWhere('report.publicId = :publicId')
            ->setParameter('publicId', $publicId)
            ->getQuery()
            ->getOneOrNullResult();
    }
}
