<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Outbox\SubscriptionQueueSchemaManager;
use App\Webabo\WebaboOfferCacheSchemaManager;
use Doctrine\DBAL\DriverManager;
use Doctrine\ORM\EntityManager;
use Doctrine\ORM\ORMSetup;
use PHPUnit\Framework\TestCase;

final class SchemaManagerCoexistenceTest extends TestCase
{
    /**
     * @var list<EntityManager>
     */
    private array $entityManagers = [];

    protected function tearDown(): void
    {
        foreach ($this->entityManagers as $entityManager) {
            try {
                $entityManager->getConnection()->executeStatement('DROP TABLE IF EXISTS outbox_events');
                $entityManager->getConnection()->executeStatement('DROP TABLE IF EXISTS subscription_orders');
                $entityManager->getConnection()->executeStatement('DROP TABLE IF EXISTS webabo_offers_cache');
                $entityManager->getConnection()->executeStatement('DROP TABLE IF EXISTS werfsleutel_offer_cache');
            } catch (\Throwable) {
            }

            $entityManager->getConnection()->close();
        }

        $this->entityManagers = [];

        parent::tearDown();
    }

    public function testSchemaManagersDoNotDropEachOthersTables(): void
    {
        $entityManager = $this->createEntityManager();
        $connection = $entityManager->getConnection();
        $webaboSchemaManager = new WebaboOfferCacheSchemaManager($connection, $entityManager);
        $queueSchemaManager = new SubscriptionQueueSchemaManager($connection, $entityManager);

        $webaboSchemaManager->ensureSchema();
        self::assertTrue($webaboSchemaManager->hasCacheTable());

        $queueSchemaManager->ensureSchema();
        self::assertTrue($webaboSchemaManager->hasCacheTable());
        self::assertTrue($queueSchemaManager->hasQueueTables());

        $webaboSchemaManager->ensureSchema();
        self::assertTrue($webaboSchemaManager->hasCacheTable());
        self::assertTrue($queueSchemaManager->hasQueueTables());
    }

    private function createEntityManager(): EntityManager
    {
        $config = ORMSetup::createAttributeMetadataConfig([
            dirname(__DIR__, 2).'/src/Entity',
        ], true);
        $connection = DriverManager::getConnection($this->getConnectionParams(), $config);

        try {
            $connection->connect();
        } catch (\Throwable $exception) {
            self::markTestSkipped(sprintf('Test database is niet bereikbaar: %s', $exception->getMessage()));
        }

        $entityManager = new EntityManager($connection, $config);
        $this->entityManagers[] = $entityManager;

        return $entityManager;
    }

    /**
     * @return array<string, mixed>
     */
    private function getConnectionParams(): array
    {
        if (extension_loaded('pdo_sqlite')) {
            return [
                'driver' => 'pdo_sqlite',
                'memory' => true,
            ];
        }

        if (!extension_loaded('pdo_pgsql')) {
            self::markTestSkipped('pdo_sqlite or pdo_pgsql is required for SchemaManagerCoexistenceTest.');
        }

        return [
            'driver' => 'pdo_pgsql',
            'host' => getenv('SESSION_DB_HOST') ?: '127.0.0.1',
            'port' => (int) (getenv('SESSION_DB_PORT') ?: 5432),
            'dbname' => getenv('SESSION_DB_NAME') ?: 'kiwi_test',
            'user' => getenv('SESSION_DB_USER') ?: 'kiwi',
            'password' => getenv('SESSION_DB_PASSWORD') ?: 'kiwi',
            'charset' => 'utf8',
            'sslmode' => getenv('SESSION_DB_SSLMODE') ?: 'disable',
        ];
    }
}
