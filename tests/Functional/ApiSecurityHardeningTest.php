<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\Routing\Route;
use Symfony\Component\Routing\RouterInterface;

final class ApiSecurityHardeningTest extends WebTestCase
{
    use AuthenticatedClientTrait;

    public function testEveryApiV1RouteRejectsUnauthenticatedRequests(): void
    {
        $client = static::createClient();

        /** @var RouterInterface $router */
        $router = static::getContainer()->get(RouterInterface::class);
        $failures = [];

        foreach ($router->getRouteCollection() as $routeName => $route) {
            $path = $route->getPath();
            if (!str_starts_with($path, '/api/v1')) {
                continue;
            }

            foreach ($this->resolveRouteMethods($route) as $method) {
                $client->request(
                    $method,
                    $this->fillRoutePath($path),
                    server: $this->buildRequestServer($method),
                    content: $this->buildRequestContent($method),
                );

                $statusCode = $client->getResponse()->getStatusCode();
                $payload = json_decode((string) $client->getResponse()->getContent(), true);
                $errorCode = \is_array($payload) ? ($payload['error']['code'] ?? null) : null;

                if (401 === $statusCode && 'unauthorized' === $errorCode) {
                    continue;
                }

                $failures[] = sprintf(
                    '%s %s (%s) returned %d with error code %s',
                    $method,
                    $this->fillRoutePath($path),
                    $routeName,
                    $statusCode,
                    json_encode($errorCode),
                );
            }
        }

        self::assertSame([], $failures, implode("\n", $failures));
    }

    public function testApiStatusRejectsAuthenticatedUsersWithoutAnAllowedKiwiRole(): void
    {
        $client = $this->createAuthenticatedClient(['example.unrelated.role']);

        $client->request('GET', '/api/v1/status');

        self::assertResponseStatusCodeSame(403);
        $payload = json_decode((string) $client->getResponse()->getContent(), true, flags: \JSON_THROW_ON_ERROR);
        self::assertSame('forbidden', $payload['error']['code']);
    }

    public function testSwaggerMarksApiStatusAsProtected(): void
    {
        $client = $this->createAuthenticatedClient();

        $client->request('GET', '/api/v1/swagger.json');

        self::assertResponseIsSuccessful();
        $payload = json_decode((string) $client->getResponse()->getContent(), true, flags: \JSON_THROW_ON_ERROR);
        $statusOperation = $payload['paths']['/api/v1/status']['get'] ?? null;

        self::assertIsArray($statusOperation);
        self::assertSame([['cookieAuth' => []]], $statusOperation['security'] ?? null);
        self::assertArrayHasKey('401', $statusOperation['responses'] ?? []);
        self::assertArrayHasKey('403', $statusOperation['responses'] ?? []);
    }

    /**
     * @return list<string>
     */
    private function resolveRouteMethods(Route $route): array
    {
        $methods = $route->getMethods();
        if ([] === $methods) {
            return ['GET'];
        }

        return array_values(array_filter(
            $methods,
            static fn (string $method): bool => !\in_array($method, ['HEAD', 'OPTIONS'], true),
        ));
    }

    private function fillRoutePath(string $path): string
    {
        return (string) preg_replace_callback('/\{([^}]+)\}/', function (array $matches): string {
            return match ($matches[1]) {
                'articleId', 'customerId', 'subscriptionId', 'orderId' => '1',
                'salesCode' => 'AVRV519',
                default => '1',
            };
        }, $path);
    }

    /**
     * @return array<string, string>
     */
    private function buildRequestServer(string $method): array
    {
        if (\in_array($method, ['POST', 'PUT', 'PATCH'], true)) {
            return ['CONTENT_TYPE' => 'application/json'];
        }

        return [];
    }

    private function buildRequestContent(string $method): ?string
    {
        if (\in_array($method, ['POST', 'PUT', 'PATCH'], true)) {
            return '{}';
        }

        return null;
    }
}
