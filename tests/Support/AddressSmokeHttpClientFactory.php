<?php

declare(strict_types=1);

namespace App\Tests\Support;

use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

/** Explicitly wired only by the isolated address smoke-test Compose override. */
final class AddressSmokeHttpClientFactory
{
    public static function create(): MockHttpClient
    {
        return new MockHttpClient(static function (string $method, string $url, array $options): MockResponse {
            parse_str((string) parse_url($url, PHP_URL_QUERY), $query);
            $host = parse_url($url, PHP_URL_HOST);
            $path = parse_url($url, PHP_URL_PATH);
            if ('api.postnl.nl' === $host && str_ends_with($path, '/token')) {
                $random = bin2hex(random_bytes(16));
                $uuid = sprintf('%s-%s-4%s-a%s-%s', substr($random, 0, 8), substr($random, 8, 4), substr($random, 13, 3), substr($random, 17, 3), substr($random, 20, 12));

                return self::respond(['uuid' => $uuid]);
            }
            if ('identity.invalid' === $host) {
                return self::respond(['access_token' => '<token>', 'expires_in' => 300]);
            }
            if ('api.postnl.nl' === $host && str_ends_with($path, '/search')) {
                $postcode = $query['postalCode'] ?? '';
                if (in_array($postcode, ['9998ZZ', '9997ZZ'], true)) return self::respond([], 503);
                if ('9999ZZ' === $postcode) return self::respond([]);
                if ('1223CK' === $postcode) {
                    $address = ['postalCode' => '1223CK', 'houseNumber' => '2', 'houseNumberAddition' => '', 'streetName' => 'Kometenstraat', 'cityName' => 'Hilversum'];
                    return self::respond([$address, array_replace($address, ['houseNumberAddition' => 'A 1']), array_replace($address, ['houseNumberAddition' => 'A 2'])]);
                }
                $address = ['postalCode' => $postcode ?: '1231AA', 'houseNumber' => $query['houseNumber'] ?? '1', 'houseNumberAddition' => '', 'streetName' => 'Rembrandtlaan', 'cityName' => 'Loosdrecht'];
                return self::respond([$address, array_replace($address, ['houseNumberAddition' => 'A'])]);
            }
            if ('webabo.invalid' === $host && '/addresses/search' === $path) {
                $body = json_decode($options['body'], true);
                if ('9997ZZ' === $body['zipcode']) return self::respond([], 503);
                return self::respond([['zipcode' => $body['zipcode'], 'houseNo' => $body['houseNo'], 'streetName' => 'Fallbackstraat', 'city' => 'Teststad']]);
            }
            throw new \LogicException('Unexpected request in isolated address smoke test');
        });
    }

    private static function respond(array $body, int $status = 200): MockResponse
    {
        return new MockResponse(json_encode($body, JSON_THROW_ON_ERROR), ['http_code' => $status]);
    }
}
