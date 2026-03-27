import assert from 'node:assert/strict';
import { __customerDetailTestUtils } from '../../../../assets/js/app/slices/customer-detail-slice.js';

function testBuildCustomerHeaderIncludesPersonId() {
    const header = __customerDetailTestUtils.buildCustomerHeader({
        salutation: 'Dhr.',
        firstName: 'Bart',
        middleName: 'de',
        lastName: 'Deijkers',
        personId: '12345'
    });

    assert.equal(header, 'Dhr. Bart de Deijkers (12345)');
}

function testBuildCustomerHeaderFallsBackToNameWithoutPersonId() {
    const header = __customerDetailTestUtils.buildCustomerHeader({
        firstName: 'Bart',
        lastName: 'Deijkers'
    });

    assert.equal(header, 'Bart Deijkers');
}

function run() {
    testBuildCustomerHeaderIncludesPersonId();
    testBuildCustomerHeaderFallsBackToNameWithoutPersonId();
    console.log('customer detail slice tests passed');
}

run();
