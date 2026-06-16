<?php

declare(strict_types=1);

namespace App\Service\DevelopmentFeedback;

use Doctrine\DBAL\Connection;

final class DevelopmentFeedbackCleanupService
{
    public function __construct(
        private readonly DevelopmentFeedbackSchemaManager $schemaManager,
        private readonly Connection $connection,
    ) {
    }

    /**
     * @return array{status: string, expired_reports_deleted: int, old_reports_deleted: int}
     */
    public function cleanup(\DateTimeImmutable $now, int $reportRetentionDays): array
    {
        if (!$this->schemaManager->hasFeedbackTables()) {
            return [
                'status' => 'skipped_missing',
                'expired_reports_deleted' => 0,
                'old_reports_deleted' => 0,
            ];
        }

        $expiredReportsDeleted = $this->connection->executeStatement(
            <<<'SQL'
DELETE FROM development_feedback_reports
WHERE id IN (
    SELECT report_id
    FROM development_feedback_screenshots
    WHERE access_token_expires_at < :now
)
SQL,
            ['now' => $now],
            ['now' => 'datetime_immutable'],
        );

        $oldReportsDeleted = $this->connection->executeStatement(
            'DELETE FROM development_feedback_reports WHERE created_at < :oldestKeptCreatedAt',
            ['oldestKeptCreatedAt' => $now->modify(sprintf('-%d days', $reportRetentionDays))],
            ['oldestKeptCreatedAt' => 'datetime_immutable'],
        );

        return [
            'status' => 'cleaned',
            'expired_reports_deleted' => $expiredReportsDeleted,
            'old_reports_deleted' => $oldReportsDeleted,
        ];
    }
}
