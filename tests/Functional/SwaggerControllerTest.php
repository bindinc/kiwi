<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class SwaggerControllerTest extends WebTestCase
{
    use AuthenticatedClientTrait;

    public function testSwaggerUiUsesLocalVendorAssets(): void
    {
        $client = $this->createAuthenticatedClient(['bink8s.app.kiwi.user']);

        $client->request('GET', '/api/v1/swagger');

        self::assertResponseIsSuccessful();
        $content = (string) $client->getResponse()->getContent();
        self::assertStringContainsString('/vendor/swagger-ui-dist/swagger-ui.css', $content);
        self::assertStringContainsString('/vendor/swagger-ui-dist/swagger-ui-bundle.js', $content);
        self::assertStringContainsString('/vendor/swagger-ui-dist/swagger-ui-standalone-preset.js', $content);
        self::assertStringContainsString('StandaloneLayout', $content);
        self::assertStringNotContainsString('unpkg.com', $content);
    }
}
