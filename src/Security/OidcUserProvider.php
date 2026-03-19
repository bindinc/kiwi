<?php

declare(strict_types=1);

namespace App\Security;

use App\Oidc\OidcClient;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\Security\Core\Exception\UnsupportedUserException;
use Symfony\Component\Security\Core\Exception\UserNotFoundException;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Security\Core\User\UserProviderInterface;

final class OidcUserProvider implements UserProviderInterface
{
    public function __construct(
        private readonly OidcClient $oidcClient,
        private readonly RequestStack $requestStack,
    ) {
    }

    public function loadUserByIdentifier(string $identifier): UserInterface
    {
        $sessionData = $this->readSessionData();
        if ([] === $sessionData) {
            throw $this->createUserNotFoundException($identifier);
        }

        $profile = \is_array($sessionData['oidc_auth_profile'] ?? null) ? $sessionData['oidc_auth_profile'] : [];
        $roles = $this->resolveRoles($sessionData);
        $user = OidcUser::fromProfile($profile, $roles);

        if ([] !== $profile && $user->getUserIdentifier() === $identifier) {
            return $user;
        }

        throw $this->createUserNotFoundException($identifier);
    }

    public function refreshUser(UserInterface $user): UserInterface
    {
        if (!$user instanceof OidcUser) {
            throw new UnsupportedUserException(sprintf('Unsupported user class "%s".', $user::class));
        }

        $sessionData = $this->readSessionData();
        if ([] === $sessionData) {
            throw $this->createUserNotFoundException($user->getUserIdentifier());
        }

        $profile = \is_array($sessionData['oidc_auth_profile'] ?? null) ? $sessionData['oidc_auth_profile'] : $user->getProfile();
        $roles = $this->resolveRoles($sessionData, $user);

        return OidcUser::fromProfile($profile, $roles);
    }

    public function supportsClass(string $class): bool
    {
        return OidcUser::class === $class || is_subclass_of($class, OidcUser::class);
    }

    /**
     * @param array<string, mixed> $sessionData
     * @return string[]
     */
    private function resolveRoles(array $sessionData, ?OidcUser $fallbackUser = null): array
    {
        $roles = $this->oidcClient->getUserRoles($sessionData);
        if ([] !== $roles) {
            return $roles;
        }

        return null !== $fallbackUser ? $fallbackUser->getRoles() : [];
    }

    /**
     * @return array<string, mixed>
     */
    private function readSessionData(): array
    {
        $request = $this->requestStack->getCurrentRequest();
        if (null === $request || !$request->hasSession()) {
            return [];
        }

        $session = $request->getSession();
        $sessionData = [];

        $profile = $session->get('oidc_auth_profile');
        if (\is_array($profile)) {
            $sessionData['oidc_auth_profile'] = $profile;
        }

        $token = $session->get('oidc_auth_token');
        if (\is_array($token)) {
            $sessionData['oidc_auth_token'] = $token;
        }

        if (!$this->oidcClient->hasFreshSessionToken($sessionData)) {
            return [];
        }

        return $sessionData;
    }

    private function createUserNotFoundException(string $identifier): UserNotFoundException
    {
        $exception = new UserNotFoundException(sprintf('OIDC user "%s" is not available in the current session.', $identifier));
        $exception->setUserIdentifier($identifier);

        return $exception;
    }
}
