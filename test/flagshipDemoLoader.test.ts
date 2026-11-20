import { afterEach, describe, expect, it, vi } from "vitest";
import { isBgmFileInstalled, setInstalledBgmFiles } from "@/assets/installedBgm";
import { prepareDevShowcaseProjectFactory } from "@/editor/devShowcaseProjects";
import { openFlagshipDemo } from "@/editor/flagshipDemoLoader";
import type { FlagshipDemoId } from "@/project/flagship/types";
import { BUILTIN_GAMES, builtinGameEditUrl } from "@/start/home/builtinGames";
import type { ToastKind, ToastOptions } from "@/util/toast";

const mocks = vi.hoisted(() => ({
  build: vi.fn(),
  deserializeParsed: vi.fn((data: unknown) => data),
  copy: vi.fn(),
  leave: vi.fn(),
  confirm: vi.fn(),
  save: vi.fn(),
  hasUnsavedChanges: vi.fn(() => false),
  replaceProject: vi.fn(),
  toast: vi.fn<(message: string, options: ToastKind | ToastOptions) => void>(),
}));

vi.mock("@/project/flagship", () => ({ createFlagshipDemoProject: mocks.build }));
vi.mock("@/project/io", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/project/io")>(),
  deserializeParsed: mocks.deserializeParsed,
}));
vi.mock("@/project/sharedContent", async (original) => ({
  ...await original<typeof import("@/project/sharedContent")>(),
  loadSharedContent: vi.fn(),
  ensureSharedContent: vi.fn(),
}));
vi.mock("@/project/store", () => ({
  store: {
    leave: vi.fn(),
  confirm: vi.fn(),
  save: vi.fn(),
  hasUnsavedChanges: mocks.hasUnsavedChanges,
    leaveProjectSession: mocks.leave,
    getAutoSaveState: () => ({ kind: "pending" }),
    isSharedDemoSession: () => false,
    replaceProject: mocks.replaceProject,
  },
}));
vi.mock("@/editor/ui/modal", () => ({ showConfirm: mocks.confirm }));
vi.mock("@/editor/saveActions", () => ({ saveProjectNow: mocks.save }));
vi.mock("@/util/toast", () => ({ toast: mocks.toast, dismissToastsByKey: vi.fn() }));

function launchOffline(id: FlagshipDemoId, response: Response) {
  const url = new URL(`/index.html?demo=${id}&lang=en`, "app://oprn");
  const offline = vi.fn(async () => { throw new Error("Host offline"); });
  const reload = vi.fn();
  const assign = vi.fn();
  const replaceState = vi.fn();
  vi.stubGlobal("window", {
    location: Object.assign(url, { reload, assign }),
    history: { state: null, replaceState },
    oprn: { project: { status: offline }, team: { status: offline }, start: { createProject: mocks.copy } },
  });
  vi.stubGlobal("document", { baseURI: url.href });
  vi.stubEnv("DEV", false);
  vi.stubGlobal("fetch", async (resource: URL) => {
    expect(resource.href).toBe(`app://oprn/demos/${id}.project.json`);
    return response;
  });
  return { offline, reload, replaceState, assign };
}

describe("opening a bundled sample", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    setInstalledBgmFiles(null);
  });

  it.each(BUILTIN_GAMES)("loads $id from the launcher with the host offline", async ({ id, title }) => {
    const project = { meta: { title }, tilesets: {} };
    const { offline } = launchOffline(id, Response.json(project));
    expect(window.location.pathname + window.location.search).toBe(`${builtinGameEditUrl(id)}&lang=en`);

    const factory = await prepareDevShowcaseProjectFactory();

    expect(factory()).toEqual(project);
    expect(offline).not.toHaveBeenCalled();
    expect(mocks.build).not.toHaveBeenCalled();
    expect(mocks.copy).not.toHaveBeenCalled();
  });

  it("opens an in-memory Astra Horizon when the baked file and optional music pack are absent", async () => {
    const { offline } = launchOffline("emerald-crown", new Response(null, { status: 404 }));
    const project = { meta: { title: "Astra Horizon" } };
    setInstalledBgmFiles([]);
    mocks.build.mockImplementation(() => {
      if (!isBgmFileInstalled("optional-track.ogg")) throw new Error("Music pack is not installed");
      return { project, manifest: { title: project.meta.title } };
    });

    const factory = await prepareDevShowcaseProjectFactory();

    expect(factory()).toBe(project);
    expect(mocks.build).toHaveBeenCalledWith("emerald-crown");
    expect(offline).not.toHaveBeenCalled();
    expect(mocks.copy).not.toHaveBeenCalled();
    expect(isBgmFileInstalled("optional-track.ogg")).toBe(false);
  });

  it("reports a sample data failure if the bundled file and the fallback both fail", async () => {
    launchOffline("emerald-crown", new Response(null, { status: 404 }));
    mocks.build.mockImplementation(() => { throw new Error("Invalid sample data"); });

    expect(await openFlagshipDemo("emerald-crown", { action: "open" })).toBe(false);

    expect(mocks.toast).toHaveBeenLastCalledWith("앱에 포함된 예제 데이터를 불러오지 못했습니다.", "error");
    expect(mocks.copy).not.toHaveBeenCalled();
  });

  it("offers an offline preview after copy failure and guards unsaved work", async () => {
    const { assign } = launchOffline("emerald-crown", Response.json({ meta: { title: "Astra Horizon" }, system: {}, tilesets: {} }));
    mocks.copy.mockRejectedValue(new Error("Permission denied"));

    expect(await openFlagshipDemo("emerald-crown", { action: "open" })).toBe(false);

    expect(mocks.toast).toHaveBeenLastCalledWith(
      "예제를 새 프로젝트 폴더로 복사하지 못했습니다. 현재 작업의 저장 상태와 새 폴더의 쓰기 권한을 확인해 주세요.",
      expect.objectContaining({ kind: "error", action: expect.objectContaining({ label: "저장 없이 예제 열기" }) }),
    );
    expect(mocks.replaceProject).not.toHaveBeenCalled();

    const options = mocks.toast.mock.lastCall?.[1];
    if (typeof options !== "object" || !options.action) throw new Error("Missing sample preview action");
    mocks.hasUnsavedChanges.mockReturnValue(true);
    mocks.confirm.mockResolvedValueOnce(false);
    await options.action.onClick();
    expect(assign).not.toHaveBeenCalled();
    expect(mocks.leave).not.toHaveBeenCalled();

    mocks.confirm.mockResolvedValueOnce(true);
    await options.action.onClick();
    expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ danger: true, message: expect.stringContaining("사라집니다") }));
    expect(mocks.leave).toHaveBeenCalledOnce();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith("app://oprn/index.html?demo=emerald-crown&lang=en");
  });

  it("opens the sample after a failed save without attempting a second save", async () => {
    const { assign } = launchOffline("emerald-crown", Response.json({ meta: { title: "예제" }, tilesets: {} }));
    mocks.hasUnsavedChanges.mockReturnValue(true);
    mocks.save.mockResolvedValue(false);
    expect(await openFlagshipDemo("emerald-crown", { action: "open" })).toBe(false);
    const options = mocks.toast.mock.lastCall?.[1];
    if (typeof options !== "object" || !options.action) throw new Error("Missing discard action");
    mocks.confirm.mockResolvedValue(true);
    await options.action.onClick();
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.copy).not.toHaveBeenCalled();
    expect(mocks.leave).toHaveBeenCalledOnce();
    expect(assign).toHaveBeenCalledWith("app://oprn/index.html?demo=emerald-crown&lang=en");
  });

  it("reloads a saved copy outside the sample preview URL", async () => {
    const project = { meta: { title: "Astra Horizon" }, system: {}, tilesets: {} };
    const { reload, replaceState } = launchOffline("emerald-crown", Response.json(project));
    mocks.copy.mockResolvedValue({ projectId: "new", projectDir: "/new" });

    expect(await openFlagshipDemo("emerald-crown", { action: "open" })).toBe(true);

    expect(mocks.copy).toHaveBeenCalledWith({ title: "Astra Horizon", seed: JSON.stringify(project) });
    expect(mocks.leave).toHaveBeenCalledOnce();
    expect(replaceState).toHaveBeenCalledWith(null, "", new URL("app://oprn/index.html?lang=en"));
    expect(reload).toHaveBeenCalledOnce();
    expect(mocks.replaceProject).not.toHaveBeenCalled();
  });
});
