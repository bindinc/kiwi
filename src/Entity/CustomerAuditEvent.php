<?php

declare(strict_types=1);

namespace App\Entity;

use App\CustomerWorkSession\CustomerAuditAction;
use App\CustomerWorkSession\CustomerAuditResult;
use App\CustomerWorkSession\CustomerReference;
use App\Repository\CustomerAuditEventRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: CustomerAuditEventRepository::class)]
#[ORM\Table(name: 'customer_audit_events')]
#[ORM\Index(name: 'idx_customer_audit_occurred_at', columns: ['occurred_at'])]
#[ORM\Index(name: 'idx_customer_audit_action', columns: ['action'])]
#[ORM\Index(name: 'idx_customer_audit_workflow_session', columns: ['workflow_session_id'])]
final class CustomerAuditEvent
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(name: 'occurred_at', type: 'datetime_immutable')]
    private \DateTimeImmutable $occurredAt;

    #[ORM\Column(name: 'actor_identifier', length: 255)]
    private string $actorIdentifier;

    #[ORM\Column(length: 40, enumType: CustomerAuditAction::class)]
    private CustomerAuditAction $action;

    #[ORM\Column(length: 16, enumType: CustomerAuditResult::class)]
    private CustomerAuditResult $result;

    #[ORM\Column(name: 'workflow_session_id', length: 128)]
    private string $workflowSessionId;

    #[ORM\Column(name: 'context_generation')]
    private int $contextGeneration;

    #[ORM\Column(name: 'request_id', length: 64)]
    private string $requestId;

    /**
     * @var array<string, string>|null
     */
    #[ORM\Column(name: 'customer_reference', type: 'json', nullable: true)]
    private ?array $customerReference;

    /**
     * @var array<string, mixed>
     */
    #[ORM\Column(type: 'json')]
    private array $metadata;

    /**
     * @param array<string, mixed> $metadata
     */
    public function __construct(
        string $actorIdentifier,
        CustomerAuditAction $action,
        CustomerAuditResult $result,
        string $workflowSessionId,
        int $contextGeneration,
        string $requestId,
        ?CustomerReference $customerReference,
        array $metadata,
        \DateTimeImmutable $occurredAt,
    ) {
        $this->actorIdentifier = $actorIdentifier;
        $this->action = $action;
        $this->result = $result;
        $this->workflowSessionId = $workflowSessionId;
        $this->contextGeneration = $contextGeneration;
        $this->requestId = $requestId;
        $this->customerReference = $customerReference?->toArray();
        $this->metadata = $metadata;
        $this->occurredAt = $occurredAt;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getAction(): CustomerAuditAction
    {
        return $this->action;
    }

    public function getResult(): CustomerAuditResult
    {
        return $this->result;
    }

    public function getRequestId(): string
    {
        return $this->requestId;
    }

    /**
     * @return array<string, string>|null
     */
    public function getCustomerReference(): ?array
    {
        return $this->customerReference;
    }

    /**
     * @return array<string, mixed>
     */
    public function getMetadata(): array
    {
        return $this->metadata;
    }
}
