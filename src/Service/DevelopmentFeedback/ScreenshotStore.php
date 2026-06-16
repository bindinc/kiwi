<?php

declare(strict_types=1);

namespace App\Service\DevelopmentFeedback;

use App\Entity\DevelopmentFeedbackReport;
use App\Entity\DevelopmentFeedbackScreenshot;
use App\Http\ApiProblemException;
use Symfony\Component\HttpFoundation\File\UploadedFile;

final class ScreenshotStore
{
    private const PNG_SIGNATURE = "\x89PNG\r\n\x1A\n";

    public function __construct(
        private readonly DevelopmentFeedbackSettings $settings,
        private readonly SignedScreenshotUrlGenerator $urlGenerator,
    ) {
    }

    /**
     * @return array{screenshot: DevelopmentFeedbackScreenshot, token: string}
     */
    public function storePng(DevelopmentFeedbackReport $report, UploadedFile $file, \DateTimeImmutable $now): array
    {
        if (!$file->isValid()) {
            throw new ApiProblemException(400, 'invalid_screenshot', 'screenshot upload is invalid');
        }

        $bytes = file_get_contents($file->getPathname());
        if (false === $bytes || '' === $bytes) {
            throw new ApiProblemException(400, 'invalid_screenshot', 'screenshot is required');
        }

        $byteSize = strlen($bytes);
        $maxImageBytes = $this->settings->getMaxImageBytes();
        if ($byteSize > $maxImageBytes) {
            throw new ApiProblemException(413, 'screenshot_too_large', 'screenshot exceeds the maximum upload size', [
                'max_bytes' => $maxImageBytes,
            ]);
        }

        [$width, $height] = $this->readPngDimensions($bytes);
        $token = $this->urlGenerator->createToken();
        $expiresAt = $now->modify(sprintf('+%d days', $this->settings->getImageTtlDays()));
        $storagePath = sprintf('postgresql://development-feedback/screenshots/%s.png', $report->getPublicId());

        $screenshot = new DevelopmentFeedbackScreenshot(
            $storagePath,
            'image/png',
            $byteSize,
            $width,
            $height,
            hash('sha256', $bytes),
            $this->urlGenerator->hashToken($token),
            $expiresAt,
            $now,
            $bytes,
        );
        $report->setScreenshot($screenshot);

        return [
            'screenshot' => $screenshot,
            'token' => $token,
        ];
    }

    /**
     * @return array{0: int, 1: int}
     */
    private function readPngDimensions(string $bytes): array
    {
        if (!str_starts_with($bytes, self::PNG_SIGNATURE) || strlen($bytes) < 24) {
            throw new ApiProblemException(400, 'invalid_screenshot', 'screenshot must be a PNG image');
        }

        $chunkType = substr($bytes, 12, 4);
        if ('IHDR' !== $chunkType) {
            throw new ApiProblemException(400, 'invalid_screenshot', 'screenshot must be a PNG image');
        }

        $dimensions = unpack('Nwidth/Nheight', substr($bytes, 16, 8));
        $width = (int) ($dimensions['width'] ?? 0);
        $height = (int) ($dimensions['height'] ?? 0);

        if ($width < 1 || $height < 1) {
            throw new ApiProblemException(400, 'invalid_screenshot', 'screenshot dimensions are invalid');
        }

        return [$width, $height];
    }
}
