<?php

declare(strict_types=1);

// theme_audit: actual business projection on isolated in-memory sessions, never live data.
require '/app/vendor/autoload.php';

use App\Security\AuthorizationContext;
use App\Service\PocCatalogService;
use App\Service\PocStateService;
use Symfony\Component\HttpFoundation\Session\Session;
use Symfony\Component\HttpFoundation\Session\Storage\MockArraySessionStorage;

$input = json_decode(base64_decode($argv[1], true), true, 512, JSON_THROW_ON_ERROR);
$state = new PocStateService(new PocCatalogService('/app'), '/app');
$output = ['marker' => 'theme_audit', 'scope' => 'Actual PocStateService projections on separate MockArraySessionStorage instances; no database, HTTP session, kernel or external request.', 'cases' => []];
foreach ($input['cases'] as $case) {
    $payload = $case['payload'];
    [$operation, $arguments] = match ($case['case']) {
        'edit' => ['updateSubscription', [990701, 990711, $payload]],
        'resend' => ['createSubscriptionComplaint', [990701, 990711, $payload['reason']]],
        'complaint' => ['createEditorialComplaint', [990701, $payload]],
        'winback-accepted', 'winback-declined' => ['completeWinback', [990701, 990711, $payload['result'], $payload['offer']]],
        'deceased-refund', 'deceased-transfer', 'deceased-combined' => ['processDeceasedActions', [990701, $payload['actions']]],
        'restitution-transfer' => ['completeRestitutionTransfer', [990701, 990713, $payload['transferData']]],
        default => throw new LogicException('Unknown explicitly scoped synthetic projection case'),
    };
    $session = new Session(new MockArraySessionStorage());
    $actor = new AuthorizationContext('synthetic-theme07', 'synthetic-theme-audit', ['bink8s.app.kiwi.admin'], time() + 3600);
    $session->set(AuthorizationContext::SESSION_KEY, $actor->toArray());
    $session->set('kiwi_outbox_projection', true);
    $session->set('kiwi_poc_state', ['customers' => [$input['customer']], 'counters' => ['contact_history_id' => 990700]]);
    $response = $state->previewOperation($session, $operation, $arguments, $input['recordedAt']);
    $output['cases'][$case['case']] = ['operation' => $operation, 'arguments' => $arguments, 'response' => $response,
        'customers' => $session->get('kiwi_poc_state')['customers']];
}
foreach (['src/Service/PocStateService.php', 'src/Service/PocCatalogService.php', 'src/OutboxSession/SessionOutbox.php', 'src/OutboxSession/DeferredCustomerWrites.php'] as $file) {
    $output['backendSourceSha256'][$file] = hash_file('sha256', '/app/'.$file);
}
echo json_encode($output, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)."\n";
