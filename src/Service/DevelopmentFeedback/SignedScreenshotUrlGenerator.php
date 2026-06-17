<?php

declare(strict_types=1);

namespace App\Service\DevelopmentFeedback;

final class SignedScreenshotUrlGenerator
{
    public function createToken(): string
    {
        return bin2hex(random_bytes(32));
    }

    public function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    public function tokenMatches(string $submittedToken, string $storedHash): bool
    {
        return hash_equals($storedHash, $this->hashToken($submittedToken));
    }

    public function buildUrl(string $publicBaseUrl, string $publicId, string $token): string
    {
        return sprintf(
            '%s/api/v1/development-feedback/screenshots/%s/%s.png',
            rtrim($publicBaseUrl, '/'),
            rawurlencode($publicId),
            rawurlencode($token),
        );
    }
}
