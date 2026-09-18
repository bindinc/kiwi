<?php

declare(strict_types=1);
namespace App\Tests\Unit;

use App\Http\ApiProblemException;
use App\SubscriptionApi\CustomerMutationInput;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Validator\Validation;

final class CustomerMutationInputTest extends TestCase
{
    /** @dataProvider invalidChanges */
    public function testInvalidFieldsDoNotEchoPersonalValues(string $operation, array $changes): void
    {
        $validator = new CustomerMutationInput(Validation::createValidator());
        try {
            $validator->validate($operation, $changes);
            self::fail('Invalid change was accepted');
        } catch (ApiProblemException $exception) {
            self::assertSame(422, $exception->getStatus());
            self::assertStringNotContainsString('Sensitive', $exception->getMessage());
        }
    }
    public static function invalidChanges(): iterable
    {
        yield ['person.update', ['rId' => 'Sensitive']];
        yield ['person.update', ['roles' => ['admin']]];
        yield ['person.update', ['firstName' => ['Sensitive']]];
        yield ['person.update', ['firstName' => "Sensitive\n"]];
        yield ['person.update', ['birthDay' => '2025-02-29']];
        yield ['person.update', ['birthDay' => '2999-01-01']];
        yield ['person.update', ['lastName' => '']];
        yield ['person.update', []];
        yield ['email.update', ['emailAddress' => 'Sensitive@']];
        yield ['mobile.update', ['number' => 'Sensitive']];
        yield ['bank.create', ['iban' => 'NL91ABNA0417164301']];
        yield ['bank.create', ['iban' => 'NL91ABNA04171643000']];
        yield ['bank.update', ['iban' => 'NL91ABNA0417164300', 'bic' => 'Sensitive']];
        yield ['bank.update', ['bic' => 'ABNANL2A']];
        yield ['bank.delete', ['iban' => 'NL91ABNA0417164300']];
        yield ['address.update', ['isoCountryCode' => 'XX']];
        yield ['address.update', ['address' => ['division' => 'Sensitive']]];
    }
    public function testBankNormalizationAndValidCountryLengths(): void
    {
        $validator = new CustomerMutationInput(Validation::createValidator());
        self::assertSame(['iban' => 'NL91ABNA0417164300', 'bic' => 'ABNANL2A'], $validator->validate('bank.create', ['iban' => 'nl91 abna 0417 1643 00', 'bic' => 'abnanl2a']));
        self::assertSame(['iban' => 'BE68539007547034'], $validator->validate('bank.update', ['iban' => 'BE68539007547034']));
    }
    public function testNamesAreNotInterchangedAndAddressUsesItsOwnContract(): void
    {
        $validator = new CustomerMutationInput(Validation::createValidator());
        self::assertSame(['firstName' => 'Alex', 'initials' => 'A.B.'], $validator->upstreamPayload('person.update', ['firstName' => 'Alex', 'initials' => 'A.B.']));
        self::assertSame(['address' => ['housenumber' => ['housenumber' => '12 A'], 'street' => 'Teststraat'], 'extension' => '2'], $validator->upstreamPayload('address.update', ['housenumber' => '12 A', 'street' => 'Teststraat', 'extension' => '2']));
    }
}
