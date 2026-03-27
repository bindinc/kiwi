<?php

declare(strict_types=1);

namespace App\SubscriptionApi;

use App\Webabo\HupApiCredential;

final class SubscriptionOrderNormalizer
{
    /**
     * @param array<string, mixed> $ordersPayload
     * @return list<array<string, mixed>>
     */
    public function normalizeOrders(array $ordersPayload, HupApiCredential $credential): array
    {
        $content = $ordersPayload['content'] ?? null;
        if (!\is_array($content)) {
            return [];
        }

        $normalizedSubscriptions = [];

        foreach ($content as $rawOrder) {
            if (!\is_array($rawOrder)) {
                continue;
            }

            $normalizedSubscriptions[] = $this->normalizeOrder($rawOrder, $credential);
        }

        return $normalizedSubscriptions;
    }

    /**
     * @param array<string, mixed> $rawOrder
     * @return array<string, mixed>
     */
    public function normalizeOrder(array $rawOrder, HupApiCredential $credential): array
    {
        $orderId = $this->normalizeNullableString($rawOrder['rId'] ?? null)
            ?? $this->normalizeNullableString($rawOrder['orderNumber'] ?? null)
            ?? '';
        $divisionId = $this->normalizeNullableString($rawOrder['division']['rId'] ?? null);
        $mandant = $credential->mandant ?? $divisionId ?? '';
        $startDate = $this->normalizeDateString($rawOrder['activeFrom'] ?? null)
            ?? $this->normalizeDateString($rawOrder['orderStartDate'] ?? null)
            ?? '';
        $activeTo = $this->normalizeDateString($rawOrder['activeTo'] ?? null);
        $orderEndDate = $this->normalizeDateString($rawOrder['orderEndDate'] ?? null);
        $terminationDate = $this->normalizeDateString($rawOrder['termination']['terminationDate'] ?? null);
        $endDate = $terminationDate ?? $activeTo ?? $orderEndDate ?? '';
        $lastEdition = $activeTo ?? $orderEndDate ?? $startDate;
        $status = $this->resolveSubscriptionStatus($activeTo, $orderEndDate, $terminationDate);

        return [
            'id' => $this->normalizeId($orderId),
            'orderId' => $orderId,
            'orderNumber' => $this->normalizeNullableString($rawOrder['orderNumber'] ?? null) ?? '',
            'magazine' => $this->normalizeNullableString($rawOrder['orderItem']['product']['name'] ?? null)
                ?? $this->normalizeNullableString($rawOrder['orderItem']['product']['description'] ?? null)
                ?? 'Onbekend magazine',
            'startDate' => $startDate,
            'endDate' => $endDate,
            'lastEdition' => $lastEdition,
            'status' => $status,
            'credentialKey' => $credential->name,
            'credentialTitle' => $credential->title ?? '',
            'mandant' => $mandant,
            'divisionId' => $divisionId,
            'sourceSystem' => 'subscription-api',
        ];
    }

    private function resolveSubscriptionStatus(?string $activeTo, ?string $orderEndDate, ?string $terminationDate): string
    {
        $effectiveEndDate = $activeTo ?? $orderEndDate ?? $terminationDate;
        if (null === $effectiveEndDate || '' === $effectiveEndDate) {
            return 'active';
        }

        $today = (new \DateTimeImmutable('today'))->format('Y-m-d');
        if ($effectiveEndDate >= $today) {
            return 'active';
        }

        return null !== $terminationDate ? 'cancelled' : 'ended';
    }

    private function normalizeNullableString(mixed $value): ?string
    {
        if (!\is_string($value)) {
            return null;
        }

        $normalized = trim($value);

        return '' !== $normalized ? $normalized : null;
    }

    private function normalizeDateString(mixed $value): ?string
    {
        $normalized = $this->normalizeNullableString($value);
        if (null === $normalized) {
            return null;
        }

        try {
            return (new \DateTimeImmutable($normalized))->format('Y-m-d');
        } catch (\Exception) {
            return null;
        }
    }

    /**
     * @return int|string
     */
    private function normalizeId(string $identifier): int|string
    {
        if (preg_match('/^\d+$/', $identifier)) {
            return (int) $identifier;
        }

        return $identifier;
    }
}
