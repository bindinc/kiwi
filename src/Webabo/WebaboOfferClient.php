<?php

declare(strict_types=1);

namespace App\Webabo;

use Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

final class WebaboOfferClient
{
    public function __construct(
        private readonly HupApiConfigProvider $configProvider,
        private readonly WebaboAccessTokenProvider $accessTokenProvider,
        private readonly HttpClientInterface $httpClient,
    ) {
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function fetchOffers(): array
    {
        $config = $this->configProvider->getConfig();
        $offers = [];

        foreach ($config->getCredentials() as $credential) {
            $credentialContext = $credential->toContextPayload('webabo-api');

            foreach ($this->requestOffers($credential->name, false) as $offer) {
                foreach ($credentialContext as $contextKey => $contextValue) {
                    $offer[$contextKey] = $contextValue;
                }

                $offers[] = $offer;
            }
        }

        return $offers;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function requestOffers(string $credentialName, bool $isRetry): array
    {
        $config = $this->configProvider->getConfig();
        $accessToken = $this->accessTokenProvider->getAccessToken($credentialName);
        $url = rtrim($config->webaboBaseUrl, '/').'/offers';

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
                'Webabo offers ophalen voor credential "%s" mislukte door een transportfout.',
                $credentialName,
            ), 0, $exception);
        }

        $statusCode = $response->getStatusCode();
        if (401 === $statusCode && !$isRetry) {
            $this->accessTokenProvider->invalidateCachedToken($credentialName);

            return $this->requestOffers($credentialName, true);
        }

        $payload = json_decode($response->getContent(false), true);
        if (200 !== $statusCode || !\is_array($payload)) {
            throw new \RuntimeException(sprintf(
                'Webabo offers endpoint voor credential "%s" gaf een onbruikbaar antwoord terug (HTTP %d).',
                $credentialName,
                $statusCode,
            ));
        }

        $offers = array_values(array_filter(
            $payload,
            static fn (mixed $item): bool => \is_array($item),
        ));

        /** @var list<array<string, mixed>> $offers */
        return $offers;
    }
}
