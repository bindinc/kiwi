<?php

declare(strict_types=1);

namespace App\Oidc;

use App\Security\OidcUser;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Session\SessionInterface;

final class OidcSessionDataReader
{
    /**
     * @return array<string, mixed>
     */
    public function readFromRequest(Request $request, ?OidcUser $authenticatedUser = null): array
    {
        $sessionData = $request->hasSession()
            ? $this->readFromSession($request->getSession())
            : [];

        if (!isset($sessionData['oidc_auth_profile']) && null !== $authenticatedUser) {
            $sessionData['oidc_auth_profile'] = $authenticatedUser->getProfile();
        }

        return $sessionData;
    }

    /**
     * @return array<string, mixed>
     */
    public function readFromSession(SessionInterface $session): array
    {
        $sessionData = [];

        foreach (['oidc_auth_profile', 'oidc_auth_token', 'oidc_profile_photo'] as $key) {
            $value = $session->get($key);
            if (\is_array($value) || (\is_string($value) && '' !== $value)) {
                $sessionData[$key] = $value;
            }
        }

        return $sessionData;
    }
}
