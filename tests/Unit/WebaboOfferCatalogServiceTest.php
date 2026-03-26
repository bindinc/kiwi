<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Entity\WebaboOffer;
use App\Repository\WebaboOfferRepository;
use App\Service\PocCatalogService;
use App\Service\WebaboOfferCatalogService;
use App\Webabo\WebaboOfferCacheSchemaManager;
use Doctrine\DBAL\DriverManager;
use Doctrine\ORM\EntityManager;
use Doctrine\ORM\ORMSetup;
use Doctrine\Persistence\ManagerRegistry;
use PHPUnit\Framework\TestCase;

final class WebaboOfferCatalogServiceTest extends TestCase
{
    /**
     * @var list<EntityManager>
     */
    private array $entityManagers = [];

    protected function tearDown(): void
    {
        foreach ($this->entityManagers as $entityManager) {
            try {
                $entityManager->getConnection()->executeStatement('DROP TABLE IF EXISTS webabo_offers_cache');
                $entityManager->getConnection()->executeStatement('DROP TABLE IF EXISTS werfsleutel_offer_cache');
            } catch (\Throwable) {
            }

            $entityManager->getConnection()->close();
        }

        $this->entityManagers = [];

        parent::tearDown();
    }

    public function testSearchDoesNotFallbackToPocDatasetWhenCacheTableIsMissing(): void
    {
        $service = $this->createCatalogService();

        self::assertSame([], $service->search('avro', '', 5));
        self::assertSame([], $service->search('', '8712345678901', 5));
    }

    public function testSearchUsesCachedOffersForQueryAndBarcode(): void
    {
        [$service, $entityManager, $schemaManager] = $this->createCatalogServiceWithDependencies();
        $schemaManager->ensureSchema();

        $offer = new WebaboOffer('AVRV519');
        $offer->refreshFromWebaboPayload([
            'offerId' => 12,
            'orderChoiceKey' => 34,
            'salesCode' => 'AVRV519',
            'title' => '1 jaar Avrobode voor maar EUR52',
            'credentialKey' => 'avrotros',
            'credentialTitle' => 'AVROTROS',
            'mandant' => 'AVROTROS',
            'supportsPersonLookup' => true,
            'sourceSystem' => 'webabo-api',
            'offerPrice' => [
                'price' => 52.0,
                'priceCode' => 'std',
            ],
            'offerDelivery' => [
                'validDate' => [
                    'validFrom' => '2026-01-01T00:00:00+00:00',
                    'validUntil' => '2027-01-01T00:00:00+00:00',
                ],
            ],
            'barcode' => '8712345678901',
        ], new \DateTimeImmutable('2026-03-20T12:00:00+00:00'));

        $entityManager->persist($offer);
        $entityManager->flush();

        $queryMatches = $service->search('avro', '', 5);
        self::assertCount(1, $queryMatches);
        self::assertSame('AVRV519', $queryMatches[0]['salesCode']);
        self::assertSame('8712345678901', $queryMatches[0]['barcode']);
        self::assertSame('avrotros', $queryMatches[0]['credentialKey']);
        self::assertSame('AVROTROS', $queryMatches[0]['credentialTitle']);
        self::assertSame('AVROTROS', $queryMatches[0]['mandant']);
        self::assertTrue($queryMatches[0]['supportsPersonLookup']);
        self::assertSame('webabo-api', $queryMatches[0]['sourceSystem']);
        self::assertSame('webabo-cache', $queryMatches[0]['source']);

        $barcodeMatches = $service->search('', '8712345678901', 5);
        self::assertCount(1, $barcodeMatches);
        self::assertSame('AVRV519', $barcodeMatches[0]['salesCode']);

        self::assertSame([], $service->search('bestaat-niet', '', 5));
    }

    private function createCatalogService(): WebaboOfferCatalogService
    {
        return $this->createCatalogServiceWithDependencies()[0];
    }

    /**
    * @return array{0: WebaboOfferCatalogService, 1: EntityManager, 2: WebaboOfferCacheSchemaManager}
     */
    private function createCatalogServiceWithDependencies(): array
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

        $registry = $this->createStub(ManagerRegistry::class);
        $registry->method('getManagerForClass')->with(WebaboOffer::class)->willReturn($entityManager);

        $repository = new WebaboOfferRepository($registry);
        $schemaManager = new WebaboOfferCacheSchemaManager($connection, $entityManager);
        $fallbackCatalog = new PocCatalogService(dirname(__DIR__, 2));

        return [
            new WebaboOfferCatalogService($repository, $schemaManager, $fallbackCatalog),
            $entityManager,
            $schemaManager,
        ];
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
            self::markTestSkipped('pdo_sqlite or pdo_pgsql is required for WebaboOfferCatalogServiceTest.');
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
