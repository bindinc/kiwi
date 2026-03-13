<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\BrowserKit\Cookie;

trait AuthenticatedClientTrait
{
    /**
     * @param string[] $roles
     * @param array<string, mixed> $profile
     * @param array<string, mixed> $token
     */
    protected function createAuthenticatedClient(
        array $roles = ['bink8s.app.kiwi.user'],
        array $profile = [],
        array $token = [],
    ): KernelBrowser {
        $client = static::createClient();
        $sessionFactory = static::getContainer()->get('session.factory');
        $session = $sessionFactory->createSession();
        $session->set('oidc_auth_profile', array_merge([
            'name' => 'Test User',
            'email' => 'test@example.org',
            'roles' => $roles,
        ], $profile));

        if ([] !== $token) {
            $session->set('oidc_auth_token', $token);
        }

        $session->save();
        $client->getCookieJar()->set(new Cookie($session->getName(), $session->getId()));

        return $client;
    }
}
