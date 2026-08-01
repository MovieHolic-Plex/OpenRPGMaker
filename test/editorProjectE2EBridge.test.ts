import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { serialize } from "@/project/io";
import { sha256HexText } from "@/util/sha256";

const URL = "https://abcdefghijklmnopqrst.supabase.co";
const KEY = "aaa.bbb.ccc";
const PROJECT_ID = "ed0ed8e2-50b6-4a3a-a884-c2f46fcbf431";
const CAPABILITY = "capability-value-with-more-than-thirty-two-characters";
const CONFIG_KEY = "rpg-zzu:supabase-project-config";
const BOOTSTRAP = Symbol.for("rpg-zzu.project-e2e.bootstrap");

type TestWindow = Window & { [BOOTSTRAP]?: unknown };

function testWindow(): TestWindow {
  const values = new Map<string, string>();
  values.set(CONFIG_KEY, JSON.stringify({ source: "custom", url: URL, anonKey: KEY, projectId: PROJECT_ID }));
  return {
    location: { hostname: "127.0.0.1", pathname: "/", search: "" },
    localStorage: {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() { return values.size; },
      removeItem: (key: string) => { values.delete(key); },
      setItem: (key: string, value: string) => { values.set(key, value); },
    },
  } as unknown as TestWindow;
}

async function loadBridgeModule() {
  vi.resetModules();
  vi.stubGlobal("window", testWindow());
  vi.stubGlobal("navigator", { webdriver: true });
  const credentialDigest = await sha256HexText(KEY);
  (window as TestWindow)[BOOTSTRAP] = { capability: CAPABILITY, credentialDigest, projectId: PROJECT_ID, targetUrl: URL };
  const module = await import("@/editor/editorToolHook");
  const storeModule = await import("@/project/store");
  storeModule.store.replace(createBlankProject());
  module.installEditorToolHook();
  return { module, store: storeModule.store };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(async () => {
  try {
    const module = await import("@/editor/editorToolHook");
    module.cleanupProjectE2EBridge();
  } catch {
    // Module may not have loaded in a failed setup.
  }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("mounted project E2E bridge", () => {
  it("installs exactly four frozen methods and returns detached recursively frozen snapshots", async () => {
    const { module, store } = await loadBridgeModule();
    const bridge = window.__rpgzzuProjectE2E!;
    expect(Object.keys(bridge).sort()).toEqual(["currentProject", "flush", "initializeRemoteFixture", "reloadRemote"]);
    expect(Object.isFrozen(bridge)).toBe(true);
    const snapshot = bridge.currentProject();
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.project)).toBe(true);
    expect(snapshot.project).not.toBe(store.getCurrent());
    const title = store.getCurrent().meta.title;
    expect(() => { (snapshot.project.meta as { title: string }).title = "mutated"; }).toThrow();
    expect(store.getCurrent().meta.title).toBe(title);
    const first = bridge;
    module.installEditorToolHook();
    expect(window.__rpgzzuProjectE2E).toBe(first);
  });

  it("denies missing/wrong capability before invoking either remote store method", async () => {
    const { store } = await loadBridgeModule();
    const bridge = window.__rpgzzuProjectE2E!;
    const init = vi.spyOn(store, "loadNewRemoteProjectForE2E");
    const reload = vi.spyOn(store, "reloadFromRemoteForE2E");
    const blankProject = createBlankProject();
    const proof = { capability: "wrong", expectedCanonicalPayload: serialize(blankProject), expectedProjectId: PROJECT_ID, expectedTargetUrl: URL };
    await expect(bridge.initializeRemoteFixture({ blankProject, projectId: PROJECT_ID, title: "owned" }, proof)).resolves.toEqual({ kind: "denied", reason: "capability-required" });
    await expect(bridge.reloadRemote(proof)).resolves.toEqual({ kind: "denied", reason: "capability-required" });
    expect(init).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("maps authorized initialization and reload to the mounted singleton with exact proof", async () => {
    const { store } = await loadBridgeModule();
    const bridge = window.__rpgzzuProjectE2E!;
    const blankProject = createBlankProject();
    const init = vi.spyOn(store, "loadNewRemoteProjectForE2E").mockResolvedValue({ projectId: PROJECT_ID });
    const reload = vi.spyOn(store, "reloadFromRemoteForE2E").mockResolvedValue({ kind: "reloaded", projectId: PROJECT_ID, title: "owned" });
    const proof = { capability: CAPABILITY, expectedCanonicalPayload: serialize(blankProject), expectedProjectId: PROJECT_ID, expectedTargetUrl: URL };
    const initialized = await bridge.initializeRemoteFixture({ blankProject, projectId: PROJECT_ID, title: "owned" }, proof);
    expect(initialized.kind).toBe("authorized");
    expect(init).toHaveBeenCalledOnce();
    expect(init.mock.calls[0]![1]).toMatchObject({ expectedCurrentProjectId: PROJECT_ID, expectedProjectId: PROJECT_ID, expectedTargetUrl: URL, title: "owned" });
    const reloaded = await bridge.reloadRemote({ ...proof, expectedCanonicalPayload: bridge.currentProject().canonicalPayload });
    expect(reloaded.kind).toBe("authorized");
    expect(reload).toHaveBeenCalledOnce();
    expect(reload.mock.calls[0]![0]).toMatchObject({ expectedProjectId: PROJECT_ID, expectedTargetUrl: URL });
  });

  it("cleanup removes only the bridge and remount consumes no stale capability", async () => {
    const { module } = await loadBridgeModule();
    const first = window.__rpgzzuProjectE2E;
    expect(first).toBeDefined();
    module.cleanupProjectE2EBridge();
    expect(window.__rpgzzuProjectE2E).toBeUndefined();
    module.installEditorToolHook();
    const second = window.__rpgzzuProjectE2E!;
    expect(second).toBeDefined();
    expect(second).not.toBe(first);
    const blankProject = createBlankProject();
    await expect(second.initializeRemoteFixture({ blankProject, projectId: PROJECT_ID, title: "owned" }, {
      capability: CAPABILITY,
      expectedCanonicalPayload: serialize(blankProject),
      expectedProjectId: PROJECT_ID,
      expectedTargetUrl: URL,
    })).resolves.toEqual({ kind: "denied", reason: "capability-required" });
  });

  it("does not install without WebDriver", async () => {
    vi.resetModules();
    vi.stubGlobal("window", testWindow());
    vi.stubGlobal("navigator", { webdriver: false });
    const module = await import("@/editor/editorToolHook");
    module.installEditorToolHook();
    expect(window.__rpgzzuProjectE2E).toBeUndefined();
  });
});
