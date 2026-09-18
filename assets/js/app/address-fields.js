// One field layout for every address entry point; values are assigned through DOM properties.
const labels = {
    nl: { PostalCode: 'Postcode *', HouseNumber: 'Huisnr. (en letter) *', HouseExt: 'Huisnummer toevoeging', AddressExtension: '(interne) Toevoeging 1', AdditionalExtension: '(interne) Toevoeging 2', Address: 'Straat *', City: 'Plaats *', CountryCode: 'Landcode', postalTitle: 'Voer een geldige postcode in (bijv. 1234AB)', numberTitle: 'Voer een geldig huisnummer in (bijv. 123 of 123A)' },
    en: { PostalCode: 'Postal code *', HouseNumber: 'House no. (and letter) *', HouseExt: 'House number addition', AddressExtension: '(internal) Addition 1', AdditionalExtension: '(internal) Addition 2', Address: 'Street *', City: 'City *', CountryCode: 'Country code', postalTitle: 'Enter a valid postal code (e.g. 1234AB)', numberTitle: 'Enter a valid house number (e.g. 123 or 123A)' }
};

export function renderAddressFields(prefix, { source = false, locale = globalThis.document?.documentElement?.lang || 'nl' } = {}) {
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(prefix)) throw new Error('Invalid address field prefix');
    const text = labels[locale.startsWith('en') ? 'en' : 'nl'];
    const keys = { PostalCode: 'postalCodePlaceholder', HouseNumber: 'houseNumberPlaceholder', HouseExt: 'houseExtensionPlaceholder', AddressExtension: 'addressExtensionPlaceholder', AdditionalExtension: 'additionalAddressExtensionLabel', Address: 'streetPlaceholder', City: 'cityPlaceholder', CountryCode: 'countryCodeLabel' };
    function field(suffix, attributes = '') {
        return `<div class="customer-address-field"><label for="${prefix}${suffix}" data-i18n="forms.${keys[suffix]}">${text[suffix]}</label><input type="text" class="form-control" id="${prefix}${suffix}" data-feedback-sensitive="${suffix === 'PostalCode' ? 'postal-code' : 'address'}" autocomplete="off" ${attributes}></div>`;
    }
    return `<div class="address-fields" data-address-prefix="${prefix}">
        <div class="form-row customer-address-row">
            ${field('PostalCode', `pattern="^[1-9][0-9]{3}[a-zA-Z]{2}$" title="${text.postalTitle}" data-i18n-title="forms.postalCodeTitle" required`)}
            ${field('HouseNumber', `maxlength="7" pattern="^[1-9][0-9]{0,5}[A-Z]?$" title="${text.numberTitle}" data-i18n-title="forms.houseNumberTitle" required`)}
            ${field('HouseExt', 'readonly maxlength="10"')}
            ${field('AddressExtension', 'maxlength="60"')}
        </div>
        <div class="form-row customer-address-row">
            ${field('Address', 'required')}
            ${field('City', 'required')}
        </div>
        ${source ? `<div class="form-row customer-address-row">${field('AdditionalExtension', 'maxlength="60"')}${field('CountryCode', 'readonly')}</div>` : ''}
    </div>`;
}

export function mountAddressFields(documentRef = document) {
    for (const container of documentRef.querySelectorAll('[data-address-fields]')) {
        container.innerHTML = renderAddressFields(container.dataset.addressFields, { locale: documentRef.documentElement.lang });
    }
}

export function splitAddressHouseNumber(value) {
    const normalized = String(value || '').trim().toUpperCase();
    const parts = normalized.match(/^([1-9][0-9]*[A-Z]?)(?:\s+(.+))?$/)
        || normalized.match(/^([1-9][0-9]*[A-Z])([0-9].*)$/);
    return parts ? { HouseNumber: parts[1], HouseExt: parts[2] || parts[3] || '' } : { HouseNumber: normalized, HouseExt: '' };
}

export function sourceAddressValues(fields) {
    return { PostalCode: fields.postCode || '', ...splitAddressHouseNumber(fields.housenumber),
        Address: fields.street || '', City: fields.city || '', AddressExtension: fields.extension || '',
        AdditionalExtension: fields.additionalExtension || '', CountryCode: fields.isoCountryCode || '' };
}

const sourceFieldNames = { PostalCode: 'postCode', Address: 'street', City: 'city', AddressExtension: 'extension', AdditionalExtension: 'additionalExtension' };

export function sourceAddressInputName(suffix) {
    if (suffix === 'HouseNumber' || suffix === 'HouseExt') return 'housenumber';
    return sourceFieldNames[suffix] || 'isoCountryCode';
}

export function sourceAddressChanges(initial, values) {
    const changes = {};
    for (const [suffix, field] of Object.entries(sourceFieldNames)) {
        if (values[suffix] !== initial[suffix]) changes[field] = values[suffix];
    }
    if (values.HouseNumber !== initial.HouseNumber || values.HouseExt !== initial.HouseExt) {
        changes.housenumber = `${values.HouseNumber} ${values.HouseExt}`.trim();
    }
    return changes;
}
