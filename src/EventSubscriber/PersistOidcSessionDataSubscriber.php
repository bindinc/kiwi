<?php

declare(strict_types=1);

namespace App\EventSubscriber;

use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\Security\Http\Event\LoginSuccessEvent;

final class PersistOidcSessionDataSubscriber implements EventSubscriberInterface
{
    public function onLoginSuccess(LoginSuccessEvent $event): void
    {
        $request = $event->getRequest();
        if (!$request->hasSession()) {
            return;
        }

        $profile = $request->attributes->get('oidc_auth_profile');
        $token = $request->attributes->get('oidc_auth_token');
        if (!\is_array($profile) && !\is_array($token)) {
            return;
        }

        $session = $request->getSession();

        // Persist OIDC data after Symfony migrates the session ID on login.
        if (\is_array($profile)) {
            $session->set('oidc_auth_profile', $profile);
        }

        if (\is_array($token)) {
            $session->set('oidc_auth_token', $token);
        }

        $session->remove('oidc_auth_state');
        $session->remove('oidc_auth_target_path');
    }

    public static function getSubscribedEvents(): array
    {
        return [
            LoginSuccessEvent::class => ['onLoginSuccess', -100],
        ];
    }
}
