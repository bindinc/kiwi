<?php

declare(strict_types=1);

use App\Address\AddressSessionStore;
use App\Kernel;
use Symfony\Component\Dotenv\Dotenv;

require dirname(__DIR__, 2).'/vendor/autoload.php';
(new Dotenv())->bootEnv(dirname(__DIR__, 2).'/.env.example');
$kernel = new Kernel('dev', true);
$kernel->boot();
$session = $kernel->getContainer()->get('address.smoke_session_factory')->createSession();
$sessionFile = '/app/var/address-concurrency-smoke-session';
if ('init' === ($argv[1] ?? '')) {
    $session->start();
    $session->set('address_smoke', true);
    $session->save();
    file_put_contents($sessionFile, $session->getId());
    file_put_contents('/app/var/address-concurrency-smoke-count', '0');
    echo "Initialized isolated session fixture\n";
    exit(0);
}
$session->setId(trim(file_get_contents($sessionFile)));
$store = new AddressSessionStore();
$uuid = $store->uuid($session, 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', static function (): string {
    $counter = '/app/var/address-concurrency-smoke-count';
    $handle = fopen($counter, 'c+');
    flock($handle, LOCK_EX);
    $count = (int) stream_get_contents($handle);
    rewind($handle);
    ftruncate($handle, 0);
    fwrite($handle, (string) ($count + 1));
    flock($handle, LOCK_UN);
    fclose($handle);
    usleep(200000);

    return 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb';
});
$session->save();
if ('bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb' !== $uuid) {
    throw new RuntimeException('Unexpected session UUID');
}
echo "Shared session UUID verified\n";
