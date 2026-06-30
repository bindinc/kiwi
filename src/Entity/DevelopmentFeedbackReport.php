<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\DevelopmentFeedbackReportRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: DevelopmentFeedbackReportRepository::class)]
#[ORM\Table(name: 'development_feedback_reports')]
#[ORM\UniqueConstraint(name: 'uniq_development_feedback_report_public_id', columns: ['public_id'])]
#[ORM\Index(name: 'idx_development_feedback_report_created_by', columns: ['created_by_user_id', 'created_at'])]
final class DevelopmentFeedbackReport
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(name: 'public_id', length: 36)]
    private string $publicId;

    #[ORM\Column(name: 'created_at', type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(name: 'created_by_user_id', length: 255)]
    private string $createdByUserId;

    #[ORM\Column(name: 'created_by_display_name', length: 255)]
    private string $createdByDisplayName;

    #[ORM\Column(name: 'created_by_email', length: 255, nullable: true)]
    private ?string $createdByEmail;

    #[ORM\Column(length: 32)]
    private string $environment;

    #[ORM\Column(length: 32)]
    private string $track;

    #[ORM\Column(name: 'page_url', type: 'text')]
    private string $pageUrl;

    #[ORM\Column(name: 'route_path', type: 'text')]
    private string $routePath;

    #[ORM\Column(name: 'viewport_width')]
    private int $viewportWidth;

    #[ORM\Column(name: 'viewport_height')]
    private int $viewportHeight;

    #[ORM\Column(name: 'device_pixel_ratio')]
    private float $devicePixelRatio;

    #[ORM\Column(name: 'user_agent', type: 'text')]
    private string $userAgent;

    #[ORM\Column(name: 'selected_element_tag', length: 64)]
    private string $selectedElementTag;

    #[ORM\Column(name: 'selected_element_label', length: 255)]
    private string $selectedElementLabel;

    #[ORM\Column(name: 'selected_element_selector', type: 'text')]
    private string $selectedElementSelector;

    #[ORM\Column(name: 'selected_element_text_sample', type: 'text', nullable: true)]
    private ?string $selectedElementTextSample;

    /**
     * @var array<string, int|float>
     */
    #[ORM\Column(name: 'selected_element_rect_json', type: 'json')]
    private array $selectedElementRectJson;

    /**
     * @var list<array<string, mixed>>
     */
    #[ORM\Column(name: 'annotation_json', type: 'json')]
    private array $annotationJson;

    #[ORM\Column(type: 'text')]
    private string $comment;

    #[ORM\Column(length: 32)]
    private string $severity;

    #[ORM\Column(length: 32)]
    private string $category;

    #[ORM\Column(name: 'teams_delivery_status', length: 32)]
    private string $teamsDeliveryStatus = 'pending';

    #[ORM\Column(name: 'teams_delivery_error', type: 'text', nullable: true)]
    private ?string $teamsDeliveryError = null;

    #[ORM\Column(name: 'teams_delivered_at', type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $teamsDeliveredAt = null;

    /**
     * @var Collection<int, DevelopmentFeedbackScreenshot>
     */
    #[ORM\OneToMany(mappedBy: 'report', targetEntity: DevelopmentFeedbackScreenshot::class, cascade: ['persist', 'remove'], orphanRemoval: true)]
    private Collection $screenshots;

    /**
     * @param array<string, int|float> $selectedElementRectJson
     * @param list<array<string, mixed>> $annotationJson
     */
    public function __construct(
        string $publicId,
        \DateTimeImmutable $createdAt,
        string $createdByUserId,
        string $createdByDisplayName,
        ?string $createdByEmail,
        string $environment,
        string $track,
        string $pageUrl,
        string $routePath,
        int $viewportWidth,
        int $viewportHeight,
        float $devicePixelRatio,
        string $userAgent,
        string $selectedElementTag,
        string $selectedElementLabel,
        string $selectedElementSelector,
        ?string $selectedElementTextSample,
        array $selectedElementRectJson,
        array $annotationJson,
        string $comment,
        string $severity,
        string $category,
    ) {
        $this->screenshots = new ArrayCollection();
        $this->publicId = $publicId;
        $this->createdAt = $createdAt;
        $this->createdByUserId = $createdByUserId;
        $this->createdByDisplayName = $createdByDisplayName;
        $this->createdByEmail = $createdByEmail;
        $this->environment = $environment;
        $this->track = $track;
        $this->pageUrl = $pageUrl;
        $this->routePath = $routePath;
        $this->viewportWidth = $viewportWidth;
        $this->viewportHeight = $viewportHeight;
        $this->devicePixelRatio = $devicePixelRatio;
        $this->userAgent = $userAgent;
        $this->selectedElementTag = $selectedElementTag;
        $this->selectedElementLabel = $selectedElementLabel;
        $this->selectedElementSelector = $selectedElementSelector;
        $this->selectedElementTextSample = $selectedElementTextSample;
        $this->selectedElementRectJson = $selectedElementRectJson;
        $this->annotationJson = $annotationJson;
        $this->comment = $comment;
        $this->severity = $severity;
        $this->category = $category;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getPublicId(): string
    {
        return $this->publicId;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getCreatedByUserId(): string
    {
        return $this->createdByUserId;
    }

    public function getCreatedByDisplayName(): string
    {
        return $this->createdByDisplayName;
    }

    public function getCreatedByEmail(): ?string
    {
        return $this->createdByEmail;
    }

    public function getEnvironment(): string
    {
        return $this->environment;
    }

    public function getTrack(): string
    {
        return $this->track;
    }

    public function getPageUrl(): string
    {
        return $this->pageUrl;
    }

    public function getRoutePath(): string
    {
        return $this->routePath;
    }

    public function getViewportWidth(): int
    {
        return $this->viewportWidth;
    }

    public function getViewportHeight(): int
    {
        return $this->viewportHeight;
    }

    public function getDevicePixelRatio(): float
    {
        return $this->devicePixelRatio;
    }

    public function getUserAgent(): string
    {
        return $this->userAgent;
    }

    public function getSelectedElementTag(): string
    {
        return $this->selectedElementTag;
    }

    public function getSelectedElementLabel(): string
    {
        return $this->selectedElementLabel;
    }

    public function getSelectedElementSelector(): string
    {
        return $this->selectedElementSelector;
    }

    public function getSelectedElementTextSample(): ?string
    {
        return $this->selectedElementTextSample;
    }

    /**
     * @return array<string, int|float>
     */
    public function getSelectedElementRectJson(): array
    {
        return $this->selectedElementRectJson;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function getAnnotationJson(): array
    {
        return $this->annotationJson;
    }

    public function getComment(): string
    {
        return $this->comment;
    }

    public function getSeverity(): string
    {
        return $this->severity;
    }

    public function getCategory(): string
    {
        return $this->category;
    }

    public function getTeamsDeliveryStatus(): string
    {
        return $this->teamsDeliveryStatus;
    }

    public function getTeamsDeliveryError(): ?string
    {
        return $this->teamsDeliveryError;
    }

    public function getTeamsDeliveredAt(): ?\DateTimeImmutable
    {
        return $this->teamsDeliveredAt;
    }

    public function markTeamsDelivery(string $status, ?string $error, ?\DateTimeImmutable $deliveredAt): void
    {
        $this->teamsDeliveryStatus = $status;
        $this->teamsDeliveryError = $error;
        $this->teamsDeliveredAt = $deliveredAt;
    }

    public function getScreenshot(): ?DevelopmentFeedbackScreenshot
    {
        $pseudonymizedScreenshot = $this->getScreenshotByVariant(DevelopmentFeedbackScreenshot::VARIANT_PSEUDONYMIZED);
        if (null !== $pseudonymizedScreenshot) {
            return $pseudonymizedScreenshot;
        }

        $firstScreenshot = $this->screenshots->first();

        return $firstScreenshot instanceof DevelopmentFeedbackScreenshot ? $firstScreenshot : null;
    }

    public function setScreenshot(DevelopmentFeedbackScreenshot $screenshot): void
    {
        $this->addScreenshot($screenshot);
    }

    /**
     * @return Collection<int, DevelopmentFeedbackScreenshot>
     */
    public function getScreenshots(): Collection
    {
        return $this->screenshots;
    }

    public function getScreenshotByVariant(string $variant): ?DevelopmentFeedbackScreenshot
    {
        foreach ($this->screenshots as $screenshot) {
            if ($screenshot->getVariant() === $variant) {
                return $screenshot;
            }
        }

        return null;
    }

    public function findScreenshotByAccessTokenHash(string $accessTokenHash): ?DevelopmentFeedbackScreenshot
    {
        foreach ($this->screenshots as $screenshot) {
            if (hash_equals($screenshot->getAccessTokenHash(), $accessTokenHash)) {
                return $screenshot;
            }
        }

        return null;
    }

    public function addScreenshot(DevelopmentFeedbackScreenshot $screenshot): void
    {
        foreach ($this->screenshots as $existingScreenshot) {
            if ($existingScreenshot->getVariant() === $screenshot->getVariant()) {
                $this->screenshots->removeElement($existingScreenshot);
                break;
            }
        }

        $this->screenshots->add($screenshot);
        $screenshot->setReport($this);
    }
}
