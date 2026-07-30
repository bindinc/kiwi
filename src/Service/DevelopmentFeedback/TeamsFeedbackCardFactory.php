<?php

declare(strict_types=1);

namespace App\Service\DevelopmentFeedback;

use App\Entity\DevelopmentFeedbackReport;

final class TeamsFeedbackCardFactory
{
    /**
     * @return array<string, mixed>
     */
    public function createCard(DevelopmentFeedbackReport $report, ?string $screenshotUrl, bool $containsOriginalData = false): array
    {
        $hasScreenshot = null !== $screenshotUrl;
        $body = [
            [
                'type' => 'TextBlock',
                'text' => $containsOriginalData ? 'New Kiwi contextual feedback with original data' : 'New Kiwi contextual feedback',
                'weight' => 'Bolder',
                'size' => 'Medium',
            ],
            [
                'type' => 'TextBlock',
                'text' => $this->buildScreenshotStatus($hasScreenshot, $containsOriginalData),
                'wrap' => true,
                'color' => $containsOriginalData ? 'Attention' : 'Default',
                'weight' => $containsOriginalData ? 'Bolder' : 'Default',
            ],
            [
                'type' => 'TextBlock',
                'text' => $this->truncate($report->getComment(), 1800),
                'wrap' => true,
            ],
            [
                'type' => 'FactSet',
                'facts' => $this->buildFacts($report),
            ],
        ];
        $actions = [
            [
                'type' => 'Action.OpenUrl',
                'title' => 'Open Kiwi page',
                'url' => $report->getPageUrl(),
            ],
        ];

        if ($hasScreenshot) {
            $body[] = [
                'type' => 'Image',
                'url' => $screenshotUrl,
                'altText' => $containsOriginalData ? 'Marked screenshot with original visible data for Kiwi feedback' : 'Marked screenshot with pseudo data for Kiwi feedback',
            ];
            $actions[] = [
                'type' => 'Action.OpenUrl',
                'title' => 'Open screenshot',
                'url' => $screenshotUrl,
            ];
        }

        return [
            'type' => 'message',
            'attachments' => [
                [
                    'contentType' => 'application/vnd.microsoft.card.adaptive',
                    'content' => [
                        '$schema' => 'http://adaptivecards.io/schemas/adaptive-card.json',
                        'type' => 'AdaptiveCard',
                        'version' => '1.4',
                        'body' => $body,
                        'actions' => $actions,
                    ],
                ],
            ],
        ];
    }

    /**
     * @return list<array{title: string, value: string}>
     */
    private function buildFacts(DevelopmentFeedbackReport $report): array
    {
        $facts = [
            ['title' => 'Reporter', 'value' => $this->formatReporter($report)],
            ['title' => 'Environment', 'value' => $report->getEnvironment()],
            ['title' => 'Track', 'value' => $report->getTrack()],
            ['title' => 'Page', 'value' => $this->truncate($report->getRoutePath(), 500)],
        ];

        if (DevelopmentFeedbackReport::SELECTION_NONE !== $report->getSelectionKind()) {
            $facts[] = ['title' => 'Selection', 'value' => ucfirst($report->getSelectionKind())];
            $facts[] = ['title' => 'Element', 'value' => $this->truncate($report->getSelectedElementLabel() ?? 'Unknown', 500)];
            $facts[] = ['title' => 'Selector', 'value' => $this->truncate($report->getSelectedElementSelector() ?? 'Unknown', 500)];
        }

        $facts[] = ['title' => 'Severity', 'value' => $report->getSeverity()];
        $facts[] = ['title' => 'Category', 'value' => $report->getCategory()];

        return $facts;
    }

    private function buildScreenshotStatus(bool $hasScreenshot, bool $containsOriginalData): string
    {
        if (!$hasScreenshot) {
            return 'No screenshot attached.';
        }

        return $containsOriginalData
            ? 'Screenshot contains original visible customer data.'
            : 'Screenshot contains pseudo data.';
    }

    private function formatReporter(DevelopmentFeedbackReport $report): string
    {
        $email = $report->getCreatedByEmail();
        if (null === $email) {
            return $report->getCreatedByDisplayName();
        }

        return sprintf('%s <%s>', $report->getCreatedByDisplayName(), $email);
    }

    private function truncate(string $value, int $maxLength): string
    {
        if (mb_strlen($value) <= $maxLength) {
            return $value;
        }

        return mb_substr($value, 0, $maxLength - 3).'...';
    }
}
