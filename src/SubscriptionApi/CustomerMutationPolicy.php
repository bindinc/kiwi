<?php

declare(strict_types=1);

namespace App\SubscriptionApi;

use App\Http\ApiProblemException;
use App\Security\BusinessAccess;

/**
 * A role grants eligibility; it cannot supply missing upstream guarantees.
 * Replace the unconditional gate only with an implementation backed by supplier
 * contract tests for atomic concurrency and, for deletes, current bank links.
 */
final class CustomerMutationPolicy
{
    public const OPERATIONS = [
        'person.update' => ['PATCH', '/public/persons/{personid}', 'application/merge-patch+json'],
        'address.update' => ['PATCH', '/public/persons/{personid}/contacts/addresses/{rid}', 'application/merge-patch+json'],
        'email.update' => ['PATCH', '/public/persons/{personid}/contacts/emails/{rid}', 'application/merge-patch+json'],
        'phone.update' => ['PATCH', '/public/persons/{personid}/contacts/phones/{rid}', 'application/merge-patch+json'],
        'mobile.update' => ['PATCH', '/public/persons/{personid}/contacts/mobiles/{rid}', 'application/merge-patch+json'],
        'bank.create' => ['POST', '/public/persons/{personid}/payments/ibanitems', 'application/json'],
        'bank.update' => ['PATCH', '/public/persons/{personid}/payments/ibanitems/{rid}', 'application/json'],
        'bank.delete' => ['DELETE', '/public/persons/{personid}/payments/ibanitems/{rid}', null],
    ];

    public function __construct(private readonly BusinessAccess $access)
    {
    }

    /** @return array{roleCanWrite: bool, operations: array<string, array{enabled: bool, reason: string}>} */
    public function capabilities(): array
    {
        $context = $this->access->context();
        if (!$context->canRead()) {
            throw new ApiProblemException(403, 'forbidden', 'The current role cannot read business data');
        }

        $operations = [];
        foreach (self::OPERATIONS as $operation => $contract) {
            $operations[$operation] = [
                'enabled' => false,
                'reason' => $context->canWrite() ? 'upstream_concurrency_unverified' : 'write_forbidden',
            ];
        }

        return ['roleCanWrite' => $context->canWrite(), 'operations' => $operations];
    }

    public function requireMutation(string $operation): never
    {
        $this->access->requireWrite();
        if (!isset(self::OPERATIONS[$operation])) {
            throw new ApiProblemException(400, 'unsupported_customer_operation', 'Unknown customer mutation');
        }

        // No environment flag or request header may bypass this supplier-contract gate.
        throw new ApiProblemException(
            409,
            'upstream_concurrency_unverified',
            'Customer and bank writes require verified atomic upstream concurrency controls.',
        );
    }

    /** No version header is guessed from the incomplete supplier specification. */
    public function verifiedVersionCondition(string $version): array
    {
        throw new ApiProblemException(409, 'upstream_concurrency_unverified', 'No supported atomic source version condition has been confirmed');
    }
}
