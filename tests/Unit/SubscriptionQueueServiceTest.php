<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Entity\SubscriptionOrder;
use App\Entity\WebaboOffer;
use App\Outbox\SubscriptionQueueSchemaManager;
use App\Repository\SubscriptionOrderRepository;
use App\Repository\WebaboOfferRepository;
use App\Service\PocCatalogService;
use App\Service\PocStateService;
use App\Service\SubscriptionQueueDisplayFormatter;
use App\Service\SubscriptionQueueService;
use App\Webabo\WebaboOfferCacheSchemaManager;
use Doctrine\DBAL\DriverManager;
use Doctrine\ORM\EntityManager;
use Doctrine\ORM\ORMSetup;
use Doctrine\Persistence\ManagerRegistry;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Session\Session;
use Symfony\Component\HttpFoundation\Session\Storage\MockArraySessionStorage;

final class SubscriptionQueueServiceTest extends TestCase
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

    public function testQueueSubscriptionIsIdempotentAndReadable(): void
    {
        [$service, $entityManager, , $offerSchemaManager] = $this->createQueueServiceWithDependencies();
        $offerSchemaManager->ensureSchema();

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
            'subscriptionCode' => 'SUB-AVRO-1',
            'productCode' => 'PROD-AVRO-1',
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
        ], new \DateTimeImmutable('2026-03-20T12:00:00+00:00'));
        $entityManager->persist($offer);
        $entityManager->flush();
        $entityManager->clear();

        $session = new Session(new MockArraySessionStorage());
        $payload = [
            'submissionId' => 'unit-test-submission-id',
            'recipient' => [
                'person' => [
                    'salutation' => 'Dhr.',
                    'firstName' => 'Piet',
                    'middleName' => '',
                    'lastName' => 'Tester',
                    'birthday' => '1980-01-01',
                    'postalCode' => '1234AB',
                    'houseNumber' => '10',
                    'address' => 'Teststraat 10',
                    'city' => 'Teststad',
                    'email' => 'piet.tester@example.org',
                    'phone' => '0612345678',
                    'optinEmail' => 'yes',
                    'optinPhone' => 'no',
                    'optinPost' => 'yes',
                ],
            ],
            'requester' => [
                'sameAsRecipient' => true,
            ],
            'subscription' => [
                'magazine' => 'Avrobode',
                'duration' => '1-jaar',
                'durationLabel' => '1 jaar (52 nummers)',
                'startDate' => '2026-01-10',
                'status' => 'active',
            ],
            'offer' => [
                'salesCode' => 'AVRV519',
                'title' => '1 jaar Avrobode voor maar EUR52',
                'price' => 52.0,
                'channel' => 'telemarketing',
                'channelLabel' => 'Telemarketing',
            ],
            'contactEntry' => [
                'type' => 'Nieuw abonnement',
                'description' => 'Unit test aanvraag',
            ],
        ];
        $currentUserContext = [
            'identity' => [
                'first_name' => 'Bart',
                'last_name' => 'Example',
                'full_name' => 'Bart Example',
                'initials' => 'BE',
                'email' => 'bart.example@example.org',
            ],
            'roles' => ['bink8s.app.kiwi.user'],
        ];

        $firstResponse = $service->queueSubscription($session, $payload, $currentUserContext);
        self::assertSame('queued', $firstResponse['status']);
        self::assertSame('pending', $firstResponse['event']['status']);
        self::assertSame('unit-test-submission-id', $firstResponse['submissionId']);
        self::assertSame('AVRV519', $firstResponse['summary']['offer']['salesCode']);
        self::assertSame(12, $firstResponse['summary']['offer']['offerId']);
        self::assertSame(34, $firstResponse['summary']['offer']['orderChoiceKey']);
        self::assertSame('SUB-AVRO-1', $firstResponse['summary']['offer']['subscriptionCode']);
        self::assertSame('PROD-AVRO-1', $firstResponse['summary']['offer']['productCode']);
        self::assertSame('avrotros', $firstResponse['summary']['offer']['credentialKey']);
        self::assertSame('AVROTROS', $firstResponse['summary']['offer']['credentialTitle']);
        self::assertSame('AVROTROS', $firstResponse['summary']['offer']['mandant']);
        self::assertTrue($firstResponse['summary']['offer']['supportsPersonLookup']);
        self::assertSame('webabo-api', $firstResponse['summary']['offer']['sourceSystem']);
        self::assertTrue($firstResponse['summary']['requester']['sameAsRecipient']);
        self::assertSame('B. Example', $firstResponse['summary']['agent']['shortName']);
        self::assertSame('Aanvraag', $firstResponse['summary']['typeLabel']);
        self::assertSame('Aanvraag', $firstResponse['display']['typeLabel']);
        self::assertSame('BE', $firstResponse['display']['agentBadge']);
        self::assertSame('in behandeling', $firstResponse['display']['statusLabel']);
        self::assertStringContainsString("Aanvraag '1 jaar Avrobode voor maar EUR52' (AVRV519) voor Dhr. Tester (nieuw)", $firstResponse['display']['line']);
        self::assertStringNotContainsString('B. Example', $firstResponse['display']['line']);

        $secondResponse = $service->queueSubscription($session, $payload, $currentUserContext);
        self::assertSame($firstResponse['orderId'], $secondResponse['orderId']);
        self::assertSame($firstResponse['submissionId'], $secondResponse['submissionId']);
        self::assertSame($firstResponse['display'], $secondResponse['display']);

        $listResponse = $service->listRecentOrders(5);
        self::assertCount(1, $listResponse['items']);
        self::assertSame($firstResponse['orderId'], $listResponse['items'][0]['orderId']);

        $statusResponse = $service->getOrderStatus($firstResponse['orderId']);
        self::assertSame($firstResponse['submissionId'], $statusResponse['submissionId']);
        self::assertSame('queued', $statusResponse['status']);
        self::assertSame('pending', $statusResponse['event']['status']);
    }

    public function testQueueSubscriptionPreservesExistingPersonCredentialContext(): void
    {
        [$service, $entityManager, , $offerSchemaManager] = $this->createQueueServiceWithDependencies();
        $offerSchemaManager->ensureSchema();

        $offer = new WebaboOffer('TVZ100');
        $offer->refreshFromWebaboPayload([
            'salesCode' => 'TVZ100',
            'title' => 'Televizier 1 jaar',
            'credentialKey' => 'tvz',
            'mandant' => 'AVROTROS',
            'sourceSystem' => 'webabo-api',
            'offerPrice' => [
                'price' => 49.0,
            ],
        ], new \DateTimeImmutable('2026-03-20T12:00:00+00:00'));
        $entityManager->persist($offer);
        $entityManager->flush();
        $entityManager->clear();

        $session = new Session(new MockArraySessionStorage());
        $session->set('kiwi_poc_state', [
            'customers' => [
                [
                    'id' => 27,
                    'salutation' => 'Mevr.',
                    'firstName' => 'Anne',
                    'middleName' => 'van',
                    'lastName' => 'Dijk',
                    'birthday' => '1988-04-12',
                    'postalCode' => '1234AB',
                    'houseNumber' => '8',
                    'address' => 'Voorbeeldstraat 8',
                    'city' => 'Hilversum',
                    'email' => 'anne@example.org',
                    'phone' => '0612345678',
                    'credentialKey' => 'tvk',
                    'credentialTitle' => 'TV Krant',
                    'mandant' => 'HMC',
                    'supportsPersonLookup' => true,
                    'sourceSystem' => 'subscription-api',
                ],
            ],
        ]);

        $payload = [
            'submissionId' => 'unit-test-existing-person-context',
            'recipient' => [
                'personId' => 27,
            ],
            'requester' => [
                'sameAsRecipient' => true,
            ],
            'subscription' => [
                'magazine' => 'Televizier',
                'duration' => '1-jaar',
                'durationLabel' => '1 jaar',
                'startDate' => '2026-04-01',
                'status' => 'active',
            ],
            'offer' => [
                'salesCode' => 'TVZ100',
                'title' => 'Televizier 1 jaar',
                'price' => 49.0,
                'channel' => 'online',
                'channelLabel' => 'Online',
            ],
        ];

        $service->queueSubscription($session, $payload, [
            'identity' => [
                'full_name' => 'Test User',
            ],
        ]);

        $requestPayload = json_decode((string) $entityManager->getConnection()->fetchOne(
            'SELECT request_payload FROM subscription_orders WHERE submission_id = ?',
            ['unit-test-existing-person-context'],
        ), true, 512, JSON_THROW_ON_ERROR);

        self::assertSame('tvk', $requestPayload['recipient']['person']['credentialKey']);
        self::assertSame('TV Krant', $requestPayload['recipient']['person']['credentialTitle']);
        self::assertSame('HMC', $requestPayload['recipient']['person']['mandant']);
        self::assertTrue($requestPayload['recipient']['person']['supportsPersonLookup']);
        self::assertSame('subscription-api', $requestPayload['recipient']['person']['sourceSystem']);
        self::assertSame('tvk', $requestPayload['requester']['person']['credentialKey']);
    }

    /**
     * @return array{0: SubscriptionQueueService, 1: EntityManager, 2: SubscriptionQueueSchemaManager, 3: WebaboOfferCacheSchemaManager}
     */
    private function createQueueServiceWithDependencies(): array
    {
        $projectDir = dirname(__DIR__, 2);
        $config = ORMSetup::createAttributeMetadataConfig([
            $projectDir.'/src/Entity',
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
        $registry->method('getManagerForClass')->willReturnCallback(static function (string $className) use ($entityManager): ?EntityManager {
            return match ($className) {
                SubscriptionOrder::class, WebaboOffer::class => $entityManager,
                default => null,
            };
        });

        $repository = new SubscriptionOrderRepository($registry);
        $schemaManager = new SubscriptionQueueSchemaManager($connection, $entityManager);
        $webaboOfferRepository = new WebaboOfferRepository($registry);
        $webaboOfferSchemaManager = new WebaboOfferCacheSchemaManager($connection, $entityManager);
        $stateService = new PocStateService(new PocCatalogService($projectDir), $projectDir);

        return [
            new SubscriptionQueueService(
                $schemaManager,
                $repository,
                $entityManager,
                $connection,
                $stateService,
                new SubscriptionQueueDisplayFormatter(),
                $webaboOfferSchemaManager,
                $webaboOfferRepository,
            ),
            $entityManager,
            $schemaManager,
            $webaboOfferSchemaManager,
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
            self::markTestSkipped('pdo_sqlite or pdo_pgsql is required for SubscriptionQueueServiceTest.');
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
