<?php

declare(strict_types=1);

namespace App\Service;

use Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

final class TeamsPresenceGraphClient
{
    private const GRAPH_API_BASE_URL = 'https://graph.microsoft.com/v1.0';

    public function __construct(
        private readonly HttpClientInterface $httpClient,
    ) {
    }

    public function clearUserPreferredPresence(string $accessToken, string $userIdentifier): ?int
    {
        return $this->sendJsonRequest(
            'POST',
            sprintf('%s/users/%s/presence/clearUserPreferredPresence', self::GRAPH_API_BASE_URL, rawurlencode($userIdentifier)),
            $accessToken,
            [],
        );
    }

    /**
     * @param array<string, mixed> $presencePayload
     */
    public function setSessionPresence(string $accessToken, string $userIdentifier, array $presencePayload): ?int
    {
        return $this->sendJsonRequest(
            'POST',
            sprintf('%s/users/%s/presence/setPresence', self::GRAPH_API_BASE_URL, rawurlencode($userIdentifier)),
            $accessToken,
            $presencePayload,
        );
    }

    /**
     * @param array<string, mixed> $presencePayload
     */
    public function setUserPreferredPresence(string $accessToken, string $userIdentifier, array $presencePayload): ?int
    {
        return $this->sendJsonRequest(
            'POST',
            sprintf('%s/users/%s/presence/setUserPreferredPresence', self::GRAPH_API_BASE_URL, rawurlencode($userIdentifier)),
            $accessToken,
            $presencePayload,
        );
    }

    /**
     * @return array<string, mixed>|null
     */
    public function fetchMyPresence(string $accessToken): ?array
    {
        try {
            $response = $this->httpClient->request('GET', self::GRAPH_API_BASE_URL.'/me/presence', [
                'headers' => [
                    'Authorization' => 'Bearer '.$accessToken,
                ],
                'timeout' => 5,
            ]);
            if (200 !== $response->getStatusCode()) {
                return null;
            }

            $payload = $response->toArray(false);
        } catch (\Throwable) {
            return null;
        }

        return \is_array($payload) ? $payload : null;
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function sendJsonRequest(string $method, string $url, string $accessToken, array $payload): ?int
    {
        try {
            $response = $this->httpClient->request($method, $url, [
                'headers' => [
                    'Authorization' => 'Bearer '.$accessToken,
                    'Content-Type' => 'application/json',
                ],
                'json' => $payload,
                'timeout' => 5,
            ]);
        } catch (TransportExceptionInterface) {
            return null;
        }

        return $response->getStatusCode();
    }
}
