<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Oidc\OidcClient;
use Firebase\JWT\JWT;
use League\OAuth2\Client\Token\AccessToken;
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

    public function testBuildAuthorizationScopeKeepsPresenceScopesOutByDefault(): void
    {
        $client = $this->createClient();
        $secretsFile = $this->createTemporarySecretsFile();

        try {
            $scope = $this->withEnvironment([
                'OIDC_CLIENT_SECRETS' => $secretsFile,
                'OIDC_SCOPES' => null,
                'TEAMS_PRESENCE_SYNC_ENABLED' => null,
            ], static fn () => $client->getAuthorizationScope());
        } finally {
            @unlink($secretsFile);
        }

        self::assertSame('openid email profile User.Read', $scope);
    }

    public function testBuildAuthorizationScopeAddsPresenceScopesOnlyWhenEnabled(): void
    {
        $client = $this->createClient();
        $secretsFile = $this->createTemporarySecretsFile();

        try {
            $scope = $this->withEnvironment([
                'OIDC_CLIENT_SECRETS' => $secretsFile,
                'OIDC_SCOPES' => null,
                'TEAMS_PRESENCE_SYNC_ENABLED' => 'true',
            ], static fn () => $client->getAuthorizationScope());
        } finally {
            @unlink($secretsFile);
        }

        self::assertSame('openid email profile User.Read Presence.Read Presence.ReadWrite', $scope);
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
            'oidc_auth_token' => [
                'id_token' => $token,
                'expires' => time() + 60,
            ],
        ]));
    }

    public function testExpiredSessionTokenIsRejected(): void
    {
        $client = $this->createClient();
        $sessionData = [
            'oidc_auth_token' => [
                'access_token' => 'expired-access-token',
                'id_token' => $this->makeJwt(['roles' => ['bink8s.app.kiwi.user']]),
                'expires' => time() - 60,
            ],
        ];

        self::assertFalse($client->hasFreshSessionToken($sessionData));
        self::assertSame([], $client->getUserRoles($sessionData));
        self::assertNull($client->getAccessToken($sessionData));
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

    public function testValidateIdTokenAcceptsMicrosoftTenantPlaceholderIssuer(): void
    {
        [$privateKey, $jwks] = $this->createSigningMaterial('tenant-key');
        $tokenIssuer = 'https://login.microsoftonline.com/0c9debd2-7a4b-4383-9608-99e5238f646c/v2.0';
        $nonce = 'expected-nonce';
        $client = $this->createConfiguredClient(
            [
                new MockResponse((string) json_encode([
                    'issuer' => 'https://login.microsoftonline.com/{tenantid}/v2.0',
                    'jwks_uri' => 'https://login.microsoftonline.com/common/discovery/v2.0/keys',
                ], JSON_THROW_ON_ERROR)),
                new MockResponse((string) json_encode($jwks, JSON_THROW_ON_ERROR)),
            ],
            [
                'client_id' => 'kiwi-client',
                'issuer' => 'https://login.microsoftonline.com/common/v2.0',
            ],
        );

        $token = JWT::encode([
            'iss' => $tokenIssuer,
            'aud' => 'kiwi-client',
            'nonce' => $nonce,
            'exp' => time() + 300,
        ], $privateKey, 'RS256', 'tenant-key');

        $client->validateIdToken([
            'oidc_auth_token' => [
                'id_token' => $token,
            ],
        ], $nonce);

        self::assertTrue(true);
    }

    public function testValidateIdTokenAcceptsJwksWithoutAlgWhenTokenHeaderProvidesIt(): void
    {
        [$privateKey, $jwks] = $this->createSigningMaterial('alg-less-key');
        unset($jwks['keys'][0]['alg']);

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
                'issuer' => $issuer,
            ],
        );

        $token = JWT::encode([
            'iss' => $issuer,
            'aud' => 'kiwi-client',
            'nonce' => $nonce,
            'exp' => time() + 300,
        ], $privateKey, 'RS256', 'alg-less-key');

        $client->validateIdToken([
            'oidc_auth_token' => [
                'id_token' => $token,
            ],
        ], $nonce);

        self::assertTrue(true);
    }

    public function testValidateIdTokenRejectsAlgorithmOutsideMetadataAllowlist(): void
    {
        [, $jwks] = $this->createSigningMaterial('alg-less-key');
        unset($jwks['keys'][0]['alg']);

        $issuer = 'https://issuer.example';
        $nonce = 'expected-nonce';
        $client = $this->createConfiguredClient(
            [
                new MockResponse((string) json_encode([
                    'issuer' => $issuer,
                    'jwks_uri' => 'https://issuer.example/.well-known/jwks.json',
                    'id_token_signing_alg_values_supported' => ['RS256'],
                ], JSON_THROW_ON_ERROR)),
                new MockResponse((string) json_encode($jwks, JSON_THROW_ON_ERROR)),
            ],
            [
                'client_id' => 'kiwi-client',
                'issuer' => $issuer,
            ],
        );

        $token = JWT::encode([
            'iss' => $issuer,
            'aud' => 'kiwi-client',
            'nonce' => $nonce,
            'exp' => time() + 300,
        ], 'shared-secret', 'HS256', 'alg-less-key');

        $this->expectException(\UnexpectedValueException::class);
        $this->expectExceptionMessage('Unsupported OIDC signing algorithm.');

        $client->validateIdToken([
            'oidc_auth_token' => [
                'id_token' => $token,
            ],
        ], $nonce);
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

    public function testNormalizeTokenDataOmitsRefreshToken(): void
    {
        $client = $this->createClient();
        $expires = time() + 3600;
        $token = new AccessToken([
            'access_token' => 'access-token',
            'refresh_token' => 'refresh-token',
            'expires' => $expires,
            'id_token' => 'id-token',
            'scope' => 'openid email profile',
            'token_type' => 'Bearer',
            'roles' => ['bink8s.app.kiwi.user'],
        ]);

        $normalized = $client->normalizeTokenData($token);

        self::assertArrayNotHasKey('refresh_token', $normalized);
        self::assertSame('access-token', $normalized['access_token']);
        self::assertSame($expires, $normalized['expires']);
        self::assertSame('id-token', $normalized['id_token']);
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

    /**
     * @param array<string, string|null> $values
     * @return mixed
     */
    private function withEnvironment(array $values, callable $callback): mixed
    {
        $previousValues = [];
        foreach ($values as $name => $value) {
            $previousValues[$name] = getenv($name);
            if (null === $value) {
                putenv($name);
            } else {
                putenv(sprintf('%s=%s', $name, $value));
            }
        }

        try {
            return $callback();
        } finally {
            foreach ($previousValues as $name => $value) {
                if (false === $value) {
                    putenv($name);
                    continue;
                }

                putenv(sprintf('%s=%s', $name, $value));
            }
        }
    }

    private function createTemporarySecretsFile(): string
    {
        $path = tempnam(sys_get_temp_dir(), 'kiwi-');
        if (false === $path) {
            throw new \RuntimeException('Unable to create a temporary secrets file.');
        }

        $payload = json_encode([
            'web' => [
                'client_id' => 'kiwi-client',
                'client_secret' => 'kiwi-secret',
                'auth_uri' => 'https://issuer.example/auth',
                'token_uri' => 'https://issuer.example/token',
                'userinfo_uri' => 'https://issuer.example/userinfo',
                'issuer' => 'https://issuer.example',
                'redirect_uris' => ['https://example.org/auth/callback'],
            ],
        ], JSON_THROW_ON_ERROR);

        if (false === file_put_contents($path, $payload)) {
            throw new \RuntimeException(sprintf('Unable to write the temporary secrets file "%s".', $path));
        }

        return $path;
    }
}
