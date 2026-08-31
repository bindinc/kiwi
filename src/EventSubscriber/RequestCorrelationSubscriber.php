<?php

declare(strict_types=1);

namespace App\EventSubscriber;

use App\Http\RequestCorrelationId;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\Event\ResponseEvent;
use Symfony\Component\HttpKernel\KernelEvents;

final readonly class RequestCorrelationSubscriber implements EventSubscriberInterface
{
    public function __construct(
        private RequestCorrelationId $requestCorrelationId,
    ) {
    }

    public function onKernelRequest(RequestEvent $event): void
    {
        if (!$event->isMainRequest()) {
            return;
        }

        $this->requestCorrelationId->getOrCreate($event->getRequest());
    }

    public function onKernelResponse(ResponseEvent $event): void
    {
        if (!$event->isMainRequest()) {
            return;
        }

        $requestId = $this->requestCorrelationId->getOrCreate($event->getRequest());
        $event->getResponse()->headers->set(RequestCorrelationId::RESPONSE_HEADER, $requestId);
    }

    public static function getSubscribedEvents(): array
    {
        return [
            KernelEvents::REQUEST => ['onKernelRequest', 32],
            KernelEvents::RESPONSE => 'onKernelResponse',
        ];
    }
}
