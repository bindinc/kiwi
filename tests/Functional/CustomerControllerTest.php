<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Config\ClientSecretsLoader;
use App\SubscriptionApi\AggregatedPersonSearchService;
use App\SubscriptionApi\MultiCredentialPersonSearchService;
use App\SubscriptionApi\PersonDetailService;
use App\SubscriptionApi\PersonSearchClient;
use App\SubscriptionApi\PersonSearchResultNormalizer;
use App\SubscriptionApi\SubscriptionOrderNormalizer;
use App\Webabo\HupApiConfigProvider;
use App\Webabo\WebaboAccessTokenProvider;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class CustomerControllerTest extends WebTestCase
{
    use AuthenticatedClientTrait;

    private ?string $previousClientSecretsPath = null;
    private ?string $tempDir = null;

    protected function tearDown(): void
    {
        static::ensureKernelShutdown();

        if (null !== $this->previousClientSecretsPath && '' !== $this->previousClientSecretsPath) {
            putenv(sprintf('KIWI_CLIENT_SECRETS_PATH=%s', $this->previousClientSecretsPath));
        } else {
            putenv('KIWI_CLIENT_SECRETS_PATH');
        }

        if (null !== $this->tempDir && is_dir($this->tempDir)) {
            array_map('unlink', glob($this->tempDir.'/*') ?: []);
            rmdir($this->tempDir);
        }

        $this->previousClientSecretsPath = null;
        $this->tempDir = null;

        parent::tearDown();
    }

    public function testReadCustomersUsesSubscriptionApiAdapterWithScopedQueryParameters(): void
    {
        $this->useSubscriptionApiClientSecrets([
            'tvk' => [
                'title' => 'TV Krant',
                'username' => 'tvk-user',
                'password' => 'tvk-password',
                'client_search' => 'yes',
                'client' => 'HMC',
                'divisionid' => '14',
            ],
        ]);

        $requests = [];
        $responses = [
            $this->createTokenResponse('search-token'),
            $this->createSearchResponse([
                [
                    'personId' => '11860448',
                    'firstName' => 'Jane',
                    'name' => 'van Dijk',
                    'street' => 'Teststraat',
                    'houseNo' => '12',
                    'postCode' => '1217AA',
                    'city' => 'Hilversum',
                    'eMail' => ['jane@example.org'],
                    'phone' => ['0612345678'],
                    'divisionId' => '14',
                ],
            ]),
        ];

        $httpClient = $this->createMockHttpClient($requests, $responses);
        $client = $this->createAuthenticatedClient();
        static::getContainer()->set(
            AggregatedPersonSearchService::class,
            $this->createAggregatedPersonSearchService($httpClient),
        );

        $client->request(
            'GET',
            '/api/v1/persons?page=1&pageSize=10&sortBy=postal&name=Jane%20van%20Dijk&email=jane%40example.org&divisionIds=14&mandants=hmc'
        );

        self::assertResponseIsSuccessful();
        $payload = json_decode((string) $client->getResponse()->getContent(), true, flags: \JSON_THROW_ON_ERROR);

        self::assertSame(1, $payload['page']);
        self::assertSame(10, $payload['pageSize']);
        self::assertSame(1, $payload['total']);
        self::assertSame('11860448', $payload['items'][0]['personId']);
        self::assertSame('Jane', $payload['items'][0]['firstName']);
        self::assertSame('van', $payload['items'][0]['middleName']);
        self::assertSame('Dijk', $payload['items'][0]['lastName']);
        self::assertSame('tvk', $payload['items'][0]['credentialKey']);
        self::assertSame('HMC', $payload['items'][0]['mandant']);
        self::assertSame('14', $payload['items'][0]['divisionId']);
        self::assertSame('subscription-api', $payload['items'][0]['sourceSystem']);

        self::assertCount(2, $requests);
        self::assertSame('POST', $requests[0]['method']);
        self::assertSame('https://example.invalid/token', $requests[0]['url']);
        self::assertSame(
            'https://example.invalid/subscription/public/personsearch?page=0&pagesize=10&name=Jane+van+Dijk&email=jane%40example.org&divisionid=14',
            $requests[1]['url'],
        );
    }

    public function testReadCustomersReturnsServiceUnavailableWhenSubscriptionSearchFails(): void
    {
        $this->useSubscriptionApiClientSecrets([
            'tvk' => [
                'title' => 'TV Krant',
                'username' => 'tvk-user',
                'password' => 'tvk-password',
                'client_search' => 'yes',
                'client' => 'HMC',
                'divisionid' => '14',
            ],
        ]);

        $requests = [];
        $responses = [
            $this->createTokenResponse('search-token'),
            new MockResponse('upstream broken', ['http_code' => 500]),
        ];

        $httpClient = $this->createMockHttpClient($requests, $responses);
        $client = $this->createAuthenticatedClient();
        static::getContainer()->set(
            AggregatedPersonSearchService::class,
            $this->createAggregatedPersonSearchService($httpClient),
        );

        $client->request('GET', '/api/v1/persons?name=broken');

        self::assertResponseStatusCodeSame(503);
        $payload = json_decode((string) $client->getResponse()->getContent(), true, flags: \JSON_THROW_ON_ERROR);
        self::assertSame('customer_search_unavailable', $payload['error']['code']);
        self::assertCount(2, $requests);
    }

    public function testReadCustomerUsesSubscriptionApiDetailAdapterAndHydratesOrders(): void
    {
        $this->useSubscriptionApiClientSecrets([
            'tvk' => [
                'title' => 'TV Krant',
                'username' => 'tvk-user',
                'password' => 'tvk-password',
                'client_search' => 'yes',
                'client' => 'HMC',
                'divisionid' => '14',
            ],
        ]);

        $requests = [];
        $responses = [
            $this->createTokenResponse('detail-token'),
            new MockResponse((string) json_encode([
                'rId' => '11860448',
                'personNumber' => '41929371',
                'division' => ['rId' => '14'],
                'firstName' => 'Wiesje',
                'surName' => 'van',
                'lastName' => 'Meeringa',
                'initials' => 'W',
                'addressType' => ['name' => 'Mevrouw'],
                'contacts' => [
                    'addresses' => [
                        [
                            'address' => [
                                'street' => 'Dorpsstraat',
                                'postCode' => '1217AA',
                                'city' => 'Hilversum',
                                'housenumber' => [
                                    'housenumber' => '10',
                                ],
                            ],
                        ],
                    ],
                    'emails' => [
                        ['emailAddress' => 'wiesje@example.nl'],
                    ],
                    'phones' => [
                        ['number' => '0612345678'],
                    ],
                ],
                'payments' => [
                    'ibanItems' => [
                        [
                        'iban' => 'NL91ABNA0417164300',
                    ],
                    ],
                ],
                'references' => [
                    [
                        'origin' => 'PPA',
                        'identifier' => 'REF-11860448',
                    ],
                ],
            ], \JSON_THROW_ON_ERROR), ['http_code' => 200]),
            new MockResponse((string) json_encode([
                'content' => [
                    [
                        'rId' => '9001',
                        'orderNumber' => 'SO-9001',
                        'orderStartDate' => '2024-01-01',
                        'orderEndDate' => '2027-01-01',
                        'activeFrom' => '2024-01-01',
                        'activeTo' => '2027-01-01',
                        'division' => ['rId' => '14'],
                        'orderItem' => [
                            'product' => [
                                'name' => 'Mikrogids',
                            ],
                        ],
                    ],
                ],
                'pageNumber' => 0,
                'pageSize' => 500,
                'totalElements' => 1,
                'totalPages' => 1,
            ], \JSON_THROW_ON_ERROR), ['http_code' => 200]),
        ];

        $httpClient = $this->createMockHttpClient($requests, $responses);
        $client = $this->createAuthenticatedClient();
        static::getContainer()->set(
            PersonDetailService::class,
            $this->createPersonDetailService($httpClient),
        );

        $client->request('GET', '/api/v1/persons/11860448?credentialKey=tvk&sourceSystem=subscription-api');

        self::assertResponseIsSuccessful();
        $payload = json_decode((string) $client->getResponse()->getContent(), true, flags: \JSON_THROW_ON_ERROR);

        self::assertSame('11860448', $payload['personId']);
        self::assertSame('41929371', $payload['personNumber']);
        self::assertSame('Wiesje', $payload['firstName']);
        self::assertSame('van', $payload['middleName']);
        self::assertSame('Meeringa', $payload['lastName']);
        self::assertSame('Mevr.', $payload['salutation']);
        self::assertSame('1217AA', $payload['postalCode']);
        self::assertSame('10', $payload['houseNumber']);
        self::assertSame('Dorpsstraat 10', $payload['address']);
        self::assertSame('wiesje@example.nl', $payload['email']);
        self::assertSame('0612345678', $payload['phone']);
        self::assertSame('tvk', $payload['credentialKey']);
        self::assertSame('HMC', $payload['mandant']);
        self::assertSame('14', $payload['divisionId']);
        self::assertSame('subscription-api', $payload['sourceSystem']);
        self::assertSame('NL91ABNA0417164300', $payload['iban']);
        self::assertSame([['origin' => 'PPA', 'identifier' => 'REF-11860448']], $payload['references']);
        self::assertCount(1, $payload['subscriptions']);
        self::assertSame('SO-9001', $payload['subscriptions'][0]['orderNumber']);
        self::assertSame('Mikrogids', $payload['subscriptions'][0]['magazine']);

        self::assertCount(3, $requests);
        self::assertSame(
            'https://example.invalid/subscription/public/persons/11860448',
            $requests[1]['url'],
        );
        self::assertSame(
            'https://example.invalid/subscription/public/orders?page=0&pagesize=500&customerPersonId=11860448',
            $requests[2]['url'],
        );
    }

    /**
     * @dataProvider provideSubscriptionDetailFailureCases
     */
    public function testReadCustomerMapsSubscriptionDetailErrors(
        int $upstreamStatusCode,
        int $expectedStatusCode,
        string $expectedErrorCode,
    ): void {
        $this->useSubscriptionApiClientSecrets([
            'tvk' => [
                'title' => 'TV Krant',
                'username' => 'tvk-user',
                'password' => 'tvk-password',
                'client_search' => 'yes',
                'client' => 'HMC',
                'divisionid' => '14',
            ],
        ]);

        $requests = [];
        $responses = [
            $this->createTokenResponse('detail-token'),
            new MockResponse('[]', ['http_code' => $upstreamStatusCode]),
        ];

        $httpClient = $this->createMockHttpClient($requests, $responses);
        $client = $this->createAuthenticatedClient();
        static::getContainer()->set(
            PersonDetailService::class,
            $this->createPersonDetailService($httpClient),
        );

        $client->request('GET', '/api/v1/persons/11860448?credentialKey=tvk&sourceSystem=subscription-api');

        self::assertResponseStatusCodeSame($expectedStatusCode);
        $payload = json_decode((string) $client->getResponse()->getContent(), true, flags: \JSON_THROW_ON_ERROR);
        self::assertSame($expectedErrorCode, $payload['error']['code']);
    }

    /**
     * @return iterable<string, array{upstreamStatusCode:int, expectedStatusCode:int, expectedErrorCode:string}>
     */
    public static function provideSubscriptionDetailFailureCases(): iterable
    {
        yield 'not found' => [
            'upstreamStatusCode' => 404,
            'expectedStatusCode' => 404,
            'expectedErrorCode' => 'customer_not_found',
        ];

        yield 'invalid request' => [
            'upstreamStatusCode' => 400,
            'expectedStatusCode' => 400,
            'expectedErrorCode' => 'invalid_customer_lookup',
        ];

        yield 'upstream unavailable' => [
            'upstreamStatusCode' => 500,
            'expectedStatusCode' => 503,
            'expectedErrorCode' => 'customer_detail_unavailable',
        ];
    }

    /**
     * @param array<string, array<string, string>> $credentials
     */
    private function useSubscriptionApiClientSecrets(array $credentials): void
    {
        $this->previousClientSecretsPath = getenv('KIWI_CLIENT_SECRETS_PATH') ?: null;
        $this->tempDir = sys_get_temp_dir().'/kiwi-functional-customer-controller-'.bin2hex(random_bytes(4));
        mkdir($this->tempDir, 0777, true);

        $path = $this->tempDir.'/client_secrets.json';
        $payload = [
            'hup' => [
                'credentials' => $credentials,
                'hup_oidc_auth' => 'https://example.invalid/auth',
                'hup_oidc_token' => 'https://example.invalid/token',
                'webabo_base_url' => 'https://example.invalid/webabo-rest',
                'ppa_base_url' => 'https://example.invalid/subscription',
            ],
        ];

        file_put_contents($path, (string) json_encode($payload, \JSON_PRETTY_PRINT | \JSON_THROW_ON_ERROR));
        putenv(sprintf('KIWI_CLIENT_SECRETS_PATH=%s', $path));
    }

    /**
     * @param array<int, array{method:string, url:string, options:array<string, mixed>}> $requests
     * @param list<MockResponse> $responses
     */
    private function createMockHttpClient(array &$requests, array &$responses): MockHttpClient
    {
        return new MockHttpClient(function (string $method, string $url, array $options) use (&$requests, &$responses) {
            $requests[] = compact('method', 'url', 'options');

            if ([] === $responses) {
                throw new \RuntimeException(sprintf('Unexpected upstream request for "%s".', $url));
            }

            return array_shift($responses);
        });
    }

    private function createAggregatedPersonSearchService(MockHttpClient $httpClient): AggregatedPersonSearchService
    {
        $configProvider = new HupApiConfigProvider(new ClientSecretsLoader(dirname(__DIR__, 2)));
        $tokenProvider = new WebaboAccessTokenProvider($configProvider, $httpClient);
        $personSearchClient = new PersonSearchClient($configProvider, $tokenProvider, $httpClient);
        $multiCredentialSearchService = new MultiCredentialPersonSearchService($configProvider, $personSearchClient);

        return new AggregatedPersonSearchService(
            $configProvider,
            $multiCredentialSearchService,
            new PersonSearchResultNormalizer(),
        );
    }

    private function createPersonDetailService(MockHttpClient $httpClient): PersonDetailService
    {
        $configProvider = new HupApiConfigProvider(new ClientSecretsLoader(dirname(__DIR__, 2)));
        $tokenProvider = new WebaboAccessTokenProvider($configProvider, $httpClient);
        $personSearchClient = new PersonSearchClient($configProvider, $tokenProvider, $httpClient);

        return new PersonDetailService(
            $configProvider,
            $personSearchClient,
            new PersonSearchResultNormalizer(),
            new SubscriptionOrderNormalizer(),
        );
    }

    /**
     * @param list<array<string, mixed>> $content
     */
    private function createSearchResponse(array $content): MockResponse
    {
        return new MockResponse((string) json_encode([
            'content' => $content,
            'pageNumber' => 0,
            'pageSize' => count($content),
            'totalElements' => count($content),
            'totalPages' => 1,
        ], \JSON_THROW_ON_ERROR), ['http_code' => 200]);
    }

    private function createTokenResponse(string $accessToken): MockResponse
    {
        return new MockResponse((string) json_encode([
            'access_token' => $accessToken,
            'expires_in' => 3600,
        ], \JSON_THROW_ON_ERROR), ['http_code' => 200]);
    }
}
