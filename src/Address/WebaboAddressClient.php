<?php

declare(strict_types=1);

namespace App\Address;

use App\Webabo\HupApiConfigProvider;
use App\Webabo\WebaboAccessTokenProvider;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Contracts\HttpClient\HttpClientInterface;
use Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface;

final class WebaboAddressClient
{
    public function __construct(
        private readonly HupApiConfigProvider $config,
        #[Autowire(service: 'address.webabo_tokens')]
        private readonly WebaboAccessTokenProvider $tokens,
        #[Autowire(service: 'address.http_client')]
        private readonly HttpClientInterface $httpClient,
    ) {
    }

    public function search(AddressQuery $query, LookupBudget $budget): array
    {
        try {
            $config = $this->config->getConfig();
        } catch (\RuntimeException) {
            throw new ProviderFailure('not_configured');
        }
        foreach ($config->getCredentials() as $credential) {
            for ($attempt = 0; $attempt < 2; ++$attempt) {
                $budget->options();
                try {
                    $token = $this->tokens->getAccessToken($credential->name, $budget->deadline());
                } catch (\RuntimeException|TransportExceptionInterface) {
                    // Authentication failures can be specific to one configured credential.
                    break;
                }
                try {
                    $response = $this->httpClient->request('POST', rtrim($config->webaboBaseUrl, '/').'/addresses/search', $budget->options() + [
                        'headers' => ['Authorization' => 'Bearer '.$token, 'Accept' => 'application/json'],
                        'query' => ['limit' => 20],
                        'json' => ['zipcode' => $query->postalCode, 'houseNo' => trim($query->houseNumber.' '.$query->addition)],
                    ]);
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

                if (!str_starts_with(ltrim($content), '[')) {
                    throw new ProviderFailure('invalid_response');
                }

                return $this->normalize(json_decode($content, true));
            }
        }
        throw new ProviderFailure('authentication');
    }

    private function normalize(mixed $payload): array
    {
        if (!is_array($payload) || !array_is_list($payload)) {
            throw new ProviderFailure('invalid_response');
        }
        // A full page may hide conflicting candidates. Never infer uniqueness from truncation.
        if (count($payload) >= 20) {
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
