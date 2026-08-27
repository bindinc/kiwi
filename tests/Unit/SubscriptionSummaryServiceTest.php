<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Config\ClientSecretsLoader;
use App\SubscriptionApi\PersonSearchClient;
use App\SubscriptionApi\SubscriptionOrderNormalizer;
use App\SubscriptionApi\SubscriptionSummaryService;
use App\Webabo\HupApiConfigProvider;
use App\Webabo\WebaboAccessTokenProvider;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class SubscriptionSummaryServiceTest extends TestCase
{
    private ?string $previousClientSecretsPath = null;
    private ?string $tempDir = null;

    protected function tearDown(): void
    {
        if (null !== $this->previousClientSecretsPath) {
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

    public function testSummarizeReturnsActiveAndInactiveSubscriptionsWithoutFailingTheBatch(): void
    {
        $projectDir = $this->writeClientSecretsFile();
        $requests = [];
        $responses = [
            $this->jsonResponse(['access_token' => 'summary-token', 'expires_in' => 3600]),
            $this->jsonResponse([
                'content' => [
                    [
                        'rId' => 'order-active',
                        'activeTo' => '2099-01-01',
                        'orderItem' => ['product' => ['name' => 'Mikrogids']],
                    ],
                    [
                        'rId' => 'order-ended',
                        'activeTo' => '2020-01-01',
                        'orderItem' => ['product' => ['name' => 'NCRV-gids']],
                    ],
                ],
            ]),
            new MockResponse('upstream broken', ['http_code' => 500]),
        ];
        $httpClient = new MockHttpClient(function (string $method, string $url, array $options) use (&$requests, &$responses) {
            $requests[] = compact('method', 'url', 'options');

            return array_shift($responses);
        });

        $service = $this->createService($projectDir, $httpClient);
        $summaries = $service->summarize([
            ['personId' => '100', 'credentialKey' => 'tvk'],
            ['personId' => '200', 'credentialKey' => 'tvk'],
        ]);

        self::assertSame([
            'personId' => '100',
            'credentialKey' => 'tvk',
            'state' => 'loaded',
            'activeCount' => 1,
            'activeSubscriptions' => [['magazine' => 'Mikrogids']],
            'inactiveSubscription' => ['magazine' => 'NCRV-gids'],
        ], $summaries[0]);
        self::assertSame([
            'personId' => '200',
            'credentialKey' => 'tvk',
            'state' => 'unavailable',
            'activeCount' => null,
            'activeSubscriptions' => [],
            'inactiveSubscription' => null,
        ], $summaries[1]);
        self::assertSame(
            'https://example.invalid/subscription/public/orders?page=0&pagesize=500&customerPersonId=100',
            $requests[1]['url'],
        );
        self::assertSame(
            'https://example.invalid/subscription/public/orders?page=0&pagesize=500&customerPersonId=200',
            $requests[2]['url'],
        );
    }

    private function createService(string $projectDir, MockHttpClient $httpClient): SubscriptionSummaryService
    {
        $configProvider = new HupApiConfigProvider(new ClientSecretsLoader($projectDir));
        $tokenProvider = new WebaboAccessTokenProvider($configProvider, $httpClient);
        $personSearchClient = new PersonSearchClient($configProvider, $tokenProvider, $httpClient);

        return new SubscriptionSummaryService(
            $configProvider,
            $personSearchClient,
            new SubscriptionOrderNormalizer(),
        );
    }

    private function writeClientSecretsFile(): string
    {
        $this->previousClientSecretsPath = getenv('KIWI_CLIENT_SECRETS_PATH') ?: null;
        $this->tempDir = sys_get_temp_dir().'/kiwi-subscription-summary-'.bin2hex(random_bytes(4));
        mkdir($this->tempDir, 0777, true);

        $payload = [
            'hup' => [
                'credentials' => [
                    'tvk' => [
                        'title' => 'TV Krant',
                        'username' => 'tvk-user',
                        'password' => 'tvk-password',
                        'client_search' => 'yes',
                        'client' => 'HMC',
                        'divisionid' => '14',
                    ],
                ],
                'hup_oidc_auth' => 'https://example.invalid/auth',
                'hup_oidc_token' => 'https://example.invalid/token',
                'webabo_base_url' => 'https://example.invalid/webabo-rest',
                'ppa_base_url' => 'https://example.invalid/subscription',
            ],
        ];
        file_put_contents(
            $this->tempDir.'/client_secrets.json',
            (string) json_encode($payload, \JSON_PRETTY_PRINT | \JSON_THROW_ON_ERROR),
        );
        putenv(sprintf('KIWI_CLIENT_SECRETS_PATH=%s', $this->tempDir.'/client_secrets.json'));

        return $this->tempDir;
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function jsonResponse(array $payload): MockResponse
    {
        return new MockResponse((string) json_encode($payload, \JSON_THROW_ON_ERROR), ['http_code' => 200]);
    }
}
