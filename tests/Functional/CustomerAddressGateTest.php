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
            'houseNumber' => '1A', 'houseNumberAddition' => '', 'street' => 'Rembrandtlaan', 'city' => 'LOOSDRECHT', 'email' => 'changed@example.invalid'];
        $client->jsonRequest('PATCH', '/api/v1/persons/1', $corrected);
        self::assertResponseIsSuccessful();
        self::assertSame('confirmed', json_decode($client->getResponse()->getContent(), true)['addressValidation']['status']);
        $client->jsonRequest('PUT', '/api/v1/persons/1/delivery-remarks', ['default' => 'Now permitted']);
        self::assertResponseIsSuccessful();
        $client->request('GET', '/api/v1/persons/1');
        self::assertSame('confirmed', json_decode($client->getResponse()->getContent(), true)['addressValidation']['status']);

        // A later changed address cannot borrow the old confirmation.
        $session = $this->newSession();
        $session->setId($this->resolveClientSessionId($client));
        static::getContainer()->get(PocStateService::class)->updateCustomer($session, 1, ['houseNumberAddition' => 'B']);
        $session->save();
        $client->jsonRequest('PATCH', '/api/v1/persons/1', ['email' => 'forbidden@example.invalid']);
        self::assertResponseStatusCodeSame(409);
    }

    public function testExternalCorrectionPersistsOnlyAddressAndRequiresReadback(): void
    {
        file_put_contents($this->configFile, json_encode([
            'postnl' => ['api_key' => '<api-key>'],
            'hup' => ['hup_oidc_token' => 'https://identity.invalid/token', 'webabo_base_url' => 'https://webabo.invalid',
                'ppa_base_url' => 'https://subscription.invalid',
                'credentials' => ['demo' => ['username' => 'fixture', 'password' => '<password>']]],
        ]));
        $client = $this->createAuthenticatedClient();
        $client->disableReboot();
        static::getContainer()->set('address.http_client', AddressSmokeHttpClientFactory::create());
        $contact = ['extension' => 'Internal supplement', 'address' => ['street' => 'Wrong street', 'postCode' => '1231AA',
            'city' => 'WRONG CITY', 'housenumber' => ['housenumber' => '1']]];
        $writes = [];
        $persist = true;
        $http = new \Symfony\Component\HttpClient\MockHttpClient(function ($method, $url, $options) use (&$contact, &$writes, &$persist) {
            if (str_contains($url, 'identity.invalid')) $data = ['access_token' => '<token>', 'expires_in' => 300];
            elseif (str_contains($url, '/public/orders')) $data = ['content' => []];
            elseif ('PATCH' === $method) {
                $writes[] = json_decode($options['body'], true);
                if ($persist) $contact['address'] = array_replace($contact['address'], $writes[array_key_last($writes)]['address']);
                $data = $contact;
            } elseif (str_contains($url, '/contacts/addresses/0')) $data = $contact;
            else $data = ['rId' => '123', 'lastName' => 'External fixture', 'contacts' => ['addresses' => [$contact]]];
            return new \Symfony\Component\HttpClient\Response\MockResponse(json_encode($data));
        });
        static::getContainer()->set('http_client', $http);
        $client->request('GET', '/api/v1/persons/123?credentialKey=demo');
        self::assertResponseIsSuccessful();
        self::assertSame('blocked', json_decode($client->getResponse()->getContent(), true)['addressValidation']['status']);
        $payload = ['formSessionId' => 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'postalCode' => '1231AA',
            'houseNumber' => '1A', 'houseNumberAddition' => '', 'street' => 'Rembrandtlaan', 'city' => 'LOOSDRECHT'];
        $client->jsonRequest('PATCH', '/api/v1/persons/123/address?credentialKey=demo', $payload + ['email' => 'must-not-change@example.invalid']);
        self::assertResponseStatusCodeSame(400);
        self::assertCount(0, $writes);
        $client->jsonRequest('PATCH', '/api/v1/persons/123/address?credentialKey=demo', array_replace($payload, ['houseNumberAddition' => 'B']));
        self::assertResponseStatusCodeSame(422);
        self::assertCount(0, $writes);
        $client->jsonRequest('PATCH', '/api/v1/persons/123/address?credentialKey=demo', $payload);
        self::assertResponseIsSuccessful();
        self::assertCount(1, $writes);
        self::assertSame(['address'], array_keys($writes[0]));
        self::assertSame('Internal supplement', $contact['extension']);
        self::assertSame('confirmed', json_decode($client->getResponse()->getContent(), true)['addressValidation']['status']);
        $persist = false;
        $client->jsonRequest('PATCH', '/api/v1/persons/123/address?credentialKey=demo', array_replace($payload, ['houseNumber' => '1']));
        self::assertResponseStatusCodeSame(409);
        self::assertSame('address_correction_unconfirmed', json_decode($client->getResponse()->getContent(), true)['error']['code']);
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
