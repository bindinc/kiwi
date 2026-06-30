<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Entity\DevelopmentFeedbackReport;
use App\Entity\DevelopmentFeedbackScreenshot;
use App\Service\DevelopmentFeedback\DevelopmentFeedbackSchemaManager;
use App\Service\DevelopmentFeedback\SignedScreenshotUrlGenerator;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\File\UploadedFile;

final class DevelopmentFeedbackControllerTest extends WebTestCase
{
    use AuthenticatedClientTrait;

    private array $previousEnv = [];

    protected function setUp(): void
    {
        $this->previousEnv = [
            'CONTEXTUAL_FEEDBACK_ENABLED' => getenv('CONTEXTUAL_FEEDBACK_ENABLED') ?: null,
            'CONTEXTUAL_FEEDBACK_WEBHOOK_URL' => getenv('CONTEXTUAL_FEEDBACK_WEBHOOK_URL') ?: null,
            'CONTEXTUAL_FEEDBACK_ORIGINAL_DATA_WEBHOOK_URL' => getenv('CONTEXTUAL_FEEDBACK_ORIGINAL_DATA_WEBHOOK_URL') ?: null,
            'CONTEXTUAL_FEEDBACK_MAX_IMAGE_BYTES' => getenv('CONTEXTUAL_FEEDBACK_MAX_IMAGE_BYTES') ?: null,
        ];
        putenv('CONTEXTUAL_FEEDBACK_ENABLED=1');
        putenv('CONTEXTUAL_FEEDBACK_WEBHOOK_URL');
        putenv('CONTEXTUAL_FEEDBACK_ORIGINAL_DATA_WEBHOOK_URL');
        putenv('CONTEXTUAL_FEEDBACK_MAX_IMAGE_BYTES=3145728');
    }

    protected function tearDown(): void
    {
        try {
            $container = static::getContainer();
            if ($container->has(EntityManagerInterface::class)) {
                /** @var EntityManagerInterface $entityManager */
                $entityManager = $container->get(EntityManagerInterface::class);
                $entityManager->getConnection()->executeStatement('DROP TABLE IF EXISTS development_feedback_screenshots');
                $entityManager->getConnection()->executeStatement('DROP TABLE IF EXISTS development_feedback_reports');
                $entityManager->getConnection()->executeStatement('DROP TABLE IF EXISTS development_feedback_configuration');
                $entityManager->getConnection()->close();
            }
        } catch (\Throwable) {
        }

        foreach ($this->previousEnv as $name => $value) {
            null === $value ? putenv($name) : putenv($name.'='.$value);
        }

        parent::tearDown();
    }

    public function testSubmitRequiresAuthentication(): void
    {
        $client = static::createClient();
        $client->request('POST', '/api/v1/development-feedback');

        self::assertResponseStatusCodeSame(401);
    }

    public function testSettingsRequireAdministratorOrSupervisorRole(): void
    {
        $normalUser = $this->createAuthenticatedClient(['bink8s.app.kiwi.dev']);
        $normalUser->request('GET', '/api/v1/development-feedback/settings');
        self::assertResponseStatusCodeSame(403);

        self::ensureKernelShutdown();
        $administrator = $this->createAuthenticatedClient(['bink8s.app.kiwi.admin']);
        $administrator->request('GET', '/api/v1/development-feedback/settings');
        self::assertResponseIsSuccessful();

        self::ensureKernelShutdown();
        $supervisor = $this->createAuthenticatedClient(['bink8s.app.kiwi.supervisor']);
        $supervisor->request('GET', '/api/v1/development-feedback/settings');
        self::assertResponseIsSuccessful();
    }

    public function testAdministratorCanUpdateGlobalFeedbackAndTeamsSettings(): void
    {
        $client = $this->createAuthenticatedClient(['bink8s.app.kiwi.admin']);

        $client->request('PUT', '/api/v1/development-feedback/settings', server: ['CONTENT_TYPE' => 'application/json'], content: json_encode([
            'feedbackEnabled' => false,
            'webhookUrl' => 'https://workflow.example/webhook',
            'originalDataWebhookUrl' => 'https://workflow.example/original-data',
            'publicBaseUrl' => 'https://bdc.rtvmedia.org/kiwi-preview',
            'imageTtlDays' => 14,
            'maxImageBytes' => 2097152,
        ], \JSON_THROW_ON_ERROR));

        self::assertResponseIsSuccessful();
        $payload = json_decode((string) $client->getResponse()->getContent(), true, flags: \JSON_THROW_ON_ERROR);
        self::assertFalse($payload['feedbackEnabled']);
        self::assertTrue($payload['teamsWebhookConfigured']);
        self::assertSame('database', $payload['teamsWebhookSource']);
        self::assertTrue($payload['originalDataWebhookConfigured']);
        self::assertSame('database', $payload['originalDataWebhookSource']);
        self::assertSame('https://bdc.rtvmedia.org/kiwi-preview', $payload['publicBaseUrl']);
        self::assertSame(14, $payload['imageTtlDays']);
        self::assertSame(2097152, $payload['maxImageBytes']);
        self::assertArrayNotHasKey('webhookUrl', $payload);
    }

    public function testSubmitRejectsNonPngScreenshot(): void
    {
        $client = $this->createAuthenticatedClient(['bink8s.app.kiwi.dev']);

        $client->request('POST', '/api/v1/development-feedback', [
            'payload' => json_encode($this->validPayload(), \JSON_THROW_ON_ERROR),
        ], [
            'screenshot' => $this->createUploadedFile('not png', 'text/plain'),
            'originalScreenshot' => $this->createUploadedFile($this->pngBytes(), 'image/png'),
        ]);

        self::assertResponseStatusCodeSame(400);
        $payload = json_decode((string) $client->getResponse()->getContent(), true, flags: \JSON_THROW_ON_ERROR);
        self::assertSame('invalid_screenshot', $payload['error']['code']);
    }

    public function testSubmitRejectsOversizedScreenshot(): void
    {
        putenv('CONTEXTUAL_FEEDBACK_MAX_IMAGE_BYTES=10');
        $client = $this->createAuthenticatedClient(['bink8s.app.kiwi.dev']);

        $client->request('POST', '/api/v1/development-feedback', [
            'payload' => json_encode($this->validPayload(), \JSON_THROW_ON_ERROR),
        ], [
            'screenshot' => $this->createUploadedFile($this->pngBytes(), 'image/png'),
            'originalScreenshot' => $this->createUploadedFile($this->pngBytes(), 'image/png'),
        ]);

        self::assertResponseStatusCodeSame(413);
    }

    public function testSubmitStoresReportAndScreenshot(): void
    {
        $client = $this->createAuthenticatedClient(['bink8s.app.kiwi.dev']);

        $client->request('POST', '/api/v1/development-feedback', [
            'payload' => json_encode($this->validPayload(), \JSON_THROW_ON_ERROR),
        ], [
            'screenshot' => $this->createUploadedFile($this->pngBytes(), 'image/png'),
            'originalScreenshot' => $this->createUploadedFile($this->pngBytes(), 'image/png'),
        ]);

        self::assertResponseStatusCodeSame(201);
        $responsePayload = json_decode((string) $client->getResponse()->getContent(), true, flags: \JSON_THROW_ON_ERROR);
        self::assertSame('stored_with_warning', $responsePayload['status']);
        self::assertSame('not_configured', $responsePayload['teamsDeliveryStatus']);
        self::assertSame('not_configured', $responsePayload['originalDataDeliveryStatus']);

        /** @var EntityManagerInterface $entityManager */
        $entityManager = static::getContainer()->get(EntityManagerInterface::class);
        self::assertSame(1, (int) $entityManager->getConnection()->fetchOne('SELECT COUNT(*) FROM development_feedback_reports'));
        self::assertSame(2, (int) $entityManager->getConnection()->fetchOne('SELECT COUNT(*) FROM development_feedback_screenshots'));
        self::assertSame(1, (int) $entityManager->getConnection()->fetchOne("SELECT COUNT(*) FROM development_feedback_screenshots WHERE variant = 'pseudonymized'"));
        self::assertSame(1, (int) $entityManager->getConnection()->fetchOne("SELECT COUNT(*) FROM development_feedback_screenshots WHERE variant = 'original'"));
    }

    public function testScreenshotEndpointServesValidTokenAndRejectsInvalidOrExpiredTokens(): void
    {
        $client = static::createClient();
        $token = 'known-token';
        $this->persistScreenshotReport('dddddddd-dddd-4ddd-8ddd-dddddddddddd', $token, new \DateTimeImmutable('+1 day'));

        $client->request('GET', '/api/v1/development-feedback/screenshots/dddddddd-dddd-4ddd-8ddd-dddddddddddd/known-token.png');
        self::assertResponseIsSuccessful();
        self::assertSame('image/png', $client->getResponse()->headers->get('Content-Type'));
        self::assertSame($this->pngBytes(), $client->getResponse()->getContent());

        $client->request('GET', '/api/v1/development-feedback/screenshots/dddddddd-dddd-4ddd-8ddd-dddddddddddd/wrong.png');
        self::assertResponseStatusCodeSame(404);

        $this->persistScreenshotReport('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'expired-token', new \DateTimeImmutable('-1 day'));
        $client->request('GET', '/api/v1/development-feedback/screenshots/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/expired-token.png');
        self::assertResponseStatusCodeSame(404);
    }

    private function persistScreenshotReport(string $publicId, string $token, \DateTimeImmutable $expiresAt): void
    {
        /** @var DevelopmentFeedbackSchemaManager $schemaManager */
        $schemaManager = static::getContainer()->get(DevelopmentFeedbackSchemaManager::class);
        $schemaManager->ensureSchema();

        /** @var EntityManagerInterface $entityManager */
        $entityManager = static::getContainer()->get(EntityManagerInterface::class);
        /** @var SignedScreenshotUrlGenerator $urlGenerator */
        $urlGenerator = static::getContainer()->get(SignedScreenshotUrlGenerator::class);

        $report = new DevelopmentFeedbackReport(
            $publicId,
            new \DateTimeImmutable('2026-06-16T12:00:00+00:00'),
            'test@example.org',
            'Test User',
            'test@example.org',
            'local',
            'active',
            'https://example.org/kiwi',
            '/kiwi',
            1,
            1,
            1.0,
            'phpunit',
            'button',
            'Button',
            'button',
            null,
            ['x' => 0, 'y' => 0, 'width' => 1, 'height' => 1],
            [],
            'Comment',
            'normal',
            'bug',
        );
        $screenshot = new DevelopmentFeedbackScreenshot(
            DevelopmentFeedbackScreenshot::VARIANT_PSEUDONYMIZED,
            'postgresql://development-feedback/screenshots/'.$publicId.'.png',
            'image/png',
            strlen($this->pngBytes()),
            1,
            1,
            hash('sha256', $this->pngBytes()),
            $urlGenerator->hashToken($token),
            $expiresAt,
            new \DateTimeImmutable('2026-06-16T12:00:00+00:00'),
            $this->pngBytes(),
        );
        $report->setScreenshot($screenshot);
        $entityManager->persist($report);
        $entityManager->flush();
        $entityManager->clear();
    }

    /**
     * @return array<string, mixed>
     */
    private function validPayload(): array
    {
        return [
            'comment' => 'The start date picker overlaps the submit button.',
            'severity' => 'normal',
            'category' => 'bug',
            'pageUrl' => 'https://bdc.rtvmedia.org.local/kiwi/customer',
            'routePath' => '/kiwi/customer',
            'userAgent' => 'phpunit',
            'viewport' => [
                'width' => 1440,
                'height' => 900,
                'devicePixelRatio' => 1,
            ],
            'selectedElement' => [
                'tag' => 'button',
                'label' => 'Create subscription',
                'selector' => '[data-feedback-id="create-subscription"]',
                'textSample' => 'Create subscription',
                'rect' => [
                    'x' => 1020,
                    'y' => 742,
                    'width' => 180,
                    'height' => 44,
                ],
            ],
            'annotations' => [
                [
                    'type' => 'rectangle',
                    'x' => 1018,
                    'y' => 740,
                    'width' => 184,
                    'height' => 48,
                    'color' => '#f97316',
                ],
            ],
        ];
    }

    private function createUploadedFile(string $bytes, string $mimeType): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'kiwi-feedback-');
        file_put_contents($path, $bytes);

        return new UploadedFile($path, 'screenshot.png', $mimeType, null, true);
    }

    private function pngBytes(): string
    {
        return base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lO2e0wAAAABJRU5ErkJggg==');
    }
}
