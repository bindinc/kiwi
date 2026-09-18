<?php

declare(strict_types=1);
namespace App\Tests\Functional;

use App\Http\ApiProblemException;
use App\SubscriptionApi\CustomerWriteClient;
use App\SubscriptionApi\CustomerMutationPolicy;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

final class CustomerWriteClientTest extends KernelTestCase
{
    public function testEachSectionUsesItsDocumentedContentTypeAndExplicitResourcePath(): void
    {
        self::bootKernel();
        $client = static::getContainer()->get(CustomerWriteClient::class);
        $person = $client->requestDefinition('person.update', '123', null, ['firstName' => 'Alex', 'initials' => 'A.B.']);
        self::assertSame('PATCH', $person['method']);
        self::assertSame('/public/persons/123', $person['path']);
        self::assertSame('application/merge-patch+json', $person['contentType']);
        self::assertSame(['firstName' => 'Alex', 'initials' => 'A.B.'], $person['payload']);
        $address = $client->requestDefinition('address.update', '123', 'a1', ['housenumber' => '4 B']);
        self::assertSame('/public/persons/123/contacts/addresses/a1', $address['path']);
        self::assertSame(['address' => ['housenumber' => ['housenumber' => '4 B']]], $address['payload']);
        foreach (['phone', 'mobile'] as $section) {
            $contact = $client->requestDefinition($section.'.update', '123', 'contact-2', ['number' => '0612345678']);
            self::assertSame('/public/persons/123/contacts/'.$section.'s/contact-2', $contact['path']);
            self::assertSame('application/merge-patch+json', $contact['contentType']);
        }
        $bank = $client->requestDefinition('bank.create', '123', null, ['iban' => 'BE68539007547034']);
        self::assertSame('POST', $bank['method']);
        self::assertSame('application/json', $bank['contentType']);
        $delete = $client->requestDefinition('bank.delete', '123', 'b2', []);
        self::assertSame('DELETE', $delete['method']);
        self::assertNull($delete['contentType']);
    }
    public function testDirectClientCallsCannotSkipAuthentication(): void
    {
        self::bootKernel();
        $this->expectException(ApiProblemException::class);
        static::getContainer()->get(CustomerWriteClient::class)->write('bank.delete', 'unconfigured', '123', 'b1', [], 'forged');
    }
    public function testNoBrowserVersionCanCreateAnAtomicSourceCondition(): void
    {
        self::bootKernel();
        $this->expectException(ApiProblemException::class);
        $this->expectExceptionMessage('No supported atomic source version condition');
        static::getContainer()->get(CustomerMutationPolicy::class)->verifiedVersionCondition('forged-etag');
    }
}
