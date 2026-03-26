<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\OutboxEvent;
use App\Entity\SubscriptionOrder;
use App\Entity\WebaboOffer;
use App\Http\ApiProblemException;
use App\Outbox\SubscriptionQueueSchemaManager;
use App\Repository\SubscriptionOrderRepository;
use App\Repository\WebaboOfferRepository;
use App\Webabo\WebaboOfferCacheSchemaManager;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Exception\UniqueConstraintViolationException;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\Session\SessionInterface;

final class SubscriptionQueueService
{
    public function __construct(
        private readonly SubscriptionQueueSchemaManager $schemaManager,
        private readonly SubscriptionOrderRepository $repository,
        private readonly EntityManagerInterface $entityManager,
        private readonly Connection $connection,
        private readonly PocStateService $stateService,
        private readonly SubscriptionQueueDisplayFormatter $displayFormatter,
        private readonly WebaboOfferCacheSchemaManager $webaboOfferCacheSchemaManager,
        private readonly WebaboOfferRepository $webaboOfferRepository,
    ) {
    }

    /**
     * @param array<string, mixed> $payload
     * @param array<string, mixed> $currentUserContext
     * @return array<string, mixed>
     */
    public function queueSubscription(SessionInterface $session, array $payload, array $currentUserContext): array
    {
        $submissionId = $this->normalizeSubmissionId($payload['submissionId'] ?? null);
        $this->ensureQueueSchema();

        $existingOrder = $this->repository->findOneBySubmissionId($submissionId);
        if (null !== $existingOrder) {
            return $this->mapOrderToApiPayload($existingOrder);
        }

        $normalizedPayload = $this->normalizeQueuePayload($session, $payload);
        $normalizedPayload['submissionId'] = $submissionId;
        $summaryPayload = $this->buildSummaryPayload($normalizedPayload, $currentUserContext);
        $queuedAt = $this->createUtcNow();

        $subscriptionOrder = new SubscriptionOrder(
            $submissionId,
            $normalizedPayload,
            $summaryPayload,
            $queuedAt,
        );
        $subscriptionOrder->addOutboxEvent(new OutboxEvent(
            'subscription.created',
            [
                'submissionId' => $submissionId,
                'request' => $normalizedPayload,
                'summary' => $summaryPayload,
            ],
            $queuedAt,
        ));

        $transactionStarted = false;

        try {
            $this->connection->beginTransaction();
            $transactionStarted = true;

            $this->entityManager->persist($subscriptionOrder);
            $this->entityManager->flush();

            $this->connection->commit();
            $transactionStarted = false;
        } catch (UniqueConstraintViolationException $exception) {
            if ($transactionStarted) {
                $this->connection->rollBack();
            }

            $this->entityManager->clear();
            $existingOrder = $this->repository->findOneBySubmissionId($submissionId);
            if (null !== $existingOrder) {
                return $this->mapOrderToApiPayload($existingOrder);
            }

            throw $this->buildQueueUnavailableException($exception);
        } catch (\Throwable $exception) {
            if ($transactionStarted) {
                $this->connection->rollBack();
            }

            $this->entityManager->clear();

            throw $this->buildQueueUnavailableException($exception);
        }

        return $this->mapOrderToApiPayload($subscriptionOrder);
    }

    /**
     * @return array{items: list<array<string, mixed>>}
     */
    public function listRecentOrders(int $limit): array
    {
        if (!$this->schemaManager->hasQueueTables()) {
            return ['items' => []];
        }

        try {
            return [
                'items' => array_map(
                    fn (SubscriptionOrder $subscriptionOrder): array => $this->mapOrderToApiPayload($subscriptionOrder),
                    $this->repository->findRecent($limit),
                ),
            ];
        } catch (\Throwable $exception) {
            throw $this->buildQueueUnavailableException($exception);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function getOrderStatus(int $orderId): array
    {
        if (!$this->schemaManager->hasQueueTables()) {
            throw new ApiProblemException(404, 'subscription_order_not_found', 'Subscription order not found');
        }

        try {
            $subscriptionOrder = $this->repository->findOneDetailed($orderId);
        } catch (\Throwable $exception) {
            throw $this->buildQueueUnavailableException($exception);
        }

        if (null === $subscriptionOrder) {
            throw new ApiProblemException(404, 'subscription_order_not_found', 'Subscription order not found');
        }

        return $this->mapOrderToApiPayload($subscriptionOrder);
    }

    private function ensureQueueSchema(): void
    {
        try {
            $this->schemaManager->ensureSchema();
        } catch (\Throwable $exception) {
            throw $this->buildQueueUnavailableException($exception);
        }
    }

    private function normalizeSubmissionId(mixed $value): string
    {
        if (!\is_string($value)) {
            throw new ApiProblemException(400, 'invalid_payload', 'submissionId must be a non-empty string');
        }

        $submissionId = trim($value);
        if ('' === $submissionId) {
            throw new ApiProblemException(400, 'invalid_payload', 'submissionId must be a non-empty string');
        }

        if (strlen($submissionId) > 128) {
            throw new ApiProblemException(400, 'invalid_payload', 'submissionId must be at most 128 characters');
        }

        return $submissionId;
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    private function normalizeQueuePayload(SessionInterface $session, array $payload): array
    {
        $recipient = $this->normalizeRolePayload($session, $payload['recipient'] ?? null, 'recipient', false);
        $requester = $this->normalizeRolePayload($session, $payload['requester'] ?? null, 'requester', true);
        if (true === ($requester['sameAsRecipient'] ?? false)) {
            $requester = [
                'mode' => 'same_as_recipient',
                'sameAsRecipient' => true,
                'personId' => $recipient['personId'] ?? null,
                'person' => $recipient['person'] ?? [],
            ];
        }

        return [
            'recipient' => $recipient,
            'requester' => $requester,
            'subscription' => $this->normalizeSubscriptionPayload($payload['subscription'] ?? null),
            'offer' => $this->normalizeOfferPayload($payload['offer'] ?? null),
            'contactEntry' => $this->normalizeContactEntry($payload['contactEntry'] ?? null),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function normalizeRolePayload(
        SessionInterface $session,
        mixed $rolePayload,
        string $roleName,
        bool $allowSameAsRecipient,
    ): array {
        if (!\is_array($rolePayload)) {
            throw new ApiProblemException(400, 'invalid_payload', sprintf('%s must be an object', $roleName));
        }

        $hasPersonId = null !== ($rolePayload['personId'] ?? null) && '' !== trim((string) ($rolePayload['personId'] ?? ''));
        $personPayload = \is_array($rolePayload['person'] ?? null) ? $rolePayload['person'] : null;
        $hasNewPersonPayload = !$hasPersonId && \is_array($personPayload);
        $hasExistingPersonSnapshot = $hasPersonId && \is_array($personPayload) && [] !== $personPayload;
        $hasSameAsRecipient = $allowSameAsRecipient && true === ($rolePayload['sameAsRecipient'] ?? false);
        $selectedModes = (int) $hasPersonId + (int) $hasNewPersonPayload + (int) $hasSameAsRecipient;

        if (1 !== $selectedModes) {
            $allowed = $allowSameAsRecipient ? 'personId, person, or sameAsRecipient=true' : 'personId or person';
            throw new ApiProblemException(400, 'invalid_payload', sprintf('%s must contain exactly one of %s', $roleName, $allowed));
        }

        if ($hasSameAsRecipient) {
            return [
                'mode' => 'same_as_recipient',
                'sameAsRecipient' => true,
                'personId' => null,
                'person' => [],
            ];
        }

        if ($hasPersonId) {
            if (!is_numeric($rolePayload['personId']) || (string) (int) $rolePayload['personId'] !== trim((string) $rolePayload['personId'])) {
                throw new ApiProblemException(400, 'invalid_payload', sprintf('%s.personId must be an integer', $roleName));
            }

            $personId = (int) $rolePayload['personId'];
            if ($personId < 1) {
                throw new ApiProblemException(400, 'invalid_payload', sprintf('%s.personId must be >= 1', $roleName));
            }

            $roleContext = $this->extractCredentialContext($rolePayload);
            if ($hasExistingPersonSnapshot) {
                $personContext = $this->extractCredentialContext($personPayload);

                return [
                    'mode' => 'existing',
                    'personId' => $personId,
                    'person' => $this->buildPersonSnapshot($personPayload, $roleContext + $personContext),
                ];
            }

            $person = $this->stateService->getCustomer($session, $personId);
            $personContext = $this->extractCredentialContext($person);

            return [
                'mode' => 'existing',
                'personId' => $personId,
                'person' => $this->buildPersonSnapshot($person, $roleContext + $personContext),
            ];
        }

        if (!\is_array($personPayload) || [] === $personPayload) {
            throw new ApiProblemException(400, 'invalid_payload', sprintf('%s.person must be a non-empty object', $roleName));
        }

        return [
            'mode' => 'new',
            'personId' => null,
            'person' => $this->normalizeNewPersonPayload($personPayload),
        ];
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    private function normalizeNewPersonPayload(array $payload): array
    {
        $requiredFields = [
            'salutation',
            'firstName',
            'lastName',
            'postalCode',
            'houseNumber',
            'address',
            'city',
            'email',
        ];

        $normalized = [
            'salutation' => $this->normalizeNullableString($payload['salutation'] ?? null),
            'firstName' => $this->normalizeNullableString($payload['firstName'] ?? null),
            'middleName' => $this->normalizeNullableString($payload['middleName'] ?? null) ?? '',
            'lastName' => $this->normalizeNullableString($payload['lastName'] ?? null),
            'birthday' => $this->normalizeNullableString($payload['birthday'] ?? null),
            'postalCode' => strtoupper($this->normalizeNullableString($payload['postalCode'] ?? null) ?? ''),
            'houseNumber' => $this->normalizeNullableString($payload['houseNumber'] ?? null),
            'address' => $this->normalizeNullableString($payload['address'] ?? null),
            'city' => $this->normalizeNullableString($payload['city'] ?? null),
            'email' => $this->normalizeNullableString($payload['email'] ?? null),
            'phone' => $this->normalizeNullableString($payload['phone'] ?? null) ?? '',
            'optinEmail' => $this->normalizeNullableString($payload['optinEmail'] ?? null),
            'optinPhone' => $this->normalizeNullableString($payload['optinPhone'] ?? null),
            'optinPost' => $this->normalizeNullableString($payload['optinPost'] ?? null),
        ];

        foreach ($requiredFields as $requiredField) {
            if (!\is_string($normalized[$requiredField] ?? null) || '' === trim((string) $normalized[$requiredField])) {
                throw new ApiProblemException(400, 'invalid_payload', sprintf('%s is required for a new person payload', $requiredField));
            }
        }

        $normalized['displayName'] = $this->buildPersonDisplayName($normalized);

        return $normalized;
    }

    /**
     * @return array<string, mixed>
     */
    private function normalizeSubscriptionPayload(mixed $subscriptionPayload): array
    {
        if (!\is_array($subscriptionPayload) || [] === $subscriptionPayload) {
            throw new ApiProblemException(400, 'invalid_payload', 'subscription payload is required');
        }

        $magazine = $this->normalizeNullableString($subscriptionPayload['magazine'] ?? null);
        $startDate = $this->normalizeNullableString($subscriptionPayload['startDate'] ?? null);
        if (null === $magazine || null === $startDate) {
            throw new ApiProblemException(400, 'invalid_payload', 'subscription.magazine and subscription.startDate are required');
        }

        return [
            'magazine' => $magazine,
            'duration' => $this->normalizeNullableString($subscriptionPayload['duration'] ?? null),
            'durationLabel' => $this->normalizeNullableString($subscriptionPayload['durationLabel'] ?? null),
            'startDate' => $startDate,
            'requestedStatus' => $this->normalizeNullableString($subscriptionPayload['status'] ?? null) ?? 'active',
            'lastEdition' => $this->normalizeNullableString($subscriptionPayload['lastEdition'] ?? null),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function normalizeOfferPayload(mixed $offerPayload): array
    {
        if (!\is_array($offerPayload) || [] === $offerPayload) {
            throw new ApiProblemException(400, 'invalid_payload', 'offer payload is required');
        }

        $salesCode = $this->normalizeNullableString($offerPayload['salesCode'] ?? null);
        $title = $this->normalizeNullableString($offerPayload['title'] ?? null);
        if (null === $salesCode || null === $title) {
            throw new ApiProblemException(400, 'invalid_payload', 'offer.salesCode and offer.title are required');
        }

        $normalizedOffer = [
            'salesCode' => $salesCode,
            'title' => $title,
            'price' => is_numeric($offerPayload['price'] ?? null) ? (float) $offerPayload['price'] : null,
            'channel' => $this->normalizeNullableString($offerPayload['channel'] ?? null),
            'channelLabel' => $this->normalizeNullableString($offerPayload['channelLabel'] ?? null),
            'offerId' => $this->normalizeNullableInt($offerPayload['offerId'] ?? null),
            'orderChoiceKey' => $this->normalizeNullableInt($offerPayload['orderChoiceKey'] ?? null),
            'subscriptionCode' => $this->normalizeNullableString($offerPayload['subscriptionCode'] ?? null),
            'productCode' => $this->normalizeNullableString($offerPayload['productCode'] ?? null),
            'credentialKey' => $this->normalizeNullableString($offerPayload['credentialKey'] ?? null),
            'credentialTitle' => $this->normalizeNullableString($offerPayload['credentialTitle'] ?? null),
            'mandant' => $this->normalizeNullableString($offerPayload['mandant'] ?? null),
            'supportsPersonLookup' => $this->normalizeNullableBoolean($offerPayload['supportsPersonLookup'] ?? null),
            'sourceSystem' => $this->normalizeNullableString($offerPayload['sourceSystem'] ?? null),
        ];

        $cachedOffer = $this->findCachedOffer($salesCode);
        if (null === $cachedOffer) {
            return $normalizedOffer;
        }

        $rawPayload = $cachedOffer->getRawPayload();
        $normalizedOffer['offerId'] = $this->normalizeNullableInt($rawPayload['offerId'] ?? null) ?? $normalizedOffer['offerId'];
        $normalizedOffer['orderChoiceKey'] = $this->normalizeNullableInt($rawPayload['orderChoiceKey'] ?? null) ?? $normalizedOffer['orderChoiceKey'];
        $normalizedOffer['subscriptionCode'] = $cachedOffer->getSubscriptionCode() ?? $normalizedOffer['subscriptionCode'];
        $normalizedOffer['productCode'] = $cachedOffer->getProductCode() ?? $normalizedOffer['productCode'];
        $normalizedOffer['credentialKey'] = $cachedOffer->getCredentialKey() ?? $normalizedOffer['credentialKey'];
        $normalizedOffer['credentialTitle'] = $this->normalizeNullableString($rawPayload['credentialTitle'] ?? null) ?? $normalizedOffer['credentialTitle'];
        $normalizedOffer['mandant'] = $this->normalizeNullableString($rawPayload['mandant'] ?? null) ?? $normalizedOffer['mandant'];
        $normalizedOffer['supportsPersonLookup'] = $this->normalizeNullableBoolean($rawPayload['supportsPersonLookup'] ?? null) ?? $normalizedOffer['supportsPersonLookup'];
        $normalizedOffer['sourceSystem'] = $this->normalizeNullableString($rawPayload['sourceSystem'] ?? null) ?? $normalizedOffer['sourceSystem'] ?? 'webabo-api';

        return $normalizedOffer;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function normalizeContactEntry(mixed $contactEntry): ?array
    {
        if (null === $contactEntry) {
            return null;
        }

        if (!\is_array($contactEntry)) {
            throw new ApiProblemException(400, 'invalid_payload', 'contactEntry must be an object when provided');
        }

        return array_filter([
            'type' => $this->normalizeNullableString($contactEntry['type'] ?? null),
            'description' => $this->normalizeNullableString($contactEntry['description'] ?? null),
        ], static fn (mixed $value): bool => null !== $value);
    }

    private function normalizeNullableString(mixed $value): ?string
    {
        if (!\is_scalar($value)) {
            return null;
        }

        $normalized = trim((string) $value);

        return '' !== $normalized ? $normalized : null;
    }

    private function normalizeNullableInt(mixed $value): ?int
    {
        return is_numeric($value) ? (int) $value : null;
    }

    private function normalizeNullableBoolean(mixed $value): ?bool
    {
        if (\is_bool($value)) {
            return $value;
        }

        if (\is_int($value)) {
            return 0 !== $value;
        }

        if (!\is_string($value)) {
            return null;
        }

        $normalized = strtolower(trim($value));

        return match ($normalized) {
            '1', 'true', 'yes', 'y', 'on' => true,
            '0', 'false', 'no', 'n', 'off' => false,
            default => null,
        };
    }

    /**
     * @param array<string, mixed> $normalizedPayload
     * @param array<string, mixed> $currentUserContext
     * @return array<string, mixed>
     */
    private function buildSummaryPayload(array $normalizedPayload, array $currentUserContext): array
    {
        $contactEntry = \is_array($normalizedPayload['contactEntry'] ?? null) ? $normalizedPayload['contactEntry'] : [];

        return [
            'agent' => $this->buildAgentSummary($currentUserContext),
            'typeLabel' => $this->displayFormatter->normalizeTypeLabel($contactEntry['type'] ?? null),
            'recipient' => [
                'personId' => $normalizedPayload['recipient']['personId'] ?? null,
                'displayName' => $normalizedPayload['recipient']['person']['displayName'] ?? 'Onbekende ontvanger',
            ],
            'requester' => [
                'personId' => $normalizedPayload['requester']['personId'] ?? null,
                'displayName' => $normalizedPayload['requester']['person']['displayName'] ?? 'Onbekende aanvrager',
                'sameAsRecipient' => true === ($normalizedPayload['requester']['sameAsRecipient'] ?? false),
            ],
            'offer' => $normalizedPayload['offer'],
            'subscription' => $normalizedPayload['subscription'],
        ];
    }

    /**
     * @param array<string, mixed> $currentUserContext
     * @return array<string, string|null>
     */
    private function buildAgentSummary(array $currentUserContext): array
    {
        $identity = \is_array($currentUserContext['identity'] ?? null) ? $currentUserContext['identity'] : [];
        $firstName = $this->normalizeNullableString($identity['first_name'] ?? null) ?? '';
        $lastName = $this->normalizeNullableString($identity['last_name'] ?? null) ?? '';
        $fullName = $this->normalizeNullableString($identity['full_name'] ?? null) ?? 'Onbekende medewerker';
        $shortName = $fullName;

        if ('' !== $firstName && '' !== $lastName) {
            $shortName = sprintf('%s. %s', $this->firstCharacter($firstName), $lastName);
        }

        return [
            'fullName' => $fullName,
            'shortName' => $shortName,
            'initials' => $this->normalizeNullableString($identity['initials'] ?? null),
            'email' => $this->normalizeNullableString($identity['email'] ?? null),
        ];
    }

    private function firstCharacter(string $value): string
    {
        if (function_exists('mb_substr')) {
            return mb_substr($value, 0, 1);
        }

        return substr($value, 0, 1);
    }

    /**
     * @param array<string, mixed> $person
     * @return array<string, mixed>
     */
    private function buildPersonSnapshot(array $person, array $context = []): array
    {
        $snapshot = [
            'salutation' => $this->normalizeNullableString($person['salutation'] ?? null),
            'firstName' => $this->normalizeNullableString($person['firstName'] ?? null),
            'middleName' => $this->normalizeNullableString($person['middleName'] ?? null) ?? '',
            'lastName' => $this->normalizeNullableString($person['lastName'] ?? null),
            'birthday' => $this->normalizeNullableString($person['birthday'] ?? null),
            'personNumber' => $this->normalizeNullableString($person['personNumber'] ?? null),
            'postalCode' => $this->normalizeNullableString($person['postalCode'] ?? null),
            'houseNumber' => $this->normalizeNullableString($person['houseNumber'] ?? null),
            'address' => $this->normalizeNullableString($person['address'] ?? null),
            'city' => $this->normalizeNullableString($person['city'] ?? null),
            'email' => $this->normalizeNullableString($person['email'] ?? null),
            'phone' => $this->normalizeNullableString($person['phone'] ?? null),
            'iban' => $this->normalizeNullableString($person['iban'] ?? null),
            'optinEmail' => $this->normalizeNullableString($person['optinEmail'] ?? null),
            'optinPhone' => $this->normalizeNullableString($person['optinPhone'] ?? null),
            'optinPost' => $this->normalizeNullableString($person['optinPost'] ?? null),
        ];

        foreach ($context as $key => $value) {
            $snapshot[$key] = $value;
        }

        $snapshot['displayName'] = $this->buildPersonDisplayName($snapshot);

        return $snapshot;
    }

    /**
     * @param array<string, mixed> $person
     */
    private function buildPersonDisplayName(array $person): string
    {
        $salutation = $this->normalizeNullableString($person['salutation'] ?? null);
        $lastName = $this->normalizeNullableString($person['lastName'] ?? null);
        $firstName = $this->normalizeNullableString($person['firstName'] ?? null);

        if (null !== $salutation && null !== $lastName) {
            return trim(sprintf('%s %s', $salutation, $lastName));
        }

        if (null !== $lastName) {
            return $lastName;
        }

        if (null !== $firstName) {
            return $firstName;
        }

        return 'Onbekende persoon';
    }

    private function createUtcNow(): \DateTimeImmutable
    {
        return new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
    }

    private function buildQueueUnavailableException(\Throwable $exception): ApiProblemException
    {
        return new ApiProblemException(
            503,
            'subscription_queue_unavailable',
            'De abonnementsaanvraag kan tijdelijk niet in de wachtrij worden geplaatst.',
        );
    }

    private function findCachedOffer(string $salesCode): ?WebaboOffer
    {
        if (!$this->webaboOfferCacheSchemaManager->hasCacheTable()) {
            return null;
        }

        try {
            return $this->webaboOfferRepository->findOneBySalesCode($salesCode);
        } catch (\Throwable $exception) {
            throw $this->buildQueueUnavailableException($exception);
        }
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, bool|string>
     */
    private function extractCredentialContext(array $payload): array
    {
        $context = [];

        $credentialKey = $this->normalizeNullableString($payload['credentialKey'] ?? null);
        if (null !== $credentialKey) {
            $context['credentialKey'] = $credentialKey;
        }

        $credentialTitle = $this->normalizeNullableString($payload['credentialTitle'] ?? null);
        if (null !== $credentialTitle) {
            $context['credentialTitle'] = $credentialTitle;
        }

        $mandant = $this->normalizeNullableString($payload['mandant'] ?? null);
        if (null !== $mandant) {
            $context['mandant'] = $mandant;
        }

        $supportsPersonLookup = $this->normalizeNullableBoolean($payload['supportsPersonLookup'] ?? null);
        if (null !== $supportsPersonLookup) {
            $context['supportsPersonLookup'] = $supportsPersonLookup;
        }

        $sourceSystem = $this->normalizeNullableString($payload['sourceSystem'] ?? null);
        if (null !== $sourceSystem) {
            $context['sourceSystem'] = $sourceSystem;
        }

        return $context;
    }

    /**
     * @return array<string, mixed>
     */
    private function mapOrderToApiPayload(SubscriptionOrder $subscriptionOrder): array
    {
        $latestOutboxEvent = $subscriptionOrder->getLatestOutboxEvent();
        $payload = [
            'orderId' => $subscriptionOrder->getId(),
            'submissionId' => $subscriptionOrder->getSubmissionId(),
            'status' => $subscriptionOrder->getStatus(),
            'attemptCount' => $subscriptionOrder->getAttemptCount(),
            'errorCode' => $subscriptionOrder->getLastErrorCode(),
            'errorMessage' => $subscriptionOrder->getLastErrorMessage(),
            'queuedAt' => $subscriptionOrder->getQueuedAt()->format(\DateTimeInterface::ATOM),
            'updatedAt' => $subscriptionOrder->getUpdatedAt()->format(\DateTimeInterface::ATOM),
            'summary' => $subscriptionOrder->getSummaryPayload(),
            'event' => null === $latestOutboxEvent ? null : [
                'id' => $latestOutboxEvent->getId(),
                'type' => $latestOutboxEvent->getEventType(),
                'status' => $latestOutboxEvent->getStatus(),
                'attemptCount' => $latestOutboxEvent->getAttemptCount(),
                'errorCode' => $latestOutboxEvent->getLastErrorCode(),
                'errorMessage' => $latestOutboxEvent->getLastErrorMessage(),
                'availableAt' => $latestOutboxEvent->getAvailableAt()->format(\DateTimeInterface::ATOM),
                'createdAt' => $latestOutboxEvent->getCreatedAt()->format(\DateTimeInterface::ATOM),
                'updatedAt' => $latestOutboxEvent->getUpdatedAt()->format(\DateTimeInterface::ATOM),
            ],
        ];
        $payload['display'] = $this->displayFormatter->formatOrderPayload($payload);

        return $payload;
    }
}
