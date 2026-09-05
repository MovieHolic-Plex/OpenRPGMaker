// 스튜디오 바(2026-09-03) — 톱바 한 줄의 집 계약.
//
// 배경: 그 전 톱바는 메뉴 4개 + 작업 칩 4개 + 보기 + Ctrl K + 오른쪽 8개가 한 줄에 놓이고, 전문가는
// 아래에 67px 클래식 툴바 행(15개, 그중 14개가 메뉴 항목의 복제)이 하나 더 있었다. 테스트 실행의 집이
// 넷(작업 칩·▶ 버튼·게임 메뉴·클래식 툴바)까지 갔다. 이 파일은 남은 집이 하나씩인지, 없어진 표면이
// 되살아나지 않는지, 모드별 도구 자리가 규칙대로인지 본다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
import { createBlankProject } from "@/project/defaults";
import { store, type AutoSaveState } from "@/project/store";
import type { GenrePackId } from "@/project/genrePackId";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

const mocks = vi.hoisted(() => ({
  openDatabaseModal: vi.fn(),
  openResourceModal: vi.fn(),
  openWorldPanel: vi.fn(),
  openAudioTestDialog: vi.fn(),
  openMapEventSearchModal: vi.fn(),
  openAiSettingsModal: vi.fn(),
  saveProjectNow: vi.fn(async () => undefined),
  showNewProjectDialog: vi.fn(
    async (): Promise<{ readonly title: string; readonly packId: GenrePackId | null }> => ({
      title: "새 프로젝트",
      packId: null,
    }),
  ),
  sendAiBootIntent: vi.fn((_text: string): boolean => true),
  setPendingAiBootIntent: vi.fn((_text: string, _options?: { readonly autoSend?: boolean }): void => {}),
  applyPendingAiBootIntent: vi.fn((): boolean => true),
}));

vi.mock("@/editor/panels/databaseModal", () => ({ openDatabaseModal: mocks.openDatabaseModal }));
vi.mock("@/editor/panels/resourceModal", () => ({ openResourceModal: mocks.openResourceModal }));
vi.mock("@/editor/panels/worldPanel", () => ({ openWorldPanel: mocks.openWorldPanel }));
vi.mock("@/editor/panels/audioTestDialog", () => ({ openAudioTestDialog: mocks.openAudioTestDialog }));
vi.mock("@/editor/panels/mapEventSearchModal", () => ({ openMapEventSearchModal: mocks.openMapEventSearchModal }));
vi.mock("@/editor/panels/aiSettingsModal", () => ({ openAiSettingsModal: mocks.openAiSettingsModal }));
vi.mock("@/editor/saveActions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/editor/saveActions")>();
  return { ...actual, saveProjectNow: mocks.saveProjectNow };
});
vi.mock("@/editor/aiBootIntent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/editor/aiBootIntent")>();
  return {
    ...actual,
    sendAiBootIntent: mocks.sendAiBootIntent,
    setPendingAiBootIntent: mocks.setPendingAiBootIntent,
    applyPendingAiBootIntent: mocks.applyPendingAiBootIntent,
  };
});
vi.mock("@/editor/ui/newProjectDialog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/editor/ui/newProjectDialog")>();
  return { ...actual, showNewProjectDialog: mocks.showNewProjectDialog };
});

vi.mock("@/editor/panels/newProjectDialog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/editor/panels/newProjectDialog")>();
  return { ...actual, showNewProjectDialog: mocks.showNewProjectDialog };
});

const { renderTopbar, autosaveStatusText, projectMenuLabel } = await import("@/editor/panels/menu");

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

let restoreDom: (() => void) | null = null;
let previousWindow: unknown;
let pendingTimers: ReturnType<typeof globalThis.setTimeout>[] = [];

function fake(node: HTMLElement): FakeElement {
  if (node instanceof FakeElement) return node;
  throw new Error("expected FakeElement");
}

function installBrowserGlobals(): void {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: storage });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      localStorage: storage,
      innerWidth: 1440,
      innerHeight: 900,
      setTimeout: ((handler: TimerHandler, timeout?: number) => {
        const handle = globalThis.setTimeout(handler as () => void, timeout);
        pendingTimers.push(handle);
        return handle;
      }) as typeof globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    },
  });
  Object.defineProperty(document, "documentElement", { configurable: true, value: document.createElement("html") });
  Object.defineProperty(document, "fullscreenElement", { configurable: true, writable: true, value: null });
}

function render(mode: "beginner" | "standard" | "expert"): FakeElement {
  resetEditorUiModeForTests(mode);
  const topbar = document.createElement("div");
  renderTopbar(topbar);
  return fake(topbar);
}

/** 톱바 + 열린 팝업(document.body)에 있는 모든 testid — 집이 하나인지 셀 때 쓴다. */
function allTestIds(topbar: FakeElement): string[] {
  const ids: string[] = [];
  const walk = (node: FakeElement): void => {
    if (node.dataset.testid) ids.push(node.dataset.testid);
    for (const child of node.children) walk(child);
  };
  walk(topbar);
  for (const child of fake(document.body as unknown as HTMLElement).children) walk(child);
  return ids;
}

function openMenu(topbar: FakeElement, menuId: string): FakeElement | null {
  const popupId = `menu-popup-${menuId.replace(/^menu-/, "")}`;
  const body = fake(document.body as unknown as HTMLElement);
  const trigger = findByTestId(topbar, menuId);
  trigger?.click();
  if (!findByTestId(body, popupId)) trigger?.click();
  return findByTestId(body, popupId);
}

beforeEach(() => {
  previousWindow = globalThis.window;
  restoreDom = installFakeDom();
  installBrowserGlobals();
  store.replace(createBlankProject());
  editorState.set({ currentMapId: store.getCurrent().startMapId, layer: "lower", tool: "paint", selectedEventId: null });
  for (const mock of Object.values(mocks)) mock.mockClear();
});

afterEach(async () => {
  await new Promise<void>((resolve) => { globalThis.setTimeout(resolve, 0); });
  for (const handle of pendingTimers) globalThis.clearTimeout(handle);
  pendingTimers = [];
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: previousWindow });
  resetEditorUiModeForTests("standard");
  vi.restoreAllMocks();
});

describe("스튜디오 바 — 한 줄, 집 하나", () => {
  for (const mode of ["standard", "expert"] as const) {
    it(`${mode}: 클래식 툴바 행·게임 메뉴·작업 칩·툴바 접기가 없다`, () => {
      // Break: 복제 표면이 되살아난다.
      const topbar = render(mode);
      for (const gone of [
        "oprn-toolbar", "oprn-toolbar-row-edit", "toolbar-new", "toolbar-map-copy", "toolbar-event-test",
        "toolbar-battle-test", "toolbar-reload-db", "toolbar-load", "toolbar-import", "toolbar-help", "toolbar-overflow-toggle",
        "menu-game", "authoring-task-launcher", "authoring-task-map", "authoring-task-event", "authoring-task-data", "authoring-task-test",
        "window-toolbar-collapse",
      ]) {
        expect(findByTestId(topbar, gone), gone).toBeNull();
      }
    });

    it(`${mode}: 동작마다 testid 는 톱바+팝업 전체에서 한 번씩만 나온다`, () => {
      // Break: 같은 동작이 두 자리에 놓여 testid 가 겹친다(예: 테스트 실행 네 자리).
      const topbar = render(mode);
      for (const menuId of ["menu-project", "menu-tools", "menu-help"]) {
        if (findByTestId(topbar, menuId)) openMenu(topbar, menuId);
      }
      const ids = allTestIds(topbar).filter((id) => !id.startsWith("menu-popup-"));
      const dupes = ids.filter((id, index) => ids.indexOf(id) !== index);
      expect(dupes, `중복 testid: ${dupes.join(", ")}`).toEqual([]);
    });
  }

  it("프로젝트 메뉴의 얼굴은 프로젝트 이름이고, 이름이 없으면 「제목 없는 프로젝트」다", () => {
    // Break: 톱바가 다시 「프로젝트」라는 메뉴 이름만 보여 어느 프로젝트인지 말하지 않는다.
    const project = store.getCurrent();
    store.replace({ ...project, meta: { ...project.meta, title: "달빛 항구" } });
    let topbar = render("standard");
    const button = findByTestId(topbar, "menu-project");
    expect(button?.textContent).toContain("달빛 항구");
    expect(button?.getAttribute("title")).toBe("프로젝트 — 달빛 항구");

    store.replace({ ...project, meta: { ...project.meta, title: "   " } });
    expect(projectMenuLabel()).toBe("제목 없는 프로젝트");
    topbar = render("standard");
    expect(findByTestId(topbar, "menu-project")?.textContent).toContain("제목 없는 프로젝트");
  });

  it("프로젝트 메뉴에 저장 항목은 없고, 새 프로젝트·열기·저장본·가져오기·내보내기 3종이 있다", () => {
    // Break: 저장이 버튼과 메뉴 항목 두 자리에 놓인다.
    const topbar = render("standard");
    const popup = openMenu(topbar, "menu-project");
    const ids = (popup?.children ?? []).map((child) => child.dataset.testid ?? "").filter(Boolean);
    expect(ids).toEqual([
      "menu-project-new", "menu-project-load", "menu-project-reload-db",
      "menu-project-samples",
      "menu-project-import", "menu-project-export", "menu-project-export-web", "menu-project-export-standalone",
    ]);
    expect(ids).not.toContain("menu-project-save");
  });

  it("새 프로젝트 항목이 이름·장르를 묻고 새 원격 프로젝트를 만든다", async () => {
    // Break: 클래식 툴바의 toolbar-new 와 함께 새 프로젝트 동작 자체가 사라진다.
    // 장르를 고르면 genrePacks.ts 정본 씨앗이 loadNewRemoteProject 로 전달된다.
    const loadNew = vi.spyOn(store, "loadNewRemoteProject").mockResolvedValue({ projectId: "rpg-zzu-test" });
    mocks.showNewProjectDialog.mockResolvedValueOnce({ title: "달빛 항구", packId: "monster-collect" as const });
    const topbar = render("expert");
    openMenu(topbar, "menu-project");
    findByTestId(fake(document.body as unknown as HTMLElement), "menu-project-new")?.click();
    await vi.waitFor(() => expect(loadNew).toHaveBeenCalledTimes(1));
    expect(loadNew.mock.calls[0]?.[1]).toMatchObject({ title: "달빛 항구" });
    expect(loadNew.mock.calls[0]?.[0]?.system.genre).toBe("monster-collect");
  });

  it("프리셋으로 만들면 장르 프롬프트를 AI 조수에 바로 자동 전송한다", async () => {
    // Break: 프리셋 선택이 씨앗 system.* 토글에서 끝나고 AI 전송이 빠져,
    // 빈 맵만 남고 콘텐츠 저작이 시작되지 않는다.
    const loadNew = vi.spyOn(store, "loadNewRemoteProject").mockResolvedValue({ projectId: "rpg-zzu-test" });
    mocks.showNewProjectDialog.mockResolvedValueOnce({ title: "달빛 항구", packId: "monster-collect" });
    const topbar = render("expert");
    openMenu(topbar, "menu-project");
    findByTestId(fake(document.body as unknown as HTMLElement), "menu-project-new")?.click();
    await vi.waitFor(() => expect(loadNew).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(mocks.sendAiBootIntent).toHaveBeenCalledTimes(1));
    const prompt = String(mocks.sendAiBootIntent.mock.calls[0]?.[0] ?? "");
    expect(prompt).toContain("몬스터 수집");
    expect(mocks.setPendingAiBootIntent).not.toHaveBeenCalled();
  });

  it("AI 패널이 아직 없으면 보류 의도로 남기고 적용을 시도한다", async () => {
    // Break: send 실패 시 조용히 끝나 웰컴 경로와 달리 프롬프트가 증발한다.
    const loadNew = vi.spyOn(store, "loadNewRemoteProject").mockResolvedValue({ projectId: "rpg-zzu-test" });
    mocks.showNewProjectDialog.mockResolvedValueOnce({ title: "달빛 항구", packId: "farm-life" });
    mocks.sendAiBootIntent.mockReturnValueOnce(false);
    const topbar = render("expert");
    openMenu(topbar, "menu-project");
    findByTestId(fake(document.body as unknown as HTMLElement), "menu-project-new")?.click();
    await vi.waitFor(() => expect(loadNew).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(mocks.setPendingAiBootIntent).toHaveBeenCalledTimes(1));
    expect(mocks.setPendingAiBootIntent.mock.calls[0]?.[1]).toMatchObject({ autoSend: true });
    expect(mocks.applyPendingAiBootIntent).toHaveBeenCalledTimes(1);
  });

  it("빈 프로젝트는 AI 조수를 건드리지 않는다", async () => {
    // Break: 빈 맵 시작에도 AI 전송이 붙어 원치 않는 초안이 생긴다.
    const loadNew = vi.spyOn(store, "loadNewRemoteProject").mockResolvedValue({ projectId: "rpg-zzu-test" });
    mocks.showNewProjectDialog.mockResolvedValueOnce({ title: "빈 맵", packId: null });
    const topbar = render("expert");
    openMenu(topbar, "menu-project");
    findByTestId(fake(document.body as unknown as HTMLElement), "menu-project-new")?.click();
    await vi.waitFor(() => expect(loadNew).toHaveBeenCalledTimes(1));
    await new Promise<void>((resolve) => { globalThis.setTimeout(resolve, 0); });
    expect(mocks.sendAiBootIntent).not.toHaveBeenCalled();
    expect(mocks.setPendingAiBootIntent).not.toHaveBeenCalled();
  });

  it("저장 버튼: title 은 정확히 「프로젝트 저장 (Ctrl+S)」, 누르면 saveProjectNow, 점은 autosave 상태를 따른다", () => {
    // Break: e2e 계약(title)이 깨지거나, 점이 상태를 안 따라가 늘 회색으로 남는다.
    let listener: ((state: AutoSaveState) => void) | null = null;
    vi.spyOn(store, "getAutoSaveState").mockReturnValue({ kind: "idle" });
    vi.spyOn(store, "subscribeAutoSave").mockImplementation((fn) => { listener = fn; return () => { listener = null; }; });
    const topbar = render("standard");
    const save = findByTestId(topbar, "toolbar-save");
    expect(save).not.toBeNull();
    expect(save?.getAttribute("title")).toBe("프로젝트 저장 (Ctrl+S)");
    expect(save?.dataset.autosaveKind).toBe("idle");

    save?.click();
    expect(mocks.saveProjectNow).toHaveBeenCalledTimes(1);

    listener?.({ kind: "saving" });
    expect(save?.dataset.autosaveKind).toBe("saving");
    listener?.({ kind: "saved", at: new Date(2026, 8, 3, 9, 7).getTime() });
    expect(save?.dataset.autosaveKind).toBe("saved");
    expect(findByTestId(topbar, "toolbar-save-autosave")?.textContent).toBe("자동 저장됨 09:07");
    listener?.({ kind: "error", message: "network", retryCount: 1 });
    expect(save?.dataset.autosaveKind).toBe("error");
    expect(autosaveStatusText({ kind: "pending" })).toBe("저장 중");
  });

  it("자료집·소재 버튼은 표준·전문가에서 모달을 열고, 초보에는 없다", () => {
    // Break: 자료집 버튼이 초보 레일 옆에도 생기거나, 표준에서 사라져 도구 메뉴 두 번 클릭만 남는다.
    for (const mode of ["standard", "expert"] as const) {
      const topbar = render(mode);
      findByTestId(topbar, "toolbar-database")?.click();
      findByTestId(topbar, "toolbar-resource-manager")?.click();
    }
    expect(mocks.openDatabaseModal).toHaveBeenCalledTimes(2);
    expect(mocks.openResourceModal).toHaveBeenCalledTimes(2);
    const beginner = render("beginner");
    expect(findByTestId(beginner, "toolbar-database")).toBeNull();
    expect(findByTestId(beginner, "toolbar-resource-manager")).toBeNull();
  });

  it("전문가: 세계관·음악·찾기 인라인 버튼이 각 창을 연다", () => {
    // Break: 전문가 인라인 버튼이 장식으로만 남는다(눌러도 아무 일 없음).
    const topbar = render("expert");
    findByTestId(topbar, "toolbar-world")?.click();
    findByTestId(topbar, "toolbar-sound-test")?.click();
    findByTestId(topbar, "toolbar-search")?.click();
    expect(mocks.openWorldPanel).toHaveBeenCalledTimes(1);
    expect(mocks.openAudioTestDialog).toHaveBeenCalledTimes(1);
    expect(mocks.openMapEventSearchModal).toHaveBeenCalledTimes(1);
  });

  it("표준: 도구 메뉴 항목이 각 창을 열고 AI 설정 항목은 없다(⚙ 버튼이 집)", () => {
    const topbar = render("standard");
    const popup = openMenu(topbar, "menu-tools");
    const ids = (popup?.children ?? []).map((child) => child.dataset.testid ?? "").filter(Boolean);
    expect(ids).toEqual(["menu-tools-world", "menu-tools-audio", "menu-tools-search"]);
    findByTestId(fake(document.body as unknown as HTMLElement), "menu-tools-audio")?.click();
    expect(mocks.openAudioTestDialog).toHaveBeenCalledTimes(1);
    findByTestId(topbar, "topbar-ai-settings")?.click();
    expect(mocks.openAiSettingsModal).toHaveBeenCalledTimes(1);
  });

  it("오른쪽 묶음: ▶ 테스트와 ⚔ 가 한 실행 그룹, 도움말은 아이콘 메뉴, 전체화면은 남는다", () => {
    const topbar = render("standard");
    const group = findByTestId(topbar, "studio-run-group");
    expect(group).not.toBeNull();
    expect(findByTestId(group as unknown as FakeElement, "mode-play")).not.toBeNull();
    expect(findByTestId(group as unknown as FakeElement, "topbar-battle-test")).not.toBeNull();
    const help = findByTestId(topbar, "menu-help");
    expect(help?.getAttribute("aria-label")).toBe("도움말");
    expect(help?.textContent).toContain("도움말");
    const popup = openMenu(topbar, "menu-help");
    expect((popup?.children ?? []).map((child) => child.dataset.testid)).toEqual(["menu-help-shortcuts", "menu-help-about"]);
    expect(findByTestId(topbar, "window-fullscreen")).not.toBeNull();
  });
});
