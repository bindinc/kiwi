<?php

declare(strict_types=1);

namespace App\Command;

use App\Session\PostgreSqlSessionTableManager;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'app:sessions:bootstrap', description: 'Prepare the PostgreSQL-backed session table for Kiwi.')]
final class BootstrapSessionsCommand extends Command
{
    public function __construct(
        private readonly PostgreSqlSessionTableManager $sessionTableManager,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $result = $this->sessionTableManager->bootstrap();

        if ('created' === $result['status']) {
            $io->success('Created the PostgreSQL session table.');

            return Command::SUCCESS;
        }

        if ('existing' === $result['status']) {
            $io->success('The PostgreSQL session table already matches the Symfony schema.');

            return Command::SUCCESS;
        }

        $io->success(sprintf(
            'Archived the legacy Flask session table as "%s" and created the Symfony session table.',
            $result['backup_table_name'] ?? 'unknown',
        ));

        return Command::SUCCESS;
    }
}
