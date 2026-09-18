<?php

declare(strict_types=1);
namespace App\Controller\Api;

use App\Http\ApiProblemException;
use App\Http\JsonRequestDecoder;
use App\Http\RequestCorrelationId;
use App\SubscriptionApi\CustomerEditingService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/v1/persons/{personId}', requirements: ['personId' => '[A-Za-z0-9_-]{1,100}', 'resourceId' => '[A-Za-z0-9_-]{1,100}'])]
final class CustomerEditingController extends AbstractController
{
    public function __construct(private readonly CustomerEditingService $editing,
        private readonly JsonRequestDecoder $decoder, private readonly RequestCorrelationId $correlation) {}

    #[Route('/editing', name: 'api_customer_editing_read', methods: ['GET'])]
    public function read(Request $request, string $personId): JsonResponse
    {
        return $this->json($this->editing->read($personId, (string) $request->query->get('credentialKey', '')), headers: ['Cache-Control' => 'no-store']);
    }

    #[Route('/profile', name: 'api_customer_person_update', methods: ['PATCH'], defaults: ['operation' => 'person.update'])]
    #[Route('/addresses/{resourceId}', name: 'api_customer_address_update', methods: ['PATCH'], defaults: ['operation' => 'address.update'])]
    #[Route('/emails/{resourceId}', name: 'api_customer_email_update', methods: ['PATCH'], defaults: ['operation' => 'email.update'])]
    #[Route('/phones/{resourceId}', name: 'api_customer_phone_update', methods: ['PATCH'], defaults: ['operation' => 'phone.update'])]
    #[Route('/mobiles/{resourceId}', name: 'api_customer_mobile_update', methods: ['PATCH'], defaults: ['operation' => 'mobile.update'])]
    #[Route('/bank-accounts', name: 'api_customer_bank_create', methods: ['POST'], defaults: ['operation' => 'bank.create'])]
    #[Route('/bank-accounts/{resourceId}', name: 'api_customer_bank_update', methods: ['PATCH'], defaults: ['operation' => 'bank.update'])]
    #[Route('/bank-accounts/{resourceId}', name: 'api_customer_bank_delete', methods: ['DELETE'], defaults: ['operation' => 'bank.delete'])]
    public function mutate(Request $request, string $personId, string $operation, ?string $resourceId = null): JsonResponse
    {
        if ('json' !== $request->getContentTypeFormat()) {
            throw new ApiProblemException(415, 'json_required', 'Use application/json');
        }
        return $this->json($this->editing->mutate($personId, $resourceId, $operation,
            $this->decoder->decodeObject($request), (string) $request->headers->get('Idempotency-Key', ''),
            $this->correlation->getOrCreate($request)), headers: ['Cache-Control' => 'no-store']);
    }
}
