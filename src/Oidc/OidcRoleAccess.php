<?php

declare(strict_types=1);

namespace App\Oidc;

final class OidcRoleAccess
{
    /**
     * @var string[]
     */
    private const ALLOWED_ROLES = [
        'bink8s.app.kiwi.admin',
        'bink8s.app.kiwi.dev',
        'bink8s.app.kiwi.supervisor',
        'bink8s.app.kiwi.user',
        'bink8s.app.kiwi.view',
    ];

    /**
     * @return string[]
     */
    public function getAllowedRoles(): array
    {
        return self::ALLOWED_ROLES;
    }

    /**
     * @param string[] $roles
     */
    public function userHasAccess(array $roles): bool
    {
        foreach ($roles as $role) {
            if (\in_array($role, self::ALLOWED_ROLES, true)) {
                return true;
            }
        }

        return false;
    }
}
