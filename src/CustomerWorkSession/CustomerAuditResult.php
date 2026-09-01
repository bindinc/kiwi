<?php

declare(strict_types=1);

namespace App\CustomerWorkSession;

enum CustomerAuditResult: string
{
    case Success = 'success';
    case Denied = 'denied';
    case Failed = 'failed';
}
