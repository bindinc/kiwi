<?php

declare(strict_types=1);
namespace App\Tests\Functional;

use App\Http\ApiProblemException;
use App\Security\AuthorizationContext;
use App\SubscriptionApi\CustomerMutationLedger;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\DriverManager;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

final class CustomerMutationLedgerTest extends KernelTestCase
{
    public function testIntentSurvivesAcrossConnectionsAndBlocksUnknownOutcomeReplay(): void
    {
        self::bootKernel();
        $connection = static::getContainer()->get(Connection::class);
        $connection->executeStatement(CustomerMutationLedger::SCHEMA);
        $actor = new AuthorizationContext('ledger-test-'.bin2hex(random_bytes(8)), 'test', ['bink8s.app.kiwi.admin'], time() + 600);
        $key = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
        $first = new CustomerMutationLedger($connection);
        $otherConnection = DriverManager::getConnection($connection->getParams());
        try {
            $first->begin($actor, $key, 'TEST', 'test', '123', 'b1', 'bank.update', ['iban', 'bic'], 'correlation');
            $row = $otherConnection->fetchAssociative('SELECT * FROM customer_mutations WHERE actor = ?', ['test:'.$actor->actor]);
            self::assertSame('intent', $row['outcome']);
            self::assertSame(['iban', 'bic'], json_decode($row['field_names'], true));
            self::assertArrayNotHasKey('payload', $row);
            self::assertSame($actor->expiresAt, (int) $row['authorization_expires_at']);
            $first->finish($actor, $key, 'unknown');
            $second = new CustomerMutationLedger($otherConnection);
            try {
                $second->begin($actor, $key, 'TEST', 'test', '999', 'different-bank', 'bank.delete', [], 'other-correlation');
                self::fail('Second connection must not replay an uncertain request');
            } catch (ApiProblemException $exception) {
                self::assertSame('duplicate_mutation', $exception->getErrorCode());
            }
            self::assertSame(1, (int) $connection->fetchOne('SELECT count(*) FROM customer_mutations WHERE actor = ?', ['test:'.$actor->actor]));
            self::assertSame('unknown', $connection->fetchOne('SELECT outcome FROM customer_mutations WHERE actor = ?', ['test:'.$actor->actor]));
        } finally {
            $connection->executeStatement('DELETE FROM customer_mutations WHERE actor = ?', ['test:'.$actor->actor]);
            $otherConnection->close();
        }
    }

    public function testAuditFailureCannotProduceAnIntent(): void
    {
        $connection = $this->createMock(Connection::class);
        $connection->method('getTransactionNestingLevel')->willReturn(0);
        $connection->method('executeStatement')->willThrowException(new \RuntimeException('unavailable'));
        $ledger = new CustomerMutationLedger($connection);
        $actor = new AuthorizationContext('actor', 'test', ['bink8s.app.kiwi.user'], time() + 600);
        try {
            $ledger->begin($actor, 'key', 'TEST', 'test', '123', null, 'person.update', ['firstName'], 'correlation');
            self::fail('Unavailable audit must prevent a new mutation');
        } catch (ApiProblemException $exception) {
            self::assertSame('mutation_audit_unavailable', $exception->getErrorCode());
        }
    }

    public function testExpiredAuthorizationDoesNotTouchStorage(): void
    {
        $connection = $this->createMock(Connection::class);
        $connection->expects(self::never())->method('executeStatement');
        $ledger = new CustomerMutationLedger($connection);
        $this->expectException(ApiProblemException::class);
        $ledger->begin(new AuthorizationContext('actor', 'test', ['bink8s.app.kiwi.admin'], time() - 1),
            'key', 'TEST', 'test', '123', null, 'person.update', ['firstName'], 'correlation');
    }
}
