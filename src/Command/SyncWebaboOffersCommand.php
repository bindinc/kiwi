<?php

declare(strict_types=1);

namespace App\Command;

use App\Webabo\WebaboOfferSynchronizer;
use App\Webabo\WebaboOfferCacheSchemaManager;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:webabo:sync-offers',
    description: 'Synchronize Webabo offers into the PostgreSQL table webabo_offers_cache.',
    aliases: ['app:webabo:sync-werfsleutels'],
)]
final class SyncWebaboOffersCommand extends Command
{
    public function __construct(
        private readonly WebaboOfferCacheSchemaManager $schemaManager,
        private readonly WebaboOfferSynchronizer $synchronizer,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $schemaResult = $this->schemaManager->ensureSchema();

        if ('created' === $schemaResult['status']) {
            $io->note('The PostgreSQL table webabo_offers_cache was created.');
        } elseif ('updated' === $schemaResult['status']) {
            $io->note('The PostgreSQL table webabo_offers_cache was updated.');
        }

        try {
            $result = $this->synchronizer->sync();
        } catch (\RuntimeException $exception) {
            $io->error($exception->getMessage());

            return Command::FAILURE;
        }

        $io->success(sprintf(
            'Webabo offers synchronized: %d fetched, %d inserted, %d updated, %d removed.',
            $result['fetched'],
            $result['inserted'],
            $result['updated'],
            $result['removed'],
        ));

        return Command::SUCCESS;
    }
}
