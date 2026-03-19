<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Oidc\OidcClient;
use PHPUnit\Framework\MockObject\MockObject;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\Security\Core\Exception\CustomUserMessageAuthenticationException;

final class OidcAuthenticatorTest extends WebTestCase
{
    use AuthenticatedClientTrait;

    public function testLoginRejectsUnsafeNextTargetsAndStoresNonce(): void
    {
        $client = static::createClient();
        $client->request('GET', '/login?next=//evil.example/path');

        self::assertResponseRedirects();
        $location = $client->getResponse()->headers->get('Location');
        self::assertNotNull($location);

        $query = [];
        parse_str((string) parse_url($location, \PHP_URL_QUERY), $query);

        self::assertNotEmpty($query['nonce'] ?? null);

        $sessionAttributes = $this->readClientSessionAttributes($client);
        self::assertSame('/', $sessionAttributes['oidc_auth_target_path'] ?? null);
        self::assertSame($query['nonce'] ?? null, $sessionAttributes['oidc_auth_nonce'] ?? null);
        self::assertArrayHasKey('oidc_auth_state', $sessionAttributes);
    }

    public function testCallbackRejectsUnexpectedStateAndClearsOidcMarkers(): void
    {
        $client = $this->createClientWithSession([
            'oidc_auth_state' => 'expected-state',
            'oidc_auth_target_path' => '/after-login',
            'oidc_auth_nonce' => 'expected-nonce',
        ]);

        $client->request('GET', '/auth/callback?code=test-code&state=wrong-state');

        self::assertResponseRedirects('/logged-out');

        $sessionAttributes = $this->readClientSessionAttributes($client);
        self::assertArrayNotHasKey('oidc_auth_state', $sessionAttributes);
        self::assertArrayNotHasKey('oidc_auth_target_path', $sessionAttributes);
        self::assertArrayNotHasKey('oidc_auth_nonce', $sessionAttributes);
    }

    public function testCallbackRejectsNonceMismatchAndClearsOidcMarkers(): void
    {
        $client = $this->createClientWithSession([
            'oidc_auth_state' => 'expected-state',
            'oidc_auth_target_path' => '/after-login',
            'oidc_auth_nonce' => 'expected-nonce',
        ]);

        /** @var OidcClient&MockObject $oidcClient */
        $oidcClient = $this->createMock(OidcClient::class);
        $oidcClient->method('exchangeAuthorizationCode')->willReturn([
            'profile' => [
                'given_name' => 'Kiwi',
                'family_name' => 'User',
                'email' => 'test@example.org',
                'preferred_username' => 'kiwi-user',
                'roles' => ['bink8s.app.kiwi.user'],
            ],
            'token' => [
                'id_token' => 'signed-token',
                'access_token' => 'access-token',
            ],
        ]);
        $oidcClient->method('validateIdToken')
            ->willThrowException(new CustomUserMessageAuthenticationException('Invalid OIDC nonce'));
        static::getContainer()->set(OidcClient::class, $oidcClient);

        $client->request('GET', '/auth/callback?code=test-code&state=expected-state');

        self::assertResponseRedirects('/logged-out');

        $sessionAttributes = $this->readClientSessionAttributes($client);
        self::assertArrayNotHasKey('oidc_auth_state', $sessionAttributes);
        self::assertArrayNotHasKey('oidc_auth_target_path', $sessionAttributes);
        self::assertArrayNotHasKey('oidc_auth_nonce', $sessionAttributes);
    }

    public function testCallbackPersistsSessionDataForTheNextRequest(): void
    {
        $client = $this->createClientWithSession([
            'oidc_auth_state' => 'expected-state',
            'oidc_auth_target_path' => '/',
            'oidc_auth_nonce' => 'expected-nonce',
        ]);

        /** @var OidcClient&MockObject $oidcClient */
        $oidcClient = $this->createMock(OidcClient::class);
        $oidcClient->method('exchangeAuthorizationCode')->willReturn([
            'profile' => [
                'given_name' => 'Kiwi',
                'family_name' => 'User',
                'email' => 'test@example.org',
                'preferred_username' => 'kiwi-user',
                'roles' => ['bink8s.app.kiwi.user'],
            ],
            'token' => [
                'id_token' => 'signed-token',
                'access_token' => 'access-token',
                'expires' => time() + 3600,
            ],
        ]);
        $oidcClient->method('getUserRoles')->willReturn(['bink8s.app.kiwi.user']);
        $oidcClient->method('buildUserIdentity')->willReturn([
            'first_name' => 'Kiwi',
            'last_name' => 'User',
            'full_name' => 'Kiwi User',
            'initials' => 'KU',
            'email' => 'test@example.org',
        ]);
        $oidcClient->method('userHasAccess')->willReturn(true);
        $oidcClient->method('getProfileImage')->willReturn(null);
        static::getContainer()->set(OidcClient::class, $oidcClient);

        $client->request('GET', '/auth/callback?code=test-code&state=expected-state');

        self::assertResponseRedirects('/');

        $sessionAttributes = $this->readClientSessionAttributes($client);
        self::assertSame('test@example.org', $sessionAttributes['oidc_auth_profile']['email'] ?? null);
        self::assertSame('signed-token', $sessionAttributes['oidc_auth_token']['id_token'] ?? null);
        self::assertArrayNotHasKey('oidc_auth_state', $sessionAttributes);
        self::assertArrayNotHasKey('oidc_auth_target_path', $sessionAttributes);
        self::assertArrayNotHasKey('oidc_auth_nonce', $sessionAttributes);

        $client->request('GET', '/');

        self::assertResponseIsSuccessful();
        self::assertStringContainsString('Kiwi User', (string) $client->getResponse()->getContent());
    }

}
