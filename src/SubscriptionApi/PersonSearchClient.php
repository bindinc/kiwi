<?php

declare(strict_types=1);

namespace App\SubscriptionApi;

use App\Webabo\HupApiConfigProvider;
use App\Webabo\WebaboAccessTokenProvider;
use Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

final class PersonSearchClient
{
    public function __construct(
        private readonly HupApiConfigProvider $configProvider,
        private readonly WebaboAccessTokenProvider $accessTokenProvider,
        private readonly HttpClientInterface $httpClient,
    ) {
    }

    /**
     * @param array<string, scalar|null> $queryParameters
     * @return array<string, mixed>
     */
    public function search(array $queryParameters, ?string $credentialName = null): array
    {
        $credential = $this->configProvider->getConfig()->getCredential($credentialName);

        return $this->requestJson(
            $credential->name,
            $this->buildSearchUrl($this->normalizeQueryParameters($queryParameters)),
            'personsearch',
            false,
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function getPerson(string|int $personId, ?string $credentialName = null): array
    {
        $credential = $this->configProvider->getConfig()->getCredential($credentialName);

        return $this->requestJson(
            $credential->name,
            $this->buildPersonUrl((string) $personId),
            'person detail',
            false,
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function getOrders(string|int $customerPersonId, ?string $credentialName = null): array
    {
        $credential = $this->configProvider->getConfig()->getCredential($credentialName);

        return $this->requestJson(
            $credential->name,
            $this->buildOrdersUrl((string) $customerPersonId),
            'orders',
            false,
        );
    }

    public function getMainAddress(string $personId, string $credentialName): array
    {
        return $this->requestJson($credentialName, $this->buildPersonUrl($personId).'/contacts/addresses/0', 'main address', false);
    }

    public function updateMainAddress(string $personId, string $credentialName, array $address): void
    {
        // This legacy path cannot bypass the protected writer's activation requirements.
        throw new \App\Http\ApiProblemException(409, 'upstream_concurrency_unverified',
            'Address writes require verified atomic upstream version control.');
    }

    private function buildPersonUrl(string $personId): string
    {
        $normalizedPersonId = trim($personId);
        if ('' === $normalizedPersonId) {
            throw new \RuntimeException('Subscription API person detail vereist een niet-lege personId.');
        }

        return sprintf(
            '%s/public/persons/%s',
            rtrim($this->resolvePpaBaseUrl(), '/'),
            rawurlencode($normalizedPersonId),
        );
    }

    private function buildOrdersUrl(string $customerPersonId): string
    {
        $normalizedCustomerPersonId = trim($customerPersonId);
        if ('' === $normalizedCustomerPersonId) {
            throw new \RuntimeException('Subscription API orders vereist een niet-lege customerPersonId.');
        }

        return sprintf(
            '%s/public/orders?%s',
            rtrim($this->resolvePpaBaseUrl(), '/'),
            http_build_query([
                'page' => 0,
                'pagesize' => 500,
                'customerPersonId' => $normalizedCustomerPersonId,
            ]),
        );
    }

    private function requestJson(string $credentialName, string $url, string $operationLabel, bool $isRetry, string $method = 'GET', ?array $body = null): array
    {
        $accessToken = $this->accessTokenProvider->getAccessToken($credentialName);

        try {
            $response = $this->httpClient->request($method, $url, [
                'headers' => [
                    'Accept' => 'application/json',
                    ...($body !== null ? ['Content-Type' => 'application/merge-patch+json'] : []),
                    'Authorization' => sprintf('Bearer %s', $accessToken),
                ],
                'timeout' => 15.0,
                'max_duration' => 15.0,
                'max_redirects' => 0,
                ...($body !== null ? ['json' => $body] : []),
            ]);
        } catch (TransportExceptionInterface $exception) {
            throw new SubscriptionApiResponseException(sprintf(
                'Subscription API %s voor credential "%s" mislukte door een transportfout.',
                $operationLabel,
                $credentialName,
            ), 0, $exception);
        }

        $statusCode = $response->getStatusCode();
        if (401 === $statusCode && !$isRetry) {
            $this->accessTokenProvider->invalidateCachedToken($credentialName);

            return $this->requestJson($credentialName, $url, $operationLabel, true, $method, $body);
        }

        $payload = json_decode($response->getContent(false), true);
        if (200 !== $statusCode || !\is_array($payload)) {
            throw new SubscriptionApiResponseException(sprintf(
                'Subscription API %s endpoint voor credential "%s" gaf een onbruikbaar antwoord terug (HTTP %d).',
                $operationLabel,
                $credentialName,
                $statusCode,
            ), $statusCode);
        }

        return $payload;
    }

    /**
     * @param array<string, scalar> $queryParameters
     */
    private function buildSearchUrl(array $queryParameters): string
    {
        $url = rtrim($this->resolvePpaBaseUrl(), '/').'/public/personsearch';

        if ([] === $queryParameters) {
            return $url;
        }

        return sprintf('%s?%s', $url, http_build_query($queryParameters));
    }

    private function resolvePpaBaseUrl(): string
    {
        $ppaBaseUrl = trim((string) ($this->configProvider->getConfig()->ppaBaseUrl ?? ''));
        if ('' === $ppaBaseUrl) {
            throw new \RuntimeException('Subscription API ppa_base_url ontbreekt in de client secrets configuratie.');
        }

        return $ppaBaseUrl;
    }

    /**
     * @param array<string, scalar|null> $queryParameters
     * @return array<string, scalar>
     */
    private function normalizeQueryParameters(array $queryParameters): array
    {
        $normalized = [];

        foreach ($queryParameters as $name => $value) {
            $normalizedName = trim((string) $name);
            if ('' === $normalizedName || null === $value) {
                continue;
            }

            if (\is_string($value)) {
                $trimmedValue = trim($value);
                if ('' === $trimmedValue) {
                    continue;
                }

                $normalized[$normalizedName] = $trimmedValue;
                continue;
            }

            if (\is_bool($value) || \is_int($value) || \is_float($value)) {
                $normalized[$normalizedName] = $value;
            }
        }

        return $normalized;
    }
}
