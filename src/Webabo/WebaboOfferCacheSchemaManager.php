<?php

declare(strict_types=1);

namespace App\Webabo;

use App\Entity\WebaboOffer;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Exception;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;

final class WebaboOfferCacheSchemaManager
{
    private const CACHE_TABLE = 'webabo_offers_cache';
    private const LEGACY_CACHE_TABLE = 'werfsleutel_offer_cache';

    public function __construct(
        private readonly Connection $connection,
        private readonly EntityManagerInterface $entityManager,
    ) {
    }

    public function hasCacheTable(): bool
    {
        try {
            $this->renameLegacyCacheTableIfNeeded();

            return $this->connection->createSchemaManager()->tablesExist([self::CACHE_TABLE]);
        } catch (Exception) {
            return false;
        }
    }

    /**
     * @return array{status: string, sql_count: int}
     */
    public function ensureSchema(): array
    {
        $this->renameLegacyCacheTableIfNeeded();

        $schemaTool = new SchemaTool($this->entityManager);
        $metadata = [$this->entityManager->getClassMetadata(WebaboOffer::class)];
        $tableExists = $this->hasCacheTable();
        $sql = $schemaTool->getUpdateSchemaSql($metadata, true);

        if ([] === $sql) {
            return [
                'status' => $tableExists ? 'existing' : 'missing_without_diff',
                'sql_count' => 0,
            ];
        }

        $schemaTool->updateSchema($metadata, true);

        return [
            'status' => $tableExists ? 'updated' : 'created',
            'sql_count' => count($sql),
        ];
    }

    private function renameLegacyCacheTableIfNeeded(): void
    {
        $schemaManager = $this->connection->createSchemaManager();
        $hasCanonicalTable = $schemaManager->tablesExist([self::CACHE_TABLE]);
        $hasLegacyTable = $schemaManager->tablesExist([self::LEGACY_CACHE_TABLE]);

        if ($hasCanonicalTable || !$hasLegacyTable) {
            return;
        }

        $this->connection->executeStatement(sprintf(
            'ALTER TABLE %s RENAME TO %s',
            self::LEGACY_CACHE_TABLE,
            self::CACHE_TABLE,
        ));
    }
}
