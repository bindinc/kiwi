<?php

declare(strict_types=1);

namespace App\Config;

use App\Oidc\OidcClient;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

final class ClientSecretsLoader
{
    /**
     * @var array<string, mixed>|null
     */
    private ?array $config = null;

    public function __construct(
        #[Autowire('%kernel.project_dir%')]
        private readonly string $projectDir,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getSection(string $section): array
    {
        $config = $this->load();
        $value = $config[$section] ?? [];

        return \is_array($value) ? $value : [];
    }

    public function getResolvedPath(): string
    {
        foreach ($this->candidatePaths() as $candidatePath) {
            if (\is_string($candidatePath) && '' !== $candidatePath && is_file($candidatePath)) {
                return $candidatePath;
            }
        }

        return $this->projectDir.'/client_secrets.example.json';
    }

    /**
     * @return array<string, mixed>
     */
    private function load(): array
    {
        if (null !== $this->config) {
            return $this->config;
        }

        $path = $this->getResolvedPath();
        $raw = file_get_contents($path);
        if (false === $raw) {
            $this->config = [];

            return $this->config;
        }

        $decoded = json_decode($raw, true);
        if (!\is_array($decoded)) {
            $this->config = [];

            return $this->config;
        }

        $this->config = $decoded;

        return $this->config;
    }

    /**
     * @return list<string>
     */
    private function candidatePaths(): array
    {
        $configuredPath = trim((string) (getenv('KIWI_CLIENT_SECRETS_PATH') ?: ''));
        $oidcConfiguredPath = trim((string) (getenv('OIDC_CLIENT_SECRETS') ?: ''));

        return array_values(array_filter([
            $configuredPath,
            $oidcConfiguredPath,
            OidcClient::DEFAULT_CLIENT_SECRETS_PATH,
            $this->projectDir.'/client_secrets.json',
            $this->projectDir.'/client_secrets.example.json',
        ]));
    }
}
