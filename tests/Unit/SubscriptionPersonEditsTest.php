<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Http\ApiProblemException;
use App\Service\SubscriptionPersonEdits;
use PHPUnit\Framework\TestCase;

final class SubscriptionPersonEditsTest extends TestCase
{
    private function person(): array
    {
        return ['id' => 73, 'personNumber' => '123', 'credentialKey' => 'demo', 'sourceSystem' => 'subscription-api',
            'salutation' => 'Dhr.', 'firstName' => 'P.', 'lastName' => 'Tester', 'street' => 'Teststraat',
            'postalCode' => '1234AB', 'houseNumber' => '10', 'city' => 'Hilversum', 'email' => 'demo@example.org',
            'addressExtension' => 'Old extension'];
    }

    public function testOrderDetailsCannotChangeIdentityOrAnotherRole(): void
    {
        $person = $this->person();
        $recipient = SubscriptionPersonEdits::apply($person, ['street' => ' Nieuwe straat ', 'addressExtension' => '',
            'id' => 99, 'credentialKey' => 'forged', 'sourceSystem' => 'kiwi', 'personNumber' => 'forged', 'verified' => true]);
        $payer = SubscriptionPersonEdits::apply($person, ['street' => 'Betaalstraat']);
        self::assertSame('Nieuwe straat', $recipient['street']);
        self::assertSame('', $recipient['addressExtension']);
        self::assertSame('Betaalstraat', $payer['street']);
        self::assertSame('Teststraat', $person['street']);
        foreach (['id', 'credentialKey', 'sourceSystem', 'personNumber'] as $field) {
            self::assertSame($person[$field], $recipient[$field]);
        }
        self::assertArrayNotHasKey('verified', $recipient);
    }

    /** @dataProvider invalidEdits */
    public function testInvalidEditsAreRejected(mixed $edits): void
    {
        $this->expectException(ApiProblemException::class);
        SubscriptionPersonEdits::apply($this->person(), $edits);
    }

    public static function invalidEdits(): array
    {
        return [[null], ['invalid'], [['lastName' => '']], [['houseNumber' => []]], [['email' => 'invalid']]];
    }
}
