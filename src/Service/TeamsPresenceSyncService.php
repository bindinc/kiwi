<?php

declare(strict_types=1);

namespace App\Service;

use App\Oidc\OidcClient;
use Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

final class TeamsPresenceSyncService
{
    private const GRAPH_API_BASE_URL = 'https://graph.microsoft.com/v1.0';

    /**
     * @var string[]
     */
    private const READ_SCOPES = [
        'Presence.Read',
        'Presence.Read.All',
        'Presence.ReadWrite',
        'Presence.ReadWrite.All',
    ];

    /**
     * @var string[]
     */
    private const WRITE_SCOPES = [
        'Presence.ReadWrite',
        'Presence.ReadWrite.All',
    ];

    /**
     * @var array<string, array<string, string>>
     */
    private const KIWI_TO_TEAMS_PREFERRED_PRESENCE = [
        'ready' => ['availability' => 'Available', 'activity' => 'Available', 'expirationDuration' => 'PT8H'],
        'break' => ['availability' => 'Away', 'activity' => 'Away', 'expirationDuration' => 'PT4H'],
        'away' => ['availability' => 'Away', 'activity' => 'Away', 'expirationDuration' => 'PT4H'],
        'brb' => ['availability' => 'BeRightBack', 'activity' => 'BeRightBack', 'expirationDuration' => 'PT2H'],
        'dnd' => ['availability' => 'DoNotDisturb', 'activity' => 'DoNotDisturb', 'expirationDuration' => 'PT4H'],
        'offline' => ['availability' => 'Offline', 'activity' => 'OffWork', 'expirationDuration' => 'PT8H'],
        'busy' => ['availability' => 'Busy', 'activity' => 'Busy', 'expirationDuration' => 'PT4H'],
        'acw' => ['availability' => 'Busy', 'activity' => 'Busy', 'expirationDuration' => 'PT30M'],
    ];

    /**
     * @var array<string, array<string, string>>
     */
    private const KIWI_TO_TEAMS_SESSION_PRESENCE = [
        'in_call' => ['availability' => 'Busy', 'activity' => 'InACall', 'expirationDuration' => 'PT4H'],
    ];

    public function __construct(
        private readonly OidcClient $oidcClient,
        private readonly HttpClientInterface $httpClient,
    ) {
    }

    /**
     * @param array<string, mixed> $appConfig
     */
    public function isPresenceSyncEnabled(array $appConfig): bool
    {
        $rawValue = $appConfig['TEAMS_PRESENCE_SYNC_ENABLED'] ?? true;

        if (\is_bool($rawValue)) {
            return $rawValue;
        }

        if (\is_string($rawValue)) {
            $normalized = strtolower(trim($rawValue));

            return !\in_array($normalized, ['', '0', 'false', 'no', 'off'], true);
        }

        return (bool) $rawValue;
    }

    /**
     * @param array<string, mixed> $sessionData
     * @param array<string, mixed> $appConfig
     * @return array<string, mixed>
     */
    public function getSyncCapability(array $sessionData, array $appConfig): array
    {
        $featureEnabled = $this->isPresenceSyncEnabled($appConfig);
        $issuer = $this->oidcClient->getOidcIssuer($sessionData);
        $isMicrosoftSession = $this->oidcClient->isMicrosoftIssuer($issuer);
        $accessToken = $this->oidcClient->getAccessToken($sessionData);
        $tokenScopes = $this->oidcClient->getTokenScopes($sessionData);

        $hasReadScope = $this->containsAnyScope($tokenScopes, self::READ_SCOPES);
        $hasWriteScope = $this->containsAnyScope($tokenScopes, self::WRITE_SCOPES);

        $reason = null;
        if (!$featureEnabled) {
            $reason = 'feature_disabled';
        } elseif (!$isMicrosoftSession) {
            $reason = 'unsupported_identity_provider';
        } elseif (null === $accessToken) {
            $reason = 'missing_access_token';
        } elseif (!$hasReadScope && !$hasWriteScope) {
            $reason = 'missing_presence_scope';
        } elseif (!$hasReadScope) {
            $reason = 'missing_presence_read_scope';
        } elseif (!$hasWriteScope) {
            $reason = 'missing_presence_write_scope';
        }

        return [
            'enabled' => $featureEnabled,
            'issuer' => $issuer,
            'is_microsoft_session' => $isMicrosoftSession,
            'has_access_token' => null !== $accessToken,
            'can_read' => $featureEnabled && $isMicrosoftSession && null !== $accessToken && $hasReadScope,
            'can_write' => $featureEnabled && $isMicrosoftSession && null !== $accessToken && $hasWriteScope,
            'reason' => $reason,
        ];
    }

    /**
     * @param array<string, mixed> $sessionData
     */
    public function getGraphUserIdentifier(array $sessionData): ?string
    {
        $accessClaims = $this->oidcClient->getAccessTokenClaims($sessionData) ?? [];
        $idClaims = $this->oidcClient->getIdTokenClaims($sessionData) ?? [];
        $profile = \is_array($sessionData['oidc_auth_profile'] ?? null) ? $sessionData['oidc_auth_profile'] : [];

        $candidates = [
            $accessClaims['oid'] ?? null,
            $idClaims['oid'] ?? null,
            $profile['oid'] ?? null,
            $accessClaims['preferred_username'] ?? null,
            $idClaims['preferred_username'] ?? null,
            $profile['preferred_username'] ?? null,
            $profile['email'] ?? null,
        ];

        foreach ($candidates as $candidate) {
            if (\is_string($candidate) && '' !== trim($candidate)) {
                return trim($candidate);
            }
        }

        return null;
    }

    /**
     * @param array<string, mixed> $sessionData
     * @param array<string, mixed> $appConfig
     */
    public function getPresenceSessionId(array $sessionData, array $appConfig): ?string
    {
        $configuredSessionId = $appConfig['TEAMS_PRESENCE_SESSION_ID'] ?? null;
        if (\is_string($configuredSessionId) && '' !== trim($configuredSessionId)) {
            return trim($configuredSessionId);
        }

        $oidcClientId = $appConfig['OIDC_CLIENT_ID'] ?? null;
        if (\is_string($oidcClientId) && '' !== trim($oidcClientId)) {
            return trim($oidcClientId);
        }

        $accessClaims = $this->oidcClient->getAccessTokenClaims($sessionData) ?? [];
        $idClaims = $this->oidcClient->getIdTokenClaims($sessionData) ?? [];
        foreach (['azp', 'appid'] as $candidateKey) {
            $candidate = $accessClaims[$candidateKey] ?? $idClaims[$candidateKey] ?? null;
            if (\is_string($candidate) && '' !== trim($candidate)) {
                return trim($candidate);
            }
        }

        return null;
    }

    /**
     * @return array<string, string>|null
     */
    public function mapKiwiStatusToTeamsPreferredPresence(string $status): ?array
    {
        $mapping = self::KIWI_TO_TEAMS_PREFERRED_PRESENCE[$status] ?? null;

        return null !== $mapping ? $mapping : null;
    }

    /**
     * @return array<string, string>|null
     */
    public function mapKiwiStatusToTeamsSessionPresence(string $status): ?array
    {
        $mapping = self::KIWI_TO_TEAMS_SESSION_PRESENCE[$status] ?? null;

        return null !== $mapping ? $mapping : null;
    }

    public function mapTeamsPresenceToKiwiStatus(?string $availability, ?string $activity): ?string
    {
        $normalizedAvailability = strtolower(trim((string) ($availability ?? '')));
        $normalizedActivity = strtolower(trim((string) ($activity ?? '')));

        if ('donotdisturb' === $normalizedAvailability) {
            return 'dnd';
        }

        if ('berightback' === $normalizedAvailability) {
            return 'brb';
        }

        if (\in_array($normalizedAvailability, ['away', 'outofoffice'], true)) {
            return 'away';
        }

        if ('offline' === $normalizedAvailability) {
            return 'offline';
        }

        if ('offwork' === $normalizedActivity) {
            return 'offline';
        }

        if ('outofoffice' === $normalizedActivity) {
            return 'away';
        }

        if (\in_array($normalizedActivity, ['inacall', 'inaconferencecall'], true)) {
            return 'in_call';
        }

        if (\in_array($normalizedActivity, ['inameeting', 'presenting', 'urgentinterruptionsonly'], true)) {
            return 'busy';
        }

        return [
            'available' => 'ready',
            'busy' => 'busy',
        ][$normalizedAvailability] ?? null;
    }

    /**
     * @param array<string, mixed> $sessionData
     * @param array<string, mixed> $appConfig
     * @return array<string, mixed>
     */
    public function syncKiwiStatusToTeams(string $kiwiStatus, array $sessionData, array $appConfig): array
    {
        $capability = $this->getSyncCapability($sessionData, $appConfig);
        if (true !== ($capability['can_write'] ?? false)) {
            return [
                'attempted' => false,
                'synced' => false,
                'reason' => $capability['reason'] ?? 'write_scope_unavailable',
                'capability' => $capability,
            ];
        }

        $userIdentifier = $this->getGraphUserIdentifier($sessionData);
        if (null === $userIdentifier) {
            return [
                'attempted' => false,
                'synced' => false,
                'reason' => 'missing_user_identifier',
                'capability' => $capability,
            ];
        }

        $accessToken = $this->oidcClient->getAccessToken($sessionData);
        if (null === $accessToken) {
            return [
                'attempted' => false,
                'synced' => false,
                'reason' => 'missing_access_token',
                'capability' => $capability,
            ];
        }

        $encodedIdentifier = rawurlencode($userIdentifier);
        $headers = [
            'Authorization' => 'Bearer '.$accessToken,
            'Content-Type' => 'application/json',
        ];

        if ('in_call' === $kiwiStatus) {
            $sessionPresencePayload = $this->mapKiwiStatusToTeamsSessionPresence($kiwiStatus);
            if (null === $sessionPresencePayload) {
                return [
                    'attempted' => false,
                    'synced' => false,
                    'reason' => 'unsupported_kiwi_status',
                    'capability' => $capability,
                ];
            }

            $sessionId = $this->getPresenceSessionId($sessionData, $appConfig);
            if (null === $sessionId) {
                return [
                    'attempted' => false,
                    'synced' => false,
                    'reason' => 'missing_presence_session_id',
                    'capability' => $capability,
                ];
            }

            $clearEndpoint = sprintf('%s/users/%s/presence/clearUserPreferredPresence', self::GRAPH_API_BASE_URL, $encodedIdentifier);
            $clearStatus = null;

            try {
                $response = $this->httpClient->request('POST', $clearEndpoint, [
                    'headers' => $headers,
                    'json' => [],
                    'timeout' => 5,
                ]);
                $clearStatus = $response->getStatusCode();
            } catch (TransportExceptionInterface) {
                $clearStatus = null;
            }

            $sessionEndpoint = sprintf('%s/users/%s/presence/setPresence', self::GRAPH_API_BASE_URL, $encodedIdentifier);
            $sessionPayload = $sessionPresencePayload + ['sessionId' => $sessionId];

            try {
                $response = $this->httpClient->request('POST', $sessionEndpoint, [
                    'headers' => $headers,
                    'json' => $sessionPayload,
                    'timeout' => 5,
                ]);
                $statusCode = $response->getStatusCode();
            } catch (TransportExceptionInterface) {
                return [
                    'attempted' => true,
                    'synced' => false,
                    'reason' => 'request_failed',
                    'capability' => $capability,
                    'mode' => 'session',
                    'clear_preferred_status' => $clearStatus,
                ];
            }

            return [
                'attempted' => true,
                'synced' => \in_array($statusCode, [200, 204], true),
                'reason' => \in_array($statusCode, [200, 204], true) ? null : 'request_failed',
                'capability' => $capability,
                'mode' => 'session',
                'clear_preferred_status' => $clearStatus,
                'status_code' => $statusCode,
            ];
        }

        $preferredPresencePayload = $this->mapKiwiStatusToTeamsPreferredPresence($kiwiStatus);
        if (null === $preferredPresencePayload) {
            return [
                'attempted' => false,
                'synced' => false,
                'reason' => 'unsupported_kiwi_status',
                'capability' => $capability,
            ];
        }

        $endpoint = sprintf('%s/users/%s/presence/setUserPreferredPresence', self::GRAPH_API_BASE_URL, $encodedIdentifier);

        try {
            $response = $this->httpClient->request('POST', $endpoint, [
                'headers' => $headers,
                'json' => $preferredPresencePayload,
                'timeout' => 5,
            ]);
            $statusCode = $response->getStatusCode();
        } catch (TransportExceptionInterface) {
            return [
                'attempted' => true,
                'synced' => false,
                'reason' => 'request_failed',
                'capability' => $capability,
                'mode' => 'preferred',
            ];
        }

        return [
            'attempted' => true,
            'synced' => \in_array($statusCode, [200, 204], true),
            'reason' => \in_array($statusCode, [200, 204], true) ? null : 'request_failed',
            'capability' => $capability,
            'mode' => 'preferred',
            'status_code' => $statusCode,
        ];
    }

    /**
     * @param array<string, mixed> $sessionData
     * @param array<string, mixed> $appConfig
     * @return array<string, mixed>
     */
    public function fetchTeamsPresenceStatus(array $sessionData, array $appConfig): array
    {
        $capability = $this->getSyncCapability($sessionData, $appConfig);
        if (true !== ($capability['can_read'] ?? false)) {
            return [
                'attempted' => false,
                'status' => null,
                'reason' => $capability['reason'] ?? 'read_scope_unavailable',
                'capability' => $capability,
            ];
        }

        $accessToken = $this->oidcClient->getAccessToken($sessionData);
        if (null === $accessToken) {
            return [
                'attempted' => false,
                'status' => null,
                'reason' => 'missing_access_token',
                'capability' => $capability,
            ];
        }

        try {
            $response = $this->httpClient->request('GET', self::GRAPH_API_BASE_URL.'/me/presence', [
                'headers' => [
                    'Authorization' => 'Bearer '.$accessToken,
                ],
                'timeout' => 5,
            ]);
            $statusCode = $response->getStatusCode();
            $payload = $response->toArray(false);
        } catch (\Throwable) {
            return [
                'attempted' => true,
                'status' => null,
                'reason' => 'request_failed',
                'capability' => $capability,
            ];
        }

        if (200 !== $statusCode || !\is_array($payload)) {
            return [
                'attempted' => true,
                'status' => null,
                'reason' => 'request_failed',
                'capability' => $capability,
            ];
        }

        $availability = \is_string($payload['availability'] ?? null) ? $payload['availability'] : null;
        $activity = \is_string($payload['activity'] ?? null) ? $payload['activity'] : null;

        return [
            'attempted' => true,
            'status' => $this->mapTeamsPresenceToKiwiStatus($availability, $activity),
            'reason' => null,
            'capability' => $capability,
            'raw' => $payload,
        ];
    }

    /**
     * @param string[] $scopes
     * @param string[] $requiredScopes
     */
    private function containsAnyScope(array $scopes, array $requiredScopes): bool
    {
        foreach ($requiredScopes as $requiredScope) {
            if (\in_array($requiredScope, $scopes, true)) {
                return true;
            }
        }

        return false;
    }
}
