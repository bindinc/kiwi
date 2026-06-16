<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'development_feedback_screenshots')]
#[ORM\Index(name: 'idx_development_feedback_screenshot_token_expiry', columns: ['access_token_expires_at'])]
final class DevelopmentFeedbackScreenshot
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\OneToOne(inversedBy: 'screenshot', targetEntity: DevelopmentFeedbackReport::class)]
    #[ORM\JoinColumn(name: 'report_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private DevelopmentFeedbackReport $report;

    #[ORM\Column(name: 'storage_path', type: 'text')]
    private string $storagePath;

    #[ORM\Column(name: 'mime_type', length: 64)]
    private string $mimeType;

    #[ORM\Column(name: 'byte_size')]
    private int $byteSize;

    #[ORM\Column]
    private int $width;

    #[ORM\Column]
    private int $height;

    #[ORM\Column(length: 64)]
    private string $sha256;

    #[ORM\Column(name: 'access_token_hash', length: 64)]
    private string $accessTokenHash;

    #[ORM\Column(name: 'access_token_expires_at', type: 'datetime_immutable')]
    private \DateTimeImmutable $accessTokenExpiresAt;

    #[ORM\Column(name: 'created_at', type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(name: 'image_data', type: 'blob')]
    private mixed $imageData;

    public function __construct(
        string $storagePath,
        string $mimeType,
        int $byteSize,
        int $width,
        int $height,
        string $sha256,
        string $accessTokenHash,
        \DateTimeImmutable $accessTokenExpiresAt,
        \DateTimeImmutable $createdAt,
        string $imageData,
    ) {
        $this->storagePath = $storagePath;
        $this->mimeType = $mimeType;
        $this->byteSize = $byteSize;
        $this->width = $width;
        $this->height = $height;
        $this->sha256 = $sha256;
        $this->accessTokenHash = $accessTokenHash;
        $this->accessTokenExpiresAt = $accessTokenExpiresAt;
        $this->createdAt = $createdAt;
        $this->imageData = $imageData;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getReport(): DevelopmentFeedbackReport
    {
        return $this->report;
    }

    public function setReport(DevelopmentFeedbackReport $report): void
    {
        $this->report = $report;
    }

    public function getStoragePath(): string
    {
        return $this->storagePath;
    }

    public function getMimeType(): string
    {
        return $this->mimeType;
    }

    public function getByteSize(): int
    {
        return $this->byteSize;
    }

    public function getWidth(): int
    {
        return $this->width;
    }

    public function getHeight(): int
    {
        return $this->height;
    }

    public function getSha256(): string
    {
        return $this->sha256;
    }

    public function getAccessTokenHash(): string
    {
        return $this->accessTokenHash;
    }

    public function getAccessTokenExpiresAt(): \DateTimeImmutable
    {
        return $this->accessTokenExpiresAt;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getImageData(): string
    {
        if (\is_resource($this->imageData)) {
            $contents = stream_get_contents($this->imageData);

            return false === $contents ? '' : $contents;
        }

        return \is_string($this->imageData) ? $this->imageData : '';
    }
}
