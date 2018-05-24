// @flow

import * as childProcess from './childProcess';
import * as controlApi from './controlApi';
import * as scenarioRegistry from './scenarioRegistry';
import * as setupScenario from './setupScenario';
import * as socketRegistry from './socketRegistry';
import * as testLog from './testLog';
import * as testRegistry from './testRegistry';
import {getConfiguration} from './configuration';
import http from 'http';
import net from 'net';
import type {BindingType} from './configuration';
import type {IncomingMessage, ServerResponse} from 'http';

class SetupFailedError extends Error {}

class UnexpectedStepError extends Error {}

class StepFailedError extends Error {}

class TeardownFailedError extends Error {}

const buildRequestHead = (request: IncomingMessage): string => {
    let head = `${request.method} ${request.url} HTTP/${request.httpVersion}\r\n`;

    let name = null;
    for (const item of request.rawHeaders) {
        if (name == null) {
            name = item;
        } else {
            head += `${name}: ${item}\r\n`;
            name = null;
        }
    }

    return head + '\r\n';
};

const getUnusedPort = (): Promise<number> => {
    return new Promise((resolve: (number) => void): void => {
        const server = net.createServer();

        server.listen((): void => {
            const port = server.address().port;
            server.close((): void => {
                resolve(port);
            });
        });
    });
};

const sendChunkToWorker = async (worker: cluster$Worker, socketId: string, chunk: Buffer | string | null): Promise<void> => {
    await childProcess.call(worker, 'receive', {
        socketId: socketId,
        chunk: chunk instanceof Buffer ? chunk.toString('binary') : chunk,
    });
};

const send = (socketId: string, chunk: ?string): void => {
    const socket = socketRegistry.getSocket(socketId);

    if (chunk != null) {
        socket.write(chunk, 'binary');

    } else {
        socket.end();
        socketRegistry.deleteSocket(socketId);
    }
};

const setSocketTimeout = (socketId: string, timeout: number): void => {
    const socket = socketRegistry.getSocket(socketId);

    socket.setTimeout(timeout);
};

const setSocketNoDelay = (socketId: string, noDelay?: boolean): void => {
    const socket = socketRegistry.getSocket(socketId);

    socket.setNoDelay(noDelay);
};

const setup = async (testId: string, scenarioName: string, bindingType: BindingType): Promise<?number> => {
    testRegistry.allocateTestId(testId);

    const scenarioModule = scenarioRegistry.getScenarioModule(scenarioName);

    const worker = await childProcess.spawn(
        require.resolve('./worker.js'),
        {
            send: ({socketId, chunk}) => send(socketId, chunk),
            setTimeout: ({socketId, timeout}) => setSocketTimeout(socketId, timeout),
            setNoDelay: ({socketId, noDelay}) => setSocketNoDelay(socketId, noDelay),
        }
    );
    testRegistry.setWorker(testId, worker);

    console.log(`Test "${testId}" setup using scenario "${scenarioName}".`);

    setTimeout((): void => {
        if (!worker.isDead()) {
            worker.kill();
            console.error(`Test "${testId}" does not completed within specified timeout and has been killed.`);
        }
    }, getConfiguration().testDurationTimeout * 1000);

    worker.on('exit', (): void => {
        testRegistry.deleteWorker(testId);

        // $FlowFixMe
        if (!worker.exitedAfterDisconnect) {
            console.log(`Process of test "${testId}" died.`);
        }
    });

    let port = null;
    if (bindingType === 'port') {
        port = await getUnusedPort();
    }

    try {
        await childProcess.call(worker, 'setup', {
            module: scenarioModule,
            scenarioName: scenarioName,
            logPath: testLog.getPath(testId),
            host: getConfiguration().host,
            port: port,
        });

        return port;

    } catch (error) {
        worker.kill();

        if (error.name === setupScenario.LifecycleError.name) {
            throw new SetupFailedError();
        }

        throw error;
    }
};

const step = async (testId: string): Promise<void> => {
    const worker = testRegistry.getWorker(testId);

    console.log(`Test "${testId}" step".`);
    try {
        await childProcess.call(worker, 'step');

    } catch (error) {
        worker.kill();

        if (error.name === setupScenario.UnexpectedStepError.name) {
            throw new UnexpectedStepError();
        }

        if (error.name === setupScenario.LifecycleError.name) {
            throw new StepFailedError();
        }

        throw error;
    }
};

const teardown = async (testId: string): Promise<void> => {
    const worker = testRegistry.getWorker(testId);

    console.log(`Test "${testId}" teardown.`);

    try {
        await childProcess.call(worker, 'teardown');

    } catch (error) {
        worker.kill();

        if (error.name === setupScenario.LifecycleError.name) {
            throw new TeardownFailedError();
        }

        throw error;
    }

    const gracePeriod = Promise.race([
        new Promise((resolve) => setTimeout(() => resolve(), 3000)),
        new Promise((resolve) => worker.once('exit', () => resolve())),
    ]);

    worker.disconnect(); // close IPC channel
    await gracePeriod;

    if (!worker.isDead()) {
        worker.kill();
        console.error(`Process of test "${testId}" does not exited in timely manner and has been killed.`);
    }
};

const handleTestRequest = async (request: IncomingMessage): Promise<void> => {
    const socketId = socketRegistry.setSocket(request.socket);
    if (socketId == null) {
        return;
    }

    const testId = request.headers[getConfiguration().bindingHeaderName];
    const worker = testRegistry.getWorker(testId);

    const boundSendChunkToWorker = await sendChunkToWorker.bind(null, worker, socketId);

    request.socket.on('end', (): void => {
        boundSendChunkToWorker(null);
    });

    boundSendChunkToWorker(buildRequestHead(request));

    request.on('data', boundSendChunkToWorker);
    request.on('end', (): void => {
        request.socket.on('data', boundSendChunkToWorker);
    });
};

const handleRequest = async (
    handleControlRequest: (request: IncomingMessage, response: ServerResponse) => void,
    request: IncomingMessage,
    response: ServerResponse
): Promise<void> => {
    if (request.headers[getConfiguration().bindingHeaderName] == null) {
        handleControlRequest(request, response);

    } else {
        await handleTestRequest(request);
    }
};

const startServer = (): void => {
    const server = new http.Server();

    const handleControlRequest = controlApi.createHandler();

    server.on('request', handleRequest.bind(null, handleControlRequest));
    server.on('upgrade', handleTestRequest);
    server.on('listening', () => console.log(`Server is listening on ${getConfiguration().host}:${getConfiguration().port}.`));

    server.listen(getConfiguration().port, getConfiguration().host);
};

export {
    startServer,
    setup,
    step,
    teardown,
    SetupFailedError,
    UnexpectedStepError,
    StepFailedError,
    TeardownFailedError,
};
