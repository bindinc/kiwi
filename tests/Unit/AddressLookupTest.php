<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Address\{AddressLookupService, AddressQuery, AddressSessionStore, PostnlAddressClient, WebaboAddressClient};
use App\Config\ClientSecretsLoader;
use App\Http\ApiProblemException;
use App\Webabo\{HupApiConfigProvider, WebaboAccessTokenProvider};
use PHPUnit\Framework\TestCase;
use Psr\Log\AbstractLogger;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;
use Symfony\Component\HttpFoundation\Session\Session;
use Symfony\Component\HttpFoundation\Session\Storage\MockArraySessionStorage;

final class AddressLookupTest extends TestCase
{
    private const UUID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
    private string $directory;
    private string|false $previousConfig;
    private array $requests = [];
    private array $logs = [];

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir().'/kiwi-address-test-'.bin2hex(random_bytes(6));
        mkdir($this->directory);
        $this->previousConfig = getenv('KIWI_CLIENT_SECRETS_PATH');
        putenv('KIWI_CLIENT_SECRETS_PATH='.$this->directory.'/fixture.json');
        file_put_contents($this->directory.'/fixture.json', json_encode([
            'postnl' => ['api_key' => '<api-key>'],
            'hup' => [
                'webabo_base_url' => 'https://webabo.invalid', 'hup_oidc_token' => 'https://identity.invalid/token',
                'credentials' => [
                    'first' => ['username' => 'test-one', 'password' => '<password>', 'client_search' => false],
                    'second' => ['username' => 'test-two', 'password' => '<password>'],
                ],
            ],
        ], JSON_THROW_ON_ERROR));
    }

    protected function tearDown(): void
    {
        putenv(false === $this->previousConfig ? 'KIWI_CLIENT_SECRETS_PATH' : 'KIWI_CLIENT_SECRETS_PATH='.$this->previousConfig);
        unlink($this->directory.'/fixture.json');
        rmdir($this->directory);
    }

    private function query(string $number = '1', string $addition = ''): AddressQuery
    {
        return AddressQuery::fromPayload(['postalCode' => '1231 aa', 'houseNumber' => $number, 'houseNumberAddition' => $addition]);
    }

    private function address(string $street = 'Rembrandtlaan', string $number = '1', string $addition = ''): array
    {
        return ['postalCode' => '1231AA', 'houseNumber' => $number, 'addition' => $addition, 'street' => $street, 'city' => 'Loosdrecht'];
    }

    private function response(mixed $body, int $status = 200): MockResponse
    {
        return new MockResponse(json_encode($body, JSON_THROW_ON_ERROR), ['http_code' => $status]);
    }

    private function postnlAddress(): array
    {
        return ['postalCode' => '1231AA', 'houseNumber' => 1, 'houseNumberAddition' => '', 'streetName' => 'Rembrandtlaan', 'cityName' => 'Loosdrecht'];
    }

    private function service(array $responses): AddressLookupService
    {
        $http = new MockHttpClient(function ($method, $url, $options) use (&$responses) {
            $this->requests[] = compact('method', 'url', 'options');
            self::assertGreaterThan(0, $options['max_duration']);
            self::assertLessThanOrEqual(3, $options['max_duration']);
            self::assertSame(0, $options['max_redirects']);
            self::assertNotEmpty($responses, 'Unexpected extra provider request');
            return array_shift($responses);
        });
        $loader = new ClientSecretsLoader($this->directory);
        $config = new HupApiConfigProvider($loader);
        $logger = new class($this->logs) extends AbstractLogger {
            public function __construct(private array &$entries) {}
            public function log($level, string|\Stringable $message, array $context = []): void { $this->entries[] = $context; }
        };

        return new AddressLookupService(new PostnlAddressClient($loader, $http), new WebaboAddressClient($config, new WebaboAccessTokenProvider($config, $http), $http), new AddressSessionStore(), $logger);
    }

    public function testNormalizationAndExactMatching(): void
    {
        $query = $this->query('1a', 'A-2');
        self::assertSame('A-2', $query->addition);
        self::assertSame('1231AA', $query->postalCode);
        self::assertSame('A 2', $this->query('1a', '2')->addition);
        self::assertSame('not_found', AddressLookupService::match($query, [$this->address('Wrong', '11', 'A-2')])['status']);
        self::assertSame('not_found', AddressLookupService::match($query, [$this->address('Wrong', '1', 'B')])['status']);
        self::assertSame('matched', AddressLookupService::match($query, [$this->address('Right', '1', 'A 2')])['status']);
        self::assertSame('ambiguous', AddressLookupService::match($this->query(), [$this->address('One'), $this->address('Two')])['status']);
        self::assertSame('matched', AddressLookupService::match($this->query(), [$this->address('Same', '1', 'A'), $this->address('Same', '1', 'B')])['status']);
    }

    public function testUuidIsReusedAndSearchContractIsPrivate(): void
    {
        $service = $this->service([$this->response(['uuid' => self::UUID]), $this->response([$this->postnlAddress()]), $this->response([$this->postnlAddress()])]);
        $session = new Session(new MockArraySessionStorage());
        $first = $service->search($this->query(), self::UUID, $session);
        self::assertSame($first, $service->search($this->query(), self::UUID, $session));
        self::assertSame(['status' => 'matched', 'address' => ['street' => 'Rembrandtlaan', 'city' => 'Loosdrecht']], $first);
        self::assertCount(3, $this->requests);
        self::assertStringContainsString('/token?countryIso=NL', $this->requests[0]['url']);
        self::assertStringContainsString('uuid='.self::UUID, $this->requests[1]['url']);
        self::assertStringNotContainsString('api-key', $this->requests[1]['url']);
        self::assertSame(['apikey: <api-key>'], $this->requests[1]['options']['normalized_headers']['apikey']);
        self::assertSame(['provider', 'outcome', 'duration_ms'], array_keys($this->logs[0]));
    }

    public function testFallbackRefreshesAndTriesAnyCredential(): void
    {
        $service = $this->service([
            $this->response([], 503),
            $this->response(['access_token' => '<token>']), $this->response([], 401),
            $this->response(['access_token' => '<token>']), $this->response([], 403),
            $this->response(['access_token' => '<token>']),
            $this->response([['zipcode' => '1231AA', 'houseNo' => '1A 2', 'streetName' => 'Rembrandtlaan', 'city' => 'Loosdrecht']]),
        ]);
        $result = $service->search($this->query('1A', '2'), self::UUID, new Session(new MockArraySessionStorage()));
        self::assertSame('matched', $result['status']);
        self::assertCount(7, $this->requests);
        self::assertSame('https://webabo.invalid/addresses/search?limit=20', $this->requests[6]['url']);
        self::assertSame(['zipcode' => '1231AA', 'houseNo' => '1 A 2'], json_decode($this->requests[6]['options']['body'], true));
        self::assertStringContainsString('test-two', $this->requests[5]['options']['body']);
    }

    /** @dataProvider webaboCompletionCases */
    public function testWebaboStreetCompletion(array $candidates, string $addition, string $expected): void
    {
        $service = $this->service([
            $this->response([], 503),
            $this->response(['access_token' => '<token>']),
            $this->response($candidates),
        ]);
        $result = $service->search($this->query('1', $addition), self::UUID, new Session(new MockArraySessionStorage()));
        self::assertSame($expected, $result['status']);
        if ('matched' === $expected) {
            self::assertSame(['street' => 'Rembrandtlaan', 'city' => 'Loosdrecht'], $result['address']);
        }
        self::assertCount(3, $this->requests);
        self::assertSame(['zipcode' => '1231AA', 'houseNo' => trim('1 '.$addition)], json_decode($this->requests[2]['options']['body'], true));
    }

    public static function webaboCompletionCases(): iterable
    {
        $address = ['zipcode' => '1231 AA', 'streetName' => 'Rembrandtlaan', 'city' => 'Loosdrecht'];
        yield 'number omitted' => [[$address], '', 'matched'];
        yield 'input addition retained' => [[$address], 'A 2', 'matched'];
        yield 'duplicate streets agree' => [[$address, $address], '', 'matched'];
        yield 'conflicting streets' => [[$address, array_replace($address, ['streetName' => 'Other'])], '', 'ambiguous'];
        yield 'conflicting cities' => [[$address, array_replace($address, ['city' => 'Other'])], '', 'ambiguous'];
        yield 'wrong postcode' => [[array_replace($address, ['zipcode' => '9999ZZ'])], '', 'not_found'];
        yield 'explicit number matches' => [[$address + ['houseNo' => '1']], '', 'matched'];
        yield 'explicit number differs' => [[$address + ['houseNo' => '2']], '', 'not_found'];
        yield 'explicit addition matches' => [[$address + ['houseNo' => '1A 2']], 'A 2', 'matched'];
        yield 'explicit addition differs' => [[$address + ['houseNo' => '1B']], 'A', 'not_found'];
        yield 'empty response' => [[], '', 'not_found'];
        yield 'truncated page' => [array_fill(0, 20, $address), '', 'unavailable'];
        yield 'malformed number' => [[$address + ['houseNo' => 'invalid']], '', 'unavailable'];
        yield 'null number' => [[$address + ['houseNo' => null]], '', 'unavailable'];
        yield 'empty number' => [[$address + ['houseNo' => '']], '', 'unavailable'];
        yield 'missing street' => [[['zipcode' => '1231AA', 'city' => 'Loosdrecht']], '', 'unavailable'];
    }

    public function testPostnlStillRequiresHouseNumber(): void
    {
        $candidate = $this->address();
        $candidate['houseNumber'] = null;
        self::assertSame(['status' => 'not_found'], AddressLookupService::match($this->query(), [$candidate]));
    }

    public function testEmptyResultsDoNotFallBack(): void
    {
        $service = $this->service([$this->response(['uuid' => self::UUID]), $this->response([])]);
        self::assertSame(['status' => 'not_found'], $service->search($this->query(), self::UUID, new Session(new MockArraySessionStorage())));
        self::assertCount(2, $this->requests);
    }

    public function testBadRequestDoesNotFallBack(): void
    {
        $service = $this->service([$this->response([], 400)]);
        self::assertSame(['status' => 'unavailable'], $service->search($this->query(), self::UUID, new Session(new MockArraySessionStorage())));
        self::assertSame('integration_error', $this->logs[0]['outcome']);
    }

    public function testMalformedResponseFallsBackAndTotalFailureIsSafe(): void
    {
        $service = $this->service([$this->response(['uuid' => self::UUID]), $this->response([['streetName' => 'Incomplete']]), $this->response(['access_token' => '<token>']), $this->response([], 500)]);
        self::assertSame(['status' => 'unavailable'], $service->search($this->query(), self::UUID, new Session(new MockArraySessionStorage())));
        self::assertCount(4, $this->requests);
    }

    public function testSessionIsolationExpiryAndClosureAcrossInstances(): void
    {
        $session = new Session(new MockArraySessionStorage());
        $first = new AddressSessionStore();
        $second = new AddressSessionStore();
        $time = strtotime('2026-09-17 10:00:00 UTC');
        $tokens = 0;
        $mint = static function () use (&$tokens) { return 'token-'.++$tokens; };
        self::assertSame('token-1', $first->uuid($session, 'one', $mint, $time));
        self::assertSame('token-1', $second->uuid($session, 'one', $mint, $time + 10));
        self::assertSame('token-2', $second->uuid($session, 'two', $mint, $time));
        self::assertSame('token-3', $first->uuid($session, 'one', $mint, $time + 43200));
        self::assertSame('token-4', $first->uuid($session, 'one', $mint, $time + 50400));
        $first->close($session, 'two');
        $this->expectException(ApiProblemException::class);
        $second->uuid($session, 'two', $mint);
    }

    public function testMissingKeyUsesWebaboWithoutTokenCall(): void
    {
        $config = json_decode(file_get_contents($this->directory.'/fixture.json'), true);
        unset($config['postnl']);
        file_put_contents($this->directory.'/fixture.json', json_encode($config));
        $service = $this->service([$this->response(['access_token' => '<token>']), $this->response([])]);
        self::assertSame(['status' => 'not_found'], $service->search($this->query(), self::UUID, new Session(new MockArraySessionStorage())));
        self::assertCount(2, $this->requests);
    }
    /** @dataProvider fallbackStatuses */
    public function testProviderErrorsPermitFallback(int $status): void
    {
        $service = $this->service([$this->response([], $status), $this->response(['access_token' => '<token>']), $this->response([])]);
        self::assertSame(['status' => 'not_found'], $service->search($this->query(), self::UUID, new Session(new MockArraySessionStorage())));
        self::assertCount(3, $this->requests);
    }

    public static function fallbackStatuses(): array
    {
        return [[401], [403], [429], [500], [502]];
    }

    public function testTransportFailureDuringLazyResponsePermitsFallback(): void
    {
        $body = static function (): \Generator {
            throw new \Symfony\Component\HttpClient\Exception\TransportException('Simulated connection failure');
            yield '';
        };
        $service = $this->service([new MockResponse($body()), $this->response(['access_token' => '<token>']), $this->response([])]);
        self::assertSame(['status' => 'not_found'], $service->search($this->query(), self::UUID, new Session(new MockArraySessionStorage())));
        self::assertSame('transport', $this->logs[0]['outcome']);
    }

    public function testExpiredBudgetPreventsAnotherExternalCall(): void
    {
        $budget = new \App\Address\LookupBudget(microtime(true) + 0.5);
        self::assertLessThanOrEqual(0.5, $budget->options()['max_duration']);
        $expired = new \App\Address\LookupBudget(microtime(true) - 1);
        $this->expectException(\App\Address\ProviderFailure::class);
        $expired->options();
    }

}
