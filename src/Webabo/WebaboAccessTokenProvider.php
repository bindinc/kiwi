<?php

declare(strict_types=1);

namespace App\Webabo;

use Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

final class WebaboAccessTokenProvider
{
    private const TOKEN_EXPIRY_SKEW_SECONDS = 30;

    /**
     * @var array<string, array{accessToken: ?string, expiresAt: ?int, refreshToken: ?string}>
     */
    private array $tokenStateByCredential = [];

    public function __construct(
        private readonly HupApiConfigProvider $configProvider,
        private readonly HttpClientInterface $httpClient,
    ) {
    }

    public function getAccessToken(?string $credentialName = null): string
    {
        $config = $this->configProvider->getConfig();
        $credential = $config->getCredential($credentialName);
        $tokenState = $this->getTokenState($credential->name, $credential);

        if ($this->hasUsableAccessToken($tokenState)) {
            return $tokenState['accessToken'] ?? '';
        }

        // In a multi-replica deployment we cannot rely on rotated refresh tokens
        // surviving pod or process restarts, so password-backed credentials always
        // mint a fresh access token directly.
        if ($credential->hasPasswordCredentials()) {
            return $this->storeTokenData($credential->name, $this->requestToken($credential, [
                'grant_type' => 'password',
                'username' => $credential->username,
                'password' => $credential->password,
            ]));
        }

        $refreshToken = $tokenState['refreshToken'] ?? $credential->refreshToken;

        if (null !== $refreshToken) {
            return $this->storeTokenData($credential->name, $this->requestToken($credential, [
                'grant_type' => 'refresh_token',
                'refresh_token' => $refreshToken,
            ]));
        }

        throw new \RuntimeException(sprintf(
            'HUP authenticatie voor credential "%s" mist een bruikbare refresh token of username/password combinatie.',
            $credential->name,
        ));
    }

    public function invalidateCachedToken(?string $credentialName = null): void
    {
        $credential = $this->configProvider->getConfig()->getCredential($credentialName);
        $tokenState = $this->getTokenState($credential->name, $credential);
        $tokenState['accessToken'] = null;
        $tokenState['expiresAt'] = null;
        $this->tokenStateByCredential[$credential->name] = $tokenState;
    }

    /**
     * @param array<string, string|null> $grantParameters
     * @return array<string, mixed>
     */
    private function requestToken(HupApiCredential $credential, array $grantParameters): array
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
            throw new \RuntimeException(sprintf(
                'HUP tokenaanvraag voor credential "%s" mislukte door een transportfout.',
                $credential->name,
            ), 0, $exception);
        }

        $statusCode = $response->getStatusCode();
        $payload = json_decode($response->getContent(false), true);
        if (404 === $statusCode) {
            throw new \RuntimeException(sprintf(
                'HUP token endpoint voor credential "%s" reageerde met HTTP 404. Controleer de token-URL en de realmnaam/casing.',
                $credential->name,
            ));
        }

        if (200 !== $statusCode || !\is_array($payload)) {
            $details = $this->describeTokenError($payload);

            throw new \RuntimeException(sprintf(
                'HUP tokenaanvraag voor credential "%s" gaf een onbruikbaar antwoord terug (HTTP %d%s).',
                $credential->name,
                $statusCode,
                '' !== $details ? sprintf(': %s', $details) : '',
            ));
        }

        if (!\is_string($payload['access_token'] ?? null) || '' === trim($payload['access_token'])) {
            throw new \RuntimeException(sprintf(
                'HUP tokenaanvraag voor credential "%s" leverde geen access token op.',
                $credential->name,
            ));
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
    private function storeTokenData(string $credentialName, array $tokenPayload): string
    {
        $tokenState = $this->tokenStateByCredential[$credentialName] ?? [
            'accessToken' => null,
            'expiresAt' => null,
            'refreshToken' => null,
        ];

        $tokenState['accessToken'] = trim((string) ($tokenPayload['access_token'] ?? ''));
        $expiresIn = max(0, (int) ($tokenPayload['expires_in'] ?? 300));
        $tokenState['expiresAt'] = time() + $expiresIn;

        if (\is_string($tokenPayload['refresh_token'] ?? null) && '' !== trim($tokenPayload['refresh_token'])) {
            $tokenState['refreshToken'] = trim($tokenPayload['refresh_token']);
        }

        $this->tokenStateByCredential[$credentialName] = $tokenState;

        return $tokenState['accessToken'] ?? '';
    }

    /**
     * @param array{accessToken: ?string, expiresAt: ?int, refreshToken: ?string} $tokenState
     */
    private function hasUsableAccessToken(array $tokenState): bool
    {
        if (null === $tokenState['accessToken'] || null === $tokenState['expiresAt']) {
            return false;
        }

        return $tokenState['expiresAt'] > time() + self::TOKEN_EXPIRY_SKEW_SECONDS;
    }

    /**
     * @return array{accessToken: ?string, expiresAt: ?int, refreshToken: ?string}
     */
    private function getTokenState(string $credentialName, HupApiCredential $credential): array
    {
        return $this->tokenStateByCredential[$credentialName] ?? [
            'accessToken' => null,
            'expiresAt' => null,
            'refreshToken' => $credential->refreshToken,
        ];
    }
}
