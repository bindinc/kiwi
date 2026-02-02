from schwifty import IBAN
from wtforms import StringField, SelectField
from wtforms.validators import DataRequired, Email, Length, Regexp, ValidationError
import re

from app.utils.address_formatter import normalize_houseno, is_valid_houseno



class CustomValidators:
    """Custom validation rules for form fields.
    
    This class provides static validation methods for validating form field values
    according to specific format requirements. These validators are designed to be
    used with WTForms validators in Flask applications, particularly for validating
    Dutch and Belgian specific data formats.
    """

    @staticmethod
    def validate_iban(_, field):
        """Validate IBAN format for NL and BE accounts."""
        if not field.data:
            return

        raw_value = str(field.data)
        normalised_value = re.sub(r'\s+', '', raw_value).upper()
        field.data = normalised_value

        try:
            iban_obj = IBAN(normalised_value, validate_bban=True)
        except ValueError:
            field.errors.append('Vul een geldig rekeningnummer in (IBAN)')
            return

        if iban_obj.country_code not in ('NL', 'BE'):
            field.errors.append('Voer een geldig IBAN in. Alleen Nederlandse (NL) en Belgische (BE) IBANs worden ondersteund.')
            return

        if len(normalised_value) < 16:
            field.errors.append('IBAN nummer lijkt onvolledig. Een geldig IBAN bevat minimaal 16 tekens.')


    @staticmethod
    def validate_initials(_, field):
        """Normalise initials and ensure each letter ends with a dot."""

        if not field.data:
            return

        raw_value = str(field.data)
        initials_without_spacing = re.sub(r'[\s.]', '', raw_value)
        limited_initials = initials_without_spacing[:5]
        formatted_initials = ''.join(f'{char.upper()}.' for char in limited_initials)
        field.data = formatted_initials

        pattern = re.compile(r'^[A-Z](\.[A-Z])*(\.)?$')
        pattern_is_valid = bool(pattern.fullmatch(formatted_initials))

        if not limited_initials or not pattern_is_valid:
            field.errors.append(
                'Gebruik alleen letters met een punt na elke letter (bijv. "J.")'
            )

    @staticmethod
    def validate_middlename(_, field):
        """Validate middle name format.

        Validates that the input contains only letters and spaces.

        Args:
            _ (Form): The form containing the field (unused but required by WTForms).
            field (Field): The field to validate containing the middle name.
            
        Returns:
            None: Adds error messages to the field.errors list if validation fails.
        """
        if not field.data:
            return
        if not all(c.isalpha() or c.isspace() for c in field.data):
            field.errors.append(
                "Tussenvoegsel mag alleen letters en spaties bevatten")

    @staticmethod
    def validate_lastname(_, field):
        """Normalise last name and reject non-letter characters."""

        if not field.data:
            return

        raw_value = str(field.data).strip()
        if not raw_value:
            field.data = raw_value
            return

        normalised_lastname = ' '.join(part.capitalize() for part in raw_value.split())
        field.data = normalised_lastname

        if not all(char.isalpha() or char.isspace() for char in normalised_lastname):
            field.errors.append('Gebruik alleen letters en spaties voor dit veld.')

    @staticmethod
    def validate_zipcode(form, field):
        """Validate Dutch postcode format with normalisation."""
        if not field.data:
            return

        raw_value = str(field.data)
        normalised_value = re.sub(r'\s+', '', raw_value).upper()
        field.data = normalised_value

        validator = Regexp(
            r'^[1-9][0-9]{3}[A-Z]{2}$',
            message='Postcode moet vier cijfers gevolgd door twee hoofdletters bevatten'
        )

        try:
            validator(form, field)
        except ValidationError as error:
            field.errors.append(str(error))


    @staticmethod
    def validate_houseno(_, field):
        """Validate Dutch house number format.

        Normalises the value by removing whitespace and uppercasing the optional letter 
        before applying the format validation.
        """
        if not field.data:
            return

        sanitised_value = normalize_houseno(field.data)
        field.data = sanitised_value

        if not is_valid_houseno(sanitised_value):
            field.errors.append(
                'Huisnummer moet beginnen met een cijfer en mag optioneel een hoofdletter bevatten'
            )


    @staticmethod
    def validate_houseno_extension(_, field):
        """Validate optional house number extension."""
        if not field.data:
            return

        trimmed_value = str(field.data).strip()
        if not trimmed_value:
            field.data = ''
            return

        if len(trimmed_value) > 10 or not re.fullmatch(r'[\w\s\-.,()\'"]{1,10}', trimmed_value):
            field.errors.append('Toevoeging mag alleen letters, cijfers en leestekens bevatten.')
            return

        field.data = trimmed_value


    @staticmethod
    def validate_phone(_, field):
        """Validate Dutch phone number format."""
        if not field.data:
            return

        value = str(field.data).replace(' ', '')
        field.data = value

        if not re.fullmatch(r'\+?\d{10,15}', value):
            field.errors.append('Voer een geldig telefoonnummer in.')

    @staticmethod
    def validate_birthdate(_, field):
        """Validate birthdate format (dd-mm-yyyy or yyyy-mm-dd)."""
        if not field.data:
            return

        value = field.data.strip()
        # Allow separators: - / .
        clean_value = value.replace('/', '-').replace('.', '-')
        
        parts = clean_value.split('-')
        if len(parts) != 3:
            field.errors.append("Voer een geldige datum in (dd-mm-jjjj)")
            return

        try:
            p1, p2, p3 = parts
            # Check if it matches dd-mm-yyyy
            if len(p3) == 4 and len(p1) <= 2 and len(p2) <= 2:
                day, month, year = int(p1), int(p2), int(p3)
            # Check if it matches yyyy-mm-dd
            elif len(p1) == 4 and len(p2) <= 2 and len(p3) <= 2:
                year, month, day = int(p1), int(p2), int(p3)
            else:
                raise ValueError

            # Basic date validation
            if not (1900 <= year <= 2100):
                field.errors.append("Voer een geldig jaartal in")
                return
            if not (1 <= month <= 12):
                field.errors.append("Ongeldige maand")
                return
            if not (1 <= day <= 31):
                field.errors.append("Ongeldige dag")
                return
                
        except ValueError:
            field.errors.append("Voer een geldige datum in (dd-mm-jjjj)")
