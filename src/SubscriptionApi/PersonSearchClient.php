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

    private function requestJson(string $credentialName, string $url, string $operationLabel, bool $isRetry): array
    {
        $accessToken = $this->accessTokenProvider->getAccessToken($credentialName);

        try {
            $response = $this->httpClient->request('GET', $url, [
                'headers' => [
                    'Accept' => 'application/json',
                    'Authorization' => sprintf('Bearer %s', $accessToken),
                ],
                'timeout' => 15.0,
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

            return $this->requestJson($credentialName, $url, $operationLabel, true);
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
