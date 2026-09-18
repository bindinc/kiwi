<?php

declare(strict_types=1);

namespace App\SubscriptionApi;

use App\Http\ApiProblemException;
use App\Webabo\HupApiCredential;

final class CustomerEditingSnapshot
{
    public function verifyPerson(array $person, string $personId, HupApiCredential $credential): void
    {
        $samePerson = (string) ($person['rId'] ?? '') === $personId;
        $division = (string) ($person['division']['rId'] ?? '');
        $sameDivision = null !== $credential->divisionId && '' !== $division && $credential->divisionId === $division;
        if (!$samePerson || !$sameDivision || !$credential->mandant) {
            throw new ApiProblemException(409, 'customer_context_unverified', 'The source customer context could not be verified');
        }
    }

    public function build(array $person): array
    {
        $profile = [];
        foreach (CustomerMutationInput::FIELDS['person.update'] as $field) {
            $profile[$field] = is_string($person[$field] ?? null) ? $person[$field] : '';
        }
        $sections = ['person' => [['id' => (string) $person['rId'], 'fields' => $profile]]];
        foreach (['address' => 'addresses', 'email' => 'emails', 'phone' => 'phones', 'mobile' => 'mobiles'] as $section => $collection) {
            $sections[$section] = [];
            foreach (($person['contacts'][$collection] ?? []) as $item) {
                if (!is_array($item)) continue;
                $fields = [];
                foreach (CustomerMutationInput::FIELDS[$section.'.update'] as $field) {
                    $value = 'address' === $section ? ($item['address'][$field] ?? $item[$field] ?? '') : ($item[$field] ?? '');
                    if ('housenumber' === $field) $value = is_array($value) ? ($value['housenumber'] ?? '') : '';
                    $fields[$field] = is_string($value) ? $value : '';
                }
                $sections[$section][] = ['id' => $this->identity($item), 'fields' => $fields];
            }
        }
        $sections['bank'] = [];
        foreach (($person['payments']['ibanItems'] ?? []) as $item) {
            if (!is_array($item)) continue;
            $iban = is_string($item['iban'] ?? null) ? $item['iban'] : '';
            $sections['bank'][] = [
                'id' => $this->identity($item),
                'maskedIban' => strlen($iban) >= 8 ? substr($iban, 0, 2).' •••• '.substr($iban, -4) : '••••',
                'fields' => ['bic' => is_string($item['bic'] ?? null) ? $item['bic'] : ''],
                'deletionAllowed' => false,
                'deletionReason' => 'bank_links_unverified',
            ];
        }
        return ['sections' => $sections, 'version' => null];
    }

    public function verifySubresource(array $person, string $operation, ?string $resourceId): void
    {
        if (in_array($operation, ['person.update', 'bank.create'], true)) return;
        $section = explode('.', $operation)[0];
        $items = $this->build($person)['sections'][$section] ?? [];
        $matches = array_filter($items, static fn (array $item): bool => null !== $item['id'] && $item['id'] === $resourceId);
        if (1 !== count($matches)) {
            throw new ApiProblemException(409, 'resource_context_unverified', 'Select an unambiguous source resource belonging to this customer');
        }
        if ('bank.delete' === $operation) {
            // Orders may be incomplete and a read-before-delete check is not atomic.
            throw new ApiProblemException(409, 'bank_links_unverified', 'Bank deletion requires a guaranteed current-link check');
        }
    }

    private function identity(array $item): ?string
    {
        $id = $item['rId'] ?? $item['getrId'] ?? null;
        return is_string($id) && preg_match('/^[A-Za-z0-9_-]{1,100}$/D', $id) ? $id : null;
    }
}
