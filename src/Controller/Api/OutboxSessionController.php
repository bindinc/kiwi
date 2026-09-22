<?php

declare(strict_types=1);

namespace App\Controller\Api;

use App\OutboxSession\SessionOutbox;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/v1/outbox-sessions')]
final class OutboxSessionController extends AbstractController
{
    public function __construct(private readonly SessionOutbox $outbox) {}

    #[Route('', name: 'api_outbox_sessions_list', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        return $this->json($this->outbox->list($request->query->getInt('limit', 20), $request->query->getInt('offset', 0)));
    }

    #[Route('/{id}', name: 'api_outbox_sessions_get', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function get(int $id): JsonResponse { return $this->json($this->outbox->get($id)); }

    #[Route('/{id}/{action}', name: 'api_outbox_sessions_action', methods: ['POST'], requirements: ['id' => '\d+', 'action' => 'reopen|pause|resume|cancel'])]
    public function action(Request $request, int $id, string $action): JsonResponse
    {
        return $this->json($this->outbox->action($request, $id, $action));
    }
}
