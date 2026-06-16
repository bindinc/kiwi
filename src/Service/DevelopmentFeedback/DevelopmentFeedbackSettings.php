<?php

declare(strict_types=1);

namespace App\Service\DevelopmentFeedback;

use Symfony\Component\HttpFoundation\Request;

final class DevelopmentFeedbackSettings
{
    private const DEFAULT_ALLOWED_ROLES = ['admin', 'dev', 'supervisor'];
    private const DEFAULT_IMAGE_TTL_DAYS = 30;
    private const DEFAULT_MAX_IMAGE_BYTES = 3145728;

    public function __construct(
        private readonly ?DevelopmentFeedbackConfigurationStore $configurationStore = null,
    ) {
    }

    public function isEnabled(): bool
    {
        $configuration = $this->readConfiguration();
        if (null !== $configuration) {
            return $configuration->isFeedbackEnabled();
        }

        return \in_array(strtolower(trim((string) (getenv('CONTEXTUAL_FEEDBACK_ENABLED') ?: '0'))), ['1', 'true', 'yes', 'on'], true);
    }

    /**
     * @param string[] $roles
     */
    public function isAllowedForRoles(array $roles): bool
    {
        $allowed = $this->getAllowedRoleAliases();

        foreach ($roles as $role) {
            $normalizedRole = $this->normalizeRoleAlias($role);
            if (\in_array($normalizedRole, $allowed, true) || \in_array($role, $allowed, true)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return string[]
     */
    public function getAllowedRoleAliases(): array
    {
        $rawValue = trim((string) (getenv('CONTEXTUAL_FEEDBACK_ALLOWED_ROLES') ?: ''));
        if ('' === $rawValue) {
            return self::DEFAULT_ALLOWED_ROLES;
        }

        $roles = [];
        foreach (explode(',', $rawValue) as $role) {
            $role = $this->normalizeRoleAlias($role);
            if ('' !== $role) {
                $roles[] = $role;
            }
        }

        return [] === $roles ? self::DEFAULT_ALLOWED_ROLES : array_values(array_unique($roles));
    }

    public function getWebhookUrl(): ?string
    {
        $configuration = $this->readConfiguration();
        $configuredWebhookUrl = $configuration?->getWebhookUrl();
        if (null !== $configuredWebhookUrl) {
            return $configuredWebhookUrl;
        }

        $url = trim((string) (getenv('CONTEXTUAL_FEEDBACK_WEBHOOK_URL') ?: ''));

        return '' === $url ? null : $url;
    }

    public function getPublicBaseUrl(Request $request): string
    {
        $configuration = $this->readConfiguration();
        $configuredBaseUrl = $configuration?->getPublicBaseUrl();
        if (null !== $configuredBaseUrl) {
            return rtrim($configuredBaseUrl, '/');
        }

        $configuredUrl = trim((string) (getenv('CONTEXTUAL_FEEDBACK_PUBLIC_BASE_URL') ?: ''));
        if ('' !== $configuredUrl) {
            return rtrim($configuredUrl, '/');
        }

        $basePath = rtrim($request->getBasePath(), '/');

        return rtrim($request->getSchemeAndHttpHost().$basePath, '/');
    }

    public function getImageTtlDays(): int
    {
        $configuration = $this->readConfiguration();
        if (null !== $configuration) {
            return max(1, min(365, $configuration->getImageTtlDays()));
        }

        $value = (int) (getenv('CONTEXTUAL_FEEDBACK_IMAGE_TTL_DAYS') ?: self::DEFAULT_IMAGE_TTL_DAYS);

        return max(1, min(365, $value));
    }

    public function getMaxImageBytes(): int
    {
        $configuration = $this->readConfiguration();
        if (null !== $configuration) {
            return max(1, $configuration->getMaxImageBytes());
        }

        $value = (int) (getenv('CONTEXTUAL_FEEDBACK_MAX_IMAGE_BYTES') ?: self::DEFAULT_MAX_IMAGE_BYTES);

        return max(1, $value);
    }

    /**
     * @param string[] $roles
     */
    public function canManageSettings(array $roles): bool
    {
        foreach ($roles as $role) {
            $alias = $this->normalizeRoleAlias($role);
            if (\in_array($alias, ['admin', 'supervisor'], true)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array<string, mixed>
     */
    public function describeSettings(Request $request): array
    {
        $configuration = $this->readConfiguration();
        $webhookUrl = $this->getWebhookUrl();

        return [
            'feedbackEnabled' => $this->isEnabled(),
            'allowedRoles' => $this->getAllowedRoleAliases(),
            'teamsWebhookConfigured' => null !== $webhookUrl,
            'teamsWebhookSource' => null !== $configuration?->getWebhookUrl() ? 'database' : (null !== $webhookUrl ? 'environment' : 'none'),
            'publicBaseUrl' => $this->getPublicBaseUrl($request),
            'imageTtlDays' => $this->getImageTtlDays(),
            'maxImageBytes' => $this->getMaxImageBytes(),
            'updatedAt' => $configuration?->getUpdatedAt()->format(\DateTimeInterface::ATOM),
        ];
    }

    public function detectEnvironment(Request $request): string
    {
        $host = strtolower($request->getHost());
        $basePath = strtolower($request->getBasePath());
        $path = strtolower($request->getPathInfo());

        if (str_contains($host, '.local') || \in_array($host, ['localhost', '127.0.0.1'], true)) {
            return 'local';
        }

        if (str_contains($basePath, 'preview') || str_contains($path, 'preview')) {
            return 'preview';
        }

        return 'production';
    }

    public function detectTrack(Request $request): string
    {
        $basePath = strtolower($request->getBasePath());
        $path = strtolower($request->getPathInfo());

        if (str_contains($basePath, 'kiwi-preview') || str_contains($path, 'kiwi-preview')) {
            return 'preview';
        }

        if (str_contains($basePath, 'kiwi') || str_contains($path, 'kiwi')) {
            return 'active';
        }

        return 'unknown';
    }

    private function normalizeRoleAlias(string $role): string
    {
        $role = strtolower(trim($role));
        $parts = explode('.', $role);

        return (string) end($parts);
    }

    private function readConfiguration(): ?\App\Entity\DevelopmentFeedbackConfiguration
    {
        if (null === $this->configurationStore) {
            return null;
        }

        try {
            return $this->configurationStore->getConfiguration();
        } catch (\Throwable) {
            return null;
        }
    }
}
