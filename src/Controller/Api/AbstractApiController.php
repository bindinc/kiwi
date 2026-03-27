<?php

declare(strict_types=1);

namespace App\Controller\Api;

use App\Http\ApiProblemException;
use App\Http\JsonRequestDecoder;
use App\Oidc\OidcConfiguration;
use App\Oidc\OidcRoleAccess;
use App\Oidc\RequestOidcContext;
use App\Security\OidcUser;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;

abstract class AbstractApiController extends AbstractController
{
    public function __construct(
        protected readonly RequestOidcContext $requestOidcContext,
        protected readonly OidcRoleAccess $oidcRoleAccess,
        protected readonly OidcConfiguration $oidcConfiguration,
        protected readonly JsonRequestDecoder $jsonRequestDecoder,
    ) {
    }

    protected function requireApiAccess(Request $request): void
    {
        $authenticatedUser = $this->getAuthenticatedUser();
        if (!$this->requestOidcContext->isAuthenticated($request, $authenticatedUser)) {
            throw new ApiProblemException(401, 'unauthorized', 'Authentication required');
        }

        $roles = $this->requestOidcContext->getUserRoles($request, $authenticatedUser);
        if (!$this->oidcRoleAccess->userHasAccess($roles)) {
            throw new ApiProblemException(
                403,
                'forbidden',
                'Authenticated user does not have access to this API',
                ['roles' => $roles],
            );
        }
    }

    /**
     * @return array<string, mixed>
     */
    protected function getCurrentUserContext(Request $request): array
    {
        return $this->requestOidcContext->getCurrentUserContext($request, $this->getAuthenticatedUser());
    }

    protected function parseQueryInt(
        Request $request,
        string $name,
        ?int $default = null,
        ?int $minimum = null,
        ?int $maximum = null,
    ): ?int {
        return $this->parseIntValue(
            $request->query->get($name),
            $name,
            $default,
            true,
            $minimum,
            $maximum,
            'invalid_query_parameter',
        );
    }

    protected function parseIntValue(
        mixed $rawValue,
        string $fieldName,
        ?int $default = null,
        bool $required = true,
        ?int $minimum = null,
        ?int $maximum = null,
        string $errorCode = 'invalid_payload',
    ): ?int {
        $isMissing = null === $rawValue || '' === $rawValue;
        if ($isMissing) {
            if (null !== $default) {
                return $default;
            }

            if (!$required) {
                return null;
            }

            throw new ApiProblemException(400, $errorCode, sprintf('%s is required', $fieldName));
        }

        if (!is_numeric($rawValue) || (string) (int) $rawValue !== (string) trim((string) $rawValue)) {
            throw new ApiProblemException(400, $errorCode, sprintf('%s must be an integer', $fieldName));
        }

        $parsed = (int) $rawValue;
        if (null !== $minimum && $parsed < $minimum) {
            throw new ApiProblemException(400, $errorCode, sprintf('%s must be >= %d', $fieldName, $minimum));
        }

        if (null !== $maximum && $parsed > $maximum) {
            throw new ApiProblemException(400, $errorCode, sprintf('%s must be <= %d', $fieldName, $maximum));
        }

        return $parsed;
    }

    /**
     * @return array<string, mixed>
     */
    protected function getSessionData(Request $request): array
    {
        return $this->requestOidcContext->getSessionData($request, $this->getAuthenticatedUser());
    }

    /**
     * @return array<string, mixed>
     */
    protected function parseJsonObject(Request $request, string $errorCode = 'invalid_payload'): array
    {
        return $this->jsonRequestDecoder->decodeObject($request, $errorCode);
    }

    /**
     * @return array<string, mixed>
     */
    protected function getAppConfig(): array
    {
        return [
            'TEAMS_PRESENCE_SYNC_ENABLED' => $this->oidcConfiguration->isPresenceSyncEnabled(),
            'TEAMS_PRESENCE_SESSION_ID' => getenv('TEAMS_PRESENCE_SESSION_ID') ?: null,
            'OIDC_CLIENT_ID' => $this->oidcConfiguration->getClientId(),
        ];
    }

    private function getAuthenticatedUser(): ?OidcUser
    {
        $user = $this->getUser();

        return $user instanceof OidcUser ? $user : null;
    }
}
