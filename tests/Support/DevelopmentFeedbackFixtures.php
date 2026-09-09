<?php

declare(strict_types=1);

namespace App\Tests\Support;

use App\Entity\DevelopmentFeedbackReport;
use App\Entity\DevelopmentFeedbackScreenshot;

trait DevelopmentFeedbackFixtures
{
    private function createFeedbackReport(\DateTimeImmutable $createdAt): DevelopmentFeedbackReport
    {
        return new DevelopmentFeedbackReport(
            publicId: bin2hex(random_bytes(16)),
            createdAt: $createdAt,
            createdByUserId: 'retention-test',
            createdByDisplayName: 'Retention Test',
            createdByEmail: 'retention@example.org',
            environment: 'local',
            track: 'active',
            pageUrl: 'https://example.org/kiwi',
            routePath: '/kiwi',
            viewportWidth: 1,
            viewportHeight: 1,
            devicePixelRatio: 1.0,
            userAgent: 'phpunit',
            selectionKind: DevelopmentFeedbackReport::SELECTION_NONE,
            selectedElementTag: null,
            selectedElementLabel: null,
            selectedElementSelector: null,
            selectedElementTextSample: null,
            selectedElementRectJson: null,
            annotationJson: [],
            comment: 'Retention test',
            severity: 'normal',
            category: 'bug',
        );
    }

    private function addFeedbackScreenshot(
        DevelopmentFeedbackReport $report,
        \DateTimeImmutable $createdAt,
        \DateTimeImmutable $expiresAt,
        string $variant = DevelopmentFeedbackScreenshot::VARIANT_PSEUDONYMIZED,
    ): DevelopmentFeedbackScreenshot {
        $bytes = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lO2e0wAAAABJRU5ErkJggg==');
        $screenshot = new DevelopmentFeedbackScreenshot(
            $variant, 'postgresql://retention-test/'.$variant.'.png', 'image/png',
            strlen($bytes), 1, 1, hash('sha256', $bytes), hash('sha256', $variant),
            $expiresAt, $createdAt, $bytes,
        );
        $report->addScreenshot($screenshot);

        return $screenshot;
    }
}
