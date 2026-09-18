<?php

declare(strict_types=1);

namespace App\Address;

use App\Http\ApiProblemException;
use Symfony\Component\HttpFoundation\Session\SessionInterface;

final class AddressSessionStore
{
    private const KEY = 'address_form_sessions';
    private const TTL = 43200;

    public static function validateId(mixed $id): string
    {
        if (!is_string($id) || !preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iD', $id)) {
            throw new ApiProblemException(400, 'invalid_form_session', 'formSessionId must be a UUID');
        }

        return strtolower($id);
    }

    public function uuid(SessionInterface $session, string $id, callable $createToken, ?int $now = null): string
    {
        $now ??= time();
        // start() acquires the shared PostgreSQL session advisory lock before reading or minting a token.
        $session->start();
        $entries = $this->entries($session, $now);
        $entry = $entries[$id] ?? null;
        if (null !== $entry && $entry['closed']) {
            throw new ApiProblemException(409, 'address_session_closed', 'Start a new address form session');
        }
        $sameDay = null !== $entry && gmdate('Y-m-d', $entry['createdAt']) === gmdate('Y-m-d', $now);
        if ($sameDay && is_string($entry['uuid'])) {
            return $entry['uuid'];
        }
        if (count($entries) >= 100 && !isset($entries[$id])) {
            throw new ApiProblemException(429, 'too_many_address_sessions', 'Too many address form sessions');
        }
        $uuid = $createToken();
        $entries[$id] = ['uuid' => $uuid, 'createdAt' => $now, 'closed' => false] + ($entry ?? []);
        $session->set(self::KEY, $entries);

        return $uuid;
    }

    public function assertOpen(SessionInterface $session, string $id): void
    {
        $entries = $this->entries($session, time());
        if ($entries[$id]['closed'] ?? false) {
            throw new ApiProblemException(409, 'address_session_closed', 'Start a new address form session');
        }
    }

    public function remember(SessionInterface $session, string $id, AddressQuery $query, array $result): void
    {
        $session->start();
        $this->assertOpen($session, $id);
        $entries = $this->entries($session, time());
        if (count($entries) >= 100 && !isset($entries[$id])) {
            throw new ApiProblemException(429, 'too_many_address_sessions', 'Too many address form sessions');
        }
        $entries[$id] ??= ['uuid' => null, 'createdAt' => time(), 'closed' => false];
        $entries[$id]['validation'] = ['postalCode' => $query->postalCode, 'houseNumber' => $query->houseNumber,
            'result' => $result, 'checkedAt' => time()];
        $session->set(self::KEY, $entries);
    }

    public function remembered(SessionInterface $session, string $id): ?array
    {
        $session->start();
        $this->assertOpen($session, $id);
        $entry = $this->entries($session, time())[$id] ?? null;
        $buffer = $entry['validation'] ?? null;
        if (null === $buffer || gmdate('Y-m-d', $buffer['checkedAt']) !== gmdate('Y-m-d')) {
            return null;
        }

        return $buffer;
    }

    public function close(SessionInterface $session, string $id): void
    {
        $session->start();
        $entries = $this->entries($session, time());
        if (count($entries) >= 100 && !isset($entries[$id])) {
            return;
        }
        // Keep a short-lived tombstone so a late search cannot reopen a submitted form.
        $entries[$id] = ['uuid' => null, 'createdAt' => time(), 'closed' => true];
        $session->set(self::KEY, $entries);
    }

    private function entries(SessionInterface $session, int $now): array
    {
        $entries = array_filter($session->get(self::KEY, []), static fn (array $entry): bool => $entry['createdAt'] + self::TTL > $now);
        $session->set(self::KEY, $entries);

        return $entries;
    }
}
