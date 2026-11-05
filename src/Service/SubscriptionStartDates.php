<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\WebaboOffer;
use App\Http\ApiProblemException;
use App\Repository\WebaboOfferRepository;
use App\Webabo\WebaboOfferCacheSchemaManager;
use App\Webabo\WebaboStartDateClient;
use App\Webabo\WebaboStartDateProviderInterface;

final class SubscriptionStartDates
{
    public function __construct(
        private readonly WebaboOfferRepository $offers,
        private readonly WebaboOfferCacheSchemaManager $schema,
        private readonly WebaboStartDateProviderInterface $provider,
    ) {
    }

    public static function describe(WebaboOffer $offer): array
    {
        $productCode = trim($offer->getProductCode() ?? '');
        $isMembership = in_array($productCode, ['ATV', 'ATL', 'ATM', 'STKN'], true);
        $variants = $offer->getRawPayload()['variantCodeList'] ?? [];
        $variants = is_array($variants) ? $variants : [];
        $variants = array_filter($variants, static fn (mixed $code): bool => is_string($code) && '' !== trim($code));

        return [
            'subscriptionKind' => $isMembership ? 'membership' : 'guide',
            'variantCodes' => array_values(array_unique(array_map('trim', $variants))),
        ];
    }

    public function lookup(string $salesCode, ?string $variantCode = null): array
    {
        try {
            $offer = $this->schema->hasCacheTable() ? $this->offers->findOneBySalesCode($salesCode) : null;
        } catch (\Exception) {
            throw new ApiProblemException(503, 'webabo_cache_unavailable', 'De aanbieding is tijdelijk niet beschikbaar. Probeer opnieuw.');
        }
        if (null === $offer || !$offer->isCurrentlyActive()) {
            throw new ApiProblemException(422, 'offer_unavailable', 'Selecteer een beschikbare aanbieding.');
        }

        $description = self::describe($offer);
        if ('membership' === $description['subscriptionKind']) {
            return $description + ['startDate' => null, 'variantCode' => null];
        }

        $variants = $description['variantCodes'];
        $variantCode = trim($variantCode ?? '');
        if ('' === $variantCode && 1 === count($variants)) {
            $variantCode = $variants[0];
        }
        if (!in_array($variantCode, $variants, true)) {
            throw new ApiProblemException(422, 'edition_required', 'Kies een beschikbare editie voor deze gids.');
        }

        $credential = trim($offer->getCredentialKey() ?? '');
        $product = trim($offer->getProductCode() ?? '');
        if ('' === $credential || '' === $product) {
            throw new ApiProblemException(422, 'start_date_context_required', 'De brongegevens van deze aanbieding ontbreken. Selecteer een andere aanbieding.');
        }

        $date = $this->provider->fetchStartDate($credential, $product, $variantCode);
        $today = new \DateTimeImmutable('today', new \DateTimeZone('Europe/Amsterdam'));
        if (!WebaboStartDateClient::isCalendarDate($date) || $date < $today->format('Y-m-d')) {
            throw new ApiProblemException(503, 'start_date_unavailable', 'De bron geeft geen geldige toekomstige bezorgdatum. Probeer opnieuw.');
        }

        return $description + [
            'startDate' => $date,
            'variantCode' => $variantCode,
            'sourceContext' => [
                'credentialKey' => $credential,
                'mandant' => $offer->getRawPayload()['mandant'] ?? null,
                'productCode' => $product,
                'variantCode' => $variantCode,
                'startDate' => $date,
                'checkedAt' => (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->format(\DateTimeInterface::ATOM),
            ],
        ];
    }

    /** Recheck before either queue persistence or staging a deferred outbox intent. */
    public function validate(string $salesCode, ?string $variantCode, string $submittedDate): array
    {
        $selection = $this->lookup($salesCode, $variantCode);
        if ('guide' === $selection['subscriptionKind'] && $submittedDate !== $selection['startDate']) {
            throw new ApiProblemException(422, 'start_date_changed', 'De bezorgdatum is gewijzigd. Haal de datum opnieuw op voordat je opslaat.');
        }

        return $selection;
    }
}
