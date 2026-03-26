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

        return $this->requestSearch(
            $credential->name,
            $this->normalizeQueryParameters($queryParameters),
            false,
        );
    }

    /**
     * @param array<string, scalar> $queryParameters
     * @return array<string, mixed>
     */
    private function requestSearch(string $credentialName, array $queryParameters, bool $isRetry): array
    {
        $url = $this->buildSearchUrl($queryParameters);
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
            throw new \RuntimeException(sprintf(
                'Subscription API personsearch voor credential "%s" mislukte door een transportfout.',
                $credentialName,
            ), 0, $exception);
        }

        $statusCode = $response->getStatusCode();
        if (401 === $statusCode && !$isRetry) {
            $this->accessTokenProvider->invalidateCachedToken($credentialName);

            return $this->requestSearch($credentialName, $queryParameters, true);
        }

        $payload = json_decode($response->getContent(false), true);
        if (200 !== $statusCode || !\is_array($payload)) {
            throw new \RuntimeException(sprintf(
                'Subscription API personsearch endpoint voor credential "%s" gaf een onbruikbaar antwoord terug (HTTP %d).',
                $credentialName,
                $statusCode,
            ));
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
