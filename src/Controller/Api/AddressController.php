<?php

declare(strict_types=1);

namespace App\Controller\Api;

use App\Address\AddressLookupService;
use App\Address\AddressQuery;
use App\Address\AddressSessionStore;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/v1/addresses')]
final class AddressController extends AbstractApiController
{
    #[Route('/search', name: 'api_address_search', methods: ['POST'])]
    public function search(Request $request, AddressLookupService $lookup, AddressSessionStore $sessions): JsonResponse
    {
        $this->requireApiAccess($request);
        $payload = $this->parseJsonObject($request);
        $id = AddressSessionStore::validateId($payload['formSessionId'] ?? null);
        unset($payload['houseNumberAddition']);
        $query = AddressQuery::fromSearchPayload($payload);
        $result = $lookup->search($query, $id, $request->getSession(), includeCandidates: true);

        $sessions->remember($request->getSession(), $id, $query, $result);

        return new JsonResponse($result, 200, ['Cache-Control' => 'no-store']);
    }

    #[Route('/validate', name: 'api_address_validate', methods: ['POST'])]
    public function validateAddress(Request $request, \App\Address\AddressValidationService $validator): JsonResponse
    {
        $this->requireApiAccess($request);
        $address = $validator->validate($request->getSession(), $this->parseJsonObject($request));

        return new JsonResponse(['status' => 'confirmed', 'address' => $address], 200, ['Cache-Control' => 'no-store']);
    }

    #[Route('/sessions/{formSessionId}', name: 'api_address_session_close', methods: ['DELETE'])]
    public function close(Request $request, string $formSessionId, AddressSessionStore $sessions): JsonResponse
    {
        $this->requireApiAccess($request);
        $sessions->close($request->getSession(), AddressSessionStore::validateId($formSessionId));

        return new JsonResponse(null, 204, ['Cache-Control' => 'no-store']);
    }
}
