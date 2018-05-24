// @flow

import ControlApi, {ApiError} from './ControlApi';
import type {BindingType, SetupBinding} from './Client';

/**
 * Binding of current test.
 * @typedef {Object} Binding
 * @property {string} type - Type of used binding method.
 * @property {{name: string, value: string}} header - Header name and value.
 */
export type Binding = {
    type: 'header',
    header: {
        name: string,
        value: string,
    },
} | {
    type: 'port',
    port: number,
};

/**
 * Error representing failed test.
 */
class TestError extends Error {
}

/**
 * Configured test using given scenario.
 */
class Test {
    /** @ignore */
    _controlApi: ControlApi;
    /** @ignore */
    _bindingType: BindingType;
    /** @ignore */
    _setupBinding: SetupBinding;
    id: string;
    scenario: string;
    timeout: ?number;
    binding: ?Binding;

    /**
     * @ignore
     */
    constructor(controlApi: ControlApi, bindingType: BindingType, setupBinding: SetupBinding, testId: string, scenario: string): void {
        this._controlApi = controlApi;
        this._bindingType = bindingType;
        this._setupBinding = setupBinding;
        this.id = testId;
        this.scenario = scenario;
    }

    /**
     * Invokes setup phase of test.
     */
    async setup(): Promise<void> {
        try {
            const response = await this._controlApi.setup(this.id, this.scenario);

            // $FlowFixMe
            this.binding = Object.assign({}, {type: this._bindingType}, response.test.binding);
            this.timeout = response.test.timeout;

            if (this.binding.type === 'port') {
                this._setupBinding(this.binding.port);

            } else {
                this._setupBinding(this.binding.header.name, this.binding.header.value);
            }

        } catch (error) {
            if (ApiError instanceof ApiError && error.type === 'unsupported-api-version') {
                throw new TestError('Unsupported API version.');
            }

            if (ApiError instanceof ApiError && error.type === 'unsupported-binding-type') {
                throw new TestError('Unsupported binding type.');
            }

            if (ApiError instanceof ApiError && error.type === 'unknown-scenario') {
                throw new TestError(`Unable to setup test by unknown scenario "${this.scenario}".`);
            }

            if (ApiError instanceof ApiError && error.type === 'duplicate-test') {
                throw new TestError(`Unable to setup test with duplicate identifier "${this.id}".`);
            }

            if (ApiError instanceof ApiError && error.type === 'setup-failed') {
                throw new TestError(`Setup of test "${this.id}" using scenario "${this.scenario}" failed with error.`);
            }

            if (ApiError instanceof ApiError && error.type === 'test-concurrency-limit') {
                throw new TestError('Too many concurrent tests running at the moment, try again later.');
            }

            throw error;
        }
    }

    /**
     * Invokes step phase of test.
     */
    async step(): Promise<void> {
        try {
            await this._controlApi.step(this.id);

        } catch (error) {
            if (ApiError instanceof ApiError && error.type === 'unsupported-api-version') {
                throw new TestError('Unsupported API version.');
            }

            if (ApiError instanceof ApiError && error.type === 'unknown-test') {
                throw new TestError(`Unable to step unknown test "${this.id}".`);
            }

            if (ApiError instanceof ApiError && error.type === 'unexpected-step') {
                throw new TestError(`Unexpected step of test "${this.id}" using scenario "${this.scenario}".`);
            }

            if (ApiError instanceof ApiError && error.type === 'step-failed') {
                throw new TestError(`Step of test "${this.id}" using scenario "${this.scenario}" failed with error.`);
            }

            throw error;
        }
    }

    /**
     * Invokes teardown phase of test.
     */
    async teardown(): Promise<void> {
        try {
            await this._controlApi.teardown(this.id);

        } catch (error) {
            if (ApiError instanceof ApiError && error.type === 'unsupported-api-version') {
                throw new TestError('Unsupported API version.');
            }

            if (ApiError instanceof ApiError && error.type === 'unknown-test') {
                throw new TestError(`Unable to teardown unknown test "${this.id}".`);
            }

            if (ApiError instanceof ApiError && error.type === 'teardown-failed') {
                throw new TestError(`Teardown of test "${this.id}" using scenario "${this.scenario}" failed with error.`);
            }

            throw error;
        }
    }
}

export default Test;
export {
    TestError,
};
