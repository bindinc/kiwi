<?php

declare(strict_types=1);

namespace App\SubscriptionApi;

final class PpaAddressContactMapper
{
    /**
     * @return list<array{extension: string, address: array{street: string, postCode: string, city: string, housenumber: array{housenumber: string}}>}
     */
    public function map(
        ?string $addressExtension,
        ?string $street,
        ?string $postalCode,
        ?string $city,
        ?string $houseNumber,
    ): array {
        if (null === $addressExtension) {
            return [];
        }

        return [[
            'extension' => $addressExtension,
            'address' => [
                'street' => $street ?? '',
                'postCode' => $postalCode ?? '',
                'city' => $city ?? '',
                'housenumber' => [
                    'housenumber' => $houseNumber ?? '',
                ],
            ],
        ]];
    }
}
