<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\SubscriptionApi\SubscriptionOrderNormalizer;
use App\Webabo\HupApiCredential;
use PHPUnit\Framework\TestCase;

final class SubscriptionOrderNormalizerTest extends TestCase
{
    public function testNormalizeOrdersMapsOrdersToKiwiSubscriptions(): void
    {
        $credential = new HupApiCredential(
            name: 'tvk',
            title: 'TV Krant',
            mandant: 'HMC',
            supportsPersonLookup: true,
            username: 'tvk-user',
            password: 'tvk-password',
            refreshToken: null,
        );
        $ordersPayload = [
            'content' => [
                [
                    'rId' => '501',
                    'orderNumber' => 'SO-501',
                    'division' => [
                        'rId' => '14',
                    ],
                    'orderStartDate' => '2024-01-15',
                    'orderEndDate' => '2027-01-15',
                    'activeFrom' => '2024-01-15',
                    'activeTo' => '2027-01-15',
                    'orderItem' => [
                        'product' => [
                            'name' => 'Mikrogids',
                        ],
                    ],
                ],
                [
                    'rId' => '777',
                    'orderNumber' => 'SO-777',
                    'orderStartDate' => '2023-01-01',
                    'orderEndDate' => '2024-01-01',
                    'termination' => [
                        'terminationDate' => '2024-01-01',
                    ],
                    'orderItem' => [
                        'product' => [
                            'description' => 'Avrobode',
                        ],
                    ],
                ],
            ],
        ];

        $normalizer = new SubscriptionOrderNormalizer();

        $normalized = $normalizer->normalizeOrders($ordersPayload, $credential);

        self::assertCount(2, $normalized);
        self::assertSame(501, $normalized[0]['id']);
        self::assertSame('SO-501', $normalized[0]['orderNumber']);
        self::assertSame('Mikrogids', $normalized[0]['magazine']);
        self::assertSame('2024-01-15', $normalized[0]['startDate']);
        self::assertSame('2027-01-15', $normalized[0]['endDate']);
        self::assertSame('2027-01-15', $normalized[0]['lastEdition']);
        self::assertSame('active', $normalized[0]['status']);
        self::assertSame('tvk', $normalized[0]['credentialKey']);
        self::assertSame('HMC', $normalized[0]['mandant']);
        self::assertSame('14', $normalized[0]['divisionId']);
        self::assertSame('subscription-api', $normalized[0]['sourceSystem']);

        self::assertSame(777, $normalized[1]['id']);
        self::assertSame('Avrobode', $normalized[1]['magazine']);
        self::assertSame('cancelled', $normalized[1]['status']);
        self::assertSame('2024-01-01', $normalized[1]['endDate']);
    }

    public function testNormalizeOrdersReturnsEmptyListWhenContentIsMissing(): void
    {
        $credential = new HupApiCredential(
            name: 'tvk',
            title: 'TV Krant',
            mandant: 'HMC',
            supportsPersonLookup: true,
            username: 'tvk-user',
            password: 'tvk-password',
            refreshToken: null,
        );

        $normalizer = new SubscriptionOrderNormalizer();

        self::assertSame([], $normalizer->normalizeOrders([], $credential));
    }
}
