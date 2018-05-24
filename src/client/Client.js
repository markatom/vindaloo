// @flow

import ControlApi from './ControlApi';
import normalizeResource from '../normalizeResource';
import Test from './Test';
import uuid from 'uuid/v4';

export type BindingType = 'port' | 'header';

export type SetupBinding = (portOrHeaderName: number | string, headerValue?: string) => void;

/**
 * Client configuration object.
 * @typedef {Object} Configuration
 * @property {string} host - Host where server is running.
 * @property {number} port - Port where server is listening.
 * @property {string} endpointsPrefix - Prefix for control API's endpoints.
 * @property {function(headerName: string, headerValue: string): void | function(port: number): void} setupBinding - Function passing binding values of each test.
 */
export type Configuration = {
    host?: string,
    port?: number,
    endpointsPrefix?: string,
    bindingType?: BindingType,
    setupBinding?: SetupBinding,
};

export type CompleteConfiguration = {
    host: string,
    port: number,
    endpointsPrefix: string,
    bindingType: BindingType,
    setupBinding: SetupBinding,
};

const configurationDefaults = {
    host: '127.0.0.1',
    port: 3000,
    endpointsPrefix: '/vindaloo',
    bindingType: 'port',
    setupBinding: () => undefined,
};

/**
 * Client holds configuration and is responsible for creating test instances.
 */
export default class Client {
    /** @ignore */
    _configuration: CompleteConfiguration;
    /** @ignore */
    _controlApi: ControlApi;

    constructor(configuration: Configuration): void {
        this._configuration = Object.assign({}, configurationDefaults, configuration);

        this._configuration.endpointsPrefix = '/' + normalizeResource('/', this._configuration.endpointsPrefix);

        this._controlApi = new ControlApi(this._configuration);
    }

    /**
     * Creates new test instance.
     * @param scenario - Name of scenario used by test.
     * @param [id] - Test identifier, if omitted, UUID v4 will be generated.
     * @returns Configured test instance.
     */
    createTest(scenario: string, id?: string): Test {
        const testId = id != null ? id : uuid();

        return new Test(this._controlApi, this._configuration.bindingType, this._configuration.setupBinding, testId, scenario);
    }
}
