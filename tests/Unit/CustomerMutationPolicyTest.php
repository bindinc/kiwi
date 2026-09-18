<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Http\ApiProblemException;
use App\Security\AuthorizationContext;
use App\Security\BusinessAccess;
use App\SubscriptionApi\CustomerMutationPolicy;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\HttpFoundation\Session\Session;
use Symfony\Component\HttpFoundation\Session\Storage\MockArraySessionStorage;

final class CustomerMutationPolicyTest extends TestCase
{
    /** @dataProvider roleOperations */
    public function testAllRolesRemainUnableToExecuteUnverifiedWrites(string $role, string $operation, int $status): void
    {
        $policy = $this->policy($role);
        try {
            $policy->requireMutation($operation);
            self::fail('An unverified upstream mutation must never be allowed');
        } catch (ApiProblemException $exception) {
            self::assertSame($status, $exception->getStatus());
            self::assertSame($status === 409 ? 'upstream_concurrency_unverified' : 'write_forbidden', $exception->getErrorCode());
        }
    }

    public static function roleOperations(): iterable
    {
        foreach (['admin', 'supervisor', 'user', 'view', 'dev'] as $role) {
            foreach (array_keys(CustomerMutationPolicy::OPERATIONS) as $operation) {
                yield $role.' '.$operation => [$role, $operation, in_array($role, ['view', 'dev'], true) ? 403 : 409];
            }
        }
    }

    public function testCapabilitiesSeparateRoleEligibilityFromWriteAvailability(): void
    {
        foreach (['admin', 'supervisor', 'user', 'view'] as $role) {
            $capabilities = $this->policy($role)->capabilities();
            self::assertSame($role !== 'view', $capabilities['roleCanWrite']);
            foreach ($capabilities['operations'] as $operation) {
                self::assertFalse($operation['enabled']);
                self::assertSame($role === 'view' ? 'write_forbidden' : 'upstream_concurrency_unverified', $operation['reason']);
            }
        }
    }

    public function testExpiredAuthorizationCannotReachTheUpstreamGate(): void
    {
        $this->expectException(ApiProblemException::class);
        $this->expectExceptionMessage('A fresh verified sign-in is required');
        $this->policy('admin', time() - 1)->requireMutation('bank.delete');
    }

    public function testUnknownOperationIsRejected(): void
    {
        try {
            $this->policy('admin')->requireMutation('bank.relink');
            self::fail('Unknown operation must be rejected');
        } catch (ApiProblemException $exception) {
            self::assertSame('unsupported_customer_operation', $exception->getErrorCode());
        }
    }

    private function policy(string $role, ?int $expiry = null): CustomerMutationPolicy
    {
        $session = new Session(new MockArraySessionStorage());
        $session->set(AuthorizationContext::SESSION_KEY, [
            'actor' => 'test-actor',
            'tenant' => 'test-tenant',
            'roles' => ['bink8s.app.kiwi.'.$role],
            'expiresAt' => $expiry ?? time() + 600,
        ]);
        $request = new Request();
        $request->setSession($session);
        $stack = new RequestStack();
        $stack->push($request);

        return new CustomerMutationPolicy(new BusinessAccess($stack));
    }
}
