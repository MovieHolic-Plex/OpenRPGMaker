import { PassThrough } from "node:stream";
import { gzipSync } from "node:zlib";
import type { IncomingMessage } from "node:http";
import { describe, expect, it } from "vitest";
import { BRIDGE_BODY_LIMIT, readBridgeRequestBody } from "../electron/serve/bridgeRequestBody";
import { OPRN_CHANNELS } from "../electron/shared/channels";

function request(channel: string, decodedBytes: number, declaredLength?: number): IncomingMessage {
  const payload = "x".repeat(decodedBytes);
  const body = gzipSync(JSON.stringify({ channel, payload: { blob: payload } }), { level: 1 });
  const stream = new PassThrough() as unknown as IncomingMessage & PassThrough;
  Object.assign(stream, { headers: { "x-oprn-channel": channel, "content-encoding": "gzip", "content-length": String(declaredLength ?? body.length) } });
  queueMicrotask(() => stream.end(body));
  return stream;
}

const overBridgeLimit = BRIDGE_BODY_LIMIT + 1024 * 1024;

describe("bridge request body limits", () => {
  it("accepts a map patch larger than the general 64MB decoded bound, like a full save", async () => {
    // A first save after load normalization carries nearly every tileset (2026-09-26: 96MB decoded).
    const envelope = await readBridgeRequestBody(request(OPRN_CHANNELS.projectSaveMapPatch, overBridgeLimit));
    expect(envelope.channel).toBe(OPRN_CHANNELS.projectSaveMapPatch);
    const full = await readBridgeRequestBody(request(OPRN_CHANNELS.projectSave, overBridgeLimit));
    expect(full.channel).toBe(OPRN_CHANNELS.projectSave);
  }, 60_000);

  it("lets project documents send more than 64MB of gzip", async () => {
    // 2026-09-28: a new project's first full save was 69MB gzip (187MB decoded) and got 413 on every retry.
    const overWire = BRIDGE_BODY_LIMIT + 1;
    for (const channel of [OPRN_CHANNELS.projectSave, OPRN_CHANNELS.projectSaveMapPatch, OPRN_CHANNELS.startCreateProject]) {
      expect((await readBridgeRequestBody(request(channel, 16, overWire))).channel).toBe(channel);
    }
    await expect(readBridgeRequestBody(request(OPRN_CHANNELS.teamStatus, 16, overWire))).rejects.toMatchObject({ statusCode: 413 });
  });

  it("keeps the 64MB decoded bound for other channels", async () => {
    await expect(readBridgeRequestBody(request(OPRN_CHANNELS.teamStatus, overBridgeLimit))).rejects.toMatchObject({ statusCode: 413 });
  }, 60_000);
});
