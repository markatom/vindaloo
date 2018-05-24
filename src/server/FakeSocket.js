// @flow

import {Duplex} from 'stream';
import type {Server} from 'http';

export default class FakeSocket extends Duplex {
    server: ?Server;
    _buffer: (?string)[];
    _pushImmediately: boolean;

    constructor(): void {
        super();

        this.server = null; // must be set to null, see https://github.com/nodejs/node/blob/v9.x/lib/_http_server.js#L301
        this._buffer = [];
        this._pushImmediately = false;
    }

    send(chunk: ?string): void {
        if (this._pushImmediately) {
            this._pushImmediately = this.push(chunk, 'binary');

        } else {
            this._buffer.push(chunk);
        }
    }

    _write(chunk: Buffer | string, encoding: string, callback: () => void): boolean {
        // $FlowFixMe Cannot call Buffer.from because string is incompatible with ArrayBuffer.
        const buffer = chunk instanceof Buffer ? chunk : Buffer.from(chunk, encoding);

        this.emit('receive', buffer.toString('binary'));

        callback();

        return true;
    }

    _final(callback: () => void): void {
        this.emit('receive', null);

        callback();
    }

    _read(): void {
        while (this._buffer.length > 0) {
            const pushMore = this.push(this._buffer.shift(), 'binary');
            if (!pushMore) {
                this._pushImmediately = false;
                return;
            }
        }

        this._pushImmediately = true;
    }

    setTimeout(timeout: number, callback?: () => void): void {
        if (callback != null) {
            throw new Error('Callback argument not supported.');
        }

        this.emit('setTimeout', timeout);
    }

    setNoDelay(noDelay?: boolean): void {
        this.emit('setNoDelay', noDelay);
    }
}
