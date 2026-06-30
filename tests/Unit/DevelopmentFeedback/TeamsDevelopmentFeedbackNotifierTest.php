<?php

declare(strict_types=1);

namespace App\Tests\Unit\DevelopmentFeedback;

use App\Entity\DevelopmentFeedbackReport;
use App\Service\DevelopmentFeedback\DevelopmentFeedbackSettings;
use App\Service\DevelopmentFeedback\TeamsDevelopmentFeedbackNotifier;
use App\Service\DevelopmentFeedback\TeamsFeedbackCardFactory;
use Psr\Log\NullLogger;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class TeamsDevelopmentFeedbackNotifierTest extends TestCase
{
    private ?string $previousWebhookUrl = null;
    private ?string $previousOriginalDataWebhookUrl = null;

    protected function setUp(): void
    {
        $this->previousWebhookUrl = getenv('CONTEXTUAL_FEEDBACK_WEBHOOK_URL') ?: null;
        $this->previousOriginalDataWebhookUrl = getenv('CONTEXTUAL_FEEDBACK_ORIGINAL_DATA_WEBHOOK_URL') ?: null;
    }

    protected function tearDown(): void
    {
        null === $this->previousWebhookUrl
            ? putenv('CONTEXTUAL_FEEDBACK_WEBHOOK_URL')
            : putenv('CONTEXTUAL_FEEDBACK_WEBHOOK_URL='.(string) $this->previousWebhookUrl);
        null === $this->previousOriginalDataWebhookUrl
            ? putenv('CONTEXTUAL_FEEDBACK_ORIGINAL_DATA_WEBHOOK_URL')
            : putenv('CONTEXTUAL_FEEDBACK_ORIGINAL_DATA_WEBHOOK_URL='.(string) $this->previousOriginalDataWebhookUrl);
    }

    public function testNotifierPostsAdaptiveCardJsonToWebhook(): void
    {
        putenv('CONTEXTUAL_FEEDBACK_WEBHOOK_URL=https://workflow.example/webhook');
        $requests = [];
        $client = new MockHttpClient(function (string $method, string $url, array $options) use (&$requests): MockResponse {
            $requests[] = compact('method', 'url', 'options');

            return new MockResponse('', ['http_code' => 202]);
        });

        $result = (new TeamsDevelopmentFeedbackNotifier(
            $client,
            new DevelopmentFeedbackSettings(),
            new TeamsFeedbackCardFactory(),
            new NullLogger(),
        ))->notify($this->createReport(), 'https://example.org/screenshot.png');

        self::assertSame(['status' => 'sent', 'error' => null], $result);
        self::assertCount(1, $requests);
        self::assertSame('POST', $requests[0]['method']);
        self::assertSame('https://workflow.example/webhook', $requests[0]['url']);
        self::assertStringContainsString('application/json', json_encode($requests[0]['options']['headers'], \JSON_THROW_ON_ERROR | \JSON_UNESCAPED_SLASHES));
        $requestBody = $requests[0]['options']['body'] ?? '';
        self::assertIsString($requestBody);
        $requestPayload = json_decode($requestBody, true, flags: \JSON_THROW_ON_ERROR);
        self::assertSame('https://example.org/screenshot.png', $requestPayload['attachments'][0]['content']['body'][4]['url']);
    }

    public function testNotifierPostsOriginalDataCardToSeparateWebhook(): void
    {
        putenv('CONTEXTUAL_FEEDBACK_ORIGINAL_DATA_WEBHOOK_URL=https://workflow.example/original-data');
        $requests = [];
        $client = new MockHttpClient(function (string $method, string $url, array $options) use (&$requests): MockResponse {
            $requests[] = compact('method', 'url', 'options');

            return new MockResponse('', ['http_code' => 202]);
        });

        $result = (new TeamsDevelopmentFeedbackNotifier(
            $client,
            new DevelopmentFeedbackSettings(),
            new TeamsFeedbackCardFactory(),
            new NullLogger(),
        ))->notifyOriginalData($this->createReport(), 'https://example.org/original.png');

        self::assertSame(['status' => 'sent', 'error' => null], $result);
        self::assertSame('https://workflow.example/original-data', $requests[0]['url']);
        $requestBody = $requests[0]['options']['body'] ?? '';
        self::assertIsString($requestBody);
        $requestPayload = json_decode($requestBody, true, flags: \JSON_THROW_ON_ERROR);
        self::assertSame('New Kiwi contextual feedback with original data', $requestPayload['attachments'][0]['content']['body'][0]['text']);
        self::assertSame('https://example.org/original.png', $requestPayload['attachments'][0]['content']['body'][4]['url']);
    }

    public function testNotifierRecordsWebhookFailure(): void
    {
        putenv('CONTEXTUAL_FEEDBACK_WEBHOOK_URL=https://workflow.example/webhook');
        $client = new MockHttpClient(new MockResponse('nope', ['http_code' => 500]));

        $result = (new TeamsDevelopmentFeedbackNotifier(
            $client,
            new DevelopmentFeedbackSettings(),
            new TeamsFeedbackCardFactory(),
            new NullLogger(),
        ))->notify($this->createReport(), 'https://example.org/screenshot.png');

        self::assertSame('failed', $result['status']);
        self::assertStringContainsString('HTTP 500', (string) $result['error']);
    }

    public function testNotifierSkipsWhenWebhookIsNotConfigured(): void
    {
        putenv('CONTEXTUAL_FEEDBACK_WEBHOOK_URL');
        $client = new MockHttpClient(new MockResponse('', ['http_code' => 202]));

        $result = (new TeamsDevelopmentFeedbackNotifier(
            $client,
            new DevelopmentFeedbackSettings(),
            new TeamsFeedbackCardFactory(),
            new NullLogger(),
        ))->notify($this->createReport(), 'https://example.org/screenshot.png');

        self::assertSame('not_configured', $result['status']);
    }

    private function createReport(): DevelopmentFeedbackReport
    {
        return new DevelopmentFeedbackReport(
            'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
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
            [],
            'Feedback comment.',
            'normal',
            'bug',
        );
    }
}
