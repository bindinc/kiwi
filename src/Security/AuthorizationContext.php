<?php

declare(strict_types=1);

namespace App\Security;

final readonly class AuthorizationContext
{
    public const SESSION_KEY = 'kiwi_verified_authorization_v1';

    public function __construct(
        public string $actor,
        public string $tenant,
        public array $roles,
        public int $expiresAt,
    ) {
    }

    public static function fromSessionData(array $data): ?self
    {
        $value = $data[self::SESSION_KEY] ?? null;
        if (!is_array($value) || !is_string($value['actor'] ?? null)
            || !is_string($value['tenant'] ?? null) || !is_array($value['roles'] ?? null)
            || !is_int($value['expiresAt'] ?? null) || $value['expiresAt'] <= time()) {
            return null;
        }
        if ('' === $value['actor'] || '' === $value['tenant']) {
            return null;
        }
        foreach ($value['roles'] as $role) {
            if (!is_string($role)) {
                return null;
            }
        }

        return new self($value['actor'], $value['tenant'], $value['roles'], $value['expiresAt']);
    }

    public function toArray(): array
    {
        return get_object_vars($this);
    }

    public function canRead(): bool
    {
        return $this->canWrite() || in_array('bink8s.app.kiwi.view', $this->roles, true);
    }

    public function canWrite(): bool
    {
        return [] !== array_intersect($this->roles, [
            'bink8s.app.kiwi.admin', 'bink8s.app.kiwi.supervisor', 'bink8s.app.kiwi.user',
        ]);
    }
}
