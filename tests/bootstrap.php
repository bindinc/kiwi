<?php

use Symfony\Component\Dotenv\Dotenv;

require dirname(__DIR__).'/vendor/autoload.php';

if (method_exists(Dotenv::class, 'bootEnv')) {
    $projectDir = dirname(__DIR__);
    $envFile = is_file($projectDir.'/.env') ? $projectDir.'/.env' : $projectDir.'/.env.example';

    (new Dotenv())->bootEnv($envFile);
}

if ($_SERVER['APP_DEBUG']) {
    umask(0000);
}
