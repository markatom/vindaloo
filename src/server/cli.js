// @flow

import {collectScenarios} from './scenarioRegistry';
import {startServer} from './master';

const cli = async (): Promise<void> => {
    await collectScenarios();
    startServer();
};

cli().catch(console.error);
