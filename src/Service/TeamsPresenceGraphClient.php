<?php

declare(strict_types=1);

namespace App\Service;

use Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;
use Symfony\Contracts\HttpClient\ResponseInterface;

final class TeamsPresenceGraphClient
{
    private const GRAPH_API_BASE_URL = 'https://graph.microsoft.com/v1.0';

    public function __construct(
        private readonly HttpClientInterface $httpClient,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function clearUserPreferredPresence(string $accessToken, string $userIdentifier): array
    {
        return $this->sendJsonRequest(
            'POST',
            sprintf('%s/users/%s/presence/clearUserPreferredPresence', self::GRAPH_API_BASE_URL, rawurlencode($userIdentifier)),
            $accessToken,
            [],
            [200, 204],
        );
    }

    /**
     * @param array<string, mixed> $presencePayload
     * @return array<string, mixed>
     */
    public function setSessionPresence(string $accessToken, string $userIdentifier, array $presencePayload): array
    {
        return $this->sendJsonRequest(
            'POST',
            sprintf('%s/users/%s/presence/setPresence', self::GRAPH_API_BASE_URL, rawurlencode($userIdentifier)),
            $accessToken,
            $presencePayload,
            [200, 204],
        );
    }

    /**
     * @param array<string, mixed> $presencePayload
     * @return array<string, mixed>
     */
    public function setUserPreferredPresence(string $accessToken, string $userIdentifier, array $presencePayload): array
    {
        return $this->sendJsonRequest(
            'POST',
            sprintf('%s/users/%s/presence/setUserPreferredPresence', self::GRAPH_API_BASE_URL, rawurlencode($userIdentifier)),
            $accessToken,
            $presencePayload,
            [200, 204],
        );
    }

    /**
     * @return array<string, mixed>|null
     */
    public function fetchMyPresence(string $accessToken): array
    {
        try {
            $response = $this->httpClient->request('GET', self::GRAPH_API_BASE_URL.'/me/presence', [
                'headers' => [
                    'Authorization' => 'Bearer '.$accessToken,
                ],
                'timeout' => 5,
            ]);
        } catch (TransportExceptionInterface $exception) {
            return $this->buildTransportFailureResult($exception);
        }

        return $this->buildResponseResult($response, [200]);
    }

    /**
     * @param array<string, mixed> $payload
     * @param int[] $successStatusCodes
     * @return array<string, mixed>
     */
    private function sendJsonRequest(
        string $method,
        string $url,
        string $accessToken,
        array $payload,
        array $successStatusCodes,
    ): array
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
        } catch (TransportExceptionInterface $exception) {
            return $this->buildTransportFailureResult($exception);
        }

        return $this->buildResponseResult($response, $successStatusCodes);
    }

    /**
     * @param int[] $successStatusCodes
     * @return array<string, mixed>
     */
    private function buildResponseResult(ResponseInterface $response, array $successStatusCodes): array
    {
        try {
            $statusCode = $response->getStatusCode();
            $rawBody = $response->getContent(false);
            $payload = $this->decodeJsonObject($rawBody);
        } catch (TransportExceptionInterface $exception) {
            return $this->buildTransportFailureResult($exception);
        }

        $wasSuccessful = \in_array($statusCode, $successStatusCodes, true);
        $requestId = $this->extractRequestId($response, $payload);

        return [
            'ok' => $wasSuccessful,
            'status_code' => $statusCode,
            'payload' => $payload,
            'error_code' => $wasSuccessful ? null : $this->extractGraphErrorCode($payload),
            'error_message' => $wasSuccessful ? null : $this->extractGraphErrorMessage($payload),
            'request_id' => $requestId,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function buildTransportFailureResult(\Throwable $exception): array
    {
        return [
            'ok' => false,
            'status_code' => null,
            'payload' => null,
            'error_code' => 'transport_exception',
            'error_message' => $this->truncateMessage($exception->getMessage()),
            'request_id' => null,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function decodeJsonObject(string $rawBody): ?array
    {
        $trimmedBody = trim($rawBody);
        if ('' === $trimmedBody) {
            return null;
        }

        try {
            $decoded = json_decode($trimmedBody, true, flags: JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return null;
        }

        return \is_array($decoded) ? $decoded : null;
    }

    /**
     * @param array<string, mixed>|null $payload
     */
    private function extractGraphErrorCode(?array $payload): ?string
    {
        $error = \is_array($payload['error'] ?? null) ? $payload['error'] : null;
        $code = $error['code'] ?? null;

        return \is_string($code) && '' !== trim($code) ? trim($code) : null;
    }

    /**
     * @param array<string, mixed>|null $payload
     */
    private function extractGraphErrorMessage(?array $payload): ?string
    {
        $error = \is_array($payload['error'] ?? null) ? $payload['error'] : null;
        $message = $error['message'] ?? null;
        if (!\is_string($message) || '' === trim($message)) {
            return null;
        }

        return $this->truncateMessage(trim($message));
    }

    /**
     * @param array<string, mixed>|null $payload
     */
    private function extractRequestId(ResponseInterface $response, ?array $payload): ?string
    {
        $error = \is_array($payload['error'] ?? null) ? $payload['error'] : null;
        $innerError = \is_array($error['innerError'] ?? null) ? $error['innerError'] : null;

        foreach (['request-id', 'requestId', 'client-request-id'] as $key) {
            $value = $innerError[$key] ?? null;
            if (\is_string($value) && '' !== trim($value)) {
                return trim($value);
            }
        }

        $headers = $response->getHeaders(false);
        foreach (['request-id', 'client-request-id'] as $headerName) {
            $values = $headers[$headerName] ?? null;
            if (\is_array($values) && \is_string($values[0] ?? null) && '' !== trim($values[0])) {
                return trim($values[0]);
            }
        }

        return null;
    }

    private function truncateMessage(string $message): string
    {
        if (mb_strlen($message) <= 240) {
            return $message;
        }

        return mb_substr($message, 0, 237).'...';
    }
}
