"""WebAbo service factory module.

This module provides a centralized way to access all WebAbo services
without dealing with individual imports and dependency management.
"""
import functools
import logging
from typing import Dict, Type, Any, Optional

from .user_service import UserService
from .subscription_service import SubscriptionService
from .offer_service import OfferService
from .extended_data_service import ExtendedDataService
from .address_service import AddressService
from .client import WebAboClient, ConfigurationManager


class WebAboServiceFactory:
    """Factory class for WebAbo services.
    
    Provides cached access to all WebAbo service instances and centralizes
    their initialization to avoid dependency issues.
    """
    
    _instances: Dict[Type[WebAboClient], WebAboClient] = {}
    _initialized: bool = False
    _config: Optional[Dict[str, Any]] = None
    
    @classmethod
    def initialize(cls, config: Dict[str, Any]) -> None:
        """Initialize the factory with configuration.
        
        This should be called once during application startup to configure
        all WebAbo services.
        
        Args:
            config: Dictionary containing WebAbo API configuration
        """
        if cls._initialized:
            logging.warning("WebAboServiceFactory already initialized, ignoring new config")
            return
            
        logging.info("Initializing WebAboServiceFactory with config")
        ConfigurationManager.set_config(config)
        cls._config = config
        cls._initialized = True
        # Clear any existing instances to ensure they use the new config
        cls._instances = {}
    
    @classmethod
    def get_service(cls, service_class: Type[WebAboClient]) -> WebAboClient:
        """Get an instance of the specified service class.
        
        Args:
            service_class: The WebAbo service class to instantiate
            
        Returns:
            An instance of the requested service
        """
        if not cls._initialized:
            logging.warning("WebAboServiceFactory not initialized with config, services may not function properly")
            
        if service_class not in cls._instances:
            logging.info(f"Creating new instance of {service_class.__name__}")
            cls._instances[service_class] = service_class(config=cls._config)
        return cls._instances[service_class]
    
    @classmethod
    def get_user_service(cls) -> UserService:
        """Get the UserService instance."""
        return cls.get_service(UserService)
    
    @classmethod
    def get_subscription_service(cls) -> SubscriptionService:
        """Get the SubscriptionService instance."""
        return cls.get_service(SubscriptionService)
    
    @classmethod
    def get_offer_service(cls) -> OfferService:
        """Get the OfferService instance."""
        return cls.get_service(OfferService)
    
    @classmethod
    def get_extended_data_service(cls) -> ExtendedDataService:
        """Get the ExtendedDataService instance."""
        return cls.get_service(ExtendedDataService)
    
    @classmethod
    def get_address_service(cls) -> AddressService:
        """Get the AddressService instance."""
        return cls.get_service(AddressService)


# Create a simplified interface for even easier access
def user_service() -> UserService:
    """Get the UserService instance."""
    return WebAboServiceFactory.get_user_service()

def subscription_service() -> SubscriptionService:
    """Get the SubscriptionService instance."""
    return WebAboServiceFactory.get_subscription_service()

def offer_service() -> OfferService:
    """Get the OfferService instance."""
    return WebAboServiceFactory.get_offer_service()

def extended_data_service() -> ExtendedDataService:
    """Get the ExtendedDataService instance."""
    return WebAboServiceFactory.get_extended_data_service()

def address_service() -> AddressService:
    """Get the AddressService instance."""
    return WebAboServiceFactory.get_address_service()
