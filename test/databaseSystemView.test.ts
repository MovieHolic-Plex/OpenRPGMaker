import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getMapEditHistoryState, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { renderSystemTab } from "@/editor/panels/databaseSystemView";
import { createBlankProject, createSampleAdventureProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

function renderSystem(): FakeElement {
  const host = document.createElement("div") as unknown as FakeElement;
  const rerender = (): void => {
    host.replaceChildren();
    renderSystemTab(host as unknown as HTMLElement, rerender);
  };
  rerender();
  return host;
}

function setSelectValue(host: FakeElement, testid: string, value: string): void {
  const select = findByTestId(host, testid);
  if (!select) throw new Error(`missing select ${testid}`);
  select.value = value;
  select.dispatchEvent(new Event("change"));
}

function setCheckbox(host: FakeElement, testid: string, checked: boolean): void {
  const input = findByTestId(host, testid) as { checked?: boolean } | null;
  if (!input) throw new Error(`missing checkbox ${testid}`);
  input.checked = checked;
  (input as FakeElement).dispatchEvent(new Event("change"));
}

describe("database system view", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installFakeDom();
    store.replace(createBlankProject());
    resetMapEditHistory();
  });

  afterEach(() => {
    cleanupDom?.();
    cleanupDom = undefined;
  });

  it("preserves multi-member start party when editing one slot", () => {
    const sample = createSampleAdventureProject();
    const actorIds = sample.database.actors.map((actor) => actor.id).filter(Boolean);
    if (actorIds.length < 2) throw new Error("need at least two actors in sample database");
    sample.system = { ...sample.system, startActorIds: actorIds.slice(0, 2) };
    sample.session = { ...sample.session, partyActorIds: actorIds.slice(0, 2) };
    store.replace(sample);
    const before = [...store.getCurrent().system.startActorIds];
    expect(before.length).toBeGreaterThan(1);

    const host = renderSystem();
    const actors = store.getCurrent().database.actors;
    const replacement = actors.find((actor) => actor.id !== before[0])?.id;
    if (!replacement) throw new Error("need a second actor");

    setSelectValue(host, "db-picker-system-start-actor", replacement);

    const after = store.getCurrent().system.startActorIds;
    expect(after[0]).toBe(replacement);
    expect(after.slice(1)).toEqual(before.slice(1));
    expect(store.getCurrent().session.partyActorIds).toEqual(after);
  });

  it("rebuilds type chart matrix when the type list changes", () => {
    store.update((draft) => {
      delete draft.system.typeChart;
    });
    const host = renderSystem();
    expect(findByTestId(host, "db-type-chart-matrix")).toBeNull();

    const types = findByTestId(host, "db-field-system-type-chart-types");
    if (!types) throw new Error("missing type chart input");
    types.value = "fire, water";
    types.dispatchEvent(new Event("change"));

    expect(store.getCurrent().system.typeChart?.types).toEqual(["fire", "water"]);
    expect(findByTestId(host, "db-type-chart-matrix")).not.toBeNull();
    expect(findByTestId(host, "db-type-chart-fire-water")).not.toBeNull();
  });

  it("writes battle flow, gift system, and time system gates", () => {
    const host = renderSystem();

    setSelectValue(host, "db-field-system-battle-flow", "strict");
    setCheckbox(host, "db-field-system-gift-system", true);
    setCheckbox(host, "db-field-system-time-enabled", true);

    const system = store.getCurrent().system;
    expect(system.battleFlow).toBe("strict");
    expect(system.giftSystem).toBe(true);
    expect(system.timeSystem?.enabled).toBe(true);
    expect(findByTestId(host, "db-field-system-time-day-start")).not.toBeNull();
  });

  it("edits the project play resolution from the display section", () => {
    // Break named: the System database view has no project-resolution controls.
    const host = renderSystem();
    const preset = findByTestId(host, "db-field-system-resolution-preset");
    if (!preset) throw new Error("missing play-resolution preset");

    preset.value = "640x360";
    preset.dispatchEvent(new Event("change"));

    expect(store.getCurrent().system.playResolution).toEqual({ width: 640, height: 360 });
    expect(findByTestId(host, "db-field-system-resolution-width")?.value).toBe("640");
    expect(findByTestId(host, "db-field-system-resolution-height")?.value).toBe("360");
    expect(findByTestId(host, "db-system-nav-display")).not.toBeNull();
  });

  // Break caught: authored calendars always used the hidden 28-day default.
  it("edits the season length while preserving the existing start and end clock", () => {
    const host = renderSystem();
    setCheckbox(host, "db-field-system-time-enabled", true);
    const days = findByTestId(host, "db-field-system-time-days-per-season");
    if (!days) throw new Error("missing days-per-season field");
    days.value = "14";
    days.dispatchEvent(new Event("change"));

    expect(store.getCurrent().system.timeSystem).toMatchObject({
      daysPerSeason: 14,
      dayStartHour: 6,
      dayEndHour: 26,
    });
  });

  it("shows map compatibility and tile-grid diagnostics for a custom resolution", () => {
    // Break named: authors can choose 640x360 without seeing its half-tile edge or undersized maps.
    store.update((draft) => {
      draft.system.playResolution = { width: 640, height: 360 };
    });

    const host = renderSystem();
    const diagnostics = findByTestId(host, "db-system-resolution-diagnostics");

    expect(diagnostics?.dataset.minMapWidth).toBe("40");
    expect(diagnostics?.dataset.minMapHeight).toBe("23");
    expect(diagnostics?.dataset.partialTileX).toBe("false");
    expect(diagnostics?.dataset.partialTileY).toBe("true");
    expect(diagnostics?.dataset.incompatibleMapCount).toBe("1");
  });

  it("keeps a non-preset custom resolution editable", () => {
    // Characterization: advanced custom values remain available alongside the recommended presets.
    store.update((draft) => {
      draft.system.playResolution = { width: 633, height: 355 };
    });

    const host = renderSystem();

    expect(findByTestId(host, "db-field-system-resolution-preset")?.value).toBe("custom");
    expect(findByTestId(host, "db-field-system-resolution-width")?.value).toBe("633");
    expect(findByTestId(host, "db-field-system-resolution-height")?.value).toBe("355");
  });

  it("previews the title screen at the authored play aspect ratio", () => {
    // Break named: the title workbench stays at its fixed editor shape after resolution changes.
    store.update((draft) => {
      draft.system.playResolution = { width: 640, height: 360 };
    });

    const host = renderSystem();
    const stage = findByTestId(host, "db-title-workbench-stage");

    expect(stage?.style.aspectRatio).toBe("16 / 9");
    expect(stage?.dataset.playResolution).toBe("640x360");
  });

  it("edits title screen fields into system.titleScreen", () => {
    const host = renderSystem();
    const title = findByTestId(host, "db-field-title-screen-title");
    if (!title) throw new Error("missing title field");
    title.value = "테스트 타이틀";
    title.dispatchEvent(new Event("input"));

    expect(store.getCurrent().system.titleScreen?.title).toBe("테스트 타이틀");
  });

  // fix(db): 이 뷰의 직행 store.update 19곳(+ 시스템 뷰 전체)이 undo 스냅샷을 안 남겨
  // 같은 모달 안에서 어떤 편집은 Ctrl+Z가 되고 어떤 건 안 됐다. battleFlow(이산 선택)로
  // 대표 검증한다 — 시스템 뷰의 모든 필드가 updateSystem()을 거치므로 이 경로 하나가
  // 전체 뷰의 undo 배선을 검증한다.
  it("records an undo snapshot when battleFlow changes, and undo restores the previous value", () => {
    expect(getMapEditHistoryState().canUndo).toBe(false);
    const host = renderSystem();
    const before = store.getCurrent().system.battleFlow;

    setSelectValue(host, "db-field-system-battle-flow", "strict");

    expect(store.getCurrent().system.battleFlow).toBe("strict");
    expect(getMapEditHistoryState().canUndo).toBe(true);

    const undone = undoMapEdit();

    expect(undone).toBe(true);
    expect(store.getCurrent().system.battleFlow).toBe(before);
  });

  it("renders title workbench preview and accepts musicResourceId", () => {
    const host = renderSystem();
    expect(findByTestId(host, "db-title-workbench")).not.toBeNull();
    expect(findByTestId(host, "db-title-workbench-preview")).not.toBeNull();
    expect(findByTestId(host, "db-title-workbench-stage")).not.toBeNull();
    expect(findByTestId(host, "db-field-title-screen-music")).not.toBeNull();
    expect(findByTestId(host, "db-title-bgm-play")).not.toBeNull();
    expect(findByTestId(host, "db-title-bgm-stop")).not.toBeNull();

    const music = findByTestId(host, "db-field-title-screen-music") as { value?: string } | null;
    if (!music) throw new Error("missing music field");
    music.value = "easyrpg-music-field-1";
    (music as FakeElement).dispatchEvent(new Event("change"));

    expect(store.getCurrent().system.titleScreen?.musicResourceId).toBe("easyrpg-music-field-1");
    const label = findByTestId(host, "db-title-workbench-music-id");
    expect(label?.textContent).toContain("easyrpg-music-field-1");
  })

  it("groups title workbench into display/audio/menu fieldsets", () => {
    const host = renderSystem();
    expect(findByTestId(host, "db-title-workbench-display")).not.toBeNull();
    expect(findByTestId(host, "db-title-workbench-audio")).not.toBeNull();
    expect(findByTestId(host, "db-title-workbench-menu")).not.toBeNull();
    expect(findByTestId(host, "db-field-title-screen-presentation")).not.toBeNull();
    expect(findByTestId(host, "db-field-title-screen-se-cursor")).not.toBeNull();
    expect(findByTestId(host, "db-field-title-screen-visible-new-game")).not.toBeNull();
  });

  it("background resource change does not clear system.titleResourceId", () => {
    store.update((draft) => {
      draft.system.titleResourceId = "easyrpg-title-title2";
      draft.system.titleScreen ??= {
        title: "bg test",
        layout: { titleX: 160, titleY: 70, menuX: 160, menuY: 118 },
        menuLabels: { newGame: "새 게임", continueGame: "계속", quit: "종료" },
        menuVisibility: { newGame: true, continueGame: true, quit: true },
        backgroundResourceId: "oprn-title-field",
      };
    });
    const host = renderSystem();
    const background = findByTestId(host, "db-field-title-screen-background") as { value?: string } | null;
    if (!background) throw new Error("missing background field");
    background.value = "easyrpg-title-title1";
    (background as FakeElement).dispatchEvent(new Event("change"));

    expect(store.getCurrent().system.titleScreen?.backgroundResourceId).toBe("easyrpg-title-title1");
    expect(store.getCurrent().system.titleResourceId).toBe("easyrpg-title-title2");
  });

  it("locks new-game visibility checked+disabled and hides continue from preview", () => {
    const host = renderSystem();
    const locked = findByTestId(host, "db-field-title-screen-visible-new-game") as { checked?: boolean; disabled?: boolean } | null;
    if (!locked) throw new Error("missing new-game visibility checkbox");
    expect(locked.checked).toBe(true);
    expect(locked.disabled).toBe(true);

    setCheckbox(host, "db-field-title-screen-visible-continue", false);
    expect(store.getCurrent().system.titleScreen?.menuVisibility).toEqual({
      newGame: true,
      continueGame: false,
      quit: true,
    });

    const menuPreview = findByTestId(host, "db-title-workbench-menu-preview");
    if (!menuPreview) throw new Error("missing menu preview");
    expect(menuPreview.textContent).toContain("새 게임");
    expect(menuPreview.textContent).toContain("종료");
    // continueGame 의 기본 라벨은 "불러오기"다("이어하기"는 오토세이브 재개 쪽 라벨).
    expect(menuPreview.textContent).not.toContain("불러오기");
    expect(menuPreview.childNodes).toHaveLength(2);
  });

  it("shows logo fields when presentation is graphic and previews logo", () => {
    const host = renderSystem();
    expect(store.getCurrent().system.titleScreen?.titleGraphic?.mode).toBe("text");
    expect(findByTestId(host, "db-field-title-screen-logo")).toBeNull();

    setSelectValue(host, "db-field-title-screen-presentation", "graphic");
    expect(store.getCurrent().system.titleScreen?.titleGraphic?.mode).toBe("graphic");
    expect(findByTestId(host, "db-field-title-screen-logo")).not.toBeNull();

    const logo = findByTestId(host, "db-field-title-screen-logo") as { value?: string } | null;
    if (!logo) throw new Error("missing logo field");
    logo.value = "easyrpg-title-title1";
    (logo as FakeElement).dispatchEvent(new Event("change"));
    expect(store.getCurrent().system.titleScreen?.titleGraphic?.resourceId).toBe("easyrpg-title-title1");
    expect(findByTestId(host, "db-title-workbench-logo")).not.toBeNull();
  });
;
});
