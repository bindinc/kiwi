<?php

declare(strict_types=1);

namespace App\Tests\Unit\DevelopmentFeedback;

use App\Entity\DevelopmentFeedbackReport;
use App\Service\DevelopmentFeedback\TeamsFeedbackCardFactory;
use PHPUnit\Framework\TestCase;

final class TeamsFeedbackCardFactoryTest extends TestCase
{
    public function testCardContainsRequiredFeedbackFieldsAndScreenshotUrl(): void
    {
        $report = $this->createReport();
        $card = (new TeamsFeedbackCardFactory())->createCard($report, 'https://example.org/kiwi/api/v1/development-feedback/screenshots/id/token.png');
        $content = $card['attachments'][0]['content'];
        $facts = $content['body'][2]['facts'];

        self::assertSame('message', $card['type']);
        self::assertSame('New Kiwi contextual feedback', $content['body'][0]['text']);
        self::assertSame('The button overlaps the date picker.', $content['body'][1]['text']);
        self::assertSame('https://example.org/kiwi/api/v1/development-feedback/screenshots/id/token.png', $content['body'][3]['url']);
        self::assertContains(['title' => 'Reporter', 'value' => 'Test User <test@example.org>'], $facts);
        self::assertContains(['title' => 'Environment', 'value' => 'preview'], $facts);
        self::assertContains(['title' => 'Page', 'value' => '/kiwi/customer'], $facts);
        self::assertContains(['title' => 'Element', 'value' => 'Create subscription'], $facts);
        self::assertContains(['title' => 'Selector', 'value' => '[data-feedback-id="create"]'], $facts);
    }

    private function createReport(): DevelopmentFeedbackReport
    {
        return new DevelopmentFeedbackReport(
            'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            new \DateTimeImmutable('2026-06-16T12:00:00+00:00'),
            'test@example.org',
            'Test User',
            'test@example.org',
            'preview',
            'active',
            'https://example.org/kiwi/customer',
            '/kiwi/customer',
            1440,
            900,
            1.0,
            'phpunit',
            'button',
            'Create subscription',
            '[data-feedback-id="create"]',
            'Create',
            ['x' => 10, 'y' => 20, 'width' => 100, 'height' => 40],
            [['type' => 'rectangle']],
            'The button overlaps the date picker.',
            'normal',
            'layout',
        );
    }
}
