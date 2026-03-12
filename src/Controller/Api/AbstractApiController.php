<?php

declare(strict_types=1);

namespace App\Controller\Api;

use App\Http\ApiProblemException;
use App\Oidc\OidcClient;
use App\Security\OidcUser;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Session\SessionInterface;

abstract class AbstractApiController extends AbstractController
{
    /**
     * @var string[]
     */
    private const PUBLIC_PATHS = ['/api/v1/status'];

    public function __construct(
        protected readonly OidcClient $oidcClient,
    ) {
    }

    protected function requireApiAccess(Request $request): void
    {
        $normalizedPath = rtrim($request->getPathInfo(), '/') ?: '/';
        if (\in_array($normalizedPath, self::PUBLIC_PATHS, true)) {
            return;
        }

        if (!$this->isApiAuthenticated($request)) {
            throw new ApiProblemException(401, 'unauthorized', 'Authentication required');
        }

        $roles = $this->oidcClient->getUserRoles($this->getSessionData($request));
        if (!$this->oidcClient->userHasAccess($roles)) {
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
        $sessionData = $this->getSessionData($request);
        $profile = \is_array($sessionData['oidc_auth_profile'] ?? null) ? $sessionData['oidc_auth_profile'] : [];

        return [
            'identity' => $this->oidcClient->buildUserIdentity($profile),
            'roles' => $this->oidcClient->getUserRoles($sessionData),
        ];
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
        $session = $request->getSession();
        $sessionData = [];

        foreach (['oidc_auth_profile', 'oidc_auth_token', 'oidc_profile_photo'] as $key) {
            $value = $session->get($key);
            if (\is_array($value) || (\is_string($value) && '' !== $value)) {
                $sessionData[$key] = $value;
            }
        }

        if (!isset($sessionData['oidc_auth_profile']) && $this->getUser() instanceof OidcUser) {
            $sessionData['oidc_auth_profile'] = $this->getUser()->getProfile();
        }

        return $sessionData;
    }

    /**
     * @return array<string, mixed>
     */
    protected function getAppConfig(): array
    {
        return [
            'TEAMS_PRESENCE_SYNC_ENABLED' => getenv('TEAMS_PRESENCE_SYNC_ENABLED') ?: true,
            'TEAMS_PRESENCE_SESSION_ID' => getenv('TEAMS_PRESENCE_SESSION_ID') ?: null,
            'OIDC_CLIENT_ID' => $this->oidcClient->getConfig()['client_id'] ?? null,
        ];
    }

    private function isApiAuthenticated(Request $request): bool
    {
        if ($this->getUser() instanceof OidcUser) {
            return true;
        }

        $sessionData = $this->getSessionData($request);

        return isset($sessionData['oidc_auth_profile']) || isset($sessionData['oidc_auth_token']);
    }
}
