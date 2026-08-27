<?php

declare(strict_types=1);

namespace App\SubscriptionApi;

final class PpaPhoneContactMapper
{
    /**
     * @return array{phones: list<array{number: string}>, mobiles: list<array{number: string}>}
     */
    public function map(?string $landlinePhone, ?string $mobilePhone): array
    {
        return [
            'phones' => null === $landlinePhone ? [] : [['number' => $landlinePhone]],
            'mobiles' => null === $mobilePhone ? [] : [['number' => $mobilePhone]],
        ];
    }
}
