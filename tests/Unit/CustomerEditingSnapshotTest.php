<?php

declare(strict_types=1);
namespace App\Tests\Unit;

use App\Http\ApiProblemException;
use App\SubscriptionApi\CustomerEditingSnapshot;
use App\Webabo\HupApiCredential;
use PHPUnit\Framework\TestCase;

final class CustomerEditingSnapshotTest extends TestCase
{
    public function testMissingIdsAreNeverInferredFromPositionAndBanksAreMasked(): void
    {
        $snapshot = (new CustomerEditingSnapshot())->build([
            'rId' => '123', 'firstName' => 'Alex', 'initials' => 'A.B.',
            'contacts' => ['emails' => [['getrId' => 'e1', 'emailAddress' => 'first@example.org'], ['emailAddress' => 'second@example.org']]],
            'payments' => ['ibanItems' => [['iban' => 'NL91ABNA0417164300']]],
        ]);
        self::assertCount(2, $snapshot['sections']['email']);
        self::assertSame('e1', $snapshot['sections']['email'][0]['id']);
        self::assertNull($snapshot['sections']['email'][1]['id']);
        self::assertNull($snapshot['sections']['bank'][0]['id']);
        self::assertFalse($snapshot['sections']['bank'][0]['deletionAllowed']);
        self::assertStringNotContainsString('NL91ABNA0417164300', json_encode($snapshot));
        self::assertNull($snapshot['version']);
        self::assertSame('Alex', $snapshot['sections']['person'][0]['fields']['firstName']);
        self::assertSame('A.B.', $snapshot['sections']['person'][0]['fields']['initials']);
    }
    /** @dataProvider invalidResources */
    public function testUnverifiedSubresourcesCannotBeChanged(array $person, string $action, string $id): void
    {
        $this->expectException(ApiProblemException::class);
        (new CustomerEditingSnapshot())->verifySubresource($person, $action, $id);
    }
    public static function invalidResources(): iterable
    {
        yield [['rId' => '123', 'contacts' => ['emails' => [['getrId' => 'other']]]], 'email.update', 'forged'];
        yield [['rId' => '123', 'contacts' => ['emails' => [['getrId' => 'duplicate'], ['getrId' => 'duplicate']]]], 'email.update', 'duplicate'];
        yield [['rId' => '123', 'payments' => ['ibanItems' => [['rId' => 'b1']]]], 'bank.delete', 'b1'];
    }
    public function testSourceDivisionAndPersonMustMatch(): void
    {
        $credential = new HupApiCredential('test', null, 'TEST', '14', true, null, null, null);
        $snapshot = new CustomerEditingSnapshot();
        $snapshot->verifyPerson(['rId' => '123', 'division' => ['rId' => '14']], '123', $credential);
        $this->expectException(ApiProblemException::class);
        $snapshot->verifyPerson(['rId' => '123', 'division' => ['rId' => '99']], '123', $credential);
    }
}
