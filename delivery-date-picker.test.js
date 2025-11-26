const assert = require('assert');
const { formatDateInputValue } = require('./delivery-date-picker.js');

function testFormatsLocalDate() {
    const date = new Date(2024, 0, 5);
    assert.strictEqual(formatDateInputValue(date), '2024-01-05');
}

function testPadsMonthAndDay() {
    const date = new Date(2024, 10, 15);
    assert.strictEqual(formatDateInputValue(date), '2024-11-15');
}

function run() {
    testFormatsLocalDate();
    testPadsMonthAndDay();
    console.log('formatDateInputValue tests passed');
}

run();
