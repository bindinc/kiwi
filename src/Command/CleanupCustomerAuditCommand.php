<?php

declare(strict_types=1);

namespace App\Command;

use App\CustomerWorkSession\CustomerAuditSchemaManager;
use App\Repository\CustomerAuditEventRepository;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'app:customer-audit:cleanup', description: 'Delete customer audit records older than the configured retention period.')]
final class CleanupCustomerAuditCommand extends Command
{
    public function __construct(
        private readonly CustomerAuditSchemaManager $schemaManager,
        private readonly CustomerAuditEventRepository $repository,
        private readonly int $retentionDays,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $this->schemaManager->ensureSchema();
        $cutoff = new \DateTimeImmutable(
            sprintf('-%d days', $this->retentionDays),
            new \DateTimeZone('UTC'),
        );
        $deletedCount = $this->repository->deleteBefore($cutoff);

        $io->success(sprintf(
            'Deleted %d customer audit record(s) older than %d days.',
            $deletedCount,
            $this->retentionDays,
        ));

        return Command::SUCCESS;
    }
}
