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
            mandant: 'HMC',
            supportsPersonLookup: true,
            username: 'tvk-user',
            password: 'tvk-password',
            refreshToken: null,
        );
        $result = new CredentialPersonSearchResult($credential, [
            'content' => [
                [
                    'personId' => '12345',
                    'divisionId' => '14',
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
            'id' => 12345,
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
            'divisionId' => '14',
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
        self::assertSame(987, $normalized[0]['id']);
        self::assertSame('KRONCRV', $normalized[0]['mandant']);
        self::assertNull($normalized[0]['divisionId']);
        self::assertSame('', $normalized[0]['middleName']);
        self::assertSame('Jansen', $normalized[0]['lastName']);
        self::assertSame('035-1234567', $normalized[0]['phone']);
        self::assertSame('maria.jansen@example.org', $normalized[0]['email']);
    }

    public function testNormalizeDetailPersonMapsPpaPersonPayloadToKiwiCustomerModel(): void
    {
        $credential = new HupApiCredential(
            name: 'tvk',
            title: 'TV Krant',
            mandant: 'HMC',
            supportsPersonLookup: true,
            username: 'tvk-user',
            password: 'tvk-password',
            refreshToken: null,
        );
        $rawPerson = [
            'rId' => '11860448',
            'personNumber' => '41929371',
            'division' => [
                'rId' => '14',
            ],
            'lastName' => 'Bakker-Bakker',
            'surName' => 'de',
            'birthDay' => '1945-11-20',
            'matchCode' => '7831CM33',
            'initials' => 'R.',
            'addressType' => [
                'name' => 'HEER',
            ],
            'contacts' => [
                'emails' => [
                    ['emailAddress' => 'wiesje_meeringa@hotmail.nl'],
                ],
                'phones' => [
                    ['number' => '0591522006'],
                ],
                'addresses' => [
                    [
                        'address' => [
                            'street' => 'Ph. Lindemanstraat',
                            'postCode' => '7831CM',
                            'city' => 'NIEUW-WEERDINGE',
                            'housenumber' => [
                                'housenumber' => '33',
                            ],
                        ],
                    ],
                ],
            ],
            'payments' => [
                'ibanItems' => [
                    ['iban' => 'NL80INGB0001340187'],
                ],
            ],
            'references' => [
                [
                    'origin' => 'UIS',
                    'identifier' => '41929371',
                ],
            ],
        ];

        $normalizer = new PersonSearchResultNormalizer();

        $normalized = $normalizer->normalizeDetailPerson($rawPerson, $credential, '11860448');

        self::assertSame(11860448, $normalized['id']);
        self::assertSame('11860448', $normalized['personId']);
        self::assertSame('41929371', $normalized['personNumber']);
        self::assertSame('', $normalized['firstName']);
        self::assertSame('de', $normalized['middleName']);
        self::assertSame('Bakker-Bakker', $normalized['lastName']);
        self::assertSame('Dhr.', $normalized['salutation']);
        self::assertSame('1945-11-20', $normalized['birthday']);
        self::assertSame('Ph. Lindemanstraat 33', $normalized['address']);
        self::assertSame('7831CM', $normalized['postalCode']);
        self::assertSame('33', $normalized['houseNumber']);
        self::assertSame('NIEUW-WEERDINGE', $normalized['city']);
        self::assertSame('wiesje_meeringa@hotmail.nl', $normalized['email']);
        self::assertSame('0591522006', $normalized['phone']);
        self::assertSame('HMC', $normalized['mandant']);
        self::assertSame('14', $normalized['divisionId']);
        self::assertSame('NL80INGB0001340187', $normalized['iban']);
        self::assertSame([['origin' => 'UIS', 'identifier' => '41929371']], $normalized['references']);
    }
}
