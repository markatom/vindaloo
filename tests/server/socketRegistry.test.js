import * as socketRegistry from '../../src/server/socketRegistry';

test('set and get socket', () => {
    const socket = {};

    const id = socketRegistry.setSocket(socket);
    expect(id).toEqual(expect.any(String));
    expect(socketRegistry.getSocket(id)).toBe(socket);
});

test('set socket twice', () => {
    const socket = {};

    socketRegistry.setSocket(socket);
    const id = socketRegistry.setSocket(socket);
    expect(id).toBeNull();
});

test('get unknown socket', () => {
    expect(() => {
        socketRegistry.getSocket('foo');
    }).toThrow('Cannot get socket by id "foo".');
});

test('delete unknown socket', () => {
    expect(() => {
        socketRegistry.deleteSocket('foo');
    }).toThrow('Cannot get socket by id "foo".');
});

test('set, delete and get socket', () => {
    const socket = {};

    const id = socketRegistry.setSocket(socket);
    socketRegistry.deleteSocket(id);
    expect(() => {
        socketRegistry.getSocket(id);
    }).toThrow(`Cannot get socket by id "${id}".`);
});
