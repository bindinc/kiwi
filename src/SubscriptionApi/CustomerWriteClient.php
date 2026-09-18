<?php

declare(strict_types=1);

namespace App\SubscriptionApi;

use App\Http\ApiProblemException;
use App\Security\BusinessAccess;
use App\Webabo\HupApiConfigProvider;
use App\Webabo\WebaboAccessTokenProvider;
use Symfony\Contracts\HttpClient\HttpClientInterface;
use Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface;

/** Single attempt only: a timeout or 5xx may follow a committed upstream mutation. */
final class CustomerWriteClient
{
    public function __construct(
        private readonly CustomerMutationPolicy $policy,
        private readonly CustomerMutationInput $input,
        private readonly HupApiConfigProvider $config,
        private readonly WebaboAccessTokenProvider $tokens,
        private readonly HttpClientInterface $httpClient,
        private readonly BusinessAccess $access,
        private readonly PersonSearchClient $persons,
        private readonly CustomerEditingSnapshot $snapshot,
    ) {}

    public function requestDefinition(string $operation, string $personId, ?string $resourceId, array $changes): array
    {
        $contract = CustomerMutationPolicy::OPERATIONS[$operation] ?? null;
        if (null === $contract) {
            throw new ApiProblemException(422, 'unsupported_customer_operation', 'Unknown customer operation');
        }
        if (!preg_match('/^[A-Za-z0-9_-]{1,100}$/D', $personId)) {
            throw new ApiProblemException(422, 'invalid_customer_reference', 'An explicit source customer is required');
        }
        [$method, $path, $contentType] = $contract;
        if (str_contains($path, '{rid}') && (null === $resourceId || !preg_match('/^[A-Za-z0-9_-]{1,100}$/D', $resourceId))) {
            throw new ApiProblemException(422, 'invalid_resource_reference', 'An explicit source resource is required');
        }
        return [
            'method' => $method,
            'path' => str_replace(['{personid}', '{rid}'], [rawurlencode($personId), rawurlencode($resourceId ?? '')], $path),
            'contentType' => $contentType,
            'payload' => $this->input->upstreamPayload($operation, $changes),
        ];
    }

    public function write(string $operation, string $credentialKey, string $personId, ?string $resourceId, array $changes, string $version): void
    {
        // Both entry points must remain independently guarded, including worker calls.
        $this->policy->requireMutation($operation);
        $definition = $this->requestDefinition($operation, $personId, $resourceId, $changes);
        $condition = $this->policy->verifiedVersionCondition($version);
        if ([] === $condition) {
            throw new ApiProblemException(428, 'version_required', 'An atomic source version condition is required');
        }
        if (!preg_match('/^[A-Za-z0-9_-]{1,100}$/D', $credentialKey)) {
            throw new ApiProblemException(422, 'invalid_credential', 'An explicit configured credential is required');
        }
        $config = $this->config->getConfig();
        $credential = $config->getCredential($credentialKey);
        $person = $this->persons->getPerson($personId, $credential->name);
        $this->snapshot->verifyPerson($person, $personId, $credential);
        $this->snapshot->verifySubresource($person, $operation, $resourceId);
        $baseUrl = rtrim((string) $config->ppaBaseUrl, '/');
        if (!str_starts_with($baseUrl, 'https://')) {
            throw new ApiProblemException(503, 'source_transport_unavailable', 'A secure source endpoint is required');
        }
        $headers = $condition + ['Accept' => 'application/json', 'Authorization' => 'Bearer '.$this->tokens->getAccessToken($credential->name)];
        $options = ['headers' => $headers, 'timeout' => 15.0, 'max_redirects' => 0];
        if (null !== $definition['contentType']) {
            $options['headers']['Content-Type'] = $definition['contentType'];
            $options['body'] = json_encode($definition['payload'], JSON_THROW_ON_ERROR);
        }
        $this->access->requireWrite();
        try {
            $response = $this->httpClient->request($definition['method'], $baseUrl.$definition['path'], $options);
            $status = $response->getStatusCode();
            // Consume lazy responses inside the transport exception boundary. Do not log bodies.
            $response->getContent(false);
        } catch (TransportExceptionInterface) {
            throw new ApiProblemException(503, 'mutation_outcome_unknown', 'The source outcome is unknown; reload before continuing');
        }
        if (in_array($status, [409, 412], true)) {
            throw new ApiProblemException(409, 'source_version_conflict', 'The source changed; reload before saving again');
        }
        if ($status >= 400 && $status < 500) {
            throw new ApiProblemException(422, 'source_mutation_rejected', 'The source rejected this change');
        }
        if ($status < 200 || $status >= 300) {
            throw new ApiProblemException(503, 'mutation_outcome_unknown', 'The source outcome is unknown; reload before continuing');
        }
    }
}
