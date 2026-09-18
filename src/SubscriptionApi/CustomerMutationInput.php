<?php

declare(strict_types=1);

namespace App\SubscriptionApi;

use App\Http\ApiProblemException;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\Validator\Validator\ValidatorInterface;

final class CustomerMutationInput
{
    public const FIELDS = [
        'person.update' => ['firstName', 'initials', 'surName', 'lastName', 'salutation', 'birthDay'],
        'address.update' => ['street', 'housenumber', 'postCode', 'city', 'isoCountryCode', 'extension', 'additionalExtension'],
        'email.update' => ['emailAddress'],
        'phone.update' => ['areaCode', 'number'],
        'mobile.update' => ['areaCode', 'number'],
        'bank.create' => ['iban', 'bic'],
        'bank.update' => ['iban', 'bic'],
        'bank.delete' => [],
    ];

    public function __construct(private readonly ValidatorInterface $validator) {}

    /** Validate partial fields without accepting identity or authorization input. */
    public function validate(string $operation, array $changes): array
    {
        $allowed = self::FIELDS[$operation] ?? null;
        if (null === $allowed) {
            throw new ApiProblemException(400, 'unsupported_customer_operation', 'Unknown customer operation');
        }
        if ([] !== array_diff(array_keys($changes), $allowed)) {
            throw new ApiProblemException(422, 'unknown_fields', 'The request contains unsupported fields');
        }
        if ([] === $changes && 'bank.delete' !== $operation) {
            throw new ApiProblemException(422, 'empty_change', 'Supply at least one changed field');
        }
        foreach ($changes as $field => $value) {
            if (!is_string($value) || strlen($value) > 254 || preg_match('/[\x00-\x1f\x7f]/', $value)) {
                $this->invalid($field);
            }
            $changes[$field] = trim($value);
        }
        foreach (['lastName', 'emailAddress', 'number', 'iban', 'street', 'housenumber', 'postCode', 'city', 'isoCountryCode'] as $required) {
            if (array_key_exists($required, $changes) && '' === $changes[$required]) {
                $this->invalid($required);
            }
        }
        if (isset($changes['birthDay'])) {
            $date = \DateTimeImmutable::createFromFormat('!Y-m-d', $changes['birthDay']);
            if (!$date || $date->format('Y-m-d') !== $changes['birthDay'] || $date > new \DateTimeImmutable('today')) {
                $this->invalid('birthDay');
            }
        }
        if (isset($changes['emailAddress']) && !filter_var($changes['emailAddress'], FILTER_VALIDATE_EMAIL)) {
            $this->invalid('emailAddress');
        }
        foreach (['number', 'areaCode'] as $field) {
            if (isset($changes[$field]) && (!preg_match('/^[+0-9 ()\-]{0,40}$/D', $changes[$field]) || ('' !== $changes[$field] && !preg_match('/[0-9]/', $changes[$field])))) {
                $this->invalid($field);
            }
        }
        if (isset($changes['isoCountryCode'])) {
            $changes['isoCountryCode'] = strtoupper($changes['isoCountryCode']);
            if (count($this->validator->validate($changes['isoCountryCode'], new Assert\Country())) > 0) {
                $this->invalid('isoCountryCode');
            }
        }
        if (str_starts_with($operation, 'bank.') && 'bank.delete' !== $operation) {
            if (!isset($changes['iban'])) {
                $this->invalid('iban');
            }
            $changes['iban'] = strtoupper(preg_replace('/[\s\p{Z}]+/u', '', $changes['iban']));
            if (count($this->validator->validate($changes['iban'], new Assert\Iban())) > 0) {
                $this->invalid('iban');
            }
            if (isset($changes['bic']) && '' !== $changes['bic']) {
                $changes['bic'] = strtoupper($changes['bic']);
                if (count($this->validator->validate($changes['bic'], new Assert\Bic())) > 0) {
                    $this->invalid('bic');
                }
            }
        }
        return $changes;
    }

    public function upstreamPayload(string $operation, array $changes): array
    {
        $changes = $this->validate($operation, $changes);
        if ('address.update' !== $operation) {
            return $changes;
        }
        $payload = [];
        foreach ($changes as $field => $value) {
            if (in_array($field, ['extension', 'additionalExtension'], true)) {
                $payload[$field] = $value;
            } elseif ('housenumber' === $field) {
                $payload['address']['housenumber'] = ['housenumber' => $value];
            } else {
                $payload['address'][$field] = $value;
            }
        }
        return $payload;
    }

    private function invalid(string $field): never
    {
        // Never echo rejected personal or financial values in errors or logs.
        throw new ApiProblemException(422, 'invalid_field', 'Correct the highlighted field', ['field' => $field]);
    }
}
