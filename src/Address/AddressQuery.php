<?php

declare(strict_types=1);

namespace App\Address;

use App\Http\ApiProblemException;

final readonly class AddressQuery
{
    public function __construct(
        public string $postalCode,
        public string $houseNumber,
        public string $addition,
    ) {
    }

    public static function fromPayload(array $payload): self
    {
        foreach (['postalCode', 'houseNumber', 'houseNumberAddition'] as $key) {
            if (isset($payload[$key]) && !is_string($payload[$key])) {
                throw new ApiProblemException(400, 'invalid_payload', $key.' must be a string');
            }
        }
        $postalCode = strtoupper(preg_replace('/\s+/', '', $payload['postalCode'] ?? '') ?? '');
        $houseNumber = strtoupper(trim($payload['houseNumber'] ?? ''));
        $addition = strtoupper(trim($payload['houseNumberAddition'] ?? ''));
        if (!preg_match('/^[1-9][0-9]{3}[A-Z]{2}$/D', $postalCode)
            || !preg_match('/^([1-9][0-9]{0,5})([A-Z]?)$/D', $houseNumber, $parts)
            || strlen($addition) > 10
            || !preg_match('/^[A-Z0-9\s\/-]*$/D', $addition)) {
            throw new ApiProblemException(400, 'invalid_address', 'A valid Dutch postcode and house number are required');
        }
        $letter = $parts[2];
        if ('' !== $letter && !str_starts_with($addition, $letter)) {
            $addition = trim($letter.' '.$addition);
        }

        return new self($postalCode, $parts[1], $addition);
    }

    public static function compact(string $value): string
    {
        return strtoupper(preg_replace('/[\s-]+/', '', $value) ?? '');
    }
}
