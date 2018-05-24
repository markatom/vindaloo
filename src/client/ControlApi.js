// @flow

import * as popsicle from 'popsicle';
import type {CompleteConfiguration} from './Client';

type SetupResponse = {
    test: {
        binding: {
            port: number,
        } | {
            header: {
                name: string,
                value: string,
            },
        },
        timeout: number,
    },
};

const request = popsicle.defaults({
    use: [
        popsicle.plugins.stringify(),
        popsicle.plugins.parse('json'),
        popsicle.plugins.headers(),
    ],
});

/**
 * @ignore
 */
export class ApiError extends Error {
    type: string;

    constructor(type: string, message: string): void {
        super(message);
        this.type = type;
    }
}

/**
 * @ignore
 */
export default class ControlApi {
    configuration: CompleteConfiguration;

    constructor(configuration: CompleteConfiguration): void {
        this.configuration = configuration;
    }

    async setup(testId: string, scenario: string): Promise<SetupResponse> {
        return await this._request('/setup', {
            version: 1,
            test: {
                id: testId,
                scenario: {
                    name: scenario,
                },
                binding: {
                    type: this.configuration.bindingType,
                },
            },
        });
    }

    async step(testId: string): Promise<void> {
        await this._request('/step', {
            version: 1,
            test: {
                id: testId,
            },
        });
    }

    async teardown(testId: string): Promise<void> {
        await this._request('/teardown', {
            version: 1,
            test: {
                id: testId,
            },
        });
    }

    async _request(endpoint: string, data: {}): Promise<{}> {
        const response = await request({
            method: 'POST',
            url: `http://${this.configuration.host}:${this.configuration.port}${this.configuration.endpointsPrefix}${endpoint}`,
            headers: {
                'Content-Type': 'application/json',
            },
            body: data,
        });

        if (response.status >= 200 && response.status < 300) {
            return response.body;
        }

        if (response.body.type != null && response.body.message != null) {
            throw new ApiError(response.body.type, response.body.message);
        }

        throw new Error('Unexpected control API error.');
    }
}
