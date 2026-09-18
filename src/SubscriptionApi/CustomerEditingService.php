<?php

declare(strict_types=1);
namespace App\SubscriptionApi;

use App\Http\ApiProblemException;
use App\Security\BusinessAccess;
use App\Webabo\HupApiConfigProvider;

final class CustomerEditingService
{
    public function __construct(
        private readonly BusinessAccess $access,
        private readonly CustomerMutationPolicy $policy,
        private readonly CustomerMutationInput $input,
        private readonly CustomerEditingSnapshot $snapshot,
        private readonly HupApiConfigProvider $config,
        private readonly PersonSearchClient $persons,
        private readonly CustomerMutationLedger $ledger,
        private readonly CustomerWriteClient $writer,
    ) {}

    public function read(string $personId, string $credentialKey): array
    {
        $capabilities = $this->policy->capabilities();
        $person = $this->loadPerson($personId, $credentialKey);
        return $this->snapshot->build($person) + [
            'personId' => $personId, 'credentialKey' => $credentialKey, 'capabilities' => $capabilities,
        ];
    }

    public function mutate(string $personId, ?string $resourceId, string $operation, array $body, string $key, string $correlation): array
    {
        $this->access->requireWrite();
        if (array_diff(array_keys($body), ['credentialKey', 'expectedVersion', 'changes'])) {
            throw new ApiProblemException(422, 'unknown_fields', 'Only credentialKey, expectedVersion and changes are accepted');
        }
        $credentialKey = $body['credentialKey'] ?? null;
        $version = $body['expectedVersion'] ?? null;
        if (!is_string($credentialKey) || !preg_match('/^[A-Za-z0-9_-]{1,100}$/D', $credentialKey)) {
            throw new ApiProblemException(422, 'invalid_credential', 'An explicit configured credential is required');
        }
        if (!preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/Di', $key)) {
            throw new ApiProblemException(422, 'invalid_idempotency_key', 'A UUID Idempotency-Key header is required');
        }
        $changes = $body['changes'] ?? [];
        if (!is_array($changes) || (array_is_list($changes) && [] !== $changes)) {
            throw new ApiProblemException(422, 'invalid_fields', 'changes must be an object');
        }
        $changes = $this->input->validate($operation, $changes);

        // Must run before resolving source credentials or making any database change.
        $this->policy->requireMutation($operation);

        // Activation PR must supply and verify the supplier's actual version mechanism.
        if (!is_string($version) || '' === $version || strlen($version) > 256) {
            throw new ApiProblemException(428, 'version_required', 'Reload the source version before saving');
        }
        $person = $this->loadPerson($personId, $credentialKey);
        $this->snapshot->verifySubresource($person, $operation, $resourceId);
        $credential = $this->config->getConfig()->getCredential($credentialKey);
        $actor = $this->access->context();
        $this->ledger->begin($actor, $key, $credential->mandant, $credentialKey, $personId, $resourceId, $operation, array_keys($changes), $correlation);
        try {
            $this->access->requireWrite();
            $this->writer->write($operation, $credentialKey, $personId, $resourceId, $changes, $version);
        } catch (ApiProblemException $exception) {
            $denied = in_array($exception->getStatus(), [401, 403, 409, 428], true);
            $outcome = $denied ? 'denied' : ($exception->getStatus() === 422 ? 'failed' : 'unknown');
            $this->ledger->finish($actor, $key, $outcome);
            throw $exception;
        } catch (\Throwable) {
            $this->ledger->finish($actor, $key, 'unknown');
            throw new ApiProblemException(503, 'mutation_outcome_unknown', 'The source may have saved this change; reload before continuing');
        }
        $this->ledger->finish($actor, $key, 'success');
        return $this->read($personId, $credentialKey);
    }

    private function loadPerson(string $personId, string $credentialKey): array
    {
        if (!preg_match('/^[A-Za-z0-9_-]{1,100}$/D', $personId) || '' === $credentialKey) {
            throw new ApiProblemException(422, 'invalid_customer_reference', 'An explicit source customer and credential are required');
        }
        try {
            $credential = $this->config->getConfig()->getCredential($credentialKey);
            $person = $this->persons->getPerson($personId, $credential->name);
        } catch (\RuntimeException) {
            throw new ApiProblemException(503, 'customer_editing_unavailable', 'The source customer could not be loaded');
        }
        $this->snapshot->verifyPerson($person, $personId, $credential);
        return $person;
    }
}
