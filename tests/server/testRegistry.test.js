import * as configuration from '../../src/server/configuration';
import * as testRegistry from '../../src/server/testRegistry';

jest.spyOn(configuration, 'getConfiguration').mockImplementation(() => ({testConcurrencyLimit: 2}));

test('duplicate test', () => {
    testRegistry.allocateTestId('foo');
    expect(() => {
        testRegistry.allocateTestId('foo');
    }).toThrow(testRegistry.DuplicateTestError);

    testRegistry.deleteWorker('foo');
});

test('test concurrency limit', () => {
    testRegistry.allocateTestId('foo');
    testRegistry.allocateTestId('bar');
    expect(() => {
        testRegistry.allocateTestId('baz');
    }).toThrow(testRegistry.TestConcurrencyLimitError);

    testRegistry.deleteWorker('foo');
    testRegistry.deleteWorker('bar');
});

test('allocate test id, set and get worker', () => {
    const worker = {};

    testRegistry.allocateTestId('foo');
    testRegistry.setWorker('foo', worker);
    expect(testRegistry.getWorker('foo')).toBe(worker);

    testRegistry.deleteWorker('foo');
});

test('test id not allocated', () => {
    expect(() => {
        testRegistry.setWorker('foo', null);
    }).toThrow('To set worker test id must first be allocated.');
});

test('unknown test id', () => {
    expect(() => {
        testRegistry.getWorker('foo');
    }).toThrow(testRegistry.UnknownTestError);
});

test('worker not set', () => {
    testRegistry.allocateTestId('foo');
    expect(() => {
        testRegistry.getWorker('foo');
    }).toThrow('Worker has not been set yet.');

    testRegistry.deleteWorker('foo');
});

test('allocate test id, set, delete and get worker', () => {
    const worker = {};

    testRegistry.allocateTestId('foo');
    testRegistry.setWorker('foo', worker);
    testRegistry.deleteWorker('foo');
    expect(() => {
        testRegistry.getWorker('foo');
    }).toThrow(testRegistry.UnknownTestError);
});
