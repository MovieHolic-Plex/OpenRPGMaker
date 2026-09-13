import { EventEmitter, once } from "node:events";
import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer, resolveConfig, type ViteDevServer } from "vite";
import { devPlayerBundlesPlugin } from "../scripts/lib/devPlayerBundles";
import { retainRuntime, RUNTIME_ARCHIVE_FOLDER } from "../scripts/lib/runtimeArchive";
import { PLAYER_SOURCE_INPUT_INVENTORY, writePlayerArtifactManifest } from "../scripts/lib/playerArtifactContract.mjs";
import { PLAYER_RUNTIME_ASSET_PATHS, writePlayerDeploymentManifest } from "../scripts/lib/playerDeploymentManifest.mjs";
import { createPipelineFixture } from "./playerArtifactPipeline.fixture.mjs";
import { writeReleaseCollector } from "../scripts/lib/releaseCollectorBuild.mjs";

const { builder } = vi.hoisted(() => ({ builder: vi.fn() }));
vi.mock("node:child_process", async importOriginal => ({
  ...await importOriginal<typeof import("node:child_process")>(), spawn: builder,
}));
afterEach(() => { vi.restoreAllMocks(); builder.mockReset(); });

async function fixture() {
  const source = await createPipelineFixture();
  for (const input of PLAYER_SOURCE_INPUT_INVENTORY) {
    const name = input.kind === "directory" ? join(input.path, "fixture-source.txt") : input.path;
    await mkdir(dirname(join(source.repoRoot, name)), { recursive: true });
    await writeFile(join(source.repoRoot, name), name.endsWith(".json") ? "{}" : "fixture source");
  }
  await writeFile(join(source.repoRoot, "editor.html"), "<head></head>");
  for (const path of PLAYER_RUNTIME_ASSET_PATHS) {
    await mkdir(dirname(join(source.runtimeAssetRoot, path)), { recursive: true });
    await writeFile(join(source.runtimeAssetRoot, path), "retained runtime asset");
  }
  await writeFile(join(source.runtimeAssetRoot, "outside-source-inventory.html"), "retained public data");
  const standaloneRoot = join(source.repoRoot, "dist/standalone-player");
  await mkdir(standaloneRoot, { recursive: true });
  await writeFile(join(standaloneRoot, "standalone.js"), "trusted standalone");
  await writeFile(join(standaloneRoot, "standalone.css"), "body{}");
  await writeFile(join(source.repoRoot, "src/project/releaseDependencyCollector.ts"), "export function collectReleaseDependencies(){return []}");
  await writeReleaseCollector(source.repoRoot, source.artifactRoot);
  await writeReleaseCollector(source.repoRoot, standaloneRoot);
  await writePlayerDeploymentManifest({ artifactRoot: source.artifactRoot, repoRoot: source.repoRoot });
  await writePlayerArtifactManifest({ artifactRoot: standaloneRoot, repoRoot: source.repoRoot });
  const archiveRoot = join(source.repoRoot, RUNTIME_ARCHIVE_FOLDER);
  const runtime = await retainRuntime({ repoRoot: source.repoRoot, archiveRoot, webRoot: source.artifactRoot, standaloneRoot, publicRoot: source.runtimeAssetRoot });
  builder.mockImplementation(() => {
    const child = new EventEmitter();
    queueMicrotask(() => child.emit("error", new Error("fixture builder unavailable")));
    return child;
  });
  return { ...source, archiveRoot, runtime };
}

async function serve(root: string) {
  let ready: Promise<unknown> = Promise.resolve();
  const server = await createServer({ configFile: false, root, cacheDir: join(root, ".cache"), logLevel: "silent",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { port: 0, strictPort: true, watch: { ignoreInitial: false, ignored: ["**/existing-ignore/**"] } },
    plugins: [{ name: "watch-ready-signal", configureServer(server) {
      if (!Reflect.get(server.watcher, "_readyEmitted")) ready = once(server.watcher, "ready", { signal: AbortSignal.timeout(10000) });
    } }, devPlayerBundlesPlugin()],
  });
  await ready;
  await server.listen(0);

  const address = server.httpServer?.address();
  if (!address || typeof address === "string") throw new Error("Expected isolated TCP listener");
  return { server, url: `http://127.0.0.1:${address.port}` };
}

async function changeFile(server: ViteDevServer, file: string, bytes: string) {
  // Multiple initial watch roots can report ready before a nested file has
  // registered. Await that exact registration, never a delay after ready.
  if (!server.watcher.getWatched()[dirname(file)]?.includes(basename(file))) {
    await new Promise<void>((done, fail) => {
      const added = (path: string) => { if (path === file) { clearTimeout(deadline); server.watcher.off("add", added); done(); } };
      const deadline = setTimeout(() => { server.watcher.off("add", added); fail(new Error("File watch registration deadline")); }, 10000);
      server.watcher.on("add", added);
    });
  }
  const observed = new Promise<void>((done, fail) => {
    const changed = (path: string) => { if (path === file) { clearTimeout(deadline); server.watcher.off("change", changed); done(); } };
    const deadline = setTimeout(() => { server.watcher.off("change", changed); fail(new Error("File change deadline")); }, 10000);
    server.watcher.on("change", changed);
  });
  await writeFile(file, bytes);
  await observed;
}

describe("publication default on the real Vite server", () => {
  it("reuses a fully verified retained default without invoking either builder", async () => {
    const f = await fixture();
    const { server, url } = await serve(f.repoRoot);
    try {
      const before = await stat(join(f.archiveRoot, "default.json"));
      const response = await fetch(`${url}/runtime-archive/default.json`, { signal: AbortSignal.timeout(15000) });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ runtimeTarget: f.runtime.runtimeTarget });
      expect(builder).not.toHaveBeenCalled();
      expect((await stat(join(f.archiveRoot, "default.json"))).ino).toBe(before.ino);
    } finally { await server.close(); await rm(f.root, { recursive: true, force: true }); }
  });

  it.each(["source", "public"])("rebuilds instead of reusing a default after current %s changes", async kind => {
    const f = await fixture();
    const { server, url } = await serve(f.repoRoot);
    try {
      const file = kind === "source" ? join(f.repoRoot, "src/player/fixture-source.txt") : join(f.runtimeAssetRoot, "outside-source-inventory.html");
      expect((await fetch(`${url}/runtime-archive/default.json`, { signal: AbortSignal.timeout(15000) })).status).toBe(200);
      await writeFile(file, "changed current input");
      const before = await readFile(join(f.archiveRoot, "default.json"), "utf8");
      const pinned = await fetch(`${url}/runtime-archive/${f.runtime.runtimeTarget}/web/player.html`, { signal: AbortSignal.timeout(15000) });
      expect(pinned.status).toBe(200);
      expect(builder).not.toHaveBeenCalled();
      const response = await fetch(`${url}/runtime-archive/default.json`, { signal: AbortSignal.timeout(15000) });
      expect(response.status).toBe(500);
      expect(builder).toHaveBeenCalledTimes(1);
      expect(await readFile(join(f.archiveRoot, "default.json"), "utf8")).toBe(before);
    } finally { await server.close(); await rm(f.root, { recursive: true, force: true }); }
  });

  it("retains a newly verified default after a successful source-triggered rebuild", async () => {
    const f = await fixture();
    const { server, url } = await serve(f.repoRoot);
    try {
      expect((await fetch(`${url}/runtime-archive/default.json`, { signal: AbortSignal.timeout(15000) })).status).toBe(200);
      await changeFile(server, join(f.repoRoot, "src/player/fixture-source.txt"), "updated engine source");
      builder.mockImplementation((_command: string, args: string[]) => {
        const child = new EventEmitter();
        const output = args[args.indexOf("--outDir") + 1];
        if (!output) throw new Error("Missing builder output path");
        const web = args.includes("vite.player.config.ts");
        void (async () => {
          await cp(web ? f.artifactRoot : join(f.repoRoot, "dist/standalone-player"), output, { recursive: true });
          await writeFile(join(output, web ? "player.js" : "standalone.js"), "updated executable");
          if (!web) await writePlayerArtifactManifest({ artifactRoot: output, repoRoot: f.repoRoot });
        })().then(() => child.emit("close", 0), error => child.emit("error", error));
        return child;
      });
      const response = await fetch(`${url}/runtime-archive/default.json`, { signal: AbortSignal.timeout(15000) });
      expect(response.status).toBe(200);
      const pointer = await response.json();
      expect(pointer.runtimeTarget).not.toBe(f.runtime.runtimeTarget);
      expect(builder).toHaveBeenCalledTimes(2);
      expect(await readFile(join(f.archiveRoot, pointer.runtimeTarget, "web/player.js"), "utf8")).toBe("updated executable");
      expect(await readFile(join(f.archiveRoot, f.runtime.runtimeTarget, "web/player.js"), "utf8")).not.toBe("updated executable");
    } finally { await server.close(); await rm(f.root, { recursive: true, force: true }); }
  });

  it("excludes retained and staging HTML from Vite's watcher while ordinary HTML still reloads", async () => {
    const f = await fixture();
    const stage = join(f.archiveRoot, ".stage-fixture/web/player.html");
    await mkdir(dirname(stage), { recursive: true }); await writeFile(stage, "<head>stage</head>");
    const { server } = await serve(f.repoRoot);
    try {
      const archived = join(f.archiveRoot, f.runtime.runtimeTarget, "web/player.html");
      // Exercise the real watcher's exclusion predicate, not our revision
      // counter or an absence-by-delay assertion. Writes can never enter HMR.
      const isIgnored: unknown = Reflect.get(server.watcher, "_isIgnored");
      if (typeof isIgnored !== "function") throw new Error("Vite watcher exclusion boundary unavailable");
      for (const path of [f.archiveRoot, archived, stage, join(f.archiveRoot, ".stage-fixture/public/example.html")]) {
        expect(Reflect.apply(isIgnored, server.watcher, [path])).toBe(true);
      }
      expect(Reflect.apply(isIgnored, server.watcher, [join(f.repoRoot, "existing-ignore/keep.html")])).toBe(true);
      expect(Reflect.apply(isIgnored, server.watcher, [join(f.repoRoot, "editor.html")])).toBe(false);
      const packets: unknown[] = [];
      const reload = new Promise<void>((done, fail) => {
        const deadline = setTimeout(() => fail(new Error("HTML reload deadline")), 10000);
        vi.spyOn(server.ws, "send").mockImplementation((payload: unknown) => {
          packets.push(payload);
          if (typeof payload === "object" && payload !== null && "type" in payload && payload.type === "full-reload"
            && "path" in payload && payload.path === "/editor.html") { clearTimeout(deadline); done(); }
        });
      });
      await writeFile(stage, "<head>changed stage</head>");
      await writeFile(archived, "<head>changed archive</head>");
      await changeFile(server, join(f.repoRoot, "editor.html"), "<head>changed editor</head>");
      await reload;
      expect(packets).toContainEqual({ type: "full-reload", path: "/editor.html" });
      expect(JSON.stringify(packets)).not.toContain(RUNTIME_ARCHIVE_FOLDER);
    } finally { await server.close(); await rm(f.root, { recursive: true, force: true }); }
  });

  it.each(["pointer", "manifest", "web", "standalone", "asset", "extra"])("rechecks ignored %s changes rather than trusting a cached default", async kind => {
    const f = await fixture();
    const { server, url } = await serve(f.repoRoot);
    try {
      expect((await fetch(`${url}/runtime-archive/default.json`, { signal: AbortSignal.timeout(15000) })).status).toBe(200);
      const target = join(f.archiveRoot, f.runtime.runtimeTarget);
      const paths: Record<string, string> = { pointer: join(f.archiveRoot, "default.json"), manifest: join(target, "runtime.json"),
        web: join(target, "web/player.js"), standalone: join(target, "standalone/standalone.js"),
        asset: join(target, "public/assets/runtime.png"), extra: join(target, "extra.txt") };
      await writeFile(paths[kind], kind === "pointer" ? JSON.stringify({ runtimeTarget: "f".repeat(64) }) : "tampered");
      expect((await fetch(`${url}/runtime-archive/default.json`, { signal: AbortSignal.timeout(15000) })).status).toBe(500);
      expect(builder).toHaveBeenCalledTimes(1);
    } finally { await server.close(); await rm(f.root, { recursive: true, force: true }); }
  });

  it("preserves an explicitly disabled watcher", async () => {
    const f = await fixture();
    try {
      const config = await resolveConfig({ configFile: false, root: f.repoRoot, logLevel: "silent",
        plugins: [devPlayerBundlesPlugin()], server: { watch: null } }, "serve");
      expect(config.server.watch).toBeNull();
    } finally { await rm(f.root, { recursive: true, force: true }); }
  });
});
