<?php

declare(strict_types=1);

namespace App\Outbox;

use App\Entity\OutboxEvent;
use App\Entity\SubscriptionOrder;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Exception;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;

final class SubscriptionQueueSchemaManager
{
    private const ORDER_TABLE = 'subscription_orders';
    private const OUTBOX_TABLE = 'outbox_events';

    public function __construct(
        private readonly Connection $connection,
        private readonly EntityManagerInterface $entityManager,
    ) {
    }

    public function hasQueueTables(): bool
    {
        try {
            return $this->connection->createSchemaManager()->tablesExist([
                self::ORDER_TABLE,
                self::OUTBOX_TABLE,
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
            $this->entityManager->getClassMetadata(SubscriptionOrder::class),
            $this->entityManager->getClassMetadata(OutboxEvent::class),
        ];
        $tablesExist = $this->hasQueueTables();
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
            self::ORDER_TABLE,
            self::OUTBOX_TABLE,
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
