<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\SubscriptionApi\CredentialPersonSearchResult;
use App\SubscriptionApi\PersonSearchResultNormalizer;
use App\Webabo\HupApiCredential;
use PHPUnit\Framework\TestCase;

final class PersonSearchResultNormalizerTest extends TestCase
{
    public function testNormalizeCredentialResultMapsSearchPayloadToKiwiPersonModel(): void
    {
        $credential = new HupApiCredential(
            name: 'tvk',
            title: 'TV Krant',
            mandant: 'AVROTROS',
            supportsPersonLookup: true,
            username: 'tvk-user',
            password: 'tvk-password',
            refreshToken: null,
        );
        $result = new CredentialPersonSearchResult($credential, [
            'content' => [
                [
                    'personId' => '12345',
                    'divisionId' => 'HMC',
                    'name' => 'de Vries',
                    'firstName' => 'Jan',
                    'street' => 'Damstraat',
                    'houseNo' => '42A',
                    'city' => 'Amsterdam',
                    'postCode' => '1012AB',
                    'phone' => [' 06-12345678 ', '020-1234567'],
                    'geteMail' => [' jan.devries@example.org ', 'alt@example.org'],
                ],
            ],
            'pageNumber' => 0,
            'pageSize' => 10,
            'totalElements' => 1,
            'totalPages' => 1,
        ]);

        $normalizer = new PersonSearchResultNormalizer();

        $normalized = $normalizer->normalizeCredentialResult($result);

        self::assertSame([[
            'id' => '12345',
            'personId' => '12345',
            'firstName' => 'Jan',
            'middleName' => 'de',
            'lastName' => 'Vries',
            'postalCode' => '1012AB',
            'houseNumber' => '42A',
            'address' => 'Damstraat 42A',
            'city' => 'Amsterdam',
            'email' => 'jan.devries@example.org',
            'phone' => '06-12345678',
            'credentialKey' => 'tvk',
            'credentialTitle' => 'TV Krant',
            'mandant' => 'HMC',
            'divisionId' => 'HMC',
            'supportsPersonLookup' => true,
            'sourceSystem' => 'subscription-api',
            'subscriptions' => [],
            'articles' => [],
            'contactHistory' => [],
            'deliveryRemarks' => [
                'default' => '',
                'lastUpdated' => null,
                'history' => [],
            ],
        ]], $normalized);
    }

    public function testNormalizeCredentialResultFallsBackToCredentialMandantAndSkipsInvalidRows(): void
    {
        $credential = new HupApiCredential(
            name: 'kroncrv',
            title: 'KRO-NCRV',
            mandant: 'KRONCRV',
            supportsPersonLookup: true,
            username: 'kro-user',
            password: 'kro-password',
            refreshToken: null,
        );
        $result = new CredentialPersonSearchResult($credential, [
            'content' => [
                'invalid-row',
                [
                    'personId' => '987',
                    'name' => 'Jansen',
                    'firstName' => 'Maria',
                    'street' => 'Stationsweg',
                    'houseNo' => '10',
                    'city' => 'Hilversum',
                    'postCode' => '1217AA',
                    'phone' => ['', ' 035-1234567 '],
                    'geteMail' => [null, ' maria.jansen@example.org '],
                ],
            ],
        ]);

        $normalizer = new PersonSearchResultNormalizer();

        $normalized = $normalizer->normalizeCredentialResult($result);

        self::assertCount(1, $normalized);
        self::assertSame('KRONCRV', $normalized[0]['mandant']);
        self::assertNull($normalized[0]['divisionId']);
        self::assertSame('', $normalized[0]['middleName']);
        self::assertSame('Jansen', $normalized[0]['lastName']);
        self::assertSame('035-1234567', $normalized[0]['phone']);
        self::assertSame('maria.jansen@example.org', $normalized[0]['email']);
    }
}
