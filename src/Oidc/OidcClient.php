<?php

declare(strict_types=1);

namespace App\Oidc;

use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use League\OAuth2\Client\Provider\GenericProvider;
use League\OAuth2\Client\Token\AccessTokenInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

class OidcClient
{
    public const DEFAULT_CLIENT_SECRETS_PATH = '/etc/kiwi/oidc-client-secrets/client_secrets.json';

    /**
     * @var string[]
     */
    private const ALLOWED_ROLES = [
        'bink8s.app.kiwi.admin',
        'bink8s.app.kiwi.dev',
        'bink8s.app.kiwi.supervisor',
        'bink8s.app.kiwi.user',
        'bink8s.app.kiwi.view',
    ];

    /**
     * @var string[]
     */
    private const MICROSOFT_ISSUER_HOSTS = [
        'login.microsoftonline.com',
        'login.windows.net',
        'sts.windows.net',
    ];

    /**
     * @var array<string, mixed>|null
     */
    private ?array $config = null;

    /**
     * @var array<string, mixed>|null
     */
    private ?array $serverMetadata = null;

    public function __construct(
        private readonly HttpClientInterface $httpClient,
        #[Autowire('%kernel.project_dir%')]
        private readonly string $projectDir,
    ) {
    }

    /**
     * @return string[]
     */
    public function getAllowedRoles(): array
    {
        return self::ALLOWED_ROLES;
    }

    /**
     * @return array<string, mixed>
     */
    public function getConfig(): array
    {
        if (null !== $this->config) {
            return $this->config;
        }

        $path = $this->getClientSecretsPath();
        if (!is_file($path)) {
            $this->config = [];

            return $this->config;
        }

        $raw = file_get_contents($path);
        if (false === $raw) {
            $this->config = [];

            return $this->config;
        }

        $decoded = json_decode($raw, true);
        if (!\is_array($decoded)) {
            $this->config = [];

            return $this->config;
        }

        $web = $decoded['web'] ?? [];
        $this->config = \is_array($web) ? $web : [];

        return $this->config;
    }

    public function getClientSecretsPath(): string
    {
        $configured = trim((string) (getenv('OIDC_CLIENT_SECRETS') ?: ''));
        if ('' !== $configured) {
            return $configured;
        }

        $mountedSecrets = self::DEFAULT_CLIENT_SECRETS_PATH;
        if (is_file($mountedSecrets)) {
            return $mountedSecrets;
        }

        return $this->projectDir.'/infra/docker/oidc/client_secrets.fallback.json';
    }

    public function createProvider(Request $request): GenericProvider
    {
        $config = $this->getConfig();

        return new GenericProvider([
            'clientId' => (string) ($config['client_id'] ?? ''),
            'clientSecret' => (string) ($config['client_secret'] ?? ''),
            'redirectUri' => $this->buildRedirectUri($request),
            'urlAuthorize' => (string) ($config['auth_uri'] ?? ''),
            'urlAccessToken' => (string) ($config['token_uri'] ?? ''),
            'urlResourceOwnerDetails' => (string) ($config['userinfo_uri'] ?? ''),
        ]);
    }

    public function getAuthorizationScope(): string
    {
        return implode(' ', $this->getScopes());
    }

    public function buildRedirectUri(Request $request): string
    {
        $explicit = trim((string) (getenv('OIDC_REDIRECT_URI') ?: ''));
        if ('' !== $explicit) {
            return $explicit;
        }

        return rtrim($request->getSchemeAndHttpHost(), '/').$request->getBasePath().'/auth/callback';
    }

    public function buildLoggedOutUri(Request $request): string
    {
        return rtrim($request->getSchemeAndHttpHost(), '/').$request->getBasePath().'/logged-out';
    }

    /**
     * @return string[]
     */
    public function getScopes(): array
    {
        $raw = trim((string) (getenv('OIDC_SCOPES') ?: ''));
        if ('' === $raw) {
            $raw = $this->isFallbackSecretsConfig()
                ? 'openid email profile'
                : 'openid email profile User.Read Presence.Read Presence.ReadWrite';
        }

        return array_values(
            array_filter(
                preg_split('/\s+/', $raw) ?: [],
                static fn (string $scope): bool => '' !== $scope,
            ),
        );
    }

    private function isFallbackSecretsConfig(): bool
    {
        $path = $this->getClientSecretsPath();
        if (str_ends_with($path, 'client_secrets.fallback.json')) {
            return true;
        }

        $issuer = trim((string) ($this->getConfig()['issuer'] ?? ''));

        return str_contains($issuer, '/kiwi-oidc/');
    }

    /**
     * @return array<string, mixed>
     */
    public function exchangeAuthorizationCode(Request $request, string $code): array
    {
        $provider = $this->createProvider($request);
        $token = $provider->getAccessToken('authorization_code', ['code' => $code]);

        $profile = [];
        $resourceOwner = $provider->getResourceOwner($token);
        if (method_exists($resourceOwner, 'toArray')) {
            $profile = $resourceOwner->toArray();
        }

        return [
            'token' => $this->normalizeTokenData($token),
            'profile' => \is_array($profile) ? $profile : [],
        ];
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
            'refresh_token' => $token->getRefreshToken(),
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

        return array_values(
            array_filter(
                array_map(
                    static fn (mixed $value): string => \is_string($value) ? trim($value) : '',
                    $roles,
                ),
                static fn (string $value): bool => '' !== $value,
            ),
        );
    }

    /**
     * @param string[] $roles
     */
    public function userHasAccess(array $roles): bool
    {
        foreach ($roles as $role) {
            if (\in_array($role, self::ALLOWED_ROLES, true)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param array<string, mixed>|null $profile
     * @return array{first_name: string, last_name: string, full_name: string, initials: string, email: string|null}
     */
    public function buildUserIdentity(?array $profile): array
    {
        $profile ??= [];

        $firstName = trim((string) ($profile['given_name'] ?? $profile['first_name'] ?? ''));
        $lastName = trim((string) ($profile['family_name'] ?? $profile['last_name'] ?? ''));

        $displayName = trim(implode(' ', array_filter([$firstName, $lastName])));
        $fallbackName = trim((string) ($profile['name'] ?? ''));

        if ('' === $displayName && '' !== $fallbackName) {
            $displayName = $fallbackName;
        }

        if ('' !== $displayName && ('' === $firstName || '' === $lastName)) {
            $parts = preg_split('/\s+/', $displayName) ?: [];
            if ([] !== $parts) {
                $firstName = '' !== $firstName ? $firstName : $parts[0];
                if (count($parts) > 1 && '' === $lastName) {
                    $lastName = $parts[count($parts) - 1];
                }
            }
        }

        $displayName = trim(implode(' ', array_filter([$firstName, $lastName])));
        if ('' === $displayName) {
            $displayName = trim((string) ($profile['preferred_username'] ?? $profile['email'] ?? 'Onbekende gebruiker'));
        }

        $initials = '';
        foreach ([$firstName, $lastName] as $part) {
            if ('' !== $part) {
                $initials .= strtoupper($part[0]);
            }
        }

        if ('' === $initials && '' !== $displayName) {
            $initials = strtoupper($displayName[0]);
        }

        $email = $profile['email'] ?? $profile['preferred_username'] ?? null;
        if (!\is_string($email) || '' === trim($email)) {
            $email = null;
        }

        return [
            'first_name' => $firstName,
            'last_name' => $lastName,
            'full_name' => $displayName,
            'initials' => $initials,
            'email' => $email,
        ];
    }

    /**
     * @param array<string, mixed> $sessionData
     */
    public function getProfileImage(array &$sessionData): ?string
    {
        $cached = $sessionData['oidc_profile_photo'] ?? null;
        if (\is_string($cached) && '' !== $cached) {
            return $cached;
        }

        $accessToken = $this->getAccessToken($sessionData);
        if (null === $accessToken) {
            return null;
        }

        try {
            $response = $this->httpClient->request('GET', 'https://graph.microsoft.com/v1.0/me/photo/$value', [
                'headers' => [
                    'Authorization' => 'Bearer '.$accessToken,
                ],
                'timeout' => 5,
            ]);
        } catch (TransportExceptionInterface) {
            return null;
        }

        if (200 !== $response->getStatusCode()) {
            return null;
        }

        $headers = $response->getHeaders(false);
        $contentType = $headers['content-type'][0] ?? 'image/jpeg';
        $content = $response->getContent(false);
        $dataUrl = 'data:'.$contentType.';base64,'.base64_encode($content);
        $sessionData['oidc_profile_photo'] = $dataUrl;

        return $dataUrl;
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

    public function getEndSessionEndpoint(): ?string
    {
        $metadata = $this->getServerMetadata();
        if (!\is_array($metadata)) {
            return null;
        }

        $endpoint = $metadata['end_session_endpoint'] ?? null;

        return \is_string($endpoint) && '' !== trim($endpoint) ? trim($endpoint) : null;
    }

    public function getServerMetadataUrl(): ?string
    {
        $issuer = trim((string) ($this->getConfig()['issuer'] ?? ''));
        if ('' === $issuer) {
            return null;
        }

        return rtrim($issuer, '/').'/.well-known/openid-configuration';
    }

    /**
     * @return string[]
     */
    public function getRedirectUrisFromSecrets(): array
    {
        $redirectUris = $this->getConfig()['redirect_uris'] ?? [];
        if (!\is_array($redirectUris)) {
            return [];
        }

        $normalized = [];
        foreach ($redirectUris as $uri) {
            if (\is_string($uri) && '' !== trim($uri)) {
                $normalized[] = trim($uri);
            }
        }

        return $normalized;
    }

    /**
     * @param array<string, mixed> $sessionData
     *
     * @throws \UnexpectedValueException
     */
    public function validateIdToken(array $sessionData, string $expectedNonce): void
    {
        $idToken = $sessionData['oidc_auth_token']['id_token'] ?? null;
        if (!\is_string($idToken) || '' === trim($idToken)) {
            throw new \UnexpectedValueException('Missing OIDC ID token.');
        }

        $clientId = trim((string) ($this->getConfig()['client_id'] ?? ''));
        if ('' === $clientId) {
            throw new \UnexpectedValueException('Missing OIDC client ID.');
        }

        $decoded = JWT::decode($idToken, $this->getValidationKeys());
        $claims = json_decode((string) json_encode($decoded, JSON_THROW_ON_ERROR), true, 512, JSON_THROW_ON_ERROR);
        if (!\is_array($claims)) {
            throw new \UnexpectedValueException('OIDC ID token claims could not be normalized.');
        }

        $tokenIssuer = trim((string) ($claims['iss'] ?? ''));
        $expectedIssuer = trim((string) ($this->getExpectedIssuer() ?? ''));
        if ('' === $tokenIssuer || '' === $expectedIssuer || !hash_equals($expectedIssuer, $tokenIssuer)) {
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

    public function buildEndSessionLogoutUrl(
        ?string $endSessionEndpoint,
        ?string $postLogoutRedirectUri = null,
        ?string $idTokenHint = null,
        ?string $clientId = null,
    ): ?string {
        if (null === $endSessionEndpoint || '' === trim($endSessionEndpoint)) {
            return null;
        }

        $parts = parse_url($endSessionEndpoint);
        if (!\is_array($parts) || !isset($parts['scheme'], $parts['host'])) {
            return null;
        }

        $query = [];
        if (isset($parts['query'])) {
            parse_str($parts['query'], $query);
        }

        if (null !== $postLogoutRedirectUri && '' !== $postLogoutRedirectUri) {
            $query['post_logout_redirect_uri'] = $postLogoutRedirectUri;
        }

        if (null !== $idTokenHint && '' !== $idTokenHint) {
            $query['id_token_hint'] = $idTokenHint;
        }

        if (null !== $clientId && '' !== $clientId) {
            $query['client_id'] = $clientId;
        }

        $url = $parts['scheme'].'://'.$parts['host'];
        if (isset($parts['port'])) {
            $url .= ':'.$parts['port'];
        }

        $url .= $parts['path'] ?? '';
        if ([] !== $query) {
            $url .= '?'.http_build_query($query);
        }

        if (isset($parts['fragment'])) {
            $url .= '#'.$parts['fragment'];
        }

        return $url;
    }

    /**
     * @param array<string, mixed> $sessionData
     */
    public function getAccessToken(array $sessionData): ?string
    {
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
     * @return array<string, mixed>|null
     */
    private function getServerMetadata(): ?array
    {
        if (null !== $this->serverMetadata) {
            return $this->serverMetadata;
        }

        $metadataUrl = $this->getServerMetadataUrl();
        if (null === $metadataUrl) {
            return null;
        }

        try {
            $response = $this->httpClient->request('GET', $metadataUrl, ['timeout' => 5]);
            if (200 !== $response->getStatusCode()) {
                return null;
            }

            $metadata = $response->toArray(false);
        } catch (\Throwable) {
            return null;
        }

        if (!\is_array($metadata)) {
            return null;
        }

        $this->serverMetadata = $metadata;

        return $this->serverMetadata;
    }

    /**
     * @return array<string, \Firebase\JWT\Key>
     */
    private function getValidationKeys(): array
    {
        $metadata = $this->getServerMetadata();
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

        return JWK::parseKeySet($jwks);
    }

    private function getExpectedIssuer(): ?string
    {
        $metadata = $this->getServerMetadata();
        $metadataIssuer = \is_array($metadata) ? ($metadata['issuer'] ?? null) : null;
        if (\is_string($metadataIssuer) && '' !== trim($metadataIssuer)) {
            return trim($metadataIssuer);
        }

        $configuredIssuer = trim((string) ($this->getConfig()['issuer'] ?? ''));

        return '' !== $configuredIssuer ? $configuredIssuer : null;
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
        $parts = explode('.', $token);
        if (3 !== count($parts)) {
            return null;
        }

        $payload = $parts[1];
        $padding = strlen($payload) % 4;
        if (0 !== $padding) {
            $payload .= str_repeat('=', 4 - $padding);
        }

        $decoded = base64_decode(strtr($payload, '-_', '+/'), true);
        if (false === $decoded) {
            return null;
        }

        $claims = json_decode($decoded, true);

        return \is_array($claims) ? $claims : null;
    }
}
