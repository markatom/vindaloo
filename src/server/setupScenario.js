// @flow

import createSandbox from './createSandbox';
import ScenarioSections from './ScenarioSections';
import type {Callback} from './ScenarioSections';
import type {Sandbox} from './createSandbox';
import type {TestContext} from './testContext';
import type {Writable} from 'stream';

class LifecycleError extends Error {
    scenarioId: string;

    constructor(scenarioId: string): void {
        super();
        this.scenarioId = scenarioId;
    }
}

class UnexpectedStepError extends Error {
    scenarioId: string;

    constructor(scenarioId: string): void {
        super();
        this.scenarioId = scenarioId;
    }
}

class Scenario {
    _sandbox: Sandbox;
    _scenarioId: string;
    _scenarioSteps: Callback[];
    _scenarioTeardown: ?Callback;

    constructor(sandbox: Sandbox, scenarioId: string, scenarioSteps: Callback[], scenarioTeardown: ?Callback): void {
        this._sandbox = sandbox;
        this._scenarioId = scenarioId;
        this._scenarioSteps = Array.from(scenarioSteps); // copy
        this._scenarioTeardown = scenarioTeardown;
    }

    async step(): Promise<void> {
        const scenarioStep = this._scenarioSteps.shift();
        if (scenarioStep == null) {
            throw new UnexpectedStepError(this._scenarioId);
        }

        try {
            await scenarioStep();

        } catch (error) {
            console.log(error);
            throw new LifecycleError(this._scenarioId);
        }
    }

    async teardown(): Promise<void> {
        if (this._scenarioTeardown != null) {
            try {
                await this._scenarioTeardown();

            } catch (error) {
                console.log(error);
                throw new LifecycleError(this._scenarioId);
            }
        }

        await this._sandbox.teardown();
    }
}

const setupScenario = async (
    module: string,
    scenarioId: string,
    logStream: Writable,
    context: TestContext
): Promise<Scenario> => {
    const scenarioSections = new ScenarioSections();

    const sandbox = await createSandbox(module, scenarioSections.getSections(), logStream, context);
    await sandbox.setup();

    sandbox.loadInternal(require.resolve('./setupScript'));
    sandbox.load(module);
    const lifecycle = scenarioSections.collectLifecycle(scenarioId);

    try {
        await lifecycle.setup();

    } catch (error) {
        console.log(error);
        throw new LifecycleError(scenarioId);
    }

    return new Scenario(sandbox, scenarioId, lifecycle.steps, lifecycle.teardown);
};

export default setupScenario;
export {
    LifecycleError,
    UnexpectedStepError,
    Scenario,
};
