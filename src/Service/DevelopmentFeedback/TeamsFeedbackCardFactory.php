<?php

declare(strict_types=1);

namespace App\Service\DevelopmentFeedback;

use App\Entity\DevelopmentFeedbackReport;

final class TeamsFeedbackCardFactory
{
    /**
     * @return array<string, mixed>
     */
    public function createCard(DevelopmentFeedbackReport $report, string $screenshotUrl): array
    {
        return [
            'type' => 'message',
            'attachments' => [
                [
                    'contentType' => 'application/vnd.microsoft.card.adaptive',
                    'content' => [
                        '$schema' => 'http://adaptivecards.io/schemas/adaptive-card.json',
                        'type' => 'AdaptiveCard',
                        'version' => '1.4',
                        'body' => [
                            [
                                'type' => 'TextBlock',
                                'text' => 'New Kiwi contextual feedback',
                                'weight' => 'Bolder',
                                'size' => 'Medium',
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
                            [
                                'type' => 'Image',
                                'url' => $screenshotUrl,
                                'altText' => 'Marked screenshot for Kiwi feedback',
                            ],
                        ],
                        'actions' => [
                            [
                                'type' => 'Action.OpenUrl',
                                'title' => 'Open Kiwi page',
                                'url' => $report->getPageUrl(),
                            ],
                            [
                                'type' => 'Action.OpenUrl',
                                'title' => 'Open screenshot',
                                'url' => $screenshotUrl,
                            ],
                        ],
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
        return [
            ['title' => 'Reporter', 'value' => $this->formatReporter($report)],
            ['title' => 'Environment', 'value' => $report->getEnvironment()],
            ['title' => 'Track', 'value' => $report->getTrack()],
            ['title' => 'Page', 'value' => $this->truncate($report->getRoutePath(), 500)],
            ['title' => 'Element', 'value' => $this->truncate($report->getSelectedElementLabel(), 500)],
            ['title' => 'Selector', 'value' => $this->truncate($report->getSelectedElementSelector(), 500)],
            ['title' => 'Severity', 'value' => $report->getSeverity()],
            ['title' => 'Category', 'value' => $report->getCategory()],
        ];
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
