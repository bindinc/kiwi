<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Config\ClientSecretsLoader;
use App\Webabo\HupApiConfigProvider;
use App\Webabo\WebaboAccessTokenProvider;
use App\Webabo\WebaboOfferClient;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class WebaboOfferClientTest extends TestCase
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

    public function testUnauthorizedOfferRequestRetriesWithFreshToken(): void
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
                    'offerId' => 12,
                    'orderChoiceKey' => 34,
                    'salesCode' => 'AVRV519',
                    'title' => '1 jaar Avrobode voor maar EUR52',
                    'offerPrice' => ['price' => 52.0, 'priceCode' => 'std'],
                ],
            ], JSON_THROW_ON_ERROR), ['http_code' => 200]),
        ];
        $httpClient = new MockHttpClient(function (string $method, string $url, array $options) use (&$requests, &$responses) {
            $requests[] = compact('method', 'url', 'options');

            return array_shift($responses);
        });

        $configProvider = new HupApiConfigProvider(new ClientSecretsLoader(dirname($clientSecretsPath)));
        $tokenProvider = new WebaboAccessTokenProvider($configProvider, $httpClient);
        $client = new WebaboOfferClient($configProvider, $tokenProvider, $httpClient);

        $offers = $client->fetchOffers();

        self::assertCount(1, $offers);
        self::assertSame('AVRV519', $offers[0]['salesCode']);
        self::assertSame('default', $offers[0]['credentialKey']);
        self::assertSame('webabo-api', $offers[0]['sourceSystem']);
        self::assertCount(4, $requests);
        $firstPasswordBody = $this->parseRequestBody($requests[0]['options']['body']);
        $secondPasswordBody = $this->parseRequestBody($requests[2]['options']['body']);

        self::assertSame('password', $firstPasswordBody['grant_type'] ?? null);
        self::assertSame('password', $secondPasswordBody['grant_type'] ?? null);
        self::assertSame('demo-user', $secondPasswordBody['username'] ?? null);
        self::assertStringContainsString(
            sprintf('Basic %s', base64_encode('PPA:')),
            $requests[0]['options']['normalized_headers']['authorization'][0] ?? ''
        );
        self::assertStringContainsString(
            'Bearer first-token',
            $requests[1]['options']['normalized_headers']['authorization'][0] ?? ''
        );
        self::assertStringContainsString(
            sprintf('Basic %s', base64_encode('PPA:')),
            $requests[2]['options']['normalized_headers']['authorization'][0] ?? ''
        );
        self::assertStringContainsString(
            'Bearer second-token',
            $requests[3]['options']['normalized_headers']['authorization'][0] ?? ''
        );
    }

    public function testFetchOffersLoopsOverAllConfiguredCredentials(): void
    {
        $clientSecretsPath = $this->writeClientSecretsFileWithNamedCredentials([
            'mkg' => [
                'title' => 'Mikrogids',
                'client' => 'KRONCRV',
                'client_search' => 'no',
                'username' => 'mkg-user',
                'password' => 'mkg-password',
            ],
            'tvz' => [
                'title' => 'Televizier',
                'client' => 'AVROTROS',
                'client_search' => 'yes',
                'username' => 'tvz-user',
                'password' => 'tvz-password',
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
                    'salesCode' => 'AVRV519',
                    'title' => 'Avrobode',
                ],
            ], JSON_THROW_ON_ERROR), ['http_code' => 200]),
            new MockResponse((string) json_encode([
                'access_token' => 'tvz-token',
                'expires_in' => 3600,
            ], JSON_THROW_ON_ERROR), ['http_code' => 200]),
            new MockResponse((string) json_encode([
                [
                    'salesCode' => 'TVZ100',
                    'title' => 'TVZ',
                ],
            ], JSON_THROW_ON_ERROR), ['http_code' => 200]),
        ];
        $httpClient = new MockHttpClient(function (string $method, string $url, array $options) use (&$requests, &$responses) {
            $requests[] = compact('method', 'url', 'options');

            return array_shift($responses);
        });

        $configProvider = new HupApiConfigProvider(new ClientSecretsLoader(dirname($clientSecretsPath)));
        $tokenProvider = new WebaboAccessTokenProvider($configProvider, $httpClient);
        $client = new WebaboOfferClient($configProvider, $tokenProvider, $httpClient);

        $offers = $client->fetchOffers();

        self::assertCount(2, $offers);
        self::assertSame(['AVRV519', 'TVZ100'], array_column($offers, 'salesCode'));
        self::assertSame(['mkg', 'tvz'], array_column($offers, 'credentialKey'));
        self::assertSame(['Mikrogids', 'Televizier'], array_column($offers, 'credentialTitle'));
        self::assertSame(['KRONCRV', 'AVROTROS'], array_column($offers, 'mandant'));
        self::assertSame([false, true], array_column($offers, 'supportsPersonLookup'));
        self::assertSame(['webabo-api', 'webabo-api'], array_column($offers, 'sourceSystem'));
        self::assertCount(4, $requests);

        $firstTokenBody = $this->parseRequestBody($requests[0]['options']['body']);
        $secondTokenBody = $this->parseRequestBody($requests[2]['options']['body']);

        self::assertSame('mkg-user', $firstTokenBody['username'] ?? null);
        self::assertSame('tvz-user', $secondTokenBody['username'] ?? null);
        self::assertStringContainsString(
            'Bearer mkg-token',
            $requests[1]['options']['normalized_headers']['authorization'][0] ?? ''
        );
        self::assertStringContainsString(
            'Bearer tvz-token',
            $requests[3]['options']['normalized_headers']['authorization'][0] ?? ''
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

    private function writeClientSecretsFile(): string
    {
        $this->previousClientSecretsPath = getenv('KIWI_CLIENT_SECRETS_PATH') ?: null;
        $this->tempDir = sys_get_temp_dir().'/kiwi-webabo-offers-'.bin2hex(random_bytes(4));
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
     * @param array<string, array<string, mixed>> $credentials
     */
    private function writeClientSecretsFileWithNamedCredentials(array $credentials): string
    {
        $this->previousClientSecretsPath = getenv('KIWI_CLIENT_SECRETS_PATH') ?: null;
        $this->tempDir = sys_get_temp_dir().'/kiwi-webabo-offers-'.bin2hex(random_bytes(4));
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
