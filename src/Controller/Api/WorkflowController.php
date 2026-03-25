<?php

declare(strict_types=1);

namespace App\Controller\Api;

use App\Http\ApiProblemException;
use App\Oidc\OidcClient;
use App\Service\PocStateService;
use App\Service\SubscriptionQueueService;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api/v1/workflows')]
final class WorkflowController extends AbstractApiController
{
    public function __construct(
        OidcClient $oidcClient,
        private readonly PocStateService $stateService,
        private readonly SubscriptionQueueService $subscriptionQueueService,
    ) {
        parent::__construct($oidcClient);
    }

    #[Route('/subscription', name: 'api_workflow_subscription_list', methods: ['GET'])]
    public function listQueuedSubscriptions(Request $request): JsonResponse
    {
        $this->requireApiAccess($request);

        return $this->json($this->subscriptionQueueService->listRecentOrders(
            $this->parseQueryInt($request, 'limit', 6, 1, 20) ?? 6,
        ));
    }

    #[Route('/subscription/{orderId}', name: 'api_workflow_subscription_status', methods: ['GET'], requirements: ['orderId' => '\d+'])]
    public function subscriptionStatus(Request $request, int $orderId): JsonResponse
    {
        $this->requireApiAccess($request);

        return $this->json($this->subscriptionQueueService->getOrderStatus($orderId));
    }

    #[Route('/subscription', name: 'api_workflow_subscription_queue', methods: ['POST'])]
    #[Route('/subscription-signup', name: 'api_workflow_subscription_signup', methods: ['POST'])]
    public function queueSubscription(Request $request): JsonResponse
    {
        $this->requireApiAccess($request);
        $payload = json_decode($request->getContent(), true);
        if (!\is_array($payload)) {
            throw new ApiProblemException(400, 'invalid_payload', 'JSON object expected');
        }

        return $this->json(
            $this->subscriptionQueueService->queueSubscription(
                $request->getSession(),
                $payload,
                $this->getCurrentUserContext($request),
            ),
            202,
        );
    }

    #[Route('/article-order', name: 'api_workflow_article_order', methods: ['POST'])]
    public function articleOrder(Request $request): JsonResponse
    {
        $this->requireApiAccess($request);
        $payload = json_decode($request->getContent(), true);
        if (!\is_array($payload)) {
            throw new ApiProblemException(400, 'invalid_payload', 'JSON object expected');
        }

        $customerId = $this->parseIntValue($payload['customerId'] ?? null, 'customerId', null, false, 1);
        $customer = \is_array($payload['customer'] ?? null) ? $payload['customer'] : null;
        $order = \is_array($payload['order'] ?? null) ? $payload['order'] : [];
        $contactEntry = \is_array($payload['contactEntry'] ?? null) ? $payload['contactEntry'] : null;

        return $this->json(
            $this->stateService->createArticleOrder($request->getSession(), $customerId, $customer, $order, $contactEntry),
            201,
        );
    }
}
