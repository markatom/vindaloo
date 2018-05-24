// @flow

import * as childProcess from './childProcess';
import * as serverPatch from './serverPatch';
import * as testContext from './testContext';
import * as testLog from './testLog';
import FakeSocket from './FakeSocket';
import fs from 'fs';
import setupScenario from './setupScenario';
import type http from 'http';
import type https from 'https';

type Server = http.Server | https.Server;

let scenario = null;
let logStream = null;
const sockets = new Map();
const context = testContext.initialize();

const createSocket = (id: string, server: Server): FakeSocket => {
    const socket = new FakeSocket();

    socket.on('receive', (chunk: ?string): void => {
        childProcess.call(process, 'send', {
            socketId: id,
            chunk: chunk,
        });
    });

    socket.on('finish', (): void => {
        sockets.delete(id);
    });

    socket.on('setTimeout', (timeout: number): void => {
        childProcess.call(process, 'setTimeout', {
            socketId: id,
            timeout: timeout,
        });
    });

    socket.on('setNoDelay', (noDelay: ?boolean): void => {
        childProcess.call(process, 'setNoDelay', {
            socketId: id,
            noDelay: noDelay,
        });
    });

    sockets.set(id, socket);

    server.emit('connection', socket);

    return socket;
};

const receive = (socketId: string, chunk: ?string): void => {
    let socket = sockets.get(socketId);
    if (socket == null) {
        socket = createSocket(socketId, serverPatch.getServer(context));
    }

    socket.send(chunk);
};

const setup = async (module: string, scenarioName: string, logPath: string, host: string, port: ?number): Promise<void> => {
    if (scenario != null) {
        throw new Error('Test already set up.');
    }

    await testLog.ensureDirectory();
    logStream = fs.createWriteStream(logPath);

    context.host = host;
    context.port = port;

    scenario = await setupScenario(
        module,
        scenarioName,
        logStream,
        context
    );
};

const step = async (): Promise<void> => {
    if (scenario == null) {
        throw new Error('Cannot get current scenario.');
    }

    await scenario.step();
};

const teardown = async (): Promise<void> => {
    if (scenario == null) {
        throw new Error('Cannot get current scenario.');
    }

    await scenario.teardown();
};

childProcess.setup(process, {
    setup: ({module, scenarioName, logPath, host, port}) => setup(module, scenarioName, logPath, host, port),
    step: () => step(),
    teardown: () => teardown(),
    receive: ({socketId, chunk}) => receive(socketId, chunk),
});
