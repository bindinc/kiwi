<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Config\ClientSecretsLoader;
use App\Http\ApiProblemException;
use App\Webabo\HupApiConfigProvider;
use App\Webabo\WebaboAccessTokenProvider;
use App\Webabo\WebaboStartDateClient;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class WebaboStartDateClientTest extends TestCase
{
    private string $directory;
    private string|false $previousPath;

    protected function setUp(): void
    {
        $this->previousPath = getenv('KIWI_CLIENT_SECRETS_PATH');
        $this->directory = sys_get_temp_dir().'/kiwi-start-date-'.bin2hex(random_bytes(6));
        mkdir($this->directory);
        file_put_contents($this->directory.'/client_secrets.json', json_encode(['hup' => [
            'webabo_base_url' => 'https://example.invalid/webabo-rest',
            'hup_oidc_token' => 'https://example.invalid/token',
            'credentials' => [
                'other' => ['username' => 'other-user', 'password' => 'synthetic-password'],
                'guide' => ['username' => 'guide-user', 'password' => 'synthetic-password'],
            ],
        ]], JSON_THROW_ON_ERROR));
        putenv('KIWI_CLIENT_SECRETS_PATH='.$this->directory.'/client_secrets.json');
    }

    protected function tearDown(): void
    {
        putenv(false === $this->previousPath ? 'KIWI_CLIENT_SECRETS_PATH' : 'KIWI_CLIENT_SECRETS_PATH='.$this->previousPath);
        unlink($this->directory.'/client_secrets.json');
        rmdir($this->directory);
    }

    public function testUsesOfferCredentialAndEncodedProductAndEditionWithOneTokenRefresh(): void
    {
        $requests = [];
        $responses = [
            new MockResponse('{"access_token":"first-synthetic-token","expires_in":3600}'),
            new MockResponse('{}', ['http_code' => 401]),
            new MockResponse('{"access_token":"second-synthetic-token","expires_in":3600}'),
            new MockResponse('{"startDate":"2030-03-26"}'),
        ];
        $http = new MockHttpClient(function ($method, $url, $options) use (&$requests, &$responses) {
            $requests[] = compact('method', 'url', 'options');
            return array_shift($responses);
        });

        self::assertSame('2030-03-26', $this->client($http)->fetchStartDate('guide', 'P & Q', 'E/1'));
        self::assertCount(4, $requests);
        parse_str($requests[0]['options']['body'], $login);
        self::assertSame('guide-user', $login['username']);
        self::assertSame('GET', $requests[1]['method']);
        self::assertSame('https://example.invalid/webabo-rest/subscriptions/start-dates?productCode=P+%26+Q&variantCode=E%2F1', $requests[1]['url']);
        self::assertSame(0, $requests[1]['options']['max_redirects']);
        self::assertStringContainsString('second-synthetic-token', $requests[3]['options']['normalized_headers']['authorization'][0]);
    }

    /** @dataProvider unavailableResponses */
    public function testUnavailableOrInvalidResponsesNeverReturnAFallback(MockResponse $response): void
    {
        $http = new MockHttpClient([new MockResponse('{"access_token":"synthetic-token","expires_in":3600}'), $response]);
        $this->expectException(ApiProblemException::class);
        $this->expectExceptionMessage('The source subscription start date is unavailable.');
        $this->client($http)->fetchStartDate('guide', 'GUIDE', 'EDITION');
    }

    public static function unavailableResponses(): iterable
    {
        yield 'absent' => [new MockResponse('{}')];
        yield 'empty' => [new MockResponse('{"startDate":""}')];
        yield 'invalid calendar day' => [new MockResponse('{"startDate":"2030-02-30"}')];
        yield 'timestamp is not a calendar date' => [new MockResponse('{"startDate":"2030-03-26T00:00:00Z"}')];
        yield 'malformed json' => [new MockResponse('<html>source failure</html>')];
        yield 'not found' => [new MockResponse('{}', ['http_code' => 404])];
        yield 'server error' => [new MockResponse('{}', ['http_code' => 500])];
        yield 'lazy transport error' => [new MockResponse('', ['error' => 'source unreachable'])];
    }

    public function testEmptyCredentialDoesNotDefaultToAnotherMandant(): void
    {
        $http = new MockHttpClient(function () { self::fail('No HTTP call expected.'); });
        $this->expectException(ApiProblemException::class);
        $this->client($http)->fetchStartDate('', 'GUIDE', 'EDITION');
    }

    public function testUnknownCredentialNeverAuthenticatesWithThePrimaryCredential(): void
    {
        $http = new MockHttpClient(function () { self::fail('No HTTP call expected.'); });
        $this->expectException(ApiProblemException::class);
        $this->client($http)->fetchStartDate('unknown', 'GUIDE', 'EDITION');
    }

    public function testAuthenticationRetryIsBounded(): void
    {
        $http = new MockHttpClient([
            new MockResponse('{"access_token":"first-synthetic-token","expires_in":3600}'),
            new MockResponse('{}', ['http_code' => 401]),
            new MockResponse('{"access_token":"second-synthetic-token","expires_in":3600}'),
            new MockResponse('{}', ['http_code' => 401]),
        ]);
        try {
            $this->client($http)->fetchStartDate('guide', 'GUIDE', 'EDITION');
            self::fail('An unauthorized source cannot return a start date.');
        } catch (ApiProblemException $error) {
            self::assertSame('The source subscription start date is unavailable. Please try again.', $error->getMessage());
            self::assertSame(4, $http->getRequestsCount());
        }
    }

    public function testUnsecuredSourceIsRejectedBeforeAuthentication(): void
    {
        $path = $this->directory.'/client_secrets.json';
        file_put_contents($path, str_replace('https://example.invalid/webabo-rest', 'http://example.invalid/webabo-rest', file_get_contents($path)));
        $http = new MockHttpClient(function () { self::fail('No HTTP call expected.'); });
        $this->expectException(ApiProblemException::class);
        $this->client($http)->fetchStartDate('guide', 'GUIDE', 'EDITION');
    }

    private function client(MockHttpClient $http): WebaboStartDateClient
    {
        $config = new HupApiConfigProvider(new ClientSecretsLoader($this->directory));
        return new WebaboStartDateClient($config, new WebaboAccessTokenProvider($config, $http), $http);
    }
}
