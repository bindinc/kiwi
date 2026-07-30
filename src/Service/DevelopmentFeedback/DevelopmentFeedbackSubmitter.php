<?php

declare(strict_types=1);

namespace App\Service\DevelopmentFeedback;

use App\Entity\DevelopmentFeedbackReport;
use App\Entity\DevelopmentFeedbackScreenshot;
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
    public function submit(Request $request, array $rawPayload, ?UploadedFile $screenshotFile, ?UploadedFile $originalScreenshotFile, array $userContext): array
    {
        $this->ensureSchema();
        $now = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        $payload = $this->normalizePayload($rawPayload);
        $this->validateScreenshotFiles($payload['selectionKind'], $screenshotFile, $originalScreenshotFile);
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
            $payload['selectionKind'],
            $payload['selectedElement']['tag'] ?? null,
            $payload['selectedElement']['label'] ?? null,
            $payload['selectedElement']['selector'] ?? null,
            $payload['selectedElement']['textSample'] ?? null,
            $payload['selectedElement']['rect'] ?? null,
            $payload['annotations'],
            $payload['comment'],
            $payload['severity'],
            $payload['category'],
        );

        $storedScreenshot = null;
        $storedOriginalScreenshot = null;
        if ($screenshotFile instanceof UploadedFile && $originalScreenshotFile instanceof UploadedFile) {
            $storedScreenshot = $this->screenshotStore->storePng($report, $screenshotFile, $now, DevelopmentFeedbackScreenshot::VARIANT_PSEUDONYMIZED);
            $storedOriginalScreenshot = $this->screenshotStore->storePng($report, $originalScreenshotFile, $now, DevelopmentFeedbackScreenshot::VARIANT_ORIGINAL);
        }

        $this->entityManager->persist($report);
        $this->entityManager->flush();

        $teamsScreenshotVariant = $payload['teamsScreenshotVariant'];
        $delivery = $this->deliverToTeams(
            $request,
            $report,
            $teamsScreenshotVariant,
            $storedScreenshot,
            $storedOriginalScreenshot,
        );
        $sendOriginalData = DevelopmentFeedbackScreenshot::VARIANT_ORIGINAL === $teamsScreenshotVariant;
        $originalDataDelivery = $sendOriginalData ? $delivery : ['status' => 'skipped', 'error' => null];
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
            'teamsScreenshotVariant' => $teamsScreenshotVariant,
            'originalDataDeliveryStatus' => $originalDataDelivery['status'],
            'originalDataWarning' => $originalDataDelivery['error'],
            'warning' => $report->getTeamsDeliveryError(),
        ];
    }

    private function validateScreenshotFiles(
        string $selectionKind,
        ?UploadedFile $screenshotFile,
        ?UploadedFile $originalScreenshotFile,
    ): void {
        $hasPseudonymizedScreenshot = $screenshotFile instanceof UploadedFile;
        $hasOriginalScreenshot = $originalScreenshotFile instanceof UploadedFile;

        if ($hasPseudonymizedScreenshot !== $hasOriginalScreenshot) {
            throw new ApiProblemException(400, 'invalid_screenshot', 'screenshot and originalScreenshot must be submitted together');
        }

        $hasScreenshots = $hasPseudonymizedScreenshot && $hasOriginalScreenshot;
        $screenshotsRequired = DevelopmentFeedbackReport::SELECTION_NONE !== $selectionKind;
        if ($screenshotsRequired && !$hasScreenshots) {
            throw new ApiProblemException(400, 'invalid_screenshot', 'both screenshot variants are required for screenshot feedback');
        }

        if (!$screenshotsRequired && $hasScreenshots) {
            throw new ApiProblemException(400, 'invalid_screenshot', 'screenshots are not allowed when selectionKind is none');
        }
    }

    /**
     * @param array{token: string, screenshot: DevelopmentFeedbackScreenshot}|null $storedScreenshot
     * @param array{token: string, screenshot: DevelopmentFeedbackScreenshot}|null $storedOriginalScreenshot
     * @return array{status: string, error: string|null}
     */
    private function deliverToTeams(
        Request $request,
        DevelopmentFeedbackReport $report,
        ?string $teamsScreenshotVariant,
        ?array $storedScreenshot,
        ?array $storedOriginalScreenshot,
    ): array {
        if (null === $teamsScreenshotVariant) {
            return $this->notifier->notify($report, null);
        }

        if (null === $storedScreenshot || null === $storedOriginalScreenshot) {
            throw new \LogicException('Stored screenshot variants are required for screenshot feedback.');
        }

        $publicBaseUrl = $this->settings->getPublicBaseUrl($request);
        $pseudonymizedUrl = $this->urlGenerator->buildUrl(
            $publicBaseUrl,
            $report->getPublicId(),
            $storedScreenshot['token'],
        );
        $originalUrl = $this->urlGenerator->buildUrl(
            $publicBaseUrl,
            $report->getPublicId(),
            $storedOriginalScreenshot['token'],
        );
        $selectedScreenshotUrl = DevelopmentFeedbackScreenshot::VARIANT_ORIGINAL === $teamsScreenshotVariant
            ? $originalUrl
            : $pseudonymizedUrl;

        return $this->notifier->notifyVariant($report, $selectedScreenshotUrl, $teamsScreenshotVariant);
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
     *   selectionKind: string,
     *   teamsScreenshotVariant: string|null,
     *   pageUrl: string,
     *   routePath: string,
     *   userAgent: string,
     *   viewport: array{width: int, height: int, devicePixelRatio: float},
     *   selectedElement: array{tag: string, label: string, selector: string, textSample: string|null, rect: array<string, int|float>}|null,
     *   annotations: list<array<string, mixed>>
     * }
     */
    private function normalizePayload(array $payload): array
    {
        $comment = $this->boundedString($payload['comment'] ?? null, 'comment', 4000);
        $severity = $this->enumString($payload['severity'] ?? 'normal', 'severity', self::ALLOWED_SEVERITIES);
        $category = $this->enumString($payload['category'] ?? 'bug', 'category', self::ALLOWED_CATEGORIES);
        $viewport = \is_array($payload['viewport'] ?? null) ? $payload['viewport'] : [];
        $selectionKind = $this->normalizeSelectionKind($payload);
        $selectedElement = $this->normalizeSelectedElement($payload, $selectionKind);
        $annotations = $this->normalizeAnnotations($payload['annotations'] ?? []);

        if (DevelopmentFeedbackReport::SELECTION_NONE === $selectionKind && [] !== $annotations) {
            throw new ApiProblemException(400, 'invalid_payload', 'annotations require a screenshot');
        }

        return [
            'comment' => $comment,
            'severity' => $severity,
            'category' => $category,
            'selectionKind' => $selectionKind,
            'teamsScreenshotVariant' => $this->normalizeTeamsScreenshotVariant($payload, $selectionKind),
            'pageUrl' => $this->boundedString($payload['pageUrl'] ?? null, 'pageUrl', 2048),
            'routePath' => $this->boundedString($payload['routePath'] ?? null, 'routePath', 2048),
            'userAgent' => $this->boundedOptionalString($payload['userAgent'] ?? '', 1024),
            'viewport' => [
                'width' => $this->positiveInt($viewport['width'] ?? null, 'viewport.width', 10000),
                'height' => $this->positiveInt($viewport['height'] ?? null, 'viewport.height', 10000),
                'devicePixelRatio' => $this->positiveFloat($viewport['devicePixelRatio'] ?? 1, 'viewport.devicePixelRatio', 8),
            ],
            'selectedElement' => $selectedElement,
            'annotations' => $annotations,
        ];
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function normalizeSelectionKind(array $payload): string
    {
        if (!array_key_exists('selectionKind', $payload)) {
            $selectedElement = \is_array($payload['selectedElement'] ?? null) ? $payload['selectedElement'] : [];

            return 'area' === strtolower((string) ($selectedElement['tag'] ?? ''))
                ? DevelopmentFeedbackReport::SELECTION_AREA
                : DevelopmentFeedbackReport::SELECTION_ELEMENT;
        }

        return $this->enumString(
            $payload['selectionKind'],
            'selectionKind',
            [
                DevelopmentFeedbackReport::SELECTION_NONE,
                DevelopmentFeedbackReport::SELECTION_ELEMENT,
                DevelopmentFeedbackReport::SELECTION_AREA,
            ],
        );
    }

    /**
     * @param array<string, mixed> $payload
     * @return array{tag: string, label: string, selector: string, textSample: string|null, rect: array<string, int|float>}|null
     */
    private function normalizeSelectedElement(array $payload, string $selectionKind): ?array
    {
        $selectedElement = $payload['selectedElement'] ?? null;
        if (DevelopmentFeedbackReport::SELECTION_NONE === $selectionKind) {
            if (null !== $selectedElement) {
                throw new ApiProblemException(400, 'invalid_payload', 'selectedElement must be omitted when no screenshot is attached');
            }

            return null;
        }

        if (!\is_array($selectedElement)) {
            throw new ApiProblemException(400, 'invalid_payload', 'selectedElement is required when a screenshot is attached');
        }

        $normalized = [
            'tag' => strtolower($this->boundedString($selectedElement['tag'] ?? null, 'selectedElement.tag', 64)),
            'label' => $this->boundedString($selectedElement['label'] ?? null, 'selectedElement.label', 255),
            'selector' => $this->boundedString($selectedElement['selector'] ?? null, 'selectedElement.selector', 1024),
            'textSample' => $this->nullableTrimmedString($selectedElement['textSample'] ?? null, 120),
            'rect' => $this->normalizeRect(\is_array($selectedElement['rect'] ?? null) ? $selectedElement['rect'] : []),
        ];

        if (DevelopmentFeedbackReport::SELECTION_AREA === $selectionKind) {
            $isAreaTag = 'area' === $normalized['tag'];
            $meetsMinimumSize = $normalized['rect']['width'] >= 10 && $normalized['rect']['height'] >= 10;
            if (!$isAreaTag || !$meetsMinimumSize) {
                throw new ApiProblemException(400, 'invalid_payload', 'area selections must be at least 10 by 10 pixels');
            }
        }

        return $normalized;
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function normalizeTeamsScreenshotVariant(array $payload, string $selectionKind): ?string
    {
        if (DevelopmentFeedbackReport::SELECTION_NONE === $selectionKind) {
            if (null !== ($payload['teamsScreenshotVariant'] ?? null)) {
                throw new ApiProblemException(400, 'invalid_payload', 'teamsScreenshotVariant requires a screenshot');
            }

            return null;
        }

        return $this->enumString(
            $payload['teamsScreenshotVariant'] ?? DevelopmentFeedbackScreenshot::VARIANT_PSEUDONYMIZED,
            'teamsScreenshotVariant',
            [DevelopmentFeedbackScreenshot::VARIANT_PSEUDONYMIZED, DevelopmentFeedbackScreenshot::VARIANT_ORIGINAL],
        );
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
