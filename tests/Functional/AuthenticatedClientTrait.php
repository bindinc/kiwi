<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Component\BrowserKit\Cookie;
use Symfony\Component\HttpFoundation\Session\SessionInterface;

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
        return $this->createClientWithSession(array_filter([
            'oidc_auth_profile' => array_merge([
                'name' => 'Test User',
                'email' => 'test@example.org',
                'roles' => $roles,
            ], $profile),
            'oidc_auth_token' => [] !== $token ? $token : null,
        ], static fn (mixed $value): bool => null !== $value));
    }

    /**
     * @param array<string, mixed> $sessionValues
     */
    protected function createClientWithSession(array $sessionValues): KernelBrowser
    {
        $client = static::createClient();
        $session = $this->createSession($sessionValues);
        $client->getCookieJar()->set(new Cookie($session->getName(), $session->getId()));

        return $client;
    }

    /**
     * @return array<string, mixed>
     */
    protected function readClientSessionAttributes(KernelBrowser $client): array
    {
        $cacheDir = (string) static::getContainer()->getParameter('kernel.cache_dir');
        $sessionPath = sprintf('%s/sessions/%s.mocksess', $cacheDir, $this->resolveClientSessionId($client));
        if (!is_file($sessionPath)) {
            return [];
        }

        $rawSession = file_get_contents($sessionPath);
        if (false === $rawSession) {
            throw new \RuntimeException(sprintf('Unable to read the test session file "%s".', $sessionPath));
        }

        $sessionData = unserialize($rawSession);
        if (!\is_array($sessionData)) {
            throw new \RuntimeException(sprintf('The test session file "%s" does not contain an array payload.', $sessionPath));
        }

        $attributes = $sessionData['_sf2_attributes'] ?? [];

        return \is_array($attributes) ? $attributes : [];
    }

    private function resolveClientSessionId(KernelBrowser $client): string
    {
        $cookieName = $this->newSession()->getName();

        foreach ($client->getResponse()->headers->getCookies() as $responseCookie) {
            if ($responseCookie->getName() !== $cookieName) {
                continue;
            }

            $responseCookieValue = $responseCookie->getValue();
            if (!\is_string($responseCookieValue) || '' === $responseCookieValue) {
                continue;
            }

            $client->getCookieJar()->set(new Cookie($cookieName, $responseCookieValue));

            return $responseCookieValue;
        }

        $cookie = $client->getCookieJar()->get($cookieName);
        if (null === $cookie) {
            throw new \RuntimeException(sprintf('Missing session cookie "%s".', $cookieName));
        }

        $cookieValue = $cookie->getValue();
        if (!\is_string($cookieValue) || '' === $cookieValue) {
            throw new \RuntimeException(sprintf('Session cookie "%s" does not contain a usable value.', $cookieName));
        }

        return $cookieValue;
    }

    /**
     * @param array<string, mixed> $sessionValues
     */
    private function createSession(array $sessionValues = []): SessionInterface
    {
        $session = $this->newSession();
        foreach ($sessionValues as $key => $value) {
            $session->set($key, $value);
        }

        $session->save();

        return $session;
    }

    private function newSession(): SessionInterface
    {
        $sessionFactory = static::getContainer()->get('session.factory');

        return $sessionFactory->createSession();
    }
}
