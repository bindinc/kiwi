<?php

declare(strict_types=1);

namespace App\Service\DevelopmentFeedback;

use App\Entity\DevelopmentFeedbackConfiguration;
use App\Http\ApiProblemException;
use Doctrine\ORM\EntityManagerInterface;

final class DevelopmentFeedbackConfigurationStore
{
    public function __construct(
        private readonly DevelopmentFeedbackSchemaManager $schemaManager,
        private readonly EntityManagerInterface $entityManager,
    ) {
    }

    public function getConfiguration(): DevelopmentFeedbackConfiguration
    {
        $this->ensureSchema();

        $configuration = $this->entityManager->find(DevelopmentFeedbackConfiguration::class, 1);
        if ($configuration instanceof DevelopmentFeedbackConfiguration) {
            return $configuration;
        }

        $configuration = new DevelopmentFeedbackConfiguration();
        $this->seedFromEnvironment($configuration);
        $this->entityManager->persist($configuration);
        $this->entityManager->flush();

        return $configuration;
    }

    /**
     * @param array<string, mixed> $payload
     */
    public function updateConfiguration(array $payload): DevelopmentFeedbackConfiguration
    {
        $configuration = $this->getConfiguration();

        if (\array_key_exists('feedbackEnabled', $payload)) {
            if (!\is_bool($payload['feedbackEnabled'])) {
                throw new ApiProblemException(400, 'invalid_payload', 'feedbackEnabled must be a boolean');
            }
            $configuration->setFeedbackEnabled($payload['feedbackEnabled']);
        }

        if (\array_key_exists('webhookUrl', $payload)) {
            $configuration->setWebhookUrl($this->normalizeOptionalUrl($payload['webhookUrl'], 'webhookUrl'));
        }

        if (($payload['clearWebhookUrl'] ?? false) === true) {
            $configuration->setWebhookUrl(null);
        }

        if (\array_key_exists('publicBaseUrl', $payload)) {
            $configuration->setPublicBaseUrl($this->normalizeOptionalUrl($payload['publicBaseUrl'], 'publicBaseUrl'));
        }

        if (\array_key_exists('imageTtlDays', $payload)) {
            $configuration->setImageTtlDays($this->normalizeInt($payload['imageTtlDays'], 'imageTtlDays', 1, 365));
        }

        if (\array_key_exists('maxImageBytes', $payload)) {
            $configuration->setMaxImageBytes($this->normalizeInt($payload['maxImageBytes'], 'maxImageBytes', 1, 10485760));
        }

        $this->entityManager->flush();

        return $configuration;
    }

    private function ensureSchema(): void
    {
        try {
            $this->schemaManager->ensureSchema();
        } catch (\Throwable $exception) {
            throw new ApiProblemException(503, 'feedback_settings_unavailable', 'Feedback settings are unavailable', [
                'reason' => $exception->getMessage(),
            ]);
        }
    }

    private function normalizeOptionalUrl(mixed $value, string $field): ?string
    {
        if (null === $value) {
            return null;
        }

        if (!\is_string($value)) {
            throw new ApiProblemException(400, 'invalid_payload', sprintf('%s must be a string', $field));
        }

        $value = trim($value);
        if ('' === $value) {
            return null;
        }

        if (strlen($value) > 2048 || !filter_var($value, \FILTER_VALIDATE_URL)) {
            throw new ApiProblemException(400, 'invalid_payload', sprintf('%s must be a valid URL', $field));
        }

        return $value;
    }

    private function normalizeInt(mixed $value, string $field, int $minimum, int $maximum): int
    {
        if (!\is_int($value) && !(is_numeric($value) && (string) (int) $value === (string) trim((string) $value))) {
            throw new ApiProblemException(400, 'invalid_payload', sprintf('%s must be an integer', $field));
        }

        $value = (int) $value;
        if ($value < $minimum || $value > $maximum) {
            throw new ApiProblemException(400, 'invalid_payload', sprintf('%s must be between %d and %d', $field, $minimum, $maximum));
        }

        return $value;
    }

    private function seedFromEnvironment(DevelopmentFeedbackConfiguration $configuration): void
    {
        $configuration->setFeedbackEnabled(\in_array(
            strtolower(trim((string) (getenv('CONTEXTUAL_FEEDBACK_ENABLED') ?: '0'))),
            ['1', 'true', 'yes', 'on'],
            true,
        ));

        $webhookUrl = trim((string) (getenv('CONTEXTUAL_FEEDBACK_WEBHOOK_URL') ?: ''));
        if ('' !== $webhookUrl && filter_var($webhookUrl, \FILTER_VALIDATE_URL)) {
            $configuration->setWebhookUrl($webhookUrl);
        }

        $publicBaseUrl = trim((string) (getenv('CONTEXTUAL_FEEDBACK_PUBLIC_BASE_URL') ?: ''));
        if ('' !== $publicBaseUrl && filter_var($publicBaseUrl, \FILTER_VALIDATE_URL)) {
            $configuration->setPublicBaseUrl($publicBaseUrl);
        }

        $imageTtlDays = (int) (getenv('CONTEXTUAL_FEEDBACK_IMAGE_TTL_DAYS') ?: 30);
        $configuration->setImageTtlDays(max(1, min(365, $imageTtlDays)));

        $maxImageBytes = (int) (getenv('CONTEXTUAL_FEEDBACK_MAX_IMAGE_BYTES') ?: 3145728);
        $configuration->setMaxImageBytes(max(1, min(10485760, $maxImageBytes)));
    }
}
