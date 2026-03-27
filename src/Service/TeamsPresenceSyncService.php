<?php

declare(strict_types=1);

namespace App\Service;

use App\Oidc\OidcTokenInspector;

final class TeamsPresenceSyncService
{
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
        private readonly OidcTokenInspector $tokenInspector,
        private readonly TeamsPresenceGraphClient $graphClient,
    ) {
    }

    /**
     * @param array<string, mixed> $appConfig
     */
    public function isPresenceSyncEnabled(array $appConfig): bool
    {
        $rawValue = $appConfig['TEAMS_PRESENCE_SYNC_ENABLED'] ?? false;

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
        $issuer = $this->tokenInspector->getOidcIssuer($sessionData);
        $isMicrosoftSession = $this->tokenInspector->isMicrosoftIssuer($issuer);
        $accessToken = $this->tokenInspector->getAccessToken($sessionData);
        $tokenScopes = $this->tokenInspector->getTokenScopes($sessionData);

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
        $accessClaims = $this->tokenInspector->getAccessTokenClaims($sessionData) ?? [];
        $idClaims = $this->tokenInspector->getIdTokenClaims($sessionData) ?? [];
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

        $accessClaims = $this->tokenInspector->getAccessTokenClaims($sessionData) ?? [];
        $idClaims = $this->tokenInspector->getIdTokenClaims($sessionData) ?? [];
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
            return $this->buildSyncSkippedResult(
                $capability,
                $capability['reason'] ?? 'write_scope_unavailable',
            );
        }

        $userIdentifier = $this->getGraphUserIdentifier($sessionData);
        if (null === $userIdentifier) {
            return $this->buildSyncSkippedResult($capability, 'missing_user_identifier');
        }

        $accessToken = $this->tokenInspector->getAccessToken($sessionData);
        if (null === $accessToken) {
            return $this->buildSyncSkippedResult($capability, 'missing_access_token');
        }

        if ('in_call' === $kiwiStatus) {
            $sessionPresencePayload = $this->mapKiwiStatusToTeamsSessionPresence($kiwiStatus);
            if (null === $sessionPresencePayload) {
                return $this->buildSyncSkippedResult($capability, 'unsupported_kiwi_status');
            }

            $sessionId = $this->getPresenceSessionId($sessionData, $appConfig);
            if (null === $sessionId) {
                return $this->buildSyncSkippedResult($capability, 'missing_presence_session_id');
            }

            $clearStatus = $this->graphClient->clearUserPreferredPresence($accessToken, $userIdentifier);
            $statusCode = $this->graphClient->setSessionPresence(
                $accessToken,
                $userIdentifier,
                $sessionPresencePayload + ['sessionId' => $sessionId],
            );

            return $this->buildSyncRequestResult($capability, 'session', $statusCode, $clearStatus);
        }

        $preferredPresencePayload = $this->mapKiwiStatusToTeamsPreferredPresence($kiwiStatus);
        if (null === $preferredPresencePayload) {
            return $this->buildSyncSkippedResult($capability, 'unsupported_kiwi_status');
        }

        $statusCode = $this->graphClient->setUserPreferredPresence(
            $accessToken,
            $userIdentifier,
            $preferredPresencePayload,
        );

        return $this->buildSyncRequestResult($capability, 'preferred', $statusCode);
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
            return $this->buildReadSkippedResult(
                $capability,
                $capability['reason'] ?? 'read_scope_unavailable',
            );
        }

        $accessToken = $this->tokenInspector->getAccessToken($sessionData);
        if (null === $accessToken) {
            return $this->buildReadSkippedResult($capability, 'missing_access_token');
        }

        $payload = $this->graphClient->fetchMyPresence($accessToken);
        if (null === $payload) {
            return $this->buildReadFailureResult($capability);
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

    /**
     * @param array<string, mixed> $capability
     * @return array<string, mixed>
     */
    private function buildSyncSkippedResult(array $capability, string $reason): array
    {
        return [
            'attempted' => false,
            'synced' => false,
            'reason' => $reason,
            'capability' => $capability,
        ];
    }

    /**
     * @param array<string, mixed> $capability
     * @return array<string, mixed>
     */
    private function buildSyncRequestResult(
        array $capability,
        string $mode,
        ?int $statusCode,
        ?int $clearStatus = null,
    ): array {
        $synced = null !== $statusCode && \in_array($statusCode, [200, 204], true);

        $result = [
            'attempted' => true,
            'synced' => $synced,
            'reason' => $synced ? null : 'request_failed',
            'capability' => $capability,
            'mode' => $mode,
        ];

        if (null !== $clearStatus) {
            $result['clear_preferred_status'] = $clearStatus;
        }

        if (null !== $statusCode) {
            $result['status_code'] = $statusCode;
        }

        return $result;
    }

    /**
     * @param array<string, mixed> $capability
     * @return array<string, mixed>
     */
    private function buildReadSkippedResult(array $capability, string $reason): array
    {
        return [
            'attempted' => false,
            'status' => null,
            'reason' => $reason,
            'capability' => $capability,
        ];
    }

    /**
     * @param array<string, mixed> $capability
     * @return array<string, mixed>
     */
    private function buildReadFailureResult(array $capability): array
    {
        return [
            'attempted' => true,
            'status' => null,
            'reason' => 'request_failed',
            'capability' => $capability,
        ];
    }
}
