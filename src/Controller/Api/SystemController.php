<?php

declare(strict_types=1);

namespace App\Controller\Api;

use App\Oidc\OidcClient;
use App\Service\PocStateService;
use App\Service\TeamsPresenceSyncService;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api/v1')]
final class SystemController extends AbstractApiController
{
    /**
     * @var string[]
     */
    private const SUPPORTED_AGENT_STATUSES = ['ready', 'busy', 'dnd', 'brb', 'away', 'offline', 'acw', 'in_call'];

    public function __construct(
        OidcClient $oidcClient,
        private readonly PocStateService $stateService,
        private readonly TeamsPresenceSyncService $teamsPresenceSync,
    ) {
        parent::__construct($oidcClient);
    }

    #[Route('/status', name: 'api_status', methods: ['GET'])]
    public function status(): JsonResponse
    {
        return $this->json([
            'status' => 'ok',
            'timestamp' => (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->format(\DateTimeInterface::ATOM),
            'rate_limit' => [
                'enabled' => false,
                'limit' => null,
                'remaining' => null,
                'reset_seconds' => null,
                'used' => null,
            ],
        ]);
    }

    #[Route('/me', name: 'api_me', methods: ['GET'])]
    public function me(Request $request): JsonResponse
    {
        $this->requireApiAccess($request);

        return $this->json($this->getCurrentUserContext($request));
    }

    #[Route('/bootstrap', name: 'api_bootstrap', methods: ['GET'])]
    public function bootstrap(Request $request): JsonResponse
    {
        $this->requireApiAccess($request);

        return $this->json($this->stateService->getBootstrapState($request->getSession()));
    }

    #[Route('/debug/reset-poc-state', name: 'api_debug_reset_state', methods: ['POST'])]
    public function resetPocState(Request $request): JsonResponse
    {
        $this->requireApiAccess($request);

        return $this->json($this->stateService->resetState($request->getSession()));
    }

    #[Route('/agent-status', name: 'api_agent_status_read', methods: ['GET'])]
    public function readAgentStatus(Request $request): JsonResponse
    {
        $this->requireApiAccess($request);

        $session = $request->getSession();
        $sessionData = $this->getSessionData($request);
        $localStatus = $this->getCurrentAgentStatus($session);
        $teamsPresence = $this->teamsPresenceSync->fetchTeamsPresenceStatus($sessionData, $this->getAppConfig());

        $teamsStatus = $this->normalizeAgentStatus($teamsPresence['status'] ?? null);
        $resolvedStatus = $teamsStatus ?? $localStatus;
        $source = null !== $teamsStatus ? 'teams' : 'local';

        if ($resolvedStatus !== $localStatus) {
            $session->set('kiwi_agent_status', $resolvedStatus);
        }

        return $this->json([
            'status' => $resolvedStatus,
            'source' => $source,
            'teams_sync' => $teamsPresence,
        ]);
    }

    #[Route('/agent-status', name: 'api_agent_status_update', methods: ['POST'])]
    public function updateAgentStatus(Request $request): JsonResponse
    {
        $this->requireApiAccess($request);

        $payload = json_decode($request->getContent(), true);
        if (!\is_array($payload)) {
            throw new \App\Http\ApiProblemException(400, 'invalid_payload', 'JSON object expected');
        }

        $requestedStatus = $this->normalizeAgentStatus($payload['status'] ?? null);
        if (null === $requestedStatus) {
            throw new \App\Http\ApiProblemException(
                400,
                'invalid_payload',
                'status must be one of the supported agent statuses',
                ['allowed_statuses' => array_values(array_unique(array_merge(self::SUPPORTED_AGENT_STATUSES, ['break'])))],
            );
        }

        $session = $request->getSession();
        $previousStatus = $this->getCurrentAgentStatus($session);
        $session->set('kiwi_agent_status', $requestedStatus);
        $teamsSync = $this->teamsPresenceSync->syncKiwiStatusToTeams(
            $requestedStatus,
            $this->getSessionData($request),
            $this->getAppConfig(),
        );

        return $this->json([
            'status' => $requestedStatus,
            'previous_status' => $previousStatus,
            'teams_sync' => $teamsSync,
        ]);
    }

    private function getCurrentAgentStatus(\Symfony\Component\HttpFoundation\Session\SessionInterface $session): string
    {
        $currentStatus = $this->normalizeAgentStatus($session->get('kiwi_agent_status'));

        return $currentStatus ?? 'ready';
    }

    private function normalizeAgentStatus(mixed $value): ?string
    {
        if (!\is_string($value)) {
            return null;
        }

        $normalized = strtolower(trim($value));
        $normalized = 'break' === $normalized ? 'away' : $normalized;

        return \in_array($normalized, self::SUPPORTED_AGENT_STATUSES, true) ? $normalized : null;
    }
}
