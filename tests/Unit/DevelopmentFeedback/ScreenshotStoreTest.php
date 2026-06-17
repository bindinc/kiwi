<?php

declare(strict_types=1);

namespace App\Tests\Unit\DevelopmentFeedback;

use App\Entity\DevelopmentFeedbackReport;
use App\Http\ApiProblemException;
use App\Service\DevelopmentFeedback\DevelopmentFeedbackSettings;
use App\Service\DevelopmentFeedback\ScreenshotStore;
use App\Service\DevelopmentFeedback\SignedScreenshotUrlGenerator;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\File\UploadedFile;

final class ScreenshotStoreTest extends TestCase
{
    private ?string $previousMaxBytes = null;

    protected function setUp(): void
    {
        $this->previousMaxBytes = getenv('CONTEXTUAL_FEEDBACK_MAX_IMAGE_BYTES') ?: null;
        putenv('CONTEXTUAL_FEEDBACK_MAX_IMAGE_BYTES=3145728');
    }

    protected function tearDown(): void
    {
        null === $this->previousMaxBytes
            ? putenv('CONTEXTUAL_FEEDBACK_MAX_IMAGE_BYTES')
            : putenv('CONTEXTUAL_FEEDBACK_MAX_IMAGE_BYTES='.$this->previousMaxBytes);
    }

    public function testStorePngCreatesScreenshotMetadataAndToken(): void
    {
        $store = new ScreenshotStore(new DevelopmentFeedbackSettings(), new SignedScreenshotUrlGenerator());
        $report = $this->createReport();
        $file = $this->createUploadedFile($this->pngBytes());

        $result = $store->storePng($report, $file, new \DateTimeImmutable('2026-06-16T12:00:00+00:00'));

        self::assertSame($report->getScreenshot(), $result['screenshot']);
        self::assertSame('image/png', $result['screenshot']->getMimeType());
        self::assertSame(1, $result['screenshot']->getWidth());
        self::assertSame(1, $result['screenshot']->getHeight());
        self::assertSame(hash('sha256', $this->pngBytes()), $result['screenshot']->getSha256());
        self::assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $result['token']);
    }

    public function testStoreRejectsNonPngBytes(): void
    {
        $this->expectException(ApiProblemException::class);
        $this->expectExceptionMessage('screenshot must be a PNG image');

        $store = new ScreenshotStore(new DevelopmentFeedbackSettings(), new SignedScreenshotUrlGenerator());
        $store->storePng($this->createReport(), $this->createUploadedFile('not png'), new \DateTimeImmutable());
    }

    private function createReport(): DevelopmentFeedbackReport
    {
        return new DevelopmentFeedbackReport(
            'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            new \DateTimeImmutable('2026-06-16T12:00:00+00:00'),
            'test@example.org',
            'Test User',
            'test@example.org',
            'local',
            'active',
            'https://example.org/kiwi',
            '/kiwi',
            1,
            1,
            1.0,
            'phpunit',
            'button',
            'Button',
            'button',
            null,
            ['x' => 0, 'y' => 0, 'width' => 1, 'height' => 1],
            [],
            'Comment',
            'normal',
            'bug',
        );
    }

    private function createUploadedFile(string $bytes): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'kiwi-feedback-');
        file_put_contents($path, $bytes);

        return new UploadedFile($path, 'screenshot.png', 'image/png', null, true);
    }

    private function pngBytes(): string
    {
        return base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lO2e0wAAAABJRU5ErkJggg==');
    }
}
