<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Config\ClientSecretsLoader;
use App\Webabo\HupApiConfigProvider;
use App\Webabo\WebaboAccessTokenProvider;
use App\Webabo\WebaboSalesCodeCombinationClient;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class WebaboSalesCodeCombinationClientTest extends TestCase
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

    public function testUnauthorizedCombinationRequestRetriesWithFreshToken(): void
    {
        $clientSecretsPath = $this->writeClientSecretsFile();
        $requests = [];
        $responses = [
            new MockResponse((string) json_encode([
                'access_token' => 'first-token',
                'expires_in' => 3600,
                'refresh_token' => 'refresh-token-1',
            ], JSON_THROW_ON_ERROR), ['http_code' => 200]),
            new MockResponse('[]', ['http_code' => 401]),
            new MockResponse((string) json_encode([
                'access_token' => 'second-token',
                'expires_in' => 3600,
                'refresh_token' => 'refresh-token-2',
            ], JSON_THROW_ON_ERROR), ['http_code' => 200]),
            new MockResponse((string) json_encode([
                [
                    'salesCode' => 'MKGV452',
                    'salesChannel1' => 'OL',
                    'salesChannel2' => 'IS',
                    'salesChannel3' => 'MI',
                ],
            ], JSON_THROW_ON_ERROR), ['http_code' => 200]),
        ];
        $httpClient = new MockHttpClient(function (string $method, string $url, array $options) use (&$requests, &$responses) {
            $requests[] = compact('method', 'url', 'options');

            return array_shift($responses);
        });

        $configProvider = new HupApiConfigProvider(new ClientSecretsLoader(dirname($clientSecretsPath)));
        $tokenProvider = new WebaboAccessTokenProvider($configProvider, $httpClient);
        $client = new WebaboSalesCodeCombinationClient($configProvider, $tokenProvider, $httpClient);

        $items = $client->fetchCombinations('default', 'MKG', new \DateTimeImmutable('2026-03-25T00:00:00+00:00'));

        self::assertCount(1, $items);
        self::assertSame('MKGV452', $items[0]['salesCode']);
        self::assertCount(4, $requests);

        $firstPasswordBody = [];
        parse_str((string) ($requests[0]['options']['body'] ?? ''), $firstPasswordBody);
        $secondPasswordBody = [];
        parse_str((string) ($requests[2]['options']['body'] ?? ''), $secondPasswordBody);

        self::assertSame('password', $firstPasswordBody['grant_type'] ?? null);
        self::assertSame('password', $secondPasswordBody['grant_type'] ?? null);
        self::assertSame('demo-user', $secondPasswordBody['username'] ?? null);
        self::assertStringContainsString(
            'productCode=MKG',
            $requests[1]['url'] ?? ''
        );
        self::assertStringContainsString(
            'refDate=2026-03-25',
            $requests[1]['url'] ?? ''
        );
        self::assertStringContainsString(
            'Bearer first-token',
            $requests[1]['options']['normalized_headers']['authorization'][0] ?? ''
        );
        self::assertStringContainsString(
            'Bearer second-token',
            $requests[3]['options']['normalized_headers']['authorization'][0] ?? ''
        );
    }

    public function testFetchCombinationsUsesNamedCredentialToken(): void
    {
        $clientSecretsPath = $this->writeClientSecretsFileWithNamedCredentials([
            'mkg' => [
                'username' => 'mkg-user',
                'password' => 'mkg-password',
            ],
        ]);
        $requests = [];
        $responses = [
            new MockResponse((string) json_encode([
                'access_token' => 'mkg-token',
                'expires_in' => 3600,
            ], JSON_THROW_ON_ERROR), ['http_code' => 200]),
            new MockResponse((string) json_encode([
                [
                    'salesCode' => 'MKGV452',
                    'salesChannel1' => 'PR',
                    'salesChannel2' => 'ET',
                    'salesChannel3' => 'LV',
                ],
            ], JSON_THROW_ON_ERROR), ['http_code' => 200]),
        ];
        $httpClient = new MockHttpClient(function (string $method, string $url, array $options) use (&$requests, &$responses) {
            $requests[] = compact('method', 'url', 'options');

            return array_shift($responses);
        });

        $configProvider = new HupApiConfigProvider(new ClientSecretsLoader(dirname($clientSecretsPath)));
        $tokenProvider = new WebaboAccessTokenProvider($configProvider, $httpClient);
        $client = new WebaboSalesCodeCombinationClient($configProvider, $tokenProvider, $httpClient);

        $items = $client->fetchCombinations('mkg', 'MKG', new \DateTimeImmutable('2026-03-25T00:00:00+00:00'));

        self::assertCount(1, $items);
        self::assertSame('MKGV452', $items[0]['salesCode']);
        self::assertCount(2, $requests);

        parse_str((string) ($requests[0]['options']['body'] ?? ''), $tokenBody);
        self::assertSame('mkg-user', $tokenBody['username'] ?? null);
        self::assertStringContainsString(
            'Bearer mkg-token',
            $requests[1]['options']['normalized_headers']['authorization'][0] ?? ''
        );
    }

    private function writeClientSecretsFile(): string
    {
        $this->previousClientSecretsPath = getenv('KIWI_CLIENT_SECRETS_PATH') ?: null;
        $this->tempDir = sys_get_temp_dir().'/kiwi-webabo-combinations-'.bin2hex(random_bytes(4));
        mkdir($this->tempDir, 0777, true);

        $path = $this->tempDir.'/client_secrets.json';
        $payload = [
            'hup' => [
                'username' => 'demo-user',
                'password' => 'demo-password',
                'hup_oidc_auth' => 'https://example.invalid/auth',
                'hup_oidc_token' => 'https://example.invalid/token',
                'webabo_base_url' => 'https://example.invalid/webabo-rest',
            ],
        ];

        file_put_contents($path, (string) json_encode($payload, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));
        putenv(sprintf('KIWI_CLIENT_SECRETS_PATH=%s', $path));

        return $path;
    }

    /**
     * @param array<string, array<string, string>> $credentials
     */
    private function writeClientSecretsFileWithNamedCredentials(array $credentials): string
    {
        $this->previousClientSecretsPath = getenv('KIWI_CLIENT_SECRETS_PATH') ?: null;
        $this->tempDir = sys_get_temp_dir().'/kiwi-webabo-combinations-'.bin2hex(random_bytes(4));
        mkdir($this->tempDir, 0777, true);

        $path = $this->tempDir.'/client_secrets.json';
        $payload = [
            'hup' => [
                'credentials' => $credentials,
                'hup_oidc_auth' => 'https://example.invalid/auth',
                'hup_oidc_token' => 'https://example.invalid/token',
                'webabo_base_url' => 'https://example.invalid/webabo-rest',
            ],
        ];

        file_put_contents($path, (string) json_encode($payload, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));
        putenv(sprintf('KIWI_CLIENT_SECRETS_PATH=%s', $path));

        return $path;
    }
}
