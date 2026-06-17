<?php

declare(strict_types=1);

namespace App\Tests\Unit\DevelopmentFeedback;

use App\Service\DevelopmentFeedback\SignedScreenshotUrlGenerator;
use PHPUnit\Framework\TestCase;

final class SignedScreenshotUrlGeneratorTest extends TestCase
{
    public function testTokenHashAndUrlGeneration(): void
    {
        $generator = new SignedScreenshotUrlGenerator();
        $token = $generator->createToken();
        $hash = $generator->hashToken($token);

        self::assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $token);
        self::assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $hash);
        self::assertTrue($generator->tokenMatches($token, $hash));
        self::assertFalse($generator->tokenMatches('wrong', $hash));
        self::assertSame(
            'https://bdc.rtvmedia.org/kiwi/api/v1/development-feedback/screenshots/public-id/token.png',
            $generator->buildUrl('https://bdc.rtvmedia.org/kiwi/', 'public-id', 'token'),
        );
    }
}
