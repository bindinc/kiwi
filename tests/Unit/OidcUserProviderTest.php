<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Oidc\OidcClient;
use App\Security\OidcUser;
use App\Security\OidcUserProvider;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\HttpFoundation\Session\Session;
use Symfony\Component\HttpFoundation\Session\Storage\MockArraySessionStorage;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\Security\Core\Exception\UserNotFoundException;

final class OidcUserProviderTest extends TestCase
{
    public function testLoadUserByIdentifierUsesCurrentSessionData(): void
    {
        $provider = $this->createProvider([
            'oidc_auth_profile' => [
                'preferred_username' => 'kiwi-user',
                'name' => 'Kiwi User',
            ],
            'oidc_auth_token' => [
                'roles' => ['bink8s.app.kiwi.user'],
            ],
        ]);

        $user = $provider->loadUserByIdentifier('kiwi-user');

        self::assertInstanceOf(OidcUser::class, $user);
        self::assertSame('kiwi-user', $user->getUserIdentifier());
        self::assertSame(['bink8s.app.kiwi.user'], $user->getRoles());
    }

    public function testLoadUserByIdentifierFailsWithoutMatchingSessionUser(): void
    {
        $provider = $this->createProvider();

        $this->expectException(UserNotFoundException::class);
        $provider->loadUserByIdentifier('kiwi-user');
    }

    public function testRefreshUserUsesSessionDataWhenAvailable(): void
    {
        $provider = $this->createProvider([
            'oidc_auth_profile' => [
                'preferred_username' => 'kiwi-user',
                'name' => 'Kiwi User',
            ],
            'oidc_auth_token' => [
                'roles' => ['bink8s.app.kiwi.admin'],
            ],
        ]);

        $refreshedUser = $provider->refreshUser(
            OidcUser::fromProfile(
                ['preferred_username' => 'stale-user', 'name' => 'Stale User'],
                ['bink8s.app.kiwi.user'],
            ),
        );

        self::assertSame('kiwi-user', $refreshedUser->getUserIdentifier());
        self::assertSame(['bink8s.app.kiwi.admin'], $refreshedUser->getRoles());
        self::assertSame('Kiwi User', $refreshedUser->getProfile()['name']);
    }

    private function createProvider(array $sessionValues = []): OidcUserProvider
    {
        $session = new Session(new MockArraySessionStorage());
        foreach ($sessionValues as $key => $value) {
            $session->set($key, $value);
        }

        $request = Request::create('/');
        $request->setSession($session);

        $requestStack = new RequestStack();
        $requestStack->push($request);

        $oidcClient = new OidcClient(new MockHttpClient(), dirname(__DIR__, 2));

        return new OidcUserProvider($oidcClient, $requestStack);
    }
}
