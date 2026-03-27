<?php

declare(strict_types=1);

namespace App\Http;

use Symfony\Component\HttpFoundation\Request;

final class JsonRequestDecoder
{
    /**
     * @return array<string, mixed>
     */
    public function decodeObject(Request $request, string $errorCode = 'invalid_payload'): array
    {
        try {
            $payload = json_decode($request->getContent(), true, 512, \JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new ApiProblemException(400, $errorCode, 'JSON object expected');
        }

        if (!\is_array($payload)) {
            throw new ApiProblemException(400, $errorCode, 'JSON object expected');
        }

        return $payload;
    }
}
