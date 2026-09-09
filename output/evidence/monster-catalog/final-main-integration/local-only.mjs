// Validation-only boundary: permit fixture HTTP servers, reject external network.
import http from 'node:http';
import https from 'node:https';
import { syncBuiltinESMExports } from 'node:module';
function check(input) {
  const hostname = typeof input === 'string' || input instanceof URL
    ? new URL(input).hostname : (input.hostname ?? input.host ?? 'localhost');
  if (!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(hostname)) {
    throw new Error(`st_01a0793a: external network prohibited (${hostname})`);
  }
}
const fetch = globalThis.fetch;
globalThis.fetch = function(input, init) {
  check(input instanceof Request ? input.url : input);
  return fetch.call(this, input, init);
};
for (const mod of [http, https]) {
  for (const name of ['request', 'get']) {
    const original = mod[name];
    mod[name] = function(input, ...args) { check(input); return original.call(this, input, ...args); };
  }
}
syncBuiltinESMExports();
