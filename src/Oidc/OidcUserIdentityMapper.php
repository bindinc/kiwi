<?php

declare(strict_types=1);

namespace App\Oidc;

final class OidcUserIdentityMapper
{
    /**
     * @param array<string, mixed>|null $profile
     * @return array{first_name: string, last_name: string, full_name: string, initials: string, email: string|null}
     */
    public function buildUserIdentity(?array $profile): array
    {
        $profile ??= [];

        $firstName = trim((string) ($profile['given_name'] ?? $profile['first_name'] ?? ''));
        $lastName = trim((string) ($profile['family_name'] ?? $profile['last_name'] ?? ''));

        $displayName = trim(implode(' ', array_filter([$firstName, $lastName])));
        $fallbackName = trim((string) ($profile['name'] ?? ''));

        if ('' === $displayName && '' !== $fallbackName) {
            $displayName = $fallbackName;
        }

        if ('' !== $displayName && ('' === $firstName || '' === $lastName)) {
            $parts = preg_split('/\s+/', $displayName) ?: [];
            if ([] !== $parts) {
                $firstName = '' !== $firstName ? $firstName : $parts[0];
                if (count($parts) > 1 && '' === $lastName) {
                    $lastName = $parts[count($parts) - 1];
                }
            }
        }

        $displayName = trim(implode(' ', array_filter([$firstName, $lastName])));
        if ('' === $displayName) {
            $displayName = trim((string) ($profile['preferred_username'] ?? $profile['email'] ?? 'Onbekende gebruiker'));
        }

        $initials = '';
        foreach ([$firstName, $lastName] as $part) {
            if ('' !== $part) {
                $initials .= strtoupper($part[0]);
            }
        }

        if ('' === $initials && '' !== $displayName) {
            $initials = strtoupper($displayName[0]);
        }

        $email = $profile['email'] ?? $profile['preferred_username'] ?? null;
        if (!\is_string($email) || '' === trim($email)) {
            $email = null;
        }

        return [
            'first_name' => $firstName,
            'last_name' => $lastName,
            'full_name' => $displayName,
            'initials' => $initials,
            'email' => $email,
        ];
    }
}
