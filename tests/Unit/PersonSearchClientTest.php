<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Config\ClientSecretsLoader;
use App\SubscriptionApi\PersonSearchClient;
use App\Webabo\HupApiConfigProvider;
use App\Webabo\WebaboAccessTokenProvider;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpClient\Exception\TransportException;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class PersonSearchClientTest extends TestCase
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

    public function testSearchUsesPpaBaseUrlAndBearerToken(): void
    {
        $clientSecretsPath = $this->writeClientSecretsFile([
            'username' => 'demo-user',
            'password' => 'demo-password',
            'ppa_base_url' => 'https://example.invalid/subscription',
        ]);
        $requests = [];
        $responses = [
            new MockResponse((string) json_encode([
                'access_token' => 'search-token',
                'expires_in' => 3600,
            ], JSON_THROW_ON_ERROR), ['http_code' => 200]),
            new MockResponse((string) json_encode([
                'content' => [
                    [
                        'personId' => '12345',
                        'firstName' => 'Jane',
                        'name' => 'Jane Doe',
                    ],
                ],
                'pageNumber' => 0,
                'pageSize' => 10,
                'totalElements' => 1,
                'totalPages' => 1,
            ], JSON_THROW_ON_ERROR), ['http_code' => 200]),
        ];
        $httpClient = new MockHttpClient(function (string $method, string $url, array $options) use (&$requests, &$responses) {
            $requests[] = compact('method', 'url', 'options');

            return array_shift($responses);
        });

        $client = $this->createClient($httpClient, dirname($clientSecretsPath));

        $payload = $client->search([
            'page' => 0,
            'pagesize' => 10,
            'name' => ' Jane Doe ',
            'email' => '',
        ]);

        self::assertSame('12345', $payload['content'][0]['personId'] ?? null);
        self::assertCount(2, $requests);
        self::assertSame(
            'https://example.invalid/subscription/public/personsearch?page=0&pagesize=10&name=Jane+Doe',
            $requests[1]['url'],
        );
        self::assertStringContainsString(
            'Bearer search-token',
            $requests[1]['options']['normalized_headers']['authorization'][0] ?? '',
        );
    }

    public function testSearchUsesRequestedNamedCredential(): void
    {
        $clientSecretsPath = $this->writeClientSecretsFileWithNamedCredentials([
            'mkg' => [
                'username' => 'mkg-user',
                'password' => 'mkg-password',
            ],
            'tvz' => [
                'username' => 'tvz-user',
                'password' => 'tvz-password',
            ],
        ]);
        $requests = [];
        $responses = [
            new MockResponse((string) json_encode([
                'access_token' => 'tvz-token',
                'expires_in' => 3600,
            ], JSON_THROW_ON_ERROR), ['http_code' => 200]),
            new MockResponse((string) json_encode([
                'content' => [],
                'pageNumber' => 0,
                'pageSize' => 10,
                'totalElements' => 0,
                'totalPages' => 0,
            ], JSON_THROW_ON_ERROR), ['http_code' => 200]),
        ];
        $httpClient = new MockHttpClient(function (string $method, string $url, array $options) use (&$requests, &$responses) {
            $requests[] = compact('method', 'url', 'options');

            return array_shift($responses);
        });

        $client = $this->createClient($httpClient, dirname($clientSecretsPath));

        $client->search(['name' => 'Jansen'], 'tvz');

        self::assertCount(2, $requests);
        $body = $this->parseRequestBody($requests[0]['options']['body']);

        self::assertSame('tvz-user', $body['username'] ?? null);
        self::assertStringContainsString(
            'Bearer tvz-token',
            $requests[1]['options']['normalized_headers']['authorization'][0] ?? '',
        );
    }

    public function testUnauthorizedSearchRetriesWithFreshToken(): void
    {
        $clientSecretsPath = $this->writeClientSecretsFile([
            'username' => 'demo-user',
            'password' => 'demo-password',
            'ppa_base_url' => 'https://example.invalid/subscription',
        ]);
        $requests = [];
        $responses = [
            new MockResponse((string) json_encode([
                'access_token' => 'first-token',
                'expires_in' => 3600,
            ], JSON_THROW_ON_ERROR), ['http_code' => 200]),
            new MockResponse('[]', ['http_code' => 401]),
            new MockResponse((string) json_encode([
                'access_token' => 'second-token',
                'expires_in' => 3600,
            ], JSON_THROW_ON_ERROR), ['http_code' => 200]),
            new MockResponse((string) json_encode([
                'content' => [],
                'pageNumber' => 0,
                'pageSize' => 10,
                'totalElements' => 0,
                'totalPages' => 0,
            ], JSON_THROW_ON_ERROR), ['http_code' => 200]),
        ];
        $httpClient = new MockHttpClient(function (string $method, string $url, array $options) use (&$requests, &$responses) {
            $requests[] = compact('method', 'url', 'options');

            return array_shift($responses);
        });

        $client = $this->createClient($httpClient, dirname($clientSecretsPath));

        $client->search(['name' => 'Doe']);

        self::assertCount(4, $requests);
        self::assertStringContainsString(
            'Bearer first-token',
            $requests[1]['options']['normalized_headers']['authorization'][0] ?? '',
        );
        self::assertStringContainsString(
            'Bearer second-token',
            $requests[3]['options']['normalized_headers']['authorization'][0] ?? '',
        );
    }

    public function testSearchFailsFastWhenPpaBaseUrlIsMissing(): void
    {
        $clientSecretsPath = $this->writeClientSecretsFile([
            'username' => 'demo-user',
            'password' => 'demo-password',
        ]);
        $httpClient = new MockHttpClient();
        $client = $this->createClient($httpClient, dirname($clientSecretsPath));

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('ppa_base_url ontbreekt');

        $client->search(['name' => 'Doe']);
    }

    public function testSearchWrapsTransportFailures(): void
    {
        $clientSecretsPath = $this->writeClientSecretsFile([
            'username' => 'demo-user',
            'password' => 'demo-password',
            'ppa_base_url' => 'https://example.invalid/subscription',
        ]);
        $requests = [];
        $responses = [
            new MockResponse((string) json_encode([
                'access_token' => 'search-token',
                'expires_in' => 3600,
            ], JSON_THROW_ON_ERROR), ['http_code' => 200]),
        ];
        $httpClient = new MockHttpClient(function (string $method, string $url, array $options) use (&$requests, &$responses) {
            $requests[] = compact('method', 'url', 'options');

            if ('GET' === $method) {
                throw new TransportException('connection timeout');
            }

            return array_shift($responses);
        });

        $client = $this->createClient($httpClient, dirname($clientSecretsPath));

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('transportfout');

        try {
            $client->search(['name' => 'Doe']);
        } finally {
            self::assertCount(2, $requests);
        }
    }

    private function createClient(MockHttpClient $httpClient, string $projectDir): PersonSearchClient
    {
        $configProvider = new HupApiConfigProvider(new ClientSecretsLoader($projectDir));
        $tokenProvider = new WebaboAccessTokenProvider($configProvider, $httpClient);

        return new PersonSearchClient($configProvider, $tokenProvider, $httpClient);
    }

    /**
     * @return array<string, string>
     */
    private function parseRequestBody(mixed $body): array
    {
        if (!\is_string($body)) {
            return [];
        }

        parse_str($body, $parsedBody);

        return \is_array($parsedBody) ? $parsedBody : [];
    }

    /**
     * @param array<string, mixed> $overrides
     */
    private function writeClientSecretsFile(array $overrides): string
    {
        $this->previousClientSecretsPath = getenv('KIWI_CLIENT_SECRETS_PATH') ?: null;
        $this->tempDir = sys_get_temp_dir().'/kiwi-personsearch-'.bin2hex(random_bytes(4));
        mkdir($this->tempDir, 0777, true);

        $path = $this->tempDir.'/client_secrets.json';
        $payload = [
            'hup' => array_merge([
                'hup_oidc_auth' => 'https://example.invalid/auth',
                'hup_oidc_token' => 'https://example.invalid/token',
                'webabo_base_url' => 'https://example.invalid/webabo-rest',
            ], $overrides),
        ];

        file_put_contents($path, (string) json_encode($payload, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));
        putenv(sprintf('KIWI_CLIENT_SECRETS_PATH=%s', $path));

        return $path;
    }

    /**
     * @param array<string, array<string, mixed>> $credentials
     */
    private function writeClientSecretsFileWithNamedCredentials(array $credentials): string
    {
        $this->previousClientSecretsPath = getenv('KIWI_CLIENT_SECRETS_PATH') ?: null;
        $this->tempDir = sys_get_temp_dir().'/kiwi-personsearch-'.bin2hex(random_bytes(4));
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
