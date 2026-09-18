<?php

declare(strict_types=1);
namespace App\Tests\Functional;

use App\Address\CustomerAddressGate;
use App\Service\PocStateService;
use App\Tests\Support\AddressSmokeHttpClientFactory;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\Request;

final class CustomerAddressGateTest extends WebTestCase
{
    use AuthenticatedClientTrait;
    private string $configFile;
    private string|false $previousConfig;

    protected function setUp(): void
    {
        $this->previousConfig = getenv('KIWI_CLIENT_SECRETS_PATH');
        $this->configFile = tempnam(sys_get_temp_dir(), 'address-gate-');
        file_put_contents($this->configFile, json_encode(['postnl' => ['api_key' => '<api-key>']]));
        putenv('KIWI_CLIENT_SECRETS_PATH='.$this->configFile);
    }

    protected function tearDown(): void
    {
        static::ensureKernelShutdown();
        putenv(false === $this->previousConfig ? 'KIWI_CLIENT_SECRETS_PATH' : 'KIWI_CLIENT_SECRETS_PATH='.$this->previousConfig);
        unlink($this->configFile);
        parent::tearDown();
    }

    public function testLoadingInvalidPersonAllowsReadsButBlocksAllMutationPathsUntilCorrection(): void
    {
        $client = $this->createAuthenticatedClient();
        $client->disableReboot();
        static::getContainer()->set('address.http_client', AddressSmokeHttpClientFactory::create());
        $client->request('GET', '/api/v1/persons/1');
        self::assertResponseIsSuccessful();
        $customer = json_decode($client->getResponse()->getContent(), true);
        self::assertSame('blocked', $customer['addressValidation']['status']);
        $sessionId = $customer['addressValidation']['formSessionId'];

        foreach ([
            ['PATCH', '/api/v1/persons/1', ['email' => 'changed@example.invalid']],
            ['PUT', '/api/v1/persons/1/delivery-remarks', ['default' => 'Do not save']],
            ['POST', '/api/v1/persons/1/contact-history', ['description' => 'Do not save']],
            ['POST', '/api/v1/persons/1/editorial-complaints', []],
            ['PATCH', '/api/v1/subscriptions/1/1', ['status' => 'cancelled']],
            ['POST', '/api/v1/subscriptions/1/1/complaint', []],
            ['POST', '/api/v1/subscriptions/1/1', []],
            ['POST', '/api/v1/subscriptions/1/deceased-actions', []],
            ['POST', '/api/v1/subscriptions/1/1/restitution-transfer', []],
            ['POST', '/api/v1/workflows/article-order', ['customerId' => 1]],
            ['POST', '/api/v1/workflows/subscription', ['recipient' => ['personId' => 1, 'person' => ['verified' => true]]]],
        ] as [$method, $url, $payload]) {
            $client->jsonRequest($method, $url, $payload);
            self::assertResponseStatusCodeSame(409, $url);
            self::assertSame('customer_address_unconfirmed', json_decode($client->getResponse()->getContent(), true)['error']['code']);
        }
        $client->request('GET', '/api/v1/persons/1');
        self::assertSame($sessionId, json_decode($client->getResponse()->getContent(), true)['addressValidation']['formSessionId']);
        self::assertSame($customer['email'], json_decode($client->getResponse()->getContent(), true)['email']);

        $corrected = ['formSessionId' => 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'postalCode' => '1231AA',
            'houseNumber' => '1A', 'houseNumberAddition' => '', 'street' => 'Rembrandtlaan', 'city' => 'LOOSDRECHT', 'addressExtension' => '310', 'email' => 'changed@example.invalid'];
        $client->jsonRequest('PATCH', '/api/v1/persons/1', $corrected);
        self::assertResponseIsSuccessful();
        self::assertSame('confirmed', json_decode($client->getResponse()->getContent(), true)['addressValidation']['status']);
        $client->jsonRequest('PUT', '/api/v1/persons/1/delivery-remarks', ['default' => 'Now permitted']);
        self::assertResponseIsSuccessful();
        $client->request('GET', '/api/v1/persons/1');
        self::assertSame('confirmed', json_decode($client->getResponse()->getContent(), true)['addressValidation']['status']);

        self::assertSame('310', json_decode($client->getResponse()->getContent(), true)['addressExtension']);

        // A later changed address cannot borrow the old confirmation.
        $session = $this->newSession();
        $session->setId($this->resolveClientSessionId($client));
        static::getContainer()->get(PocStateService::class)->updateCustomer($session, 1, ['houseNumberAddition' => 'B']);
        $session->save();
        $client->jsonRequest('PATCH', '/api/v1/persons/1', ['email' => 'forbidden@example.invalid']);
        self::assertResponseStatusCodeSame(409);
    }

    public function testDeceasedTransferValidatesTheRecipientBeforeSaving(): void
    {
        $client = $this->createAuthenticatedClient();
        $client->disableReboot();
        static::getContainer()->set('address.http_client', AddressSmokeHttpClientFactory::create());
        $address = ['postalCode' => '1231AA', 'houseNumber' => '1A', 'houseNumberAddition' => '',
            'street' => 'Rembrandtlaan', 'city' => 'LOOSDRECHT', 'addressExtension' => '310'];
        $client->jsonRequest('PATCH', '/api/v1/persons/1', $address);
        self::assertResponseIsSuccessful();
        $transfer = ['subscriptionId' => 1, 'action' => 'transfer', 'transferData' => $address];
        $transfer['transferData']['houseNumberAddition'] = 'INVALID';
        $client->jsonRequest('POST', '/api/v1/subscriptions/1/deceased-actions', ['actions' => [$transfer]]);
        self::assertResponseStatusCodeSame(422);
        $client->request('GET', '/api/v1/persons/1');
        $before = json_decode($client->getResponse()->getContent(), true);
        self::assertArrayNotHasKey('transferredTo', $before['subscriptions'][0]);
        $transfer['transferData'] = $address;
        $client->jsonRequest('POST', '/api/v1/subscriptions/1/deceased-actions', ['actions' => [$transfer]]);
        self::assertResponseIsSuccessful();
        $client->request('GET', '/api/v1/persons/1');
        $after = json_decode($client->getResponse()->getContent(), true);
        self::assertSame('310', $after['subscriptions'][0]['transferredTo']['addressExtension']);
        self::assertSame('Rembrandtlaan 1A', $after['subscriptions'][0]['transferredTo']['address']);
    }

    public function testExternalCorrectionCannotBypassWriteActivation(): void
    {
        $client = $this->createAuthenticatedClient();
        $client->disableReboot();
        static::getContainer()->set('http_client', new \Symfony\Component\HttpClient\MockHttpClient(function () {
            self::fail('A disabled mutation must not contact upstream.');
        }));
        $client->jsonRequest('PATCH', '/api/v1/persons/123/address?credentialKey=forged', [
            'postalCode' => '1231AA', 'houseNumber' => '1A', 'street' => 'Rembrandtlaan', 'city' => 'LOOSDRECHT',
        ]);
        self::assertResponseStatusCodeSame(409);
        self::assertSame('upstream_concurrency_unverified', json_decode($client->getResponse()->getContent(), true)['error']['code']);
    }

    public function testWorkflowIsolationAndReset(): void
    {
        $client = $this->createAuthenticatedClient();
        $client->disableReboot();
        static::getContainer()->set('address.http_client', AddressSmokeHttpClientFactory::create());
        $first = ['HTTP_X_KIWI_WORKFLOW_SESSION_ID' => 'workflow-one'];
        $second = ['HTTP_X_KIWI_WORKFLOW_SESSION_ID' => 'workflow-two'];
        $client->request('GET', '/api/v1/persons/1', server: $first);
        $id = json_decode($client->getResponse()->getContent(), true)['addressValidation']['formSessionId'];
        $client->request('GET', '/api/v1/persons/1', server: $second);
        self::assertNotSame($id, json_decode($client->getResponse()->getContent(), true)['addressValidation']['formSessionId']);
        $client->jsonRequest('POST', '/api/v1/customer-work-sessions/reset', ['workflowSessionId' => 'workflow-one', 'customerReference' => ['personId' => '1']]);
        self::assertResponseIsSuccessful();
        $client->request('GET', '/api/v1/persons/1', server: $first);
        self::assertSame('address_session_closed', json_decode($client->getResponse()->getContent(), true)['addressValidation']['reason']);
    }
}
