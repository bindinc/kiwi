"""Form data mapping utilities.

This module provides functions for mapping between web form data and API
formats required by WebAboClient endpoints.
"""

from app.utils.address_formatter import format_street_name, normalize_houseno

def map_form_to_user_data(form_data):
    """Map form data to the format used by WebAboClient /users endpoint."""
    street_value = form_data.get('street')
    formatted_street = format_street_name(street_value) if street_value else None

    houseno_value = normalize_houseno(form_data.get('houseno'))
    houseno_extension = form_data.get('housenoExt') or None

    # Handle birthdate
    birthdate_input = form_data.get('birthdate')
    birthday = "1970-01-01"
    
    if birthdate_input:
        try:
            # Handle various separators
            clean_date = birthdate_input.replace('/', '-').replace('.', '-')
            parts = clean_date.split('-')
            if len(parts) == 3:
                # Check if first part is year (4 digits)
                if len(parts[0]) == 4:
                     # Assume yyyy-mm-dd
                     year, month, day = parts
                     birthday = f"{year}-{month.zfill(2)}-{day.zfill(2)}"
                else:
                    # Assume dd-mm-yyyy
                    day, month, year = parts
                    birthday = f"{year}-{month.zfill(2)}-{day.zfill(2)}"
        except Exception:
            # Keep default if parsing fails
            pass

    user_data = {
        "id": None,
        "person": {
            "initial": form_data.get('initial'),
            "firstname": None,
            "middlename": form_data.get('middlename') or None,
            "lastname": form_data.get('lastname'),
            "salutation": form_data.get('salutation', 'O'),
            "title": None,
            "street": formatted_street,
            "houseno": houseno_value,
            "housenoExt": houseno_extension,
            "zipcode": form_data.get('zipcode'),
            "city": form_data.get('city'),
            "country": "NL",
        },
        "email": form_data.get('email'),
        "birthday": birthday
    }

    tel_number = form_data.get('telNumber')
    if tel_number:
        user_data["phone"] = {
            "prefixNumber": None,
            "telNumber": tel_number
        }

    mobile_number = form_data.get('mobileNumber') or form_data.get('mobile')
    if mobile_number:
        user_data["mobile"] = {
            "prefixNumber": None,
            "telNumber": mobile_number
        }

    return user_data



def map_form_to_subscription_data(user_id, form_data, offer):
    """Map form data to the format used by WebAboClient /subscriptions endpoint.

    Args:
        user_id (str): The ID of the user creating the subscription.
        form_data (dict): Dictionary containing the form submission data.
        offer (dict): Dictionary containing the selected offer details.

    Returns:
        dict: Subscription data formatted for the API.
    """
    from datetime import datetime
    
    # Get offer start date
    start_date = offer.get('subscription_start_date')
    
    # Determine payment method
    payment_method = 'B'  # Default to Automatisch incasso
    if form_data.get('payment_method') == 'automatisch':
        payment_method = 'B'  # Set to Incasso for automatisch
    elif form_data.get('payment_method') == 'iDEAL':
        payment_method = 'IDEAL'
    
    # Safely handle potentially empty lists
    sales_code_combinations = offer.get('salesCodeCombinations', [])
    sales_code_combination = sales_code_combinations[0] if sales_code_combinations else {}
    
    variant_code_list = offer.get('variantCodeList', [])
    variant_code = variant_code_list[0] if variant_code_list else {}
    
    return {
        "validFrom": start_date,
        "validUntil": '2999-01-01',
        "variantCode": variant_code,
        "offerDetails": {
            "salesCode": offer.get('salesCode'),
            "salesChannel1": sales_code_combination.get('salesChannel1'),
            "salesChannel2": sales_code_combination.get('salesChannel2'),
            "salesChannel3": sales_code_combination.get('salesChannel3'),
            "productCode": offer.get('productCode'),
        },
        "payment": {
            "swiftIBAN": form_data.get('swiftIBAN'),
            "accountHolder": f"{form_data.get('initial')} "
                          f"{form_data.get('lastname')}",
            "paymentType": {
                "paymentMethod": payment_method,
                "paymentFrequency": "JD"
            },
        },
        "userId": user_id,
        "id": None
    }

def map_form_to_extended_data(user_id, form_data):
    """Map form data to the format used by WebAboClient /extended-data endpoint.

    Args:
        user_id (str): The ID of the user creating the subscription.
        form_data (dict): Dictionary containing the form submission data.

    Returns:
        dict: Subscription data formatted for the API.
    """

    # Channel mapping constants
    CHANNEL_MAPPING = {
        "TM": "5005",  # Telemarketing
        "EM": "5006",  # Email
        "DM": "5007",  # Direct Marketing
    }

        
    channel = form_data.get('channel', 'EM')
    state = form_data.get('state')
    start_date = form_data.get('start_date')
    end_date = form_data.get('end_date')

    if channel not in CHANNEL_MAPPING:
        raise ValueError(f"Invalid channel: {channel}. Must be one of: {', '.join(CHANNEL_MAPPING.keys())}")
    
    if state not in ["Y", "N"]:
        raise ValueError("State must be 'Y' or 'N'")
        
    # Prepare values dictionary
    value_data = {"value1": state}
    
    # Add optional date fields if provided
    if start_date:
        value_data["startdate"] = start_date
    if end_date:
        value_data["enddate"] = end_date
        
    # Create the complete request payload
    return {
        "itemKey": CHANNEL_MAPPING[channel],
        "clientno": user_id,
        "values": [value_data]
    }