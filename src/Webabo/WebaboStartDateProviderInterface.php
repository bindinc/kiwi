<?php

declare(strict_types=1);

namespace App\Webabo;

interface WebaboStartDateProviderInterface
{
    public function fetchStartDate(string $credentialKey, string $productCode, string $variantCode): string;
}
