<?php

declare(strict_types=1);

namespace App\Controller\Api;

use App\Http\ApiProblemException;
use App\Http\JsonRequestDecoder;
use App\Oidc\OidcConfiguration;
use App\Oidc\OidcRoleAccess;
use App\Oidc\RequestOidcContext;
use App\Service\PocStateService;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api/v1/subscriptions')]
final class SubscriptionController extends AbstractApiController
{
    public function __construct(
        RequestOidcContext $requestOidcContext,
        OidcRoleAccess $oidcRoleAccess,
        OidcConfiguration $oidcConfiguration,
        JsonRequestDecoder $jsonRequestDecoder,
        private readonly PocStateService $stateService,
    ) {
        parent::__construct($requestOidcContext, $oidcRoleAccess, $oidcConfiguration, $jsonRequestDecoder);
    }

    #[Route('/{customerId}/{subscriptionId}', name: 'api_subscription_update', methods: ['PATCH'], requirements: ['customerId' => '\d+', 'subscriptionId' => '\d+'])]
    public function updateSubscription(Request $request, int $customerId, int $subscriptionId): JsonResponse
    {
        $this->requireApiAccess($request);
        $payload = $this->parseJsonObject($request);

        return $this->json($this->stateService->updateSubscription($request->getSession(), $customerId, $subscriptionId, $payload));
    }

    #[Route('/{customerId}/{subscriptionId}/complaint', name: 'api_subscription_complaint', methods: ['POST'], requirements: ['customerId' => '\d+', 'subscriptionId' => '\d+'])]
    public function createComplaint(Request $request, int $customerId, int $subscriptionId): JsonResponse
    {
        $this->requireApiAccess($request);
        $payload = $this->parseJsonObject($request);

        return $this->json($this->stateService->createSubscriptionComplaint(
            $request->getSession(),
            $customerId,
            $subscriptionId,
            (string) ($payload['reason'] ?? 'other'),
        ));
    }

    #[Route('/{customerId}/{subscriptionId}', name: 'api_subscription_complete_winback', methods: ['POST'], requirements: ['customerId' => '\d+', 'subscriptionId' => '\d+'])]
    public function completeWinback(Request $request, int $customerId, int $subscriptionId): JsonResponse
    {
        $this->requireApiAccess($request);
        $payload = $this->parseJsonObject($request);

        return $this->json($this->stateService->completeWinback(
            $request->getSession(),
            $customerId,
            $subscriptionId,
            \is_string($payload['result'] ?? null) ? $payload['result'] : null,
            \is_array($payload['offer'] ?? null) ? $payload['offer'] : [],
        ));
    }

    #[Route('/{customerId}/deceased-actions', name: 'api_subscription_deceased_actions', methods: ['POST'], requirements: ['customerId' => '\d+'])]
    public function processDeceasedActions(Request $request, int $customerId): JsonResponse
    {
        $this->requireApiAccess($request);
        $payload = $this->parseJsonObject($request);

        $actions = \is_array($payload['actions'] ?? null) ? $payload['actions'] : [];

        return $this->json($this->stateService->processDeceasedActions($request->getSession(), $customerId, $actions));
    }

    #[Route('/{customerId}/{subscriptionId}/restitution-transfer', name: 'api_subscription_restitution_transfer', methods: ['POST'], requirements: ['customerId' => '\d+', 'subscriptionId' => '\d+'])]
    public function completeRestitutionTransfer(Request $request, int $customerId, int $subscriptionId): JsonResponse
    {
        $this->requireApiAccess($request);
        $payload = $this->parseJsonObject($request);

        return $this->json($this->stateService->completeRestitutionTransfer(
            $request->getSession(),
            $customerId,
            $subscriptionId,
            \is_array($payload['transferData'] ?? null) ? $payload['transferData'] : [],
        ));
    }
}
