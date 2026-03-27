<?php

declare(strict_types=1);

namespace App\Oidc;

use Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

final class OidcProfilePhotoClient
{
    public function __construct(
        private readonly HttpClientInterface $httpClient,
        private readonly OidcTokenInspector $tokenInspector,
    ) {
    }

    /**
     * @param array<string, mixed> $sessionData
     */
    public function getProfileImage(array &$sessionData): ?string
    {
        if (!$this->tokenInspector->hasFreshSessionToken($sessionData)) {
            return null;
        }

        $cached = $sessionData['oidc_profile_photo'] ?? null;
        if (\is_string($cached) && '' !== $cached) {
            return $cached;
        }

        $accessToken = $this->tokenInspector->getAccessToken($sessionData);
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
}
