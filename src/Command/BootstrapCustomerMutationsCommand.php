<?php

declare(strict_types=1);
namespace App\Command;

use App\SubscriptionApi\CustomerMutationLedger;
use Doctrine\DBAL\Connection;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand(name: 'app:customer-mutations:bootstrap', description: 'Create shared customer mutation audit storage without enabling writes')]
final class BootstrapCustomerMutationsCommand extends Command
{
    public function __construct(private readonly Connection $connection) { parent::__construct(); }
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $this->connection->executeStatement(CustomerMutationLedger::SCHEMA);
        $output->writeln('Customer mutation ledger is ready. Source writes remain disabled.');
        return Command::SUCCESS;
    }
}
