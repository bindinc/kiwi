<?php

declare(strict_types=1);

namespace App\Controller\Api;

use App\Http\ApiProblemException;
use App\Oidc\OidcClient;
use App\Service\PocStateService;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api/v1/workflows')]
final class WorkflowController extends AbstractApiController
{
    public function __construct(
        OidcClient $oidcClient,
        private readonly PocStateService $stateService,
    ) {
        parent::__construct($oidcClient);
    }

    #[Route('/subscription-signup', name: 'api_workflow_subscription_signup', methods: ['POST'])]
    public function subscriptionSignup(Request $request): JsonResponse
    {
        $this->requireApiAccess($request);
        $payload = json_decode($request->getContent(), true);
        if (!\is_array($payload)) {
            throw new ApiProblemException(400, 'invalid_payload', 'JSON object expected');
        }

        return $this->json($this->stateService->createSubscriptionSignup($request->getSession(), $payload), 201);
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
