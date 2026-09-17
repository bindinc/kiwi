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
    public function search(Request $request, AddressLookupService $lookup): JsonResponse
    {
        $this->requireApiAccess($request);
        $payload = $this->parseJsonObject($request);
        $id = AddressSessionStore::validateId($payload['formSessionId'] ?? null);
        unset($payload['houseNumberAddition']);
        $query = AddressQuery::fromPayload($payload);
        $result = $lookup->search($query, $id, $request->getSession(), includeCandidates: true);

        return new JsonResponse($result, 200, ['Cache-Control' => 'no-store']);
    }

    #[Route('/sessions/{formSessionId}', name: 'api_address_session_close', methods: ['DELETE'])]
    public function close(Request $request, string $formSessionId, AddressSessionStore $sessions): JsonResponse
    {
        $this->requireApiAccess($request);
        $sessions->close($request->getSession(), AddressSessionStore::validateId($formSessionId));

        return new JsonResponse(null, 204, ['Cache-Control' => 'no-store']);
    }
}
