<?php

declare(strict_types=1);

namespace App\Webabo;

final readonly class HupApiConfig
{
    private const DEFAULT_LEGACY_BASIC_CLIENT_CREDENTIAL = 'PPA:';

    public function __construct(
        public string $webaboBaseUrl,
        public string $tokenUrl,
        public string $authorizationUrl,
        public ?string $username,
        public ?string $password,
        public ?string $clientAuthMethod,
        public ?string $clientBasicAuth,
        public ?string $clientId,
        public ?string $clientSecret,
        public ?string $refreshToken,
        public ?string $scope,
    ) {
    }

    public function hasPasswordCredentials(): bool
    {
        return null !== $this->username && '' !== $this->username
            && null !== $this->password && '' !== $this->password;
    }

    public function hasRefreshToken(): bool
    {
        return null !== $this->refreshToken && '' !== $this->refreshToken;
    }

    public function hasClientCredentials(): bool
    {
        return null !== $this->clientId && '' !== $this->clientId
            && null !== $this->clientSecret && '' !== $this->clientSecret;
    }

    public function useClientSecretPost(): bool
    {
        return 'post' === $this->normalizedClientAuthMethod();
    }

    public function useNoClientAuthentication(): bool
    {
        return 'none' === $this->normalizedClientAuthMethod();
    }

    public function resolveBasicClientCredential(): ?string
    {
        if ($this->useClientSecretPost() || $this->useNoClientAuthentication()) {
            return null;
        }

        if (null !== $this->clientBasicAuth && '' !== $this->clientBasicAuth) {
            return $this->clientBasicAuth;
        }

        if ($this->hasClientCredentials()) {
            return sprintf('%s:%s', $this->clientId, $this->clientSecret);
        }

        return self::DEFAULT_LEGACY_BASIC_CLIENT_CREDENTIAL;
    }

    private function normalizedClientAuthMethod(): string
    {
        $normalized = strtolower(trim((string) $this->clientAuthMethod));

        return match ($normalized) {
            'basic', 'post', 'none' => $normalized,
            default => 'basic',
        };
    }
}
