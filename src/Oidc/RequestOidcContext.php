<?php

declare(strict_types=1);

namespace App\Oidc;

use App\Security\OidcUser;
use Symfony\Component\HttpFoundation\Request;

final class RequestOidcContext
{
    public function __construct(
        private readonly OidcSessionDataReader $sessionDataReader,
        private readonly OidcTokenInspector $tokenInspector,
        private readonly OidcUserIdentityMapper $userIdentityMapper,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getSessionData(Request $request, ?OidcUser $authenticatedUser = null): array
    {
        return $this->sessionDataReader->readFromRequest($request, $authenticatedUser);
    }

    /**
     * @return string[]
     */
    public function getUserRoles(Request $request, ?OidcUser $authenticatedUser = null): array
    {
        return $this->tokenInspector->getUserRoles($this->getSessionData($request, $authenticatedUser));
    }

    public function isAuthenticated(Request $request, ?OidcUser $authenticatedUser = null): bool
    {
        $sessionData = $this->getSessionData($request, $authenticatedUser);
        if (!$this->tokenInspector->hasFreshSessionToken($sessionData)) {
            return false;
        }

        if (null !== $authenticatedUser) {
            return true;
        }

        return isset($sessionData['oidc_auth_profile']) || isset($sessionData['oidc_auth_token']);
    }

    /**
     * @return array<string, mixed>
     */
    public function getCurrentUserContext(Request $request, ?OidcUser $authenticatedUser = null): array
    {
        $sessionData = $this->getSessionData($request, $authenticatedUser);
        $profile = \is_array($sessionData['oidc_auth_profile'] ?? null) ? $sessionData['oidc_auth_profile'] : [];

        return [
            'identity' => $this->userIdentityMapper->buildUserIdentity($profile),
            'roles' => $this->tokenInspector->getUserRoles($sessionData),
        ];
    }
}
