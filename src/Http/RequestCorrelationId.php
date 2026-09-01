<?php

declare(strict_types=1);

namespace App\Http;

use Symfony\Component\HttpFoundation\Request;

final class RequestCorrelationId
{
    public const ATTRIBUTE = '_kiwi_request_id';
    public const RESPONSE_HEADER = 'X-Kiwi-Request-Id';

    public function getOrCreate(Request $request): string
    {
        $existingRequestId = $request->attributes->get(self::ATTRIBUTE);
        if (\is_string($existingRequestId) && '' !== $existingRequestId) {
            return $existingRequestId;
        }

        $requestId = bin2hex(random_bytes(16));
        $request->attributes->set(self::ATTRIBUTE, $requestId);

        return $requestId;
    }
}
