<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Entity\SubscriptionOrder;
use App\Outbox\SubscriptionQueueSchemaManager;
use App\Repository\SubscriptionOrderRepository;
use App\Service\PocCatalogService;
use App\Service\PocStateService;
use App\Service\SubscriptionQueueDisplayFormatter;
use App\Service\SubscriptionQueueService;
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
            } catch (\Throwable) {
            }

            $entityManager->getConnection()->close();
        }

        $this->entityManagers = [];

        parent::tearDown();
    }

    public function testQueueSubscriptionIsIdempotentAndReadable(): void
    {
        [$service] = $this->createQueueServiceWithDependencies();
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

    /**
     * @return array{0: SubscriptionQueueService, 1: EntityManager, 2: SubscriptionQueueSchemaManager}
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
        $registry->method('getManagerForClass')->with(SubscriptionOrder::class)->willReturn($entityManager);

        $repository = new SubscriptionOrderRepository($registry);
        $schemaManager = new SubscriptionQueueSchemaManager($connection, $entityManager);
        $stateService = new PocStateService(new PocCatalogService($projectDir), $projectDir);

        return [
            new SubscriptionQueueService(
                $schemaManager,
                $repository,
                $entityManager,
                $connection,
                $stateService,
                new SubscriptionQueueDisplayFormatter(),
            ),
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
