<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\CustomerWorkSession\CustomerReference;
use App\CustomerWorkSession\CustomerRequestContext;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Request;

final class CustomerRequestContextTest extends TestCase
{
    public function testBuildsFullReferenceFromRequestHeaders(): void
    {
        $request = Request::create('/api/v1/persons/11860448');
        $request->headers->set('X-Kiwi-Workflow-Session-Id', 'workflow-42');
        $request->headers->set('X-Kiwi-Context-Generation', '7');
        $request->headers->set('X-Kiwi-Customer-Person-Id', '11860448');
        $request->headers->set('X-Kiwi-Customer-Credential-Key', 'tvk');
        $request->headers->set('X-Kiwi-Customer-Source-System', 'subscription-api');
        $request->headers->set('X-Kiwi-Customer-Division-Id', '14');
        $request->headers->set('X-Kiwi-Customer-Mandant', 'HMC');

        $context = CustomerRequestContext::fromRequest($request, 'fallback');

        self::assertSame('workflow-42', $context->workflowSessionId);
        self::assertSame(7, $context->contextGeneration);
        self::assertSame([
            'personId' => '11860448',
            'credentialKey' => 'tvk',
            'sourceSystem' => 'subscription-api',
            'divisionId' => '14',
            'mandant' => 'HMC',
        ], $context->customerReference?->toArray());
    }

    public function testPayloadContextTakesPrecedenceOverHeaders(): void
    {
        $request = Request::create('/api/v1/customer-work-sessions/reset');
        $request->headers->set('X-Kiwi-Workflow-Session-Id', 'header-session');

        $context = CustomerRequestContext::fromRequest($request, 'fallback', [
            'workflowSessionId' => 'payload-session',
            'contextGeneration' => 3,
            'customerReference' => [
                'personId' => 27,
                'sourceSystem' => 'kiwi',
            ],
        ]);

        self::assertSame('payload-session', $context->workflowSessionId);
        self::assertSame(3, $context->contextGeneration);
        self::assertSame('27', $context->customerReference?->personId);
    }

    public function testReferenceInfersSourceFromCredentialContext(): void
    {
        $reference = CustomerReference::fromArray([
            'personId' => '73',
            'credentialKey' => 'tvk',
        ]);

        self::assertSame('subscription-api', $reference?->sourceSystem);
    }
}
