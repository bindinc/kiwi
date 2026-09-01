<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\SubscriptionApi\PpaAddressContactMapper;
use PHPUnit\Framework\TestCase;

final class PpaAddressContactMapperTest extends TestCase
{
    public function testMapsTheInternalAdditionWithoutChangingTheHouseNumber(): void
    {
        $addresses = (new PpaAddressContactMapper())->map(
            '310',
            'Teststraat',
            '1234AB',
            'Hilversum',
            '10A2',
        );

        self::assertSame([[
            'extension' => '310',
            'address' => [
                'street' => 'Teststraat',
                'postCode' => '1234AB',
                'city' => 'Hilversum',
                'housenumber' => [
                    'housenumber' => '10A2',
                ],
            ],
        ]], $addresses);
    }

    public function testLeavesTheExistingContactContractUnchangedWhenTheAdditionIsMissing(): void
    {
        $addresses = (new PpaAddressContactMapper())->map(
            null,
            'Teststraat',
            '1234AB',
            'Hilversum',
            '10A',
        );

        self::assertSame([], $addresses);
    }
}
