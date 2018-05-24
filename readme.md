# Vindaloo 🌶️

* Painless integration testing for your client-server applications.
* Test both client and server implementation together in direct communication.
* Organize your integration tests in form of scenarios.

## Getting Started

Install Vindaloo using `yarn`:

```bash
yarn add --dev vindaloo
```

Or npm, if you wish:

```bash
npm install --save-dev vindaloo
```

Please note that the minimum supported Node version is `8.0.0`.

Let's say you have client implementation `authenticator.js` allowing users to log in:

```javascript
import configuration from './configuration';

const login = async (email, password) => {
    const response = await fetch(`http://${configuration.api.host}:${configuration.api.port}/login`, {
        method: 'POST',
        headers: Object.assign({'Content-Type': 'application/json'}, configuration.api.extraHeaders),
        body: JSON.stringify({email, password}),
    });

    if (response.status === 401) { // unauthorized
        throw new Error('Invalid email or password.');
    }

    return await response.json();
};

export {
    login,
};
```

And corresponding server implementation using Koa.js framework set up in `app.js`:

```javascript
const authenticator = require('./authenticator');
const bodyParser = require('koa-bodyparser');
const Koa = require('koa');
const route = require('koa-route');

const start = () => {
    const app = new Koa();

    app.use(bodyParser());
    app.use(route.post('/login', (ctx) => {
        try {
            ctx.response.body = authenticator.login(ctx.request.body.email, ctx.request.body.password);

        } catch (error) {
            ctx.response.status = 401; // unauthorized
        }
    }));

    app.listen(12345);
};

module.exports = {
    start,
};
```

Ignore the actual authenticator implementation on server side for now.
We want to test client-server integration.
How would we do that? Let's use Vindaloo, it's super easy!

We want to test two scenarios – when the user successfully logs in and when the user supplies invalid credentials.
Let's write those scenarios down on server side:

```javascript
const app = require('../../src/server/app');
const authenticator = require('../../src/server/authenticator');

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
```

Note that this code is using global `jest`. If you don't know [Jest](https://facebook.github.io/jest/), take a look, it's a great testing framework.
Vindaloo uses some components from Jest so if you're familiar with it, you already know how to assert and mock using Vindaloo.
Here, we're using Jest to mock implementation of `login` function from `authenticator` module.
It's implementation is replaced in these scenarios because we don't want to include it in integration tests.
It's better to write some unit tests to test its implementation separately.
The key thing here is `app.start()` which starts Koa application and listens for incoming requests.
Now, to be able to execute defined scenarios, run the following:

```bash
yarn vindaloo
``` 

This will start server listening on port 3000 allowing you to run the previous scenarios and test against them.

Let's write login tests on client side using Jest framework:

```javascript
import * as authenticator from '../../src/client/authenticator';
import Client from '../../../src/client/Client';
import configuration from '../../src/client/configuration';

const client = new Client({
    bindingType: 'header',
    setupBinding: (headerName, headerValue) => {
        configuration.api.extraHeaders[headerName] = headerValue;
    },
});

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
```

This code will run two tests, each using previously written scenarios on your server, and test client implementation against them!
This way you can write integration tests as easily as unit tests. Isn't that great?

## How It Works

Vindaloo consists of two parts – client and server. These parts use unified HTTP API to communicate with each other.
Currently, there is only JavaScript implementation of Vindaloo but the goal is to port this implementation to other programming languages as well.

Integration test is always initialized by client.
Server offers predefined set of integration scenarios, which can be executed by the client.
Vindaloo's server is responsible for spawning and managing child processes that contain tested server implementation controlled by the scenario code. 
Tested client implementation is bound to server's child process using mechanism described below.

Every scenario is composed of three phases: setup, step and teardown.
All these phases have corresponding code on server side.
Setup phase is mandatory and is used to initialize server implementation and put it into desired state.
It can be used for example to set up mocks.
Step phases are optional and the scenario can define any number of them.
These steps are useful in situations in which server side behavior must be altered during test.
They can be also used for intermediate assertions before the test ends.
Teardown phase is optional and should be used to close all server connections and deallocate any resources used during the test.
This phase can be used for assertions too.
The execution of this phase leads to the termination of child process containing the tested server implementation.

Even though server side assertions are a powerful thing, they shouldn't be overused because debugging of the integration test could be tedious.
As little server side code as possible should be tested under integration.
Smaller tests are easier to maintain and debug.

## Binding

Vindaloo provides two ways of binding client and server implementation during a test.
The first, preferred way, is an allocation of unique port for each test.
Requests and responses between client and server are isolated using this port.

The second, alternative way, is the use of a unique value in special header.
In this type of binding the Vindaloo's server and the tested server implementation share the same port.
Vindaloo's server routes requests to corresponding server implementation using the value in its binding header.

In order to establish connection between client and server, patched implementations of Node's `http.Server` and `https.Server` are injected into the server's test environment.
This patch alters behavior of `listen` method so it won't listen on given port and host but will receive connections from bound client based on chosen binding type.

On client side it's necessary to pass allocated port or header value to implementation under test.
You can supply callback function to client's `setupBinding` parameter for this purpose.
This function gets called every time setup `phase` is invoked and receives binding port or name and value of binding header.
The function can for example update global configuration according to received values.

## Client Interface

The Vindaloo client is a JavaScript library which controls integration tests.
Its API docs are available in `docs` directory.

## Server Interface

The Vindaloo server is standalone CLI application.
It includes web server exposing API which allows the management of server side tests.
It scans configured directories for scenario definitions on its startup.
These scenarios can be used by client implementation to perform integration tests.
Scenario definitions are ordinary Node.js modules with the following six globals.

### `scenario(scenarioName: string, scenarioDefinition: () => void) => void`

This function defines scenario and its name.
Scenario function should only be used in the root of the module.
Multiple scenarios can be defined within one module.
Scenario definition should be synchronous and shouldn't cause any side effects like opening external connections.

### `setup(setupDefinition: () => void | Promise<void>) => void`

This function defines setup phase of a scenario.
Setup function should only be used within the scenario definition.
Every scenario must contain exactly one setup definition.
Setup definition can be asynchronous. In that case, promise should be returned.

### `step(stepDefinition: () => void | Promise<void>) => void`

This function defines step phase of a scenario.
Step function should only be used within the scenario definition.
Every scenario can contain zero or more step definitions.
Step definition can be asynchronous. In that case, promise should be returned.

### `teardown(stepDefinition: () => void | Promise<void>) => void`

This function defines teardown phase of a scenario.
Teardown function should only be used within the scenario definition.
Every scenario can contain zero or one teardown definitions.
Step definition can be asynchronous. In this case, promise should be returned.

### `expect`

This object is used for assertions during a test.
It gives you access to a number of matchers that let you validate all kinds of values.
It's provided by the Jest framework, for more information see [expect documentation](https://facebook.github.io/jest/docs/en/expect.html).

### `jest`

Methods in this object help you create mocks.
It's provided by the Jest framework, for more information see it's [jest documentation](https://facebook.github.io/jest/docs/en/jest-object.html). 

## Configuration

Client is configured via constructor. All parameters are optional.

| Parameter | Type | Default value | Description |
|-|-|-|-|
| `host` | string | `'127.0.0.1'` | The host of the server. |
| `port` | number | `3000` | The port where the server is run on. |
| `endpointsPrefix` | string | `'/vindaloo'` | Prefix of control endpoints exposed by Vindaloo. |
| `bindingType` | string | `'port'` | Chosen type of binding. |
| `setupBinding` | function | *empty* | Function used for binding setup in client implementation before each test. |

Server is configured using `vindaloo` section in project's `package.json` file. All parameters as optional.

| Parameter | Type | Default value | Description |
|-|-|-|-|
| `host` | string | `'127.0.0.1'` | The host to run the server. |
| `port` | number | `3000` | The port to run the server. |
| `endpointsPrefix` | string | `'/vindaloo'` | Prefix of control endpoints exposed by server. |
| `scenarioDirectories` | string[] | `['tests']` | Array of directories where the server should look for scenario definitions. |
| `scenarioRegex` | string | `.*(\.\|/)scenario\.js$` | Regular expression of file names where scenarios are defined. |
| `logDirectory` | string | `'logs/vindaloo'` | Directory where server logs are stored. |
| `allowedBindingTypes` | string[] | `['port', 'header']` | Array of binding types allowed to use by client. | 
| `bindingHeaderName` | string | `'X-Test-Id'` | Header name used for header type binding. |
| `testConcurrencyLimit` | number | `8` | Maximum number of concurrently running tests. |
| `testDurationTimeout` | number | `60` | Maximum duration of one test in seconds. |

## Logging

Standard and standard error outputs of each server side test run are stored in log file.
These files are located inside the directory specified in the configuration.
Each file name consists of date, time and a test identifier in the following form:

```
2018-05-20_10-19-41_f907401e-f6fa-42ce-9e12-aa0b4e6bd5d5.log
```

General information about currently running tests including debug information are available on the standard output of Vindaloo server.

## Examples

To run examples, install Vindaloo's dependencies and build it from sources:

```bash
yarn
yarn build
``` 

Then start Vindaloo server in `examples/server` directory:

```bash
yarn vindaloo
```

While the server is running, execute client's tests within `examples/client` directory, don't forget to install dependencies:

```bash
yarn
yarn test
```

You should see two passed client tests and debug information on Vindaloo server's standard output.

## License

Vindaloo is available under [MIT license](./license).
