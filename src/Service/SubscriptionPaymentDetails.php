<?php

declare(strict_types=1);

namespace App\Service;

use App\Http\ApiProblemException;

final readonly class SubscriptionPaymentDetails
{
    private const DIRECT_DEBIT = 'B';
    private const PAYMENT_INSTRUCTION = 'AC';

    private function __construct(
        private ?string $paymentMethod,
        private ?string $iban,
    ) {
    }

    /**
     * @param array<string, mixed> $subscriptionPayload
     */
    public static function fromSubscriptionPayload(array $subscriptionPayload): self
    {
        $rawPaymentMethod = $subscriptionPayload['paymentMethod'] ?? null;
        if (null !== $rawPaymentMethod && !\is_scalar($rawPaymentMethod)) {
            throw new ApiProblemException(400, 'invalid_payload', 'subscription.paymentMethod must be B or AC');
        }

        $paymentMethod = self::normalizeNullableString($rawPaymentMethod);
        if (null === $paymentMethod) {
            return new self(null, null);
        }

        $paymentMethod = strtoupper($paymentMethod);
        if (!\in_array($paymentMethod, [self::DIRECT_DEBIT, self::PAYMENT_INSTRUCTION], true)) {
            throw new ApiProblemException(400, 'invalid_payload', 'subscription.paymentMethod must be B or AC');
        }

        if (self::PAYMENT_INSTRUCTION === $paymentMethod) {
            return new self($paymentMethod, null);
        }

        $iban = self::normalizeNullableString($subscriptionPayload['iban'] ?? null);
        $normalizedIban = null === $iban ? null : strtoupper(str_replace(' ', '', $iban));
        $isSupportedIban = null !== $normalizedIban
            && 1 === preg_match('/^(NL[0-9]{2}[A-Z]{4}[0-9]{10}|BE[0-9]{14})$/', $normalizedIban);
        if (!$isSupportedIban) {
            throw new ApiProblemException(400, 'invalid_payload', 'subscription.iban must be a valid Dutch or Belgian IBAN for payment method B');
        }

        return new self($paymentMethod, $normalizedIban);
    }

    /**
     * @return array{paymentMethod: string|null, iban: string|null}
     */
    public function toArray(): array
    {
        return [
            'paymentMethod' => $this->paymentMethod,
            'iban' => $this->iban,
        ];
    }

    private static function normalizeNullableString(mixed $value): ?string
    {
        if (!\is_scalar($value)) {
            return null;
        }

        $normalized = trim((string) $value);

        return '' === $normalized ? null : $normalized;
    }
}
