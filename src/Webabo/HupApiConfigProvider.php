<?php

declare(strict_types=1);

namespace App\Webabo;

use App\Config\ClientSecretsLoader;

final class HupApiConfigProvider
{
    private ?HupApiConfig $config = null;

    public function __construct(
        private readonly ClientSecretsLoader $clientSecretsLoader,
    ) {
    }

    public function getConfig(): HupApiConfig
    {
        if (null !== $this->config) {
            return $this->config;
        }

        $section = $this->clientSecretsLoader->getSection('hup');
        $tokenUrl = trim((string) ($section['hup_oidc_token'] ?? ''));
        $webaboBaseUrl = trim((string) ($section['webabo_base_url'] ?? ''));

        if ('' === $tokenUrl) {
            throw new \RuntimeException('HUP token URL ontbreekt in de client secrets configuratie.');
        }

        if ('' === $webaboBaseUrl) {
            throw new \RuntimeException('Webabo base URL ontbreekt in de client secrets configuratie.');
        }

        $this->config = new HupApiConfig(
            webaboBaseUrl: $webaboBaseUrl,
            tokenUrl: $tokenUrl,
            authorizationUrl: trim((string) ($section['hup_oidc_auth'] ?? '')),
            username: $this->normalizeOptionalString($section['username'] ?? null),
            password: $this->normalizeOptionalString($section['password'] ?? null),
            clientAuthMethod: $this->normalizeOptionalString($section['client_auth_method'] ?? null),
            clientBasicAuth: $this->normalizeOptionalString($section['client_basic_auth'] ?? null),
            clientId: $this->normalizeOptionalString($section['client_id'] ?? null),
            clientSecret: $this->normalizeOptionalString($section['client_secret'] ?? null),
            refreshToken: $this->normalizeOptionalString($section['refresh_token'] ?? null),
            scope: $this->normalizeOptionalString($section['scope'] ?? null),
        );

        return $this->config;
    }

    private function normalizeOptionalString(mixed $value): ?string
    {
        if (!\is_string($value)) {
            return null;
        }

        $normalized = trim($value);

        return '' !== $normalized ? $normalized : null;
    }
}
