<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\SubscriptionOrderRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: SubscriptionOrderRepository::class)]
#[ORM\Table(name: 'subscription_orders')]
#[ORM\UniqueConstraint(name: 'uniq_subscription_order_submission_id', columns: ['submission_id'])]
#[ORM\Index(name: 'idx_subscription_order_status', columns: ['status'])]
#[ORM\Index(name: 'idx_subscription_order_queued_at', columns: ['queued_at'])]
final class SubscriptionOrder
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(name: 'submission_id', length: 128)]
    private string $submissionId;

    #[ORM\Column(length: 32)]
    private string $status = 'queued';

    #[ORM\Column(name: 'attempt_count')]
    private int $attemptCount = 0;

    #[ORM\Column(name: 'last_error_code', length: 64, nullable: true)]
    private ?string $lastErrorCode = null;

    #[ORM\Column(name: 'last_error_message', type: 'text', nullable: true)]
    private ?string $lastErrorMessage = null;

    /**
     * @var array<string, mixed>
     */
    #[ORM\Column(name: 'request_payload', type: 'json')]
    private array $requestPayload = [];

    /**
     * @var array<string, mixed>
     */
    #[ORM\Column(name: 'summary_payload', type: 'json')]
    private array $summaryPayload = [];

    #[ORM\Column(name: 'queued_at', type: 'datetime_immutable')]
    private \DateTimeImmutable $queuedAt;

    #[ORM\Column(name: 'updated_at', type: 'datetime_immutable')]
    private \DateTimeImmutable $updatedAt;

    /**
     * @var Collection<int, OutboxEvent>
     */
    #[ORM\OneToMany(mappedBy: 'order', targetEntity: OutboxEvent::class, cascade: ['persist'], orphanRemoval: true)]
    private Collection $outboxEvents;

    /**
     * @param array<string, mixed> $requestPayload
     * @param array<string, mixed> $summaryPayload
     */
    public function __construct(
        string $submissionId,
        array $requestPayload,
        array $summaryPayload,
        \DateTimeImmutable $queuedAt,
    ) {
        $this->submissionId = $submissionId;
        $this->requestPayload = $requestPayload;
        $this->summaryPayload = $summaryPayload;
        $this->queuedAt = $queuedAt;
        $this->updatedAt = $queuedAt;
        $this->outboxEvents = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getSubmissionId(): string
    {
        return $this->submissionId;
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
    public function getRequestPayload(): array
    {
        return $this->requestPayload;
    }

    /**
     * @return array<string, mixed>
     */
    public function getSummaryPayload(): array
    {
        return $this->summaryPayload;
    }

    public function getQueuedAt(): \DateTimeImmutable
    {
        return $this->queuedAt;
    }

    public function getUpdatedAt(): \DateTimeImmutable
    {
        return $this->updatedAt;
    }

    public function addOutboxEvent(OutboxEvent $outboxEvent): void
    {
        if ($this->outboxEvents->contains($outboxEvent)) {
            return;
        }

        $this->outboxEvents->add($outboxEvent);
        $outboxEvent->setOrder($this);
        $this->updatedAt = $outboxEvent->getUpdatedAt();
    }

    public function getLatestOutboxEvent(): ?OutboxEvent
    {
        $latestEvent = null;

        foreach ($this->outboxEvents as $outboxEvent) {
            if (null === $latestEvent || $outboxEvent->getCreatedAt() > $latestEvent->getCreatedAt()) {
                $latestEvent = $outboxEvent;
            }
        }

        return $latestEvent;
    }
}
