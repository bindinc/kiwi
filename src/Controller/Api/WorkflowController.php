<?php

declare(strict_types=1);

namespace App\Controller\Api;

use App\Http\ApiProblemException;
use App\Http\JsonRequestDecoder;
use App\Address\CustomerAddressGate;
use App\Address\AddressValidationService;
use App\Oidc\OidcConfiguration;
use App\Oidc\OidcRoleAccess;
use App\Oidc\RequestOidcContext;
use App\Service\PocStateService;
use App\Service\SubscriptionQueueService;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/v1/workflows')]
final class WorkflowController extends AbstractApiController
{
    public function __construct(
        RequestOidcContext $requestOidcContext,
        OidcRoleAccess $oidcRoleAccess,
        OidcConfiguration $oidcConfiguration,
        JsonRequestDecoder $jsonRequestDecoder,
        private readonly CustomerAddressGate $addressGate,
        private readonly PocStateService $stateService,
        private readonly \App\OutboxSession\DeferredCustomerWrites $deferredWrites,
        private readonly SubscriptionQueueService $subscriptionQueueService,
        private readonly \App\OutboxSession\SessionOutbox $outbox,
    ) {
        parent::__construct($requestOidcContext, $oidcRoleAccess, $oidcConfiguration, $jsonRequestDecoder);
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

    #[Route('/subscription/submission/{submissionId}', name: 'api_workflow_subscription_status_by_submission', methods: ['GET'], priority: 2)]
    public function subscriptionStatusBySubmission(Request $request, string $submissionId): JsonResponse
    {
        $this->requireApiAccess($request);

        return $this->json($this->outbox->findSubmission($submissionId) ?? $this->subscriptionQueueService->getOrderStatusBySubmissionId($submissionId));
    }

    #[Route('/subscription', name: 'api_workflow_subscription_queue', methods: ['POST'])]
    #[Route('/subscription-signup', name: 'api_workflow_subscription_signup', methods: ['POST'])]
    public function queueSubscription(Request $request, AddressValidationService $validator): JsonResponse
    {
        $this->requireApiAccess($request);
        $payload = $this->parseJsonObject($request);

        foreach (['recipient', 'requester'] as $role) {
            if (isset($payload[$role]['personId'])) {
                $credentialKey = (string) ($payload[$role]['credentialKey'] ?? $payload[$role]['person']['credentialKey'] ?? '');
                $payload[$role]['person'] = $this->addressGate->requireCustomer($request, (string) $payload[$role]['personId'], $credentialKey);
                if (array_key_exists('personEdits', $payload[$role])) {
                    $person = \App\Service\SubscriptionPersonEdits::apply($payload[$role]['person'], $payload[$role]['personEdits']);
                    $payload[$role]['person'] = $validator->validatePerson($request->getSession(), $person);
                    unset($payload[$role]['personEdits']);
                }
            }
            if (is_array($payload[$role]['person'] ?? null) && !isset($payload[$role]['personId'])) {
                $payload[$role]['person'] = $validator->validatePerson($request->getSession(), $payload[$role]['person']);
            }
        }

        return $this->json(
            $this->deferredWrites->subscription(
                $request,
                $payload,
                $this->subscriptionQueueService,
            ),
            202,
        );
    }

    #[Route('/article-order', name: 'api_workflow_article_order', methods: ['POST'])]
    public function articleOrder(Request $request, AddressValidationService $validator): JsonResponse
    {
        $this->requireApiAccess($request);
        $payload = $this->parseJsonObject($request);

        $customerId = $this->parseIntValue($payload['customerId'] ?? null, 'customerId', null, false, 1);
        if (null !== $customerId) {
            $this->addressGate->requireCustomer($request, $customerId);
        }
        $customer = \is_array($payload['customer'] ?? null) ? $payload['customer'] : null;
        if (null !== $customer) {
            $customer = $validator->validatePerson($request->getSession(), $customer);
        }
        $order = \is_array($payload['order'] ?? null) ? $payload['order'] : [];
        $contactEntry = \is_array($payload['contactEntry'] ?? null) ? $payload['contactEntry'] : null;

        return $this->json(
            $this->deferredWrites->stage($request, 'createArticleOrder', $customerId, $customer, $order, $contactEntry),
            201,
        );
    }
}
