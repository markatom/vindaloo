// @flow

import {createClassPatch, createFunctionPatch} from './serverPatch';
import expect from 'expect';
import http from 'http';
import https from 'https';

// $FlowFixMe
http.createServer = createFunctionPatch(http.createServer);
// $FlowFixMe
http.Server = createClassPatch(http.Server);

// $FlowFixMe
https.createServer = createFunctionPatch(https.createServer);
// $FlowFixMe
https.Server = createClassPatch(https.Server);

global.expect = expect;
