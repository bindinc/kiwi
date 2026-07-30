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
        $facts = $content['body'][3]['facts'];

        self::assertSame('message', $card['type']);
        self::assertSame('New Kiwi contextual feedback', $content['body'][0]['text']);
        self::assertSame('Screenshot contains pseudo data.', $content['body'][1]['text']);
        self::assertSame('The button overlaps the date picker.', $content['body'][2]['text']);
        self::assertSame('https://example.org/kiwi/api/v1/development-feedback/screenshots/id/token.png', $content['body'][4]['url']);
        self::assertContains(['title' => 'Reporter', 'value' => 'Test User <test@example.org>'], $facts);
        self::assertContains(['title' => 'Environment', 'value' => 'preview'], $facts);
        self::assertContains(['title' => 'Page', 'value' => '/kiwi/customer'], $facts);
        self::assertContains(['title' => 'Element', 'value' => 'Create subscription'], $facts);
        self::assertContains(['title' => 'Selector', 'value' => '[data-feedback-id="create"]'], $facts);
    }

    public function testOriginalDataCardLabelsScreenshotSensitivity(): void
    {
        $report = $this->createReport();
        $card = (new TeamsFeedbackCardFactory())->createCard($report, 'https://example.org/original.png', true);
        $content = $card['attachments'][0]['content'];

        self::assertSame('New Kiwi contextual feedback with original data', $content['body'][0]['text']);
        self::assertSame('Screenshot contains original visible customer data.', $content['body'][1]['text']);
        self::assertSame('Attention', $content['body'][1]['color']);
    }

    public function testTextOnlyCardOmitsScreenshotDetailsAndAction(): void
    {
        $report = $this->createReport(DevelopmentFeedbackReport::SELECTION_NONE);
        $card = (new TeamsFeedbackCardFactory())->createCard($report, null);
        $content = $card['attachments'][0]['content'];
        $facts = $content['body'][3]['facts'];

        self::assertSame('No screenshot attached.', $content['body'][1]['text']);
        self::assertSame(['TextBlock', 'TextBlock', 'TextBlock', 'FactSet'], array_column($content['body'], 'type'));
        self::assertSame(['Open Kiwi page'], array_column($content['actions'], 'title'));
        self::assertNotContains('Element', array_column($facts, 'title'));
        self::assertNotContains('Selector', array_column($facts, 'title'));
    }

    private function createReport(string $selectionKind = DevelopmentFeedbackReport::SELECTION_ELEMENT): DevelopmentFeedbackReport
    {
        $hasScreenshot = DevelopmentFeedbackReport::SELECTION_NONE !== $selectionKind;

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
            $selectionKind,
            $hasScreenshot ? 'button' : null,
            $hasScreenshot ? 'Create subscription' : null,
            $hasScreenshot ? '[data-feedback-id="create"]' : null,
            $hasScreenshot ? 'Create' : null,
            $hasScreenshot ? ['x' => 10, 'y' => 20, 'width' => 100, 'height' => 40] : null,
            $hasScreenshot ? [['type' => 'rectangle']] : [],
            'The button overlaps the date picker.',
            'normal',
            'bug',
        );
    }
}
