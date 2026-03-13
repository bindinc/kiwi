<?php

declare(strict_types=1);

namespace App\Security;

use App\Oidc\OidcClient;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Exception\AuthenticationException;
use Symfony\Component\Security\Core\Exception\CustomUserMessageAuthenticationException;
use Symfony\Component\Security\Http\Authenticator\AbstractAuthenticator;
use Symfony\Component\Security\Http\Authenticator\Passport\Badge\UserBadge;
use Symfony\Component\Security\Http\Authenticator\Passport\SelfValidatingPassport;
use Symfony\Component\Security\Http\EntryPoint\AuthenticationEntryPointInterface;

final class OidcAuthenticator extends AbstractAuthenticator implements AuthenticationEntryPointInterface
{
    public function __construct(
        private readonly OidcClient $oidcClient,
        private readonly UrlGeneratorInterface $urlGenerator,
    ) {
    }

    public function supports(Request $request): ?bool
    {
        return 'auth_callback' === $request->attributes->get('_route');
    }

    public function authenticate(Request $request): SelfValidatingPassport
    {
        $error = trim((string) $request->query->get('error', ''));
        if ('' !== $error) {
            throw new CustomUserMessageAuthenticationException('OIDC login failed: '.$error);
        }

        $code = trim((string) $request->query->get('code', ''));
        if ('' === $code) {
            throw new CustomUserMessageAuthenticationException('Missing OIDC authorization code');
        }

        $session = $request->getSession();
        $expectedState = (string) $session->get('oidc_auth_state', '');
        $receivedState = trim((string) $request->query->get('state', ''));
        if ('' === $expectedState || '' === $receivedState || $expectedState !== $receivedState) {
            $session->remove('oidc_auth_state');

            throw new CustomUserMessageAuthenticationException('Invalid OIDC state');
        }

        try {
            $oidcData = $this->oidcClient->exchangeAuthorizationCode($request, $code);
        } catch (\Throwable $exception) {
            throw new CustomUserMessageAuthenticationException('Unable to complete OIDC login', [], 0, $exception);
        }

        $profile = $oidcData['profile'] ?? [];
        $token = $oidcData['token'] ?? [];
        $sessionData = [
            'oidc_auth_profile' => \is_array($profile) ? $profile : [],
            'oidc_auth_token' => \is_array($token) ? $token : [],
        ];
        $roles = $this->oidcClient->getUserRoles($sessionData);
        $user = OidcUser::fromProfile($sessionData['oidc_auth_profile'], $roles);
        $request->attributes->set('oidc_auth_profile', $sessionData['oidc_auth_profile']);
        $request->attributes->set('oidc_auth_token', $sessionData['oidc_auth_token']);

        $passport = new SelfValidatingPassport(
            new UserBadge($user->getUserIdentifier(), static fn () => $user),
        );

        return $passport;
    }

    public function onAuthenticationSuccess(Request $request, TokenInterface $token, string $firewallName): ?Response
    {
        $session = $request->getSession();

        $profile = $request->attributes->get('oidc_auth_profile');
        $tokenData = $request->attributes->get('oidc_auth_token');

        if (\is_array($profile)) {
            $session->set('oidc_auth_profile', $profile);
        }

        if (\is_array($tokenData)) {
            $session->set('oidc_auth_token', $tokenData);
        }

        $session->remove('oidc_auth_state');
        $targetPath = $this->resolveTargetPath($request);

        return new RedirectResponse($targetPath);
    }

    public function onAuthenticationFailure(Request $request, AuthenticationException $exception): ?Response
    {
        $session = $request->getSession();
        $session->remove('oidc_auth_state');
        $session->remove('oidc_auth_target_path');

        return new RedirectResponse($this->urlGenerator->generate('app_logged_out'));
    }

    public function start(Request $request, ?AuthenticationException $authException = null): Response
    {
        return new RedirectResponse($this->urlGenerator->generate('app_login', [
            'next' => $request->getUri(),
        ]));
    }

    private function resolveTargetPath(Request $request): string
    {
        $session = $request->getSession();
        $targetPath = $session->get('oidc_auth_target_path');
        $session->remove('oidc_auth_target_path');

        if (\is_string($targetPath) && '' !== trim($targetPath)) {
            if (str_starts_with($targetPath, '/')) {
                return $targetPath;
            }

            $targetParts = parse_url($targetPath);
            if (\is_array($targetParts)) {
                $currentHost = $request->getHost();
                $currentScheme = $request->getScheme();
                $targetHost = $targetParts['host'] ?? null;
                $targetScheme = $targetParts['scheme'] ?? null;
                if ($currentHost === $targetHost && $currentScheme === $targetScheme) {
                    $path = (string) ($targetParts['path'] ?? '/');
                    $query = isset($targetParts['query']) ? '?'.$targetParts['query'] : '';

                    return $path.$query;
                }
            }
        }

        return $this->urlGenerator->generate('app_home');
    }
}
