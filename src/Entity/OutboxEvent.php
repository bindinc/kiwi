<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'outbox_events')]
#[ORM\Index(name: 'idx_outbox_event_status_available_at', columns: ['status', 'available_at'])]
#[ORM\Index(name: 'idx_outbox_event_order_id', columns: ['order_id'])]
final class OutboxEvent
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: SubscriptionOrder::class, inversedBy: 'outboxEvents')]
    #[ORM\JoinColumn(name: 'order_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private SubscriptionOrder $order;

    #[ORM\Column(name: 'event_type', length: 64)]
    private string $eventType;

    #[ORM\Column(length: 32)]
    private string $status = 'pending';

    #[ORM\Column(name: 'attempt_count')]
    private int $attemptCount = 0;

    #[ORM\Column(name: 'last_error_code', length: 64, nullable: true)]
    private ?string $lastErrorCode = null;

    #[ORM\Column(name: 'last_error_message', type: 'text', nullable: true)]
    private ?string $lastErrorMessage = null;

    /**
     * @var array<string, mixed>
     */
    #[ORM\Column(type: 'json')]
    private array $payload = [];

    #[ORM\Column(name: 'available_at', type: 'datetime_immutable')]
    private \DateTimeImmutable $availableAt;

    #[ORM\Column(name: 'created_at', type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(name: 'updated_at', type: 'datetime_immutable')]
    private \DateTimeImmutable $updatedAt;

    /**
     * @param array<string, mixed> $payload
     */
    public function __construct(
        string $eventType,
        array $payload,
        \DateTimeImmutable $createdAt,
    ) {
        $this->eventType = $eventType;
        $this->payload = $payload;
        $this->availableAt = $createdAt;
        $this->createdAt = $createdAt;
        $this->updatedAt = $createdAt;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setOrder(SubscriptionOrder $order): void
    {
        $this->order = $order;
    }

    public function getEventType(): string
    {
        return $this->eventType;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function getAttemptCount(): int
    {
        return $this->attemptCount;
    }

    public function getLastErrorCode(): ?string
    {
        return $this->lastErrorCode;
    }

    public function getLastErrorMessage(): ?string
    {
        return $this->lastErrorMessage;
    }

    /**
     * @return array<string, mixed>
     */
    public function getPayload(): array
    {
        return $this->payload;
    }

    public function getAvailableAt(): \DateTimeImmutable
    {
        return $this->availableAt;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): \DateTimeImmutable
    {
        return $this->updatedAt;
    }
}
