<?php

declare(strict_types=1);
namespace App\Tests\Unit;

use App\OutboxSession\{SessionSchema, SessionOutbox, SessionConsumer, DeferredCustomerWrites};
use App\Security\{BusinessAccess, AuthorizationContext};
use App\Http\ApiProblemException;
use App\Service\{PocStateService, PocCatalogService};
use Doctrine\DBAL\{Connection, DriverManager};
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\{Request, RequestStack};
use Symfony\Component\HttpFoundation\Session\Session;
use Symfony\Component\HttpFoundation\Session\Storage\MockArraySessionStorage;

final class SessionOutboxTest extends TestCase
{
    private Connection $db;
    private RequestStack $stack;
    private Request $request;
    private SessionOutbox $outbox;
    private string $schema;
    private array $reference = ['personId'=>'42','credentialKey'=>'','sourceSystem'=>'kiwi','divisionId'=>'','mandant'=>''];

    protected function setUp(): void
    {
        $this->db = DriverManager::getConnection(['driver'=>'pdo_pgsql', 'host'=>getenv('SESSION_DB_HOST') ?: '127.0.0.1', 'dbname'=>getenv('SESSION_DB_NAME') ?: 'kiwi_test', 'user'=>getenv('SESSION_DB_USER') ?: 'kiwi', 'password'=>getenv('SESSION_DB_PASSWORD') ?: 'kiwi']);
        $this->schema = 'outbox_test_'.bin2hex(random_bytes(6));
        $this->db->executeStatement('CREATE SCHEMA '.$this->schema);
        $this->db->executeStatement('SET search_path TO '.$this->schema);
        (new SessionSchema($this->db))->migrate();
        $this->stack = new RequestStack();
        $this->outbox = new SessionOutbox($this->db, new BusinessAccess($this->stack));
        $this->actor('alice');
    }
    protected function tearDown(): void
    {
        $this->db->executeStatement('DROP SCHEMA '.$this->schema.' CASCADE');
        $this->db->close();
    }
    private function actor(string $id, string $role = 'user', string $tenant = 'tenant-a'): void
    {
        if ($this->stack->getCurrentRequest()) $this->stack->pop();
        $this->request = new Request();
        $session = new Session(new MockArraySessionStorage());
        $session->set(AuthorizationContext::SESSION_KEY, (new AuthorizationContext($id, $tenant, ['bink8s.app.kiwi.'.$role], time()+3600))->toArray());
        $this->request->setSession($session);
        $this->stack->push($this->request);
    }
    private function save(string $key, ?array $item = null, string $change = ''): array
    {
        $this->request->headers->set('Idempotency-Key', $key);
        if ($item) {
            $this->request->headers->set('X-Kiwi-Outbox-Id', (string)$item['id']);
            $this->request->headers->set('X-Kiwi-Outbox-Revision', (string)$item['revision']);
        }
        if ($change) $this->request->headers->set('X-Kiwi-Change-Id',$change);
        return $this->outbox->save($this->request, $this->reference, 'updateCustomer', [42,[('two' === $key ? 'lastName' : 'firstName')=>$key]], [['id'=>42]],
            fn ($changes,$base,$selected) => ['response'=>['ok'=>true], 'customers'=>[['id'=>42,'firstName'=>$key]]]);
    }
    private function action(array $item, string $action): array
    {
        $this->request->headers->set('Idempotency-Key', bin2hex(random_bytes(12)));
        $this->request->headers->set('X-Kiwi-Outbox-Revision',(string)$item['revision']);
        return $this->outbox->action($this->request,$item['id'],$action);
    }
    public function testSharedContributorsAndCorrectionAreOneItem(): void
    {
        $first=$this->save('one')['outbox'];
        $this->actor('bob');
        self::assertSame(0,$this->outbox->list()['total']);
        $second=$this->save('two')['outbox'];
        self::assertSame($first['id'],$second['id']);
        self::assertCount(2,$second['contributors']);
        self::assertCount(2,$second['changes']);
        $third=$this->save('three',$second,'one')['outbox'];
        self::assertCount(2,$third['changes']);
        self::assertSame('three',$third['changes'][0]['arguments'][1]['firstName']);
        $this->actor('alice');
        self::assertSame(1,$this->outbox->list()['total']);
        $this->actor('charlie','supervisor');
        self::assertSame(1,$this->outbox->list()['total']);
        $this->actor('admin','admin','other-tenant');
        self::assertSame(0,$this->outbox->list()['total']);
    }
    public function testIdempotencyAndStaleRevision(): void
    {
        $one=$this->save('one');
        self::assertEquals($one,$this->save('one'));
        $two=$this->save('two',$one['outbox']);
        self::assertSame(2,$two['outbox']['summary']['changeCount']);
        $this->expectException(ApiProblemException::class);
        $this->save('three',$one['outbox']);
    }
    public function testPausePersistsThroughSaveAndResumeResetsDeadline(): void
    {
        $item=$this->save('one')['outbox'];
        $paused=$this->action($item,'reopen');
        self::assertSame('paused',$paused['status']);
        $saved=$this->save('two',$paused)['outbox'];
        self::assertSame('paused',$saved['status']);
        self::assertSame($paused['availableAt'],$saved['availableAt']);
        $resumed=$this->action($saved,'resume');
        self::assertSame('pending',$resumed['status']);
        self::assertGreaterThan(time()+58,strtotime($resumed['availableAt']));
    }
    public function testExpiredSessionImmutableAndSuccessorWaitsForPriorCompletion(): void
    {
        $item=$this->save('one')['outbox'];
        $this->db->executeStatement("UPDATE customer_outbox_sessions SET available_at = clock_timestamp() - interval '1 second' WHERE id = ?",[$item['id']]);
        self::assertSame('ready',$this->outbox->get($item['id'])['status']);
        $next=$this->save('two')['outbox'];
        self::assertNotSame($item['id'],$next['id']);
        $this->db->executeStatement("UPDATE customer_outbox_sessions SET available_at = clock_timestamp() - interval '1 second'");
        $consumer=new SessionConsumer($this->db);
        $first=$consumer->claim();
        self::assertSame($item['id'],$first['sessionId']);
        self::assertNull($consumer->claim());
        $consumer->consume($first,fn()=>true,fn()=>'completed');
        self::assertSame($next['id'],$consumer->claim()['sessionId']);
    }
    public function testUncertainStepStopsAllLaterSteps(): void
    {
        $item=$this->save('one')['outbox'];
        $this->save('two',$item);
        $this->db->executeStatement("UPDATE customer_outbox_sessions SET available_at = clock_timestamp() - interval '1 second'");
        $consumer=new SessionConsumer($this->db);
        $calls=0;
        $consumer->consume($consumer->claim(),fn()=>true,function() use (&$calls) { ++$calls; throw new \RuntimeException('unknown'); });
        self::assertSame(1,$calls);
        self::assertSame('uncertain',$this->outbox->get($item['id'])['status']);
        self::assertNull($consumer->claim());
    }
    public function testOnlySupervisorsCancel(): void
    {
        $item=$this->save('one')['outbox'];
        try { $this->action($item,'cancel'); self::fail('User cancelled a shared session'); }
        catch(ApiProblemException $e) { self::assertSame('outbox_delete_forbidden',$e->getErrorCode()); }
        $this->actor('supervisor','supervisor');
        self::assertSame('cancelled',$this->action($item,'cancel')['status']);
    }
    public function testNoOpCannotGrantContributionAndViewCannotWrite(): void
    {
        $this->save('one');
        $this->actor('bob');
        $this->request->headers->set('Idempotency-Key','invalid');
        try {
            $this->outbox->save($this->request,$this->reference,'updateCustomer',[],[],fn()=>throw new ApiProblemException(422,'invalid','invalid'));
            self::fail('Invalid contribution accepted');
        } catch(ApiProblemException) { self::assertSame(0,$this->outbox->list()['total']); }
        $this->actor('viewer','view');
        self::assertSame(0,$this->outbox->list()['total']);
        $this->expectException(ApiProblemException::class);
        $this->save('forbidden');
    }
    public function testPreviewDoesNotChangeSourceStateAndMigrationIsRepeatable(): void
    {
        (new SessionSchema($this->db))->migrate();
        $dir=dirname(__DIR__,2);
        $state=new PocStateService(new PocCatalogService($dir),$dir);
        $session=$this->request->getSession();
        $session->set('kiwi_poc_state',['customers'=>[['id'=>42,'firstName'=>'Before','subscriptions'=>[]]]]);
        $deferred=new DeferredCustomerWrites($this->outbox,$state);
        $this->request->headers->set('Idempotency-Key','edit');
        $result=$deferred->stage($this->request,'updateCustomer',42,['firstName'=>'After']);
        self::assertSame('After',$result['firstName']);
        self::assertSame('Before',$state->getCustomer($session,42)['firstName']);
        self::assertSame('After',$this->outbox->get($result['outbox']['id'])['customers'][0]['firstName']);
    }
    public function testConcurrentIndependentConnectionsCreateOneSessionAndClaimOnce(): void
    {
        $run = function (array $actors): array {
            $processes = [];
            foreach ($actors as $actor) {
                $pipes = [];
                $process = proc_open([PHP_BINARY, dirname(__DIR__).'/Support/outbox-concurrency-worker.php', $this->schema, $actor], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
                $processes[] = [$process, $pipes];
            }
            $results = [];
            foreach ($processes as [$process, $pipes]) {
                $result = stream_get_contents($pipes[1]);
                $error = stream_get_contents($pipes[2]);
                fclose($pipes[1]); fclose($pipes[2]);
                self::assertSame(0, proc_close($process), $error);
                $results[] = json_decode($result, true, 512, JSON_THROW_ON_ERROR);
            }
            return $results;
        };
        $results = $run(['alice', 'bob']);
        self::assertSame($results[0]['id'], $results[1]['id']);
        self::assertSame(1, (int) $this->db->fetchOne('SELECT COUNT(*) FROM customer_outbox_sessions'));
        $item = $this->outbox->get($results[0]['id']);
        self::assertCount(2, $item['changes']);
        $this->db->executeStatement("UPDATE customer_outbox_sessions SET available_at = clock_timestamp()");
        $claims = $run(['claim', 'claim']);
        self::assertCount(1, array_filter($claims));
    }

    public function testAllLocalCommandTypesRestoreInAFreshBrowserSession(): void
    {
        $dir = dirname(__DIR__, 2);
        $state = new PocStateService(new PocCatalogService($dir), $dir, $this->outbox);
        $source = ['id' => 42, 'firstName' => 'Before', 'subscriptions' => [
            ['id' => 9, 'magazine' => 'Test', 'status' => 'active', 'duration' => '1-jaar'],
        ], 'contactHistory' => []];
        $session = $this->request->getSession();
        $session->set('kiwi_poc_state', ['customers' => [$source]]);
        $deferred = new DeferredCustomerWrites($this->outbox, $state);
        $commands = [
            ['updateCustomer', 42, ['email' => 'changed@example.invalid']],
            ['createContactHistoryEntry', 42, ['type' => 'Vraag', 'description' => 'Zakelijke vraag']],
            ['updateDeliveryRemarks', 42, 'Bij de voordeur', 'Alice'],
            ['createEditorialComplaint', 42, ['magazine' => 'Test', 'description' => 'Correctie gevraagd']],
            ['updateSubscription', 42, 9, ['duration' => '2-jaar']],
            ['createSubscriptionComplaint', 42, 9, 'damaged'],
            ['completeWinback', 42, 9, 'accepted', ['title' => 'Behoud']],
            ['processDeceasedActions', 42, [['subscriptionId' => 9, 'action' => 'cancel_refund', 'refundData' => ['email' => 'refund@example.invalid']]]],
            ['completeRestitutionTransfer', 42, 9, ['firstName' => 'Recipient']],
        ];
        $item = null;
        foreach ($commands as $index => $command) {
            $this->request->headers->set('Idempotency-Key', 'command-'.$index);
            if ($item) $this->request->headers->set('X-Kiwi-Outbox-Revision', (string) $item['revision']);
            $item = $deferred->stage($this->request, ...$command)['outbox'];
        }
        self::assertCount(count($commands), $item['changes']);
        self::assertSame($source, $session->get('kiwi_poc_state')['customers'][0]);
        $this->actor('alice'); // New PHP session, same verified contributor.
        $restored = $this->action($item, 'reopen');
        self::assertSame('paused', $restored['status']);
        self::assertEquals($item['customers'], $restored['customers']);
        self::assertSame('transferred', $state->getCustomer($this->request->getSession(), 42)['subscriptions'][0]['status']);
    }

    public function testNewCustomerIdentitySurvivesCorrectionAndBrowserRestart(): void
    {
        $dir = dirname(__DIR__, 2);
        $state = new PocStateService(new PocCatalogService($dir), $dir, $this->outbox);
        $deferred = new DeferredCustomerWrites($this->outbox, $state);
        $this->request->headers->set('Idempotency-Key', 'new-customer');
        $created = $deferred->stage($this->request, 'createCustomer', ['firstName' => 'New', 'lastName' => 'Customer']);
        $this->actor('alice');
        $item = $this->action($created['outbox'], 'reopen');
        $this->request->headers->set('Idempotency-Key', 'correct-new-customer');
        $this->request->headers->set('X-Kiwi-Outbox-Id', (string) $item['id']);
        $this->request->headers->set('X-Kiwi-Outbox-Revision', (string) $item['revision']);
        $this->request->headers->set('X-Kiwi-Change-Id', 'new-customer');
        $corrected = $deferred->stage($this->request, 'createCustomer', ['firstName' => 'Corrected', 'lastName' => 'Customer']);
        self::assertSame($created['id'], $corrected['id']);
        self::assertCount(1, $corrected['outbox']['changes']);
        self::assertSame('Corrected', $state->getCustomer($this->request->getSession(), $created['id'])['firstName']);
    }

    public function testEmptyBusinessCommandsCannotGrantMembership(): void
    {
        $item = $this->save('one')['outbox'];
        $this->actor('bob');
        $dir = dirname(__DIR__, 2);
        $state = new PocStateService(new PocCatalogService($dir), $dir, $this->outbox);
        $this->request->getSession()->set('kiwi_poc_state', ['customers' => [['id' => 42]]]);
        $deferred = new DeferredCustomerWrites($this->outbox, $state);
        foreach ([['createContactHistoryEntry', 42, []], ['processDeceasedActions', 42, []], ['updateDeliveryRemarks', 42, '', 'Bob']] as $index => $command) {
            $this->request->headers->set('Idempotency-Key', 'empty-'.$index);
            try {
                $deferred->stage($this->request, ...$command);
                self::fail('Empty business command accepted');
            } catch (ApiProblemException $error) {
                self::assertSame('outbox_no_changes', $error->getErrorCode());
            }
        }
        self::assertSame(0, $this->outbox->list()['total']);
        self::assertSame(1, (int) $this->db->fetchOne('SELECT jsonb_array_length(contributors) FROM customer_outbox_sessions WHERE id = ?', [$item['id']]));
    }

    public function testDevOnlyRoleCannotReadOrMutateAndTenantCannotReadById(): void
    {
        $item = $this->save('one')['outbox'];
        foreach ([['alice', 'dev', 'tenant-a'], ['alice', 'admin', 'tenant-b']] as $actor) {
            $this->actor(...$actor);
            self::assertSame(0, $this->outbox->list()['total']);
            try { $this->outbox->get($item['id']); self::fail('Unauthorized detail disclosed'); }
            catch (ApiProblemException $error) { self::assertSame('outbox_session_not_found', $error->getErrorCode()); }
        }
        $this->actor('alice', 'dev');
        $this->expectException(ApiProblemException::class);
        $this->save('forbidden');
    }

    public function testConcurrentSaveReopenAndCancelUseOneRevision(): void
    {
        $item = $this->save('one')['outbox'];
        $processes = [];
        foreach (['save', 'reopen', 'cancel'] as $action) {
            $process = proc_open([PHP_BINARY, dirname(__DIR__).'/Support/outbox-concurrency-worker.php', $this->schema, $action, (string)$item['id'], (string)$item['revision']], [1=>['pipe','w'], 2=>['pipe','w']], $pipes);
            $processes[] = [$process, $pipes];
        }
        $successes = 0;
        foreach ($processes as [$process, $pipes]) {
            $result = json_decode(stream_get_contents($pipes[1]), true);
            $error = stream_get_contents($pipes[2]);
            fclose($pipes[1]); fclose($pipes[2]);
            self::assertSame(0, proc_close($process), $error);
            if (200 === $result['status']) ++$successes;
            else self::assertContains($result['code'], ['outbox_revision_conflict', 'outbox_session_closed']);
        }
        self::assertSame(1, $successes);
        self::assertSame($item['revision'] + 1, $this->outbox->get($item['id'])['revision']);
    }

    public function testConsumerRejectsChangedSnapshotAndStopsBeforeUnauthorizedEffects(): void
    {
        $item = $this->save('one')['outbox'];
        $this->db->executeStatement("UPDATE customer_outbox_sessions SET available_at = clock_timestamp()");
        $consumer = new SessionConsumer($this->db);
        $contract = $consumer->claim();
        $changed = $contract;
        $changed['changes'][0]['arguments'][1]['firstName'] = 'Tampered';
        try { $consumer->consume($changed, fn()=>true, fn()=>self::fail('Changed snapshot sent')); self::fail('Changed contract accepted'); }
        catch (\LogicException $error) { self::assertStringContainsString('immutable', $error->getMessage()); }
        $consumer->consume($contract, fn()=>false, fn()=>self::fail('Unauthorized effect sent'));
        self::assertSame('failed', $this->outbox->get($item['id'])['status']);
        self::assertNull($consumer->claim());
    }

    public function testSeparateOrdersShareNewCustomerAndCorrectionDoesNotDuplicateOrder(): void
    {
        $dir = dirname(__DIR__, 2);
        $catalog = new PocCatalogService($dir);
        $state = new PocStateService($catalog, $dir, $this->outbox);
        $deferred = new DeferredCustomerWrites($this->outbox, $state);
        $article = $catalog->searchArticles(limit: 1)[0];
        $person = ['firstName' => 'New', 'lastName' => 'Customer'];
        $order = ['items' => [['articleId' => $article['id'], 'quantity' => 1]]];
        $this->request->headers->set('Idempotency-Key', 'order-a');
        $this->request->headers->set('X-Kiwi-New-Customer-Id', 'same-form');
        $first = $deferred->stage($this->request, 'createArticleOrder', null, $person, $order, null);
        $item = $first['outbox'];
        $this->request->headers->set('Idempotency-Key', 'order-b');
        $this->request->headers->set('X-Kiwi-Outbox-Id', (string)$item['id']);
        $this->request->headers->set('X-Kiwi-Outbox-Revision', (string)$item['revision']);
        $second = $deferred->stage($this->request, 'createArticleOrder', null, $person, $order, null);
        self::assertSame($first['customer']['id'], $second['customer']['id']);
        self::assertCount(2, $second['outbox']['changes']);
        self::assertCount(2, $second['customer']['articles']);
        $this->request->headers->set('Idempotency-Key', 'correct-a');
        $this->request->headers->set('X-Kiwi-Outbox-Revision', (string)$second['outbox']['revision']);
        $this->request->headers->set('X-Kiwi-Change-Id', 'order-a');
        $order['items'][0]['quantity'] = 3;
        $corrected = $deferred->stage($this->request, 'createArticleOrder', null, $person, $order, null);
        self::assertCount(2, $corrected['outbox']['changes']);
        self::assertCount(2, $corrected['outbox']['customers'][0]['articles']);
        self::assertSame(3, $corrected['outbox']['customers'][0]['articles'][0]['items'][0]['quantity']);
    }

}
