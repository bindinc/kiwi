<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Entity\WebaboOffer;
use PHPUnit\Framework\TestCase;

final class WebaboOfferTest extends TestCase
{
    public function testRefreshFromWebaboPayloadParsesPriceAndValidityWindow(): void
    {
        $offer = new WebaboOffer('AVRV519');
        $offer->refreshFromWebaboPayload([
            'offerId' => 12,
            'orderChoiceKey' => 34,
            'salesCode' => 'AVRV519',
            'title' => '1 jaar Avrobode voor maar EUR52',
            'credentialKey' => 'avrotros',
            'offerPrice' => [
                'price' => 52.0,
                'priceCode' => 'std',
            ],
            'offerDelivery' => [
                'duration' => 12,
                'frequency' => 'weekly',
                'deliveryMethodId' => 'mail',
                'validDate' => [
                    'validFrom' => '2026-01-01T00:00:00+00:00',
                    'validUntil' => '2026-12-31T23:59:59+00:00',
                ],
            ],
        ], new \DateTimeImmutable('2026-03-20T10:00:00+00:00'));

        self::assertSame('AVRV519', $offer->getSalesCode());
        self::assertSame('1 jaar Avrobode voor maar EUR52', $offer->getTitle());
        self::assertSame('avrotros', $offer->getCredentialKey());
        self::assertSame(52.0, $offer->getPrice());
        self::assertTrue($offer->isCurrentlyActive(new \DateTimeImmutable('2026-06-01T00:00:00+00:00')));
        self::assertFalse($offer->isCurrentlyActive(new \DateTimeImmutable('2027-01-01T00:00:00+00:00')));
    }
}
