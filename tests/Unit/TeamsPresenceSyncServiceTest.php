<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Oidc\OidcConfiguration;
use App\Oidc\OidcServerMetadataProvider;
use App\Oidc\OidcTokenInspector;
use App\Service\TeamsPresenceGraphClient;
use App\Service\TeamsPresenceSyncService;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class TeamsPresenceSyncServiceTest extends TestCase
{
    private function createService(MockHttpClient $httpClient = new MockHttpClient()): TeamsPresenceSyncService
    {
        $configuration = new OidcConfiguration(dirname(__DIR__, 2));
        $serverMetadataProvider = new OidcServerMetadataProvider($httpClient, $configuration);
        $tokenInspector = new OidcTokenInspector($httpClient, $configuration, $serverMetadataProvider);

        return new TeamsPresenceSyncService(
            $tokenInspector,
            new TeamsPresenceGraphClient($httpClient),
        );
    }

    public function testCapabilityIsDisabledByDefault(): void
    {
        $service = $this->createService();
        $capability = $service->getSyncCapability([
            'oidc_auth_token' => [
                'expires' => time() + 60,
                'id_token' => $this->makeJwt(['iss' => 'https://login.microsoftonline.com/example/v2.0']),
                'access_token' => $this->makeJwt(['scp' => 'Presence.ReadWrite']),
            ],
        ], []);

        self::assertFalse($capability['enabled']);
        self::assertFalse($capability['can_read']);
        self::assertFalse($capability['can_write']);
        self::assertSame('feature_disabled', $capability['reason']);
    }

    public function testCapabilityRejectsNonMicrosoftIssuer(): void
    {
        $service = $this->createService();
        $capability = $service->getSyncCapability([
            'oidc_auth_token' => [
                'expires' => time() + 60,
                'id_token' => $this->makeJwt(['iss' => 'https://bdc.rtvmedia.org.local/kiwi-oidc/realms/kiwi-local']),
                'access_token' => $this->makeJwt(['scp' => 'Presence.ReadWrite']),
            ],
        ], ['TEAMS_PRESENCE_SYNC_ENABLED' => true]);

        self::assertFalse($capability['can_read']);
        self::assertFalse($capability['can_write']);
        self::assertSame('unsupported_identity_provider', $capability['reason']);
    }

    public function testCapabilityRequiresPresenceScope(): void
    {
        $service = $this->createService();
        $capability = $service->getSyncCapability([
            'oidc_auth_token' => [
                'expires' => time() + 60,
                'id_token' => $this->makeJwt(['iss' => 'https://login.microsoftonline.com/example/v2.0']),
                'access_token' => $this->makeJwt(['scp' => 'User.Read']),
            ],
        ], ['TEAMS_PRESENCE_SYNC_ENABLED' => true]);

        self::assertFalse($capability['can_read']);
        self::assertFalse($capability['can_write']);
        self::assertSame('missing_presence_scope', $capability['reason']);
    }

    public function testFetchPresenceMapsToReadyStatus(): void
    {
        $httpClient = new MockHttpClient([new MockResponse((string) json_encode([
            'availability' => 'Available',
            'activity' => 'Available',
        ], JSON_THROW_ON_ERROR), ['http_code' => 200])]);
        $service = $this->createService($httpClient);

        $result = $service->fetchTeamsPresenceStatus([
            'oidc_auth_token' => [
                'expires' => time() + 60,
                'id_token' => $this->makeJwt(['iss' => 'https://login.microsoftonline.com/example/v2.0']),
                'access_token' => $this->makeJwt(['scp' => 'Presence.Read']),
            ],
        ], ['TEAMS_PRESENCE_SYNC_ENABLED' => true]);

        self::assertTrue($result['attempted']);
        self::assertSame('ready', $result['status']);
        self::assertNull($result['reason']);
    }

    public function testSyncInCallUsesSessionPresence(): void
    {
        $httpClient = new MockHttpClient([
            new MockResponse('', ['http_code' => 200]),
            new MockResponse('', ['http_code' => 200]),
        ]);
        $service = $this->createService($httpClient);

        $result = $service->syncKiwiStatusToTeams('in_call', [
            'oidc_auth_token' => [
                'expires' => time() + 60,
                'id_token' => $this->makeJwt([
                    'iss' => 'https://login.microsoftonline.com/example/v2.0',
                    'oid' => '11111111-1111-1111-1111-111111111111',
                ]),
                'access_token' => $this->makeJwt(['scp' => 'Presence.ReadWrite']),
            ],
        ], [
            'TEAMS_PRESENCE_SYNC_ENABLED' => true,
            'OIDC_CLIENT_ID' => 'kiwi-client',
        ]);

        self::assertTrue($result['attempted']);
        self::assertTrue($result['synced']);
        self::assertSame('session', $result['mode']);
    }

    private function makeJwt(array $payload): string
    {
        $header = ['alg' => 'none', 'typ' => 'JWT'];
        $encode = static function (array $value): string {
            return rtrim(strtr(base64_encode((string) json_encode($value, JSON_THROW_ON_ERROR)), '+/', '-_'), '=');
        };

        return sprintf('%s.%s.', $encode($header), $encode($payload));
    }
}
