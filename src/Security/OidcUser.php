<?php

declare(strict_types=1);

namespace App\Security;

use Symfony\Component\Security\Core\User\UserInterface;

final class OidcUser implements UserInterface
{
    /**
     * @param string[] $roles
     * @param array<string, mixed> $profile
     */
    public function __construct(
        private string $identifier,
        private array $roles,
        private array $profile,
    ) {
    }

    /**
     * @param array<string, mixed> $profile
     * @param string[] $roles
     */
    public static function fromProfile(array $profile, array $roles): self
    {
        $identifier = self::resolveIdentifier($profile);

        return new self($identifier, $roles, $profile);
    }

    public function getUserIdentifier(): string
    {
        return $this->identifier;
    }

    /**
     * @return string[]
     */
    public function getRoles(): array
    {
        return array_values(array_unique($this->roles));
    }

    /**
     * @return array<string, mixed>
     */
    public function getProfile(): array
    {
        return $this->profile;
    }

    public function eraseCredentials(): void
    {
    }

    /**
     * @return array{identifier: string, roles: string[], profile: array<string, mixed>}
     */
    public function __serialize(): array
    {
        return [
            'identifier' => $this->identifier,
            'roles' => $this->roles,
            'profile' => $this->profile,
        ];
    }

    /**
     * @param array{identifier: string, roles: string[], profile: array<string, mixed>} $data
     */
    public function __unserialize(array $data): void
    {
        $this->identifier = $data['identifier'];
        $this->roles = $data['roles'];
        $this->profile = $data['profile'];
    }

    /**
     * @param array<string, mixed> $profile
     */
    private static function resolveIdentifier(array $profile): string
    {
        foreach (['preferred_username', 'email', 'sub', 'name'] as $candidate) {
            $value = $profile[$candidate] ?? null;
            if (\is_string($value) && '' !== trim($value)) {
                return trim($value);
            }
        }

        return 'kiwi-user';
    }
}
