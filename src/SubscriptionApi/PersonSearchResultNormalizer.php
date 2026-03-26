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
            'email' => $this->normalizePrimaryStringFromList($rawPerson['geteMail'] ?? null) ?? '',
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
