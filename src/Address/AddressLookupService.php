<?php

declare(strict_types=1);

namespace App\Address;

use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\Session\SessionInterface;

final class AddressLookupService
{
    public function __construct(
        private readonly PostnlAddressClient $postnl,
        private readonly WebaboAddressClient $webabo,
        private readonly AddressSessionStore $sessions,
        private readonly LoggerInterface $logger,
    ) {
    }

    public function search(AddressQuery $query, string $formId, SessionInterface $session): array
    {
        $started = microtime(true);
        $budget = new LookupBudget();
        $this->sessions->assertOpen($session, $formId);
        try {
            $uuid = $this->sessions->uuid($session, $formId, fn (): string => $this->postnl->token($budget));
            $result = self::match($query, $this->postnl->search($query, $uuid, $budget));
            $this->log('postnl', $result['status'], $started);

            return $result;
        } catch (ProviderFailure $failure) {
            $this->log('postnl', $failure->reason, $started);
            if (!$failure->allowFallback) {
                return ['status' => 'unavailable'];
            }
        }
        try {
            $result = self::match($query, $this->webabo->search($query, $budget), allowStreetCompletion: true);
            $this->log('webabo', $result['status'], $started);

            return $result;
        } catch (ProviderFailure $failure) {
            $this->log('webabo', $failure->reason, $started);

            return ['status' => 'unavailable'];
        }
    }

    public static function match(AddressQuery $query, array $candidates, bool $allowStreetCompletion = false): array
    {
        $addresses = [];
        foreach ($candidates as $candidate) {
            $matchesPostalCode = AddressQuery::compact($candidate['postalCode']) === $query->postalCode;
            $streetOnly = $allowStreetCompletion && null === $candidate['houseNumber'];
            $matchesNumber = $streetOnly || $candidate['houseNumber'] === $query->houseNumber;
            $matchesAddition = $streetOnly || '' === $query->addition || AddressQuery::compact($candidate['addition']) === AddressQuery::compact($query->addition);
            if (!$matchesPostalCode || !$matchesNumber || !$matchesAddition) {
                continue;
            }
            $key = strtoupper($candidate['street']).'\0'.strtoupper($candidate['city']);
            $addresses[$key] = ['street' => $candidate['street'], 'city' => $candidate['city']];
        }
        if ([] === $addresses) {
            return ['status' => 'not_found'];
        }
        if (count($addresses) > 1) {
            return ['status' => 'ambiguous'];
        }

        return ['status' => 'matched', 'address' => reset($addresses)];
    }

    private function log(string $provider, string $outcome, float $started): void
    {
        $this->logger->info('Address lookup', [
            'provider' => $provider, 'outcome' => $outcome,
            'duration_ms' => (int) ((microtime(true) - $started) * 1000),
        ]);
    }
}
