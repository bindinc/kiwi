<?php

declare(strict_types=1);

namespace App\Command;

use App\Webabo\WebaboOfferCacheSchemaManager;
use App\Webabo\WebaboOfferSynchronizer;
use Doctrine\DBAL\Connection;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

#[AsCommand(
    name: 'app:webabo:sync-offers',
    description: 'Synchronize Webabo offers into the configured PostgreSQL catalog.',
    aliases: ['app:webabo:sync-werfsleutels'],
)]
final class SyncWebaboOffersCommand extends Command
{
    public function __construct(
        private readonly WebaboOfferCacheSchemaManager $schemaManager,
        private readonly WebaboOfferSynchronizer $synchronizer,
        private readonly Connection $connection,
        #[Autowire('%env(bool:KIWI_HUP_PREVIEW)%')]
        private readonly bool $preview = false,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addOption('preview', null, InputOption::VALUE_NONE, 'Confirm synchronization of the isolated preview catalog.');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        if ($this->preview !== $input->getOption('preview')) {
            $io->error('The --preview option must match the configured catalog.');
            return Command::INVALID;
        }

        try {
            $result = $this->preview
                ? $this->connection->transactional(function (Connection $connection) use ($io): array {
                    // Manual and scheduled syncs can overlap across Preview replicas.
                    $connection->executeQuery("SELECT pg_advisory_xact_lock(hashtext('webabo_offers_preview_cache'))");

                    return $this->synchronize($io);
                })
                : $this->synchronize($io);
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

    /** @return array{fetched: int, inserted: int, updated: int, removed: int} */
    private function synchronize(SymfonyStyle $io): array
    {
        $schemaResult = $this->schemaManager->ensureSchema();
        if (in_array($schemaResult['status'], ['created', 'updated'], true)) {
            $io->note(sprintf('The PostgreSQL offer catalog was %s.', $schemaResult['status']));
        }

        return $this->synchronizer->sync();
    }
}
