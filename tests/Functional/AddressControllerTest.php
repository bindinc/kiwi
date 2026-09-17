<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class AddressControllerTest extends WebTestCase
{
    use AuthenticatedClientTrait;

    public function testAnonymousCannotSearch(): void
    {
        $client = static::createClient();
        $client->jsonRequest('POST', '/api/v1/addresses/search', []);
        self::assertResponseStatusCodeSame(401);
    }

    public function testUnauthorizedRoleCannotSearch(): void
    {
        $client = $this->createAuthenticatedClient([]);
        $client->jsonRequest('POST', '/api/v1/addresses/search', []);
        self::assertResponseStatusCodeSame(403);
    }

    public function testInvalidInputIsRejectedBeforeProviderCall(): void
    {
        $client = $this->createAuthenticatedClient();
        $client->jsonRequest('POST', '/api/v1/addresses/search', ['formSessionId' => 'invalid']);
        self::assertResponseStatusCodeSame(400);
        $client->jsonRequest('POST', '/api/v1/addresses/search', [
            'formSessionId' => 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'postalCode' => ['1231AA'], 'houseNumber' => '1',
        ]);
        self::assertResponseStatusCodeSame(400);
    }

    public function testCloseIsIdempotentAndPreventsLateSearch(): void
    {
        $client = $this->createAuthenticatedClient();
        $id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
        $client->request('DELETE', '/api/v1/addresses/sessions/'.$id);
        self::assertResponseStatusCodeSame(204);
        $client->request('DELETE', '/api/v1/addresses/sessions/'.$id);
        self::assertResponseStatusCodeSame(204);
        $client->jsonRequest('POST', '/api/v1/addresses/search', ['formSessionId' => $id, 'postalCode' => '1231AA', 'houseNumber' => '1']);
        self::assertResponseStatusCodeSame(409);
    }
}
