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

    public function testCustomerMutationSchemasAreExplicitAndDocumentTheirGate(): void
    {
        $client = $this->createAuthenticatedClient(['bink8s.app.kiwi.user']);
        $client->request('GET', '/api/v1/swagger.json');
        self::assertResponseIsSuccessful();
        $document = json_decode($client->getResponse()->getContent(), true);
        self::assertSame('/', $document['servers'][0]['url']);
        $operation = $document['paths']['/api/v1/persons/{personId}/bank-accounts/{resourceId}']['patch'];
        self::assertSame('kiwi.write', $operation['x-kiwi-policy']);
        self::assertArrayHasKey('409', $operation['responses']);
        self::assertArrayHasKey('503', $operation['responses']);
        $schema = $operation['requestBody']['content']['application/json']['schema'];
        self::assertFalse($schema['additionalProperties']);
        self::assertSame(['iban', 'bic'], array_keys($schema['properties']['changes']['properties']));
        self::assertFalse($schema['properties']['changes']['additionalProperties']);
    }
}
