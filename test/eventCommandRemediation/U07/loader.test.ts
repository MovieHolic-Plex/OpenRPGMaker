import { afterAll, beforeAll, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { firefox } from "@playwright/test";
import { PNG } from "pngjs";
import { startPlayerQaServer, runRuntimeQa } from "../../../scripts/lib/runtimeQaRun.mjs";
import { installPlayerObservation } from "./playerObservation.mjs";
import { editorFixture, insertAsset, HERO } from "./editorFixture";
import { asset, command } from "../U07.fixture";

type LoaderState = {
  readonly loads: readonly { readonly key: string; readonly url: string }[];
  readonly textureExists: boolean;
  readonly pixel: readonly number[];
  readonly frames: readonly { readonly id: number; readonly x?: number; readonly y?: number; readonly width?: number; readonly height?: number; readonly missing?: boolean }[];
};
let observed: LoaderState;
let resourceUrl: string;
let repeated: { readonly sameTexture: boolean; readonly sameFrame: boolean };
let owned: string;
const previousCache = process.env.VITE_CACHE_DIR;

beforeAll(async () => {
  // Given: a real RGBA upload and real Phaser scene, not a fake texture/loader.
  owned = await mkdtemp(resolve(".omo/evidence/event-command-remediation/U07/tmp-loader-"));
  process.env.VITE_CACHE_DIR = join(owned, "cache");
  const project = editorFixture(); const map = project.maps[project.startMapId]; const event = map?.events[0];
  if (!event?.pages?.[0]) throw new Error("Missing loader fixture host");
  const image = new PNG({ width: 288, height: 256 });
  for (let i = 0; i < image.data.length; i += 4) { image.data[i] = 255; image.data[i + 3] = 128; }
  resourceUrl = `data:image/png;base64,${PNG.sync.write(image).toString("base64")}`;
  const resource = { ...asset("charset", "new"), dataUrl: resourceUrl }; insertAsset(project, resource);
  // Wrong-kind uploads are referenced too, but must never enter this charset loader path.
  const wrong = { ...asset("faceset", "new"), id: "u07-loader-wrong-kind" }; insertAsset(project, wrong);
  project.assets.uploaded["u07-loader-unreferenced"] = { ...resource, id: "u07-loader-unreferenced" };
  insertAsset(project, { ...resource, id: "tex_easyrpg_charset_actor1" });
  const commands = [command(24, { target: HERO, value: resource.id }), { kind: "text", body: "LOADED" } as const];
  event.y = 4; event.commands = commands; event.pages[0].commands = commands;
  const fixture = join(owned, "project.json"); await writeFile(fixture, JSON.stringify(project));
  const server = await startPlayerQaServer(); const browser = await firefox.launch({ headless: true });
  try {
    const page = await browser.newPage(); page.setDefaultTimeout(15_000); page.setDefaultNavigationTimeout(120_000);
    await page.addInitScript(installPlayerObservation);
    // When: actual preload, registration and selected-actor refresh execute through player.html.
    const report = await runRuntimeQa(page, { id: "u07-loader", projectFixture: fixture, viewport: { width: 1024, height: 768 }, beats: [
      { id: "boot", ops: [{ kind: "eventCommand", trigger: { kind: "key", key: "Enter" }, timeoutMs: 120_000, observe: [{ source: "state", path: ["player"], equals: { x: 2, y: 3 } }] }] },
      { id: "load", ops: [{ kind: "eventCommand", trigger: { kind: "key", key: "z" }, timeoutMs: 15_000, observe: [{ source: "dom", selector: '[data-testid="dialogue-box"].page-ready', read: "present", equals: true }] }] },
    ] }, { serverUrl: server.url, outDir: join(owned, "run") });
    expect(report.errors).toEqual([]); expect(report.beats.flatMap(beat => beat.failures)).toEqual([]);
    observed = await page.evaluate<LoaderState>("window.__u07ReadPlayer()");
    repeated = await page.evaluate<typeof repeated>(`(async () => {
      const { registerBundledFrames } = await import('/src/assets/bundled.ts');
      const { store } = await import('/src/project/store.ts');
      return window.__u07RegisterAgain(registerBundledFrames, store.getCurrent());
    })()`);
  } finally { await browser.close(); await server.close(); }
}, 180_000);
afterAll(async () => {
  if (previousCache === undefined) delete process.env.VITE_CACHE_DIR; else process.env.VITE_CACHE_DIR = previousCache;
  if (owned) await rm(owned, { recursive: true, force: true });
});

it("queues the canonical upload URL when a charset is referenced", () => {
  // Then
  expect(observed.loads.filter(load => load.key === "u07-charset-new")).toEqual([{ key: "u07-charset-new", url: resourceUrl }]);
});
it("registers canonical idle and walk cells when the uploaded charset is loaded", () => {
  // Then
  expect(observed.textureExists).toBe(true);
  expect(observed.frames).toEqual([24, 25, 26].map((id, column) => ({ id, x: column * 24, y: 64, width: 24, height: 32 })));
});
it("preserves upload alpha when the source pixel is translucent", () => {
  // Then
  expect(observed.pixel).toEqual([255, 0, 0, 128]);
});
it("leaves non-charset uploads outside the charset preload path", () => {
  // Then
  expect(observed.loads.some(load => load.key === "u07-loader-wrong-kind")).toBe(false);
});
it("leaves an unreferenced upload out of preload", () => {
  // Given / When: shared actual-loader fixture above; Then
  expect(observed.loads.some(load => load.key === "u07-loader-unreferenced")).toBe(false);
});
it("preserves bundled raw color-key ownership when an upload collides with its texture alias", () => {
  // Given / When: shared actual-loader fixture above; Then
  expect(observed.loads.some(load => load.key === "tex_easyrpg_charset_actor1")).toBe(false);
  expect(observed.loads.some(load => load.key === "tex_easyrpg_charset_actor1__raw")).toBe(true);
});
it("preserves texture and frame identity when frame registration repeats", () => {
  // Given / When: registerBundledFrames ran a second time on the same real scene; Then
  expect(repeated).toEqual({ sameTexture: true, sameFrame: true });
});
