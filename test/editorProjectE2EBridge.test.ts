import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { serialize } from "@/project/io";
import { sha256HexText } from "@/util/sha256";

const URL = "https://abcdefghijklmnopqrst.supabase.co";
const KEY = "aaa.bbb.ccc";
const PROJECT_ID = "ed0ed8e2-50b6-4a3a-a884-c2f46fcbf431";
const CAPABILITY = "capability-value-with-more-than-thirty-two-characters";
const CONFIG_KEY = "oprn:supabase-project-config";
const BOOTSTRAP = Symbol.for("oprn:project-e2e.bootstrap");

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
  vi.stubEnv("VITE_SUPABASE_URL", URL);
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", KEY);
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", PROJECT_ID);
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
  vi.unstubAllEnvs();
});

describe("mounted project E2E bridge", () => {
  it("installs the snapshot seam and returns detached recursively frozen snapshots", async () => {
    const { module, store } = await loadBridgeModule();
    const bridge = window.__oprnProjectE2E!;
    expect(Object.keys(bridge).sort()).toEqual(["currentProject", "flush"]);
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
    expect(window.__oprnProjectE2E).toBe(first);
  }, 60_000);

  it("cleanup removes only the bridge and remount installs a fresh one", async () => {
    const { module } = await loadBridgeModule();
    const first = window.__oprnProjectE2E;
    expect(first).toBeDefined();
    module.cleanupProjectE2EBridge();
    expect(window.__oprnProjectE2E).toBeUndefined();
    module.installEditorToolHook();
    const second = window.__oprnProjectE2E!;
    expect(second).toBeDefined();
    expect(second).not.toBe(first);
  });

  it("does not install without WebDriver", async () => {
    vi.resetModules();
    vi.stubGlobal("window", testWindow());
    vi.stubGlobal("navigator", { webdriver: false });
    const module = await import("@/editor/editorToolHook");
    module.installEditorToolHook();
    expect(window.__oprnProjectE2E).toBeUndefined();
  });
});
