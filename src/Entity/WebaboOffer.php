<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\WebaboOfferRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: WebaboOfferRepository::class)]
#[ORM\Table(name: 'webabo_offers_cache')]
#[ORM\UniqueConstraint(name: 'uniq_webabo_offer_sales_code', columns: ['sales_code'])]
#[ORM\Index(name: 'idx_webabo_offer_offer_id', columns: ['offer_id'])]
#[ORM\Index(name: 'idx_webabo_offer_valid_until', columns: ['valid_until'])]
final class WebaboOffer
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(name: 'offer_id', nullable: true)]
    private ?int $offerId = null;

    #[ORM\Column(name: 'order_choice_key', nullable: true)]
    private ?int $orderChoiceKey = null;

    #[ORM\Column(name: 'sales_code', length: 64)]
    private string $salesCode;

    #[ORM\Column(length: 255)]
    private string $title;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $description = null;

    #[ORM\Column(name: 'additional_description', type: 'text', nullable: true)]
    private ?string $additionalDescription = null;

    #[ORM\Column(name: 'web_description', type: 'text', nullable: true)]
    private ?string $webDescription = null;

    #[ORM\Column(name: 'subscription_code', length: 64, nullable: true)]
    private ?string $subscriptionCode = null;

    #[ORM\Column(name: 'product_code', length: 64, nullable: true)]
    private ?string $productCode = null;

    #[ORM\Column(name: 'price_in_cents')]
    private int $priceInCents = 0;

    #[ORM\Column(name: 'price_code', length: 64, nullable: true)]
    private ?string $priceCode = null;

    #[ORM\Column(nullable: true)]
    private ?int $duration = null;

    #[ORM\Column(length: 64, nullable: true)]
    private ?string $frequency = null;

    #[ORM\Column(name: 'delivery_method_id', length: 64, nullable: true)]
    private ?string $deliveryMethodId = null;

    #[ORM\Column(name: 'valid_from', type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $validFrom = null;

    #[ORM\Column(name: 'valid_until', type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $validUntil = null;

    /**
     * @var array<string, mixed>
     */
    #[ORM\Column(name: 'raw_payload', type: 'json')]
    private array $rawPayload = [];

    #[ORM\Column(name: 'synced_at', type: 'datetime_immutable')]
    private \DateTimeImmutable $syncedAt;

    public function __construct(string $salesCode)
    {
        $this->salesCode = $salesCode;
        $this->title = $salesCode;
        $this->syncedAt = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
    }

    public function refreshFromWebaboPayload(array $payload, \DateTimeImmutable $syncedAt): void
    {
        $this->offerId = $this->normalizeInt($payload['offerId'] ?? null);
        $this->orderChoiceKey = $this->normalizeInt($payload['orderChoiceKey'] ?? null);
        $this->salesCode = trim((string) ($payload['salesCode'] ?? $this->salesCode));
        $this->title = $this->normalizeString($payload['title'] ?? null) ?? $this->salesCode;
        $this->description = $this->normalizeString($payload['description'] ?? null);
        $this->additionalDescription = $this->normalizeString($payload['additionalDescription'] ?? null);
        $this->webDescription = $this->normalizeString($payload['webDescription'] ?? null);
        $this->subscriptionCode = $this->normalizeString($payload['subscriptionCode'] ?? null);
        $this->productCode = $this->normalizeString($payload['productCode'] ?? null);
        $this->priceCode = $this->normalizeString($payload['offerPrice']['priceCode'] ?? null);
        $this->priceInCents = $this->normalizePriceInCents($payload['offerPrice']['price'] ?? null);
        $this->duration = $this->normalizeInt($payload['offerDelivery']['duration'] ?? null);
        $this->frequency = $this->normalizeString($payload['offerDelivery']['frequency'] ?? null);
        $this->deliveryMethodId = $this->normalizeString($payload['offerDelivery']['deliveryMethodId'] ?? null);
        $this->validFrom = $this->normalizeDateTime($payload['offerDelivery']['validDate']['validFrom'] ?? null);
        $this->validUntil = $this->normalizeDateTime($payload['offerDelivery']['validDate']['validUntil'] ?? null);
        $this->rawPayload = $payload;
        $this->syncedAt = $syncedAt;
    }

    public function getSalesCode(): string
    {
        return $this->salesCode;
    }

    public function getTitle(): string
    {
        return $this->title;
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function getAdditionalDescription(): ?string
    {
        return $this->additionalDescription;
    }

    public function getWebDescription(): ?string
    {
        return $this->webDescription;
    }

    public function getSubscriptionCode(): ?string
    {
        return $this->subscriptionCode;
    }

    public function getProductCode(): ?string
    {
        return $this->productCode;
    }

    public function getPrice(): float
    {
        return $this->priceInCents / 100;
    }

    public function getValidFrom(): ?\DateTimeImmutable
    {
        return $this->validFrom;
    }

    public function getValidUntil(): ?\DateTimeImmutable
    {
        return $this->validUntil;
    }

    public function isCurrentlyActive(?\DateTimeImmutable $reference = null): bool
    {
        $now = $reference ?? new \DateTimeImmutable('now', new \DateTimeZone('UTC'));

        if (null !== $this->validFrom && $this->validFrom > $now) {
            return false;
        }

        if (null !== $this->validUntil && $this->validUntil < $now) {
            return false;
        }

        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function getRawPayload(): array
    {
        return $this->rawPayload;
    }

    public function getSyncedAt(): \DateTimeImmutable
    {
        return $this->syncedAt;
    }

    private function normalizeString(mixed $value): ?string
    {
        if (!\is_string($value)) {
            return null;
        }

        $normalized = trim($value);

        return '' !== $normalized ? $normalized : null;
    }

    private function normalizeInt(mixed $value): ?int
    {
        return is_numeric($value) ? (int) $value : null;
    }

    private function normalizePriceInCents(mixed $value): int
    {
        if (!is_numeric($value)) {
            return 0;
        }

        return (int) round(((float) $value) * 100);
    }

    private function normalizeDateTime(mixed $value): ?\DateTimeImmutable
    {
        if (!\is_string($value) || '' === trim($value)) {
            return null;
        }

        try {
            return new \DateTimeImmutable($value);
        } catch (\Exception) {
            return null;
        }
    }
}
