import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fieldSpawnBody } from "@/editor/panels/eventEditor/commandBodyFieldSpawn";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";
import { createCaptureProject } from "./fixtures/captureProject";
import { MINIMAL_COMMANDS } from "./fixtures/minimalCommands";
import { probeCommandControls } from "./eventEditorCommitProbe";

let restore: () => void;
beforeEach(() => { restore = installFakeDom(); store.replace(createCaptureProject()); });
afterEach(() => restore());

describe("spawn numeric controls through the gate DOM", () => {
  it.each(["x", "y", "w", "h"] as const)("rejects invalid %s edits and accumulates valid commits", key => {
    const initial = MINIMAL_COMMANDS.spawnFieldEnemy;
    if (initial.kind !== "spawnFieldEnemy") throw new Error("Wrong fixture");
    let current: Command = structuredClone(initial);
    const replaceCommand = vi.fn((_path: readonly number[], command: Command) => { current = command; });
    const unexpected = () => { throw new Error("Unexpected action"); };
    const root = fieldSpawnBody({ path: [0], getCurrentCommand: () => current, actions: {
      replaceCommand, addCommand: unexpected, insertCommand: unexpected, deleteCommand: unexpected,
      moveCommand: unexpected, moveCommandTo: unexpected,
    } }, initial);
    if (!(root instanceof FakeElement)) throw new Error("Expected gate DOM");
    const input = findByTestId(root, `event-command-spawn-area-${key}`);
    if (!input) throw new Error("Missing numeric control");
    const invalid = vi.fn();
    input.addEventListener("invalid", invalid);
    for (const raw of ["", "NaN", "Infinity", "1e309", "0x10", "2.5"]) {
      input.value = raw;
      input.dispatchEvent(new Event("change"));
      expect(current).toEqual(initial);
      expect(replaceCommand).not.toHaveBeenCalled();
    }
    expect(invalid).toHaveBeenCalledTimes(6);
    for (const value of [3, 4]) {
      input.value = String(value);
      input.dispatchEvent(new Event("change"));
      expect(current).toEqual({ ...initial, spawn: { ...initial.spawn, area: { ...initial.spawn.area, [key]: value } } });
    }
    expect(replaceCommand).toHaveBeenCalledTimes(2);
  });

  it("existing native numeric consumers retain their number instead of the missing-API fallback", () => {
    const initial = MINIMAL_COMMANDS.changeFactionStance;
    if (initial.kind !== "changeFactionStance") throw new Error("Wrong fixture");
    const run = probeCommandControls(initial);
    expect(run.results).toHaveLength(4);
    for (const result of run.results) {
      expect(result.outcome).toBe("commit");
      expect(result.committed).toMatchObject({ value: result.key === "event-command-faction-value" ? Number(result.applied) : initial.value });
    }
  });

  it("the actual commit probe commits all seven fields without exceptions or no-commit exemptions", () => {
    const run = probeCommandControls(MINIMAL_COMMANDS.spawnFieldEnemy);
    expect(run.error).toBeUndefined();
    expect(run.results).toHaveLength(7);
    expect(run.results.map(result => result.outcome)).toEqual(Array(7).fill("commit"));
    for (const result of run.results) {
      expect(result.errorMessage).toBeUndefined();
      expect(result.callCount).toBe(1);
    }
  });
});
