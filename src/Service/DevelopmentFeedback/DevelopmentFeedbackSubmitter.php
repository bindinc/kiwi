<?php

declare(strict_types=1);

namespace App\Service\DevelopmentFeedback;

use App\Entity\DevelopmentFeedbackReport;
use App\Http\ApiProblemException;
use App\Repository\DevelopmentFeedbackReportRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\Request;

final class DevelopmentFeedbackSubmitter
{
    private const ALLOWED_SEVERITIES = ['low', 'normal', 'high', 'blocking'];
    private const ALLOWED_CATEGORIES = ['bug', 'chore', 'feature_request', 'regression'];
    private const RATE_LIMIT_COUNT = 10;
    private const RATE_LIMIT_WINDOW = '-10 minutes';

    public function __construct(
        private readonly DevelopmentFeedbackSchemaManager $schemaManager,
        private readonly DevelopmentFeedbackReportRepository $repository,
        private readonly ScreenshotStore $screenshotStore,
        private readonly SignedScreenshotUrlGenerator $urlGenerator,
        private readonly TeamsDevelopmentFeedbackNotifier $notifier,
        private readonly DevelopmentFeedbackSettings $settings,
        private readonly EntityManagerInterface $entityManager,
    ) {
    }

    /**
     * @param array<string, mixed> $rawPayload
     * @param array<string, mixed> $userContext
     * @return array<string, mixed>
     */
    public function submit(Request $request, array $rawPayload, UploadedFile $screenshotFile, array $userContext): array
    {
        $this->ensureSchema();
        $now = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        $payload = $this->normalizePayload($rawPayload);
        $identity = \is_array($userContext['identity'] ?? null) ? $userContext['identity'] : [];
        $createdByEmail = $this->nullableTrimmedString($identity['email'] ?? null, 255);
        $createdByDisplayName = $this->boundedString($identity['full_name'] ?? 'Unknown user', 'displayName', 255);
        $createdByUserId = $createdByEmail ?? $createdByDisplayName;

        $recentSubmissionCount = $this->repository->countCreatedByUserSince($createdByUserId, $now->modify(self::RATE_LIMIT_WINDOW));
        if ($recentSubmissionCount >= self::RATE_LIMIT_COUNT) {
            throw new ApiProblemException(429, 'feedback_rate_limited', 'Too many feedback reports submitted recently');
        }

        $report = new DevelopmentFeedbackReport(
            $this->createUuidV4(),
            $now,
            $createdByUserId,
            $createdByDisplayName,
            $createdByEmail,
            $this->settings->detectEnvironment($request),
            $this->settings->detectTrack($request),
            $payload['pageUrl'],
            $payload['routePath'],
            $payload['viewport']['width'],
            $payload['viewport']['height'],
            $payload['viewport']['devicePixelRatio'],
            $payload['userAgent'],
            $payload['selectedElement']['tag'],
            $payload['selectedElement']['label'],
            $payload['selectedElement']['selector'],
            $payload['selectedElement']['textSample'],
            $payload['selectedElement']['rect'],
            $payload['annotations'],
            $payload['comment'],
            $payload['severity'],
            $payload['category'],
        );

        $storedScreenshot = $this->screenshotStore->storePng($report, $screenshotFile, $now);
        $this->entityManager->persist($report);
        $this->entityManager->flush();

        $screenshotUrl = $this->urlGenerator->buildUrl(
            $this->settings->getPublicBaseUrl($request),
            $report->getPublicId(),
            $storedScreenshot['token'],
        );
        $delivery = $this->notifier->notify($report, $screenshotUrl);
        $report->markTeamsDelivery(
            $delivery['status'],
            $delivery['error'],
            'sent' === $delivery['status'] ? $now : null,
        );
        $this->entityManager->flush();

        return [
            'id' => $report->getPublicId(),
            'status' => 'sent' === $delivery['status'] ? 'delivered' : 'stored_with_warning',
            'teamsDeliveryStatus' => $report->getTeamsDeliveryStatus(),
            'warning' => $report->getTeamsDeliveryError(),
        ];
    }

    private function ensureSchema(): void
    {
        try {
            $this->schemaManager->ensureSchema();
        } catch (\Throwable $exception) {
            throw new ApiProblemException(503, 'feedback_store_unavailable', 'Feedback storage is unavailable', [
                'reason' => $exception->getMessage(),
            ]);
        }
    }

    private function createUuidV4(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        $hex = bin2hex($bytes);

        return sprintf(
            '%s-%s-%s-%s-%s',
            substr($hex, 0, 8),
            substr($hex, 8, 4),
            substr($hex, 12, 4),
            substr($hex, 16, 4),
            substr($hex, 20),
        );
    }

    /**
     * @param array<string, mixed> $payload
     * @return array{
     *   comment: string,
     *   severity: string,
     *   category: string,
     *   pageUrl: string,
     *   routePath: string,
     *   userAgent: string,
     *   viewport: array{width: int, height: int, devicePixelRatio: float},
     *   selectedElement: array{tag: string, label: string, selector: string, textSample: string|null, rect: array<string, int|float>},
     *   annotations: list<array<string, mixed>>
     * }
     */
    private function normalizePayload(array $payload): array
    {
        $comment = $this->boundedString($payload['comment'] ?? null, 'comment', 4000);
        $severity = $this->enumString($payload['severity'] ?? 'normal', 'severity', self::ALLOWED_SEVERITIES);
        $category = $this->enumString($payload['category'] ?? 'bug', 'category', self::ALLOWED_CATEGORIES);
        $viewport = \is_array($payload['viewport'] ?? null) ? $payload['viewport'] : [];
        $selectedElement = \is_array($payload['selectedElement'] ?? null) ? $payload['selectedElement'] : [];

        return [
            'comment' => $comment,
            'severity' => $severity,
            'category' => $category,
            'pageUrl' => $this->boundedString($payload['pageUrl'] ?? null, 'pageUrl', 2048),
            'routePath' => $this->boundedString($payload['routePath'] ?? null, 'routePath', 2048),
            'userAgent' => $this->boundedOptionalString($payload['userAgent'] ?? '', 1024),
            'viewport' => [
                'width' => $this->positiveInt($viewport['width'] ?? null, 'viewport.width', 10000),
                'height' => $this->positiveInt($viewport['height'] ?? null, 'viewport.height', 10000),
                'devicePixelRatio' => $this->positiveFloat($viewport['devicePixelRatio'] ?? 1, 'viewport.devicePixelRatio', 8),
            ],
            'selectedElement' => [
                'tag' => strtolower($this->boundedString($selectedElement['tag'] ?? null, 'selectedElement.tag', 64)),
                'label' => $this->boundedString($selectedElement['label'] ?? null, 'selectedElement.label', 255),
                'selector' => $this->boundedString($selectedElement['selector'] ?? null, 'selectedElement.selector', 1024),
                'textSample' => $this->nullableTrimmedString($selectedElement['textSample'] ?? null, 120),
                'rect' => $this->normalizeRect(\is_array($selectedElement['rect'] ?? null) ? $selectedElement['rect'] : []),
            ],
            'annotations' => $this->normalizeAnnotations($payload['annotations'] ?? []),
        ];
    }

    private function boundedString(mixed $value, string $field, int $maxLength): string
    {
        if (!\is_string($value)) {
            throw new ApiProblemException(400, 'invalid_payload', sprintf('%s must be a non-empty string', $field));
        }

        $value = trim($value);
        if ('' === $value) {
            throw new ApiProblemException(400, 'invalid_payload', sprintf('%s must be a non-empty string', $field));
        }

        if (mb_strlen($value) > $maxLength) {
            throw new ApiProblemException(400, 'invalid_payload', sprintf('%s must be at most %d characters', $field, $maxLength));
        }

        return $value;
    }

    private function boundedOptionalString(mixed $value, int $maxLength): string
    {
        if (!\is_string($value)) {
            return '';
        }

        $value = trim($value);

        return mb_strlen($value) > $maxLength ? mb_substr($value, 0, $maxLength) : $value;
    }

    private function nullableTrimmedString(mixed $value, int $maxLength): ?string
    {
        if (!\is_string($value)) {
            return null;
        }

        $value = trim($value);
        if ('' === $value) {
            return null;
        }

        return mb_strlen($value) > $maxLength ? mb_substr($value, 0, $maxLength) : $value;
    }

    /**
     * @param string[] $allowed
     */
    private function enumString(mixed $value, string $field, array $allowed): string
    {
        if (!\is_string($value)) {
            throw new ApiProblemException(400, 'invalid_payload', sprintf('%s must be a string', $field));
        }

        $value = strtolower(trim($value));
        if (!\in_array($value, $allowed, true)) {
            throw new ApiProblemException(400, 'invalid_payload', sprintf('%s is not supported', $field), [
                'allowed' => $allowed,
            ]);
        }

        return $value;
    }

    private function positiveInt(mixed $value, string $field, int $maximum): int
    {
        if (!\is_int($value) && !(is_numeric($value) && (string) (int) $value === (string) trim((string) $value))) {
            throw new ApiProblemException(400, 'invalid_payload', sprintf('%s must be an integer', $field));
        }

        $value = (int) $value;
        if ($value < 1 || $value > $maximum) {
            throw new ApiProblemException(400, 'invalid_payload', sprintf('%s is out of range', $field));
        }

        return $value;
    }

    private function positiveFloat(mixed $value, string $field, float $maximum): float
    {
        if (!is_numeric($value)) {
            throw new ApiProblemException(400, 'invalid_payload', sprintf('%s must be numeric', $field));
        }

        $value = (float) $value;
        if ($value <= 0 || $value > $maximum) {
            throw new ApiProblemException(400, 'invalid_payload', sprintf('%s is out of range', $field));
        }

        return $value;
    }

    /**
     * @param array<string, mixed> $rect
     * @return array<string, int|float>
     */
    private function normalizeRect(array $rect): array
    {
        return [
            'x' => $this->positiveOrZeroFloat($rect['x'] ?? null, 'selectedElement.rect.x'),
            'y' => $this->positiveOrZeroFloat($rect['y'] ?? null, 'selectedElement.rect.y'),
            'width' => $this->positiveFloat($rect['width'] ?? null, 'selectedElement.rect.width', 10000),
            'height' => $this->positiveFloat($rect['height'] ?? null, 'selectedElement.rect.height', 10000),
        ];
    }

    private function positiveOrZeroFloat(mixed $value, string $field): float
    {
        if (!is_numeric($value)) {
            throw new ApiProblemException(400, 'invalid_payload', sprintf('%s must be numeric', $field));
        }

        $value = (float) $value;
        if ($value < 0 || $value > 10000) {
            throw new ApiProblemException(400, 'invalid_payload', sprintf('%s is out of range', $field));
        }

        return $value;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function normalizeAnnotations(mixed $annotations): array
    {
        if (!\is_array($annotations)) {
            throw new ApiProblemException(400, 'invalid_payload', 'annotations must be an array');
        }

        $normalized = [];
        foreach ($annotations as $annotation) {
            if (\is_array($annotation)) {
                $normalized[] = $annotation;
            }
        }

        return \array_slice($normalized, 0, 100);
    }
}
