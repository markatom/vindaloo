// @flow

import cluster from 'cluster';
import uuid from 'uuid/v4';

type HandlerMap = {[string]: (any) => ?mixed | Promise<?mixed>}; // eslint-disable-line flowtype/no-weak-types

type Message = {
    kind: 'call',
    requestId: string,
    type: string,
    parameters: mixed,
} | {
    kind: 'resolve',
    requestId: string,
    value: mixed,
} | {
    kind: 'reject',
    requestId: string,
    error: {},
};

class Deferred<T> {
    resolve: (T) => void;
    reject: (Error) => void;
    promise: Promise<T>;

    constructor(): void {
        this.promise = new Promise((resolve: (T) => void, reject: (Error) => void): void => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }
}

const deferredResponses = new Map();

// $FlowFixMe
const serializeError = (error: Error): {} => ({
    name: error.constructor.name,
    message: error.message,
    stack: error.stack,
    ...error,
});

const deserializeError = (serializedError: {}): Error => {
    const error = new Error();

    for (const property in serializedError) {
        // $FlowFixMe
        error[property] = serializedError[property];
    }

    return error;
};

const setMessageHandler = (emitter: Process | cluster$Worker, handlerMap: HandlerMap): void => {
    emitter.on('message', async (message: Message): Promise<void> => {
        switch (message.kind) {
            case 'call': {
                const handler = handlerMap[message.type];
                if (handler == null) {
                    throw new Error(`Unexpected message type "${message.type}".`);
                }

                try {
                    const value = await handler(message.parameters);

                    // $FlowFixMe
                    emitter.send({
                        kind: 'resolve',
                        requestId: message.requestId,
                        value: value,
                    });

                } catch (error) {
                    // $FlowFixMe
                    emitter.send({
                        kind: 'reject',
                        requestId: message.requestId,
                        error: serializeError(error),
                    });
                }

                break;
            }

            case 'resolve': {
                const deferred = deferredResponses.get(message.requestId);
                if (deferred == null) {
                    throw new Error(`Unexpected request id "${message.requestId}".`);
                }

                deferredResponses.delete(message.requestId);

                deferred.resolve(message.value);
                break;
            }

            case 'reject': {
                const deferred = deferredResponses.get(message.requestId);
                if (deferred == null) {
                    throw new Error(`Unexpected request id "${message.requestId}".`);
                }

                deferredResponses.delete(message.requestId);

                deferred.reject(deserializeError(message.error));
                break;
            }

            default:
                throw new Error(`Unexpected message kind "${message.kind}".`);
        }
    });
};

const spawn = async (module: string, handlerMap: HandlerMap): Promise<cluster$Worker> => {
    cluster.setupMaster({
        exec: module,
    });

    const worker = cluster.fork();

    const onlineWorker = new Promise((resolve: (cluster$Worker) => void, reject: (Error) => void): void => {
        worker.on('error', reject);
        worker.on('online', (): void => {
            worker.removeListener('error', reject);
            resolve(worker);
        });
    });

    setMessageHandler(worker, handlerMap);

    return await onlineWorker;
};

const setup = (process: Process, handlerMap: HandlerMap): void => {
    setMessageHandler(process, handlerMap);
};

const call = (emitter: Process | cluster$Worker, type: string, paraneters?: mixed): Promise<mixed> => {
    // $FlowFixMe
    const process = 'process' in emitter ? emitter.process : emitter;
    if (!process.connected) {
        throw new Error('Cannot send request, IPC channel has been disconnected.');
    }

    const id = uuid();
    const deferred = new Deferred();

    deferredResponses.set(id, deferred);

    // $FlowFixMe
    emitter.send({
        kind: 'call',
        requestId: id,
        type: type,
        parameters: paraneters,
    });

    return deferred.promise;
};

export {
    spawn,
    setup,
    call,
};
