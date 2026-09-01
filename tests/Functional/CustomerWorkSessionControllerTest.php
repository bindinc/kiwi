<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class CustomerWorkSessionControllerTest extends WebTestCase
{
    use AuthenticatedClientTrait;

    public function testResetRecordsTheAuthenticatedCustomerContext(): void
    {
        $client = $this->createAuthenticatedClient();
        $client->request(
            'POST',
            '/api/v1/customer-work-sessions/reset',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode([
                'workflowSessionId' => 'workflow-reset-audit',
                'contextGeneration' => 11,
                'customerReference' => [
                    'personId' => '11860448',
                    'credentialKey' => 'tvk',
                    'sourceSystem' => 'subscription-api',
                    'divisionId' => '14',
                    'mandant' => 'HMC',
                ],
            ], \JSON_THROW_ON_ERROR),
        );

        self::assertResponseIsSuccessful();
        $responsePayload = json_decode((string) $client->getResponse()->getContent(), true, flags: \JSON_THROW_ON_ERROR);
        $requestId = $client->getResponse()->headers->get('X-Kiwi-Request-Id');
        self::assertNotNull($requestId);
        self::assertSame($requestId, $responsePayload['requestId']);

        /** @var EntityManagerInterface $entityManager */
        $entityManager = static::getContainer()->get(EntityManagerInterface::class);
        $auditEvent = $entityManager->getConnection()->fetchAssociative(
            'SELECT actor_identifier, action, result, workflow_session_id, context_generation, customer_reference FROM customer_audit_events WHERE request_id = ?',
            [$requestId],
        );
        self::assertIsArray($auditEvent);
        self::assertSame('test@example.org', $auditEvent['actor_identifier']);
        self::assertSame('CUSTOMER_SESSION_RESET', $auditEvent['action']);
        self::assertSame('success', $auditEvent['result']);
        self::assertSame('workflow-reset-audit', $auditEvent['workflow_session_id']);
        self::assertSame(11, (int) $auditEvent['context_generation']);

        $customerReference = \is_string($auditEvent['customer_reference'])
            ? json_decode($auditEvent['customer_reference'], true, flags: \JSON_THROW_ON_ERROR)
            : $auditEvent['customer_reference'];
        self::assertSame([
            'personId' => '11860448',
            'credentialKey' => 'tvk',
            'sourceSystem' => 'subscription-api',
            'divisionId' => '14',
            'mandant' => 'HMC',
        ], $customerReference);
    }

    public function testResetRequiresAuthenticationAndACompleteCustomerReference(): void
    {
        $unauthenticatedClient = static::createClient();
        $unauthenticatedClient->request(
            'POST',
            '/api/v1/customer-work-sessions/reset',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: '{}',
        );
        self::assertResponseStatusCodeSame(401);
        self::assertNotNull($unauthenticatedClient->getResponse()->headers->get('X-Kiwi-Request-Id'));

        static::ensureKernelShutdown();
        $authenticatedClient = $this->createAuthenticatedClient();
        $authenticatedClient->request(
            'POST',
            '/api/v1/customer-work-sessions/reset',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode([
                'workflowSessionId' => 'workflow-without-customer',
                'contextGeneration' => 1,
            ], \JSON_THROW_ON_ERROR),
        );

        self::assertResponseStatusCodeSame(400);
        $responsePayload = json_decode((string) $authenticatedClient->getResponse()->getContent(), true, flags: \JSON_THROW_ON_ERROR);
        self::assertSame('customer_reference_missing', $responsePayload['error']['code']);
    }
}
