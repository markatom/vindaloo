// @flow

import fs from 'fs';
import {getConfiguration} from './configuration';
import path from 'path';
import {promisify} from 'util';

const ensureDirectory = async (): Promise<void> => {
    let prefix = '';
    for (const entry of getConfiguration().logDirectory.split(path.sep)) {
        if (entry.length === 0) {
            continue;
        }

        prefix = path.join(prefix, entry);

        try {
            await promisify(fs.mkdir)(path.join(getConfiguration().rootDirectory, prefix));

        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }
};

const getPath = (testId: string): string => {
    const dateTime = new Date()
        .toISOString()
        .substr(0, 'yyyy-mm-ddThh:mm:ss'.length)
        .replace('T', '_')
        .replace(/:/g, '-');

    return `${getConfiguration().logDirectory}/${dateTime}_${testId}.log`;
};

export {
    getPath,
    ensureDirectory,
};
