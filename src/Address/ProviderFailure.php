<?php

declare(strict_types=1);

namespace App\Address;

final class ProviderFailure extends \RuntimeException
{
    public function __construct(public readonly string $reason, public readonly bool $allowFallback = true)
    {
        // Never retain the original exception: HTTP exceptions can contain credentials or addresses.
        parent::__construct('Address provider unavailable');
    }
}
