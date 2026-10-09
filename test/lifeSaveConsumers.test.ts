import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { Window } from "happy-dom";
import { afterEach, describe, expect, it } from "vitest";
import * as saves from "@/player/saveSlots";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";

const scripts = ["verify-gate-transfer.cjs", "capture-uiux-evidence.cjs", "playtest-driver2.cjs"];

// Execute the tracked consumers, not a second implementation of their predicates/loops.
function extract(file: string, kind: "observation" | "cleanup"): string {
  const source = ts.createSourceFile(file, readFileSync(new URL(`../scripts/${file}`, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const matches: string[] = [];
  function visit(node: ts.Node): void {
    if (kind === "observation" && ts.isVariableDeclaration(node) && node.name.getText(source) === "saved") {
      const initializer = node.initializer;
      if (!initializer || !ts.isAwaitExpression(initializer) || !ts.isCallExpression(initializer.expression)) throw new Error("Missing saved evaluation");
      matches.push(initializer.expression.arguments[0].getText(source));
    }
    if (kind === "cleanup" && ts.isForStatement(node) && node.getText(source).includes("localStorage.removeItem") && node.getText(source).includes("save-slot:")) matches.push(node.getText(source));
    ts.forEachChild(node, visit);
  }
  visit(source);
  expect(matches).toHaveLength(1);
  return matches[0];
}

const observation = extract(scripts[0], "observation");
const windows: Window[] = [];
function fixture() {
  const window = new Window();
  windows.push(window);
  const storage = window.localStorage;
  const project = createBlankProject();
  const snapshot = saves.createSaveSnapshot(project, startSession(project, 205));
  expect(saves.saveToSlot(storage, 1, snapshot)).toEqual({ ok: true });
  const raw = storage.getItem(saves.saveSlotKey(1))!;
  return { storage, snapshot, raw };
}
function observe(storage: Storage): Promise<boolean> | boolean {
  // Transpile only the browser import transport; the reader is the real public module.
  const code = ts.transpileModule(`(${observation})()`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  return vm.runInNewContext(code, {
    localStorage: storage,
    require: (id: string) => {
      expect(id).toBe("/src/player/saveSlots.ts");
      return saves;
    },
  });
}

afterEach(async () => {
  saves.setSaveSlotStorageNamespace(null);
  for (const window of windows.splice(0)) {
    window.localStorage.clear();
    await window.happyDOM.close();
  }
});

describe("tracked Save5 QA consumers", () => {
  it("observes real current writer bytes without relying on a legacy key", async () => {
    const { storage, raw } = fixture();
    expect(JSON.parse(raw).schemaVersion).toBe(5);
    expect(storage.getItem("oprn:save-slot:1")).toBeNull();
    expect(saves.readSaveSlot(storage, 1).kind).toBe("present");
    expect(await observe(storage)).toBe(true);
    expect(storage.getItem("oprn:save-slot:v5:1")).toBe(raw);
  });

  it("does not report legacy or another namespace's current save as the default save", async () => {
    const { storage, snapshot, raw } = fixture();
    storage.clear();
    saves.setSaveSlotStorageNamespace("  custom:other  ");
    expect(saves.saveToSlot(storage, 1, snapshot)).toEqual({ ok: true });
    saves.setSaveSlotStorageNamespace(null);
    storage.setItem("oprn:save-slot:1", raw);
    expect(await observe(storage)).toBe(false);
    expect(storage.getItem("custom:other:save-slot:v5:1")).toBe(raw);
  });

  it.each(["", "{broken", "null", "[]", '{"schemaVersion":5}'])("rejects malformed current bytes %j even with legacy progress", async (invalid) => {
    const { storage, raw } = fixture();
    storage.setItem("oprn:save-slot:1", raw);
    storage.setItem("oprn:save-slot:v5:1", invalid);
    expect(await observe(storage)).toBe(false);
    expect(storage.getItem("oprn:save-slot:v5:1")).toBe(invalid);
    expect(storage.getItem("oprn:save-slot:1")).toBe(raw);
  });

  it.each([4, 6, 999, "5"])("rejects non-current schema %j on actual writer payload", async (schemaVersion) => {
    const { storage, snapshot, raw } = fixture();
    const invalid = JSON.stringify({ ...snapshot, schemaVersion });
    storage.setItem("oprn:save-slot:1", raw);
    storage.setItem("oprn:save-slot:v5:1", invalid);
    expect(await observe(storage)).toBe(false);
    expect(storage.getItem("oprn:save-slot:v5:1")).toBe(invalid);
  });

  it("validates the session schema rather than accepting a version-only object", async () => {
    const { storage, snapshot, raw } = fixture();
    storage.setItem("oprn:save-slot:1", raw);
    storage.setItem("oprn:save-slot:v5:1", JSON.stringify({ ...snapshot, session: {} }));
    expect(await observe(storage)).toBe(false);
  });

  it.each(scripts)("%s clears both manual families only", (file) => {
    const { storage, snapshot, raw } = fixture();
    for (const namespace of [null, "  custom:other  "]) {
      saves.setSaveSlotStorageNamespace(namespace);
      for (const slot of [1, 2, 3] as const) {
        expect(saves.saveToSlot(storage, slot, snapshot)).toEqual({ ok: true });
        storage.setItem(`${namespace?.trim() ?? "oprn"}:save-slot:${slot}`, raw);
      }
    }
    saves.setSaveSlotStorageNamespace(null);
    const preserved = ["oprn:save-slot:v5:auto", "oprn:save-slot:auto", "oprn:preferences", "other:key", "oprn:save-slot:v5:4"];
    for (const key of preserved) storage.setItem(key, raw);
    vm.runInNewContext(extract(file, "cleanup"), { localStorage: storage });
    for (const slot of [1, 2, 3]) {
      expect(storage.getItem(`oprn:save-slot:v5:${slot}`)).toBeNull();
      expect(storage.getItem(`oprn:save-slot:${slot}`)).toBeNull();
      expect(storage.getItem(`custom:other:save-slot:v5:${slot}`)).toBe(raw);
      expect(storage.getItem(`custom:other:save-slot:${slot}`)).toBe(raw);
    }
    for (const key of preserved) expect(storage.getItem(key)).toBe(raw);
  });
});

const remainingScripts = ["playtest-driver3.cjs", "playtest-driver4.cjs", "playtest-driver5.cjs", "playtest-driver6.cjs", "capture-fullscreen-scale.cjs"];
const mutatingScripts = ["playtest-driver4.cjs", "playtest-driver6.cjs"];
function currentCallback(file: string, mutation = false): string {
  const source = ts.createSourceFile(file, readFileSync(new URL(`../scripts/${file}`, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const matches: string[] = [];
  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && node.expression.getText(source) === "page.evaluate") {
      const callback = node.arguments[0]?.getText(source) ?? "";
      if (callback.includes("localStorage.getItem") && callback.includes("localStorage.setItem") === mutation) matches.push(callback);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  expect(matches).toHaveLength(1);
  return matches[0];
}
function runCurrent(file: string, storage: Storage, mutation = false): Promise<unknown> {
  const callback = currentCallback(file, mutation);
  const code = ts.transpileModule(`(${callback})(["map_warp", 7, 9, { switch_probe: true }])`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  return Promise.resolve(vm.runInNewContext(code, {
    localStorage: storage,
    require: (id: string) => {
      expect(id).toBe("/src/player/saveSlots.ts");
      return saves;
    },
  }));
}

describe("remaining actual Save5 consumers (task40)", () => {
  it.each(remainingScripts)("%s removes only owned manual families", (file) => {
    const { storage, snapshot, raw } = fixture();
    expect(raw).not.toBeNull();
    const owned: string[] = [];
    const other: string[] = [];
    for (const namespace of [null, "custom:other"]) {
      saves.setSaveSlotStorageNamespace(namespace);
      for (const slot of [1, 2, 3] as const) {
        expect(saves.saveToSlot(storage, slot, snapshot)).toEqual({ ok: true });
        const key = saves.saveSlotKey(slot);
        expect(storage.getItem(key)).toBe(raw);
        const legacy = `${namespace ?? "oprn"}:save-slot:${slot}`;
        storage.setItem(legacy, raw);
        (namespace ? other : owned).push(key, legacy);
      }
      const auto = saves.autosaveKey();
      storage.setItem(auto, raw);
      other.push(auto);
    }
    saves.setSaveSlotStorageNamespace(null);
    for (const key of ["oprn:save-slot:auto", "oprn:save-slot:v5:4", "oprn:preferences", "unrelated"]) {
      storage.setItem(key, raw);
      other.push(key);
    }
    const cleanup = extract(file, "cleanup");
    vm.runInNewContext(cleanup, { localStorage: storage });
    console.log(JSON.stringify({ file, cleanup, remainingOwned: owned.filter((key) => storage.getItem(key) !== null), preserved: other.every((key) => storage.getItem(key) === raw) }));
    expect(owned.map((key) => storage.getItem(key))).toEqual(owned.map(() => null));
    for (const key of other) expect(storage.getItem(key)).toBe(raw);
  });

  describe.each(mutatingScripts)("%s", (file) => {
    it("observes the real default writer without legacy bytes", async () => {
      const { storage, raw } = fixture();
      expect(raw).not.toBeNull();
      const observed = await runCurrent(file, storage);
      console.log(JSON.stringify({ file, observer: currentCallback(file), observed, key: saves.saveSlotKey(1), schemaVersion: JSON.parse(raw).schemaVersion }));
      expect(observed).toBe(true);
    });

    it("mutates the exact current owner preferred by the reader, preserving legacy and other namespaces", async () => {
      const { storage, snapshot, raw } = fixture();
      const key = saves.saveSlotKey(1);
      expect(storage.getItem(key)).not.toBeNull();
      storage.setItem("oprn:save-slot:1", raw);
      saves.setSaveSlotStorageNamespace("custom:other");
      expect(saves.saveToSlot(storage, 1, snapshot)).toEqual({ ok: true });
      const otherKey = saves.saveSlotKey(1);
      expect(storage.getItem(otherKey)).toBe(raw);
      saves.setSaveSlotStorageNamespace(null);
      await runCurrent(file, storage, true);
      const current = JSON.parse(storage.getItem(key)!);
      console.log(JSON.stringify({ file, mutation: currentCallback(file, true), currentPosition: [current.session.currentMapId, current.session.x, current.session.y], legacyPreserved: storage.getItem("oprn:save-slot:1") === raw }));
      expect(current.session).toMatchObject({ currentMapId: "map_warp", x: 7, y: 9 });
      if (file === "playtest-driver4.cjs") expect(current.session.switches.switch_probe).toBe(true);
      expect(current).toEqual({ ...snapshot, session: { ...snapshot.session, currentMapId: "map_warp", x: 7, y: 9, switches: file === "playtest-driver4.cjs" ? { ...snapshot.session.switches, switch_probe: true } : snapshot.session.switches } });
      const read = saves.readSaveSlot(storage, 1);
      expect(read.kind).toBe("present");
      if (read.kind === "present") expect(read.snapshot.session).toMatchObject({ currentMapId: "map_warp", x: 7, y: 9 });
      expect(storage.getItem("oprn:save-slot:1")).toBe(raw);
      expect(storage.getItem(otherKey)).toBe(raw);
    });

    it.each(["", "{broken", "null", "[]", '{"schemaVersion":5}', 4, 6, 999, "5", "invalid-session"])("rejects invalid current bytes %j without mutation or legacy fallback", async (invalid) => {
      const { storage, snapshot, raw } = fixture();
      const key = saves.saveSlotKey(1);
      const bytes = invalid === "invalid-session" ? JSON.stringify({ ...snapshot, session: {} })
        : typeof invalid === "number" || invalid === "5" ? JSON.stringify({ ...snapshot, schemaVersion: invalid }) : invalid;
      storage.setItem(key, bytes);
      storage.setItem("oprn:save-slot:1", raw);
      expect(await runCurrent(file, storage)).toBe(false);
      await expect(runCurrent(file, storage, true)).rejects.toThrow();
      expect(storage.getItem(key)).toBe(bytes);
      expect(storage.getItem("oprn:save-slot:1")).toBe(raw);
    });

    it("does not observe or mutate legacy-only or other namespace saves", async () => {
      const { storage, snapshot, raw } = fixture();
      storage.clear();
      saves.setSaveSlotStorageNamespace("custom:other");
      expect(saves.saveToSlot(storage, 1, snapshot)).toEqual({ ok: true });
      const otherKey = saves.saveSlotKey(1);
      saves.setSaveSlotStorageNamespace(null);
      storage.setItem("oprn:save-slot:1", raw);
      expect(await runCurrent(file, storage)).toBe(false);
      await expect(runCurrent(file, storage, true)).rejects.toThrow();
      expect(storage.getItem(saves.saveSlotKey(1))).toBeNull();
      expect(storage.getItem(otherKey)).toBe(raw);
      expect(storage.getItem("oprn:save-slot:1")).toBe(raw);
    });
  });
});
