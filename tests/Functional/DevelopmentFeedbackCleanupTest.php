<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Command\CleanupDevelopmentFeedbackCommand;
use App\Entity\DevelopmentFeedbackScreenshot;
use App\Service\DevelopmentFeedback\DevelopmentFeedbackCleanupService;
use App\Service\DevelopmentFeedback\DevelopmentFeedbackSchemaManager;
use App\Tests\Support\DevelopmentFeedbackFixtures;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Console\Tester\CommandTester;

final class DevelopmentFeedbackCleanupTest extends KernelTestCase
{
    use DevelopmentFeedbackFixtures;

    private EntityManagerInterface $entityManager;

    protected function setUp(): void
    {
        self::bootKernel();
        $this->entityManager = static::getContainer()->get(EntityManagerInterface::class);
        static::getContainer()->get(DevelopmentFeedbackSchemaManager::class)->ensureSchema();
    }

    protected function tearDown(): void
    {
        $connection = $this->entityManager->getConnection();
        foreach (['development_feedback_screenshots', 'development_feedback_reports', 'development_feedback_configuration'] as $table) {
            $connection->executeStatement('DROP TABLE IF EXISTS '.$table);
        }
        $connection->close();
        parent::tearDown();
    }

    public function testCleanupDeletesEntireReportsAtEveryDeadlineAndIsIdempotent(): void
    {
        $now = new \DateTimeImmutable('2026-09-09T12:00:00+00:00');
        $cutoff = $now->modify('-14 days');
        $future = $now->modify('+30 days');
        $recent = $cutoff->modify('+1 second');
        $reports = [
            'expired-token' => $this->createFeedbackReport($now),
            'old-image' => $this->createFeedbackReport($now),
            'old-report' => $this->createFeedbackReport($cutoff),
            'old-text-only' => $this->createFeedbackReport($cutoff),
            'recent' => $this->createFeedbackReport($recent),
        ];
        foreach ($reports as $name => $report) {
            if ('old-text-only' !== $name) {
                $imageCreatedAt = 'old-image' === $name ? $cutoff : $recent;
                $expiresAt = 'expired-token' === $name ? $now : $future;
                $this->addFeedbackScreenshot($report, $imageCreatedAt, $expiresAt);
                // Even a still-valid sibling must disappear with its expired report.
                $this->addFeedbackScreenshot($report, $now, $future, DevelopmentFeedbackScreenshot::VARIANT_ORIGINAL);
            }
            $this->entityManager->persist($report);
        }
        $this->entityManager->flush();
        $this->entityManager->clear();

        $cleanup = static::getContainer()->get(DevelopmentFeedbackCleanupService::class);
        $result = $cleanup->cleanup($now, 14);
        self::assertSame(['status' => 'cleaned', 'expired_reports_deleted' => 2, 'old_reports_deleted' => 2], $result);
        $connection = $this->entityManager->getConnection();
        self::assertSame([$reports['recent']->getPublicId()], $connection->fetchFirstColumn('SELECT public_id FROM development_feedback_reports'));
        self::assertSame(2, (int) $connection->fetchOne('SELECT COUNT(*) FROM development_feedback_screenshots'));
        self::assertSame(['status' => 'cleaned', 'expired_reports_deleted' => 0, 'old_reports_deleted' => 0], $cleanup->cleanup($now, 14));
    }

    public function testCommandDefaultsToFourteenDaysAndReportsDeletedCounts(): void
    {
        $this->entityManager->persist($this->createFeedbackReport(new \DateTimeImmutable('-15 days')));
        $this->entityManager->persist($this->createFeedbackReport(new \DateTimeImmutable('-13 days')));
        $this->entityManager->flush();
        $tester = new CommandTester(static::getContainer()->get(CleanupDevelopmentFeedbackCommand::class));
        $tester->execute([]);
        $tester->assertCommandIsSuccessful();
        self::assertStringContainsString('0 report(s) with expired screenshots and 1 old report(s)', $tester->getDisplay());
        $tester->execute(['--report-retention-days' => '1']);
        $tester->assertCommandIsSuccessful();
        self::assertSame(0, (int) $this->entityManager->getConnection()->fetchOne('SELECT COUNT(*) FROM development_feedback_reports'));
    }

    /** @dataProvider invalidRetentionDays */
    public function testCommandRejectsInvalidRetention(string $days): void
    {
        $tester = new CommandTester(static::getContainer()->get(CleanupDevelopmentFeedbackCommand::class));
        $this->expectException(\InvalidArgumentException::class);
        $tester->execute(['--report-retention-days' => $days]);
    }

    public static function invalidRetentionDays(): iterable
    {
        foreach (['0', '15', '180', '-1', '1.5', '1e1', 'invalid'] as $value) {
            yield $value => [$value];
        }
    }

    public function testMissingTablesAreSkippedSuccessfully(): void
    {
        $connection = $this->entityManager->getConnection();
        $connection->executeStatement('DROP TABLE development_feedback_screenshots');
        $tester = new CommandTester(static::getContainer()->get(CleanupDevelopmentFeedbackCommand::class));
        $tester->execute([]);
        $tester->assertCommandIsSuccessful();
        self::assertStringContainsString('tables do not exist yet', preg_replace('/\\s+/', ' ', $tester->getDisplay()));
    }
}
