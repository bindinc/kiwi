<?php

declare(strict_types=1);

namespace App\Oidc;

use League\OAuth2\Client\Provider\GenericProvider;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\Request;

final class OidcConfiguration
{
    public const DEFAULT_CLIENT_SECRETS_PATH = '/etc/kiwi/oidc-client-secrets/client_secrets.json';

    /**
     * @var string[]
     */
    private const PRESENCE_SCOPES = [
        'Presence.Read',
        'Presence.Read.All',
        'Presence.ReadWrite',
        'Presence.ReadWrite.All',
    ];

    /**
     * @var array<string, mixed>|null
     */
    private ?array $config = null;

    public function __construct(
        #[Autowire('%kernel.project_dir%')]
        private readonly string $projectDir,
    ) {
    }

    public function getClientId(): ?string
    {
        $clientId = trim((string) ($this->getConfig()['client_id'] ?? ''));

        return '' !== $clientId ? $clientId : null;
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
     * @return string[]
     */
    public function getScopes(): array
    {
        $raw = trim((string) (getenv('OIDC_SCOPES') ?: ''));
        $scopes = '' !== $raw
            ? preg_split('/\s+/', $raw) ?: []
            : $this->buildDefaultScopes();

        $scopes = $this->normalizeScopes($scopes);
        if (!$this->isPresenceSyncEnabled()) {
            $scopes = array_values(array_filter(
                $scopes,
                static fn (string $scope): bool => !\in_array($scope, self::PRESENCE_SCOPES, true),
            ));
        }

        return $scopes;
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
     * @return string[]
     */
    private function buildDefaultScopes(): array
    {
        $scopes = ['openid', 'email', 'profile'];

        if (!$this->isFallbackSecretsConfig()) {
            $scopes[] = 'User.Read';

            if ($this->isPresenceSyncEnabled()) {
                $scopes[] = 'Presence.Read';
                $scopes[] = 'Presence.ReadWrite';
            }
        }

        return $scopes;
    }

    /**
     * @param string[] $scopes
     * @return string[]
     */
    private function normalizeScopes(array $scopes): array
    {
        return array_values(array_unique(array_filter(
            array_map(
                static fn (mixed $scope): string => \is_string($scope) ? trim($scope) : '',
                $scopes,
            ),
            static fn (string $scope): bool => '' !== $scope,
        )));
    }

    private function isPresenceSyncEnabled(): bool
    {
        $raw = strtolower(trim((string) (getenv('TEAMS_PRESENCE_SYNC_ENABLED') ?: '')));

        return \in_array($raw, ['1', 'true', 'yes', 'on'], true);
    }
}
