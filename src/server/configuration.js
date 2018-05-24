// @flow

import findRoot from 'find-root';
import normalizeResource from '../normalizeResource';
import path from 'path';

export type BindingType = 'port' | 'header';

export type Configuration = {
    rootDirectory: string,
    host: string,
    port: number,
    endpointsPrefix: string,
    allowedBindingTypes: BindingType[],
    bindingHeaderName: string,
    scenarioDirectories: string[],
    scenarioRegex: string,
    logDirectory: string,
    testConcurrencyLimit: number,
    testDurationTimeout: number,
};

const defaults = {
    host: '127.0.0.1',
    port: 3000,
    endpointsPrefix: '/vindaloo',
    allowedBindingTypes: ['port', 'header'],
    bindingHeaderName: 'X-Test-Id',
    scenarioDirectories: ['tests'],
    scenarioRegex: '.*(\\.|/)scenario\\.js$',
    logDirectory: 'logs/vindaloo',
    testConcurrencyLimit: 8,
    testDurationTimeout: 60,
};

let configuration = null;

const getRootDirectory = (): string => {
    try {
        return findRoot(process.cwd());

    } catch (error) {
        throw new Error('Cannot locate package.json file.');
    }
};

const readConfiguration = (): Configuration => {
    const rootDirectory = getRootDirectory();

    // $FlowFixMe
    const packageJson = require(`${rootDirectory}/package.json`);

    configuration = Object.assign(defaults, packageJson.vindaloo);

    configuration.rootDirectory = rootDirectory;
    configuration.endpointsPrefix = '/' + normalizeResource('/', configuration.endpointsPrefix);
    configuration.bindingHeaderName = configuration.bindingHeaderName.toLowerCase();
    configuration.scenarioDirectories = configuration.scenarioDirectories.map(normalizeResource.bind(null, path.sep));
    configuration.logDirectory = normalizeResource(path.sep, configuration.logDirectory);

    return configuration;
};

const getConfiguration = (): Configuration => {
    if (configuration != null) {
        return configuration;
    }

    return readConfiguration();
};

export {
    getConfiguration,
};
