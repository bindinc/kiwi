<?php

declare(strict_types=1);

namespace App\Controller\Api;

use App\CustomerWorkSession\CustomerAuditService;
use App\Http\ApiProblemException;
use App\Http\JsonRequestDecoder;
use App\Address\CustomerAddressGate;
use App\Address\AddressValidationService;
use App\Address\PostalAddress;
use App\SubscriptionApi\PersonSearchClient;
use App\Oidc\OidcConfiguration;
use App\Oidc\OidcRoleAccess;
use App\Oidc\RequestOidcContext;
use App\SubscriptionApi\AggregatedPersonSearchService;
use App\SubscriptionApi\PersonDetailService;
use App\SubscriptionApi\SubscriptionApiResponseException;
use App\SubscriptionApi\SubscriptionSummaryService;
use App\Service\PocStateService;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/v1/persons')]
final class CustomerController extends AbstractApiController
{
    public function __construct(
        RequestOidcContext $requestOidcContext,
        OidcRoleAccess $oidcRoleAccess,
        OidcConfiguration $oidcConfiguration,
        JsonRequestDecoder $jsonRequestDecoder,
        private readonly CustomerAddressGate $addressGate,
        private readonly PocStateService $stateService,
        private readonly AggregatedPersonSearchService $aggregatedPersonSearchService,
        private readonly PersonDetailService $personDetailService,
        private readonly SubscriptionSummaryService $subscriptionSummaryService,
        private readonly CustomerAuditService $customerAuditService,
    ) {
        parent::__construct($requestOidcContext, $oidcRoleAccess, $oidcConfiguration, $jsonRequestDecoder);
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
            'customerNumber' => (string) $request->query->get('customerNumber', ''),
            'email' => (string) $request->query->get('email', ''),
            'iban' => (string) $request->query->get('iban', ''),
            'birthDate' => (string) $request->query->get('birthDate', ''),
            'phone' => (string) $request->query->get('phone', ''),
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
                $result = $this->aggregatedPersonSearchService->search(
                    $filters,
                    $page,
                    $pageSize,
                    $sortBy,
                    $allowedDivisionIds,
                    $allowedMandants,
                );
            } catch (\Throwable $exception) {
                throw new ApiProblemException(
                    503,
                    'customer_search_unavailable',
                    'Klant zoeken via subscription API is tijdelijk niet beschikbaar.',
                );
            }
        } else {
            $result = $this->stateService->searchCustomers($request->getSession(), $filters + [
                'mandants' => implode(',', $allowedMandants),
                'sortBy' => $sortBy,
            ], $page, $pageSize);
        }

        $auditFilters = $filters + [
            'divisionIds' => $allowedDivisionIds,
            'mandants' => $allowedMandants,
        ];
        $resultCount = \is_array($result['items'] ?? null) ? count($result['items']) : 0;
        $this->customerAuditService->recordSearchPerformed(
            $request,
            $this->getCurrentUserContext($request),
            $auditFilters,
            $resultCount,
        );

        return $this->json($result);
    }

    #[Route('/subscription-summaries', name: 'api_customer_subscription_summaries', methods: ['POST'], priority: 2)]
    public function readSubscriptionSummaries(Request $request): JsonResponse
    {
        $this->requireApiAccess($request);
        $payload = $this->parseJsonObject($request);
        $persons = $this->parseSubscriptionSummaryPersons($payload['persons'] ?? null);

        return $this->json([
            'items' => $this->subscriptionSummaryService->summarize($persons),
        ]);
    }

    #[Route('', name: 'api_customers_create', methods: ['POST'])]
    public function createCustomer(Request $request, AddressValidationService $validator): JsonResponse
    {
        $this->requireApiAccess($request);
        $payload = $this->parseJsonObject($request);

        $payload = $validator->validatePerson($request->getSession(), $payload);

        return $this->json($this->stateService->createCustomer($request->getSession(), $payload), 201);
    }

    #[Route('/state', name: 'api_customers_state_read', methods: ['GET'])]
    public function readCustomerState(Request $request): JsonResponse
    {
        $this->requireApiAccess($request);

        return $this->json($this->stateService->getCustomerState($request->getSession()));
    }

    #[Route('/state', name: 'api_customers_state_write', methods: ['PUT'])]
    public function writeCustomerState(Request $request, AddressValidationService $validator): JsonResponse
    {
        $this->requireApiAccess($request);
        $payload = $this->parseJsonObject($request);

        $customers = $payload['customers'] ?? null;
        if (!\is_array($customers)) {
            throw new ApiProblemException(400, 'invalid_payload', 'customers must be an array');
        }

        $existing = $this->stateService->getCustomerState($request->getSession())['customers'];
        $byId = array_column($existing, null, 'id');
        foreach ($customers as &$customer) {
            if (!is_array($customer)) {
                throw new ApiProblemException(400, 'invalid_payload', 'Invalid customer');
            }
            $previous = $byId[$customer['id'] ?? ''] ?? [];
            if ($previous !== $customer) {
                $customer = $validator->validatePerson($request->getSession(), $customer);
            }
        }
        unset($customer);
        $retainedIds = array_column($customers, 'id');
        foreach ($existing as $previous) {
            if (!in_array($previous['id'], $retainedIds, true)) {
                $this->addressGate->requireCustomer($request, $previous['id']);
            }
        }

        return $this->json($this->stateService->replaceCustomers($request->getSession(), $customers));
    }

    #[Route('/{customerId}', name: 'api_customer_read', methods: ['GET'], requirements: ['customerId' => '[^/]+' ])]
    public function readCustomer(Request $request, string $customerId): JsonResponse
    {
        $this->requireApiAccess($request);

        $credentialKey = trim((string) $request->query->get('credentialKey', ''));
        if ('' !== $credentialKey) {
            $customer = $this->readSubscriptionApiCustomer($customerId, $credentialKey);
        } else {
            $numericCustomerId = $this->parseIntValue($customerId, 'customerId', required: true, errorCode: 'invalid_route_parameter');
            $customer = $this->stateService->getCustomer($request->getSession(), $numericCustomerId);
        }

        $this->customerAuditService->recordProfileOpened(
            $request,
            $this->getCurrentUserContext($request),
            $customer,
            $customerId,
        );

        $customer['addressValidation'] = $this->addressGate->check($request, $customer);

        return $this->json($customer);
    }

    #[Route('/{customerId}/address', name: 'api_customer_address_update', methods: ['PATCH'], requirements: ['customerId' => '[^/]+'])]
    public function correctExternalAddress(Request $request, string $customerId, AddressValidationService $validator, PersonSearchClient $client): JsonResponse
    {
        $this->requireApiAccess($request);
        $credentialKey = trim((string) $request->query->get('credentialKey', ''));
        if ('' === $credentialKey) {
            throw new ApiProblemException(400, 'invalid_customer_lookup', 'credentialKey is required');
        }
        $payload = $this->parseJsonObject($request);
        $allowed = ['formSessionId', 'postalCode', 'houseNumber', 'houseNumberAddition', 'street', 'city', 'countryCode'];
        if (array_diff(array_keys($payload), $allowed)) {
            throw new ApiProblemException(400, 'invalid_payload', 'Only address fields may be changed through this endpoint.');
        }
        $address = $validator->validatePerson($request->getSession(), $payload);
        // Resolve the person with the selected credential before modifying its main address.
        $this->readSubscriptionApiCustomer($customerId, $credentialKey);
        try {
            $client->updateMainAddress($customerId, $credentialKey, $address);
        } catch (\RuntimeException) {
            throw new ApiProblemException(503, 'address_correction_unconfirmed', 'De adreswijziging kon niet worden bevestigd. Controleer opnieuw voordat je nogmaals opslaat.');
        }
        $customer = $this->readSubscriptionApiCustomer($customerId, $credentialKey);
        if (!PostalAddress::same($address, $customer)) {
            throw new ApiProblemException(409, 'address_correction_unconfirmed', 'Het bronsysteem bevestigt het gewijzigde adres nog niet. Controleer opnieuw.');
        }
        $this->addressGate->rememberCorrection($request, $customer);
        $customer['addressValidation'] = $this->addressGate->check($request, $customer);
        return $this->json($customer);
    }

    #[Route('/{customerId}', name: 'api_customer_update', methods: ['PATCH'], requirements: ['customerId' => '\d+'])]
    public function updateCustomer(Request $request, int $customerId, AddressValidationService $validator): JsonResponse
    {
        $this->requireApiAccess($request);
        $payload = $this->parseJsonObject($request);

        if (array_intersect(['postalCode', 'houseNumber', 'houseNumberAddition', 'address', 'street', 'city'], array_keys($payload))) {
            $existing = $this->stateService->getCustomer($request->getSession(), $customerId);
            $payload = $validator->validatePerson($request->getSession(), array_replace($existing, $payload));
        } else {
            $this->addressGate->requireCustomer($request, $customerId);
        }
        $customer = $this->stateService->updateCustomer($request->getSession(), $customerId, $payload);
        if (isset($payload['street'])) {
            $this->addressGate->rememberCorrection($request, $customer);
        }
        $customer['addressValidation'] = $this->addressGate->check($request, $customer);

        return $this->json($customer);
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
        $this->addressGate->requireCustomer($request, $customerId);
        $payload = $this->parseJsonObject($request);

        return $this->json($this->stateService->createContactHistoryEntry($request->getSession(), $customerId, $payload), 201);
    }

    #[Route('/{customerId}/delivery-remarks', name: 'api_customer_delivery_remarks', methods: ['PUT'], requirements: ['customerId' => '\d+'])]
    public function updateDeliveryRemarks(Request $request, int $customerId): JsonResponse
    {
        $this->requireApiAccess($request);
        $this->addressGate->requireCustomer($request, $customerId);
        $payload = $this->parseJsonObject($request);

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
        $this->addressGate->requireCustomer($request, $customerId);
        $payload = $this->parseJsonObject($request);

        return $this->json($this->stateService->createEditorialComplaint($request->getSession(), $customerId, $payload), 201);
    }

    #[Route('/{customerId}/article-orders', name: 'api_customer_article_orders', methods: ['GET'], requirements: ['customerId' => '\d+'])]
    public function readArticleOrders(Request $request, int $customerId): JsonResponse
    {
        $this->requireApiAccess($request);

        return $this->json($this->stateService->getArticleOrders($request->getSession(), $customerId));
    }

    /**
     * @return array<string, mixed>
     */
    private function readSubscriptionApiCustomer(string $customerId, string $credentialKey): array
    {
        try {
            return $this->personDetailService->getPerson($customerId, $credentialKey, true);
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
     * @return list<array{personId: string, credentialKey: string}>
     */
    private function parseSubscriptionSummaryPersons(mixed $rawPersons): array
    {
        if (!\is_array($rawPersons) || [] === $rawPersons) {
            throw new ApiProblemException(400, 'invalid_payload', 'persons must be a non-empty array');
        }

        $personsByKey = [];
        foreach ($rawPersons as $index => $rawPerson) {
            if (!\is_array($rawPerson)) {
                throw new ApiProblemException(400, 'invalid_payload', sprintf('persons[%d] must be an object', $index));
            }

            $personId = $this->normalizeSubscriptionSummaryIdentifier($rawPerson['personId'] ?? null);
            $credentialKey = $this->normalizeSubscriptionSummaryIdentifier($rawPerson['credentialKey'] ?? null);
            $personsByKey[sprintf('%s\0%s', $credentialKey, $personId)] = [
                'personId' => $personId,
                'credentialKey' => $credentialKey,
            ];
        }

        if (count($personsByKey) > 20) {
            throw new ApiProblemException(400, 'invalid_payload', 'persons must contain at most 20 unique entries');
        }

        return array_values($personsByKey);
    }

    private function normalizeSubscriptionSummaryIdentifier(mixed $rawValue): string
    {
        if (!\is_string($rawValue) && !\is_int($rawValue)) {
            throw new ApiProblemException(400, 'invalid_payload', 'personId and credentialKey must be non-empty strings');
        }

        $value = trim((string) $rawValue);
        if ('' === $value) {
            throw new ApiProblemException(400, 'invalid_payload', 'personId and credentialKey must be non-empty strings');
        }

        return $value;
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
