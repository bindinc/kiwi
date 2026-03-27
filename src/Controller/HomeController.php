<?php

declare(strict_types=1);

namespace App\Controller;

use App\Oidc\OidcConfiguration;
use App\Oidc\OidcLogoutUrlBuilder;
use App\Oidc\OidcProfilePhotoClient;
use App\Oidc\OidcRoleAccess;
use App\Oidc\OidcTokenInspector;
use App\Oidc\RequestOidcContext;
use App\Security\OidcUser;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Csrf\CsrfToken;
use Symfony\Component\Security\Csrf\CsrfTokenManagerInterface;

final class HomeController extends AbstractController
{
    private const LOGOUT_CSRF_TOKEN_ID = 'app_logout';

    public function __construct(
        private readonly RequestOidcContext $requestOidcContext,
        private readonly OidcRoleAccess $oidcRoleAccess,
        private readonly OidcConfiguration $oidcConfiguration,
        private readonly OidcTokenInspector $oidcTokenInspector,
        private readonly OidcProfilePhotoClient $oidcProfilePhotoClient,
        private readonly OidcLogoutUrlBuilder $oidcLogoutUrlBuilder,
        private readonly TokenStorageInterface $tokenStorage,
        private readonly CsrfTokenManagerInterface $csrfTokenManager,
    ) {
    }

    #[Route('/', name: 'app_home', methods: ['GET'])]
    public function index(Request $request): Response
    {
        $authenticatedUser = $this->getAuthenticatedUser();
        if (!$this->requestOidcContext->isAuthenticated($request, $authenticatedUser)) {
            return $this->redirectToRoute('app_login', ['next' => $request->getUri()]);
        }

        $sessionData = $this->requestOidcContext->getSessionData($request, $authenticatedUser);
        $currentUserContext = $this->requestOidcContext->getCurrentUserContext($request, $authenticatedUser);
        $roles = $currentUserContext['roles'];
        $identity = $currentUserContext['identity'];
        $logoutUrl = $this->generateUrl('app_logout');

        if (!$this->oidcRoleAccess->userHasAccess($roles)) {
            return $this->render('base/access_denied.html.twig', [
                'user_full_name' => $identity['full_name'],
                'user_email' => $identity['email'],
                'user_roles' => $roles,
                'allowed_roles' => $this->oidcRoleAccess->getAllowedRoles(),
                'logout_url' => $logoutUrl,
            ], new Response('', 403));
        }

        $session = $request->getSession();
        $profileImage = $this->oidcProfilePhotoClient->getProfileImage($sessionData);
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

    #[Route('/app-logout', name: 'app_logout', methods: ['GET', 'POST'])]
    public function logout(Request $request): Response
    {
        if (!$request->isMethod('POST')) {
            return new Response('', Response::HTTP_METHOD_NOT_ALLOWED, ['Allow' => 'POST']);
        }

        $submittedToken = trim((string) $request->request->get('_csrf_token', ''));
        if (!$this->csrfTokenManager->isTokenValid(new CsrfToken(self::LOGOUT_CSRF_TOKEN_ID, $submittedToken))) {
            throw $this->createAccessDeniedException('Invalid logout CSRF token.');
        }

        $session = $request->getSession();
        $sessionData = $this->requestOidcContext->getSessionData($request, $this->getAuthenticatedUser());
        $idTokenHint = $this->oidcTokenInspector->getIdToken($sessionData);
        $loggedOutUrl = $this->oidcLogoutUrlBuilder->buildLoggedOutUri($request);
        $knownRedirectUris = $this->oidcConfiguration->getRedirectUrisFromSecrets();
        $configuredPostLogoutRedirectUri = trim((string) (getenv('OIDC_POST_LOGOUT_REDIRECT_URI') ?: $loggedOutUrl));
        $postLogoutRedirectUri = \in_array($configuredPostLogoutRedirectUri, $knownRedirectUris, true)
            ? $configuredPostLogoutRedirectUri
            : null;

        $providerLogoutUrl = $this->oidcLogoutUrlBuilder->buildEndSessionLogoutUrl(
            $this->oidcLogoutUrlBuilder->getEndSessionEndpoint(),
            $postLogoutRedirectUri,
            $idTokenHint,
            $this->oidcConfiguration->getClientId(),
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

    private function getAuthenticatedUser(): ?OidcUser
    {
        $user = $this->getUser();

        return $user instanceof OidcUser ? $user : null;
    }
}
