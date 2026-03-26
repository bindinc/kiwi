<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Entity\WebaboOffer;
use App\Repository\WebaboOfferRepository;
use App\Service\PocCatalogService;
use App\Service\WebaboSalesCodeCombinationCatalogService;
use App\Webabo\WebaboOfferCacheSchemaManager;
use App\Webabo\WebaboSalesCodeCombinationProviderInterface;
use Doctrine\DBAL\DriverManager;
use Doctrine\ORM\EntityManager;
use Doctrine\ORM\ORMSetup;
use Doctrine\Persistence\ManagerRegistry;
use PHPUnit\Framework\TestCase;

final class WebaboSalesCodeCombinationCatalogServiceTest extends TestCase
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

    public function testGetOfferSalesCodeCombinationsUsesDynamicRowsPerSalesCode(): void
    {
        [$service, $entityManager, $schemaManager] = $this->createCatalogServiceWithProvider(new class implements WebaboSalesCodeCombinationProviderInterface {
            public function fetchCombinations(string $credentialName, string $productCode, \DateTimeImmutable $referenceDate): array
            {
                return [
                    [
                        'salesCode' => 'MKGV452',
                        'description' => 'Mikrogids actie',
                        'salesChannel1' => 'OL',
                        'salesChannel2' => 'IS',
                        'salesChannel3' => 'MI',
                    ],
                    [
                        'salesCode' => 'MKGV452',
                        'description' => 'Mikrogids actie',
                        'salesChannel1' => 'PR',
                        'salesChannel2' => 'ET',
                        'salesChannel3' => 'LV',
                    ],
                    [
                        'salesCode' => 'ANDERS',
                        'description' => 'Niet voor deze offer',
                        'salesChannel1' => 'XX',
                    ],
                ];
            }
        });
        $schemaManager->ensureSchema();

        $offer = new WebaboOffer('MKGV452');
        $offer->refreshFromWebaboPayload([
            'salesCode' => 'MKGV452',
            'title' => '2026 MKG DL actie 52 ed. EUR 59,00',
            'credentialKey' => 'mkg',
            'credentialTitle' => 'Mikrogids',
            'mandant' => 'KRONCRV',
            'supportsPersonLookup' => false,
            'sourceSystem' => 'webabo-api',
            'productCode' => 'MKG',
            'allowedChannels' => ['EM/OU'],
        ], new \DateTimeImmutable('2026-03-20T12:00:00+00:00'));

        $entityManager->persist($offer);
        $entityManager->flush();

        $payload = $service->getOfferSalesCodeCombinations('MKGV452');

        self::assertSame('MKGV452', $payload['salesCode']);
        self::assertSame('mkg', $payload['credentialKey']);
        self::assertSame('Mikrogids', $payload['credentialTitle']);
        self::assertSame('KRONCRV', $payload['mandant']);
        self::assertFalse($payload['supportsPersonLookup']);
        self::assertSame('webabo-api', $payload['sourceSystem']);
        self::assertSame(false, $payload['usedFallback']);
        self::assertNull($payload['warning']);
        self::assertCount(2, $payload['items']);
        self::assertSame('OL/IS/MI', $payload['items'][0]['key']);
        self::assertSame('Online interne sites', $payload['items'][0]['label']);
        self::assertSame('PR/ET/LV', $payload['items'][1]['key']);
        self::assertSame('Print eigen titels', $payload['items'][1]['label']);
    }

    public function testGetOfferSalesCodeCombinationsFallsBackToOfferChannelsWhenLookupFails(): void
    {
        [$service, $entityManager, $schemaManager] = $this->createCatalogServiceWithProvider(new class implements WebaboSalesCodeCombinationProviderInterface {
            public function fetchCombinations(string $credentialName, string $productCode, \DateTimeImmutable $referenceDate): array
            {
                return [];
            }
        });
        $schemaManager->ensureSchema();

        $offer = new WebaboOffer('AVRV519');
        $offer->refreshFromWebaboPayload([
            'salesCode' => 'AVRV519',
            'title' => '1 jaar Avrobode voor maar EUR52',
            'credentialKey' => 'avrotros',
            'credentialTitle' => 'AVROTROS',
            'mandant' => 'AVROTROS',
            'supportsPersonLookup' => true,
            'sourceSystem' => 'webabo-api',
            'productCode' => 'AVR',
            'allowedChannels' => ['EM/OU', 'TM/IB'],
        ], new \DateTimeImmutable('2026-03-20T12:00:00+00:00'));

        $entityManager->persist($offer);
        $entityManager->flush();

        $payload = $service->getOfferSalesCodeCombinations('AVRV519');

        self::assertSame(true, $payload['usedFallback']);
        self::assertNull($payload['warning']);
        self::assertCount(2, $payload['items']);
        self::assertSame('EM/OU', $payload['items'][0]['key']);
        self::assertSame('E-mail outbound', $payload['items'][0]['label']);
        self::assertSame('TM/IB', $payload['items'][1]['key']);
        self::assertSame('Telemarketing inbound', $payload['items'][1]['label']);
    }

    public function testGetOfferSalesCodeCombinationsReturnsWarningWhenLiveLookupFails(): void
    {
        [$service, $entityManager, $schemaManager] = $this->createCatalogServiceWithProvider(new class implements WebaboSalesCodeCombinationProviderInterface {
            public function fetchCombinations(string $credentialName, string $productCode, \DateTimeImmutable $referenceDate): array
            {
                throw new \RuntimeException('lookup failed');
            }
        });
        $schemaManager->ensureSchema();

        $offer = new WebaboOffer('MKGV452');
        $offer->refreshFromWebaboPayload([
            'salesCode' => 'MKGV452',
            'title' => '2026 MKG DL actie 52 ed. EUR 59,00',
            'credentialKey' => 'mkg',
            'mandant' => 'KRONCRV',
            'productCode' => 'MKG',
        ], new \DateTimeImmutable('2026-03-20T12:00:00+00:00'));

        $entityManager->persist($offer);
        $entityManager->flush();

        $payload = $service->getOfferSalesCodeCombinations('MKGV452');

        self::assertSame([], $payload['items']);
        self::assertSame(false, $payload['usedFallback']);
        self::assertSame('Live kanaalcombinaties konden niet geladen worden.', $payload['warning']);
    }

    /**
     * @return array{0: WebaboSalesCodeCombinationCatalogService, 1: EntityManager, 2: WebaboOfferCacheSchemaManager}
     */
    private function createCatalogServiceWithProvider(WebaboSalesCodeCombinationProviderInterface $provider): array
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
            new WebaboSalesCodeCombinationCatalogService($schemaManager, $repository, $provider, $fallbackCatalog),
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
            self::markTestSkipped('pdo_sqlite or pdo_pgsql is required for WebaboSalesCodeCombinationCatalogServiceTest.');
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
