<?php

declare(strict_types=1);

namespace App\Webabo;

use App\Entity\WerfsleutelOffer;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Exception;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;

final class WerfsleutelCatalogSchemaManager
{
    public function __construct(
        private readonly Connection $connection,
        private readonly EntityManagerInterface $entityManager,
    ) {
    }

    public function hasCacheTable(): bool
    {
        try {
            return $this->connection->createSchemaManager()->tablesExist(['werfsleutel_offer_cache']);
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
        $metadata = [$this->entityManager->getClassMetadata(WerfsleutelOffer::class)];
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
}
