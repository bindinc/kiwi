<?php

declare(strict_types=1);

namespace App\Controller\Api;

use App\CustomerWorkSession\CustomerAuditService;
use App\Http\JsonRequestDecoder;
use App\Http\RequestCorrelationId;
use App\Oidc\OidcConfiguration;
use App\Oidc\OidcRoleAccess;
use App\Oidc\RequestOidcContext;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/v1/customer-work-sessions')]
final class CustomerWorkSessionController extends AbstractApiController
{
    public function __construct(
        RequestOidcContext $requestOidcContext,
        OidcRoleAccess $oidcRoleAccess,
        OidcConfiguration $oidcConfiguration,
        JsonRequestDecoder $jsonRequestDecoder,
        private readonly CustomerAuditService $customerAuditService,
        private readonly RequestCorrelationId $requestCorrelationId,
    ) {
        parent::__construct($requestOidcContext, $oidcRoleAccess, $oidcConfiguration, $jsonRequestDecoder);
    }

    #[Route('/reset', name: 'api_customer_work_session_reset', methods: ['POST'])]
    public function reset(Request $request): JsonResponse
    {
        $this->requireApiAccess($request);
        $payload = $this->parseJsonObject($request);
        $this->customerAuditService->recordSessionReset(
            $request,
            $this->getCurrentUserContext($request),
            $payload,
        );

        return $this->json([
            'status' => 'customer_work_session_reset_recorded',
            'requestId' => $this->requestCorrelationId->getOrCreate($request),
        ]);
    }
}
