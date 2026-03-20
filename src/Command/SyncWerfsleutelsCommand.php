<?php

declare(strict_types=1);

namespace App\Command;

use App\Webabo\WebaboOfferSynchronizer;
use App\Webabo\WerfsleutelCatalogSchemaManager;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'app:webabo:sync-werfsleutels', description: 'Synchroniseer Webabo werfsleutels naar de PostgreSQL cache.')]
final class SyncWerfsleutelsCommand extends Command
{
    public function __construct(
        private readonly WerfsleutelCatalogSchemaManager $schemaManager,
        private readonly WebaboOfferSynchronizer $synchronizer,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $schemaResult = $this->schemaManager->ensureSchema();

        if ('created' === $schemaResult['status']) {
            $io->note('De PostgreSQL cachetabel voor werfsleutels is aangemaakt.');
        } elseif ('updated' === $schemaResult['status']) {
            $io->note('De PostgreSQL cachetabel voor werfsleutels is bijgewerkt.');
        }

        try {
            $result = $this->synchronizer->sync();
        } catch (\RuntimeException $exception) {
            $io->error($exception->getMessage());

            return Command::FAILURE;
        }

        $io->success(sprintf(
            'Webabo werfsleutels gesynchroniseerd: %d opgehaald, %d toegevoegd, %d bijgewerkt, %d verwijderd.',
            $result['fetched'],
            $result['inserted'],
            $result['updated'],
            $result['removed'],
        ));

        return Command::SUCCESS;
    }
}
