// @flow

import * as testContext from './testContext';
import type http from 'http';
import type https from 'https';
import type {TestContext} from './testContext';

type Server = http.Server | https.Server;

const originalListen = Symbol('originalListen');

const listen = (server: Server, ...args: mixed[]): void => {
    if (testContext.get(global).server != null) {
        throw new Error('Vindaloo does not support listening on more than one port.');
    }

    const callback = args[args.length - 1];
    if (callback instanceof Function) {
        server.on('listening', callback);
    }

    testContext.get(global).server = server;

    const port = testContext.get(global).port;
    if (port != null) {
        // $FlowFixMe
        server[originalListen](port, testContext.get(global).host);

    } else {
        server.emit('listening');
    }
};

const createFunctionPatch = (original: (...args: mixed[]) => Server): (...args: mixed[]) => Server => {
    return (...args: mixed[]): Server => {
        const server = original(...args);

        // $FlowFixMe
        server[originalListen] = server.listen;
        // $FlowFixMe
        server.listen = listen.bind(null, server);

        return server;
    };
};

const createClassPatch = (Original: Class<Server>): Class<Server> => {
    // $FlowFixMe
    return class extends Original {
        constructor(...args: mixed[]): void {
            super(...args);

            // $FlowFixMe
            this[originalListen] = this.listen;
            // $FlowFixMe
            this.listen = listen.bind(null, this);
        }
    };
};

const getServer = (context: TestContext): Server => {
    if (context.server == null) {
        throw new Error('No server is listening.');
    }

    return context.server;
};

export {
    createFunctionPatch,
    createClassPatch,
    getServer,
};
