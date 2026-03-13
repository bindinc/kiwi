<?php

declare(strict_types=1);

namespace App\EventSubscriber;

use App\Http\ApiProblemException;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Event\ExceptionEvent;
use Symfony\Component\HttpKernel\KernelEvents;

final class ApiProblemSubscriber implements EventSubscriberInterface
{
    public static function getSubscribedEvents(): array
    {
        return [
            KernelEvents::EXCEPTION => 'onKernelException',
        ];
    }

    public function onKernelException(ExceptionEvent $event): void
    {
        $exception = $event->getThrowable();
        if (!$exception instanceof ApiProblemException) {
            return;
        }

        $payload = [
            'error' => [
                'code' => $exception->getErrorCode(),
                'message' => $exception->getMessage(),
            ],
        ];

        if ([] !== $exception->getDetails()) {
            $payload['error']['details'] = $exception->getDetails();
        }

        $event->setResponse(new JsonResponse($payload, $exception->getStatus()));
    }
}
