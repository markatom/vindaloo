import * as authenticator from '../src/authenticator';
import {Client} from '../../../src/vindaloo';
import configuration from '../src/configuration';

// port binding
const client = new Client({
    bindingType: 'port',
    setupBinding: (port) => {
        configuration.api.port = port;
    },
});

// header binding
// const client = new Client({
//     bindingType: 'header',
//     setupBinding: (headerName, headerValue) => {
//         configuration.api.extraHeaders[headerName] = headerValue;
//     },
// });

describe('successful user authentication', () => {
    const test = client.createTest('login:successful');

    beforeAll(() => test.setup());
    it('returns authenticated user', async () => {
        const user = await authenticator.login('fry@planet-express.com', 'Leela');

        expect(user).toEqual({
            id: 42,
            name: 'Philip J. Fry',
        });
    });
    afterAll(() => test.teardown());
});

describe('failed user authentication', () => {
    const test = client.createTest('login:failed');

    beforeAll(() => test.setup());
    it('throws an error', async () => {
        const promise = authenticator.login('fry@planet-express.com', 'Leela');

        await expect(promise).rejects.toEqual(new Error('Invalid email or password.'));
    });
    afterAll(() => test.teardown());
});
