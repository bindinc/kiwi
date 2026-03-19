<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Security\OidcUser;
use PHPUnit\Framework\TestCase;

final class OidcUserTest extends TestCase
{
    public function testEraseCredentialsIsMarkedAsDeprecated(): void
    {
        $method = new \ReflectionMethod(OidcUser::class, 'eraseCredentials');
        $attributes = $method->getAttributes(\Deprecated::class);

        self::assertCount(1, $attributes);

        $attribute = $attributes[0]->newInstance();

        self::assertSame('symfony/security-core 7.3', $attribute->since);
    }
}