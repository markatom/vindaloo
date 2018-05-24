// @flow

import uuid from 'uuid/v4';

const knownSockets = new Set();
const socketsBySocketId = new Map();

const setSocket = (socket: net$Socket): ?string => {
    if (knownSockets.has(socket)) {
        return null;
    }

    const socketId = uuid();

    knownSockets.add(socket);
    socketsBySocketId.set(socketId, socket);

    return socketId;
};

const getSocket = (id: string): net$Socket => {
    const socket = socketsBySocketId.get(id);
    if (socket == null) {
        throw new Error(`Cannot get socket by id "${id}".`);
    }

    return socket;
};

const deleteSocket = (id: string): void => {
    const socket = getSocket(id);

    knownSockets.delete(socket);
    socketsBySocketId.delete(id);
};

export {
    setSocket,
    getSocket,
    deleteSocket,
};
