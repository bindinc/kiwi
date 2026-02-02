"""WebAbo service package.

This package provides access to the WebAbo API services.
Import the service factory for easy access to all services.
"""

from .service_factory import (
    WebAboServiceFactory,
    user_service,
    subscription_service,
    offer_service,
    extended_data_service,
    address_service,
)

__all__ = [
    'WebAboServiceFactory',
    'user_service',
    'subscription_service',
    'offer_service',
    'extended_data_service',
    'address_service',
]
