import assert from "node:assert/strict";
import test from "node:test";
import {
  createMcpStdioDecoder,
  encodeMcpStdioMessage,
} from "../scripts/lib/mcpStdioFraming.mjs";

const INITIALIZE = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2024-11-05" },
};

test("decodes newline-delimited MCP messages and replies with the same framing", () => {
  const messages = [];
  const decoder = createMcpStdioDecoder((message) => messages.push(message));

  decoder.push(Buffer.from(`${JSON.stringify(INITIALIZE)}\n`, "utf8"));

  assert.deepEqual(messages, [INITIALIZE]);
  assert.equal(decoder.framing(), "newline");
  assert.equal(
    encodeMcpStdioMessage({ jsonrpc: "2.0", id: 1, result: {} }, decoder.framing()),
    '{"jsonrpc":"2.0","id":1,"result":{}}\n',
  );
});

test("keeps Content-Length compatibility and handles split frames", () => {
  const messages = [];
  const decoder = createMcpStdioDecoder((message) => messages.push(message));
  const body = JSON.stringify(INITIALIZE);
  const frame = Buffer.from(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`, "utf8");

  decoder.push(frame.subarray(0, 17));
  decoder.push(frame.subarray(17));

  assert.deepEqual(messages, [INITIALIZE]);
  assert.equal(decoder.framing(), "content-length");
  assert.match(
    encodeMcpStdioMessage({ jsonrpc: "2.0", id: 1, result: {} }, decoder.framing()),
    /^Content-Length: \d+\r\n\r\n/,
  );
});
