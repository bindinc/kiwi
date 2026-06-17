<?php

declare(strict_types=1);

namespace App\Service\DevelopmentFeedback;

use App\Entity\DevelopmentFeedbackReport;
use Psr\Log\LoggerInterface;
use Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

final class TeamsDevelopmentFeedbackNotifier
{
    public function __construct(
        private readonly HttpClientInterface $httpClient,
        private readonly DevelopmentFeedbackSettings $settings,
        private readonly TeamsFeedbackCardFactory $cardFactory,
        private readonly LoggerInterface $logger,
    ) {
    }

    /**
     * @return array{status: string, error: string|null}
     */
    public function notify(DevelopmentFeedbackReport $report, string $screenshotUrl): array
    {
        $webhookUrl = $this->settings->getWebhookUrl();
        if (null === $webhookUrl) {
            $this->logger->warning('Skipping contextual feedback Teams delivery because no webhook URL is configured.', [
                'feedback_public_id' => $report->getPublicId(),
            ]);

            return [
                'status' => 'not_configured',
                'error' => 'CONTEXTUAL_FEEDBACK_WEBHOOK_URL is not configured',
            ];
        }

        try {
            $response = $this->httpClient->request('POST', $webhookUrl, [
                'headers' => [
                    'Content-Type' => 'application/json',
                ],
                'json' => $this->cardFactory->createCard($report, $screenshotUrl),
                'timeout' => 8,
            ]);
            $statusCode = $response->getStatusCode();
            $body = $response->getContent(false);
        } catch (TransportExceptionInterface $exception) {
            $this->logger->warning('Contextual feedback Teams delivery failed with a transport error.', [
                'feedback_public_id' => $report->getPublicId(),
                'error' => $this->truncateError($exception->getMessage()),
            ]);

            return [
                'status' => 'failed',
                'error' => $this->truncateError($exception->getMessage()),
            ];
        }

        if ($statusCode >= 200 && $statusCode < 300) {
            return [
                'status' => 'sent',
                'error' => null,
            ];
        }

        $error = $this->truncateError(sprintf('Teams webhook returned HTTP %d: %s', $statusCode, trim($body)));
        $this->logger->warning('Contextual feedback Teams delivery failed with a non-success status code.', [
            'feedback_public_id' => $report->getPublicId(),
            'status_code' => $statusCode,
            'error' => $error,
        ]);

        return [
            'status' => 'failed',
            'error' => $error,
        ];
    }

    private function truncateError(string $message): string
    {
        $message = trim($message);
        if (mb_strlen($message) <= 500) {
            return $message;
        }

        return mb_substr($message, 0, 497).'...';
    }
}
