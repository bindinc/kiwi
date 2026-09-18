import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sourceAddressValues, sourceAddressChanges, splitAddressHouseNumber } from '../../../assets/js/app/address-fields.js';

test('source address mapping separates the house letter, provider addition and internal additions', () => {
    const original = { postCode: '1223CK', housenumber: '2A2', street: 'Kometenstraat', city: 'HILVERSUM', isoCountryCode: 'NL', extension: '310', additionalExtension: 'Attn. reception' };
    const fields = sourceAddressValues(original);
    assert.deepEqual(splitAddressHouseNumber('2A2'), { HouseNumber: '2A', HouseExt: '2' });
    assert.equal(fields.AddressExtension, '310');
    assert.equal(fields.AdditionalExtension, 'Attn. reception');
    assert.deepEqual(sourceAddressChanges(fields, fields), {});
    assert.deepEqual(sourceAddressChanges(fields, { ...fields, HouseExt: '1' }), { housenumber: '2A 1' });
    assert.deepEqual(sourceAddressChanges(fields, { ...fields, AddressExtension: '', AdditionalExtension: 'Desk' }), { extension: '', additionalExtension: 'Desk' });
    assert.equal(original.housenumber, '2A2');
});

test('foreign source addresses remain intact for read-only display', () => {
    const fields = sourceAddressValues({ housenumber: '12-14', postCode: 'SW1A 1AA', isoCountryCode: 'GB' });
    assert.equal(fields.HouseNumber, '12-14');
    assert.equal(fields.CountryCode, 'GB');
    assert.deepEqual(sourceAddressChanges(fields, fields), {});
});
