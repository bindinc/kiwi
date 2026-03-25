<?php

declare(strict_types=1);

namespace App\Webabo;

final readonly class HupApiCredential
{
    public function __construct(
        public string $name,
        public ?string $username,
        public ?string $password,
        public ?string $refreshToken,
    ) {
    }

    public function hasPasswordCredentials(): bool
    {
        return null !== $this->username && '' !== $this->username
            && null !== $this->password && '' !== $this->password;
    }

    public function hasRefreshToken(): bool
    {
        return null !== $this->refreshToken && '' !== $this->refreshToken;
    }
}
