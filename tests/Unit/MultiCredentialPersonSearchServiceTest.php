<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Config\ClientSecretsLoader;
use App\SubscriptionApi\MultiCredentialPersonSearchService;
use App\SubscriptionApi\PersonSearchClient;
use App\Webabo\HupApiConfigProvider;
use App\Webabo\WebaboAccessTokenProvider;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class MultiCredentialPersonSearchServiceTest extends TestCase
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

    public function testSearchUsesConfiguredDivisionIdForEachSearchableCredential(): void
    {
        $clientSecretsPath = $this->writeClientSecretsFile([
            'mkg' => [
                'title' => 'Mikrogids',
                'username' => 'mkg-user',
                'password' => 'mkg-password',
                'client_search' => 'no',
                'client' => 'KRONCRV',
                'divisionid' => '6',
            ],
            'tvk' => [
                'title' => 'TV Krant',
                'username' => 'tvk-user',
                'password' => 'tvk-password',
                'client_search' => 'yes',
                'client' => 'HMC',
                'divisionid' => '14',
            ],
            'avrotros' => [
                'title' => 'AVROTROS',
                'username' => 'avrotros-user',
                'password' => 'avrotros-password',
                'client_search' => 'yes',
                'client' => 'AVROTROS',
                'divisionid' => '28',
            ],
        ]);

        $requests = [];
        $responses = [
            $this->createTokenResponse('tvk-token'),
            $this->createSearchResponse('tvk-person'),
            $this->createTokenResponse('avrotros-token'),
            $this->createSearchResponse('avrotros-person'),
        ];

        $httpClient = new MockHttpClient(function (string $method, string $url, array $options) use (&$requests, &$responses) {
            $requests[] = compact('method', 'url', 'options');

            return array_shift($responses);
        });

        $service = $this->createService($httpClient, dirname($clientSecretsPath));

        $results = $service->search([
            'page' => 0,
            'pagesize' => 10,
            'name' => 'Jane Doe',
            'divisionid' => 'WRONG-MANDANT',
        ]);

        self::assertCount(2, $results);
        self::assertSame(['tvk', 'avrotros'], array_map(
            static fn ($result): string => $result->credential->name,
            $results,
        ));
        self::assertSame('tvk-person', $results[0]->payload['content'][0]['personId'] ?? null);
        self::assertSame('avrotros-person', $results[1]->payload['content'][0]['personId'] ?? null);
        self::assertCount(4, $requests);
        self::assertSame(
            'https://example.invalid/subscription/public/personsearch?page=0&pagesize=10&name=Jane+Doe&divisionid=14',
            $requests[1]['url'],
        );
        self::assertSame(
            'https://example.invalid/subscription/public/personsearch?page=0&pagesize=10&name=Jane+Doe&divisionid=28',
            $requests[3]['url'],
        );
    }

    public function testSearchRestrictsCredentialFanOutToMatchingWerfsleutelScope(): void
    {
        $clientSecretsPath = $this->writeClientSecretsFile([
            'tvk' => [
                'title' => 'TV Krant',
                'username' => 'tvk-user',
                'password' => 'tvk-password',
                'client_search' => 'yes',
                'client' => 'HMC',
                'divisionid' => '14',
            ],
            'avrotros' => [
                'title' => 'AVROTROS',
                'username' => 'avrotros-user',
                'password' => 'avrotros-password',
                'client_search' => 'yes',
                'client' => 'AVROTROS',
                'divisionid' => '28',
            ],
        ]);

        $requests = [];
        $responses = [
            $this->createTokenResponse('tvk-token'),
            $this->createSearchResponse('tvk-person'),
        ];

        $httpClient = new MockHttpClient(function (string $method, string $url, array $options) use (&$requests, &$responses) {
            $requests[] = compact('method', 'url', 'options');

            return array_shift($responses);
        });

        $service = $this->createService($httpClient, dirname($clientSecretsPath));

        $results = $service->search(
            ['name' => 'Jane Doe'],
            ['14'],
            ['HMC'],
        );

        self::assertCount(1, $results);
        self::assertSame('tvk', $results[0]->credential->name);
        self::assertCount(2, $requests);
        self::assertSame(
            'https://example.invalid/subscription/public/personsearch?name=Jane+Doe&divisionid=14',
            $requests[1]['url'],
        );
    }

    public function testSearchReturnsEmptyArrayWhenNoCredentialSupportsPersonLookup(): void
    {
        $clientSecretsPath = $this->writeClientSecretsFile([
            'mkg' => [
                'username' => 'mkg-user',
                'password' => 'mkg-password',
                'client_search' => 'no',
                'client' => 'KRONCRV',
                'divisionid' => '6',
            ],
            'tvz' => [
                'username' => 'tvz-user',
                'password' => 'tvz-password',
                'client_search' => 'false',
                'client' => 'AVROTROS',
                'divisionid' => '28',
            ],
        ]);

        $requests = [];
        $httpClient = new MockHttpClient(function (string $method, string $url, array $options) use (&$requests) {
            $requests[] = compact('method', 'url', 'options');

            return new MockResponse('unexpected call', ['http_code' => 500]);
        });

        $service = $this->createService($httpClient, dirname($clientSecretsPath));

        $results = $service->search([
            'name' => 'Jane Doe',
        ]);

        self::assertSame([], $results);
        self::assertSame([], $requests);
    }

    public function testSearchSkipsFailingCredentialsWhenOthersStillRespond(): void
    {
        $clientSecretsPath = $this->writeClientSecretsFile([
            'tvk' => [
                'title' => 'TV Krant',
                'username' => 'tvk-user',
                'password' => 'tvk-password',
                'client_search' => 'yes',
                'client' => 'HMC',
                'divisionid' => '14',
            ],
            'avrotros' => [
                'title' => 'AVROTROS',
                'username' => 'avrotros-user',
                'password' => 'avrotros-password',
                'client_search' => 'yes',
                'client' => 'AVROTROS',
                'divisionid' => '28',
            ],
        ]);

        $responses = [
            $this->createTokenResponse('tvk-token'),
            new MockResponse('upstream broken', ['http_code' => 500]),
            $this->createTokenResponse('avrotros-token'),
            $this->createSearchResponse('avrotros-person'),
        ];

        $httpClient = new MockHttpClient(static function () use (&$responses) {
            return array_shift($responses);
        });

        $service = $this->createService($httpClient, dirname($clientSecretsPath));

        $results = $service->search([
            'name' => 'Jane Doe',
        ]);

        self::assertCount(1, $results);
        self::assertSame('avrotros', $results[0]->credential->name);
        self::assertSame('avrotros-person', $results[0]->payload['content'][0]['personId'] ?? null);
    }

    public function testSearchThrowsWhenAllSearchableCredentialsFail(): void
    {
        $clientSecretsPath = $this->writeClientSecretsFile([
            'tvk' => [
                'title' => 'TV Krant',
                'username' => 'tvk-user',
                'password' => 'tvk-password',
                'client_search' => 'yes',
                'client' => 'HMC',
                'divisionid' => '14',
            ],
            'avrotros' => [
                'title' => 'AVROTROS',
                'username' => 'avrotros-user',
                'password' => 'avrotros-password',
                'client_search' => 'yes',
                'client' => 'AVROTROS',
                'divisionid' => '28',
            ],
        ]);

        $responses = [
            $this->createTokenResponse('tvk-token'),
            new MockResponse('upstream broken', ['http_code' => 500]),
            $this->createTokenResponse('avrotros-token'),
            new MockResponse('still broken', ['http_code' => 500]),
        ];

        $httpClient = new MockHttpClient(static function () use (&$responses) {
            return array_shift($responses);
        });

        $service = $this->createService($httpClient, dirname($clientSecretsPath));

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Subscription API personsearch mislukte voor alle zoekbare credentials');

        $service->search([
            'name' => 'Jane Doe',
        ]);
    }

    private function createService(MockHttpClient $httpClient, string $projectDir): MultiCredentialPersonSearchService
    {
        $configProvider = new HupApiConfigProvider(new ClientSecretsLoader($projectDir));
        $tokenProvider = new WebaboAccessTokenProvider($configProvider, $httpClient);
        $personSearchClient = new PersonSearchClient($configProvider, $tokenProvider, $httpClient);

        return new MultiCredentialPersonSearchService($configProvider, $personSearchClient);
    }

    private function createTokenResponse(string $accessToken): MockResponse
    {
        return new MockResponse((string) json_encode([
            'access_token' => $accessToken,
            'expires_in' => 3600,
        ], JSON_THROW_ON_ERROR), ['http_code' => 200]);
    }

    private function createSearchResponse(string $personId): MockResponse
    {
        return new MockResponse((string) json_encode([
            'content' => [
                [
                    'personId' => $personId,
                ],
            ],
            'pageNumber' => 0,
            'pageSize' => 10,
            'totalElements' => 1,
            'totalPages' => 1,
        ], JSON_THROW_ON_ERROR), ['http_code' => 200]);
    }

    /**
     * @param array<string, array<string, mixed>> $credentials
     */
    private function writeClientSecretsFile(array $credentials): string
    {
        $this->previousClientSecretsPath = getenv('KIWI_CLIENT_SECRETS_PATH') ?: null;
        $this->tempDir = sys_get_temp_dir().'/kiwi-personsearch-fanout-'.bin2hex(random_bytes(4));
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
