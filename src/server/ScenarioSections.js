// @flow

export type Callback = () => void | Promise<void>;

type Phase = 'scenario' | 'lifecycle' | 'done';

export default class ScenarioSections {
    _phase: Phase;
    _scenarioIdToCallback: Map<string, Callback>;
    _setupCallback: ?Callback;
    _stepCallbacks: Callback[];
    _teardownCallback: ?Callback;

    constructor(): void {
        this._phase = 'scenario';
        this._scenarioIdToCallback = new Map();
        this._stepCallbacks = [];
    }

    getSections(): * {
        return {
            scenario: this._scenario.bind(this),
            setup: this._setup.bind(this),
            step: this._step.bind(this),
            teardown: this._teardown.bind(this),
        };
    }

    collectLifecycle(scenarioId: string): * {
        const scenarioCallback = this._scenarioIdToCallback.get(scenarioId);
        if (scenarioCallback == null) {
            throw new Error(`Cannot find scenario "${scenarioId}".`);
        }

        this._phase = 'lifecycle';
        scenarioCallback();
        this._phase = 'done';

        if (this._setupCallback == null) {
            throw new Error(`Cannot find mandatory setup section within scenario "${scenarioId}".`);
        }

        return {
            setup: this._setupCallback,
            steps: this._stepCallbacks,
            teardown: this._teardownCallback,
        };
    }

    collectScenarios(): string[] {
        this._phase = 'done';

        return Array.from(this._scenarioIdToCallback.keys());
    }

    _scenario(id: string, callback: Callback): void {
        if (this._phase !== 'scenario') {
            throw new Error('Scenario cannot contain another scenario.');
        }

        if (this._scenarioIdToCallback.get(id) != null) {
            throw new Error(`Duplicate definition for scenario "${id}".`);
        }

        this._scenarioIdToCallback.set(id, callback);
    }

    _setup(callback: Callback): void {
        if (this._phase !== 'lifecycle') {
            throw new Error('Setup section must be placed inside scenario.');
        }

        if (this._setupCallback != null) {
            throw new Error('Only one setup section is allowed within scenario.');
        }

        this._setupCallback = callback;
    }

    _step(callback: Callback): void {
        if (this._phase !== 'lifecycle') {
            throw new Error('Step section must be placed inside scenario.');
        }

        this._stepCallbacks.push(callback);
    }

    _teardown(callback: Callback): void {
        if (this._phase !== 'lifecycle') {
            throw new Error('Teardown section must be placed inside scenario.');
        }

        if (this._teardownCallback != null) {
            throw new Error('Only one teardown section is allowed within scenario.');
        }

        this._teardownCallback = callback;
    }
}
