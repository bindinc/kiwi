<?php

declare(strict_types=1);

namespace App\Oidc;

use League\OAuth2\Client\Provider\GenericProvider;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Contracts\HttpClient\HttpClientInterface;

class OidcClient
{
    public const DEFAULT_CLIENT_SECRETS_PATH = OidcConfiguration::DEFAULT_CLIENT_SECRETS_PATH;

    private ?OidcConfiguration $configurationService;
    private ?OidcRoleAccess $roleAccessService;
    private ?OidcServerMetadataProvider $serverMetadataProviderService;
    private ?OidcTokenInspector $tokenInspectorService;
    private ?OidcUserIdentityMapper $userIdentityMapperService;
    private ?OidcProfilePhotoClient $profilePhotoClientService;
    private ?OidcLogoutUrlBuilder $logoutUrlBuilderService;

    public function __construct(
        private readonly HttpClientInterface $httpClient,
        #[Autowire('%kernel.project_dir%')]
        private readonly string $projectDir,
        ?OidcConfiguration $configuration = null,
        ?OidcRoleAccess $roleAccess = null,
        ?OidcServerMetadataProvider $serverMetadataProvider = null,
        ?OidcTokenInspector $tokenInspector = null,
        ?OidcUserIdentityMapper $userIdentityMapper = null,
        ?OidcProfilePhotoClient $profilePhotoClient = null,
        ?OidcLogoutUrlBuilder $logoutUrlBuilder = null,
    ) {
        $this->configurationService = $configuration;
        $this->roleAccessService = $roleAccess;
        $this->serverMetadataProviderService = $serverMetadataProvider;
        $this->tokenInspectorService = $tokenInspector;
        $this->userIdentityMapperService = $userIdentityMapper;
        $this->profilePhotoClientService = $profilePhotoClient;
        $this->logoutUrlBuilderService = $logoutUrlBuilder;
    }

    /**
     * @return string[]
     */
    public function getAllowedRoles(): array
    {
        return $this->roleAccess()->getAllowedRoles();
    }

    /**
     * @return array<string, mixed>
     */
    public function getConfig(): array
    {
        return $this->configuration()->getConfig();
    }

    public function getClientSecretsPath(): string
    {
        return $this->configuration()->getClientSecretsPath();
    }

    public function createProvider(Request $request): GenericProvider
    {
        return $this->configuration()->createProvider($request);
    }

    public function getAuthorizationScope(): string
    {
        return $this->configuration()->getAuthorizationScope();
    }

    public function buildRedirectUri(Request $request): string
    {
        return $this->configuration()->buildRedirectUri($request);
    }

    public function buildLoggedOutUri(Request $request): string
    {
        return $this->logoutUrlBuilder()->buildLoggedOutUri($request);
    }

    /**
     * @return string[]
     */
    public function getScopes(): array
    {
        return $this->configuration()->getScopes();
    }

    /**
     * @return array<string, mixed>
     */
    public function exchangeAuthorizationCode(Request $request, string $code): array
    {
        $provider = $this->createProvider($request);
        $token = $provider->getAccessToken('authorization_code', ['code' => $code]);

        $profile = [];
        $resourceOwner = $provider->getResourceOwner($token);
        if (method_exists($resourceOwner, 'toArray')) {
            $profile = $resourceOwner->toArray();
        }

        return [
            'token' => $this->tokenInspector()->normalizeTokenData($token),
            'profile' => \is_array($profile) ? $profile : [],
        ];
    }

    public function normalizeTokenData(\League\OAuth2\Client\Token\AccessTokenInterface $token): array
    {
        return $this->tokenInspector()->normalizeTokenData($token);
    }

    /**
     * @param array<string, mixed> $sessionData
     * @return string[]
     */
    public function getUserRoles(array $sessionData): array
    {
        return $this->tokenInspector()->getUserRoles($sessionData);
    }

    /**
     * @param string[] $roles
     */
    public function userHasAccess(array $roles): bool
    {
        return $this->roleAccess()->userHasAccess($roles);
    }

    /**
     * @param array<string, mixed>|null $profile
     * @return array{first_name: string, last_name: string, full_name: string, initials: string, email: string|null}
     */
    public function buildUserIdentity(?array $profile): array
    {
        return $this->userIdentityMapper()->buildUserIdentity($profile);
    }

    /**
     * @param array<string, mixed> $sessionData
     */
    public function getProfileImage(array &$sessionData): ?string
    {
        return $this->profilePhotoClient()->getProfileImage($sessionData);
    }

    /**
     * @param array<string, mixed> $sessionData
     */
    public function getOidcIssuer(array $sessionData): ?string
    {
        return $this->tokenInspector()->getOidcIssuer($sessionData);
    }

    public function isMicrosoftIssuer(?string $issuer): bool
    {
        return $this->tokenInspector()->isMicrosoftIssuer($issuer);
    }

    /**
     * @param array<string, mixed> $sessionData
     * @return string[]
     */
    public function getTokenScopes(array $sessionData): array
    {
        return $this->tokenInspector()->getTokenScopes($sessionData);
    }

    public function getEndSessionEndpoint(): ?string
    {
        return $this->logoutUrlBuilder()->getEndSessionEndpoint();
    }

    public function getServerMetadataUrl(): ?string
    {
        return $this->serverMetadataProvider()->getServerMetadataUrl();
    }

    /**
     * @return string[]
     */
    public function getRedirectUrisFromSecrets(): array
    {
        return $this->configuration()->getRedirectUrisFromSecrets();
    }

    /**
     * @param array<string, mixed> $sessionData
     *
     * @throws \UnexpectedValueException
     */
    public function validateIdToken(array $sessionData, string $expectedNonce): void
    {
        $this->tokenInspector()->validateIdToken($sessionData, $expectedNonce);
    }

    public function buildEndSessionLogoutUrl(
        ?string $endSessionEndpoint,
        ?string $postLogoutRedirectUri = null,
        ?string $idTokenHint = null,
        ?string $clientId = null,
    ): ?string {
        return $this->logoutUrlBuilder()->buildEndSessionLogoutUrl(
            $endSessionEndpoint,
            $postLogoutRedirectUri,
            $idTokenHint,
            $clientId,
        );
    }

    /**
     * @param array<string, mixed> $sessionData
     */
    public function getAccessToken(array $sessionData): ?string
    {
        return $this->tokenInspector()->getAccessToken($sessionData);
    }

    /**
     * @param array<string, mixed> $sessionData
     */
    public function getIdToken(array $sessionData): ?string
    {
        return $this->tokenInspector()->getIdToken($sessionData);
    }

    /**
     * @param array<string, mixed> $sessionData
     * @return array<string, mixed>|null
     */
    public function getIdTokenClaims(array $sessionData): ?array
    {
        return $this->tokenInspector()->getIdTokenClaims($sessionData);
    }

    /**
     * @param array<string, mixed> $sessionData
     * @return array<string, mixed>|null
     */
    public function getAccessTokenClaims(array $sessionData): ?array
    {
        return $this->tokenInspector()->getAccessTokenClaims($sessionData);
    }

    /**
     * @param array<string, mixed> $sessionData
     */
    public function hasFreshSessionToken(array $sessionData): bool
    {
        return $this->tokenInspector()->hasFreshSessionToken($sessionData);
    }

    private function configuration(): OidcConfiguration
    {
        return $this->configurationService ??= new OidcConfiguration($this->projectDir);
    }

    private function roleAccess(): OidcRoleAccess
    {
        return $this->roleAccessService ??= new OidcRoleAccess();
    }

    private function serverMetadataProvider(): OidcServerMetadataProvider
    {
        return $this->serverMetadataProviderService ??= new OidcServerMetadataProvider(
            $this->httpClient,
            $this->configuration(),
        );
    }

    private function tokenInspector(): OidcTokenInspector
    {
        return $this->tokenInspectorService ??= new OidcTokenInspector(
            $this->httpClient,
            $this->configuration(),
            $this->serverMetadataProvider(),
        );
    }

    private function userIdentityMapper(): OidcUserIdentityMapper
    {
        return $this->userIdentityMapperService ??= new OidcUserIdentityMapper();
    }

    private function profilePhotoClient(): OidcProfilePhotoClient
    {
        return $this->profilePhotoClientService ??= new OidcProfilePhotoClient(
            $this->httpClient,
            $this->tokenInspector(),
        );
    }

    private function logoutUrlBuilder(): OidcLogoutUrlBuilder
    {
        return $this->logoutUrlBuilderService ??= new OidcLogoutUrlBuilder($this->serverMetadataProvider());
    }
}
