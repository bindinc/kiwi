<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Config\ClientSecretsLoader;
use App\SubscriptionApi\AggregatedPersonSearchService;
use App\SubscriptionApi\MultiCredentialPersonSearchService;
use App\SubscriptionApi\PersonSearchClient;
use App\SubscriptionApi\PersonSearchResultNormalizer;
use App\Webabo\HupApiConfigProvider;
use App\Webabo\WebaboAccessTokenProvider;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class AggregatedPersonSearchServiceTest extends TestCase
{
    private ?string $previousClientSecretsPath = null;
    private ?string $tempDir = null;

    protected function tearDown(): void
    {
        if (null !== $this->previousClientSecretsPath && '' !== $this->previousClientSecretsPath) {
            putenv(sprintf('KIWI_CLIENT_SECRETS_PATH=%s', $this->previousClientSecretsPath));
        } else {
            putenv('KIWI_CLIENT_SECRETS_PATH');
        }

        if (null !== $this->tempDir && is_dir($this->tempDir)) {
            array_map('unlink', glob($this->tempDir.'/*') ?: []);
            rmdir($this->tempDir);
        }

        parent::tearDown();
    }

    public function testSearchAggregatesNormalizesSortsAndPaginatesResults(): void
    {
        $clientSecretsPath = $this->writeClientSecretsFile([
            'tvk' => [
                'title' => 'TV Krant',
                'username' => 'tvk-user',
                'password' => 'tvk-password',
                'client_search' => 'yes',
                'client' => 'HMC',
            ],
            'kroncrv' => [
                'title' => 'KRO-NCRV',
                'username' => 'kro-user',
                'password' => 'kro-password',
                'client_search' => 'yes',
                'client' => 'KRONCRV',
            ],
        ]);

        $requests = [];
        $responses = [
            $this->createTokenResponse('tvk-token'),
            $this->createSearchResponse([
                [
                    'personId' => '200',
                    'divisionId' => 'HMC',
                    'name' => 'de Vries',
                    'firstName' => 'Jan',
                    'street' => 'Damstraat',
                    'houseNo' => '42',
                    'city' => 'Amsterdam',
                    'postCode' => '1012AB',
                    'phone' => ['06-12345678'],
                    'geteMail' => ['jan@example.org'],
                ],
            ]),
            $this->createTokenResponse('kro-token'),
            $this->createSearchResponse([
                [
                    'personId' => '150',
                    'divisionId' => 'KRONCRV',
                    'name' => 'Bakker',
                    'firstName' => 'Piet',
                    'street' => 'Stationsweg',
                    'houseNo' => '10',
                    'city' => 'Hilversum',
                    'postCode' => '1217AA',
                    'phone' => ['035-1234567'],
                    'geteMail' => ['piet@example.org'],
                ],
            ]),
        ];

        $httpClient = new MockHttpClient(function (string $method, string $url, array $options) use (&$requests, &$responses) {
            $requests[] = compact('method', 'url', 'options');

            return array_shift($responses);
        });

        $service = $this->createService($httpClient, dirname($clientSecretsPath));

        $payload = $service->search([
            'postalCode' => '1217AA',
            'houseNumber' => '10',
            'name' => 'bakker',
            'phone' => '',
            'email' => '',
        ], 1, 20, 'name');

        self::assertSame(1, $payload['page']);
        self::assertSame(20, $payload['pageSize']);
        self::assertSame(1, $payload['total']);
        self::assertSame(['Bakker'], array_column($payload['items'], 'lastName'));
        self::assertSame([150], array_column($payload['items'], 'id'));
        self::assertSame(
            'https://example.invalid/subscription/public/personsearch?page=0&pagesize=20&postcode=1217AA&houseno=10&name=bakker',
            $requests[1]['url'],
        );
        self::assertSame(
            'https://example.invalid/subscription/public/personsearch?page=0&pagesize=20&postcode=1217AA&houseno=10&name=bakker',
            $requests[3]['url'],
        );
    }

    public function testSearchAppliesAdditionalFiltersStrictlyAfterUpstreamSearch(): void
    {
        $clientSecretsPath = $this->writeClientSecretsFile([
            'tvk' => [
                'title' => 'TV Krant',
                'username' => 'tvk-user',
                'password' => 'tvk-password',
                'client_search' => 'yes',
                'client' => 'HMC',
            ],
        ]);

        $responses = [
            $this->createTokenResponse('tvk-token'),
            $this->createSearchResponse([
                [
                    'personId' => '200',
                    'divisionId' => 'HMC',
                    'name' => 'deijkers',
                    'firstName' => 'Bart',
                    'street' => 'Teststraat',
                    'houseNo' => '80',
                    'city' => 'Hilversum',
                    'postCode' => '1217EW',
                    'phone' => ['035-1234567'],
                    'geteMail' => ['bart.deijkers@bindinc.nl'],
                ],
                [
                    'personId' => '201',
                    'divisionId' => 'HMC',
                    'name' => 'deijkers',
                    'firstName' => 'Bart',
                    'street' => 'Teststraat',
                    'houseNo' => '80',
                    'city' => 'Hilversum',
                    'postCode' => '1217EW',
                    'phone' => ['035-1234567'],
                    'geteMail' => ['ictservices@bindinc.nl'],
                ],
            ]),
        ];

        $httpClient = new MockHttpClient(static function () use (&$responses) {
            return array_shift($responses);
        });

        $service = $this->createService($httpClient, dirname($clientSecretsPath));

        $payload = $service->search([
            'postalCode' => '1217EW',
            'houseNumber' => '80',
            'name' => '',
            'phone' => '',
            'email' => 'bart.deijkers@bindinc.nl',
        ], 1, 20, 'name');

        self::assertSame(1, $payload['total']);
        self::assertSame([200], array_column($payload['items'], 'id'));
        self::assertSame(['bart.deijkers@bindinc.nl'], array_column($payload['items'], 'email'));
    }

    public function testSearchReturnsPartialResultsWhenOneCredentialFails(): void
    {
        $clientSecretsPath = $this->writeClientSecretsFile([
            'tvk' => [
                'title' => 'TV Krant',
                'username' => 'tvk-user',
                'password' => 'tvk-password',
                'client_search' => 'yes',
                'client' => 'HMC',
            ],
            'kroncrv' => [
                'title' => 'KRO-NCRV',
                'username' => 'kro-user',
                'password' => 'kro-password',
                'client_search' => 'yes',
                'client' => 'KRONCRV',
            ],
        ]);

        $responses = [
            $this->createTokenResponse('tvk-token'),
            new MockResponse('upstream broken', ['http_code' => 500]),
            $this->createTokenResponse('kro-token'),
            $this->createSearchResponse([
                [
                    'personId' => '150',
                    'divisionId' => '6',
                    'name' => 'Bakker',
                    'firstName' => 'Piet',
                    'street' => 'Stationsweg',
                    'houseNo' => '10',
                    'city' => 'Hilversum',
                    'postCode' => '1217AA',
                    'phone' => ['035-1234567'],
                    'geteMail' => ['piet@example.org'],
                ],
            ]),
        ];

        $httpClient = new MockHttpClient(static function () use (&$responses) {
            return array_shift($responses);
        });

        $service = $this->createService($httpClient, dirname($clientSecretsPath));

        $payload = $service->search([
            'name' => 'bakker',
        ], 1, 20, 'name');

        self::assertSame(1, $payload['total']);
        self::assertSame(['Bakker'], array_column($payload['items'], 'lastName'));
        self::assertSame(['KRONCRV'], array_column($payload['items'], 'mandant'));
        self::assertSame(['6'], array_column($payload['items'], 'divisionId'));
    }

    public function testIsAvailableReturnsFalseWhenSearchableCredentialsAreMissing(): void
    {
        $clientSecretsPath = $this->writeClientSecretsFile([
            'mkg' => [
                'title' => 'Mikrogids',
                'username' => 'mkg-user',
                'password' => 'mkg-password',
                'client_search' => 'no',
                'client' => 'KRONCRV',
            ],
        ]);

        $service = $this->createService(new MockHttpClient(), dirname($clientSecretsPath));

        self::assertFalse($service->isAvailable());
    }

    private function createService(MockHttpClient $httpClient, string $projectDir): AggregatedPersonSearchService
    {
        $configProvider = new HupApiConfigProvider(new ClientSecretsLoader($projectDir));
        $tokenProvider = new WebaboAccessTokenProvider($configProvider, $httpClient);
        $personSearchClient = new PersonSearchClient($configProvider, $tokenProvider, $httpClient);
        $multiCredentialSearchService = new MultiCredentialPersonSearchService($configProvider, $personSearchClient);
        $normalizer = new PersonSearchResultNormalizer();

        return new AggregatedPersonSearchService($configProvider, $multiCredentialSearchService, $normalizer);
    }

    private function createTokenResponse(string $accessToken): MockResponse
    {
        return new MockResponse((string) json_encode([
            'access_token' => $accessToken,
            'expires_in' => 3600,
        ], JSON_THROW_ON_ERROR), ['http_code' => 200]);
    }

    /**
     * @param list<array<string, mixed>> $content
     */
    private function createSearchResponse(array $content): MockResponse
    {
        return new MockResponse((string) json_encode([
            'content' => $content,
            'pageNumber' => 0,
            'pageSize' => 20,
            'totalElements' => count($content),
            'totalPages' => 1,
        ], JSON_THROW_ON_ERROR), ['http_code' => 200]);
    }

    /**
     * @param array<string, array<string, mixed>> $credentials
     */
    private function writeClientSecretsFile(array $credentials): string
    {
        $this->previousClientSecretsPath = getenv('KIWI_CLIENT_SECRETS_PATH') ?: null;
        $this->tempDir = sys_get_temp_dir().'/kiwi-aggregated-personsearch-'.bin2hex(random_bytes(4));
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

        file_put_contents($path, (string) json_encode($payload, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));
        putenv(sprintf('KIWI_CLIENT_SECRETS_PATH=%s', $path));

        return $path;
    }
}
