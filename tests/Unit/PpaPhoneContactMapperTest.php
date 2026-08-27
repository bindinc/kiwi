<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\SubscriptionApi\PpaPhoneContactMapper;
use PHPUnit\Framework\TestCase;

final class PpaPhoneContactMapperTest extends TestCase
{
    public function testMapsLandlineAndMobileToTheirPpaCollections(): void
    {
        $contacts = (new PpaPhoneContactMapper())->map('0351234567', '0612345678');

        self::assertSame([
            'phones' => [['number' => '0351234567']],
            'mobiles' => [['number' => '0612345678']],
        ], $contacts);
    }

    public function testUsesAnEmptyPpaCollectionForAMissingPhoneType(): void
    {
        $mapper = new PpaPhoneContactMapper();

        self::assertSame([
            'phones' => [],
            'mobiles' => [['number' => '0612345678']],
        ], $mapper->map(null, '0612345678'));
        self::assertSame([
            'phones' => [['number' => '0351234567']],
            'mobiles' => [],
        ], $mapper->map('0351234567', null));
    }
}
