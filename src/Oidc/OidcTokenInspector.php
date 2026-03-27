<?php

declare(strict_types=1);

namespace App\Oidc;

use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use League\OAuth2\Client\Token\AccessTokenInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

final class OidcTokenInspector
{
    /**
     * @var string[]
     */
    private const MICROSOFT_ISSUER_HOSTS = [
        'login.microsoftonline.com',
        'login.windows.net',
        'sts.windows.net',
    ];

    /**
     * @var string[]
     */
    private const SAFE_JWKS_ALGORITHMS = [
        'RS256',
        'RS384',
        'RS512',
        'PS256',
        'PS384',
        'PS512',
        'ES256',
        'ES256K',
        'ES384',
        'EdDSA',
    ];

    public function __construct(
        private readonly HttpClientInterface $httpClient,
        private readonly OidcConfiguration $configuration,
        private readonly OidcServerMetadataProvider $serverMetadataProvider,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function normalizeTokenData(AccessTokenInterface $token): array
    {
        $values = method_exists($token, 'getValues') ? $token->getValues() : [];
        if (!\is_array($values)) {
            $values = [];
        }

        return [
            'access_token' => $token->getToken(),
            'expires' => $token->getExpires(),
            'scope' => $values['scope'] ?? null,
            'id_token' => $values['id_token'] ?? null,
            'token_type' => $values['token_type'] ?? null,
            'roles' => $values['roles'] ?? null,
        ];
    }

    /**
     * @param array<string, mixed> $sessionData
     * @return string[]
     */
    public function getUserRoles(array $sessionData): array
    {
        if (!$this->hasFreshSessionToken($sessionData)) {
            return [];
        }

        $roles = [];

        $tokenData = $sessionData['oidc_auth_token'] ?? null;
        if (\is_array($tokenData)) {
            $idToken = $tokenData['id_token'] ?? null;
            if (\is_string($idToken) && '' !== $idToken) {
                $claims = $this->decodeJwtPayload($idToken);
                if (\is_array($claims) && \is_array($claims['roles'] ?? null)) {
                    $roles = $claims['roles'];
                }
            }

            if ([] === $roles) {
                $rawRoles = $tokenData['roles'] ?? [];
                if (\is_string($rawRoles)) {
                    $roles = [$rawRoles];
                } elseif (\is_array($rawRoles)) {
                    $roles = $rawRoles;
                }
            }
        }

        if ([] === $roles) {
            $profile = $sessionData['oidc_auth_profile'] ?? null;
            if (\is_array($profile)) {
                $rawRoles = $profile['roles'] ?? [];
                if (\is_string($rawRoles)) {
                    $roles = [$rawRoles];
                } elseif (\is_array($rawRoles)) {
                    $roles = $rawRoles;
                }
            }
        }

        return array_values(array_filter(
            array_map(
                static fn (mixed $value): string => \is_string($value) ? trim($value) : '',
                $roles,
            ),
            static fn (string $value): bool => '' !== $value,
        ));
    }

    /**
     * @param array<string, mixed> $sessionData
     */
    public function getOidcIssuer(array $sessionData): ?string
    {
        $idTokenClaims = $this->getIdTokenClaims($sessionData);
        if (\is_array($idTokenClaims) && \is_string($idTokenClaims['iss'] ?? null) && '' !== trim((string) $idTokenClaims['iss'])) {
            return trim((string) $idTokenClaims['iss']);
        }

        $accessTokenClaims = $this->getAccessTokenClaims($sessionData);
        if (\is_array($accessTokenClaims) && \is_string($accessTokenClaims['iss'] ?? null) && '' !== trim((string) $accessTokenClaims['iss'])) {
            return trim((string) $accessTokenClaims['iss']);
        }

        $profile = $sessionData['oidc_auth_profile'] ?? null;
        if (\is_array($profile) && \is_string($profile['iss'] ?? null) && '' !== trim((string) $profile['iss'])) {
            return trim((string) $profile['iss']);
        }

        return null;
    }

    public function isMicrosoftIssuer(?string $issuer): bool
    {
        if (null === $issuer || '' === trim($issuer)) {
            return false;
        }

        $host = strtolower((string) (parse_url($issuer, \PHP_URL_HOST) ?: ''));
        if ('' === $host) {
            return false;
        }

        if (\in_array($host, self::MICROSOFT_ISSUER_HOSTS, true)) {
            return true;
        }

        return str_ends_with($host, '.microsoftonline.com');
    }

    /**
     * @param array<string, mixed> $sessionData
     * @return string[]
     */
    public function getTokenScopes(array $sessionData): array
    {
        if (!$this->hasFreshSessionToken($sessionData)) {
            return [];
        }

        $scopes = [];

        $tokenData = $sessionData['oidc_auth_token'] ?? null;
        if (\is_array($tokenData)) {
            $rawScope = $tokenData['scope'] ?? null;
            if (\is_string($rawScope)) {
                $scopes = array_merge($scopes, preg_split('/\s+/', trim($rawScope)) ?: []);
            } elseif (\is_array($rawScope)) {
                foreach ($rawScope as $scope) {
                    if (\is_string($scope) && '' !== trim($scope)) {
                        $scopes[] = trim($scope);
                    }
                }
            }
        }

        $accessTokenClaims = $this->getAccessTokenClaims($sessionData);
        if (\is_array($accessTokenClaims) && \is_string($accessTokenClaims['scp'] ?? null)) {
            $scopes = array_merge($scopes, preg_split('/\s+/', trim((string) $accessTokenClaims['scp'])) ?: []);
        }

        return array_values(array_unique(array_filter($scopes, static fn (string $scope): bool => '' !== $scope)));
    }

    /**
     * @param array<string, mixed> $sessionData
     *
     * @throws \UnexpectedValueException
     */
    public function validateIdToken(array $sessionData, string $expectedNonce): void
    {
        $tokenData = $sessionData['oidc_auth_token'] ?? null;
        $idToken = \is_array($tokenData) ? ($tokenData['id_token'] ?? null) : null;
        if (!\is_string($idToken) || '' === trim($idToken)) {
            throw new \UnexpectedValueException('Missing OIDC ID token.');
        }

        $clientId = $this->configuration->getClientId();
        if (null === $clientId) {
            throw new \UnexpectedValueException('Missing OIDC client ID.');
        }

        $normalizedIdToken = trim($idToken);
        $decoded = JWT::decode($normalizedIdToken, $this->getValidationKeys($normalizedIdToken));
        $claims = json_decode((string) json_encode($decoded, JSON_THROW_ON_ERROR), true, 512, JSON_THROW_ON_ERROR);
        if (!\is_array($claims)) {
            throw new \UnexpectedValueException('OIDC ID token claims could not be normalized.');
        }

        $tokenIssuer = trim((string) ($claims['iss'] ?? ''));
        $expectedIssuer = trim((string) ($this->getExpectedIssuer() ?? ''));
        if (!$this->issuerMatchesExpected($expectedIssuer, $tokenIssuer)) {
            throw new \UnexpectedValueException('Invalid OIDC issuer.');
        }

        if (!$this->audienceMatchesClientId($claims['aud'] ?? null, $clientId)) {
            throw new \UnexpectedValueException('Invalid OIDC audience.');
        }

        $receivedNonce = trim((string) ($claims['nonce'] ?? ''));
        $normalizedExpectedNonce = trim($expectedNonce);
        if ('' === $normalizedExpectedNonce || '' === $receivedNonce || !hash_equals($normalizedExpectedNonce, $receivedNonce)) {
            throw new \UnexpectedValueException('Invalid OIDC nonce.');
        }
    }

    /**
     * @param array<string, mixed> $sessionData
     */
    public function getAccessToken(array $sessionData): ?string
    {
        if (!$this->hasFreshSessionToken($sessionData)) {
            return null;
        }

        $tokenData = $sessionData['oidc_auth_token'] ?? null;
        if (!\is_array($tokenData)) {
            return null;
        }

        $accessToken = $tokenData['access_token'] ?? null;

        return \is_string($accessToken) && '' !== trim($accessToken) ? trim($accessToken) : null;
    }

    /**
     * @param array<string, mixed> $sessionData
     */
    public function getIdToken(array $sessionData): ?string
    {
        if (!$this->hasFreshSessionToken($sessionData)) {
            return null;
        }

        $tokenData = $sessionData['oidc_auth_token'] ?? null;
        if (!\is_array($tokenData)) {
            return null;
        }

        $idToken = $tokenData['id_token'] ?? null;

        return \is_string($idToken) && '' !== trim($idToken) ? trim($idToken) : null;
    }

    /**
     * @param array<string, mixed> $sessionData
     * @return array<string, mixed>|null
     */
    public function getIdTokenClaims(array $sessionData): ?array
    {
        $idToken = $this->getIdToken($sessionData);

        return null !== $idToken ? $this->decodeJwtPayload($idToken) : null;
    }

    /**
     * @param array<string, mixed> $sessionData
     * @return array<string, mixed>|null
     */
    public function getAccessTokenClaims(array $sessionData): ?array
    {
        $accessToken = $this->getAccessToken($sessionData);

        return null !== $accessToken ? $this->decodeJwtPayload($accessToken) : null;
    }

    /**
     * @param array<string, mixed> $sessionData
     */
    public function hasFreshSessionToken(array $sessionData): bool
    {
        $tokenData = $sessionData['oidc_auth_token'] ?? null;
        if (!\is_array($tokenData) || [] === $tokenData) {
            return false;
        }

        $expires = $tokenData['expires'] ?? null;
        if (null === $expires || '' === $expires) {
            return false;
        }

        if (\is_string($expires) && is_numeric($expires)) {
            $expires = (int) $expires;
        }

        if (!\is_int($expires)) {
            return false;
        }

        return $expires > time();
    }

    /**
     * @return array<string, \Firebase\JWT\Key>
     */
    private function getValidationKeys(string $idToken): array
    {
        $metadata = $this->serverMetadataProvider->getServerMetadata();
        $jwksUri = \is_array($metadata) ? ($metadata['jwks_uri'] ?? null) : null;
        if (!\is_string($jwksUri) || '' === trim($jwksUri)) {
            throw new \UnexpectedValueException('OIDC JWKS URI is missing.');
        }

        $response = $this->httpClient->request('GET', trim($jwksUri), ['timeout' => 5]);
        if (200 !== $response->getStatusCode()) {
            throw new \UnexpectedValueException('OIDC JWKS could not be loaded.');
        }

        $jwks = $response->toArray(false);
        if (!\is_array($jwks)) {
            throw new \UnexpectedValueException('OIDC JWKS payload is invalid.');
        }

        $defaultAlg = $this->resolveJwksDefaultAlgorithm($idToken);

        return JWK::parseKeySet($jwks, $defaultAlg);
    }

    private function resolveJwksDefaultAlgorithm(string $idToken): ?string
    {
        $header = $this->decodeJwtHeader($idToken);
        $headerAlg = \is_array($header) ? trim((string) ($header['alg'] ?? '')) : '';
        if ('' === $headerAlg) {
            return null;
        }

        $supportedAlgorithms = $this->getSupportedSigningAlgorithmsFromMetadata();
        if ([] !== $supportedAlgorithms) {
            if (\in_array($headerAlg, $supportedAlgorithms, true)) {
                return $headerAlg;
            }

            throw new \UnexpectedValueException('Unsupported OIDC signing algorithm.');
        }

        $expectedIssuer = $this->getExpectedIssuer();
        if (\is_string($expectedIssuer) && '' !== trim($expectedIssuer) && $this->isMicrosoftIssuer($expectedIssuer)) {
            if ('RS256' === $headerAlg) {
                return $headerAlg;
            }

            throw new \UnexpectedValueException('Unsupported OIDC signing algorithm.');
        }

        if (\in_array($headerAlg, self::SAFE_JWKS_ALGORITHMS, true)) {
            return $headerAlg;
        }

        throw new \UnexpectedValueException('Unsupported OIDC signing algorithm.');
    }

    /**
     * @return string[]
     */
    private function getSupportedSigningAlgorithmsFromMetadata(): array
    {
        $metadata = $this->serverMetadataProvider->getServerMetadata();
        $rawAlgorithms = \is_array($metadata) ? ($metadata['id_token_signing_alg_values_supported'] ?? null) : null;
        if (!\is_array($rawAlgorithms)) {
            return [];
        }

        $supportedAlgorithms = [];
        foreach ($rawAlgorithms as $algorithm) {
            if (!\is_string($algorithm)) {
                continue;
            }

            $normalized = trim($algorithm);
            if ('' === $normalized || !\in_array($normalized, self::SAFE_JWKS_ALGORITHMS, true)) {
                continue;
            }

            $supportedAlgorithms[] = $normalized;
        }

        return array_values(array_unique($supportedAlgorithms));
    }

    private function getExpectedIssuer(): ?string
    {
        $metadata = $this->serverMetadataProvider->getServerMetadata();
        $metadataIssuer = \is_array($metadata) ? ($metadata['issuer'] ?? null) : null;
        if (\is_string($metadataIssuer) && '' !== trim($metadataIssuer)) {
            return trim($metadataIssuer);
        }

        $configuredIssuer = trim((string) ($this->configuration->getConfig()['issuer'] ?? ''));

        return '' !== $configuredIssuer ? $configuredIssuer : null;
    }

    private function issuerMatchesExpected(string $expectedIssuer, string $tokenIssuer): bool
    {
        $normalizedExpected = rtrim(trim($expectedIssuer), '/');
        $normalizedToken = rtrim(trim($tokenIssuer), '/');
        if ('' === $normalizedExpected || '' === $normalizedToken) {
            return false;
        }

        if (hash_equals($normalizedExpected, $normalizedToken)) {
            return true;
        }

        if (!str_contains($normalizedExpected, '{tenantid}')) {
            return false;
        }

        $pattern = preg_quote($normalizedExpected, '#');
        $pattern = str_replace('\{tenantid\}', '[^/]+', $pattern);

        return 1 === preg_match('#^'.$pattern.'$#', $normalizedToken);
    }

    /**
     * @param mixed $audience
     */
    private function audienceMatchesClientId(mixed $audience, string $clientId): bool
    {
        if (\is_string($audience)) {
            $normalizedAudience = trim($audience);

            return '' !== $normalizedAudience && hash_equals($clientId, $normalizedAudience);
        }

        if (!\is_array($audience)) {
            return false;
        }

        foreach ($audience as $value) {
            if (\is_string($value) && '' !== trim($value) && hash_equals($clientId, trim($value))) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function decodeJwtPayload(string $token): ?array
    {
        return $this->decodeJwtSegment($token, 1);
    }

    /**
     * @return array<string, mixed>|null
     */
    private function decodeJwtHeader(string $token): ?array
    {
        return $this->decodeJwtSegment($token, 0);
    }

    /**
     * @return array<string, mixed>|null
     */
    private function decodeJwtSegment(string $token, int $index): ?array
    {
        $parts = explode('.', $token);
        if (3 !== count($parts)) {
            return null;
        }

        if (!isset($parts[$index])) {
            return null;
        }

        $segment = $parts[$index];
        $padding = strlen($segment) % 4;
        if (0 !== $padding) {
            $segment .= str_repeat('=', 4 - $padding);
        }

        $decoded = base64_decode(strtr($segment, '-_', '+/'), true);
        if (false === $decoded) {
            return null;
        }

        $claims = json_decode($decoded, true);

        return \is_array($claims) ? $claims : null;
    }
}
