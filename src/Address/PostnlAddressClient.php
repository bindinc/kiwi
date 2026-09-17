<?php

declare(strict_types=1);

namespace App\Address;

use App\Config\ClientSecretsLoader;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Contracts\HttpClient\HttpClientInterface;
use Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface;

final class PostnlAddressClient
{
    private const BASE_URL = 'https://api.postnl.nl/v1/address/autocomplete/';

    public function __construct(
        private readonly ClientSecretsLoader $config,
        #[Autowire(service: 'address.http_client')]
        private readonly HttpClientInterface $httpClient,
    ) {
    }

    public function token(LookupBudget $budget): string
    {
        $payload = $this->request('token', ['countryIso' => 'NL'], $budget);
        $uuid = $payload['uuid'] ?? null;
        if (!is_string($uuid) || !preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iD', $uuid)) {
            throw new ProviderFailure('invalid_response');
        }

        return $uuid;
    }

    public function search(AddressQuery $query, string $uuid, LookupBudget $budget): array
    {
        $parameters = [
            'uuid' => $uuid,
            'countryIso' => 'NL',
                        'q' => '',
        ];
        foreach (['postalCode' => $query->postalCode, 'houseNumber' => $query->houseNumber,
            'streetName' => $query->street, 'cityName' => mb_strtoupper($query->city)] as $field => $value) {
            if ('' !== $value) {
                $parameters[$field] = $value;
            }
        }
        // PostNL treats an explicitly empty addition as a filter that yields no matches.
        if ('' !== $query->addition) {
            $parameters['houseNumberAddition'] = $query->addition;
        }
        $payload = $this->request('search', $parameters, $budget);
        if (!array_is_list($payload)) {
            throw new ProviderFailure('invalid_response');
        }

        return array_map(static function (mixed $item): array {
            if (!is_array($item)) {
                throw new ProviderFailure('invalid_response');
            }
            foreach (['postalCode', 'houseNumber', 'streetName', 'cityName'] as $field) {
                if (!isset($item[$field]) || !is_scalar($item[$field]) || '' === trim((string) $item[$field])) {
                    throw new ProviderFailure('invalid_response');
                }
            }
            if (isset($item['houseNumberAddition']) && !is_string($item['houseNumberAddition'])) {
                throw new ProviderFailure('invalid_response');
            }

            return [
                'postalCode' => (string) $item['postalCode'],
                'houseNumber' => (string) $item['houseNumber'],
                'addition' => $item['houseNumberAddition'] ?? '',
                'street' => trim((string) $item['streetName']),
                'city' => trim((string) $item['cityName']),
            ];
        }, $payload);
    }

    private function request(string $method, array $query, LookupBudget $budget): array
    {
        $key = $this->config->getSection('postnl')['api_key'] ?? '';
        if (!is_string($key) || '' === trim($key)) {
            throw new ProviderFailure('not_configured');
        }
        try {
            $response = $this->httpClient->request('GET', self::BASE_URL.$method, $budget->options() + [
                'headers' => ['apikey' => $key, 'Accept' => 'application/json'],
                'query' => $query,
            ]);
            $status = $response->getStatusCode();
            $content = $response->getContent(false);
        } catch (TransportExceptionInterface) {
            throw new ProviderFailure('transport');
        }
        if (200 !== $status) {
            $fallback = in_array($status, [401, 403, 429], true) || $status >= 500;
            throw new ProviderFailure(400 === $status ? 'integration_error' : 'http_'.$status, $fallback);
        }
        $payload = json_decode($content, true);
        $wrongSearchShape = 'search' === $method && !str_starts_with(ltrim($content), '[');
        if (!is_array($payload) || $wrongSearchShape) {
            throw new ProviderFailure('invalid_response');
        }

        return $payload;
    }
}
