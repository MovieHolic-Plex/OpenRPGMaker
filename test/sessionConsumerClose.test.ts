import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

type OpenedStore = { projectDir: string; close: ReturnType<typeof vi.fn>; teamClose: ReturnType<typeof vi.fn> };

const hold = vi.hoisted(() => ({
  gate: Promise.resolve() as Promise<void>,
  stores: [] as OpenedStore[],
}));

vi.mock("../electron/local-store/store", () => ({
  initLocalProjectStore: async (options: { projectDir: string }) => {
    await hold.gate;
    const close = vi.fn();
    const opened: OpenedStore = { projectDir: options.projectDir, close, teamClose: vi.fn() };
    hold.stores.push(opened);
    return {
      projectDir: options.projectDir,
      projectId: "project",
      exportFolded: () => null,
      exportSerialized: () => null,
      close,
      info: () => ({ title: "Game" }),
    };
  },
}));

vi.mock("../electron/local-store/team", () => ({
  openTeamDirectory: (projectDir: string) => {
    const close = vi.fn();
    for (let index = hold.stores.length - 1; index >= 0; index -= 1) {
      const entry = hold.stores[index];
      if (entry?.projectDir === projectDir) {
        entry.teamClose = close;
        break;
      }
    }
    return { close };
  },
}));

import { SessionConsumerClosed, createProjectSessionRegistry } from "../electron/main/sessions";

const dirs: string[] = [];

afterEach(async () => {
  hold.stores.length = 0;
  hold.gate = Promise.resolve();
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function projectDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "oprn-session-close-"));
  dirs.push(dir);
  return dir;
}

function deferred(): { promise: Promise<void>; resolve: () => void; reject: (error: Error) => void } {
  let resolve: () => void = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("session close while a project is opening", () => {
  it("does not keep the store when the only window closes during open", async () => {
    const dir = await projectDir();
    const gate = deferred();
    hold.gate = gate.promise;
    const sessions = createProjectSessionRegistry();
    const opening = sessions.open(1, dir);
    sessions.close(1);
    gate.resolve();
    await expect(opening).rejects.toBeInstanceOf(SessionConsumerClosed);
    expect(sessions.get(1)).toBeNull();
    expect(hold.stores).toHaveLength(1);
    expect(hold.stores[0]?.close).toHaveBeenCalledTimes(1);
    expect(hold.stores[0]?.teamClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the store for a second window that is still opening the same folder", async () => {
    const dir = await projectDir();
    const gate = deferred();
    hold.gate = gate.promise;
    const sessions = createProjectSessionRegistry();
    const first = sessions.open("gone", dir);
    const second = sessions.open("stays", dir);
    sessions.close("gone");
    gate.resolve();
    await expect(first).rejects.toBeInstanceOf(SessionConsumerClosed);
    const stayed = await second;
    expect(sessions.get("stays")).toBe(stayed);
    expect(sessions.get("gone")).toBeNull();
    expect(hold.stores[0]?.close).not.toHaveBeenCalled();
    sessions.close("stays");
    expect(hold.stores[0]?.close).toHaveBeenCalledTimes(1);
    expect(hold.stores[0]?.teamClose).toHaveBeenCalledTimes(1);
  });

  it("closes the store once when every opener closes during open", async () => {
    const dir = await projectDir();
    const gate = deferred();
    hold.gate = gate.promise;
    const sessions = createProjectSessionRegistry();
    const first = sessions.open("a", dir);
    const second = sessions.open("b", dir);
    sessions.close("a");
    sessions.close("b");
    gate.resolve();
    await expect(first).rejects.toBeInstanceOf(SessionConsumerClosed);
    await expect(second).rejects.toBeInstanceOf(SessionConsumerClosed);
    expect(hold.stores[0]?.close).toHaveBeenCalledTimes(1);
    expect(hold.stores[0]?.teamClose).toHaveBeenCalledTimes(1);
  });

  it("lets the same window open again after closing during the previous open", async () => {
    const dir = await projectDir();
    const gate = deferred();
    hold.gate = gate.promise;
    const sessions = createProjectSessionRegistry();
    const opening = sessions.open(7, dir);
    sessions.close(7);
    gate.resolve();
    await expect(opening).rejects.toBeInstanceOf(SessionConsumerClosed);
    hold.gate = Promise.resolve();
    const again = await sessions.open(7, dir);
    expect(sessions.get(7)).toBe(again);
    expect(hold.stores[1]?.close).not.toHaveBeenCalled();
    sessions.close(7);
    expect(hold.stores[1]?.close).toHaveBeenCalledTimes(1);
  });

  it("does not treat a close from before this open as a cancel", async () => {
    const dir = await projectDir();
    const sessions = createProjectSessionRegistry();
    sessions.close("idle");
    const session = await sessions.open("idle", dir);
    expect(sessions.get("idle")).toBe(session);
    expect(hold.stores[0]?.close).not.toHaveBeenCalled();
    sessions.close("idle");
  });

  it("still closes the previous folder when one window switches projects", async () => {
    const from = await projectDir();
    const to = await projectDir();
    const sessions = createProjectSessionRegistry();
    const first = await sessions.open("window", from);
    const second = await sessions.open("window", to);
    expect(sessions.get("window")).toBe(second);
    expect(first).not.toBe(second);
    expect(hold.stores[0]?.close).toHaveBeenCalledTimes(1);
    expect(hold.stores[0]?.teamClose).toHaveBeenCalledTimes(1);
    expect(hold.stores[1]?.close).not.toHaveBeenCalled();
    sessions.close("window");
    expect(hold.stores[1]?.close).toHaveBeenCalledTimes(1);
  });

  it("shares one store across two windows and closes it only after both leave", async () => {
    const dir = await projectDir();
    const sessions = createProjectSessionRegistry();
    const first = await sessions.open("a", dir);
    const second = await sessions.open("b", dir);
    expect(second).toBe(first);
    sessions.close("a");
    expect(hold.stores[0]?.close).not.toHaveBeenCalled();
    expect(sessions.get("b")).toBe(first);
    sessions.close("b");
    expect(hold.stores[0]?.close).toHaveBeenCalledTimes(1);
    expect(hold.stores[0]?.teamClose).toHaveBeenCalledTimes(1);
  });

  it("retries after the store fails to open", async () => {
    const dir = await projectDir();
    const gate = deferred();
    hold.gate = gate.promise;
    const sessions = createProjectSessionRegistry();
    const opening = sessions.open("k", dir);
    const failure = new Error("disk");
    gate.reject(failure);
    await expect(opening).rejects.toThrow("disk");
    hold.gate = Promise.resolve();
    const session = await sessions.open("k", dir);
    expect(sessions.get("k")).toBe(session);
    sessions.close("k");
  });
});
