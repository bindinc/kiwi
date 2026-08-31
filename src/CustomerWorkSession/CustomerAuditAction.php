<?php

declare(strict_types=1);

namespace App\CustomerWorkSession;

enum CustomerAuditAction: string
{
    case SearchPerformed = 'CUSTOMER_SEARCH_PERFORMED';
    case ProfileOpened = 'CUSTOMER_PROFILE_OPENED';
    case SessionReset = 'CUSTOMER_SESSION_RESET';
}
