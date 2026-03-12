<?php

declare(strict_types=1);

namespace App\Controller;

use App\Oidc\OidcClient;
use App\Security\OidcUser;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;

final class HomeController extends AbstractController
{
    public function __construct(
        private readonly OidcClient $oidcClient,
        private readonly TokenStorageInterface $tokenStorage,
    ) {
    }

    #[Route('/', name: 'app_home', methods: ['GET'])]
    public function index(Request $request): Response
    {
        if (!$this->isLoggedIn($request)) {
            return $this->redirectToRoute('app_login', ['next' => $request->getUri()]);
        }

        $sessionData = $this->getSessionData($request);
        $profile = \is_array($sessionData['oidc_auth_profile'] ?? null) ? $sessionData['oidc_auth_profile'] : [];
        $roles = $this->oidcClient->getUserRoles($sessionData);
        $identity = $this->oidcClient->buildUserIdentity($profile);
        $logoutUrl = $this->generateUrl('app_logout');

        if (!$this->oidcClient->userHasAccess($roles)) {
            return $this->render('base/access_denied.html.twig', [
                'user_full_name' => $identity['full_name'],
                'user_email' => $identity['email'],
                'user_roles' => $roles,
                'allowed_roles' => $this->oidcClient->getAllowedRoles(),
                'logout_url' => $logoutUrl,
            ], new Response('', 403));
        }

        $session = $request->getSession();
        $profileImage = $this->oidcClient->getProfileImage($sessionData);
        if (null !== $profileImage) {
            $session->set('oidc_profile_photo', $profileImage);
        }

        return $this->render('base/index.html.twig', [
            'user_full_name' => $identity['full_name'],
            'user_first_name' => $identity['first_name'],
            'user_last_name' => $identity['last_name'],
            'user_initials' => $identity['initials'],
            'user_profile_image' => $profileImage,
            'logout_url' => $logoutUrl,
        ]);
    }

    #[Route('/app-logout', name: 'app_logout', methods: ['GET'])]
    public function logout(Request $request): RedirectResponse
    {
        $session = $request->getSession();
        $sessionData = $this->getSessionData($request);
        $idTokenHint = $this->oidcClient->getIdToken($sessionData);
        $loggedOutUrl = $this->oidcClient->buildLoggedOutUri($request);
        $knownRedirectUris = $this->oidcClient->getRedirectUrisFromSecrets();
        $configuredPostLogoutRedirectUri = trim((string) (getenv('OIDC_POST_LOGOUT_REDIRECT_URI') ?: $loggedOutUrl));
        $postLogoutRedirectUri = \in_array($configuredPostLogoutRedirectUri, $knownRedirectUris, true)
            ? $configuredPostLogoutRedirectUri
            : null;

        $providerLogoutUrl = $this->oidcClient->buildEndSessionLogoutUrl(
            $this->oidcClient->getEndSessionEndpoint(),
            $postLogoutRedirectUri,
            $idTokenHint,
            $this->oidcClient->getConfig()['client_id'] ?? null,
        );

        $this->tokenStorage->setToken(null);
        $session->invalidate();

        return new RedirectResponse($providerLogoutUrl ?? $loggedOutUrl);
    }

    #[Route('/logged-out', name: 'app_logged_out', methods: ['GET'])]
    public function loggedOut(): Response
    {
        return $this->render('base/logged_out.html.twig', [
            'login_url' => $this->generateUrl('app_login', [
                'next' => $this->generateUrl('app_home', [], UrlGeneratorInterface::ABSOLUTE_URL),
            ]),
        ]);
    }

    private function isLoggedIn(Request $request): bool
    {
        if ($this->getUser() instanceof OidcUser) {
            return true;
        }

        $sessionData = $this->getSessionData($request);

        return isset($sessionData['oidc_auth_profile']) || isset($sessionData['oidc_auth_token']);
    }

    /**
     * @return array<string, mixed>
     */
    private function getSessionData(Request $request): array
    {
        $session = $request->getSession();
        $sessionData = [];

        $profile = $session->get('oidc_auth_profile');
        if (\is_array($profile)) {
            $sessionData['oidc_auth_profile'] = $profile;
        }

        $token = $session->get('oidc_auth_token');
        if (\is_array($token)) {
            $sessionData['oidc_auth_token'] = $token;
        }

        $photo = $session->get('oidc_profile_photo');
        if (\is_string($photo) && '' !== $photo) {
            $sessionData['oidc_profile_photo'] = $photo;
        }

        if (!isset($sessionData['oidc_auth_profile']) && $this->getUser() instanceof OidcUser) {
            $sessionData['oidc_auth_profile'] = $this->getUser()->getProfile();
        }

        return $sessionData;
    }
}
