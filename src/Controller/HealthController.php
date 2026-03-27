<?php

declare(strict_types=1);

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Annotation\Route;

final class HealthController extends AbstractController
{
    #[Route('/status', name: 'app_status', methods: ['GET'])]
    public function status(): JsonResponse
    {
        return $this->json([
            'status' => 'ok',
            'timestamp' => (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->format(\DateTimeInterface::ATOM),
            'rate_limit' => [
                'enabled' => false,
                'limit' => null,
                'remaining' => null,
                'reset_seconds' => null,
                'used' => null,
            ],
        ]);
    }
}
