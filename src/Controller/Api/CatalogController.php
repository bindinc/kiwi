<?php

declare(strict_types=1);

namespace App\Controller\Api;

use App\Http\ApiProblemException;
use App\Http\JsonRequestDecoder;
use App\Oidc\OidcConfiguration;
use App\Oidc\OidcRoleAccess;
use App\Oidc\RequestOidcContext;
use App\Service\PocCatalogService;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api/v1/catalog')]
final class CatalogController extends AbstractApiController
{
    public function __construct(
        RequestOidcContext $requestOidcContext,
        OidcRoleAccess $oidcRoleAccess,
        OidcConfiguration $oidcConfiguration,
        JsonRequestDecoder $jsonRequestDecoder,
        private readonly PocCatalogService $catalog,
    ) {
        parent::__construct($requestOidcContext, $oidcRoleAccess, $oidcConfiguration, $jsonRequestDecoder);
    }

    #[Route('/articles', name: 'api_catalog_articles', methods: ['GET'])]
    public function articles(Request $request): JsonResponse
    {
        $this->requireApiAccess($request);

        $limit = $this->parseQueryInt($request, 'limit', 20, 1, 250) ?? 20;
        $popularArg = strtolower(trim((string) $request->query->get('popular', '')));
        $popular = \in_array($popularArg, ['1', 'true', 'yes', 'on'], true);
        $magazine = $request->query->get('magazine');
        $tab = $request->query->get('tab');

        $items = $this->catalog->searchArticles(
            (string) $request->query->get('query', ''),
            \is_string($magazine) ? $magazine : null,
            $popular,
            \is_string($tab) ? $tab : null,
            $limit,
        );

        return $this->json([
            'items' => $items,
            'total' => count($items),
        ]);
    }

    #[Route('/articles/{articleId}', name: 'api_catalog_article', methods: ['GET'], requirements: ['articleId' => '\d+'])]
    public function article(Request $request, int $articleId): JsonResponse
    {
        $this->requireApiAccess($request);

        $article = $this->catalog->findArticle($articleId);
        if (null === $article) {
            throw new ApiProblemException(404, 'article_not_found', 'Article was not found');
        }

        return $this->json($article);
    }

    #[Route('/article-order-quote', name: 'api_catalog_article_order_quote', methods: ['POST'])]
    public function articleOrderQuote(Request $request): JsonResponse
    {
        $this->requireApiAccess($request);

        $payload = $this->parseJsonObject($request);

        $items = \is_array($payload['items'] ?? null) ? $payload['items'] : [];
        $couponCode = \is_string($payload['couponCode'] ?? null) ? $payload['couponCode'] : null;

        return $this->json($this->catalog->quoteArticleOrder($items, $couponCode));
    }

    #[Route('/delivery-calendar', name: 'api_catalog_delivery_calendar', methods: ['GET'])]
    public function deliveryCalendar(Request $request): JsonResponse
    {
        $this->requireApiAccess($request);

        $today = new \DateTimeImmutable('today');
        $year = $this->parseQueryInt($request, 'year', (int) $today->format('Y'), 1900, 2200) ?? (int) $today->format('Y');
        $month = $this->parseQueryInt($request, 'month', (int) $today->format('m'), 1, 12) ?? (int) $today->format('m');

        if ($month < 1 || $month > 12) {
            throw new ApiProblemException(400, 'invalid_month', 'Month must be between 1 and 12');
        }

        return $this->json($this->catalog->getDeliveryCalendar($year, $month));
    }

    #[Route('/disposition-options', name: 'api_catalog_disposition_options', methods: ['GET'])]
    public function dispositionOptions(Request $request): JsonResponse
    {
        $this->requireApiAccess($request);

        return $this->json(['categories' => $this->catalog->getDispositionCategories()]);
    }

    #[Route('/service-numbers', name: 'api_catalog_service_numbers', methods: ['GET'])]
    public function serviceNumbers(Request $request): JsonResponse
    {
        $this->requireApiAccess($request);

        return $this->json(['serviceNumbers' => $this->catalog->getServiceNumbers()]);
    }
}
