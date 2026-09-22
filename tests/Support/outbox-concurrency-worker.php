<?php
// Test-only process: every worker opens its own PostgreSQL connection.
require dirname(__DIR__, 2).'/vendor/autoload.php';
use App\OutboxSession\{SessionOutbox, SessionConsumer};
use App\Security\{AuthorizationContext, BusinessAccess};
use Doctrine\DBAL\DriverManager;
use Symfony\Component\HttpFoundation\{Request, RequestStack};
use Symfony\Component\HttpFoundation\Session\Session;
use Symfony\Component\HttpFoundation\Session\Storage\MockArraySessionStorage;
$schema = $argv[1];
if (!preg_match('/^outbox_test_[a-f0-9]+$/', $schema)) exit(2);
$db=DriverManager::getConnection(['driver'=>'pdo_pgsql','host'=>getenv('SESSION_DB_HOST') ?: '127.0.0.1','dbname'=>getenv('SESSION_DB_NAME') ?: 'kiwi_test','user'=>getenv('SESSION_DB_USER') ?: 'kiwi','password'=>getenv('SESSION_DB_PASSWORD') ?: 'kiwi']);
$db->executeStatement('SET search_path TO '.$schema);
if ('claim' === $argv[2]) { echo json_encode((new SessionConsumer($db))->claim()); exit; }
$action = in_array($argv[2], ['reopen', 'cancel', 'save'], true) ? $argv[2] : null;
$actor=$action ? 'alice' : $argv[2];
$request=new Request();
$session=new Session(new MockArraySessionStorage());
$session->set(AuthorizationContext::SESSION_KEY,(new AuthorizationContext($actor,'tenant-a',[$action ? 'bink8s.app.kiwi.admin' : 'bink8s.app.kiwi.user'],time()+3600))->toArray());
$request->setSession($session);
$request->headers->set('Idempotency-Key','concurrent-'.$actor);
$stack=new RequestStack();$stack->push($request);
$outbox=new SessionOutbox($db,new BusinessAccess($stack));
if ($action) {
    $request->headers->set('Idempotency-Key', 'race-'.$action);
    $request->headers->set('X-Kiwi-Outbox-Id', $argv[3]);
    $request->headers->set('X-Kiwi-Outbox-Revision', $argv[4]);
    try {
        $result = 'save' === $action
            ? $outbox->save($request, ['personId'=>'42','credentialKey'=>'','sourceSystem'=>'kiwi','divisionId'=>'','mandant'=>''], 'updateCustomer', [42, ['lastName'=>'Concurrent']], [['id'=>42]], fn()=>['response'=>[], 'customers'=>[['id'=>42]]])['outbox']
            : $outbox->action($request, (int)$argv[3], $action);
        echo json_encode(['status'=>200, 'revision'=>$result['revision']]);
    } catch (\App\Http\ApiProblemException $error) {
        echo json_encode(['status'=>409, 'code'=>$error->getErrorCode()]);
    }
    exit;
}
$result=$outbox->save($request,['personId'=>'42','credentialKey'=>'','sourceSystem'=>'kiwi','divisionId'=>'','mandant'=>''],'updateCustomer',[42,[('bob' === $actor ? 'lastName' : 'firstName')=>$actor]],[['id'=>42]],function($changes) {usleep(100000);return ['response'=>['ok'=>true],'customers'=>[['id'=>42,'firstName'=>'Concurrent']]];});
echo json_encode(['id'=>$result['outbox']['id']]);
