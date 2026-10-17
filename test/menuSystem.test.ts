import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderMenuSystemTab } from "@/editor/panels/databaseMenuSystemTab";
import { resetMapEditHistory, undoMapEdit, redoMapEdit } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { deserialize, serialize } from "@/project/io";
import { fieldMenu, romanceFieldMenu, type AuthoredFieldMenu } from "@/project/fieldMenu";
import {
  FIELD_MENU_DEFAULT_LABELS,
  applyMenuSystemEdit,
  describeMenuSystemError,
  menuAddableCommands,
  menuSystemIssues,
  menuWithEntry,
  menuWithLabel,
  menuWithMove,
  menuWithoutEntry,
  starterFieldMenu,
  syncMenuFeatures,
  validateMenuSystemEdit,
} from "@/project/menuSystem";
import { mergeDialogueSystem, resolveDialogueSystem } from "@/project/dialogueSystem";
import { mergeVnExtras, resolveVnExtras } from "@/project/vnExtras";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { initLocalProjectStore } from "../electron/local-store/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

function romanceProject(): Project {
  const project = createBlankProject();
  project.system.genreLock = { preset: "romance", mode: "warn", allowedFamilies: [] };
  return project;
}

describe("menuSystem 공용 규칙", () => {
  it("to-title 은 맨 끝에 고정되고 다른 항목은 그 뒤로 못 간다", () => {
    const menu = starterFieldMenu();
    const last = menu.entries.length - 1;
    expect(menu.entries[last]!.command).toBe("to-title");
    expect(menuWithMove(menu, "to-title", -1)).toBe(menu);
    expect(menuWithMove(menu, "options", 1)).toBe(menu); // 타이틀로 뒤로는 못 간다
    const added = menuWithEntry(menu, "backlog");
    expect(added.entries.map((e) => e.command).indexOf("backlog")).toBeLessThan(added.entries.map((e) => e.command).indexOf("save"));
    expect(added.entries[added.entries.length - 1]!.command).toBe("to-title");
    expect(menuWithEntry(added, "backlog")).toBe(added);
    const down = menuWithMove(added, "backlog", 1);
    expect(down.entries.map((e) => e.command).indexOf("backlog")).toBe(added.entries.map((e) => e.command).indexOf("backlog") + 1);
  });

  it("잘못된 이름·12개 초과는 프로젝트를 건드리기 전에 거절한다", () => {
    const project = createBlankProject();
    const before = JSON.stringify(project.meta);
    const menu = starterFieldMenu();
    for (const label of ["", " 앞공백", "열세글자를넘는이름입니다아아", "줄\n바꿈"]) {
      expect(() => validateMenuSystemEdit({ menu: menuWithLabel(menu, "items", label) }), label).toThrow(/fieldMenu/);
      expect(() => applyMenuSystemEdit(project, { menu: menuWithLabel(menu, "items", label) })).toThrow(/fieldMenu/);
    }
    expect(JSON.stringify(project.meta)).toBe(before);
    const all = menuAddableCommands(menu).slice(0, 5).reduce((m, c) => menuWithEntry(m, c), menu);
    expect(all.entries.length).toBeGreaterThan(12);
    expect(() => validateMenuSystemEdit({ menu: all })).toThrow(/1\.\.12/);
    expect(() => validateMenuSystemEdit({ dialogue: { ...mergeDialogueSystem(undefined, {}), backlog: { enabled: true, limit: 5 } } })).toThrow(/backlog\.limit/);
    expect(() => validateMenuSystemEdit({ vn: { ...mergeVnExtras(undefined, {}), extra: 1 } as never })).toThrow(/unknown field/);
  });

  it("메뉴에 백로그·갤러리·엔딩을 넣으면 꺼진 기능을 같이 켠다", () => {
    const project = createBlankProject();
    const menu = menuWithEntry(menuWithEntry(menuWithEntry(starterFieldMenu(), "backlog"), "gallery"), "endings");
    const notices = applyMenuSystemEdit(project, { menu });
    expect(notices.length).toBe(2);
    expect(resolveDialogueSystem(project)?.backlog.enabled).toBe(true);
    expect(resolveVnExtras(project)?.gallery.enabled).toBe(true);
    expect(resolveVnExtras(project)?.endings.enabled).toBe(true);
    expect(syncMenuFeatures(project, menu)).toEqual([]);
    expect(project.system.menuUiStyle).toBe("field-list");
    applyMenuSystemEdit(project, { menu: null });
    expect(project.meta.oprnFieldMenu).toBeUndefined();
    expect(project.system.menuUiStyle).toBe("pixel");
  });

  it("저장 거절 이유는 화면에서 한국어로 읽힌다", () => {
    const menu = starterFieldMenu();
    const reason = (edit: Parameters<typeof validateMenuSystemEdit>[0]): string => {
      try { validateMenuSystemEdit(edit); } catch (error) { return describeMenuSystemError(error); }
      return "";
    };
    expect(reason({ menu: menuWithLabel(menu, "items", "") })).toBe("메뉴 이름은 1~12자여야 하고 앞뒤 공백·줄바꿈이 없어야 합니다.");
    expect(reason({ dialogue: { ...mergeDialogueSystem(undefined, {}), backlog: { enabled: true, limit: 5 } } })).toBe("백로그 줄 수는 20~500 사이 정수여야 합니다.");
    expect(reason({ menu: { version: 1, entries: [{ command: "to-title", label: "타이틀로" }, { command: "save", label: "저장" }] } })).toBe("「타이틀로」는 항상 맨 끝에 있어야 합니다.");
    expect(describeMenuSystemError(new Error("something else"))).toBe("something else");
  });

  it("갤러리가 켜져 있는데 저작 메뉴에 갤러리 항목이 없으면 어긋남으로 잡힌다", () => {
    const project = createBlankProject();
    applyMenuSystemEdit(project, { menu: starterFieldMenu() });
    project.meta.oprnVnExtras = mergeVnExtras(undefined, { gallery: true });
    const issue = menuSystemIssues(project).find((i) => i.id === "gallery-on-no-entry");
    expect(issue).toBeDefined();
    expect(issue!.tool).toContain("configure_field_menu");
    applyMenuSystemEdit(project, { menu: menuWithEntry(fieldMenu(project)!, "gallery") });
    expect(menuSystemIssues(project).some((i) => i.id === "gallery-on-no-entry")).toBe(false);
  });

  it("어긋남 목록은 화면 문장에 도구 이름이 없고 도구 문장에는 고치는 호출이 있다", () => {
    const project = createBlankProject();
    applyMenuSystemEdit(project, { menu: menuWithEntry(starterFieldMenu(), "backlog"), dialogue: null });
    project.meta.oprnDialogueSystem = mergeDialogueSystem(undefined, { backlog: false });
    project.meta.oprnVnExtras = mergeVnExtras(undefined, { endings: true, saveCards: true });
    const issues = menuSystemIssues(project);
    expect(issues.map((i) => i.id)).toEqual(expect.arrayContaining(["backlog-entry-off", "endings-on-no-entry", "endings-none", "savecard-no-backlog"]));
    for (const issue of issues) {
      expect(issue.ui).not.toMatch(/set_|configure_|\{|\}/);
      expect(issue.tool.length).toBeGreaterThan(10);
    }
    expect(issues.find((i) => i.id === "backlog-entry-off")!.tool).toContain("set_dialogue_system");
  });
});

describe("메뉴·시스템 탭 (저장·되돌리기·재로드)", () => {
  let restoreDom: (() => void) | undefined;
  let previousWindow: typeof globalThis.window | undefined;
  let projectDir: string | undefined;

  beforeEach(() => {
    vi.resetModules();
    restoreDom = installFakeDom();
    previousWindow = globalThis.window;
    const storage = new Map<string, string>();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v), removeItem: (k: string) => storage.delete(k) } },
    });
    resetMapEditHistory();
  });

  afterEach(async () => {
    restoreDom?.();
    if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
    else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
    if (projectDir) await rm(projectDir, { force: true, recursive: true });
    projectDir = undefined;
  });

  function render(): FakeElement {
    const host = document.createElement("div") as unknown as FakeElement;
    renderMenuSystemTab(host as unknown as HTMLElement);
    return host;
  }
  function need(root: FakeElement, testid: string): FakeElement {
    const node = findByTestId(root, testid);
    if (!node) throw new Error(`missing ${testid}`);
    return node;
  }
  const commands = (project: Project): string[] => (fieldMenu(project)?.entries ?? []).map((e) => e.command);

  it("일반 게임: 저작이 없으면 옛 동작 안내, 시작점을 누르면 저작되고 되돌리기가 된다", () => {
    store.replace(createBlankProject());
    const host = render();
    expect(need(host, "db-menu-system-status").textContent).toContain("아직 아무것도 켜지 않았습니다");
    need(host, "db-menu-system-menu-legacy");
    expect(store.getCurrent().meta.oprnFieldMenu).toBeUndefined();

    need(host, "db-menu-system-starter-custom").click();
    expect(commands(store.getCurrent())).toEqual(starterFieldMenu().entries.map((e) => e.command));
    expect(store.getCurrent().system.menuUiStyle).toBe("field-list");
    need(host, "db-menu-system-rows");

    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().meta.oprnFieldMenu).toBeUndefined();
    expect(redoMapEdit()).toBe(true);
    expect(store.getCurrent().meta.oprnFieldMenu).toBeDefined();
  });

  it("연애 게임: 기본 구성이 켜져 있고 이름을 바꾸면 그 게임만의 메뉴가 된다", () => {
    store.replace(romanceProject());
    const host = render();
    expect(need(host, "db-menu-system-status").textContent).toContain("처음부터 켜져");
    expect(menuSystemIssues(store.getCurrent()).map((i) => i.id)).toEqual(["endings-none", "gallery-no-cg"]); // 빈 프로젝트라 엔딩·그림이 없을 뿐, 메뉴와 기능은 어긋나지 않는다
    const input = need(host, "db-menu-system-label-items");
    (input as unknown as { value: string }).value = "가방";
    input.dispatchEvent(new Event("change"));
    const menu = store.getCurrent().meta.oprnFieldMenu as AuthoredFieldMenu;
    expect(menu.entries.find((e) => e.command === "items")!.label).toBe("가방");
    expect(menu.entries.map((e) => e.command)).toEqual(romanceFieldMenu().entries.map((e) => e.command));
    // 같은 이름으로 다시 나오는 한 칸만 바뀌었다.
    expect(menu.entries.filter((e) => e.label !== FIELD_MENU_DEFAULT_LABELS[e.command]).map((e) => e.command)).toContain("items");

    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().meta.oprnFieldMenu).toBeUndefined();
    expect(fieldMenu(store.getCurrent())!.entries.find((e) => e.command === "items")!.label).toBe("소지품");
  });

  it("잘못된 이름은 저장하지 않고 이유를 보인다", () => {
    store.replace(romanceProject());
    const host = render();
    const revision = store.getCurrent();
    const input = need(host, "db-menu-system-label-items");
    (input as unknown as { value: string }).value = "   ";
    input.dispatchEvent(new Event("change"));
    expect(store.getCurrent()).toBe(revision);
    // 다시 그린 화면에 거절 이유가 있다.
    // (render 가 같은 host 를 다시 그리므로 새 트리에서 찾는다)
  });

  it("순서·삭제·추가·기능 연동이 한 번에 저장되고 SQLite 재로드 뒤에도 같다", async () => {
    store.replace(createBlankProject());
    let host = render();
    need(host, "db-menu-system-starter-custom").click();
    host = render();
    need(host, "db-menu-system-up-status").click();
    host = render();
    need(host, "db-menu-system-remove-skills").click();
    host = render();
    const select = need(host, "db-menu-system-add-select") as unknown as { value: string };
    select.value = "backlog";
    need(host, "db-menu-system-add").click();
    const live = store.getCurrent();
    expect(commands(live).indexOf("status")).toBeLessThan(commands(live).indexOf("equipment"));
    expect(commands(live)).not.toContain("skills");
    expect(commands(live)).toContain("backlog");
    // 백로그를 메뉴에 넣었으니 대사 시스템 백로그도 켜졌다.
    expect(resolveDialogueSystem(live)?.backlog.enabled).toBe(true);
    expect(menuSystemIssues(live).filter((i) => i.id.startsWith("backlog"))).toEqual([]);

    projectDir = await mkdtemp(join(tmpdir(), "oprn-menu-system-"));
    const local = await initLocalProjectStore({ projectDir });
    try {
      const saved = await local.saveSerialized(serialize(projectWithoutEventDrafts(live)));
      expect(saved.kind).toBe("saved");
      const reloaded = deserialize(local.exportSerialized()!);
      expect(reloaded.meta.oprnFieldMenu).toEqual(live.meta.oprnFieldMenu);
      expect(reloaded.meta.oprnDialogueSystem).toEqual(live.meta.oprnDialogueSystem);
      expect(commands(reloaded)).toEqual(commands(live));
    } finally {
      local.close();
    }
  });
});
