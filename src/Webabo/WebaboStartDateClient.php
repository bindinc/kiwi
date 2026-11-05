<?php

declare(strict_types=1);

namespace App\Webabo;

use App\Http\ApiProblemException;
use Symfony\Contracts\HttpClient\HttpClientInterface;

final class WebaboStartDateClient implements WebaboStartDateProviderInterface
{
    public function __construct(
        private readonly HupApiConfigProvider $configProvider,
        private readonly WebaboAccessTokenProvider $tokens,
        private readonly HttpClientInterface $httpClient,
    ) {
    }

    public function fetchStartDate(string $credentialKey, string $productCode, string $variantCode): string
    {
        if ('' === trim($credentialKey) || '' === trim($productCode) || '' === trim($variantCode)) {
            throw new ApiProblemException(422, 'start_date_context_required', 'An explicit credential, product and edition are required.');
        }

        try {
            $config = $this->configProvider->getConfig();
            $credential = $config->getCredential($credentialKey);
            $baseUrl = rtrim($config->webaboBaseUrl, '/');
            if (!str_starts_with($baseUrl, 'https://')) {
                throw new \RuntimeException('A secure source endpoint is required.');
            }

            $url = $baseUrl.'/subscriptions/start-dates?'.http_build_query([
                'productCode' => $productCode,
                'variantCode' => $variantCode,
            ]);
            $deadline = microtime(true) + 20.0;
            for ($attempt = 0; $attempt < 2; ++$attempt) {
                $token = $this->tokens->getAccessToken($credential->name, $deadline);
                $remaining = $deadline - microtime(true);
                if ($remaining <= 0) {
                    throw new \RuntimeException('Source deadline exceeded.');
                }
                $response = $this->httpClient->request('GET', $url, [
                    'headers' => ['Accept' => 'application/json', 'Authorization' => 'Bearer '.$token],
                    'timeout' => $remaining,
                    'max_duration' => $remaining,
                    'max_redirects' => 0,
                ]);
                $status = $response->getStatusCode();
                $body = $response->getContent(false);
                if (401 === $status && 0 === $attempt) {
                    $this->tokens->invalidateCachedToken($credential->name);
                    continue;
                }
                if (200 !== $status) {
                    throw new \RuntimeException('Source date unavailable.');
                }

                $payload = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
                $date = \is_array($payload) ? ($payload['startDate'] ?? null) : null;
                if (!self::isCalendarDate($date)) {
                    throw new \RuntimeException('Source date invalid.');
                }

                return $date;
            }
        } catch (\Exception) {
            // Source bodies and authentication errors must never reach the browser.
            throw new ApiProblemException(503, 'start_date_unavailable', 'The source subscription start date is unavailable. Please try again.');
        }

        throw new ApiProblemException(503, 'start_date_unavailable', 'The source subscription start date is unavailable.');
    }

    public static function isCalendarDate(mixed $value): bool
    {
        if (!\is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}$/D', $value)) {
            return false;
        }

        [$year, $month, $day] = array_map('intval', explode('-', $value));

        return checkdate($month, $day, $year);
    }
}
