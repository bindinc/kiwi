<?php

declare(strict_types=1);
namespace App\Tests\Functional;

use App\SubscriptionApi\CustomerEditingService;
use App\Http\ApiProblemException;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class CustomerEditingSecurityTest extends WebTestCase
{
    use AuthenticatedClientTrait;

    public static function writes(): iterable
    {
        foreach (['admin', 'supervisor', 'user', 'view', 'dev'] as $role) {
            foreach ([
                ['PATCH', 'profile', ['firstName' => 'Alex']],
                ['PATCH', 'addresses/a1', ['city' => 'Teststad']],
                ['PATCH', 'emails/e1', ['emailAddress' => 'test@example.org']],
                ['PATCH', 'phones/p1', ['number' => '0351234567']],
                ['PATCH', 'mobiles/m1', ['number' => '0612345678']],
                ['POST', 'bank-accounts', ['iban' => 'NL91ABNA0417164300']],
                ['PATCH', 'bank-accounts/b1', ['iban' => 'NL91ABNA0417164300']],
                ['DELETE', 'bank-accounts/b1', []],
            ] as [$method, $path, $changes]) yield $role.' '.$method.' '.$path => [$role, $method, $path, $changes];
        }
    }

    /** @dataProvider writes */
    public function testDirectWritesCannotBypassSourceGate(string $role, string $method, string $path, array $changes): void
    {
        $client = $this->createAuthenticatedClient(['bink8s.app.kiwi.'.$role]);
        // A nonexistent credential proves the guard runs before resolving source access.
        $client->request($method, '/api/v1/persons/123/'.$path,
            server: ['CONTENT_TYPE' => 'application/json', 'HTTP_IDEMPOTENCY_KEY' => 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'],
            content: json_encode(['credentialKey' => 'unconfigured', 'expectedVersion' => 'forged', 'changes' => $changes]));
        self::assertResponseStatusCodeSame(in_array($role, ['view', 'dev'], true) ? 403 : 409);
        $body = json_decode($client->getResponse()->getContent(), true);
        self::assertSame(in_array($role, ['view', 'dev'], true) ? 'forbidden' : 'upstream_concurrency_unverified', $body['error']['code']);
    }
    public function testCsrfIsMandatoryForBankDeletion(): void
    {
        $client = $this->createAuthenticatedClient(['bink8s.app.kiwi.admin']);
        $client->setServerParameter('HTTP_X_CSRF_TOKEN', '');
        $client->request('DELETE', '/api/v1/persons/123/bank-accounts/b1', server: ['CONTENT_TYPE' => 'application/json'], content: '{}');
        self::assertResponseStatusCodeSame(403);
    }
    public function testForgedAuthorizationAndIdentityFieldsAreRejected(): void
    {
        $client = $this->createAuthenticatedClient(['bink8s.app.kiwi.admin']);
        $client->request('PATCH', '/api/v1/persons/123/profile', server: ['CONTENT_TYPE' => 'application/json'], content: '{"roles":["admin"],"mandant":"ALL","personId":"other"}');
        self::assertResponseStatusCodeSame(422);
    }
    public function testCallingServiceWithoutARequestCannotGrantAuthorization(): void
    {
        static::bootKernel();
        $this->expectException(ApiProblemException::class);
        static::getContainer()->get(CustomerEditingService::class)->mutate('123', null, 'person.update', ['roles' => ['admin']], '', '');
    }

    public function testCombinedRolesAddPermissionsWithoutAnyMandantRole(): void
    {
        foreach ([['view', 'user'], ['dev', 'user'], ['dev', 'view']] as $roles) {
            static::ensureKernelShutdown();
            $client = $this->createAuthenticatedClient(array_map(static fn ($role) => 'bink8s.app.kiwi.'.$role, $roles));
            $client->request('PATCH', '/api/v1/persons/123/profile',
                server: ['CONTENT_TYPE' => 'application/json', 'HTTP_IDEMPOTENCY_KEY' => 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'],
                content: '{"credentialKey":"unconfigured","changes":{"firstName":"Test"}}');
            self::assertResponseStatusCodeSame(in_array('user', $roles, true) ? 409 : 403);
        }
    }

    public function testRefusedMutationDoesNotWriteToTheSharedLedger(): void
    {
        $client = $this->createAuthenticatedClient(['bink8s.app.kiwi.admin']);
        $connection = static::getContainer()->get(\Doctrine\DBAL\Connection::class);
        $connection->executeStatement(\App\SubscriptionApi\CustomerMutationLedger::SCHEMA);
        $before = $connection->fetchOne('SELECT count(*) FROM customer_mutations');
        $client->request('PATCH', '/api/v1/persons/123/profile',
            server: ['CONTENT_TYPE' => 'application/json', 'HTTP_IDEMPOTENCY_KEY' => 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'],
            content: '{"credentialKey":"unconfigured","changes":{"firstName":"Test"}}');
        self::assertResponseStatusCodeSame(409);
        self::assertSame($before, $connection->fetchOne('SELECT count(*) FROM customer_mutations'));
    }
}
