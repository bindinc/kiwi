<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Security\ApiRoutePolicy;
use App\Security\AuthorizationContext;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\Routing\RouterInterface;

final class EntraAuthorizationTest extends WebTestCase
{
    use AuthenticatedClientTrait;

    public function testEveryApiRouteHasAnExplicitPolicy(): void
    {
        static::bootKernel();
        foreach (static::getContainer()->get(RouterInterface::class)->getRouteCollection() as $name => $route) {
            if (str_starts_with($route->getPath(), '/api/v1/')) {
                self::assertArrayHasKey($name, ApiRoutePolicy::ROUTES, $name);
            }
        }
    }

    public function testBusinessRolesDoNotRequireUnprovisionedMandantRoles(): void
    {
        foreach (['admin', 'supervisor', 'user', 'view'] as $role) {
            static::ensureKernelShutdown();
            $client = $this->createAuthenticatedClient(['bink8s.app.kiwi.'.$role]);
            $client->request('GET', '/api/v1/persons/state');
            self::assertResponseIsSuccessful();
        }
    }

    public function testDeveloperAloneCannotReadBusinessData(): void
    {
        $client = $this->createAuthenticatedClient(['bink8s.app.kiwi.dev']);
        $client->request('GET', '/api/v1/persons/state');
        self::assertResponseStatusCodeSame(403);
    }

    public function testReadRolesCannotSubmitWorkflowsEvenWithForgedBody(): void
    {
        foreach (['dev', 'view'] as $role) {
            static::ensureKernelShutdown();
            $client = $this->createAuthenticatedClient(['bink8s.app.kiwi.'.$role]);
            $client->request('POST', '/api/v1/workflows/subscription', server: ['CONTENT_TYPE' => 'application/json'],
                content: '{"roles":["bink8s.app.kiwi.admin"],"mandant":"AVROTROS"}');
            self::assertResponseStatusCodeSame(403);
            self::assertSame('forbidden', json_decode($client->getResponse()->getContent(), true)['error']['code']);
        }
    }

    public function testWriteRolesStillRequireCsrf(): void
    {
        foreach (['admin', 'supervisor', 'user'] as $role) {
            static::ensureKernelShutdown();
            $client = $this->createAuthenticatedClient(['bink8s.app.kiwi.'.$role]);
            $client->setServerParameter('HTTP_X_CSRF_TOKEN', '');
            $client->request('POST', '/api/v1/workflows/subscription', server: ['CONTENT_TYPE' => 'application/json'], content: '{}');
            self::assertResponseStatusCodeSame(403);
            self::assertSame('csrf_invalid', json_decode($client->getResponse()->getContent(), true)['error']['code']);
        }
    }

    public function testExpiredContextCannotBeExtendedByFreshAccessToken(): void
    {
        $client = $this->createClientWithSession([
            AuthorizationContext::SESSION_KEY => ['actor' => 'a', 'tenant' => 't', 'roles' => ['bink8s.app.kiwi.admin'], 'expiresAt' => time() - 1],
            'oidc_auth_token' => ['expires' => time() + 3600],
        ]);
        $client->request('GET', '/api/v1/me');
        self::assertResponseStatusCodeSame(401);
    }

    public function testLegacySessionProfileCannotGrantRoles(): void
    {
        $client = $this->createClientWithSession([
            'oidc_auth_profile' => ['roles' => ['bink8s.app.kiwi.admin']],
            'oidc_auth_token' => ['expires' => time() + 3600, 'roles' => ['bink8s.app.kiwi.admin']],
        ]);
        $client->request('GET', '/api/v1/me');
        self::assertResponseStatusCodeSame(401);
    }

    public function testBulkAndDebugRoutesCannotBeUsedByViewers(): void
    {
        $client = $this->createAuthenticatedClient(['bink8s.app.kiwi.view']);
        foreach ([['PUT', '/api/v1/persons/state'], ['POST', '/api/v1/debug/reset-poc-state']] as [$method, $url]) {
            $client->request($method, $url, server: ['CONTENT_TYPE' => 'application/json'], content: '{}');
            self::assertResponseStatusCodeSame(403);
        }
    }
    public function testAllBusinessWriteRoutesDenyViewerBeforeControllerExecution(): void
    {
        $client = $this->createAuthenticatedClient(['bink8s.app.kiwi.view']);
        $routes = static::getContainer()->get(RouterInterface::class)->getRouteCollection();
        foreach ($routes as $name => $route) {
            if (!in_array(ApiRoutePolicy::ROUTES[$name] ?? null, ['kiwi.write', 'kiwi.local.write'], true)) {
                continue;
            }
            $url = preg_replace('/\{[^}]+\}/', '1', $route->getPath());
            $client->request($route->getMethods()[0], $url, server: ['CONTENT_TYPE' => 'application/json'], content: '{}');
            self::assertResponseStatusCodeSame(403, $name);
        }
    }

    public function testCrossOriginRequestIsDeniedEvenWithValidCsrf(): void
    {
        $client = $this->createAuthenticatedClient();
        $client->request('POST', '/api/v1/workflows/subscription', server: [
            'CONTENT_TYPE' => 'application/json', 'HTTP_ORIGIN' => 'https://other.invalid',
        ], content: '{}');
        self::assertResponseStatusCodeSame(403);
        self::assertSame('origin_forbidden', json_decode($client->getResponse()->getContent(), true)['error']['code']);
    }

    public function testDirectServiceCallCannotBypassViewerRestriction(): void
    {
        $client = $this->createAuthenticatedClient(['bink8s.app.kiwi.view']);
        $session = static::getContainer()->get('session.factory')->createSession();
        $session->set(AuthorizationContext::SESSION_KEY, [
            'actor' => 'viewer', 'tenant' => 'tenant', 'roles' => ['bink8s.app.kiwi.view'], 'expiresAt' => time() + 60,
        ]);
        $before = $session->all();
        try {
            static::getContainer()->get(\App\Service\PocStateService::class)->createCustomer($session, ['roles' => ['bink8s.app.kiwi.admin']]);
            self::fail('Viewer mutation must be rejected');
        } catch (\App\Http\ApiProblemException $exception) {
            self::assertSame(403, $exception->getStatus());
            self::assertSame($before, $session->all());
        }
    }

}
