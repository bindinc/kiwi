<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Config\ClientSecretsLoader;
use App\Webabo\HupApiConfigProvider;
use PHPUnit\Framework\TestCase;

final class HupApiConfigProviderTest extends TestCase
{
    private ?string $tempDir = null;

    protected function tearDown(): void
    {
        if (null !== $this->tempDir && is_dir($this->tempDir)) {
            array_map('unlink', glob($this->tempDir.'/*') ?: []);
            rmdir($this->tempDir);
        }

        parent::tearDown();
    }

    public function testNamedCredentialsExposeMandantAndLookupMetadata(): void
    {
        $provider = new HupApiConfigProvider(new ClientSecretsLoader(dirname($this->writeClientSecretsFile())));
        $config = $provider->getConfig();
        $credential = $config->getCredential('avrotros');

        self::assertSame('AVROTROS', $credential->title);
        self::assertSame('AVROTROS', $credential->mandant);
        self::assertSame('14', $credential->divisionId);
        self::assertTrue($credential->supportsPersonLookup);
        self::assertSame([
            'credentialKey' => 'avrotros',
            'credentialTitle' => 'AVROTROS',
            'mandant' => 'AVROTROS',
            'divisionId' => '14',
            'supportsPersonLookup' => true,
            'sourceSystem' => 'webabo-api',
        ], $config->getCredentialContext('avrotros', 'webabo-api'));
    }

    private function writeClientSecretsFile(): string
    {
        $this->tempDir = sys_get_temp_dir().'/kiwi-hup-config-'.bin2hex(random_bytes(4));
        mkdir($this->tempDir, 0777, true);

        $path = $this->tempDir.'/client_secrets.json';
        $payload = [
            'hup' => [
                'hup_oidc_auth' => 'https://example.invalid/auth',
                'hup_oidc_token' => 'https://example.invalid/token',
                'webabo_base_url' => 'https://example.invalid/webabo-rest',
                'credentials' => [
                    'avrotros' => [
                        'title' => 'AVROTROS',
                        'client' => 'AVROTROS',
                        'divisionid' => '14',
                        'client_search' => 'yes',
                        'username' => 'demo-user',
                        'password' => 'demo-password',
                    ],
                ],
            ],
        ];

        file_put_contents($path, (string) json_encode($payload, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));

        return $path;
    }
}
