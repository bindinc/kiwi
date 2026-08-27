<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Http\ApiProblemException;
use App\Service\SubscriptionPaymentDetails;
use PHPUnit\Framework\TestCase;

final class SubscriptionPaymentDetailsTest extends TestCase
{
    public function testNormalizesDirectDebitWithDutchIban(): void
    {
        $details = SubscriptionPaymentDetails::fromSubscriptionPayload([
            'paymentMethod' => 'b',
            'iban' => 'NL80 INGB 0001 3401 87',
        ]);

        self::assertSame([
            'paymentMethod' => 'B',
            'iban' => 'NL80INGB0001340187',
        ], $details->toArray());
    }

    public function testPaymentInstructionOmitsIban(): void
    {
        $details = SubscriptionPaymentDetails::fromSubscriptionPayload([
            'paymentMethod' => 'ac',
            'iban' => 'NL80INGB0001340187',
        ]);

        self::assertSame([
            'paymentMethod' => 'AC',
            'iban' => null,
        ], $details->toArray());
    }

    public function testLegacyPayloadWithoutPaymentDetailsRemainsValid(): void
    {
        $details = SubscriptionPaymentDetails::fromSubscriptionPayload([]);

        self::assertSame([
            'paymentMethod' => null,
            'iban' => null,
        ], $details->toArray());
    }

    /**
     * @dataProvider invalidPaymentDetailsProvider
     */
    public function testRejectsInvalidPaymentDetails(
        array $payload,
        string $expectedMessage,
    ): void {
        try {
            SubscriptionPaymentDetails::fromSubscriptionPayload($payload);
            self::fail('Expected invalid payment details to be rejected.');
        } catch (ApiProblemException $exception) {
            self::assertSame(400, $exception->getStatus());
            self::assertSame('invalid_payload', $exception->getErrorCode());
            self::assertSame($expectedMessage, $exception->getMessage());
        }
    }

    /**
     * @return iterable<string, array{array<string, mixed>, string}>
     */
    public static function invalidPaymentDetailsProvider(): iterable
    {
        yield 'unknown payment method' => [
            ['paymentMethod' => 'cash'],
            'subscription.paymentMethod must be B or AC',
        ];
        yield 'non-scalar payment method' => [
            ['paymentMethod' => ['B']],
            'subscription.paymentMethod must be B or AC',
        ];
        yield 'direct debit without iban' => [
            ['paymentMethod' => 'B'],
            'subscription.iban must be a valid Dutch or Belgian IBAN for payment method B',
        ];
        yield 'direct debit with unsupported iban' => [
            ['paymentMethod' => 'B', 'iban' => 'DE89370400440532013000'],
            'subscription.iban must be a valid Dutch or Belgian IBAN for payment method B',
        ];
    }
}
