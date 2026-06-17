<?php

declare(strict_types=1);

namespace App\Command;

use App\Service\DevelopmentFeedback\DevelopmentFeedbackCleanupService;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'app:development-feedback:cleanup', description: 'Clean up expired contextual feedback screenshots and old reports.')]
final class CleanupDevelopmentFeedbackCommand extends Command
{
    public function __construct(
        private readonly DevelopmentFeedbackCleanupService $cleanupService,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addOption(
            'report-retention-days',
            null,
            InputOption::VALUE_REQUIRED,
            'Delete feedback reports older than this many days.',
            '180',
        );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $reportRetentionDays = $this->normalizeRetentionDays($input->getOption('report-retention-days'));
        $result = $this->cleanupService->cleanup(
            new \DateTimeImmutable('now', new \DateTimeZone('UTC')),
            $reportRetentionDays,
        );

        if ('skipped_missing' === $result['status']) {
            $io->warning('Skipped cleanup because the contextual feedback tables do not exist yet.');

            return Command::SUCCESS;
        }

        $io->success(sprintf(
            'Deleted %d report(s) with expired screenshots and %d old report(s).',
            $result['expired_reports_deleted'],
            $result['old_reports_deleted'],
        ));

        return Command::SUCCESS;
    }

    private function normalizeRetentionDays(mixed $value): int
    {
        if (!is_numeric($value)) {
            throw new \InvalidArgumentException('report-retention-days must be numeric.');
        }

        $retentionDays = (int) $value;
        if ($retentionDays < 1 || $retentionDays > 3650) {
            throw new \InvalidArgumentException('report-retention-days must be between 1 and 3650.');
        }

        return $retentionDays;
    }
}
