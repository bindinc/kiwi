<?php

declare(strict_types=1);

namespace App\Service\DevelopmentFeedback;

use App\Entity\DevelopmentFeedbackConfiguration;
use App\Entity\DevelopmentFeedbackReport;
use App\Entity\DevelopmentFeedbackScreenshot;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Exception;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;

final class DevelopmentFeedbackSchemaManager
{
    private const REPORT_TABLE = 'development_feedback_reports';
    private const SCREENSHOT_TABLE = 'development_feedback_screenshots';
    private const CONFIGURATION_TABLE = 'development_feedback_configuration';

    public function __construct(
        private readonly Connection $connection,
        private readonly EntityManagerInterface $entityManager,
    ) {
    }

    public function hasFeedbackTables(): bool
    {
        try {
            return $this->connection->createSchemaManager()->tablesExist([
                self::CONFIGURATION_TABLE,
                self::REPORT_TABLE,
                self::SCREENSHOT_TABLE,
            ]);
        } catch (Exception) {
            return false;
        }
    }

    /**
     * @return array{status: string, sql_count: int}
     */
    public function ensureSchema(): array
    {
        $schemaTool = new SchemaTool($this->entityManager);
        $metadata = [
            $this->entityManager->getClassMetadata(DevelopmentFeedbackReport::class),
            $this->entityManager->getClassMetadata(DevelopmentFeedbackScreenshot::class),
            $this->entityManager->getClassMetadata(DevelopmentFeedbackConfiguration::class),
        ];
        $tablesExist = $this->hasFeedbackTables();
        $sql = $this->filterManagedSchemaSql($schemaTool->getUpdateSchemaSql($metadata, true));

        if ([] === $sql) {
            return [
                'status' => $tablesExist ? 'existing' : 'missing_without_diff',
                'sql_count' => 0,
            ];
        }

        foreach ($sql as $statement) {
            $this->connection->executeStatement($statement);
        }

        return [
            'status' => $tablesExist ? 'updated' : 'created',
            'sql_count' => count($sql),
        ];
    }

    /**
     * @param list<string> $sql
     * @return list<string>
     */
    private function filterManagedSchemaSql(array $sql): array
    {
        $managedTableNames = [
            self::REPORT_TABLE,
            self::SCREENSHOT_TABLE,
            self::CONFIGURATION_TABLE,
        ];

        return array_values(array_filter($sql, static function (string $statement) use ($managedTableNames): bool {
            $normalizedStatement = strtolower($statement);

            foreach ($managedTableNames as $tableName) {
                if (str_contains($normalizedStatement, strtolower($tableName))) {
                    return true;
                }
            }

            return false;
        }));
    }
}
