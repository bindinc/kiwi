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

    public function search(AddressQuery $query, string $formId, SessionInterface $session, bool $includeCandidates = false): array
    {
        if ($includeCandidates) {
            $query = new AddressQuery($query->postalCode, $query->houseNumber, '', $query->street, $query->city);
        }
        $started = microtime(true);
        $budget = new LookupBudget();
        $this->sessions->assertOpen($session, $formId);
        try {
            $uuid = $this->sessions->uuid($session, $formId, fn (): string => $this->postnl->token($budget));
            $candidates = $this->postnl->search($query, $uuid, $budget);
            $result = $includeCandidates ? self::choices($query, $candidates) : self::match($query, $candidates);
            $alternative = $query->withoutPostcode();
            if ($includeCandidates && 'not_found' === $result['status'] && null !== $alternative) {
                $candidates = $this->postnl->search($alternative, $uuid, $budget);
                $result = self::choices($alternative, $candidates);
                $result['postcodeRelaxed'] = true;
            }
            $this->log('postnl', $result['status'], $started);

            return $result;
        } catch (ProviderFailure $failure) {
            $this->log('postnl', $failure->reason, $started);
            if (!$failure->allowFallback) {
                return ['status' => 'unavailable'];
            }
        }
        try {
            $candidates = $this->webabo->search($query, $budget, $includeCandidates);
            $result = $includeCandidates ? self::choices($query, $candidates, true) : self::match($query, $candidates, allowStreetCompletion: true);
            $alternative = $query->withoutPostcode();
            if ($includeCandidates && 'not_found' === $result['status'] && null !== $alternative) {
                $candidates = $this->webabo->search($alternative, $budget, true);
                $result = self::choices($alternative, $candidates, true);
                $result['postcodeRelaxed'] = true;
            }
            $this->log('webabo', $result['status'], $started);

            return $result;
        } catch (ProviderFailure $failure) {
            $this->log('webabo', $failure->reason, $started);

            return ['status' => 'unavailable'];
        }
    }

    public static function choices(AddressQuery $query, array $candidates, bool $allowStreetCompletion = false): array
    {
        $choices = [];
        foreach ($candidates as $candidate) {
            $samePostcode = '' === $query->postalCode || AddressQuery::compact($candidate['postalCode']) === $query->postalCode;
            $streetOnly = $allowStreetCompletion && null === $candidate['houseNumber'];
            $sameNumber = '' === $query->houseNumber || $streetOnly || $candidate['houseNumber'] === $query->houseNumber;
            $sameStreet = '' === $query->street || str_starts_with(mb_strtolower($candidate['street']), mb_strtolower($query->street));
            $sameCity = '' === $query->city || str_starts_with(mb_strtolower($candidate['city']), mb_strtolower($query->city));
            if (!$samePostcode || !$sameNumber || !$sameStreet || !$sameCity) {
                continue;
            }
            $choice = [
                'postalCode' => AddressQuery::compact($candidate['postalCode']),
                'houseNumber' => $candidate['houseNumber'] ?? $query->houseNumber,
                // Null means Webabo did not supply a number/addition; preserve manual input.
                'houseNumberAddition' => $streetOnly ? null : $candidate['addition'],
                'street' => $candidate['street'],
                'city' => $candidate['city'],
            ];
            $key = strtoupper(json_encode($choice, JSON_THROW_ON_ERROR));
            $choices[$key] = $choice;
        }
        $choices = array_values($choices);
        $status = [] === $choices ? 'not_found' : (count($choices) === 1 ? 'matched' : 'ambiguous');

        return ['status' => $status, 'candidates' => $choices, 'limited' => count($candidates) >= ($allowStreetCompletion ? 20 : 50)];
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
