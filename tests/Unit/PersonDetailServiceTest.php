<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Config\ClientSecretsLoader;
use App\SubscriptionApi\PersonDetailService;
use App\SubscriptionApi\PersonSearchClient;
use App\SubscriptionApi\PersonSearchResultNormalizer;
use App\SubscriptionApi\SubscriptionOrderNormalizer;
use App\Webabo\HupApiConfigProvider;
use App\Webabo\WebaboAccessTokenProvider;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class PersonDetailServiceTest extends TestCase
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

    public function testGetPersonHydratesSubscriptionsViaOrdersEndpoint(): void
    {
        $clientSecretsPath = $this->writeClientSecretsFile();
        $requests = [];
        $responses = [
            $this->createTokenResponse('detail-token'),
            new MockResponse((string) json_encode([
                'rId' => '11860448',
                'personNumber' => '41929371',
                'division' => ['rId' => '14'],
                'firstName' => 'Wiesje',
                'lastName' => 'Meeringa',
                'contacts' => [
                    'emails' => [
                        ['emailAddress' => 'wiesje@example.nl'],
                    ],
                ],
            ], JSON_THROW_ON_ERROR), ['http_code' => 200]),
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
            ], JSON_THROW_ON_ERROR), ['http_code' => 200]),
        ];
        $httpClient = new MockHttpClient(function (string $method, string $url, array $options) use (&$requests, &$responses) {
            $requests[] = compact('method', 'url', 'options');

            return array_shift($responses);
        });

        $service = $this->createService($httpClient, dirname($clientSecretsPath));

        $payload = $service->getPerson('11860448', 'tvk');

        self::assertSame('11860448', $payload['personId']);
        self::assertCount(1, $payload['subscriptions']);
        self::assertSame('Mikrogids', $payload['subscriptions'][0]['magazine']);
        self::assertSame('active', $payload['subscriptions'][0]['status']);
        self::assertSame(
            'https://example.invalid/subscription/public/orders?page=0&pagesize=500&customerPersonId=11860448',
            $requests[2]['url'],
        );
    }

    public function testGetPersonKeepsDetailAvailableWhenOrdersEndpointFails(): void
    {
        $clientSecretsPath = $this->writeClientSecretsFile();
        $responses = [
            $this->createTokenResponse('detail-token'),
            new MockResponse((string) json_encode([
                'rId' => '11860448',
                'personNumber' => '41929371',
                'division' => ['rId' => '14'],
                'firstName' => 'Wiesje',
                'lastName' => 'Meeringa',
            ], JSON_THROW_ON_ERROR), ['http_code' => 200]),
            new MockResponse('upstream broken', ['http_code' => 500]),
        ];
        $httpClient = new MockHttpClient(static function () use (&$responses) {
            return array_shift($responses);
        });

        $service = $this->createService($httpClient, dirname($clientSecretsPath));

        $payload = $service->getPerson('11860448', 'tvk');

        self::assertSame('11860448', $payload['personId']);
        self::assertSame([], $payload['subscriptions']);
        self::assertSame('subscription-api', $payload['sourceSystem']);
    }

    private function createService(MockHttpClient $httpClient, string $projectDir): PersonDetailService
    {
        $configProvider = new HupApiConfigProvider(new ClientSecretsLoader($projectDir));
        $tokenProvider = new WebaboAccessTokenProvider($configProvider, $httpClient);
        $personSearchClient = new PersonSearchClient($configProvider, $tokenProvider, $httpClient);

        return new PersonDetailService(
            $configProvider,
            $personSearchClient,
            new PersonSearchResultNormalizer(),
            new SubscriptionOrderNormalizer(),
        );
    }

    private function createTokenResponse(string $accessToken): MockResponse
    {
        return new MockResponse((string) json_encode([
            'access_token' => $accessToken,
            'expires_in' => 3600,
        ], JSON_THROW_ON_ERROR), ['http_code' => 200]);
    }

    private function writeClientSecretsFile(): string
    {
        $this->previousClientSecretsPath = getenv('KIWI_CLIENT_SECRETS_PATH') ?: null;
        $this->tempDir = sys_get_temp_dir().'/kiwi-person-detail-'.bin2hex(random_bytes(4));
        mkdir($this->tempDir, 0777, true);

        $path = $this->tempDir.'/client_secrets.json';
        $payload = [
            'hup' => [
                'credentials' => [
                    'tvk' => [
                        'title' => 'TV Krant',
                        'username' => 'tvk-user',
                        'password' => 'tvk-password',
                        'client_search' => 'yes',
                        'client' => 'HMC',
                    ],
                ],
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
