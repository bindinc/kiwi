<?php

declare(strict_types=1);

namespace App\Webabo;

final readonly class HupApiCredential
{
    public function __construct(
        public string $name,
        public ?string $title,
        public ?string $mandant,
        public ?bool $supportsPersonLookup,
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

    /**
     * @return array<string, bool|string>
     */
    public function toContextPayload(?string $sourceSystem = null): array
    {
        $payload = [
            'credentialKey' => $this->name,
        ];

        if (null !== $this->title) {
            $payload['credentialTitle'] = $this->title;
        }

        if (null !== $this->mandant) {
            $payload['mandant'] = $this->mandant;
        }

        if (null !== $this->supportsPersonLookup) {
            $payload['supportsPersonLookup'] = $this->supportsPersonLookup;
        }

        if (null !== $sourceSystem) {
            $normalizedSourceSystem = trim($sourceSystem);
            if ('' !== $normalizedSourceSystem) {
                $payload['sourceSystem'] = $normalizedSourceSystem;
            }
        }

        return $payload;
    }
}
