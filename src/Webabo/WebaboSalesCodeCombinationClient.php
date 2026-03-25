<?php

declare(strict_types=1);

namespace App\Webabo;

use Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

final class WebaboSalesCodeCombinationClient implements WebaboSalesCodeCombinationProviderInterface
{
    private const REFERENCE_DATE_FORMAT = 'Y-m-d';

    public function __construct(
        private readonly HupApiConfigProvider $configProvider,
        private readonly WebaboAccessTokenProvider $accessTokenProvider,
        private readonly HttpClientInterface $httpClient,
    ) {
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function fetchCombinations(string $credentialName, string $productCode, \DateTimeImmutable $referenceDate): array
    {
        return $this->requestCombinations($credentialName, $productCode, $referenceDate, false);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function requestCombinations(
        string $credentialName,
        string $productCode,
        \DateTimeImmutable $referenceDate,
        bool $isRetry,
    ): array {
        $config = $this->configProvider->getConfig();
        $accessToken = $this->accessTokenProvider->getAccessToken($credentialName);
        $query = http_build_query([
            'productCode' => $productCode,
            'refDate' => $referenceDate->format(self::REFERENCE_DATE_FORMAT),
        ]);
        $url = rtrim($config->webaboBaseUrl, '/').'/offers/salescodecombinations';
        $requestUrl = sprintf('%s?%s', $url, $query);

        try {
            $response = $this->httpClient->request('GET', $requestUrl, [
                'headers' => [
                    'Accept' => 'application/json',
                    'Authorization' => sprintf('Bearer %s', $accessToken),
                ],
                'timeout' => 15.0,
            ]);
        } catch (TransportExceptionInterface $exception) {
            throw new \RuntimeException(sprintf(
                'Webabo salescodecombinaties ophalen voor credential "%s" en product "%s" mislukte door een transportfout.',
                $credentialName,
                $productCode,
            ), 0, $exception);
        }

        $statusCode = $response->getStatusCode();
        if (401 === $statusCode && !$isRetry) {
            $this->accessTokenProvider->invalidateCachedToken($credentialName);

            return $this->requestCombinations($credentialName, $productCode, $referenceDate, true);
        }

        $payload = json_decode($response->getContent(false), true);
        if (200 !== $statusCode || !\is_array($payload)) {
            throw new \RuntimeException(sprintf(
                'Webabo salescodecombinaties endpoint voor credential "%s" en product "%s" gaf een onbruikbaar antwoord terug (HTTP %d).',
                $credentialName,
                $productCode,
                $statusCode,
            ));
        }

        $items = array_values(array_filter(
            $payload,
            static fn (mixed $item): bool => \is_array($item),
        ));

        /** @var list<array<string, mixed>> $items */
        return $items;
    }
}
