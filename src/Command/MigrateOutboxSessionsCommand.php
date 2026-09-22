<?php

declare(strict_types=1);

namespace App\Command;

use App\OutboxSession\SessionSchema;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand(name: 'app:outbox-sessions:migrate', description: 'Add the customer session outbox tables without changing historical orders')]
final class MigrateOutboxSessionsCommand extends Command
{
    public function __construct(private readonly SessionSchema $schema) { parent::__construct(); }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $this->schema->migrate();
        $output->writeln('Customer session outbox schema is ready.');
        return Command::SUCCESS;
    }
}
