// @flow

import {getConfiguration} from './configuration';

class DuplicateTestError extends Error {}

class TestConcurrencyLimitError extends Error {}

class UnknownTestError extends Error {}

const workerByTestId = new Map();

const allocateTestId = (testId: string): void => {
    if (workerByTestId.has(testId)) {
        throw new DuplicateTestError();
    }

    if (workerByTestId.size >= getConfiguration().testConcurrencyLimit) {
        throw new TestConcurrencyLimitError();
    }

    workerByTestId.set(testId, null);
};

const setWorker = (testId: string, worker: cluster$Worker): void => {
    if (workerByTestId.get(testId) !== null) {
        throw new Error('To set worker test id must first be allocated.');
    }

    workerByTestId.set(testId, worker);
};

const getWorker = (testId: string): cluster$Worker => {
    const worker = workerByTestId.get(testId);

    if (worker === undefined) {
        throw new UnknownTestError();
    }

    if (worker === null) {
        throw new Error('Worker has not been set yet.');
    }

    return worker;
};

const deleteWorker = (testId: string): void => {
    workerByTestId.delete(testId);
};

export {
    DuplicateTestError,
    TestConcurrencyLimitError,
    UnknownTestError,
    allocateTestId,
    setWorker,
    getWorker,
    deleteWorker,
};
