<?php

declare(strict_types=1);

namespace App\Tests\Unit\DevelopmentFeedback;

use App\Service\DevelopmentFeedback\DevelopmentFeedbackRetention;
use App\Service\DevelopmentFeedback\DevelopmentFeedbackSettings;
use App\Service\DevelopmentFeedback\DevelopmentFeedbackSchemaManager;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;
use App\Tests\Support\DevelopmentFeedbackFixtures;
use PHPUnit\Framework\TestCase;

final class DevelopmentFeedbackRetentionTest extends TestCase
{
    use DevelopmentFeedbackFixtures;

    /** @dataProvider expiryBoundaries */
    public function testExpiryIsInclusiveForEachIndependentDeadline(string $deadline, int $seconds, bool $expected): void
    {
        $now = new \DateTimeImmutable('2026-09-09T12:00:00+00:00');
        $createdAt = $now->modify('-14 days')->modify(sprintf('%+d seconds', $seconds));
        $reportCreatedAt = 'report' === $deadline ? $createdAt : $now;
        $screenshotCreatedAt = 'screenshot' === $deadline ? $createdAt : $now;
        $expiresAt = 'token' === $deadline ? $now->modify(sprintf('%+d seconds', $seconds)) : $now->modify('+30 days');
        $report = $this->createFeedbackReport($reportCreatedAt);
        $screenshot = $this->addFeedbackScreenshot($report, $screenshotCreatedAt, $expiresAt);

        self::assertSame($expected, (new DevelopmentFeedbackRetention())->isScreenshotExpired($screenshot, $now));
    }

    public static function expiryBoundaries(): iterable
    {
        foreach (['token', 'screenshot', 'report'] as $deadline) {
            yield $deadline.' before expiry' => [$deadline, 1, false];
            yield $deadline.' at expiry' => [$deadline, 0, true];
            yield $deadline.' after expiry' => [$deadline, -1, true];
        }
    }

    public function testDatabaseErrorsAreNotReportedAsMissingTables(): void
    {
        $connection = $this->createMock(Connection::class);
        $failure = new class('Database unavailable') extends \RuntimeException implements \Doctrine\DBAL\Exception {};
        $connection->method('createSchemaManager')->willThrowException($failure);
        $schemaManager = new DevelopmentFeedbackSchemaManager($connection, $this->createMock(EntityManagerInterface::class));

        $this->expectExceptionObject($failure);
        $schemaManager->hasFeedbackTables();
    }

    public function testEnvironmentRetentionIsBoundedAndDefaultsToFourteenDays(): void
    {
        $previous = getenv('CONTEXTUAL_FEEDBACK_IMAGE_TTL_DAYS');
        try {
            $settings = new DevelopmentFeedbackSettings();
            putenv('CONTEXTUAL_FEEDBACK_IMAGE_TTL_DAYS');
            self::assertSame(14, $settings->getImageTtlDays());
            foreach ([1 => 1, 14 => 14, 30 => 14, 365 => 14, -1 => 1] as $configured => $expected) {
                putenv('CONTEXTUAL_FEEDBACK_IMAGE_TTL_DAYS='.$configured);
                self::assertSame($expected, $settings->getImageTtlDays());
            }
        } finally {
            false === $previous ? putenv('CONTEXTUAL_FEEDBACK_IMAGE_TTL_DAYS') : putenv('CONTEXTUAL_FEEDBACK_IMAGE_TTL_DAYS='.$previous);
        }
    }
}
