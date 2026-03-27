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
use Symfony\Component\Routing\Annotation\Route;
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
      });
    </script>
  </body>
</html>
HTML;

        return new Response(sprintf(
            $html,
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
        $serverUrl = '' !== $scriptRoot ? $scriptRoot.'/api/v1' : '/api/v1';
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
                    'summary' => sprintf('%s %s', $method, str_replace('_', ' ', $name)),
                    'tags' => [$this->resolveTag($path)],
                    'responses' => $this->buildResponses(),
                    'security' => [['cookieAuth' => []]],
                ];
                if ([] !== $pathParameters) {
                    $operation['parameters'] = $pathParameters;
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
