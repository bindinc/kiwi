<?php

declare(strict_types=1);

namespace App\Webabo;

use App\Entity\WebaboOffer;
use Doctrine\Bundle\DoctrineBundle\Attribute\AsDoctrineListener;
use Doctrine\ORM\Event\LoadClassMetadataEventArgs;
use Doctrine\ORM\Events;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

#[AsDoctrineListener(event: Events::loadClassMetadata)]
final readonly class PreviewOfferCacheMapping
{
    private const TABLE = 'webabo_offers_preview_cache';

    public function __construct(
        #[Autowire('%env(bool:KIWI_HUP_PREVIEW)%')]
        private bool $preview = false,
    ) {
    }

    public function loadClassMetadata(LoadClassMetadataEventArgs $event): void
    {
        $metadata = $event->getClassMetadata();
        if (!$this->preview || WebaboOffer::class !== $metadata->getName()) {
            return;
        }

        // PostgreSQL index names are schema-wide. Keep preview indexes distinct
        // even when both caches live alongside each other in the same database.
        $metadata->setPrimaryTable([
            'name' => self::TABLE,
            'indexes' => [
                self::TABLE.'_offer_id' => ['columns' => ['offer_id']],
                self::TABLE.'_valid_until' => ['columns' => ['valid_until']],
            ],
            'uniqueConstraints' => [
                self::TABLE.'_sales_code' => ['columns' => ['sales_code']],
            ],
        ]);
    }
}
