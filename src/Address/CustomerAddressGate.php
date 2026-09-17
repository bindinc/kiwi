<?php

declare(strict_types=1);

namespace App\Address;

use App\CustomerWorkSession\CustomerReference;
use App\Http\ApiProblemException;
use App\Service\PocStateService;
use App\SubscriptionApi\PersonDetailService;
use Symfony\Component\HttpFoundation\Request;

/** Checks authoritative person data; client snapshots never grant mutation access. */
final class CustomerAddressGate
{
    public function __construct(
        private readonly AddressValidationService $validator,
        private readonly AddressSessionStore $sessions,
        private readonly PocStateService $state,
        private readonly PersonDetailService $persons,
    ) {}

    public function check(Request $request, array $customer): array
    {
        $id = $this->sessionId($request, $customer);
        try {
            $this->validator->validatePerson($request->getSession(), array_replace($customer, ['formSessionId' => $id]));
            return ['status' => 'confirmed', 'formSessionId' => $id];
        } catch (ApiProblemException $error) {
            return ['status' => 'blocked', 'formSessionId' => $id, 'reason' => $error->getErrorCode()];
        }
    }

    public function requireCustomer(Request $request, string|int $personId, string $credentialKey = ''): array
    {
        try {
            $customer = '' === $credentialKey
                ? $this->state->getCustomer($request->getSession(), (int) $personId)
                : $this->persons->getPerson((string) $personId, $credentialKey, true);
        } catch (ApiProblemException $error) {
            throw $error;
        } catch (\RuntimeException) {
            throw new ApiProblemException(503, 'customer_address_unconfirmed', 'Het klantadres kon niet worden gecontroleerd. Mutaties zijn geblokkeerd.');
        }
        $customer['credentialKey'] = $credentialKey;
        $result = $this->check($request, $customer);
        if ('confirmed' !== $result['status']) {
            throw new ApiProblemException(409, 'customer_address_unconfirmed',
                'Controleer en corrigeer eerst het klantadres voordat andere wijzigingen worden opgeslagen.', $result);
        }

        return $this->validator->validatePerson($request->getSession(), array_replace($customer,
            ['formSessionId' => $result['formSessionId']]));
    }

    public function rememberCorrection(Request $request, array $customer): void
    {
        $address = PostalAddress::fromPayload($customer);
        $query = new AddressQuery($address['postalCode'], preg_replace('/[A-Z]$/', '', $address['houseNumber']), '');
        $this->sessions->remember($request->getSession(), $this->sessionId($request, $customer), $query,
            ['candidates' => [$address + ['verified' => true]], 'complete' => false]);
    }

    public function close(Request $request, array $context): void
    {
        $reference = $context['customerReference'] ?? null;
        if (is_array($reference)) {
            $this->sessions->close($request->getSession(), $this->sessionId($request, $reference, $context['workflowSessionId'] ?? null));
        }
    }

    public function sessionId(Request $request, array $customer, ?string $workflowId = null): string
    {
        $reference = CustomerReference::fromArray($customer);
        $workflowId ??= $request->headers->get('X-Kiwi-Workflow-Session-Id', 'legacy');
        // The authenticated PostgreSQL session scopes this identifier to one browser login.
        // Different workflow ids (tabs/customer sessions) receive independent provider UUIDs.
        $hash = hash('sha256', json_encode([$workflowId, $reference?->personId, $reference?->credentialKey]));
        return substr($hash, 0, 8).'-'.substr($hash, 8, 4).'-'.substr($hash, 12, 4).'-'.substr($hash, 16, 4).'-'.substr($hash, 20, 12);
    }
}
