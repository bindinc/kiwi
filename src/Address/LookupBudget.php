<?php

declare(strict_types=1);

namespace App\Address;

final class LookupBudget
{
    private readonly float $deadline;

    public function __construct(?float $deadline = null)
    {
        $this->deadline = $deadline ?? microtime(true) + 10.0;
    }

    public function deadline(): float
    {
        return $this->deadline;
    }

    public function options(): array
    {
        $remaining = $this->deadline - microtime(true);
        if ($remaining <= 0) {
            throw new ProviderFailure('deadline');
        }
        $duration = min(3.0, $remaining);

        return ['timeout' => $duration, 'max_duration' => $duration, 'max_redirects' => 0];
    }
}
