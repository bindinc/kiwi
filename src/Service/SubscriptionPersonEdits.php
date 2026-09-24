<?php

declare(strict_types=1);

namespace App\Service;

use App\Http\ApiProblemException;

/** Applies order-specific details without allowing edits to the source identity. */
final class SubscriptionPersonEdits
{
    public static function apply(array $person, mixed $edits): array
    {
        if (!is_array($edits)) {
            throw new ApiProblemException(400, 'invalid_payload', 'personEdits must be an object');
        }

        $fields = ['salutation', 'firstName', 'middleName', 'lastName', 'birthday',
            'postalCode', 'houseNumber', 'houseNumberAddition', 'street', 'address',
            'addressExtension', 'city', 'email', 'landlinePhone', 'mobilePhone', 'formSessionId'];
        foreach ($fields as $field) {
            if (!array_key_exists($field, $edits)) continue;
            if (!is_string($edits[$field])) {
                throw new ApiProblemException(400, 'invalid_payload', sprintf('personEdits.%s must be a string', $field));
            }
            $person[$field] = trim($edits[$field]);
        }

        foreach (['salutation', 'firstName', 'lastName', 'postalCode', 'houseNumber', 'street', 'city', 'email'] as $field) {
            if ('' === trim((string) ($person[$field] ?? ''))) {
                throw new ApiProblemException(400, 'invalid_payload', sprintf('personEdits.%s is required', $field));
            }
        }
        if (false === filter_var($person['email'], FILTER_VALIDATE_EMAIL)) {
            throw new ApiProblemException(400, 'invalid_payload', 'personEdits.email must be a valid email address');
        }

        return $person;
    }
}
