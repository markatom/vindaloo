// @flow

import {getConfiguration} from './configuration';
import type http from 'http';
import type https from 'https';

type Server = http.Server | https.Server;

const scope = Symbol.for('vindaloo');

export type TestContext = {
    server: ?Server,
    host: string,
    port: ?number,
};

const initialize = (): TestContext => ({
    server: null,
    host: getConfiguration().host,
    port: null,
});

const install = (vmContext: vm$Context, testContext: TestContext): void => {
    // $FlowFixMe
    vmContext[scope] = testContext;
};

const get = (global: Object): TestContext => { // eslint-disable-line flowtype/no-weak-types
    if (global[scope] == null) {
        throw new Error('Cannot get test context.');
    }

    return global[scope];
};

export {
    initialize,
    install,
    get,
};
