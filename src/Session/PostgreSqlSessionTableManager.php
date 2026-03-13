<?php

declare(strict_types=1);

namespace App\Session;

use Doctrine\DBAL\Connection;
use Doctrine\DBAL\ParameterType;
use Symfony\Component\HttpFoundation\Session\Storage\Handler\PdoSessionHandler;

final class PostgreSqlSessionTableManager
{
    private const LOCK_NAMESPACE = 187732;
    private const LOCK_KEY = 1;
    private const PUBLIC_SCHEMA = 'public';
    private const SYMFONY_COLUMNS = ['sess_id', 'sess_data', 'sess_lifetime', 'sess_time'];
    private const LEGACY_COLUMNS = ['session_id', 'data', 'expiry'];

    public function __construct(
        private readonly Connection $connection,
        private readonly PdoSessionHandler $sessionHandler,
        private readonly string $tableName,
    ) {
    }

    /**
     * @return array{status: 'created'|'existing'|'renamed_legacy', backup_table_name?: string}
     */
    public function bootstrap(): array
    {
        $this->acquireAdvisoryLock();

        try {
            $tableState = $this->detectTableState();
            if ('missing' === $tableState) {
                $this->sessionHandler->createTable();

                return ['status' => 'created'];
            }

            if ('symfony' === $tableState) {
                $this->ensureLifetimeIndex();

                return ['status' => 'existing'];
            }

            if ('legacy' === $tableState) {
                $backupTableName = $this->buildBackupTableName();
                $this->renameTable($backupTableName);
                $this->sessionHandler->createTable();

                return [
                    'status' => 'renamed_legacy',
                    'backup_table_name' => $backupTableName,
                ];
            }

            throw new \RuntimeException(sprintf(
                'Table "%s.%s" exists with an unsupported schema.',
                self::PUBLIC_SCHEMA,
                $this->tableName,
            ));
        } finally {
            $this->releaseAdvisoryLock();
        }
    }

    /**
     * @return array{status: 'cleaned'|'skipped_missing'|'skipped_legacy'}
     */
    public function cleanup(int $ttlSeconds): array
    {
        $tableState = $this->detectTableState();
        if ('missing' === $tableState) {
            return ['status' => 'skipped_missing'];
        }

        if ('legacy' === $tableState) {
            return ['status' => 'skipped_legacy'];
        }

        $this->sessionHandler->gc($ttlSeconds);
        $this->sessionHandler->close();

        return ['status' => 'cleaned'];
    }

    private function acquireAdvisoryLock(): void
    {
        $this->connection->executeQuery(
            'SELECT pg_advisory_lock(:lock_namespace, :lock_key)',
            [
                'lock_namespace' => self::LOCK_NAMESPACE,
                'lock_key' => self::LOCK_KEY,
            ],
            [
                'lock_namespace' => ParameterType::INTEGER,
                'lock_key' => ParameterType::INTEGER,
            ],
        );
    }

    private function releaseAdvisoryLock(): void
    {
        $this->connection->executeQuery(
            'SELECT pg_advisory_unlock(:lock_namespace, :lock_key)',
            [
                'lock_namespace' => self::LOCK_NAMESPACE,
                'lock_key' => self::LOCK_KEY,
            ],
            [
                'lock_namespace' => ParameterType::INTEGER,
                'lock_key' => ParameterType::INTEGER,
            ],
        );
    }

    private function detectTableState(): string
    {
        $columnNames = $this->fetchTableColumns($this->tableName);
        if ([] === $columnNames) {
            return 'missing';
        }

        if ($columnNames === self::SYMFONY_COLUMNS) {
            return 'symfony';
        }

        if ($columnNames === self::LEGACY_COLUMNS) {
            return 'legacy';
        }

        return 'unknown';
    }

    /**
     * @return string[]
     */
    private function fetchTableColumns(string $tableName): array
    {
        return array_values(array_map(
            static fn (mixed $columnName): string => (string) $columnName,
            $this->connection->fetchFirstColumn(
                <<<'SQL'
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = :schema
                      AND table_name = :table_name
                    ORDER BY ordinal_position
                SQL,
                [
                    'schema' => self::PUBLIC_SCHEMA,
                    'table_name' => $tableName,
                ],
            ),
        ));
    }

    private function buildBackupTableName(): string
    {
        $baseName = sprintf('%s_flask_legacy_%s', $this->tableName, gmdate('YmdHis'));
        $counter = 0;

        while (true) {
            $suffix = 0 === $counter ? '' : '_'.$counter;
            $candidate = substr($baseName, 0, 63 - strlen($suffix)).$suffix;
            if (!$this->tableExists($candidate)) {
                return $candidate;
            }

            ++$counter;
        }
    }

    private function tableExists(string $tableName): bool
    {
        $qualifiedTableName = sprintf('%s.%s', self::PUBLIC_SCHEMA, $tableName);

        return null !== $this->connection->fetchOne(
            'SELECT to_regclass(:qualified_table_name)',
            ['qualified_table_name' => $qualifiedTableName],
        );
    }

    private function renameTable(string $backupTableName): void
    {
        $qualifiedTableName = $this->qualifyIdentifier($this->tableName);
        $quotedBackupTableName = $this->connection->quoteIdentifier($backupTableName);

        $this->connection->executeStatement(sprintf(
            'ALTER TABLE %s RENAME TO %s',
            $qualifiedTableName,
            $quotedBackupTableName,
        ));
    }

    private function ensureLifetimeIndex(): void
    {
        $indexName = $this->connection->quoteIdentifier('sess_lifetime_idx');
        $qualifiedTableName = $this->qualifyIdentifier($this->tableName);
        $quotedLifetimeColumn = $this->connection->quoteIdentifier('sess_lifetime');

        $this->connection->executeStatement(sprintf(
            'CREATE INDEX IF NOT EXISTS %s ON %s (%s)',
            $indexName,
            $qualifiedTableName,
            $quotedLifetimeColumn,
        ));
    }

    private function qualifyIdentifier(string $tableName): string
    {
        return sprintf(
            '%s.%s',
            $this->connection->quoteIdentifier(self::PUBLIC_SCHEMA),
            $this->connection->quoteIdentifier($tableName),
        );
    }
}
