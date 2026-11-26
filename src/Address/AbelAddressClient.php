<?php

declare(strict_types=1);

namespace App\Address;

use App\Webabo\HupApiConfigProvider;
use App\Webabo\WebaboAccessTokenProvider;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Contracts\HttpClient\HttpClientInterface;
use Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface;

final class AbelAddressClient
{
    private const PAGE_SIZE = 20;

    public function __construct(
        private readonly HupApiConfigProvider $config,
        #[Autowire(service: 'address.webabo_tokens')]
        private readonly WebaboAccessTokenProvider $tokens,
        #[Autowire(service: 'address.http_client')]
        private readonly HttpClientInterface $httpClient,
    ) {
    }

    public function search(AddressQuery $query, LookupBudget $budget, bool $allowTruncated = false): array
    {
        try {
            $config = $this->config->getConfig();
        } catch (\RuntimeException) {
            throw new ProviderFailure('not_configured');
        }
        $preview = $config->preview;
        $method = $preview ? 'GET' : 'POST';
        $url = $preview
            ? rtrim((string) $config->ppaBaseUrl, '/').'/public/personsearch'
            : rtrim($config->webaboBaseUrl, '/').'/addresses/search';
        $houseNumber = trim($query->houseNumber.' '.$query->addition);
        $hasEmptyResult = false;

        foreach ($config->getCredentials() as $credential) {
            if ($preview && false === $credential->supportsPersonLookup) {
                continue;
            }
            $options = $preview
                ? ['query' => array_filter([
                    'postcode' => $query->postalCode,
                    'houseno' => $houseNumber,
                    'street' => $query->street,
                    'city' => $query->city,
                    'divisionid' => $credential->divisionId,
                    'exactmatch' => 'true',
                    'pagesize' => self::PAGE_SIZE,
                ], static fn (mixed $value): bool => null !== $value && '' !== $value)]
                : [
                    'query' => ['limit' => self::PAGE_SIZE],
                    'json' => array_filter([
                        'zipcode' => $query->postalCode,
                        'houseNo' => $houseNumber,
                        'streetName' => $query->street,
                        'city' => $query->city,
                    ], static fn (string $value): bool => '' !== $value),
                ];
            for ($attempt = 0; $attempt < 2; ++$attempt) {
                $budget->options();
                try {
                    $token = $this->tokens->getAccessToken($credential->name, $budget->deadline());
                } catch (\RuntimeException|TransportExceptionInterface) {
                    // Authentication failures can be specific to one configured credential.
                    break;
                }
                try {
                    $response = $this->httpClient->request($method, $url, $budget->options() + [
                        'headers' => ['Authorization' => 'Bearer '.$token, 'Accept' => 'application/json'],
                    ] + $options);
                    $status = $response->getStatusCode();
                    $content = $response->getContent(false);
                } catch (TransportExceptionInterface) {
                    throw new ProviderFailure('transport');
                }
                if (401 === $status && 0 === $attempt) {
                    $this->tokens->invalidateCachedToken($credential->name);
                    continue;
                }
                if (in_array($status, [401, 403], true)) {
                    break;
                }
                if (200 !== $status) {
                    throw new ProviderFailure(400 === $status ? 'integration_error' : 'http_'.$status);
                }

                $payload = json_decode($content, true);
                if (!$preview) {
                    if (!str_starts_with(ltrim($content), '[')) {
                        throw new ProviderFailure('invalid_response');
                    }

                    return $this->normalizeWebabo($payload, $allowTruncated);
                }

                $candidates = $this->normalizePpa($payload, $allowTruncated);
                if ([] !== $candidates) {
                    return $candidates;
                }
                $hasEmptyResult = true;
                break;
            }
        }
        if ($hasEmptyResult) {
            return [];
        }
        throw new ProviderFailure('authentication');
    }

    private function normalizePpa(mixed $payload, bool $allowTruncated): array
    {
        $rows = is_array($payload) ? ($payload['content'] ?? null) : null;
        if (!is_array($rows) || !array_is_list($rows)) {
            throw new ProviderFailure('invalid_response');
        }

        $candidates = [];
        foreach ($rows as $row) {
            if (!is_array($row)) {
                throw new ProviderFailure('invalid_response');
            }
            $country = $row['isoCountryCode'] ?? '';
            if (!is_string($country) || !in_array(strtoupper(trim($country)), ['', 'NL'], true)) {
                continue;
            }
            if (!isset($row['postCode'], $row['houseNo'], $row['street'], $row['city'])
                || !is_string($row['postCode']) || !is_string($row['houseNo'])
                || !is_string($row['street']) || !is_string($row['city'])
                || '' === trim($row['postCode']) || '' === trim($row['street']) || '' === trim($row['city'])
                || !preg_match('/^([1-9][0-9]*)(.*)$/D', trim($row['houseNo']), $parts)) {
                continue;
            }
            $candidates[] = [
                'postalCode' => $row['postCode'],
                'houseNumber' => $parts[1],
                'addition' => trim($parts[2]),
                'street' => trim($row['street']),
                'city' => trim($row['city']),
            ];
        }

        $totalPages = $payload['totalPages'] ?? 0;
        $totalElements = $payload['totalElements'] ?? 0;
        $mayBeTruncated = count($rows) >= self::PAGE_SIZE
            || (is_int($totalPages) && $totalPages > 1)
            || (is_int($totalElements) && $totalElements > count($rows));
        if ($mayBeTruncated && (!$allowTruncated || count($candidates) < self::PAGE_SIZE)) {
            // The candidate picker marks full pages as limited. A shorter, partial page would hide that fact.
            throw new ProviderFailure('truncated_response');
        }

        return $candidates;
    }

    private function normalizeWebabo(mixed $payload, bool $allowTruncated): array
    {
        if (!is_array($payload) || !array_is_list($payload)) {
            throw new ProviderFailure('invalid_response');
        }
        // A full page may hide conflicting candidates. Never infer uniqueness from truncation.
        if (!$allowTruncated && count($payload) >= self::PAGE_SIZE) {
            throw new ProviderFailure('truncated_response');
        }

        return array_map(static function (mixed $item): array {
            if (!is_array($item)) {
                throw new ProviderFailure('invalid_response');
            }
            foreach (['zipcode', 'streetName', 'city'] as $field) {
                if (!isset($item[$field]) || !is_string($item[$field]) || '' === trim($item[$field])) {
                    throw new ProviderFailure('invalid_response');
                }
            }
            // Webabo can return street-level completion without echoing houseNo.
            $number = null;
            $addition = '';
            if (array_key_exists('houseNo', $item)) {
                if (!is_string($item['houseNo']) || !preg_match('/^([1-9][0-9]*)(.*)$/D', trim($item['houseNo']), $parts)) {
                    throw new ProviderFailure('invalid_response');
                }
                $number = $parts[1];
                $addition = trim($parts[2]);
            }

            return [
                'postalCode' => $item['zipcode'], 'houseNumber' => $number,
                'addition' => $addition, 'street' => trim($item['streetName']), 'city' => trim($item['city']),
            ];
        }, $payload);
    }
}
