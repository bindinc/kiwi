<?php

declare(strict_types=1);

namespace App\Security;

use App\Http\ApiProblemException;
use App\Oidc\OidcRoleAccess;
use Symfony\Component\HttpFoundation\RequestStack;

final class BusinessAccess
{
    public function __construct(private readonly RequestStack $requests) {}

    public function context(): AuthorizationContext
    {
        $request = $this->requests->getCurrentRequest();
        $data = $request?->hasSession() ? $request->getSession()->all() : [];
        $context = AuthorizationContext::fromSessionData($data);
        if (null === $context) {
            throw new ApiProblemException(401, 'unauthorized', 'A fresh verified sign-in is required');
        }
        if (!(new OidcRoleAccess())->userHasAccess($context->roles)) {
            throw new ApiProblemException(403, 'forbidden', 'No Kiwi application role');
        }
        return $context;
    }

    public function requireWrite(): void
    {
        if (!$this->context()->canWrite()) {
            throw new ApiProblemException(403, 'write_forbidden', 'The current role cannot change business data');
        }
    }

    public static function requireSessionWrite(\Symfony\Component\HttpFoundation\Session\SessionInterface $session): AuthorizationContext
    {
        $context = AuthorizationContext::fromSessionData($session->all());
        if (null === $context) {
            throw new ApiProblemException(401, 'unauthorized', 'A fresh verified sign-in is required');
        }
        if (!$context->canWrite()) {
            throw new ApiProblemException(403, 'write_forbidden', 'The current role cannot change business data');
        }
        return $context;
    }
}
