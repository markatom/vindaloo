// @flow

import * as master from './master';
import * as scenarioRegistry from './scenarioRegistry';
import * as testRegistry from './testRegistry';
import bodyParser from 'koa-bodyparser';
import {getConfiguration} from './configuration';
import Koa from 'koa';
import route from 'koa-route';
import type {BindingType} from './configuration';
import type {Context} from 'koa';
import type {IncomingMessage, ServerResponse} from 'http';

type SetupRequestBody = {
    version: number,
    test: {
        id: string,
        scenario: {
            name: string,
        },
        binding: {
            type: string,
        },
    },
};

type TestIdRequestBody = {
    version: number,
    test: {
        id: string,
    },
};

class ApiError extends Error {
    status: number;
    type: string;

    constructor(status: number, type: string, message: string): void {
        super(message);
        this.status = status;
        this.type = type;
    }
}

const errorHandler = async (context: Context, next: () => Promise<void>): Promise<void> => {
    try {
        await next();

    } catch (error) {
        if (error instanceof ApiError) {
            context.response.status = error.status;
            context.response.body = {
                type: error.type,
                message: error.message,
            };

        } else {
            console.error(error);

            context.response.status = 500;
            context.response.body = {
                type: 'unexpected-error',
                message: 'Unexpected error.',
            };
        }
    }
};

const setup = async (context: Context): Promise<void> => {
    // $FlowFixMe
    const body: SetupRequestBody = context.request.body;

    if (body.version !== 1) {
        throw new ApiError(400, 'unsupported-api-version', 'Unsupported API version.');
    }

    if (!getConfiguration().allowedBindingTypes.includes(body.test.binding.type)) {
        throw new ApiError(400, 'unsupported-binding-type', 'Unsupported binding type.');
    }

    // $FlowFixMe
    const bindingType: BindingType = body.test.binding.type;
    const testId = body.test.id;
    const scenarioName = body.test.scenario.name;

    try {
        const port = await master.setup(testId, scenarioName, bindingType);

        const binding = bindingType === 'port'
            ? {
                port: port,
            }
            : {
                header: {
                    name: getConfiguration().bindingHeaderName,
                    value: testId,
                },
            };

        context.response.status = 200;
        context.response.body = {
            test: {
                binding: binding,
                timeout: getConfiguration().testDurationTimeout,
            },
        };

    } catch (error) {
        if (error instanceof testRegistry.DuplicateTestError) {
            throw new ApiError(400, 'duplicate-test', `Duplicate test "${testId}".`);
        }

        if (error instanceof testRegistry.TestConcurrencyLimitError) {
            throw new ApiError(400, 'test-concurrency-limit', 'Too many concurrent tests running at the moment, try again later.');
        }

        if (error instanceof scenarioRegistry.UnknownScenarioError) {
            throw new ApiError(400, 'unknown-scenario', `Unknown scenario "${scenarioName}".`);
        }

        if (error instanceof master.SetupFailedError) {
            throw new ApiError(500, 'setup-failed', `Setup of test "${testId}" using scenario "${scenarioName}" failed with error.`);
        }

        throw error;
    }
};

const step = async (context: Context): Promise<void> => {
    // $FlowFixMe
    const body: TestIdRequestBody = context.request.body;

    if (body.version !== 1) {
        throw new ApiError(400, 'unsupported-api-version', 'Unsupported API version.');
    }

    const testId = body.test.id;

    try {
        await master.step(testId);

        context.response.status = 204;

    } catch (error) {
        if (error instanceof testRegistry.UnknownTestError) {
            throw new ApiError(400, 'unknown-test', `Unknown test "${testId}".`);
        }

        if (error instanceof master.UnexpectedStepError) {
            throw new ApiError(400, 'unexpected-step', `Unexpected step of test "${testId}" using scenario "${error.scenarioId}".`);
        }

        if (error instanceof master.StepFailedError) {
            throw new ApiError(500, 'step-failed', `Step of test "${testId}" using scenario "${error.scenarioId}" failed with error.`);
        }

        throw error;
    }
};

const teardown = async (context: Context): Promise<void> => {
    // $FlowFixMe
    const body: TestIdRequestBody = context.request.body;

    if (body.version !== 1) {
        throw new ApiError(400, 'unsupported-api-version', 'Unsupported API version.');
    }

    const testId = body.test.id;

    try {
        await master.teardown(testId);

        context.response.status = 204;

    } catch (error) {
        if (error instanceof testRegistry.UnknownTestError) {
            throw new ApiError(400, 'unknown-test', `Unknown test "${testId}".`);
        }

        if (error instanceof master.TeardownFailedError) {
            throw new ApiError(500, 'teardown-error', `Teardown of test "${testId}" using scenario "${error.scenarioId}" failed with error.`);
        }

        throw error;
    }
};

const createHandler = (): (request: IncomingMessage, response: ServerResponse) => void => {
    const app = new Koa();

    app.use(bodyParser());
    app.use(errorHandler);
    app.use(route.post(`${getConfiguration().endpointsPrefix}/setup`, setup));
    app.use(route.post(`${getConfiguration().endpointsPrefix}/step`, step));
    app.use(route.post(`${getConfiguration().endpointsPrefix}/teardown`, teardown));

    return app.callback();
};

export {
    createHandler,
};
