<?php

declare(strict_types=1);

namespace App\Webabo;

interface WebaboSalesCodeCombinationProviderInterface
{
    /**
     * @return list<array<string, mixed>>
     */
    public function fetchCombinations(string $credentialName, string $productCode, \DateTimeImmutable $referenceDate): array;
}
