<?php

declare(strict_types=1);

namespace App\Controller\Api;

use App\Http\JsonRequestDecoder;
use App\Oidc\OidcConfiguration;
use App\Oidc\OidcRoleAccess;
use App\Oidc\RequestOidcContext;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Routing\RouterInterface;

#[Route('/api/v1')]
final class SwaggerController extends AbstractApiController
{
    public function __construct(
        RequestOidcContext $requestOidcContext,
        OidcRoleAccess $oidcRoleAccess,
        OidcConfiguration $oidcConfiguration,
        JsonRequestDecoder $jsonRequestDecoder,
        private readonly RouterInterface $router,
        private readonly \Symfony\Component\Security\Csrf\CsrfTokenManagerInterface $csrf,
    ) {
        parent::__construct($requestOidcContext, $oidcRoleAccess, $oidcConfiguration, $jsonRequestDecoder);
    }

    #[Route('/swagger.json', name: 'api_swagger_json', methods: ['GET'])]
    public function swaggerJson(Request $request): JsonResponse
    {
        $this->requireApiAccess($request);

        return $this->json($this->buildOpenApiDocument($request));
    }

    #[Route('/swagger', name: 'api_swagger_ui', methods: ['GET'])]
    public function swaggerUi(Request $request): Response
    {
        $this->requireApiAccess($request);

        $swaggerUiCss = $this->buildAssetPath($request, 'vendor/swagger-ui-dist/swagger-ui.css');
        $swaggerUiBundle = $this->buildAssetPath($request, 'vendor/swagger-ui-dist/swagger-ui-bundle.js');
        $swaggerUiStandalonePreset = $this->buildAssetPath($request, 'vendor/swagger-ui-dist/swagger-ui-standalone-preset.js');
        $swaggerUiFavicon32 = $this->buildAssetPath($request, 'vendor/swagger-ui-dist/favicon-32x32.png');
        $swaggerUiFavicon16 = $this->buildAssetPath($request, 'vendor/swagger-ui-dist/favicon-16x16.png');

        $html = <<<'HTML'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="kiwi-csrf-token" content="%s" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Kiwi API Swagger</title>
    <link rel="icon" type="image/png" href="%s" sizes="32x32" />
    <link rel="icon" type="image/png" href="%s" sizes="16x16" />
    <link rel="stylesheet" href="%s" />
    <style>
      body { margin: 0; background: #f8fafc; }
      #swagger-ui { max-width: 1200px; margin: 0 auto; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="%s"></script>
    <script src="%s"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: "./swagger.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset,
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl,
        ],
        layout: "StandaloneLayout",
        requestInterceptor: (request) => {
          if (!['GET', 'HEAD'].includes(request.method.toUpperCase())) {
            request.headers['X-CSRF-Token'] = document.querySelector('meta[name="kiwi-csrf-token"]').content;
          }
          return request;
        },
      });
    </script>
  </body>
</html>
HTML;

        return new Response(sprintf(
            $html,
            htmlspecialchars($this->csrf->getToken('kiwi_api')->getValue(), \ENT_QUOTES),
            htmlspecialchars($swaggerUiFavicon32, \ENT_QUOTES),
            htmlspecialchars($swaggerUiFavicon16, \ENT_QUOTES),
            htmlspecialchars($swaggerUiCss, \ENT_QUOTES),
            htmlspecialchars($swaggerUiBundle, \ENT_QUOTES),
            htmlspecialchars($swaggerUiStandalonePreset, \ENT_QUOTES),
        ), 200, ['Content-Type' => 'text/html']);
    }

    /**
     * @return array<string, mixed>
     */
    private function buildOpenApiDocument(Request $request): array
    {
        $scriptRoot = rtrim($request->getBasePath(), '/');
        $serverUrl = '' !== $scriptRoot ? $scriptRoot : '/';
        $paths = [];

        foreach ($this->router->getRouteCollection() as $name => $route) {
            $path = $route->getPath();
            if (!str_starts_with($path, '/api/v1')) {
                continue;
            }

            $openApiPath = rtrim($path, '/') ?: '/';
            $methods = array_values(array_filter(
                $route->getMethods() ?: ['GET'],
                static fn (string $method): bool => !\in_array($method, ['HEAD', 'OPTIONS'], true),
            ));

            $pathParameters = [];
            if (preg_match_all('/\{([^}]+)\}/', $path, $matches)) {
                foreach ($matches[1] as $parameterName) {
                    $pathParameters[] = [
                        'name' => $parameterName,
                        'in' => 'path',
                        'required' => true,
                        'schema' => ctype_digit($parameterName) ? ['type' => 'integer'] : ['type' => 'string'],
                    ];
                }
            }

            foreach ($methods as $method) {
                $operation = [
                    'operationId' => strtolower($method).'_'.$name,
                    'x-kiwi-policy' => \App\Security\ApiRoutePolicy::ROUTES[$name] ?? 'unclassified',
                    'summary' => sprintf('%s %s', $method, str_replace('_', ' ', $name)),
                    'tags' => [$this->resolveTag($path)],
                    'responses' => $this->buildResponses(),
                ];
                if ('api_development_feedback_screenshot' !== $name) {
                    $operation['security'] = [['cookieAuth' => []]];
                }
                if ([] !== $pathParameters) {
                    $operation['parameters'] = $pathParameters;
                }

                if ('api_address_search' === $name) {
                    $operation['requestBody'] = [
                        'required' => true,
                        'content' => ['application/json' => ['schema' => [
                            'type' => 'object',
                            'required' => ['formSessionId', 'postalCode', 'houseNumber'],
                            'properties' => [
                                'formSessionId' => ['type' => 'string', 'format' => 'uuid'],
                                'postalCode' => ['type' => 'string'],
                                'houseNumber' => ['type' => 'string'],
                                'houseNumberAddition' => ['type' => 'string'],
                            ],
                        ]]],
                    ];
                    $operation['responses']['200'] = [
                        'description' => 'Lookup result; only matched results include an address',
                        'content' => ['application/json' => ['schema' => [
                            'type' => 'object', 'required' => ['status'],
                            'properties' => [
                                'status' => ['type' => 'string', 'enum' => ['matched', 'not_found', 'ambiguous', 'unavailable']],
                                'address' => ['type' => 'object', 'required' => ['street', 'city'], 'properties' => [
                                    'street' => ['type' => 'string'], 'city' => ['type' => 'string'],
                                ]],
                            ],
                        ]]],
                    ];
                }
                if ('api_address_session_close' === $name) {
                    $operation['responses'] = ['204' => ['description' => 'Address form session closed']];
                }


                $customerOperation = $route->getDefault('operation');
                if (is_string($customerOperation) && isset(\App\SubscriptionApi\CustomerMutationInput::FIELDS[$customerOperation])) {
                    $properties = [];
                    foreach (\App\SubscriptionApi\CustomerMutationInput::FIELDS[$customerOperation] as $field) {
                        $properties[$field] = ['type' => 'string', 'maxLength' => 254];
                    }
                    $operation['description'] = 'Requires admin, supervisor or user, an unexpired verified session and CSRF. New source writes remain disabled pending verified upstream atomic version controls. No automatic retry on an uncertain result.';
                    $operation['parameters'] = array_merge($operation['parameters'] ?? [], [
                        ['in' => 'header', 'name' => 'X-CSRF-Token', 'required' => true, 'schema' => ['type' => 'string']],
                        ['in' => 'header', 'name' => 'Idempotency-Key', 'required' => true, 'schema' => ['type' => 'string', 'format' => 'uuid']],
                    ]);
                    $operation['requestBody'] = ['required' => true, 'content' => ['application/json' => ['schema' => [
                        'type' => 'object', 'additionalProperties' => false, 'required' => ['credentialKey', 'changes'],
                        'properties' => [
                            'credentialKey' => ['type' => 'string', 'description' => 'Configured source credential selector; never grants permissions'],
                            'expectedVersion' => ['type' => 'string', 'nullable' => true, 'description' => 'Supplier version; unavailable until the source concurrency contract is verified'],
                            'changes' => ['type' => 'object', 'additionalProperties' => false, 'properties' => (object) $properties],
                        ],
                    ]]]];
                    foreach ([409 => 'Source writes disabled, stale version, unverified resource or duplicate request',
                        415 => 'application/json required', 422 => 'Unknown field or invalid input', 428 => 'Verified source version required',
                        503 => 'Audit unavailable, source unavailable or outcome unknown; do not retry automatically'] as $code => $description) {
                        $operation['responses'][(string) $code] = ['description' => $description];
                    }
                }
                $paths[$openApiPath][strtolower($method)] = $operation;
            }
        }

        ksort($paths);

        return [
            'openapi' => '3.0.3',
            'info' => [
                'title' => 'Kiwi API',
                'version' => 'v1',
                'description' => 'Dynamically generated API overview for registered /api/v1 endpoints.',
            ],
            'servers' => [['url' => $serverUrl]],
            'components' => [
                'securitySchemes' => [
                    'cookieAuth' => [
                        'type' => 'apiKey',
                        'in' => 'cookie',
                        'name' => $request->getSession()->getName(),
                    ],
                ],
            ],
            'paths' => $paths,
        ];
    }

    /**
     * @return array<string, array<string, string>>
     */
    private function buildResponses(): array
    {
        $responses = ['200' => ['description' => 'Successful response']];
        $responses['401'] = ['description' => 'Authentication required'];
        $responses['403'] = ['description' => 'Insufficient permissions'];

        return $responses;
    }

    private function resolveTag(string $path): string
    {
        $parts = array_values(array_filter(explode('/', $path)));

        return $parts[2] ?? 'api';
    }

    private function buildAssetPath(Request $request, string $asset): string
    {
        $basePath = rtrim($request->getBasePath(), '/');

        return ('' !== $basePath ? $basePath : '').'/'.$asset;
    }
}
