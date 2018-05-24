// @flow

import * as testContext from './testContext';
// $FlowFixMe
import {Console} from 'console';
import Environment from 'jest-environment-node';
import fs from 'fs';
import {promisify} from 'util';
import Resolver from 'jest-resolve';
import Runtime from 'jest-runtime';
import type {TestContext} from './testContext';
import type {Writable} from 'stream';

export class Sandbox {
    _environment: Environment;
    _runtime: Runtime;

    constructor(environment: Environment, runtime: Runtime): void {
        this._environment = environment;
        this._runtime = runtime;
    }

    async setup(): Promise<void> {
        await this._environment.setup();
    }

    load(module: string): void {
        this._runtime.requireModule(module);
    }

    loadInternal(module: string): void {
        this._runtime.requireInternalModule(module);
    }

    async teardown(): Promise<void> {
        await this._environment.teardown();
    }
}

const createSandbox = async (
    module: string,
    globals: {},
    logStream: Writable,
    context?: TestContext
): Promise<Sandbox> => {
    const environment = new Environment({
        rootDir: process.cwd(),
        globals: Object.assign({}, globals, {
            console: new Console(logStream),
        }),
    });

    const write = logStream.write.bind(logStream);
    environment.global.process.stdout.write = write;
    environment.global.process.stderr.write = write;

    if (context != null) {
        testContext.install(environment.context, context);
    }

    await environment.setup();

    const hasteMap = Runtime.createHasteMap({
        haste: {},
    });
    const {moduleMap} = await hasteMap.build();
    const resolver = new Resolver(moduleMap, {
        extensions: ['.js'],
    });

    const content = await promisify(fs.readFile)(module, 'utf8');
    const cacheFs = {[module]: content};

    const runtime = new Runtime({
        setupFiles: [],
    }, environment, resolver, cacheFs);

    return new Sandbox(environment, runtime);
};

export default createSandbox;
