// @flow

import createSandbox from './createSandbox';
import fs from 'fs';
import {getConfiguration} from './configuration';
import path from 'path';
import {promisify} from 'util';
import ScenarioSections from './ScenarioSections';

class UnknownScenarioError extends Error {}

let modulesByName = null;

const listDirectory = async (directory: string): Promise<string[]> => {
    const entries = await promisify(fs.readdir)(directory);

    const promises = entries.map(async (entry: string): Promise<string[]> => {
        const entryPath = path.join(directory, entry);
        const entryStat = await promisify(fs.stat)(entryPath);

        if (entryStat.isDirectory()) {
            return await listDirectory(entryPath);

        }
        return [entryPath];

    });

    const results = await Promise.all(promises);

    return [].concat(...results);
};

const collectScenarios = async (): Promise<void> => {
    const allModules = [];
    for (const directory of getConfiguration().scenarioDirectories) {
        const scenarioDirectory = path.join(getConfiguration().rootDirectory, directory);
        const directoryModules = await listDirectory(scenarioDirectory);
        allModules.push(...directoryModules);
    }

    const regexp = new RegExp(getConfiguration().scenarioRegex);
    const scenarioModules = allModules.filter((file) => regexp.test(file));

    modulesByName = new Map();

    for (const module of scenarioModules) {
        const scenarioSections = new ScenarioSections();

        const sandbox = await createSandbox(module, scenarioSections.getSections(), process.stdout);
        await sandbox.setup();

        sandbox.load(module);
        const scenarioIds = scenarioSections.collectScenarios();

        await sandbox.teardown();

        for (const scenarioId of scenarioIds) {
            modulesByName.set(scenarioId, module);
        }
    }
};

const getScenarioModule = (scenarioName: string): string => {
    if (modulesByName == null) {
        throw new Error('Scenarios must first be collected.');
    }

    const module = modulesByName.get(scenarioName);
    if (module == null) {
        throw new UnknownScenarioError();
    }

    return module;
};

export {
    UnknownScenarioError,
    collectScenarios,
    getScenarioModule,
};
