<?php

declare(strict_types=1);

namespace App\SubscriptionApi;

use App\Webabo\HupApiCredential;

final readonly class CredentialPersonSearchResult
{
    /**
     * @param array<string, mixed> $payload
     */
    public function __construct(
        public HupApiCredential $credential,
        public array $payload,
    ) {
    }
}
