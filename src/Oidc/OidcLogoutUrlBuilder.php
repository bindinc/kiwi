<?php

declare(strict_types=1);

namespace App\Oidc;

use Symfony\Component\HttpFoundation\Request;

final class OidcLogoutUrlBuilder
{
    public function __construct(
        private readonly OidcServerMetadataProvider $serverMetadataProvider,
    ) {
    }

    public function buildLoggedOutUri(Request $request): string
    {
        return rtrim($request->getSchemeAndHttpHost(), '/').$request->getBasePath().'/logged-out';
    }

    public function getEndSessionEndpoint(): ?string
    {
        return $this->serverMetadataProvider->getEndSessionEndpoint();
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
}
