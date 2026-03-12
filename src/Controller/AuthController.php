<?php

declare(strict_types=1);

namespace App\Controller;

use App\Oidc\OidcClient;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

final class AuthController extends AbstractController
{
    public function __construct(
        private readonly OidcClient $oidcClient,
    ) {
    }

    #[Route('/login', name: 'app_login', methods: ['GET'])]
    public function login(Request $request): RedirectResponse
    {
        $provider = $this->oidcClient->createProvider($request);
        $authorizationUrl = $provider->getAuthorizationUrl([
            'scope' => $this->oidcClient->getScopes(),
        ]);

        $session = $request->getSession();
        $session->set('oidc_auth_state', $provider->getState());
        $session->set('oidc_auth_target_path', $this->sanitizeNextTarget($request));

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
        if (str_starts_with($next, '/')) {
            return $next;
        }

        $parts = parse_url($next);
        if (!\is_array($parts)) {
            return $fallback;
        }

        $currentHost = $request->getHost();
        $currentScheme = $request->getScheme();
        if (($parts['host'] ?? null) !== $currentHost || ($parts['scheme'] ?? null) !== $currentScheme) {
            return $fallback;
        }

        $path = (string) ($parts['path'] ?? '/');
        $query = isset($parts['query']) ? '?'.$parts['query'] : '';

        return $path.$query;
    }
}
