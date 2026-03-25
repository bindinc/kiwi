<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Service\SubscriptionQueueDisplayFormatter;
use PHPUnit\Framework\TestCase;

final class SubscriptionQueueDisplayFormatterTest extends TestCase
{
    public function testFormatsDisplayFieldsForNewSubscription(): void
    {
        $formatter = new SubscriptionQueueDisplayFormatter();

        $display = $formatter->formatOrderPayload([
            'status' => 'queued',
            'attemptCount' => 0,
            'queuedAt' => '2026-03-24T15:16:00+00:00',
            'event' => [
                'status' => 'pending',
                'attemptCount' => 0,
            ],
            'summary' => [
                'agent' => [
                    'shortName' => 'B. Deijkers',
                    'initials' => 'BD',
                ],
                'typeLabel' => 'Nieuw abonnement',
                'subscription' => [
                    'magazine' => 'Mikrogids',
                ],
                'offer' => [
                    'salesCode' => 'MKGV435',
                    'title' => '1 jaar Mikrogids voor EUR 42',
                ],
                'recipient' => [
                    'displayName' => 'dhr. de Vries',
                    'personId' => 1984301,
                ],
            ],
        ]);

        self::assertSame('BD', $display['agentBadge']);
        self::assertSame('in behandeling', $display['statusLabel']);
        self::assertSame('Aanvraag', $display['typeLabel']);
        self::assertSame('16.16', $display['queuedTime']);
        self::assertSame('1 jaar Mikrogids voor EUR 42', $display['title']);
        self::assertSame('dhr. de Vries (1984301)', $display['recipientSegment']);
        self::assertSame(
            "16.16 In behandeling: Aanvraag '1 jaar Mikrogids voor EUR 42' (MKGV435) voor dhr. de Vries (1984301)",
            $display['line'],
        );
    }

    public function testFormatsRetryStatusAndNewRecipientFallback(): void
    {
        $formatter = new SubscriptionQueueDisplayFormatter();

        $display = $formatter->formatOrderPayload([
            'status' => 'queued',
            'attemptCount' => 1,
            'queuedAt' => '2026-03-24T15:16:00+00:00',
            'event' => [
                'status' => 'retry_scheduled',
                'attemptCount' => 3,
            ],
            'summary' => [
                'agent' => [
                    'shortName' => 'B. Deijkers',
                ],
                'typeLabel' => 'Mutatie abonnement',
                'subscription' => [
                    'magazine' => 'Mikrogids',
                ],
                'offer' => [
                    'salesCode' => 'MKGV435',
                ],
                'recipient' => [
                    'displayName' => 'dhr. de Vries',
                    'personId' => null,
                ],
            ],
        ]);

        self::assertSame('poging 03', $display['statusLabel']);
        self::assertSame('Wijziging', $display['typeLabel']);
        self::assertSame('dhr. de Vries (nieuw)', $display['recipientSegment']);
    }

    public function testFormatsCancelledTypeAndFailedStatus(): void
    {
        $formatter = new SubscriptionQueueDisplayFormatter();

        $display = $formatter->formatOrderPayload([
            'status' => 'failed',
            'attemptCount' => 2,
            'queuedAt' => '2026-03-24T15:16:00+00:00',
            'event' => [
                'status' => 'failed',
                'attemptCount' => 2,
            ],
            'summary' => [
                'agent' => [
                    'shortName' => 'B. Deijkers',
                ],
                'typeLabel' => 'Winback opzegging',
                'subscription' => [
                    'magazine' => 'Mikrogids',
                ],
                'offer' => [
                    'salesCode' => 'MKGV435',
                ],
                'recipient' => [
                    'displayName' => 'dhr. de Vries',
                    'personId' => 1984301,
                ],
            ],
        ]);

        self::assertSame('mislukt', $display['statusLabel']);
        self::assertSame('Opzegging', $display['typeLabel']);
    }

    public function testOmitsUnknownTitleAndAgentNameFromLine(): void
    {
        $formatter = new SubscriptionQueueDisplayFormatter();

        $display = $formatter->formatOrderPayload([
            'status' => 'queued',
            'queuedAt' => '2026-03-24T15:16:00+00:00',
            'summary' => [
                'agent' => [
                    'shortName' => 'B. Deijkers',
                    'initials' => 'BD',
                ],
                'typeLabel' => 'Nieuw abonnement',
                'offer' => [
                    'salesCode' => 'MKGV453',
                ],
                'recipient' => [
                    'displayName' => 'Dhr. Bakker',
                    'personId' => 3,
                ],
            ],
        ]);

        self::assertSame('', $display['title']);
        self::assertSame('16.16 In behandeling: Aanvraag (MKGV453) voor Dhr. Bakker (3)', $display['line']);
        self::assertStringNotContainsString('B. Deijkers', $display['line']);
        self::assertStringNotContainsString('Onbekend', $display['line']);
    }

    public function testBuildsBadgeFromShortNameAndFallback(): void
    {
        $formatter = new SubscriptionQueueDisplayFormatter();

        $shortNameDisplay = $formatter->formatOrderPayload([
            'queuedAt' => '2026-03-24T15:16:00+00:00',
            'summary' => [
                'agent' => [
                    'shortName' => 'B. Deijkers',
                    'initials' => '',
                ],
            ],
        ]);
        $fallbackDisplay = $formatter->formatOrderPayload([
            'queuedAt' => '2026-03-24T15:16:00+00:00',
            'summary' => [
                'agent' => [],
            ],
        ]);

        self::assertSame('BD', $shortNameDisplay['agentBadge']);
        self::assertSame('KM', $fallbackDisplay['agentBadge']);
    }
}
