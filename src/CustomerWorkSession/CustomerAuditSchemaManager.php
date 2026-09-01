<?php

declare(strict_types=1);

namespace App\CustomerWorkSession;

use App\Entity\CustomerAuditEvent;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Exception;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;

final class CustomerAuditSchemaManager
{
    private const TABLE_NAME = 'customer_audit_events';

    public function __construct(
        private readonly Connection $connection,
        private readonly EntityManagerInterface $entityManager,
    ) {
    }

    public function hasAuditTable(): bool
    {
        try {
            return $this->connection->createSchemaManager()->tablesExist([self::TABLE_NAME]);
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
        $metadata = [$this->entityManager->getClassMetadata(CustomerAuditEvent::class)];
        $tableExists = $this->hasAuditTable();
        $sql = array_values(array_filter(
            $schemaTool->getUpdateSchemaSql($metadata, true),
            static fn (string $statement): bool => str_contains(strtolower($statement), self::TABLE_NAME),
        ));

        if ([] === $sql) {
            return [
                'status' => $tableExists ? 'existing' : 'missing_without_diff',
                'sql_count' => 0,
            ];
        }

        foreach ($sql as $statement) {
            $this->connection->executeStatement($statement);
        }

        return [
            'status' => $tableExists ? 'updated' : 'created',
            'sql_count' => count($sql),
        ];
    }
}
