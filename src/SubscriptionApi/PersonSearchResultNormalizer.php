<?php

declare(strict_types=1);

namespace App\SubscriptionApi;

use App\Webabo\HupApiCredential;

final class PersonSearchResultNormalizer
{
    /**
     * Keep this list aligned with the frontend surname splitting rules so badges,
     * duplicate checks, and display names keep treating Dutch insertions the same way.
     *
     * @var list<string>
     */
    private const NAME_INSERTION_PREFIXES = [
        'van der',
        'van den',
        'van de',
        'von der',
        'ten',
        'ter',
        'op de',
        'op den',
        'op',
        'aan de',
        'aan den',
        'aan',
        'bij',
        'uit de',
        'uit den',
        'uit',
        'de',
        'den',
        'der',
        'van',
        'von',
        'te',
    ];

    /**
     * @return list<array<string, mixed>>
     */
    public function normalizeCredentialResult(CredentialPersonSearchResult $searchResult): array
    {
        $content = $searchResult->payload['content'] ?? null;
        if (!\is_array($content)) {
            return [];
        }

        $normalized = [];
        foreach ($content as $rawPerson) {
            if (!\is_array($rawPerson)) {
                continue;
            }

            $normalized[] = $this->normalizePerson($rawPerson, $searchResult->credential);
        }

        return $normalized;
    }

    /**
     * @param array<string, mixed> $rawPerson
     * @return array<string, mixed>
     */
    public function normalizePerson(array $rawPerson, HupApiCredential $credential): array
    {
        $personId = $this->normalizeNullableString($rawPerson['personId'] ?? null);
        $normalizedId = $this->normalizeId($personId);
        [$middleName, $lastName] = $this->splitLastName($this->normalizeNullableString($rawPerson['name'] ?? null));
        $houseNumber = $this->normalizeNullableString($rawPerson['houseNo'] ?? null);
        $divisionId = $this->normalizeNullableString($rawPerson['divisionId'] ?? null);
        $mandant = $credential->mandant ?? $divisionId ?? '';

        return [
            'id' => $normalizedId,
            'personId' => $personId,
            'firstName' => $this->normalizeNullableString($rawPerson['firstName'] ?? null) ?? '',
            'middleName' => $middleName,
            'lastName' => $lastName,
            'postalCode' => $this->normalizeNullableString($rawPerson['postCode'] ?? null) ?? '',
            'houseNumber' => $houseNumber ?? '',
            'address' => $this->buildAddress(
                $this->normalizeNullableString($rawPerson['street'] ?? null),
                $houseNumber,
            ),
            'city' => $this->normalizeNullableString($rawPerson['city'] ?? null) ?? '',
            'email' => $this->extractSearchEmailAddress($rawPerson) ?? '',
            'phone' => $this->normalizePrimaryStringFromList($rawPerson['phone'] ?? null) ?? '',
            'credentialKey' => $credential->name,
            'credentialTitle' => $credential->title ?? '',
            'mandant' => $mandant,
            'divisionId' => $divisionId,
            'supportsPersonLookup' => true === $credential->supportsPersonLookup,
            'sourceSystem' => 'subscription-api',
            'subscriptions' => [],
            'articles' => [],
            'contactHistory' => [],
            'deliveryRemarks' => [
                'default' => '',
                'lastUpdated' => null,
                'history' => [],
            ],
        ];
    }

    /**
     * @param array<string, mixed> $rawPerson
     * @return array<string, mixed>
     */
    public function normalizeDetailPerson(array $rawPerson, HupApiCredential $credential, string $requestedPersonId): array
    {
        $personId = $this->normalizeNullableString($rawPerson['rId'] ?? null)
            ?? $this->normalizeNullableString($requestedPersonId)
            ?? '';
        $normalizedId = $this->normalizeId($personId);
        $divisionId = $this->normalizeNullableString($rawPerson['division']['rId'] ?? null);
        $mandant = $credential->mandant ?? $divisionId ?? '';
        $primaryAddress = $this->extractPrimaryAddress($rawPerson['contacts'] ?? null);
        $houseNumber = $primaryAddress['houseNumber'] ?? null;

        return [
            'id' => $normalizedId,
            'personId' => $personId,
            'personNumber' => $this->normalizeNullableString($rawPerson['personNumber'] ?? null) ?? '',
            'firstName' => $this->normalizeNullableString($rawPerson['firstName'] ?? null) ?? '',
            'middleName' => $this->normalizeNullableString($rawPerson['surName'] ?? null) ?? '',
            'lastName' => $this->normalizeNullableString($rawPerson['lastName'] ?? null) ?? '',
            'initials' => $this->normalizeNullableString($rawPerson['initials'] ?? null) ?? '',
            'salutation' => $this->normalizeDetailSalutation($rawPerson),
            'birthday' => $this->normalizeNullableString($rawPerson['birthDay'] ?? null) ?? '',
            'postalCode' => $primaryAddress['postalCode'] ?? '',
            'houseNumber' => $houseNumber ?? '',
            'address' => $this->buildAddress($primaryAddress['street'] ?? null, $houseNumber),
            'city' => $primaryAddress['city'] ?? '',
            'email' => $this->extractPrimaryContactValue($rawPerson['contacts'] ?? null, 'emails', 'emailAddress') ?? '',
            'phone' => $this->extractPrimaryPhoneNumber($rawPerson['contacts'] ?? null) ?? '',
            'credentialKey' => $credential->name,
            'credentialTitle' => $credential->title ?? '',
            'mandant' => $mandant,
            'divisionId' => $divisionId,
            'supportsPersonLookup' => true === $credential->supportsPersonLookup,
            'sourceSystem' => 'subscription-api',
            'matchCode' => $this->normalizeNullableString($rawPerson['matchCode'] ?? null) ?? '',
            'iban' => $this->extractPrimaryIban($rawPerson['payments'] ?? null) ?? '',
            'references' => $this->normalizeReferences($rawPerson['references'] ?? null),
            'subscriptions' => [],
            'articles' => [],
            'contactHistory' => [],
            'deliveryRemarks' => [
                'default' => '',
                'lastUpdated' => null,
                'history' => [],
            ],
        ];
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function splitLastName(?string $rawLastName): array
    {
        $lastName = $rawLastName ?? '';
        if ('' === $lastName) {
            return ['', ''];
        }

        $normalizedLastName = strtolower($lastName);
        foreach (self::NAME_INSERTION_PREFIXES as $prefix) {
            $needle = sprintf('%s ', $prefix);
            if (!str_starts_with($normalizedLastName, $needle)) {
                continue;
            }

            $surname = trim(substr($lastName, strlen($needle)));
            if ('' === $surname) {
                return ['', $lastName];
            }

            return [substr($lastName, 0, strlen($prefix)), $surname];
        }

        return ['', $lastName];
    }

    private function buildAddress(?string $street, ?string $houseNumber): string
    {
        $addressParts = array_values(array_filter([
            $street,
            $houseNumber,
        ], static fn (?string $value): bool => null !== $value && '' !== $value));

        return implode(' ', $addressParts);
    }

    /**
     * @param mixed $contacts
     * @return array{street:?string, postalCode:?string, houseNumber:?string, city:?string}
     */
    private function extractPrimaryAddress(mixed $contacts): array
    {
        if (!\is_array($contacts) || !\is_array($contacts['addresses'] ?? null)) {
            return [
                'street' => null,
                'postalCode' => null,
                'houseNumber' => null,
                'city' => null,
            ];
        }

        foreach ($contacts['addresses'] as $contactAddress) {
            if (!\is_array($contactAddress) || !\is_array($contactAddress['address'] ?? null)) {
                continue;
            }

            $address = $contactAddress['address'];

            return [
                'street' => $this->normalizeNullableString($address['street'] ?? null),
                'postalCode' => $this->normalizeNullableString($address['postCode'] ?? null),
                'houseNumber' => $this->normalizeNullableString($address['housenumber']['housenumber'] ?? null),
                'city' => $this->normalizeNullableString($address['city'] ?? null),
            ];
        }

        return [
            'street' => null,
            'postalCode' => null,
            'houseNumber' => null,
            'city' => null,
        ];
    }

    /**
     * @param mixed $contacts
     */
    private function extractPrimaryContactValue(mixed $contacts, string $collectionKey, string $valueKey): ?string
    {
        if (!\is_array($contacts) || !\is_array($contacts[$collectionKey] ?? null)) {
            return null;
        }

        foreach ($contacts[$collectionKey] as $contactItem) {
            if (!\is_array($contactItem)) {
                continue;
            }

            $normalized = $this->normalizeNullableString($contactItem[$valueKey] ?? null);
            if (null !== $normalized) {
                return $normalized;
            }
        }

        return null;
    }

    /**
     * @param array<string, mixed> $rawPerson
     */
    private function extractSearchEmailAddress(array $rawPerson): ?string
    {
        return $this->normalizePrimaryStringFromList($rawPerson['eMail'] ?? null)
            ?? $this->normalizePrimaryStringFromList($rawPerson['geteMail'] ?? null);
    }

    /**
     * @param mixed $contacts
     */
    private function extractPrimaryPhoneNumber(mixed $contacts): ?string
    {
        $phoneNumber = $this->extractPrimaryContactValue($contacts, 'phones', 'number');
        if (null !== $phoneNumber) {
            return $phoneNumber;
        }

        return $this->extractPrimaryContactValue($contacts, 'mobiles', 'number');
    }

    /**
     * @param mixed $payments
     */
    private function extractPrimaryIban(mixed $payments): ?string
    {
        if (!\is_array($payments) || !\is_array($payments['ibanItems'] ?? null)) {
            return null;
        }

        foreach ($payments['ibanItems'] as $ibanItem) {
            if (!\is_array($ibanItem)) {
                continue;
            }

            $iban = $this->normalizeNullableString($ibanItem['iban'] ?? null);
            if (null !== $iban) {
                return $iban;
            }
        }

        return null;
    }

    /**
     * @param mixed $references
     * @return list<array<string, string>>
     */
    private function normalizeReferences(mixed $references): array
    {
        if (!\is_array($references)) {
            return [];
        }

        $normalizedReferences = [];

        foreach ($references as $reference) {
            if (!\is_array($reference)) {
                continue;
            }

            $origin = $this->normalizeNullableString($reference['origin'] ?? null);
            $identifier = $this->normalizeNullableString($reference['identifier'] ?? null);
            if (null === $origin && null === $identifier) {
                continue;
            }

            $normalizedReferences[] = array_filter([
                'origin' => $origin,
                'identifier' => $identifier,
            ], static fn (?string $value): bool => null !== $value);
        }

        return $normalizedReferences;
    }

    /**
     * @param array<string, mixed> $rawPerson
     */
    private function normalizeDetailSalutation(array $rawPerson): string
    {
        $addressTypeName = strtolower(trim((string) ($rawPerson['addressType']['name'] ?? $rawPerson['addressType']['rId'] ?? '')));

        return match (true) {
            str_contains($addressTypeName, 'heer') => 'Dhr.',
            str_contains($addressTypeName, 'mevr') || str_contains($addressTypeName, 'vrouw') => 'Mevr.',
            default => '',
        };
    }

    /**
     * @param mixed $values
     */
    private function normalizePrimaryStringFromList(mixed $values): ?string
    {
        if (!\is_array($values)) {
            return null;
        }

        foreach ($values as $value) {
            $normalized = $this->normalizeNullableString($value);
            if (null !== $normalized) {
                return $normalized;
            }
        }

        return null;
    }

    private function normalizeNullableString(mixed $value): ?string
    {
        if (!\is_string($value)) {
            return null;
        }

        $normalized = trim($value);

        return '' !== $normalized ? $normalized : null;
    }

    /**
     * @return int|string|null
     */
    private function normalizeId(?string $personId): int|string|null
    {
        if (null === $personId) {
            return null;
        }

        if (preg_match('/^\d+$/', $personId)) {
            return (int) $personId;
        }

        return $personId;
    }
}
