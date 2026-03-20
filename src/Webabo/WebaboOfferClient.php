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
        return $this->requestOffers(false);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function requestOffers(bool $isRetry): array
    {
        $config = $this->configProvider->getConfig();
        $accessToken = $this->accessTokenProvider->getAccessToken();
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
            throw new \RuntimeException('Webabo offers ophalen mislukte door een transportfout.', 0, $exception);
        }

        $statusCode = $response->getStatusCode();
        if (401 === $statusCode && !$isRetry) {
            $this->accessTokenProvider->invalidateCachedToken();

            return $this->requestOffers(true);
        }

        $payload = json_decode($response->getContent(false), true);
        if (200 !== $statusCode || !\is_array($payload)) {
            throw new \RuntimeException(sprintf('Webabo offers endpoint gaf een onbruikbaar antwoord terug (HTTP %d).', $statusCode));
        }

        $offers = array_values(array_filter(
            $payload,
            static fn (mixed $item): bool => \is_array($item),
        ));

        /** @var list<array<string, mixed>> $offers */
        return $offers;
    }
}
