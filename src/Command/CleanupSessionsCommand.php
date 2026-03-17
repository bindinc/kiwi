<?php

declare(strict_types=1);

namespace App\Command;

use App\Session\PostgreSqlSessionTableManager;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'app:sessions:cleanup', description: 'Clean up expired PostgreSQL-backed Kiwi sessions.')]
final class CleanupSessionsCommand extends Command
{
    public function __construct(
        private readonly PostgreSqlSessionTableManager $sessionTableManager,
        private readonly int $sessionTtlSeconds,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $result = $this->sessionTableManager->cleanup($this->sessionTtlSeconds);

        if ('cleaned' === $result['status']) {
            $io->success('Expired PostgreSQL-backed sessions were cleaned up.');

            return Command::SUCCESS;
        }

        if ('skipped_missing' === $result['status']) {
            $io->warning('Skipped cleanup because the PostgreSQL session table does not exist yet.');

            return Command::SUCCESS;
        }

        $io->warning('Skipped cleanup because the legacy Flask session table is still present. Run app:sessions:bootstrap first.');

        return Command::SUCCESS;
    }
}
