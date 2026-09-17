<?php

declare(strict_types=1);

namespace App\Address;

use App\Http\ApiProblemException;
use Symfony\Component\HttpFoundation\Session\SessionInterface;

final class AddressValidationService
{
    public function __construct(private readonly AddressLookupService $lookup, private readonly AddressSessionStore $sessions) {}

    public function validate(SessionInterface $session, array $payload): array
    {
        $id = AddressSessionStore::validateId($payload['formSessionId'] ?? null);
        $address = PostalAddress::fromPayload($payload);
        $buffer = $this->sessions->remembered($session, $id);
        $baseNumber = preg_replace('/[A-Z]$/', '', $address['houseNumber']);
        $sameScope = null !== $buffer && $buffer['postalCode'] === $address['postalCode'] && $buffer['houseNumber'] === $baseNumber;
        if (null !== $buffer) {
            foreach ($buffer['result']['candidates'] ?? [] as $candidate) {
                if (($candidate['verified'] ?? false) && PostalAddress::same($address, $candidate)) {
                    return $candidate;
                }
            }
            if ($sameScope && ($buffer['result']['complete'] ?? false) && !($buffer['result']['postcodeRelaxed'] ?? false)) {
                throw new ApiProblemException(422, 'address_not_found', 'Dit volledige adres komt niet voor in de adresdatabase. Kies een geldig adres.');
            }
        }
        $query = new AddressQuery($address['postalCode'], $baseNumber, '');
        $result = $this->lookup->search($query, $id, $session, true);
        $this->sessions->remember($session, $id, $query, $result);
        foreach ($result['candidates'] ?? [] as $candidate) {
            if (($candidate['verified'] ?? false) && PostalAddress::same($address, $candidate)) {
                return $candidate;
            }
        }
        $complete = $result['complete'] ?? false;
        throw new ApiProblemException($complete ? 422 : 503, $complete ? 'address_not_found' : 'address_unconfirmed',
            $complete ? 'Dit volledige adres komt niet voor in de adresdatabase. Kies een geldig adres.' : 'Het volledige adres kon niet worden bevestigd. Opslaan is geblokkeerd; probeer opnieuw.');
    }

    public function validatePerson(SessionInterface $session, array $payload): array
    {
        // Older UI payloads also carry a display address; derive the street only when
        // it ends with the submitted number, never guess a missing number/addition.
        if (!isset($payload['street'])) {
            $suffix = trim(($payload['houseNumber'] ?? '').' '.($payload['houseNumberAddition'] ?? ''));
            $display = trim($payload['address'] ?? '');
            $payload['street'] = '' !== $suffix && str_ends_with($display, ' '.$suffix)
                ? substr($display, 0, -strlen($suffix) - 1) : $display;
        }
        if (!isset($payload['formSessionId'])) {
            $hex = bin2hex(random_bytes(16));
            $payload['formSessionId'] = sprintf('%s-%s-4%s-a%s-%s', substr($hex, 0, 8), substr($hex, 8, 4), substr($hex, 13, 3), substr($hex, 17, 3), substr($hex, 20));
        }
        $address = $this->validate($session, $payload);
        unset($address['verified']);
        $payload = array_replace($payload, $address);
        unset($payload['formSessionId']);
        $payload['address'] = trim($address['street'].' '.$address['houseNumber'].' '.$address['houseNumberAddition']);

        return $payload;
    }
}
