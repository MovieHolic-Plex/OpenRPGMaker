import { describe, expect, it } from "vitest";
import type { StorePackManifest } from "@/assetStore/format";
import { PublishError, edgeLookup, pinStoreEdge, publishProblems, requireTargetBase, targetBase, uploadWithRetry } from "../scripts/store/storePublish.mts";

describe("store publisher targets and pre-upload checks", () => {
  it("takes store addresses from the environment only and stays inert without them", () => {
    expect(targetBase("staging", {})).toBeNull();
    expect(targetBase("production", {})).toBeNull();
    expect(() => requireTargetBase("staging", {})).toThrow(PublishError);
    expect(targetBase("staging", { STORE_PUBLISH_STAGING_URL: "http://127.0.0.1:18320/" })).toBe("http://127.0.0.1:18320");
    expect(() => targetBase("production", { STORE_PUBLISH_PRODUCTION_URL: "http://store.example" })).toThrow("https");
  });

  it("refuses official packs whose title, ids or names carry third-party pack names", () => {
    const manifest: StorePackManifest = {
      schema: "oprn-store-pack/1", title: "Rasak town", summary: "", description: "", tags: ["refmap"], kind: "tileset", license: "OPRN-GAME", aiGenerated: false, credits: "",
      content: { assets: {}, tilesets: {} }, previews: [], blobs: [],
    };
    const problems = publishProblems(manifest);
    expect(problems).toContain("제목: 제3자 팩 이름 「rasak」");
    expect(problems).toContain("태그: 제3자 팩 이름 「refmap」");
  });
});

describe("store publisher upload retry and edge pin", () => {
  const reply = (status: number) => ({ status, ok: status >= 200 && status < 300, text: async () => "" });

  it("resends the same blob once after a 408 or a timeout, and names the blob when it still fails", async () => {
    const lines: string[] = [];
    let calls = 0;
    await uploadWithRetry(async () => reply(++calls === 1 ? 408 : 200), "[blob 809d6849 23185818B]", { log: (line) => lines.push(line) });
    expect(calls).toBe(2);
    expect(lines.some((line) => line.includes("attempt 1 FAILED status=408"))).toBe(true);
    expect(lines.some((line) => line.includes("attempt 2 ok 200"))).toBe(true);

    calls = 0;
    await expect(uploadWithRetry(async () => { calls += 1; throw new DOMException("aborted", "TimeoutError"); }, "[blob 809d6849 23185818B]", { log: () => {} }))
      .rejects.toThrow("[blob 809d6849 23185818B]");
    expect(calls).toBe(2);
  });

  it("does not resend a rejected blob (4xx) and honours a single-attempt setting", async () => {
    let calls = 0;
    await expect(uploadWithRetry(async () => { calls += 1; return reply(403); }, "[blob aaaaaaaa 1B]", { log: () => {} })).rejects.toBeInstanceOf(PublishError);
    expect(calls).toBe(1);
    calls = 0;
    await expect(uploadWithRetry(async () => { calls += 1; return reply(500); }, "[blob bbbbbbbb 1B]", { maxAttempts: 1, log: () => {} })).rejects.toBeInstanceOf(PublishError);
    expect(calls).toBe(1);
  });

  it("gives every request an abort signal that fires at the configured timeout", async () => {
    let signal: AbortSignal | undefined;
    await uploadWithRetry(async (given) => { signal = given; return reply(200); }, "[blob cccccccc 1B]", { timeoutMs: 5, log: () => {} });
    expect(signal).toBeDefined();
    await new Promise<void>((resolve) => signal!.addEventListener("abort", () => resolve(), { once: true }));
    expect(signal!.aborted).toBe(true);
  });

  it("pins only the store hostname to the edge address and leaves other hosts to normal DNS", () => {
    const fallback: string[] = [];
    const lookup = edgeLookup("store.example", "104.18.2.1", (name) => { fallback.push(name); });
    const answers: unknown[][] = [];
    lookup("store.example", undefined, (...args) => answers.push(args));
    lookup("store.example", { all: true }, (...args) => answers.push(args));
    lookup("play.example", undefined, () => {});
    expect(answers[0]).toEqual([null, "104.18.2.1", 4]);
    expect(answers[1]).toEqual([null, [{ address: "104.18.2.1", family: 4 }]]);
    expect(fallback).toEqual(["play.example"]);
  });

  it("is off unless STORE_EDGE_IP is set", () => {
    expect(pinStoreEdge({})).toBeNull();
    expect(pinStoreEdge({ STORE_EDGE_IP: "  " })).toBeNull();
  });
});
