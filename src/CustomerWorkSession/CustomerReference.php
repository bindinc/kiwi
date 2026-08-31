<?php

declare(strict_types=1);

namespace App\CustomerWorkSession;

use Symfony\Component\HttpFoundation\Request;

final readonly class CustomerReference
{
    private function __construct(
        public string $personId,
        public string $credentialKey,
        public string $sourceSystem,
        public string $divisionId,
        public string $mandant,
    ) {
    }

    /**
     * @param array<string, mixed>|null $data
     */
    public static function fromArray(?array $data, string|int|null $fallbackPersonId = null): ?self
    {
        $data ??= [];
        $personId = self::firstNonEmptyString([
            $data['personId'] ?? null,
            $data['personNumber'] ?? null,
            $data['id'] ?? null,
            $fallbackPersonId,
        ]);
        if (null === $personId) {
            return null;
        }

        $credentialKey = self::normalizeString($data['credentialKey'] ?? null);
        $sourceSystem = self::normalizeString($data['sourceSystem'] ?? null);
        if ('' === $sourceSystem) {
            $sourceSystem = '' !== $credentialKey ? 'subscription-api' : 'kiwi';
        }

        return new self(
            $personId,
            $credentialKey,
            $sourceSystem,
            self::normalizeString($data['divisionId'] ?? null),
            self::normalizeString($data['mandant'] ?? null),
        );
    }

    public static function fromRequestHeaders(Request $request): ?self
    {
        return self::fromArray([
            'personId' => $request->headers->get('X-Kiwi-Customer-Person-Id'),
            'credentialKey' => $request->headers->get('X-Kiwi-Customer-Credential-Key'),
            'sourceSystem' => $request->headers->get('X-Kiwi-Customer-Source-System'),
            'divisionId' => $request->headers->get('X-Kiwi-Customer-Division-Id'),
            'mandant' => $request->headers->get('X-Kiwi-Customer-Mandant'),
        ]);
    }

    /**
     * @return array{personId: string, credentialKey: string, sourceSystem: string, divisionId: string, mandant: string}
     */
    public function toArray(): array
    {
        return [
            'personId' => $this->personId,
            'credentialKey' => $this->credentialKey,
            'sourceSystem' => $this->sourceSystem,
            'divisionId' => $this->divisionId,
            'mandant' => $this->mandant,
        ];
    }

    /**
     * @param list<mixed> $values
     */
    private static function firstNonEmptyString(array $values): ?string
    {
        foreach ($values as $value) {
            $normalizedValue = self::normalizeString($value);
            if ('' !== $normalizedValue) {
                return $normalizedValue;
            }
        }

        return null;
    }

    private static function normalizeString(mixed $value): string
    {
        if (!\is_string($value) && !\is_int($value)) {
            return '';
        }

        return trim((string) $value);
    }
}
