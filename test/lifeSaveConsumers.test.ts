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
