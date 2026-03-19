<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Oidc\OidcClient;
use App\Security\OidcUser;
use PHPUnit\Framework\MockObject\MockObject;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class HomeControllerTest extends WebTestCase
{
    use AuthenticatedClientTrait;

    public function testRedirectsToLoginWhenUserIsNotLoggedIn(): void
    {
        $client = static::createClient();
        $client->request('GET', '/');

        self::assertResponseRedirects('/login?next=http://localhost/');
    }

    public function testRendersAccessDeniedForDisallowedRole(): void
    {
        $client = $this->createAuthenticatedClient(['no.access.role'], [
            'given_name' => 'Kiwi',
            'family_name' => 'User',
        ]);

        $client->request('GET', '/');

        self::assertResponseStatusCodeSame(403);
        $content = (string) $client->getResponse()->getContent();
        self::assertStringContainsString('Geen toegang tot Kiwi', $content);
        self::assertStringContainsString('no.access.role', $content);
        self::assertStringContainsString('method="post"', $content);
        self::assertStringContainsString('name="_csrf_token"', $content);
        self::assertStringContainsString('type="importmap"', $content);
        self::assertStringContainsString('static-page-i18n', $content);
    }

    public function testLogoutRedirectsToLoggedOutPageWithCsrfToken(): void
    {
        $client = $this->createAuthenticatedClient(
            ['bink8s.app.kiwi.user'],
            ['name' => 'Kiwi User'],
            ['id_token' => 'id-token-value'],
        );

        $client->request('GET', '/');
        $content = (string) $client->getResponse()->getContent();
        self::assertSame(1, preg_match('/name="_csrf_token" value="([^"]+)"/', $content, $matches));
        $csrfToken = $matches[1];

        $client->request('POST', '/app-logout', [
            '_csrf_token' => $csrfToken,
        ]);

        self::assertResponseRedirects('/logged-out');
    }

    public function testLogoutDoesNotAllowGetRequests(): void
    {
        $client = $this->createAuthenticatedClient(
            ['bink8s.app.kiwi.user'],
            ['name' => 'Kiwi User'],
            ['id_token' => 'id-token-value'],
        );

        $client->request('GET', '/app-logout');

        self::assertResponseStatusCodeSame(405);
    }

    public function testLoginAndAssetsUseForwardedPrefix(): void
    {
        $client = $this->createAuthenticatedClient(['bink8s.app.kiwi.user'], [
            'given_name' => 'Kiwi',
            'family_name' => 'User',
        ]);

        $client->request('GET', '/', server: [
            'HTTP_X_FORWARDED_PROTO' => 'https',
            'HTTP_X_FORWARDED_HOST' => 'bdc.rtvmedia.org.local',
            'HTTP_X_FORWARDED_PREFIX' => '/kiwi-preview',
            'REMOTE_ADDR' => '127.0.0.1',
        ]);

        $content = $client->getResponse()->getContent();
        self::assertStringContainsString('data-kiwi-base-path="/kiwi-preview"', $content);
        self::assertMatchesRegularExpression('#/kiwi-preview/assets/css/styles(?:-[A-Za-z0-9]+)?\.css#', $content);
        self::assertStringContainsString('type="importmap"', $content);
        self::assertStringContainsString('"app"', $content);
        self::assertStringContainsString('window.kiwiAssetPaths', $content);
        self::assertStringContainsString('callAgentRuntime:', $content);
        self::assertStringContainsString('subscriptionRoleRuntime:', $content);

        self::ensureKernelShutdown();
        $client = static::createClient();
        $client->request('GET', '/login', server: [
            'HTTP_X_FORWARDED_PROTO' => 'https',
            'HTTP_X_FORWARDED_HOST' => 'bdc.rtvmedia.org.local',
            'HTTP_X_FORWARDED_PREFIX' => '/kiwi-preview',
            'REMOTE_ADDR' => '127.0.0.1',
        ]);

        $location = $client->getResponse()->headers->get('Location');
        self::assertNotNull($location);
        self::assertStringContainsString('redirect_uri=https%3A%2F%2Fbdc.rtvmedia.org.local%2Fkiwi-preview%2Fauth%2Fcallback', $location);
        self::assertStringNotContainsString('User.Read', $location);

        $query = [];
        parse_str((string) parse_url($location, \PHP_URL_QUERY), $query);
        self::assertSame('openid email profile', $query['scope'] ?? null);
    }

    public function testSessionAuthenticatedUserCanRenderHome(): void
    {
        $client = static::createClient();
        $client->loginUser(
            OidcUser::fromProfile([
                'given_name' => 'Kiwi',
                'family_name' => 'User',
                'preferred_username' => 'kiwi-user',
                'roles' => ['bink8s.app.kiwi.user'],
            ], ['bink8s.app.kiwi.user']),
            'main',
        );

        $client->request('GET', '/');

        self::assertResponseIsSuccessful();
        self::assertStringContainsString('Kiwi User', (string) $client->getResponse()->getContent());
    }
}
