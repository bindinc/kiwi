<?php

declare(strict_types=1);

namespace App\Security;

use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

final class BusinessAccessVoter extends Voter
{
    public function __construct(private readonly BusinessAccess $access) {}

    protected function supports(string $attribute, mixed $subject): bool
    {
        return in_array($attribute, ['kiwi.read', 'kiwi.write', 'kiwi.session'], true);
    }

    protected function voteOnAttribute(string $attribute, mixed $subject, TokenInterface $token, ?\Symfony\Component\Security\Core\Authorization\Voter\Vote $vote = null): bool
    {
        $context = $this->access->context();
        if ('kiwi.session' === $attribute) {
            return true;
        }
        if (!$context->canRead()) {
            return false;
        }
        return 'kiwi.read' === $attribute || $context->canWrite();
    }
}
