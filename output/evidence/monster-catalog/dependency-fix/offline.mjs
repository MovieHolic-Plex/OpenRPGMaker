// Validation isolation: no credential-file reads or non-loopback provider/DB traffic.
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import { basename } from "node:path";
import { syncBuiltinESMExports } from "node:module";
const readFileSync = fs.readFileSync;
fs.readFileSync = function(path, options) {
  if ((typeof path === "string" || path instanceof URL) && /^\.env(?:\.|$)/.test(basename(String(path)))) {
    return typeof options === "string" || options?.encoding ? "" : Buffer.alloc(0);
  }
  return readFileSync.call(this, path, options);
};
function requireLoopback(input) {
  const host = typeof input === "string" || input instanceof URL
    ? new URL(input).hostname : input.hostname ?? input.host ?? "localhost";
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(host)) {
    throw new Error("Dependency-fix validation blocks non-loopback network access");
  }
}
const fetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  requireLoopback(input instanceof Request ? input.url : input);
  return fetch(input, options);
};
for (const transport of [http, https]) {
  for (const method of ["request", "get"]) {
    const original = transport[method];
    transport[method] = function(input, ...args) {
      requireLoopback(input);
      return original.call(this, input, ...args);
    };
  }
}
syncBuiltinESMExports();
