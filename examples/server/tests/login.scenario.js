const app = require('../src/app');
const authenticator = require('../src/authenticator');

scenario('login:successful', () => {
    setup(() => {
        jest.spyOn(authenticator, 'login').mockImplementation(() => ({
            id: 42,
            name: 'Philip J. Fry',
        }));

        app.start();
    });

    teardown(() => {
        jest.restoreAllMocks();
    });
});

scenario('login:failed', () => {
    setup(() => {
        jest.spyOn(authenticator, 'login').mockImplementation(() => {
            throw new Error('Invalid password.');
        });

        app.start();
    });

    teardown(() => {
        jest.restoreAllMocks();
    });
});
