<?php

declare(strict_types=1);

namespace App\Controller\Api;

use App\Http\ApiProblemException;
use App\Http\JsonRequestDecoder;
use App\Oidc\OidcConfiguration;
use App\Oidc\OidcRoleAccess;
use App\Oidc\RequestOidcContext;
use App\Service\SubscriptionStartDates;
use App\Service\WebaboOfferCatalogService;
use App\Service\WebaboSalesCodeCombinationCatalogService;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/v1/webabo')]
final class WebaboOfferController extends AbstractApiController
{
    public function __construct(
        RequestOidcContext $requestOidcContext,
        OidcRoleAccess $oidcRoleAccess,
        OidcConfiguration $oidcConfiguration,
        JsonRequestDecoder $jsonRequestDecoder,
        private readonly WebaboOfferCatalogService $webaboOfferCatalog,
        private readonly WebaboSalesCodeCombinationCatalogService $salesCodeCombinationCatalog,
    ) {
        parent::__construct($requestOidcContext, $oidcRoleAccess, $oidcConfiguration, $jsonRequestDecoder);
    }

    #[Route('/offers', name: 'api_webabo_offers', methods: ['GET'])]
    public function offers(Request $request): JsonResponse
    {
        $this->requireApiAccess($request);

        $limit = $this->parseQueryInt($request, 'limit', 20, 1, 250) ?? 20;
        $items = $this->webaboOfferCatalog->search(
            (string) $request->query->get('query', ''),
            (string) $request->query->get('barcode', ''),
            $limit,
        );

        return $this->json([
            'items' => $items,
            'total' => count($items),
        ]);
    }

    #[Route('/offers/{salesCode}/start-date', name: 'api_webabo_offer_start_date', methods: ['GET'])]
    public function startDate(Request $request, string $salesCode, SubscriptionStartDates $dates): JsonResponse
    {
        $this->requireApiAccess($request);

        return $this->json($dates->lookup($salesCode, $request->query->get('variantCode')), headers: ['Cache-Control' => 'no-store']);
    }

    #[Route('/offers/{salesCode}/salescodecombinations', name: 'api_webabo_offer_salescode_combinations', methods: ['GET'])]
    public function salesCodeCombinations(Request $request, string $salesCode): JsonResponse
    {
        $this->requireApiAccess($request);

        $normalizedSalesCode = trim($salesCode);
        if ('' === $normalizedSalesCode) {
            throw new ApiProblemException(400, 'invalid_sales_code', 'salesCode must be a non-empty string');
        }

        return $this->json($this->salesCodeCombinationCatalog->getOfferSalesCodeCombinations($normalizedSalesCode));
    }
}
