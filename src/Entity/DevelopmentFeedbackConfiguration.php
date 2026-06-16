<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'development_feedback_configuration')]
final class DevelopmentFeedbackConfiguration
{
    #[ORM\Id]
    #[ORM\Column]
    private int $id = 1;

    #[ORM\Column(name: 'feedback_enabled')]
    private bool $feedbackEnabled = false;

    #[ORM\Column(name: 'webhook_url', type: 'text', nullable: true)]
    private ?string $webhookUrl = null;

    #[ORM\Column(name: 'public_base_url', length: 2048, nullable: true)]
    private ?string $publicBaseUrl = null;

    #[ORM\Column(name: 'image_ttl_days')]
    private int $imageTtlDays = 30;

    #[ORM\Column(name: 'max_image_bytes')]
    private int $maxImageBytes = 3145728;

    #[ORM\Column(name: 'updated_at', type: 'datetime_immutable')]
    private \DateTimeImmutable $updatedAt;

    public function __construct()
    {
        $this->updatedAt = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
    }

    public function getId(): int
    {
        return $this->id;
    }

    public function isFeedbackEnabled(): bool
    {
        return $this->feedbackEnabled;
    }

    public function setFeedbackEnabled(bool $feedbackEnabled): void
    {
        $this->feedbackEnabled = $feedbackEnabled;
        $this->touch();
    }

    public function getWebhookUrl(): ?string
    {
        return $this->webhookUrl;
    }

    public function setWebhookUrl(?string $webhookUrl): void
    {
        $webhookUrl = null !== $webhookUrl ? trim($webhookUrl) : null;
        $this->webhookUrl = '' === $webhookUrl ? null : $webhookUrl;
        $this->touch();
    }

    public function getPublicBaseUrl(): ?string
    {
        return $this->publicBaseUrl;
    }

    public function setPublicBaseUrl(?string $publicBaseUrl): void
    {
        $publicBaseUrl = null !== $publicBaseUrl ? rtrim(trim($publicBaseUrl), '/') : null;
        $this->publicBaseUrl = '' === $publicBaseUrl ? null : $publicBaseUrl;
        $this->touch();
    }

    public function getImageTtlDays(): int
    {
        return $this->imageTtlDays;
    }

    public function setImageTtlDays(int $imageTtlDays): void
    {
        $this->imageTtlDays = $imageTtlDays;
        $this->touch();
    }

    public function getMaxImageBytes(): int
    {
        return $this->maxImageBytes;
    }

    public function setMaxImageBytes(int $maxImageBytes): void
    {
        $this->maxImageBytes = $maxImageBytes;
        $this->touch();
    }

    public function getUpdatedAt(): \DateTimeImmutable
    {
        return $this->updatedAt;
    }

    private function touch(): void
    {
        $this->updatedAt = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
    }
}
