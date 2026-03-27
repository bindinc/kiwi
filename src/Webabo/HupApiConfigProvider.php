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

        $credentials = $this->extractCredentials($section);
        if ([] === $credentials) {
            throw new \RuntimeException('HUP client secrets configuratie bevat geen bruikbare credentials.');
        }

        $this->config = new HupApiConfig(
            webaboBaseUrl: $webaboBaseUrl,
            ppaBaseUrl: $this->normalizeOptionalString($section['ppa_base_url'] ?? null),
            tokenUrl: $tokenUrl,
            authorizationUrl: trim((string) ($section['hup_oidc_auth'] ?? '')),
            credentials: $credentials,
            clientAuthMethod: $this->normalizeOptionalString($section['client_auth_method'] ?? null),
            clientBasicAuth: $this->normalizeOptionalString($section['client_basic_auth'] ?? null),
            clientId: $this->normalizeOptionalString($section['client_id'] ?? null),
            clientSecret: $this->normalizeOptionalString($section['client_secret'] ?? null),
            scope: $this->normalizeOptionalString($section['scope'] ?? null),
        );

        return $this->config;
    }

    /**
     * @param array<string, mixed> $section
     * @return array<string, HupApiCredential>
     */
    private function extractCredentials(array $section): array
    {
        $configuredCredentials = $section['credentials'] ?? null;
        if (\is_array($configuredCredentials)) {
            $credentials = [];

            foreach ($configuredCredentials as $credentialName => $credentialSection) {
                if (!\is_array($credentialSection)) {
                    continue;
                }

                $normalizedName = trim((string) $credentialName);
                if ('' === $normalizedName) {
                    continue;
                }

                $credential = new HupApiCredential(
                    name: $normalizedName,
                    title: $this->normalizeOptionalString($credentialSection['title'] ?? null),
                    mandant: $this->normalizeOptionalString($credentialSection['client'] ?? null),
                    divisionId: $this->normalizeOptionalString(
                        $credentialSection['divisionid']
                        ?? $credentialSection['divisionId']
                        ?? null
                    ),
                    supportsPersonLookup: $this->normalizeOptionalBoolean($credentialSection['client_search'] ?? null),
                    username: $this->normalizeOptionalString($credentialSection['username'] ?? null),
                    password: $this->normalizeOptionalString($credentialSection['password'] ?? null),
                    refreshToken: $this->normalizeOptionalString($credentialSection['refresh_token'] ?? null),
                );

                if (!$credential->hasPasswordCredentials() && !$credential->hasRefreshToken()) {
                    continue;
                }

                $credentials[$normalizedName] = $credential;
            }

            if ([] !== $credentials) {
                return $credentials;
            }
        }

        $legacyCredential = new HupApiCredential(
            name: 'default',
            title: null,
            mandant: null,
            divisionId: null,
            supportsPersonLookup: null,
            username: $this->normalizeOptionalString($section['username'] ?? null),
            password: $this->normalizeOptionalString($section['password'] ?? null),
            refreshToken: $this->normalizeOptionalString($section['refresh_token'] ?? null),
        );

        if ($legacyCredential->hasPasswordCredentials() || $legacyCredential->hasRefreshToken()) {
            return [
                $legacyCredential->name => $legacyCredential,
            ];
        }

        return [];
    }

    private function normalizeOptionalString(mixed $value): ?string
    {
        if (!\is_string($value)) {
            return null;
        }

        $normalized = trim($value);

        return '' !== $normalized ? $normalized : null;
    }

    private function normalizeOptionalBoolean(mixed $value): ?bool
    {
        if (\is_bool($value)) {
            return $value;
        }

        if (\is_int($value)) {
            return 0 !== $value;
        }

        if (!\is_string($value)) {
            return null;
        }

        $normalized = strtolower(trim($value));

        return match ($normalized) {
            '1', 'true', 'yes', 'y', 'on' => true,
            '0', 'false', 'no', 'n', 'off' => false,
            default => null,
        };
    }
}
