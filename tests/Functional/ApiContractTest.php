<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Entity\WebaboOffer;
use App\Outbox\SubscriptionQueueSchemaManager;
use App\Webabo\WebaboOfferCacheSchemaManager;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class ApiContractTest extends WebTestCase
{
    use AuthenticatedClientTrait;

    private ?string $previousClientSecretsPath = null;
    private ?string $tempClientSecretsDir = null;

    protected function tearDown(): void
    {
        static::ensureKernelShutdown();

        if (null !== $this->previousClientSecretsPath && '' !== $this->previousClientSecretsPath) {
            putenv(sprintf('KIWI_CLIENT_SECRETS_PATH=%s', $this->previousClientSecretsPath));
        } else {
            putenv('KIWI_CLIENT_SECRETS_PATH');
        }

        if (null !== $this->tempClientSecretsDir && is_dir($this->tempClientSecretsDir)) {
            array_map('unlink', glob($this->tempClientSecretsDir.'/*') ?: []);
            rmdir($this->tempClientSecretsDir);
        }

        $this->previousClientSecretsPath = null;
        $this->tempClientSecretsDir = null;

        parent::tearDown();
    }

    public function testHealthRouteIsPublicAndApiStatusRequiresAuthentication(): void
    {
        $client = static::createClient();
        $client->request('GET', '/status');
        self::assertResponseIsSuccessful();
        $payload = json_decode($client->getResponse()->getContent(), true);
        self::assertSame('ok', $payload['status']);
        self::assertArrayHasKey('rate_limit', $payload);

        $client->request('GET', '/api/v1/status');
        self::assertResponseStatusCodeSame(401);
        $payload = json_decode($client->getResponse()->getContent(), true);
        self::assertSame('unauthorized', $payload['error']['code']);

        $client->request('GET', '/api/v1/bootstrap');
        self::assertResponseStatusCodeSame(401);
        $payload = json_decode($client->getResponse()->getContent(), true);
        self::assertSame('unauthorized', $payload['error']['code']);
    }

    public function testMeAndBootstrapReturnAuthenticatedContext(): void
    {
        $client = $this->createAuthenticatedClient();

        $client->request('GET', '/api/v1/me');
        self::assertResponseIsSuccessful();
        $payload = json_decode($client->getResponse()->getContent(), true);
        self::assertSame('test@example.org', $payload['identity']['email']);

        $client->request('GET', '/api/v1/bootstrap');
        self::assertResponseIsSuccessful();
        $payload = json_decode($client->getResponse()->getContent(), true);
        self::assertArrayHasKey('customers', $payload);
        self::assertArrayHasKey('call_queue', $payload);
        self::assertArrayHasKey('catalog', $payload);
        self::assertGreaterThanOrEqual(1, count($payload['customers']));
    }

    public function testExpiredSessionTokenIsRejectedByApiEndpoints(): void
    {
        $client = $this->createClientWithSession([
            'oidc_auth_profile' => [
                'name' => 'Expired User',
                'email' => 'expired@example.org',
                'roles' => ['bink8s.app.kiwi.user'],
            ],
            'oidc_auth_token' => [
                'access_token' => 'expired-access-token',
                'id_token' => 'expired-id-token',
                'expires' => time() - 60,
            ],
        ]);

        $client->request('GET', '/api/v1/me');

        self::assertResponseStatusCodeSame(401);
        $payload = json_decode($client->getResponse()->getContent(), true);
        self::assertSame('unauthorized', $payload['error']['code']);
    }

    public function testCustomerWorkflowAndMutationFlow(): void
    {
        $this->disableSubscriptionApiCustomerSearch();

        $client = $this->createAuthenticatedClient();
        $this->resetSubscriptionQueueStorage();

        $client->request('GET', '/api/v1/persons');
        self::assertResponseIsSuccessful();
        $existingCustomers = json_decode($client->getResponse()->getContent(), true);
        $recipientId = $existingCustomers['items'][0]['id'];
        $requesterId = $existingCustomers['items'][1]['id'];
        $submissionId = 'sc-187755-functional-submission';
        $requestPayload = [
            'submissionId' => $submissionId,
            'recipient' => ['personId' => $recipientId],
            'requester' => ['personId' => $requesterId],
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
                'credentialKey' => 'avrotros',
                'channel' => 'telemarketing',
                'channelLabel' => 'Telemarketing',
            ],
            'contactEntry' => [
                'type' => 'Extra abonnement',
                'description' => 'Test: extra abonnement toegevoegd.',
            ],
        ];

        $client->request('POST', '/api/v1/workflows/subscription', server: ['CONTENT_TYPE' => 'application/json'], content: json_encode($requestPayload, JSON_THROW_ON_ERROR));
        self::assertResponseStatusCodeSame(202);
        $payload = json_decode($client->getResponse()->getContent(), true);
        self::assertSame($submissionId, $payload['submissionId']);
        self::assertSame('queued', $payload['status']);
        self::assertSame($recipientId, $payload['summary']['recipient']['personId']);
        self::assertSame('AVRV519', $payload['summary']['offer']['salesCode']);
        self::assertSame('avrotros', $payload['summary']['offer']['credentialKey']);
        self::assertSame('Aanvraag', $payload['summary']['typeLabel']);
        self::assertSame('pending', $payload['event']['status']);
        self::assertSame('Aanvraag', $payload['display']['typeLabel']);
        self::assertSame('TU', $payload['display']['agentBadge']);
        self::assertSame('in behandeling', $payload['display']['statusLabel']);
        self::assertStringNotContainsString('T. User', $payload['display']['line']);
        self::assertStringContainsString("Aanvraag '1 jaar Avrobode voor maar EUR52' (AVRV519)", $payload['display']['line']);
        $orderId = $payload['orderId'];

        $client->request('POST', '/api/v1/workflows/subscription', server: ['CONTENT_TYPE' => 'application/json'], content: json_encode($requestPayload, JSON_THROW_ON_ERROR));
        self::assertResponseStatusCodeSame(202);
        $duplicatePayload = json_decode($client->getResponse()->getContent(), true);
        self::assertSame($orderId, $duplicatePayload['orderId']);
        self::assertSame($submissionId, $duplicatePayload['submissionId']);
        self::assertSame($payload['display'], $duplicatePayload['display']);

        $client->request('GET', sprintf('/api/v1/workflows/subscription/%d', $orderId));
        self::assertResponseIsSuccessful();
        $statusPayload = json_decode($client->getResponse()->getContent(), true);
        self::assertSame($submissionId, $statusPayload['submissionId']);
        self::assertSame('queued', $statusPayload['status']);
        self::assertSame($payload['display'], $statusPayload['display']);

        $client->request('GET', '/api/v1/workflows/subscription?limit=5');
        self::assertResponseIsSuccessful();
        $listPayload = json_decode($client->getResponse()->getContent(), true);
        self::assertSame($submissionId, $listPayload['items'][0]['submissionId']);
        self::assertSame($payload['display'], $listPayload['items'][0]['display']);

        /** @var EntityManagerInterface $entityManager */
        $entityManager = static::getContainer()->get(EntityManagerInterface::class);
        $connection = $entityManager->getConnection();
        self::assertSame(1, (int) $connection->fetchOne(
            'SELECT COUNT(*) FROM subscription_orders WHERE submission_id = ?',
            [$submissionId],
        ));
        self::assertSame(1, (int) $connection->fetchOne(
            'SELECT COUNT(*) FROM outbox_events WHERE order_id = ?',
            [$orderId],
        ));

        $client->request('PATCH', sprintf('/api/v1/persons/%d', $recipientId), server: ['CONTENT_TYPE' => 'application/json'], content: json_encode([
            'city' => 'Zwolle',
        ], JSON_THROW_ON_ERROR));
        self::assertResponseIsSuccessful();
        self::assertSame('Zwolle', json_decode($client->getResponse()->getContent(), true)['city']);

        $client->request('PUT', sprintf('/api/v1/persons/%d/delivery-remarks', $recipientId), server: ['CONTENT_TYPE' => 'application/json'], content: json_encode([
            'default' => 'Test opmerking',
            'updatedBy' => 'Unit Test',
        ], JSON_THROW_ON_ERROR));
        self::assertResponseIsSuccessful();
        self::assertSame('Test opmerking', json_decode($client->getResponse()->getContent(), true)['deliveryRemarks']['default']);
    }

    public function testCatalogOrderAndCallFlow(): void
    {
        $client = $this->createAuthenticatedClient();

        $client->request('GET', '/api/v1/catalog/articles?popular=true&limit=1');
        self::assertResponseIsSuccessful();
        $article = json_decode($client->getResponse()->getContent(), true)['items'][0];

        $client->request('POST', '/api/v1/workflows/article-order', server: ['CONTENT_TYPE' => 'application/json'], content: json_encode([
            'customer' => [
                'salutation' => 'Mevr.',
                'firstName' => 'Order',
                'middleName' => '',
                'lastName' => 'Tester',
                'birthday' => '1980-01-01',
                'postalCode' => '1234AB',
                'houseNumber' => '10',
                'address' => 'Teststraat 10',
                'city' => 'Teststad',
                'email' => 'order@test.example',
                'phone' => '0612345678',
            ],
            'order' => [
                'desiredDeliveryDate' => '2026-02-20',
                'paymentMethod' => 'iDEAL',
                'items' => [
                    ['articleId' => $article['id'], 'quantity' => 2],
                ],
            ],
            'contactEntry' => [
                'type' => 'Artikel bestelling',
                'description' => 'Test order geplaatst',
            ],
        ], JSON_THROW_ON_ERROR));
        self::assertResponseStatusCodeSame(201);
        $payload = json_decode($client->getResponse()->getContent(), true);
        self::assertTrue($payload['createdCustomer']);
        self::assertSame($article['id'], $payload['order']['items'][0]['articleId']);

        $client->request('POST', '/api/v1/call-queue/debug-generate', server: ['CONTENT_TYPE' => 'application/json'], content: json_encode([
            'queueSize' => 2,
            'queueMix' => 'all_known',
        ], JSON_THROW_ON_ERROR));
        self::assertResponseIsSuccessful();
        self::assertCount(2, json_decode($client->getResponse()->getContent(), true)['queue']);

        $client->request('POST', '/api/v1/call-queue/accept-next', server: ['CONTENT_TYPE' => 'application/json'], content: json_encode([], JSON_THROW_ON_ERROR));
        self::assertResponseIsSuccessful();
        $accepted = json_decode($client->getResponse()->getContent(), true)['accepted'];
        self::assertNotNull($accepted['customerId']);

        $client->request('POST', '/api/v1/call-session/hold', server: ['CONTENT_TYPE' => 'application/json'], content: json_encode([], JSON_THROW_ON_ERROR));
        self::assertResponseIsSuccessful();
        self::assertTrue(json_decode($client->getResponse()->getContent(), true)['onHold']);

        $client->request('POST', '/api/v1/call-session/resume', server: ['CONTENT_TYPE' => 'application/json'], content: json_encode([], JSON_THROW_ON_ERROR));
        self::assertResponseIsSuccessful();
        self::assertFalse(json_decode($client->getResponse()->getContent(), true)['onHold']);

        $client->request('POST', '/api/v1/call-session/end', server: ['CONTENT_TYPE' => 'application/json'], content: json_encode([
            'forcedByCustomer' => true,
        ], JSON_THROW_ON_ERROR));
        self::assertResponseIsSuccessful();
        $lastCall = json_decode($client->getResponse()->getContent(), true)['last_call_session'];
        self::assertSame($accepted['customerId'], $lastCall['customerId']);

        $client->request('POST', '/api/v1/call-session/disposition', server: ['CONTENT_TYPE' => 'application/json'], content: json_encode([
            'category' => 'general',
            'outcome' => 'info_provided',
            'notes' => 'Handled in test',
        ], JSON_THROW_ON_ERROR));
        self::assertResponseIsSuccessful();
        self::assertSame('saved', json_decode($client->getResponse()->getContent(), true)['status']);
    }

    public function testCatalogAndSubscriptionEndpoints(): void
    {
        $client = $this->createAuthenticatedClient();
        $this->seedWebaboOfferCache();

        $client->request('GET', '/api/v1/webabo/offers?query=avro&limit=5');
        self::assertResponseIsSuccessful();
        $offersPayload = json_decode($client->getResponse()->getContent(), true);
        self::assertGreaterThan(0, count($offersPayload['items']));
        self::assertSame('avrotros', $offersPayload['items'][0]['credentialKey']);

        $barcode = $offersPayload['items'][0]['barcode'];
        $client->request('GET', sprintf('/api/v1/webabo/offers?barcode=%s&limit=5', $barcode));
        self::assertResponseIsSuccessful();
        self::assertGreaterThanOrEqual(1, json_decode($client->getResponse()->getContent(), true)['total']);

        $client->request('GET', '/api/v1/webabo/offers/AVRV519/salescodecombinations');
        self::assertResponseIsSuccessful();
        $salesCodeCombinationsPayload = json_decode($client->getResponse()->getContent(), true);
        self::assertSame('AVRV519', $salesCodeCombinationsPayload['salesCode']);
        self::assertSame('AVR', $salesCodeCombinationsPayload['productCode']);
        self::assertSame('avrotros', $salesCodeCombinationsPayload['credentialKey']);
        self::assertSame(['EM/OU', 'TM/IB'], array_column($salesCodeCombinationsPayload['items'], 'key'));

        $client->request('GET', '/api/v1/catalog/delivery-calendar?year=2026&month=2');
        self::assertResponseIsSuccessful();
        $calendar = json_decode($client->getResponse()->getContent(), true);
        self::assertSame(2, $calendar['month']);
        self::assertArrayHasKey('recommendedDate', $calendar);

        $client->request('PATCH', '/api/v1/subscriptions/1/1', server: ['CONTENT_TYPE' => 'application/json'], content: json_encode([
            'status' => 'active',
            'duration' => '2-jaar',
        ], JSON_THROW_ON_ERROR));
        self::assertResponseIsSuccessful();
        self::assertSame('2-jaar', json_decode($client->getResponse()->getContent(), true)['subscription']['duration']);

        $client->request('POST', '/api/v1/subscriptions/1/1/complaint', server: ['CONTENT_TYPE' => 'application/json'], content: json_encode([
            'reason' => 'damaged',
        ], JSON_THROW_ON_ERROR));
        self::assertResponseIsSuccessful();
        self::assertArrayHasKey('entry', json_decode($client->getResponse()->getContent(), true));
    }

    private function seedWebaboOfferCache(): void
    {
        /** @var WebaboOfferCacheSchemaManager $schemaManager */
        $schemaManager = static::getContainer()->get(WebaboOfferCacheSchemaManager::class);
        $schemaManager->ensureSchema();

        /** @var EntityManagerInterface $entityManager */
        $entityManager = static::getContainer()->get(EntityManagerInterface::class);
        $entityManager->getConnection()->executeStatement('DELETE FROM webabo_offers_cache');

        $offer = new WebaboOffer('AVRV519');
        $offer->refreshFromWebaboPayload([
            'offerId' => 12,
            'orderChoiceKey' => 34,
            'salesCode' => 'AVRV519',
            'title' => '1 jaar Avrobode voor maar EUR52',
            'credentialKey' => 'avrotros',
            'productCode' => 'AVR',
            'allowedChannels' => ['EM/OU', 'TM/IB'],
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
        $entityManager->clear();
    }

    private function resetSubscriptionQueueStorage(): void
    {
        /** @var SubscriptionQueueSchemaManager $schemaManager */
        $schemaManager = static::getContainer()->get(SubscriptionQueueSchemaManager::class);
        $schemaManager->ensureSchema();

        /** @var EntityManagerInterface $entityManager */
        $entityManager = static::getContainer()->get(EntityManagerInterface::class);
        $connection = $entityManager->getConnection();
        $connection->executeStatement('DELETE FROM outbox_events');
        $connection->executeStatement('DELETE FROM subscription_orders');
        $entityManager->clear();
    }

    private function disableSubscriptionApiCustomerSearch(): void
    {
        $this->previousClientSecretsPath = getenv('KIWI_CLIENT_SECRETS_PATH') ?: null;
        $this->tempClientSecretsDir = sys_get_temp_dir().'/kiwi-functional-api-contract-'.bin2hex(random_bytes(4));
        mkdir($this->tempClientSecretsDir, 0777, true);

        $path = $this->tempClientSecretsDir.'/client_secrets.json';
        file_put_contents($path, (string) json_encode([
            'hup' => [],
        ], JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));

        putenv(sprintf('KIWI_CLIENT_SECRETS_PATH=%s', $path));
    }
}
