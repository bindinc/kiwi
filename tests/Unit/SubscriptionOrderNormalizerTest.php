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
            divisionId: null,
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
            divisionId: null,
            supportsPersonLookup: true,
            username: 'tvk-user',
            password: 'tvk-password',
            refreshToken: null,
        );

        $normalizer = new SubscriptionOrderNormalizer();

        self::assertSame([], $normalizer->normalizeOrders([], $credential));
    }

    /**
     * @dataProvider subscriptionEndDates
     * @param array<string, mixed> $dates
     */
    public function testStatusAndDisplayedDatesUseTheEarliestEndDate(
        array $dates,
        string $expectedEndDate,
        string $expectedStatus,
    ): void {
        $credential = new HupApiCredential(
            name: 'tvk',
            title: 'TV Krant',
            mandant: 'HMC',
            divisionId: null,
            supportsPersonLookup: true,
            username: 'tvk-user',
            password: 'tvk-password',
            refreshToken: null,
        );
        $subscription = (new SubscriptionOrderNormalizer())->normalizeOrder(
            ['activeFrom' => '2000-01-01', ...$dates], $credential,
        );

        self::assertSame($expectedStatus, $subscription['status']);
        self::assertSame($expectedEndDate, $subscription['endDate']);
        self::assertSame('' !== $expectedEndDate ? $expectedEndDate : '2000-01-01', $subscription['lastEdition']);
    }

    /** @return iterable<string, array{array<string, mixed>, string, string}> */
    public static function subscriptionEndDates(): iterable
    {
        $today = new \DateTimeImmutable('today');
        $yesterday = $today->modify('-1 day')->format('Y-m-d');
        $todayString = $today->format('Y-m-d');
        $tomorrow = $today->modify('+1 day')->format('Y-m-d');

        yield 'termination overrides open-ended activity' => [
            ['activeTo' => '2999-12-31', 'orderEndDate' => '2999-12-31', 'termination' => ['terminationDate' => $yesterday]],
            $yesterday, 'cancelled',
        ];
        yield 'order end overrides open-ended activity' => [
            ['activeTo' => '2999-12-31', 'orderEndDate' => $yesterday], $yesterday, 'ended',
        ];
        yield 'earlier activity end is retained' => [
            ['activeTo' => $yesterday, 'orderEndDate' => '2999-12-31'], $yesterday, 'ended',
        ];
        yield 'later termination cannot extend activity' => [
            ['activeTo' => $yesterday, 'termination' => ['terminationDate' => $tomorrow]], $yesterday, 'cancelled',
        ];
        foreach (['activeTo', 'orderEndDate', 'terminationDate'] as $field) {
            foreach ([$yesterday => 'ended', $todayString => 'active', $tomorrow => 'active'] as $date => $status) {
                $dates = 'terminationDate' === $field ? ['termination' => [$field => $date]] : [$field => $date];
                $expectedStatus = 'terminationDate' === $field && 'ended' === $status ? 'cancelled' : $status;
                yield $field.' '.$date => [$dates, $date, $expectedStatus];
            }
        }
        yield 'future termination remains active' => [
            ['activeTo' => '2999-12-31', 'termination' => ['terminationDate' => $tomorrow]], $tomorrow, 'active',
        ];
        yield 'open-ended remains active' => [['activeTo' => '2999-12-31'], '2999-12-31', 'active'];
        yield 'no end dates' => [[], '', 'active'];
        yield 'invalid dates fall back to order end' => [
            ['activeTo' => 'invalid-date', 'orderEndDate' => $yesterday, 'termination' => ['terminationDate' => '']],
            $yesterday, 'ended',
        ];
    }
}
