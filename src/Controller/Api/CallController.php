<?php

declare(strict_types=1);

namespace App\Controller\Api;

use App\Http\ApiProblemException;
use App\Oidc\OidcClient;
use App\Service\PocStateService;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api/v1')]
final class CallController extends AbstractApiController
{
    public function __construct(
        OidcClient $oidcClient,
        private readonly PocStateService $stateService,
    ) {
        parent::__construct($oidcClient);
    }

    #[Route('/call-queue', name: 'api_call_queue_read', methods: ['GET'])]
    public function readCallQueue(Request $request): JsonResponse
    {
        $this->requireApiAccess($request);

        return $this->json($this->stateService->getCallQueue($request->getSession()));
    }

    #[Route('/call-queue', name: 'api_call_queue_write', methods: ['PUT'])]
    public function writeCallQueue(Request $request): JsonResponse
    {
        $this->requireApiAccess($request);
        $payload = json_decode($request->getContent(), true);
        if (!\is_array($payload)) {
            throw new ApiProblemException(400, 'invalid_payload', 'JSON object expected');
        }

        return $this->json($this->stateService->writeCallQueue($request->getSession(), $payload));
    }

    #[Route('/call-queue', name: 'api_call_queue_clear', methods: ['DELETE'])]
    public function clearCallQueue(Request $request): JsonResponse
    {
        $this->requireApiAccess($request);

        return $this->json($this->stateService->clearCallQueue($request->getSession()));
    }

    #[Route('/call-queue/debug-generate', name: 'api_call_queue_debug_generate', methods: ['POST'])]
    public function debugGenerateQueue(Request $request): JsonResponse
    {
        $this->requireApiAccess($request);
        $payload = json_decode($request->getContent(), true);
        if (!\is_array($payload)) {
            throw new ApiProblemException(400, 'invalid_payload', 'JSON object expected');
        }

        $queueSize = $this->parseIntValue($payload['queueSize'] ?? null, 'queueSize', 5, true, 0, 100) ?? 5;

        return $this->json($this->stateService->generateDebugQueue(
            $request->getSession(),
            $queueSize,
            (string) ($payload['queueMix'] ?? 'balanced'),
        ));
    }

    #[Route('/call-queue/accept-next', name: 'api_call_queue_accept_next', methods: ['POST'])]
    public function acceptNextCall(Request $request): JsonResponse
    {
        $this->requireApiAccess($request);

        return $this->json($this->stateService->acceptNextCall($request->getSession()));
    }

    #[Route('/call-session', name: 'api_call_session_read', methods: ['GET'])]
    public function readCallSession(Request $request): JsonResponse
    {
        $this->requireApiAccess($request);

        return $this->json($this->stateService->getCallSessionSnapshot($request->getSession()));
    }

    #[Route('/call-session', name: 'api_call_session_write', methods: ['PUT'])]
    public function writeCallSession(Request $request): JsonResponse
    {
        $this->requireApiAccess($request);
        $payload = json_decode($request->getContent(), true);
        if (!\is_array($payload)) {
            throw new ApiProblemException(400, 'invalid_payload', 'JSON object expected');
        }

        return $this->json($this->stateService->writeCallSession($request->getSession(), $payload));
    }

    #[Route('/call-session/start-debug', name: 'api_call_session_start_debug', methods: ['POST'])]
    public function startDebugCall(Request $request): JsonResponse
    {
        $this->requireApiAccess($request);
        $payload = json_decode($request->getContent(), true);
        if (!\is_array($payload)) {
            throw new ApiProblemException(400, 'invalid_payload', 'JSON object expected');
        }

        $waitTime = $this->parseIntValue($payload['waitTime'] ?? null, 'waitTime', 0, true, 0) ?? 0;
        $customerId = $this->parseIntValue($payload['customerId'] ?? null, 'customerId', null, false, 1);
        $payload['waitTime'] = $waitTime;
        $payload['customerId'] = $customerId;

        return $this->json($this->stateService->startDebugCall($request->getSession(), $payload));
    }

    #[Route('/call-session/identify-caller', name: 'api_call_session_identify_caller', methods: ['POST'])]
    public function identifyCaller(Request $request): JsonResponse
    {
        $this->requireApiAccess($request);
        $payload = json_decode($request->getContent(), true);
        if (!\is_array($payload)) {
            throw new ApiProblemException(400, 'invalid_payload', 'JSON object expected');
        }

        $customerId = $this->parseIntValue($payload['customerId'] ?? null, 'customerId', null, true, 1);

        return $this->json($this->stateService->identifyCaller($request->getSession(), (int) $customerId));
    }

    #[Route('/call-session/hold', name: 'api_call_session_hold', methods: ['POST'])]
    public function holdCall(Request $request): JsonResponse
    {
        $this->requireApiAccess($request);

        return $this->json($this->stateService->holdCall($request->getSession()));
    }

    #[Route('/call-session/resume', name: 'api_call_session_resume', methods: ['POST'])]
    public function resumeCall(Request $request): JsonResponse
    {
        $this->requireApiAccess($request);

        return $this->json($this->stateService->resumeCall($request->getSession()));
    }

    #[Route('/call-session/end', name: 'api_call_session_end', methods: ['POST'])]
    public function endCall(Request $request): JsonResponse
    {
        $this->requireApiAccess($request);
        $payload = json_decode($request->getContent(), true);
        if (!\is_array($payload)) {
            throw new ApiProblemException(400, 'invalid_payload', 'JSON object expected');
        }

        return $this->json($this->stateService->endCall(
            $request->getSession(),
            (bool) ($payload['forcedByCustomer'] ?? false),
        ));
    }

    #[Route('/call-session/disposition', name: 'api_call_session_disposition', methods: ['POST'])]
    public function saveDisposition(Request $request): JsonResponse
    {
        $this->requireApiAccess($request);
        $payload = json_decode($request->getContent(), true);
        if (!\is_array($payload)) {
            throw new ApiProblemException(400, 'invalid_payload', 'JSON object expected');
        }

        $category = trim((string) ($payload['category'] ?? ''));
        $outcome = trim((string) ($payload['outcome'] ?? ''));
        if ('' === $category || '' === $outcome) {
            throw new ApiProblemException(400, 'invalid_payload', 'category and outcome are required');
        }

        return $this->json($this->stateService->saveDisposition(
            $request->getSession(),
            $category,
            $outcome,
            (string) ($payload['notes'] ?? ''),
            (bool) ($payload['followUpRequired'] ?? false),
            \is_string($payload['followUpDate'] ?? null) ? $payload['followUpDate'] : null,
            (string) ($payload['followUpNotes'] ?? ''),
        ));
    }
}
