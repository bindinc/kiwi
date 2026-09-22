<?php

declare(strict_types=1);
namespace App\Tests\Functional;

use App\OutboxSession\SessionSchema;
use Doctrine\DBAL\Connection;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;

trait OutboxTestTrait
{
    private function resetOutboxStorage(): void
    {
        $db = static::getContainer()->get(Connection::class);
        (new SessionSchema($db))->migrate();
        $db->executeStatement("DELETE FROM customer_outbox_receipts WHERE tenant = 'test-tenant'");
        $db->executeStatement("DELETE FROM customer_outbox_audit WHERE session_id IN (SELECT id FROM customer_outbox_sessions WHERE tenant = 'test-tenant')");
        $db->executeStatement("DELETE FROM customer_outbox_sessions WHERE tenant = 'test-tenant'");
    }

    private function prepareOutboxWrite(KernelBrowser $client, ?string $key = null): void
    {
        $client->setServerParameter('HTTP_IDEMPOTENCY_KEY', $key ?? bin2hex(random_bytes(16)));
        $db = static::getContainer()->get(Connection::class);
        $row = $db->fetchAssociative("SELECT id, revision FROM customer_outbox_sessions WHERE tenant = 'test-tenant' AND status IN ('pending','paused') ORDER BY id DESC LIMIT 1");
        if ($row) $client->setServerParameter('HTTP_X_KIWI_OUTBOX_REVISION', (string) $row['revision']);
    }
}
