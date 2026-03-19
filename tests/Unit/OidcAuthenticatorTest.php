<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Oidc\OidcClient;
use App\Security\OidcAuthenticator;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;

final class OidcAuthenticatorTest extends TestCase
{
    public function testStartUsesRelativeRequestUriForNextTarget(): void
    {
        $request = Request::create('https://example.org/api/v1/swagger.json?foo=bar');

        $urlGenerator = $this->createMock(UrlGeneratorInterface::class);
        $urlGenerator->expects(self::once())
            ->method('generate')
            ->with('app_login', ['next' => '/api/v1/swagger.json?foo=bar'])
            ->willReturn('/login?next=/api/v1/swagger.json?foo=bar');

        $authenticator = new OidcAuthenticator(
            $this->createMock(OidcClient::class),
            $urlGenerator,
        );

        $response = $authenticator->start($request);

        self::assertSame('/login?next=/api/v1/swagger.json?foo=bar', $response->headers->get('Location'));
    }
}
