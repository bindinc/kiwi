<?php

declare(strict_types=1);

namespace App\Webabo;

use Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

final class WebaboAccessTokenProvider
{
    private const TOKEN_EXPIRY_SKEW_SECONDS = 30;

    private ?string $accessToken = null;
    private ?int $accessTokenExpiresAt = null;
    private ?string $refreshToken = null;

    public function __construct(
        private readonly HupApiConfigProvider $configProvider,
        private readonly HttpClientInterface $httpClient,
    ) {
    }

    public function getAccessToken(): string
    {
        if ($this->hasUsableAccessToken()) {
            return $this->accessToken ?? '';
        }

        $config = $this->configProvider->getConfig();
        $refreshToken = $this->refreshToken ?? $config->refreshToken;

        if (null !== $refreshToken) {
            try {
                return $this->storeTokenData($this->requestToken([
                    'grant_type' => 'refresh_token',
                    'refresh_token' => $refreshToken,
                ]));
            } catch (\RuntimeException $exception) {
                if (!$config->hasPasswordCredentials()) {
                    throw $exception;
                }
            }
        }

        if (!$config->hasPasswordCredentials()) {
            throw new \RuntimeException('HUP authenticatie mist een bruikbare refresh token of username/password combinatie.');
        }

        return $this->storeTokenData($this->requestToken([
            'grant_type' => 'password',
            'username' => $config->username,
            'password' => $config->password,
        ]));
    }

    public function invalidateCachedToken(): void
    {
        $this->accessToken = null;
        $this->accessTokenExpiresAt = null;
    }

    /**
     * @param array<string, string|null> $grantParameters
     * @return array<string, mixed>
     */
    private function requestToken(array $grantParameters): array
    {
        $config = $this->configProvider->getConfig();
        $headers = [
            'Accept' => 'application/json',
        ];
        $body = $grantParameters;

        if ($config->useClientSecretPost()) {
            $body += [
                'client_id' => $config->clientId,
                'client_secret' => $config->clientSecret,
            ];
        } elseif ($config->useNoClientAuthentication()) {
            $body += [
                'client_id' => $config->clientId,
            ];
        } else {
            $basicCredential = $config->resolveBasicClientCredential();
            if (null !== $basicCredential) {
                $headers['Authorization'] = sprintf('Basic %s', base64_encode($basicCredential));
            }
        }

        $body = array_filter(
            $body + [
                'scope' => $config->scope,
            ],
            static fn (mixed $value): bool => null !== $value && '' !== $value,
        );

        try {
            $response = $this->httpClient->request('POST', $config->tokenUrl, [
                'headers' => $headers,
                'body' => $body,
                'timeout' => 10.0,
            ]);
        } catch (TransportExceptionInterface $exception) {
            throw new \RuntimeException('HUP tokenaanvraag mislukte door een transportfout.', 0, $exception);
        }

        $statusCode = $response->getStatusCode();
        $payload = json_decode($response->getContent(false), true);
        if (404 === $statusCode) {
            throw new \RuntimeException('HUP token endpoint reageerde met HTTP 404. Controleer de token-URL en de realmnaam/casing.');
        }

        if (200 !== $statusCode || !\is_array($payload)) {
            $details = $this->describeTokenError($payload);

            throw new \RuntimeException(sprintf(
                'HUP tokenaanvraag gaf een onbruikbaar antwoord terug (HTTP %d%s).',
                $statusCode,
                '' !== $details ? sprintf(': %s', $details) : '',
            ));
        }

        if (!\is_string($payload['access_token'] ?? null) || '' === trim($payload['access_token'])) {
            throw new \RuntimeException('HUP tokenaanvraag leverde geen access token op.');
        }

        return $payload;
    }

    private function describeTokenError(mixed $payload): string
    {
        if (!\is_array($payload)) {
            return '';
        }

        $error = trim((string) ($payload['error'] ?? ''));
        $description = trim((string) ($payload['error_description'] ?? ''));
        $parts = array_values(array_filter([$error, $description]));

        return implode(' - ', $parts);
    }

    /**
     * @param array<string, mixed> $tokenPayload
     */
    private function storeTokenData(array $tokenPayload): string
    {
        $this->accessToken = trim((string) ($tokenPayload['access_token'] ?? ''));
        $expiresIn = max(0, (int) ($tokenPayload['expires_in'] ?? 300));
        $this->accessTokenExpiresAt = time() + $expiresIn;

        if (\is_string($tokenPayload['refresh_token'] ?? null) && '' !== trim($tokenPayload['refresh_token'])) {
            $this->refreshToken = trim($tokenPayload['refresh_token']);
        }

        return $this->accessToken;
    }

    private function hasUsableAccessToken(): bool
    {
        if (null === $this->accessToken || null === $this->accessTokenExpiresAt) {
            return false;
        }

        return $this->accessTokenExpiresAt > time() + self::TOKEN_EXPIRY_SKEW_SECONDS;
    }
}
