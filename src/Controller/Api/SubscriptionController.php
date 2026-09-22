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
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/v1/subscriptions')]
final class SubscriptionController extends AbstractApiController
{
    public function __construct(
        RequestOidcContext $requestOidcContext,
        OidcRoleAccess $oidcRoleAccess,
        OidcConfiguration $oidcConfiguration,
        JsonRequestDecoder $jsonRequestDecoder,
        private readonly CustomerAddressGate $addressGate,
        private readonly PocStateService $stateService,
        private readonly \App\OutboxSession\DeferredCustomerWrites $deferredWrites,
    ) {
        parent::__construct($requestOidcContext, $oidcRoleAccess, $oidcConfiguration, $jsonRequestDecoder);
    }

    #[Route('/{customerId}/{subscriptionId}', name: 'api_subscription_update', methods: ['PATCH'], requirements: ['customerId' => '\d+', 'subscriptionId' => '\d+'])]
    public function updateSubscription(Request $request, int $customerId, int $subscriptionId): JsonResponse
    {
        $this->requireApiAccess($request);
        $this->addressGate->requireCustomer($request, $customerId);
        $payload = $this->parseJsonObject($request);

        return $this->json($this->deferredWrites->stage($request, 'updateSubscription', $customerId, $subscriptionId, $payload));
    }

    #[Route('/{customerId}/{subscriptionId}/complaint', name: 'api_subscription_complaint', methods: ['POST'], requirements: ['customerId' => '\d+', 'subscriptionId' => '\d+'])]
    public function createComplaint(Request $request, int $customerId, int $subscriptionId): JsonResponse
    {
        $this->requireApiAccess($request);
        $this->addressGate->requireCustomer($request, $customerId);
        $payload = $this->parseJsonObject($request);

        return $this->json($this->deferredWrites->stage($request, 'createSubscriptionComplaint',
            $customerId,
            $subscriptionId,
            (string) ($payload['reason'] ?? 'other'),
        ));
    }

    #[Route('/{customerId}/{subscriptionId}', name: 'api_subscription_complete_winback', methods: ['POST'], requirements: ['customerId' => '\d+', 'subscriptionId' => '\d+'])]
    public function completeWinback(Request $request, int $customerId, int $subscriptionId): JsonResponse
    {
        $this->requireApiAccess($request);
        $this->addressGate->requireCustomer($request, $customerId);
        $payload = $this->parseJsonObject($request);

        return $this->json($this->deferredWrites->stage($request, 'completeWinback',
            $customerId,
            $subscriptionId,
            \is_string($payload['result'] ?? null) ? $payload['result'] : null,
            \is_array($payload['offer'] ?? null) ? $payload['offer'] : [],
        ));
    }

    #[Route('/{customerId}/deceased-actions', name: 'api_subscription_deceased_actions', methods: ['POST'], requirements: ['customerId' => '\d+'])]
    public function processDeceasedActions(Request $request, int $customerId, AddressValidationService $validator): JsonResponse
    {
        $this->requireApiAccess($request);
        $this->addressGate->requireCustomer($request, $customerId);
        $payload = $this->parseJsonObject($request);

        $actions = \is_array($payload['actions'] ?? null) ? $payload['actions'] : [];
        foreach ($actions as $index => $action) {
            if (is_array($action) && 'transfer' === ($action['action'] ?? null)) {
                $transfer = is_array($action['transferData'] ?? null) ? $action['transferData'] : [];
                $actions[$index]['transferData'] = $validator->validatePerson($request->getSession(), $transfer);
            }
        }

        return $this->json($this->deferredWrites->stage($request, 'processDeceasedActions', $customerId, $actions));
    }

    #[Route('/{customerId}/{subscriptionId}/restitution-transfer', name: 'api_subscription_restitution_transfer', methods: ['POST'], requirements: ['customerId' => '\d+', 'subscriptionId' => '\d+'])]
    public function completeRestitutionTransfer(Request $request, int $customerId, int $subscriptionId, AddressValidationService $validator): JsonResponse
    {
        $this->requireApiAccess($request);
        $this->addressGate->requireCustomer($request, $customerId);
        $payload = $this->parseJsonObject($request);

        $transferData = $validator->validatePerson($request->getSession(), \is_array($payload['transferData'] ?? null) ? $payload['transferData'] : []);

        return $this->json($this->deferredWrites->stage($request, 'completeRestitutionTransfer',
            $customerId,
            $subscriptionId,
            $transferData,
        ));
    }
}
