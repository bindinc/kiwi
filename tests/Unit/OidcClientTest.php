<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Oidc\OidcClient;
use Firebase\JWT\JWT;
use PHPUnit\Framework\Attributes\After;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class OidcClientTest extends TestCase
{
    private ?string $previousClientSecrets = null;

    /**
     * @var string[]
     */
    private array $temporaryConfigFiles = [];

    private function createClient(): OidcClient
    {
        return new OidcClient(new MockHttpClient(), dirname(__DIR__, 2));
    }

    public function testBuildRedirectUriUsesCurrentBasePath(): void
    {
        $client = $this->createClient();
        $request = Request::create('https://example.org/login');

        self::assertSame('https://example.org/auth/callback', $client->buildRedirectUri($request));
    }

    public function testBuildAuthorizationScopeUsesSpaces(): void
    {
        $client = $this->createClient();

        self::assertSame('openid email profile', $client->getAuthorizationScope());
    }

    public function testBuildUserIdentity(): void
    {
        $client = $this->createClient();
        $identity = $client->buildUserIdentity([
            'given_name' => 'Jan',
            'family_name' => 'Vos',
            'email' => 'jan@example.org',
        ]);

        self::assertSame('Jan', $identity['first_name']);
        self::assertSame('Vos', $identity['last_name']);
        self::assertSame('Jan Vos', $identity['full_name']);
        self::assertSame('JV', $identity['initials']);
        self::assertSame('jan@example.org', $identity['email']);
    }

    public function testGetUserRolesPrefersIdTokenClaims(): void
    {
        $client = $this->createClient();
        $token = $this->makeJwt(['roles' => ['bink8s.app.kiwi.user']]);

        self::assertSame(['bink8s.app.kiwi.user'], $client->getUserRoles([
            'oidc_auth_token' => ['id_token' => $token],
        ]));
    }

    public function testBuildEndSessionLogoutUrl(): void
    {
        $client = $this->createClient();
        $logoutUrl = $client->buildEndSessionLogoutUrl(
            'https://issuer.example/logout',
            'https://app.example/logged-out',
            'id-token',
            'kiwi-client',
        );

        self::assertStringContainsString('post_logout_redirect_uri=https%3A%2F%2Fapp.example%2Flogged-out', $logoutUrl);
        self::assertStringContainsString('id_token_hint=id-token', $logoutUrl);
        self::assertStringContainsString('client_id=kiwi-client', $logoutUrl);
    }

    public function testValidateIdTokenAcceptsSignedTokenWithExpectedClaims(): void
    {
        [$privateKey, $jwks] = $this->createSigningMaterial('test-key');
        $issuer = 'https://issuer.example';
        $nonce = 'expected-nonce';
        $client = $this->createConfiguredClient(
            [
                new MockResponse((string) json_encode([
                    'issuer' => $issuer,
                    'jwks_uri' => 'https://issuer.example/.well-known/jwks.json',
                ], JSON_THROW_ON_ERROR)),
                new MockResponse((string) json_encode($jwks, JSON_THROW_ON_ERROR)),
            ],
            [
                'client_id' => 'kiwi-client',
                'issuer' => 'http://internal-issuer',
            ],
        );

        $token = JWT::encode([
            'iss' => $issuer,
            'aud' => 'kiwi-client',
            'nonce' => $nonce,
            'exp' => time() + 300,
        ], $privateKey, 'RS256', 'test-key');

        $client->validateIdToken([
            'oidc_auth_token' => [
                'id_token' => $token,
            ],
        ], $nonce);

        self::assertTrue(true);
    }

    public function testValidateIdTokenRejectsInvalidSignature(): void
    {
        [$validPrivateKey, $validJwks] = $this->createSigningMaterial('valid-key');
        [$invalidPrivateKey] = $this->createSigningMaterial('invalid-key');
        $issuer = 'https://issuer.example';
        $nonce = 'expected-nonce';
        $client = $this->createConfiguredClient(
            [
                new MockResponse((string) json_encode([
                    'issuer' => $issuer,
                    'jwks_uri' => 'https://issuer.example/.well-known/jwks.json',
                ], JSON_THROW_ON_ERROR)),
                new MockResponse((string) json_encode($validJwks, JSON_THROW_ON_ERROR)),
            ],
            [
                'client_id' => 'kiwi-client',
                'issuer' => 'http://internal-issuer',
            ],
        );

        $token = JWT::encode([
            'iss' => $issuer,
            'aud' => 'kiwi-client',
            'nonce' => $nonce,
            'exp' => time() + 300,
        ], $invalidPrivateKey, 'RS256', 'invalid-key');

        $this->expectException(\UnexpectedValueException::class);

        $client->validateIdToken([
            'oidc_auth_token' => [
                'id_token' => $token,
            ],
        ], $nonce);
    }

    #[After]
    public function restoreClientSecretsEnvironment(): void
    {
        foreach ($this->temporaryConfigFiles as $temporaryConfigFile) {
            if (is_file($temporaryConfigFile)) {
                unlink($temporaryConfigFile);
            }
        }
        $this->temporaryConfigFiles = [];

        if (null === $this->previousClientSecrets) {
            putenv('OIDC_CLIENT_SECRETS');

            return;
        }

        putenv('OIDC_CLIENT_SECRETS='.$this->previousClientSecrets);
    }

    /**
     * @param MockResponse[] $responses
     * @param array<string, mixed> $webConfig
     */
    private function createConfiguredClient(array $responses, array $webConfig): OidcClient
    {
        $configFile = tempnam(sys_get_temp_dir(), 'kiwi-oidc');
        if (false === $configFile) {
            throw new \RuntimeException('Unable to create a temporary OIDC config file.');
        }

        file_put_contents($configFile, (string) json_encode(['web' => $webConfig], JSON_THROW_ON_ERROR));
        $this->temporaryConfigFiles[] = $configFile;
        $this->previousClientSecrets = getenv('OIDC_CLIENT_SECRETS') ?: null;
        putenv('OIDC_CLIENT_SECRETS='.$configFile);

        return new OidcClient(new MockHttpClient($responses), dirname(__DIR__, 2));
    }

    /**
     * @return array{0: string, 1: array<string, array<int, array<string, string>>>}
     */
    private function createSigningMaterial(string $kid): array
    {
        $key = openssl_pkey_new([
            'private_key_bits' => 2048,
            'private_key_type' => \OPENSSL_KEYTYPE_RSA,
        ]);
        if (false === $key) {
            throw new \RuntimeException('Unable to generate an RSA key pair.');
        }

        openssl_pkey_export($key, $privateKey);
        $details = openssl_pkey_get_details($key);
        if (!\is_array($details) || !isset($details['rsa']['n'], $details['rsa']['e'])) {
            throw new \RuntimeException('Unable to extract RSA key details.');
        }

        return [
            $privateKey,
            [
                'keys' => [[
                    'kty' => 'RSA',
                    'use' => 'sig',
                    'alg' => 'RS256',
                    'kid' => $kid,
                    'n' => $this->base64UrlEncode($details['rsa']['n']),
                    'e' => $this->base64UrlEncode($details['rsa']['e']),
                ]],
            ],
        ];
    }

    private function base64UrlEncode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private function makeJwt(array $payload): string
    {
        $header = ['alg' => 'none', 'typ' => 'JWT'];
        $encode = static function (array $value): string {
            return rtrim(strtr(base64_encode((string) json_encode($value, JSON_THROW_ON_ERROR)), '+/', '-_'), '=');
        };

        return sprintf('%s.%s.', $encode($header), $encode($payload));
    }
}
