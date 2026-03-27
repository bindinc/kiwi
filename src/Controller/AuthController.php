<?php

declare(strict_types=1);

namespace App\Controller;

use App\Oidc\OidcConfiguration;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

final class AuthController extends AbstractController
{
    private const AUTH_STATE_KEY = 'oidc_auth_state';
    private const AUTH_TARGET_PATH_KEY = 'oidc_auth_target_path';
    private const AUTH_NONCE_KEY = 'oidc_auth_nonce';

    public function __construct(
        private readonly OidcConfiguration $oidcConfiguration,
    ) {
    }

    #[Route('/login', name: 'app_login', methods: ['GET'])]
    public function login(Request $request): RedirectResponse
    {
        $provider = $this->oidcConfiguration->createProvider($request);
        $authorizationScope = $this->oidcConfiguration->getAuthorizationScope();
        $nonce = bin2hex(random_bytes(16));
        $authorizationUrl = $provider->getAuthorizationUrl([
            'scope' => $authorizationScope,
            'nonce' => $nonce,
        ]);

        $session = $request->getSession();
        $session->set(self::AUTH_STATE_KEY, $provider->getState());
        $session->set(self::AUTH_NONCE_KEY, $nonce);
        $session->set(self::AUTH_TARGET_PATH_KEY, $this->sanitizeNextTarget($request));

        return new RedirectResponse($authorizationUrl);
    }

    #[Route('/auth/callback', name: 'auth_callback', methods: ['GET'])]
    public function callback(): never
    {
        throw new \LogicException('The OIDC authenticator should handle this route.');
    }

    private function sanitizeNextTarget(Request $request): string
    {
        $fallback = $this->generateUrl('app_home');
        $next = $request->query->get('next');
        if (!\is_string($next) || '' === trim($next)) {
            return $fallback;
        }

        $next = trim($next);
        if ($this->isSafeRelativeTarget($next)) {
            return $next;
        }

        return $fallback;
    }

    private function isSafeRelativeTarget(string $target): bool
    {
        return str_starts_with($target, '/')
            && !str_starts_with($target, '//')
            && !str_contains($target, "\r")
            && !str_contains($target, "\n")
            && !str_contains($target, '\\');
    }
}
