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
        public string $street = '',
        public string $city = '',
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

    public static function fromSearchPayload(array $payload): self
    {
        $values = [];
        foreach (['postalCode', 'houseNumber', 'street', 'city'] as $key) {
            $value = $payload[$key] ?? '';
            if (!is_string($value) || strlen($value) > 200) {
                throw new ApiProblemException(400, 'invalid_payload', 'Invalid address search field');
            }
            $values[$key] = trim($value);
        }
        $values['postalCode'] = self::compact($values['postalCode']);
        if ('' !== $values['postalCode'] && !preg_match('/^[1-9][0-9]{3}[A-Z]{2}$/D', $values['postalCode'])) {
            // An illegible postcode must not prevent searching the other coupon fields.
            $values['postalCode'] = '';
        }
        if ('' !== $values['houseNumber']) {
            if (!preg_match('/^([1-9][0-9]{0,5})[A-Z]?$/iD', $values['houseNumber'], $parts)) {
                throw new ApiProblemException(400, 'invalid_address', 'Invalid house number');
            }
            $values['houseNumber'] = $parts[1];
        }
        if (count(array_filter($values, static fn (string $value): bool => '' !== $value)) < 2) {
            throw new ApiProblemException(400, 'invalid_address', 'At least two address fields are required');
        }

        return new self($values['postalCode'], $values['houseNumber'], '', $values['street'], $values['city']);
    }

    public function withoutPostcode(): ?self
    {
        $otherFields = array_filter([$this->houseNumber, $this->street, $this->city], static fn (string $value): bool => '' !== $value);
        if ('' === $this->postalCode || count($otherFields) < 2) {
            return null;
        }

        return new self('', $this->houseNumber, '', $this->street, $this->city);
    }

    public static function compact(string $value): string
    {
        return strtoupper(preg_replace('/[\s-]+/', '', $value) ?? '');
    }
}
