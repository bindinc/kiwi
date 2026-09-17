<?php

declare(strict_types=1);

namespace App\EventSubscriber;

use App\Http\ApiProblemException;
use App\Security\ApiRoutePolicy;
use App\Security\BusinessAccess;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpKernel\Event\ControllerEvent;
use Symfony\Component\HttpKernel\KernelEvents;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;
use Symfony\Component\Security\Csrf\CsrfToken;
use Symfony\Component\Security\Csrf\CsrfTokenManagerInterface;

final class ApiAuthorizationSubscriber implements EventSubscriberInterface
{
    public function __construct(
        private readonly BusinessAccess $access,
        private readonly AuthorizationCheckerInterface $authorization,
        private readonly CsrfTokenManagerInterface $csrf,
        #[\Symfony\Component\DependencyInjection\Attribute\Autowire('%kernel.environment%')]
        private readonly string $environment,
    ) {}

    public function authorize(ControllerEvent $event): void
    {
        $request = $event->getRequest();
        if (!$event->isMainRequest()) {
            return;
        }
        if (!str_starts_with($request->getPathInfo(), '/api/v1/')) {
            return;
        }
        $policy = ApiRoutePolicy::ROUTES[$request->attributes->get('_route')] ?? null;
        // Screenshot URLs already enforce their own expiring, signed capability.
        if ('signed-screenshot' === $policy) {
            return;
        }
        $this->access->context();
        if (null === $policy) {
            throw new ApiProblemException(403, 'unclassified_route', 'No access policy is defined');
        }
        if ('kiwi.local.write' === $policy && !in_array($this->environment, ['dev', 'test'], true)) {
            throw new ApiProblemException(404, 'route_disabled', 'This legacy route is disabled');
        }
        $permission = 'kiwi.local.write' === $policy ? 'kiwi.write' : $policy;
        if (!$this->authorization->isGranted($permission)) {
            throw new ApiProblemException(403, 'forbidden', 'The current role cannot perform this action');
        }
        if (!$request->isMethodSafe()) {
            $token = new CsrfToken('kiwi_api', (string) $request->headers->get('X-CSRF-Token', ''));
            if (!$this->csrf->isTokenValid($token)) {
                throw new ApiProblemException(403, 'csrf_invalid', 'A valid session CSRF token is required');
            }
            $origin = $request->headers->get('Origin');
            $crossSite = 'cross-site' === $request->headers->get('Sec-Fetch-Site');
            if ($crossSite || (null !== $origin && $origin !== $request->getSchemeAndHttpHost())) {
                throw new ApiProblemException(403, 'origin_forbidden', 'Cross-origin mutations are not allowed');
            }
        }
        $request->attributes->set('kiwi_authorized_policy', $policy);
    }

    public static function getSubscribedEvents(): array
    {
        return [KernelEvents::CONTROLLER => ['authorize', 20]];
    }
}
