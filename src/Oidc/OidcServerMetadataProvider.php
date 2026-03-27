<?php

declare(strict_types=1);

namespace App\Oidc;

use Symfony\Contracts\HttpClient\HttpClientInterface;

final class OidcServerMetadataProvider
{
    /**
     * @var array<string, mixed>|null
     */
    private ?array $serverMetadata = null;

    public function __construct(
        private readonly HttpClientInterface $httpClient,
        private readonly OidcConfiguration $configuration,
    ) {
    }

    public function getServerMetadataUrl(): ?string
    {
        $issuer = trim((string) ($this->configuration->getConfig()['issuer'] ?? ''));
        if ('' === $issuer) {
            return null;
        }

        return rtrim($issuer, '/').'/.well-known/openid-configuration';
    }

    /**
     * @return array<string, mixed>|null
     */
    public function getServerMetadata(): ?array
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

    public function getEndSessionEndpoint(): ?string
    {
        $metadata = $this->getServerMetadata();
        if (!\is_array($metadata)) {
            return null;
        }

        $endpoint = $metadata['end_session_endpoint'] ?? null;

        return \is_string($endpoint) && '' !== trim($endpoint) ? trim($endpoint) : null;
    }
}
