<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Config\ClientSecretsLoader;
use App\Webabo\HupApiConfigProvider;
use App\Webabo\WebaboAccessTokenProvider;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class WebaboAccessTokenProviderTest extends TestCase
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

    public function testRefreshTokenFallsBackToPasswordGrant(): void
    {
        $clientSecretsPath = $this->writeClientSecretsFile([
            'refresh_token' => 'refresh-token-1',
            'username' => 'demo-user',
            'password' => 'demo-password',
        ]);
        $requests = [];
        $responses = [
            new MockResponse((string) json_encode(['error' => 'invalid_grant'], JSON_THROW_ON_ERROR), ['http_code' => 400]),
            new MockResponse((string) json_encode([
                'access_token' => 'password-token',
                'expires_in' => 3600,
                'refresh_token' => 'refresh-token-2',
            ], JSON_THROW_ON_ERROR), ['http_code' => 200]),
        ];
        $httpClient = new MockHttpClient(function (string $method, string $url, array $options) use (&$requests, &$responses) {
            $requests[] = compact('method', 'url', 'options');

            return array_shift($responses);
        });

        $provider = $this->createProvider($httpClient, dirname($clientSecretsPath));

        self::assertSame('password-token', $provider->getAccessToken());
        self::assertCount(2, $requests);
        $refreshBody = $this->parseRequestBody($requests[0]['options']['body']);
        $passwordBody = $this->parseRequestBody($requests[1]['options']['body']);

        self::assertSame('refresh_token', $refreshBody['grant_type'] ?? null);
        self::assertSame('password', $passwordBody['grant_type'] ?? null);
        self::assertSame('demo-user', $passwordBody['username'] ?? null);
        self::assertStringContainsString(
            sprintf('Basic %s', base64_encode('PPA:')),
            $requests[1]['options']['normalized_headers']['authorization'][0] ?? ''
        );
    }

    public function testSuccessfulPasswordGrantIsCachedInMemory(): void
    {
        $clientSecretsPath = $this->writeClientSecretsFile([
            'username' => 'demo-user',
            'password' => 'demo-password',
        ]);
        $requests = [];
        $httpClient = new MockHttpClient(function (string $method, string $url, array $options) use (&$requests) {
            $requests[] = compact('method', 'url', 'options');

            return new MockResponse((string) json_encode([
                'access_token' => 'cached-token',
                'expires_in' => 3600,
            ], JSON_THROW_ON_ERROR), ['http_code' => 200]);
        });

        $provider = $this->createProvider($httpClient, dirname($clientSecretsPath));

        self::assertSame('cached-token', $provider->getAccessToken());
        self::assertSame('cached-token', $provider->getAccessToken());
        self::assertCount(1, $requests);
        $body = $this->parseRequestBody($requests[0]['options']['body']);

        self::assertSame('password', $body['grant_type'] ?? null);
        self::assertStringContainsString(
            sprintf('Basic %s', base64_encode('PPA:')),
            $requests[0]['options']['normalized_headers']['authorization'][0] ?? ''
        );
    }

    public function testClientSecretPostAddsClientCredentialsToRequestBody(): void
    {
        $clientSecretsPath = $this->writeClientSecretsFile([
            'username' => 'demo-user',
            'password' => 'demo-password',
            'client_auth_method' => 'post',
            'client_id' => 'kiwi-webabo',
            'client_secret' => 'super-secret',
        ]);
        $requests = [];
        $httpClient = new MockHttpClient(function (string $method, string $url, array $options) use (&$requests) {
            $requests[] = compact('method', 'url', 'options');

            return new MockResponse((string) json_encode([
                'access_token' => 'post-token',
                'expires_in' => 3600,
            ], JSON_THROW_ON_ERROR), ['http_code' => 200]);
        });

        $provider = $this->createProvider($httpClient, dirname($clientSecretsPath));

        self::assertSame('post-token', $provider->getAccessToken());
        self::assertCount(1, $requests);
        $body = $this->parseRequestBody($requests[0]['options']['body']);

        self::assertSame('kiwi-webabo', $body['client_id'] ?? null);
        self::assertSame('super-secret', $body['client_secret'] ?? null);
        self::assertArrayNotHasKey('authorization', $requests[0]['options']['normalized_headers'] ?? []);
    }

    private function createProvider(MockHttpClient $httpClient, string $projectDir): WebaboAccessTokenProvider
    {
        return new WebaboAccessTokenProvider(
            new HupApiConfigProvider(new ClientSecretsLoader($projectDir)),
            $httpClient,
        );
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
     * @param array<string, string> $overrides
     */
    private function writeClientSecretsFile(array $overrides = []): string
    {
        $this->previousClientSecretsPath = getenv('KIWI_CLIENT_SECRETS_PATH') ?: null;
        $this->tempDir = sys_get_temp_dir().'/kiwi-webabo-'.bin2hex(random_bytes(4));
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
}
