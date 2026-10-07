/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bundledConcepts } from "@/concepts/source";
import type { OprnBridgeStart } from "@/project/persistence/electronRepository";
import { launcherMakeHandler } from "@/start/conceptFeed/launcherMake";
import { takeStartScreenIntent } from "@/start/startIntent";

const concept = bundledConcepts()[0]!;

function memoryStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  const map = new Map<string, string>();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value), removeItem: (key) => void map.delete(key) };
}

describe("launcher make", () => {
  it("creates the folder, hands a pending concept brief to the editor, then leaves", async () => {
    const storage = memoryStorage();
    const createProject = vi.fn(async () => ({ projectDir: "/games/x", projectId: "p1" }));
    const bridge = { createProject, suggestProjectDir: async () => ({ projectDir: "/games/x" }) } as unknown as OprnBridgeStart;
    const made = vi.fn();
    const goEditor = vi.fn();
    const make = launcherMakeHandler(bridge, { ensureAiConnected: async () => true, made, goEditor, storage });
    expect(await make(concept, "주인공을 고양이로")).toBe(true);
    expect(createProject).toHaveBeenCalledWith({ title: concept.title, projectDir: "/games/x" });
    const intent = takeStartScreenIntent(storage, "/games/x")!;
    expect(intent.choiceId).toBe(concept.presetId);
    expect(intent.startMode).toBe("ai");
    expect(intent.gameDesignBrief?.generationPending).toBe(true);
    expect(intent.gameDesignBrief?.concept).toEqual({ slug: concept.slug, title: concept.title, hook: concept.hook, tweak: "주인공을 고양이로" });
    expect(made).toHaveBeenCalledWith(concept.slug);
    expect(goEditor).toHaveBeenCalledOnce();
  });

  it("does not create a folder when the AI connection is declined", async () => {
    const createProject = vi.fn();
    const goEditor = vi.fn();
    const make = launcherMakeHandler({ createProject } as unknown as OprnBridgeStart, { ensureAiConnected: async () => false, made: vi.fn(), goEditor, storage: memoryStorage() });
    expect(await make(concept, "")).toBe(false);
    expect(createProject).not.toHaveBeenCalled();
    expect(goEditor).not.toHaveBeenCalled();
  });

  it("throws a readable error when the host cannot create the folder", async () => {
    const make = launcherMakeHandler({ createProject: async () => null } as unknown as OprnBridgeStart, { ensureAiConnected: async () => true, made: vi.fn(), goEditor: vi.fn(), storage: memoryStorage() });
    await expect(make(concept, "")).rejects.toThrow("새 게임 폴더를 만들지 못했습니다.");
  });
});

describe("editor make", () => {
  beforeEach(() => { vi.resetModules(); });

  it("welcome seeds the open project with the preset system and a pending brief", async () => {
    const { store } = await import("@/project/store");
    const { createBlankProject } = await import("@/project/defaults");
    const blank = createBlankProject();
    store.replace(blank);
    const playResolution = store.getCurrent().system.playResolution;
    const { welcomeMakeHandler } = await import("@/editor/conceptMake");
    const made = vi.fn();
    expect(await welcomeMakeHandler({ ensureAiConnected: async () => true, made })(concept, "")).toBe(true);
    const project = store.getCurrent();
    expect(project.meta.title).toBe(concept.title);
    expect(project.gameDesignBrief?.generationPending).toBe(true);
    expect(project.gameDesignBrief?.concept?.slug).toBe(concept.slug);
    expect(project.system.playResolution).toEqual(playResolution);
    expect(made).toHaveBeenCalledWith(concept.slug);
  });

  it("menu writes a new folder seed carrying the brief and reloads", async () => {
    const createProjectFolderWithSeed = vi.fn(async () => true);
    vi.doMock("@/editor/projectFolderActions", () => ({ createProjectFolderWithSeed }));
    vi.doMock("@/editor/saveActions", () => ({ saveProjectNow: vi.fn(async () => true) }));
    const { menuMakeHandler } = await import("@/editor/conceptMake");
    const reload = vi.fn();
    expect(await menuMakeHandler({ ensureAiConnected: async () => true, made: vi.fn(), reload })(concept, "겨울로")).toBe(true);
    const [title, seed] = createProjectFolderWithSeed.mock.calls[0] as unknown as [string, { gameDesignBrief?: { generationPending?: boolean; concept?: { tweak?: string } } }];
    expect(title).toBe(concept.title);
    expect(seed.gameDesignBrief?.generationPending).toBe(true);
    expect(seed.gameDesignBrief?.concept?.tweak).toBe("겨울로");
    expect(reload).toHaveBeenCalledOnce();
    vi.doUnmock("@/editor/projectFolderActions");
    vi.doUnmock("@/editor/saveActions");
  });
});
