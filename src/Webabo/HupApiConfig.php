<?php

declare(strict_types=1);

namespace App\Webabo;

final readonly class HupApiConfig
{
    private const DEFAULT_LEGACY_BASIC_CLIENT_CREDENTIAL = 'PPA:';

    /**
     * @param array<string, HupApiCredential> $credentials
     */
    public function __construct(
        public string $webaboBaseUrl,
        public ?string $ppaBaseUrl,
        public string $tokenUrl,
        public string $authorizationUrl,
        public array $credentials,
        public ?string $clientAuthMethod,
        public ?string $clientBasicAuth,
        public ?string $clientId,
        public ?string $clientSecret,
        public ?string $scope,
    ) {
    }

    /**
     * @return array<string, HupApiCredential>
     */
    public function getCredentials(): array
    {
        return $this->credentials;
    }

    public function getCredential(?string $credentialName = null): HupApiCredential
    {
        if (null === $credentialName || '' === trim($credentialName)) {
            foreach ($this->credentials as $primaryCredential) {
                return $primaryCredential;
            }

            throw new \RuntimeException('HUP client secrets configuratie bevat geen bruikbare credentials.');
        }

        $credential = $this->credentials[$credentialName] ?? null;
        if ($credential instanceof HupApiCredential) {
            return $credential;
        }

        throw new \RuntimeException(sprintf('HUP credential "%s" ontbreekt in de client secrets configuratie.', $credentialName));
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
