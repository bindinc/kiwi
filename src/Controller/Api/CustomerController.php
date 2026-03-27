<?php

declare(strict_types=1);

namespace App\Controller\Api;

use App\Http\ApiProblemException;
use App\Oidc\OidcClient;
use App\SubscriptionApi\AggregatedPersonSearchService;
use App\SubscriptionApi\PersonDetailService;
use App\SubscriptionApi\SubscriptionApiResponseException;
use App\Service\PocStateService;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api/v1/persons')]
final class CustomerController extends AbstractApiController
{
    public function __construct(
        OidcClient $oidcClient,
        private readonly PocStateService $stateService,
        private readonly AggregatedPersonSearchService $aggregatedPersonSearchService,
        private readonly PersonDetailService $personDetailService,
    ) {
        parent::__construct($oidcClient);
    }

    #[Route('', name: 'api_customers_read', methods: ['GET'])]
    public function readCustomers(Request $request): JsonResponse
    {
        $this->requireApiAccess($request);

        $page = $this->parseQueryInt($request, 'page', 1, 1) ?? 1;
        $pageSize = $this->parseQueryInt($request, 'pageSize', 20, 1, 200) ?? 20;
        $filters = [
            'postalCode' => (string) $request->query->get('postalCode', ''),
            'houseNumber' => (string) $request->query->get('houseNumber', ''),
            'name' => (string) $request->query->get('name', ''),
            'phone' => (string) $request->query->get('phone', ''),
            'email' => (string) $request->query->get('email', ''),
        ];
        $sortBy = (string) $request->query->get('sortBy', 'name');
        $allowedDivisionIds = $this->parseCsvQueryList(
            (string) $request->query->get('divisionIds', $request->query->get('divisionId', ''))
        );
        $allowedMandants = $this->parseCsvQueryList(
            (string) $request->query->get('mandants', $request->query->get('mandant', ''))
        );

        if ($this->aggregatedPersonSearchService->isAvailable()) {
            try {
                return $this->json($this->aggregatedPersonSearchService->search(
                    $filters,
                    $page,
                    $pageSize,
                    $sortBy,
                    $allowedDivisionIds,
                    $allowedMandants,
                ));
            } catch (\Throwable $exception) {
                throw new ApiProblemException(
                    503,
                    'customer_search_unavailable',
                    'Klant zoeken via subscription API is tijdelijk niet beschikbaar.',
                );
            }
        }

        return $this->json($this->stateService->searchCustomers($request->getSession(), $filters + [
            'sortBy' => $sortBy,
        ], $page, $pageSize));
    }

    #[Route('', name: 'api_customers_create', methods: ['POST'])]
    public function createCustomer(Request $request): JsonResponse
    {
        $this->requireApiAccess($request);
        $payload = json_decode($request->getContent(), true);
        if (!\is_array($payload)) {
            throw new ApiProblemException(400, 'invalid_payload', 'JSON object expected');
        }

        return $this->json($this->stateService->createCustomer($request->getSession(), $payload), 201);
    }

    #[Route('/state', name: 'api_customers_state_read', methods: ['GET'])]
    public function readCustomerState(Request $request): JsonResponse
    {
        $this->requireApiAccess($request);

        return $this->json($this->stateService->getCustomerState($request->getSession()));
    }

    #[Route('/state', name: 'api_customers_state_write', methods: ['PUT'])]
    public function writeCustomerState(Request $request): JsonResponse
    {
        $this->requireApiAccess($request);
        $payload = json_decode($request->getContent(), true);
        if (!\is_array($payload)) {
            throw new ApiProblemException(400, 'invalid_payload', 'JSON object expected');
        }

        $customers = $payload['customers'] ?? null;
        if (!\is_array($customers)) {
            throw new ApiProblemException(400, 'invalid_payload', 'customers must be an array');
        }

        return $this->json($this->stateService->replaceCustomers($request->getSession(), $customers));
    }

    #[Route('/{customerId}', name: 'api_customer_read', methods: ['GET'], requirements: ['customerId' => '[^/]+' ])]
    public function readCustomer(Request $request, string $customerId): JsonResponse
    {
        $this->requireApiAccess($request);

        $credentialKey = trim((string) $request->query->get('credentialKey', ''));
        if ('' !== $credentialKey) {
            return $this->readSubscriptionApiCustomer($customerId, $credentialKey);
        }

        $numericCustomerId = $this->parseIntValue($customerId, 'customerId', required: true, errorCode: 'invalid_route_parameter');

        return $this->json($this->stateService->getCustomer($request->getSession(), $numericCustomerId));
    }

    #[Route('/{customerId}', name: 'api_customer_update', methods: ['PATCH'], requirements: ['customerId' => '\d+'])]
    public function updateCustomer(Request $request, int $customerId): JsonResponse
    {
        $this->requireApiAccess($request);
        $payload = json_decode($request->getContent(), true);
        if (!\is_array($payload)) {
            throw new ApiProblemException(400, 'invalid_payload', 'JSON object expected');
        }

        return $this->json($this->stateService->updateCustomer($request->getSession(), $customerId, $payload));
    }

    #[Route('/{customerId}/contact-history', name: 'api_customer_contact_history_read', methods: ['GET'], requirements: ['customerId' => '\d+'])]
    public function readContactHistory(Request $request, int $customerId): JsonResponse
    {
        $this->requireApiAccess($request);
        $page = $this->parseQueryInt($request, 'page', 1, 1) ?? 1;
        $pageSize = $this->parseQueryInt($request, 'pageSize', 20, 1, 200) ?? 20;

        return $this->json($this->stateService->getContactHistory($request->getSession(), $customerId, $page, $pageSize));
    }

    #[Route('/{customerId}/contact-history', name: 'api_customer_contact_history_create', methods: ['POST'], requirements: ['customerId' => '\d+'])]
    public function createContactHistory(Request $request, int $customerId): JsonResponse
    {
        $this->requireApiAccess($request);
        $payload = json_decode($request->getContent(), true);
        if (!\is_array($payload)) {
            throw new ApiProblemException(400, 'invalid_payload', 'JSON object expected');
        }

        return $this->json($this->stateService->createContactHistoryEntry($request->getSession(), $customerId, $payload), 201);
    }

    #[Route('/{customerId}/delivery-remarks', name: 'api_customer_delivery_remarks', methods: ['PUT'], requirements: ['customerId' => '\d+'])]
    public function updateDeliveryRemarks(Request $request, int $customerId): JsonResponse
    {
        $this->requireApiAccess($request);
        $payload = json_decode($request->getContent(), true);
        if (!\is_array($payload)) {
            throw new ApiProblemException(400, 'invalid_payload', 'JSON object expected');
        }

        return $this->json($this->stateService->updateDeliveryRemarks(
            $request->getSession(),
            $customerId,
            trim((string) ($payload['default'] ?? '')),
            (string) ($payload['updatedBy'] ?? 'Agent'),
        ));
    }

    #[Route('/{customerId}/editorial-complaints', name: 'api_customer_editorial_complaints', methods: ['POST'], requirements: ['customerId' => '\d+'])]
    public function createEditorialComplaint(Request $request, int $customerId): JsonResponse
    {
        $this->requireApiAccess($request);
        $payload = json_decode($request->getContent(), true);
        if (!\is_array($payload)) {
            throw new ApiProblemException(400, 'invalid_payload', 'JSON object expected');
        }

        return $this->json($this->stateService->createEditorialComplaint($request->getSession(), $customerId, $payload), 201);
    }

    #[Route('/{customerId}/article-orders', name: 'api_customer_article_orders', methods: ['GET'], requirements: ['customerId' => '\d+'])]
    public function readArticleOrders(Request $request, int $customerId): JsonResponse
    {
        $this->requireApiAccess($request);

        return $this->json($this->stateService->getArticleOrders($request->getSession(), $customerId));
    }

    private function readSubscriptionApiCustomer(string $customerId, string $credentialKey): JsonResponse
    {
        try {
            return $this->json($this->personDetailService->getPerson($customerId, $credentialKey));
        } catch (SubscriptionApiResponseException $exception) {
            if (404 === $exception->getStatusCode()) {
                throw new ApiProblemException(404, 'customer_not_found', 'Customer not found');
            }

            if (400 === $exception->getStatusCode()) {
                throw new ApiProblemException(400, 'invalid_customer_lookup', 'Customer lookup request is invalid');
            }

            throw new ApiProblemException(
                503,
                'customer_detail_unavailable',
                'Klantdetail via subscription API is tijdelijk niet beschikbaar.',
            );
        } catch (\RuntimeException) {
            throw new ApiProblemException(
                503,
                'customer_detail_unavailable',
                'Klantdetail via subscription API is tijdelijk niet beschikbaar.',
            );
        }
    }

    /**
     * @return list<string>
     */
    private function parseCsvQueryList(string $rawValue): array
    {
        $values = [];

        foreach (explode(',', $rawValue) as $value) {
            $normalizedValue = strtoupper(trim($value));
            if ('' === $normalizedValue || \in_array($normalizedValue, $values, true)) {
                continue;
            }

            $values[] = $normalizedValue;
        }

        return $values;
    }
}
