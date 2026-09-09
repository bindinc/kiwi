<?php

declare(strict_types=1);

namespace App\Service\DevelopmentFeedback;

use App\Entity\DevelopmentFeedbackScreenshot;

final class DevelopmentFeedbackRetention
{
    public const MAX_DAYS = 14;

    public function isScreenshotExpired(DevelopmentFeedbackScreenshot $screenshot, \DateTimeImmutable $now): bool
    {
        $oldestKeptCreatedAt = $now->modify(sprintf('-%d days', self::MAX_DAYS));
        $tokenExpired = $screenshot->getAccessTokenExpiresAt() <= $now;
        $screenshotExpired = $screenshot->getCreatedAt() <= $oldestKeptCreatedAt;
        $reportExpired = $screenshot->getReport()->getCreatedAt() <= $oldestKeptCreatedAt;

        return $tokenExpired || $screenshotExpired || $reportExpired;
    }
}
