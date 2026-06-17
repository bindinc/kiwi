<?php

declare(strict_types=1);

namespace App\Controller\Api;

use App\Http\ApiProblemException;
use App\Http\JsonRequestDecoder;
use App\Oidc\OidcConfiguration;
use App\Oidc\OidcRoleAccess;
use App\Oidc\RequestOidcContext;
use App\Repository\DevelopmentFeedbackReportRepository;
use App\Service\DevelopmentFeedback\DevelopmentFeedbackSchemaManager;
use App\Service\DevelopmentFeedback\DevelopmentFeedbackConfigurationStore;
use App\Service\DevelopmentFeedback\DevelopmentFeedbackSettings;
use App\Service\DevelopmentFeedback\DevelopmentFeedbackSubmitter;
use App\Service\DevelopmentFeedback\SignedScreenshotUrlGenerator;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api/v1/development-feedback')]
final class DevelopmentFeedbackController extends AbstractApiController
{
    public function __construct(
        RequestOidcContext $requestOidcContext,
        OidcRoleAccess $oidcRoleAccess,
        OidcConfiguration $oidcConfiguration,
        JsonRequestDecoder $jsonRequestDecoder,
        private readonly DevelopmentFeedbackSettings $settings,
        private readonly DevelopmentFeedbackConfigurationStore $configurationStore,
        private readonly DevelopmentFeedbackSubmitter $submitter,
        private readonly DevelopmentFeedbackSchemaManager $schemaManager,
        private readonly DevelopmentFeedbackReportRepository $repository,
        private readonly SignedScreenshotUrlGenerator $urlGenerator,
    ) {
        parent::__construct($requestOidcContext, $oidcRoleAccess, $oidcConfiguration, $jsonRequestDecoder);
    }

    #[Route('/settings', name: 'api_development_feedback_settings_read', methods: ['GET'])]
    public function readSettings(Request $request): JsonResponse
    {
        $this->requireSettingsAccess($request);

        return $this->json($this->settings->describeSettings($request));
    }

    #[Route('/settings', name: 'api_development_feedback_settings_update', methods: ['PUT'])]
    public function updateSettings(Request $request): JsonResponse
    {
        $this->requireSettingsAccess($request);
        $payload = $this->parseJsonObject($request);
        $this->configurationStore->updateConfiguration($payload);

        return $this->json($this->settings->describeSettings($request));
    }

    #[Route('', name: 'api_development_feedback_submit', methods: ['POST'])]
    public function submit(Request $request): JsonResponse
    {
        $this->requireApiAccess($request);
        $currentUserContext = $this->getCurrentUserContext($request);
        $roles = \is_array($currentUserContext['roles'] ?? null) ? $currentUserContext['roles'] : [];

        if (!$this->settings->isEnabled()) {
            throw new ApiProblemException(404, 'feedback_disabled', 'Contextual feedback is disabled');
        }

        if (!$this->settings->isAllowedForRoles($roles)) {
            throw new ApiProblemException(403, 'feedback_forbidden', 'Contextual feedback is not available for this role');
        }

        $payload = $this->decodeMultipartPayload($request);
        $screenshot = $request->files->get('screenshot');
        if (!$screenshot instanceof UploadedFile) {
            throw new ApiProblemException(400, 'invalid_screenshot', 'screenshot is required');
        }

        return $this->json($this->submitter->submit($request, $payload, $screenshot, $currentUserContext), 201);
    }

    #[Route('/screenshots/{publicId}/{token}.png', name: 'api_development_feedback_screenshot', methods: ['GET'])]
    public function screenshot(string $publicId, string $token): Response
    {
        if (!$this->schemaManager->hasFeedbackTables()) {
            throw new ApiProblemException(404, 'screenshot_not_found', 'Screenshot not found');
        }

        $report = $this->repository->findWithScreenshotByPublicId($publicId);
        $screenshot = $report?->getScreenshot();
        $now = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));

        if (null === $screenshot || $screenshot->getAccessTokenExpiresAt() <= $now) {
            throw new ApiProblemException(404, 'screenshot_not_found', 'Screenshot not found');
        }

        if (!$this->urlGenerator->tokenMatches($token, $screenshot->getAccessTokenHash())) {
            throw new ApiProblemException(404, 'screenshot_not_found', 'Screenshot not found');
        }

        return new Response($screenshot->getImageData(), 200, [
            'Content-Type' => 'image/png',
            'Cache-Control' => 'private, max-age=3600',
            'Content-Length' => (string) $screenshot->getByteSize(),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeMultipartPayload(Request $request): array
    {
        $rawPayload = $request->request->get('payload');
        if (!\is_string($rawPayload) || '' === trim($rawPayload)) {
            throw new ApiProblemException(400, 'invalid_payload', 'payload is required');
        }

        try {
            $payload = json_decode($rawPayload, true, flags: \JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new ApiProblemException(400, 'invalid_payload', 'payload must be valid JSON');
        }

        if (!\is_array($payload)) {
            throw new ApiProblemException(400, 'invalid_payload', 'payload must be a JSON object');
        }

        return $payload;
    }

    private function requireSettingsAccess(Request $request): void
    {
        $this->requireApiAccess($request);
        $currentUserContext = $this->getCurrentUserContext($request);
        $roles = \is_array($currentUserContext['roles'] ?? null) ? $currentUserContext['roles'] : [];

        if (!$this->settings->canManageSettings($roles)) {
            throw new ApiProblemException(403, 'feedback_settings_forbidden', 'Only Kiwi administrators and supervisors can manage feedback settings');
        }
    }
}
