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
        $url = rtrim($config->webaboBaseUrl, '/').'/offers';
        $sourceHost = parse_url($url, PHP_URL_HOST);

        foreach ($config->getCredentials() as $credential) {
            $credentialContext = $credential->toContextPayload('webabo-api');

            foreach ($this->requestOffers($credential->name, $url, $config->preview, false) as $offer) {
                foreach ($credentialContext as $contextKey => $contextValue) {
                    $offer[$contextKey] = $contextValue;
                }

                if ($config->preview) {
                    $offer['sourceHost'] = $sourceHost;
                }
                $offers[] = $offer;
            }
        }

        return $offers;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function requestOffers(string $credentialName, string $url, bool $preview, bool $isRetry): array
    {
        $accessToken = $this->accessTokenProvider->getAccessToken($credentialName);

        try {
            $response = $this->httpClient->request('GET', $url, [
                'headers' => [
                    'Accept' => 'application/json',
                    'Authorization' => sprintf('Bearer %s', $accessToken),
                ],
                'timeout' => 15.0,
                ...($preview ? ['max_redirects' => 0] : []),
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

            return $this->requestOffers($credentialName, $url, $preview, true);
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
