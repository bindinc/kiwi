<?php

declare(strict_types=1);

namespace App\Session;

use Doctrine\DBAL\Connection;
use Symfony\Component\HttpFoundation\Session\Storage\Handler\PdoSessionHandler;

final class DoctrinePdoSessionHandlerFactory
{
    public function __construct(
        private readonly Connection $connection,
    ) {
    }

    /**
     * @param array<string, mixed> $options
     */
    public function create(array $options): PdoSessionHandler
    {
        $nativeConnection = $this->connection->getNativeConnection();
        if (!$nativeConnection instanceof \PDO) {
            throw new \RuntimeException('The default Doctrine connection does not expose a PDO instance.');
        }

        if (\PDO::ERRMODE_EXCEPTION !== $nativeConnection->getAttribute(\PDO::ATTR_ERRMODE)) {
            $nativeConnection->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        }

        return new PdoSessionHandler($nativeConnection, $options);
    }
}
