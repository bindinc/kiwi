<?php

use Symfony\Component\Dotenv\Dotenv;

require dirname(__DIR__).'/vendor/autoload.php';

// PHPUnit runs inside the dev container, so the bootstrap must override
// container-level APP_ENV defaults before Dotenv loads test-specific config.
$_SERVER['APP_ENV'] = $_ENV['APP_ENV'] = 'test';
$_SERVER['APP_DEBUG'] = $_ENV['APP_DEBUG'] = '1';
putenv('APP_ENV=test');
putenv('APP_DEBUG=1');

if (method_exists(Dotenv::class, 'bootEnv')) {
    $projectDir = dirname(__DIR__);
    $envFile = is_file($projectDir.'/.env') ? $projectDir.'/.env' : $projectDir.'/.env.example';

    (new Dotenv())->bootEnv($envFile);
}

if ($_SERVER['APP_DEBUG']) {
    umask(0000);
}
