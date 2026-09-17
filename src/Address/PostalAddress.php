<?php

declare(strict_types=1);

namespace App\Address;

use App\Http\ApiProblemException;

/** Canonical address fields for validation and Paradise submission. */
final class PostalAddress
{
    public static function fromPayload(array $payload): array
    {
        foreach (['postalCode', 'houseNumber', 'houseNumberAddition', 'street', 'city'] as $field) {
            if (isset($payload[$field]) && !is_string($payload[$field])) {
                throw new ApiProblemException(422, 'invalid_address', 'Ongeldig adresveld.');
            }
        }
        $number = strtoupper(trim($payload['houseNumber'] ?? ''));
        $postcode = strtoupper(preg_replace('/\s+/', '', $payload['postalCode'] ?? '') ?? '');
        if (!preg_match('/^[1-9][0-9]{0,5}[A-Z]?$/D', $number) || !preg_match('/^[1-9][0-9]{3}[A-Z]{2}$/D', $postcode)) {
            throw new ApiProblemException(422, 'invalid_address', 'Controleer postcode en huisnummer. Gebruik alleen cijfers en maximaal één huisletter.');
        }
        $addition = strtoupper(trim($payload['houseNumberAddition'] ?? ''));
        $street = trim($payload['street'] ?? '');
        $city = mb_strtoupper(trim($payload['city'] ?? ''));
        if ('' === $street || '' === $city || strlen($addition) > 10 || strlen($street) > 200 || strlen($city) > 200) {
            throw new ApiProblemException(422, 'invalid_address', 'Vul een volledig adres in.');
        }

        return ['postalCode' => $postcode, 'houseNumber' => $number, 'houseNumberAddition' => $addition,
            'street' => $street, 'city' => $city, 'countryCode' => 'NL'];
    }

    public static function fromCandidate(array $candidate): array
    {
        $number = strtoupper(trim((string) $candidate['houseNumber']));
        $addition = strtoupper(trim($candidate['addition']));
        // ACI combines the Dutch suffix in houseNumberAddition. Move a single leading
        // house letter to Paradise's number; retain the remaining suffix separately.
        if (preg_match('/^[1-9][0-9]*$/D', $number) && preg_match('/^([A-Z])(?:\s*(\d.*))?$/D', $addition, $parts)) {
            $number .= $parts[1];
            $addition = trim($parts[2] ?? '');
        }

        return self::fromPayload(['postalCode' => $candidate['postalCode'], 'houseNumber' => $number,
            'houseNumberAddition' => $addition, 'street' => $candidate['street'], 'city' => $candidate['city']]);
    }

    public static function same(array $left, array $right): bool
    {
        foreach (['postalCode', 'houseNumber', 'houseNumberAddition', 'street', 'city'] as $field) {
            if (mb_strtoupper(trim($left[$field] ?? '')) !== mb_strtoupper(trim($right[$field] ?? ''))) {
                return false;
            }
        }

        return true;
    }
}
