<?php

declare(strict_types=1);

namespace App\Security;

use App\Oidc\OidcClient;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\Session\SessionInterface;
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
    private const AUTH_STATE_KEY = 'oidc_auth_state';
    private const AUTH_TARGET_PATH_KEY = 'oidc_auth_target_path';
    private const AUTH_NONCE_KEY = 'oidc_auth_nonce';

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
        try {
            $expectedState = (string) $session->get(self::AUTH_STATE_KEY, '');
            $receivedState = trim((string) $request->query->get('state', ''));
            if ('' === $expectedState || '' === $receivedState || $expectedState !== $receivedState) {
                throw new CustomUserMessageAuthenticationException('Invalid OIDC state');
            }

            $oidcData = $this->oidcClient->exchangeAuthorizationCode($request, $code);
            $profile = $oidcData['profile'] ?? [];
            $token = $oidcData['token'] ?? [];
            $sessionData = [
                'oidc_auth_profile' => \is_array($profile) ? $profile : [],
                'oidc_auth_token' => \is_array($token) ? $token : [],
            ];

            $this->validateIdTokenClaims($sessionData, $session);

            $roles = $this->oidcClient->getUserRoles($sessionData);
            $user = OidcUser::fromProfile($sessionData['oidc_auth_profile'], $roles);
            $request->attributes->set('oidc_auth_profile', $sessionData['oidc_auth_profile']);
            $request->attributes->set('oidc_auth_token', $sessionData['oidc_auth_token']);
        } catch (CustomUserMessageAuthenticationException $exception) {
            $this->clearPendingAuthMarkers($session);

            throw $exception;
        } catch (\Throwable $exception) {
            $this->clearPendingAuthMarkers($session);

            throw new CustomUserMessageAuthenticationException('Unable to complete OIDC login', [], 0, $exception);
        }

        $this->clearPendingAuthMarkers($session);

        return new SelfValidatingPassport(
            new UserBadge($user->getUserIdentifier(), static fn () => $user),
        );
    }

    public function onAuthenticationSuccess(Request $request, TokenInterface $token, string $firewallName): ?Response
    {
        $targetPath = $this->resolveTargetPath($request);

        return new RedirectResponse($targetPath);
    }

    public function onAuthenticationFailure(Request $request, AuthenticationException $exception): ?Response
    {
        $this->clearPendingAuthMarkers($request->getSession());

        return new RedirectResponse($this->urlGenerator->generate('app_logged_out'));
    }

    public function start(Request $request, ?AuthenticationException $authException = null): Response
    {
        return new RedirectResponse($this->urlGenerator->generate('app_login', [
            'next' => $request->getRequestUri(),
        ]));
    }

    private function resolveTargetPath(Request $request): string
    {
        $session = $request->getSession();
        $targetPath = $session->get(self::AUTH_TARGET_PATH_KEY);

        if (\is_string($targetPath)) {
            $normalizedTarget = trim($targetPath);
            if ($this->isSafeRelativeTarget($normalizedTarget)) {
                return $normalizedTarget;
            }
        }

        return $this->urlGenerator->generate('app_home');
    }

    /**
     * @param array<string, mixed> $sessionData
     */
    private function validateIdTokenClaims(array $sessionData, SessionInterface $session): void
    {
        $claims = $this->oidcClient->getIdTokenClaims($sessionData);
        if (!\is_array($claims)) {
            throw new CustomUserMessageAuthenticationException('Invalid OIDC ID token');
        }

        $expectedNonce = trim((string) $session->get(self::AUTH_NONCE_KEY, ''));
        $receivedNonce = trim((string) ($claims['nonce'] ?? ''));
        if ('' === $expectedNonce || '' === $receivedNonce || !hash_equals($expectedNonce, $receivedNonce)) {
            throw new CustomUserMessageAuthenticationException('Invalid OIDC nonce');
        }

        $config = $this->oidcClient->getConfig();
        $issuer = $this->normalizeIssuer((string) ($config['issuer'] ?? ''));
        $tokenIssuer = $this->normalizeIssuer((string) ($claims['iss'] ?? ''));
        if ('' === $issuer || '' === $tokenIssuer || !hash_equals($issuer, $tokenIssuer)) {
            throw new CustomUserMessageAuthenticationException('Invalid OIDC issuer');
        }

        $clientId = trim((string) ($config['client_id'] ?? ''));
        if ('' === $clientId || !$this->isAudienceAllowed($claims['aud'] ?? null, $clientId)) {
            throw new CustomUserMessageAuthenticationException('Invalid OIDC audience');
        }

        $expiresAt = $claims['exp'] ?? null;
        if (!\is_numeric($expiresAt) || (int) $expiresAt <= time()) {
            throw new CustomUserMessageAuthenticationException('Expired OIDC ID token');
        }
    }

    private function clearPendingAuthMarkers(SessionInterface $session): void
    {
        $session->remove(self::AUTH_STATE_KEY);
        $session->remove(self::AUTH_TARGET_PATH_KEY);
        $session->remove(self::AUTH_NONCE_KEY);
    }

    private function normalizeIssuer(string $issuer): string
    {
        return rtrim(trim($issuer), '/');
    }

    /**
     * @param mixed $audience
     */
    private function isAudienceAllowed(mixed $audience, string $clientId): bool
    {
        if (\is_string($audience)) {
            $normalizedAudience = trim($audience);

            return '' !== $normalizedAudience && hash_equals($clientId, $normalizedAudience);
        }

        if (!\is_array($audience)) {
            return false;
        }

        foreach ($audience as $value) {
            if (\is_string($value) && hash_equals($clientId, trim($value))) {
                return true;
            }
        }

        return false;
    }

    private function isSafeRelativeTarget(string $target): bool
    {
        return '' !== $target
            && str_starts_with($target, '/')
            && !str_starts_with($target, '//')
            && !str_contains($target, "\r")
            && !str_contains($target, "\n")
            && !str_contains($target, '\\');
    }
}
