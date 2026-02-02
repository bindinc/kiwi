"""Handle offer-related operations and data retrieval for the WebAbo system."""
import logging
import time
import requests

from .client import WebAboClient, ConfigurationManager

class OfferService(WebAboClient):
    """Manage offer operations and data retrieval from WebAbo API."""

    def _get_sales_data(self):
        """Get sales code combinations from WebAbo API for current product.

        Returns:
            dict: Sales code combinations data from the API.
        """
        # Get sales code combinations by product code
        ref_date = time.strftime("%Y-%m-%d", time.gmtime())
        product_code = ConfigurationManager.get_setting('API_PRODUCTCODE')
        sales_url = (
            f"{self.base_url}/offers/salescodecombinations/"
            f"?productCode={product_code}&refDate={ref_date}"
        )
        response_sales = self.session.get(sales_url)
        response_sales.raise_for_status()
        sales_data = response_sales.json()
        logging.info(
            "Sales code combinations retrieved"
        )

        return sales_data

    def get_offer_by_id(self, offer_id):
        """Get a specific offer's details from WebAbo API using its ID.

        Args:
            offer_id: The unique identifier of the offer.

        Returns:
            dict: Offer details including sales code combinations.
        """
        return self.get_offers(offer_id=offer_id)


    def get_offers(self, offer_id=None):
        """Get offer details and combine them with sales code combinations.

        Args:
            offer_id (optional): Specific offer ID to retrieve. If None, get all offers.

        Returns:
            list: Offers with matching sales code combinations.

        Raises:
            RuntimeError: If there's an error fetching the offer data.
        """
        try:
            # Get sales codes
            sales_data = self._get_sales_data()
            # Get offer details
            if offer_id:
                offers_url = f"{self.base_url}/offers/{offer_id}"
            else:
                offers_url = f"{self.base_url}/offers/"

            response_offers = self.session.get(
                offers_url
            )
            response_offers.raise_for_status()
            offers_data = response_offers.json()

            # Ensure offers_data is a list
            if isinstance(offers_data, dict):
                offers_data = [offers_data]

            # Combine sales code combinations with offer details
            saleschannel1 = ConfigurationManager.get_setting('API_SALESCHANNEL1')
            saleschannel2 = ConfigurationManager.get_setting('API_SALESCHANNEL2')
            saleschannel3 = ConfigurationManager.get_setting('API_SALESCHANNEL3')
            for offer in offers_data:
                offer['salesCodeCombinations'] = []
                for sales in sales_data:
                    if (
                        sales.get('salesCode') == offer.get('salesCode') and
                        sales.get('salesChannel1') == saleschannel1 and
                        sales.get('salesChannel2') == saleschannel2 and
                        sales.get('salesChannel3') == saleschannel3
                    ):
                        offer['salesCodeCombinations'].append(sales)


            return offers_data

        except requests.exceptions.RequestException as e:
            logging.error("Error fetching offer: %s", e)
            raise RuntimeError("Error fetching offer") from e
