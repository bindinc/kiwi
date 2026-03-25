<?php

declare(strict_types=1);

namespace App\Service;

final class SubscriptionQueueDisplayFormatter
{
    private const DISPLAY_TIMEZONE = 'Europe/Amsterdam';

    private readonly \DateTimeZone $displayTimeZone;

    public function __construct()
    {
        $this->displayTimeZone = new \DateTimeZone(self::DISPLAY_TIMEZONE);
    }

    /**
     * @param array<string, mixed> $orderPayload
     * @return array<string, string>
     */
    public function formatOrderPayload(array $orderPayload): array
    {
        $summary = \is_array($orderPayload['summary'] ?? null) ? $orderPayload['summary'] : [];
        $typeLabel = $this->normalizeTypeLabel($summary['typeLabel'] ?? null);
        $title = $this->buildTitle($summary);
        $recipientSegment = $this->buildRecipientSegment($summary);
        $offer = \is_array($summary['offer'] ?? null) ? $summary['offer'] : [];
        $offerCode = $this->normalizeString($offer['salesCode'] ?? null) ?? '';
        $queuedTime = $this->formatQueuedTime($orderPayload['queuedAt'] ?? null);
        $statusLabel = $this->formatStatusLabel($orderPayload);
        $lineDescription = $this->buildLineDescription($typeLabel, $title, $offerCode, $recipientSegment);

        return [
            'line' => sprintf(
                '%s %s: %s',
                $queuedTime,
                $this->capitalizeLabel($statusLabel),
                $lineDescription,
            ),
            'agentBadge' => $this->buildAgentBadge($summary),
            'statusLabel' => $statusLabel,
            'typeLabel' => $typeLabel,
            'queuedTime' => $queuedTime,
            'title' => $title,
            'recipientSegment' => $recipientSegment,
        ];
    }

    public function normalizeTypeLabel(mixed $typeLabel): string
    {
        $rawTypeLabel = $this->normalizeString($typeLabel);
        if (null === $rawTypeLabel) {
            return 'Aanvraag';
        }

        $normalizedTypeLabel = function_exists('mb_strtolower')
            ? mb_strtolower($rawTypeLabel)
            : strtolower($rawTypeLabel);

        if (str_contains($normalizedTypeLabel, 'opzeg') || str_contains($normalizedTypeLabel, 'winback')) {
            return 'Opzegging';
        }

        if (str_contains($normalizedTypeLabel, 'wijzig') || str_contains($normalizedTypeLabel, 'mutat')) {
            return 'Wijziging';
        }

        if (
            str_contains($normalizedTypeLabel, 'aanvraag')
            || str_contains($normalizedTypeLabel, 'abonnement')
            || str_contains($normalizedTypeLabel, 'nieuw')
        ) {
            return 'Aanvraag';
        }

        return $rawTypeLabel;
    }

    /**
     * @param array<string, mixed> $summary
     */
    private function buildAgentBadge(array $summary): string
    {
        $agent = \is_array($summary['agent'] ?? null) ? $summary['agent'] : [];
        $initials = $this->normalizeString($agent['initials'] ?? null);
        if (null !== $initials) {
            return $this->upperString(substr($initials, 0, 3));
        }

        $shortName = $this->normalizeString($agent['shortName'] ?? null) ?? '';
        $tokens = preg_split('/\s+/', $shortName) ?: [];
        $tokens = array_values(array_filter(array_map(static function (string $token): string {
            return preg_replace('/[^a-z0-9]/i', '', $token) ?? '';
        }, $tokens)));

        if ([] === $tokens) {
            return 'KM';
        }

        if (1 === count($tokens)) {
            return $this->upperString(substr($tokens[0], 0, 2));
        }

        return $this->upperString($tokens[0][0].$tokens[count($tokens) - 1][0]);
    }

    /**
     * @param array<string, mixed> $summary
     */
    private function buildTitle(array $summary): string
    {
        $offer = \is_array($summary['offer'] ?? null) ? $summary['offer'] : [];

        return $this->normalizeString($offer['title'] ?? null) ?? '';
    }

    /**
     * @param array<string, mixed> $summary
     */
    private function buildRecipientSegment(array $summary): string
    {
        $recipient = \is_array($summary['recipient'] ?? null) ? $summary['recipient'] : [];
        $recipientName = $this->normalizeString($recipient['displayName'] ?? null) ?? 'Onbekende persoon';
        $recipientId = null !== ($recipient['personId'] ?? null) ? (string) $recipient['personId'] : 'nieuw';

        return sprintf('%s (%s)', $recipientName, $recipientId);
    }

    private function buildLineDescription(
        string $typeLabel,
        string $title,
        string $offerCode,
        string $recipientSegment,
    ): string {
        $segments = [$typeLabel];

        if ('' !== $title) {
            $segments[] = sprintf("'%s'", $title);
        }

        if ('' !== $offerCode) {
            $segments[] = sprintf('(%s)', $offerCode);
        }

        $segments[] = 'voor';
        $segments[] = $recipientSegment;

        return implode(' ', array_values(array_filter(
            $segments,
            static fn (string $segment): bool => '' !== $segment,
        )));
    }

    /**
     * @param array<string, mixed> $orderPayload
     */
    private function formatStatusLabel(array $orderPayload): string
    {
        $event = \is_array($orderPayload['event'] ?? null) ? $orderPayload['event'] : [];
        $status = strtolower((string) ($event['status'] ?? $orderPayload['status'] ?? ''));
        $rawAttemptCount = $event['attemptCount'] ?? $orderPayload['attemptCount'] ?? 0;
        $attemptCount = is_numeric($rawAttemptCount) ? (int) $rawAttemptCount : 0;

        if ('processed' === $status || 'delivered' === $status) {
            return 'verwerkt';
        }

        if ('failed' === $status) {
            return 'mislukt';
        }

        if ('retrying' === $status || 'retry_scheduled' === $status) {
            return sprintf('poging %02d', max(1, $attemptCount));
        }

        return 'in behandeling';
    }

    private function formatQueuedTime(mixed $queuedAt): string
    {
        try {
            if ($queuedAt instanceof \DateTimeInterface) {
                $dateTime = \DateTimeImmutable::createFromInterface($queuedAt);
            } elseif (\is_string($queuedAt) && '' !== trim($queuedAt)) {
                $dateTime = new \DateTimeImmutable($queuedAt);
            } else {
                return '--.--';
            }
        } catch (\Throwable) {
            return '--.--';
        }

        return $dateTime->setTimezone($this->displayTimeZone)->format('H.i');
    }

    private function normalizeString(mixed $value): ?string
    {
        if (!\is_scalar($value)) {
            return null;
        }

        $normalized = trim((string) $value);

        return '' !== $normalized ? $normalized : null;
    }

    private function upperString(string $value): string
    {
        if (function_exists('mb_strtoupper')) {
            return mb_strtoupper($value);
        }

        return strtoupper($value);
    }

    private function capitalizeLabel(string $value): string
    {
        if ('' === $value) {
            return $value;
        }

        if (function_exists('mb_substr')) {
            $firstCharacter = mb_substr($value, 0, 1);
            $remaining = mb_substr($value, 1);

            return $this->upperString($firstCharacter).$remaining;
        }

        return ucfirst($value);
    }
}
