<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Oidc\OidcClient;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpClient\MockHttpClient;

final class OidcClientTest extends TestCase
{
    private function createClient(): OidcClient
    {
        return new OidcClient(new MockHttpClient(), dirname(__DIR__, 2));
    }

    public function testBuildRedirectUriUsesCurrentBasePath(): void
    {
        $client = $this->createClient();
        $request = Request::create('https://example.org/login');

        self::assertSame('https://example.org/auth/callback', $client->buildRedirectUri($request));
    }

    public function testBuildUserIdentity(): void
    {
        $client = $this->createClient();
        $identity = $client->buildUserIdentity([
            'given_name' => 'Jan',
            'family_name' => 'Vos',
            'email' => 'jan@example.org',
        ]);

        self::assertSame('Jan', $identity['first_name']);
        self::assertSame('Vos', $identity['last_name']);
        self::assertSame('Jan Vos', $identity['full_name']);
        self::assertSame('JV', $identity['initials']);
        self::assertSame('jan@example.org', $identity['email']);
    }

    public function testGetUserRolesPrefersIdTokenClaims(): void
    {
        $client = $this->createClient();
        $token = $this->makeJwt(['roles' => ['bink8s.app.kiwi.user']]);

        self::assertSame(['bink8s.app.kiwi.user'], $client->getUserRoles([
            'oidc_auth_token' => ['id_token' => $token],
        ]));
    }

    public function testBuildEndSessionLogoutUrl(): void
    {
        $client = $this->createClient();
        $logoutUrl = $client->buildEndSessionLogoutUrl(
            'https://issuer.example/logout',
            'https://app.example/logged-out',
            'id-token',
            'kiwi-client',
        );

        self::assertStringContainsString('post_logout_redirect_uri=https%3A%2F%2Fapp.example%2Flogged-out', $logoutUrl);
        self::assertStringContainsString('id_token_hint=id-token', $logoutUrl);
        self::assertStringContainsString('client_id=kiwi-client', $logoutUrl);
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
