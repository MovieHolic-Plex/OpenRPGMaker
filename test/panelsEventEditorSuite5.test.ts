// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, afterEach, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { locationLayerState, setLocationLayerEnabled } from "@/editor/mapLocationLayerState";
import { validateEventDraftBody } from "@/editor/eventDraftValidator";
import { LOCATION_TRANSITION_TRIGGER_LABEL, locationTransitionSentence, locationTransitionTrigger, renderLocationTransitionTriggerFields } from "@/editor/locationTriggerAuthoring";
import { TRIGGER_OPTIONS } from "@/editor/panels/eventEditor/options";
import { renderEventPageProps } from "@/editor/panels/eventEditor/pageProps";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { addMapLocation, deleteMapLocation } from "@/project/mapNamedLocations";
import { store } from "@/project/store";
import type { EventPage, GameEvent, GameMap, Project, Trigger, Command, TroopRecord } from "@/project/types";
import { loopBody } from "@/editor/panels/eventEditor/commandBodyLoop";
import { installFakeDom } from "./fakeDom";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import { createBattleEventRuntime } from "@/battle/battleEvents";
import type { MutableBattler } from "@/battle/battleBattlers";
import { createBattleRuntime } from "@/battle/runtime";
import { isM2CatalogEntrySelectableInBattleEvent, m2CommandById } from "@/project/eventCommands/m2Catalog";
import { interpolateScreenFilter, NEUTRAL_SCREEN_FILTER, screenFilterCss, screenFilterFromFields } from "@/project/eventCommands/screenFilter";
import { startSession } from "@/project/session";
import { executeM2RuntimeCommand } from "@/player/interpreter/m2Runtime";
import { syncScreenEffects } from "@/player/playSceneScreenEffects";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import { mountBattleScene } from "@/player/battleDom";
import { syncBattleScreenFilter } from "@/player/battleScreenFilter";
import { renderM2CommandBody } from "@/editor/panels/eventEditor/commandBodyM2";
import { isolateTimers } from "./mergedTeardown";

// 「구역에 들어오면/나가면」 **저작 표면**: 이벤트 편집기에서 고를 수 있고, 구역을 **이름으로**
// 고르며(좌표 입력 금지), 삭제된 구역은 조건과 **같은** 진단·복구 통로를 탄다.
describe("locationTransitionAuthoring", () => {
  isolateTimers();
  const MAP_ID = "authoring_map";
  function seedProject(): { plazaId: string; dockId: string } {
    const project = createBlankProject();
    const map: GameMap = {
      id: MAP_ID,
      name: "저작 맵",
      width: 20,
      height: 20,
      tilesetId: "easyrpg_chipset_combined_town",
      tileSize: 16,
      lowerTiles: new Array(400).fill(TILE.GRASS),
      upperTiles: new Array(400).fill(TILE.EMPTY),
      events: [],
    };
    project.maps[MAP_ID] = map;
    project.startMapId = MAP_ID;
    const plaza = addMapLocation(map, { name: "정문 광장", x: 2, y: 2, w: 6, h: 6 });
    const dock = addMapLocation(map, { name: "부두", x: 12, y: 12, w: 4, h: 4 });
    if (!plaza.ok || !dock.ok) throw new Error("fixture");
    store.replace(project);
    editorState.set({ currentMapId: MAP_ID });
    return { plazaId: plaza.location.id, dockId: dock.location.id };
  }
  function page(trigger: Trigger): EventPage {
    return {
      id: "p1",
      name: "구역 반응",
      conditions: [],
      graphic: {},
      trigger,
      priority: "same",
      overlapForbidden: true,
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [{ kind: "text", body: "광장이다" }],
    };
  }
  function eventWithPage(trigger: Trigger): GameEvent {
    return { id: "ev_zone", x: 3, y: 3, trigger: { kind: "action" }, commands: [], pages: [page(trigger)] };
  }
  beforeEach(() => {
    document.body.replaceChildren();
  });
  describe("location transition trigger — 이벤트 편집기 선택 가능성", () => {
    it("「시작 방식」 선택기에 구역 드나듦 항목이 있다", () => {
      seedProject();
      const values = TRIGGER_OPTIONS.map((option) => option.value);
      expect(values).toContain("locationTransition");
      const option = TRIGGER_OPTIONS.find((entry) => entry.value === "locationTransition");
      expect(option?.label).toBe(LOCATION_TRANSITION_TRIGGER_LABEL);
    });

    it("페이지 속성이 구역 드나듦을 고르면 구역·시점 선택기를 함께 그린다", () => {
      const { plazaId } = seedProject();
      const authored = page({ kind: "locationTransition", locationId: plazaId, transition: "enter" });
      store.update((project) => {
        project.maps[MAP_ID]!.events = [{ id: "ev_zone", x: 3, y: 3, trigger: { kind: "action" }, commands: [], pages: [authored] }];
      }, { scope: "map", mapId: MAP_ID, label: "테스트 이벤트" });

      const host = renderEventPageProps(MAP_ID, "ev_zone", authored);
      document.body.append(host);

      const select = host.querySelector<HTMLSelectElement>("[data-testid='event-page-trigger-select']");
      expect(select?.value).toBe("locationTransition");
      const picker = host.querySelector<HTMLSelectElement>("[data-testid='event-page-trigger-location']");
      const side = host.querySelector<HTMLSelectElement>("[data-testid='event-page-trigger-location-transition']");
      expect(picker?.value).toBe(plazaId);
      expect(side?.value).toBe("enter");
    });

    it("다른 시작 방식이면 구역 선택기를 그리지 않는다", () => {
      seedProject();
      const authored = page({ kind: "action" });
      store.update((project) => {
        project.maps[MAP_ID]!.events = [{ id: "ev_zone", x: 3, y: 3, trigger: { kind: "action" }, commands: [], pages: [authored] }];
      }, { scope: "map", mapId: MAP_ID, label: "테스트 이벤트" });

      const host = renderEventPageProps(MAP_ID, "ev_zone", authored);
      expect(host.querySelector("[data-testid='event-page-trigger-location-fields']")).toBeNull();
    });
  });
  describe("location transition trigger — 구역은 이름으로 고른다 (좌표 입력 없음)", () => {
    it("선택기 항목이 현재 맵 구역의 **이름**이고, 값은 안정 ID 다", () => {
      const { plazaId, dockId } = seedProject();
      const fields = renderLocationTransitionTriggerFields(
        { kind: "locationTransition", locationId: plazaId, transition: "enter" },
        () => {},
      );
      const picker = fields.querySelector<HTMLSelectElement>("[data-testid='event-page-trigger-location']");
      const options = [...(picker?.options ?? [])].map((option) => ({ value: option.value, label: option.textContent ?? "" }));
      expect(options.map((option) => option.value)).toEqual([plazaId, dockId]);
      expect(options[0]?.label).toContain("정문 광장");
      expect(options[1]?.label).toContain("부두");
      // 좌표를 직접 적는 입력은 없다 — 사각형은 로케이션 레이어가 소유한다.
      expect(fields.querySelectorAll("input").length).toBe(0);
    });

    it("이름을 바꿔도 저작된 트리거는 같은 구역을 가리킨다 (ID 안정성)", () => {
      const { plazaId } = seedProject();
      store.update((project) => {
        const location = project.maps[MAP_ID]!.locations!.find((entry) => entry.id === plazaId)!;
        location.name = "중앙 광장";
      }, { scope: "map", mapId: MAP_ID, label: "로케이션 이름 변경" });

      const trigger = { kind: "locationTransition", locationId: plazaId, transition: "enter" } as const;
      expect(locationTransitionSentence(trigger)).toContain("중앙 광장");
      const fields = renderLocationTransitionTriggerFields(trigger, () => {});
      expect(fields.querySelector<HTMLSelectElement>("[data-testid='event-page-trigger-location']")?.value).toBe(plazaId);
    });

    it("선택을 바꾸면 구역과 시점이 한 트리거로 함께 나온다", () => {
      const { plazaId, dockId } = seedProject();
      const seen: Trigger[] = [];
      const fields = renderLocationTransitionTriggerFields(
        { kind: "locationTransition", locationId: plazaId, transition: "enter" },
        (next) => seen.push(next),
      );
      const picker = fields.querySelector<HTMLSelectElement>("[data-testid='event-page-trigger-location']")!;
      const side = fields.querySelector<HTMLSelectElement>("[data-testid='event-page-trigger-location-transition']")!;

      picker.value = dockId;
      picker.dispatchEvent(new Event("change"));
      side.value = "leave";
      side.dispatchEvent(new Event("change"));

      expect(seen).toEqual([
        { kind: "locationTransition", locationId: dockId, transition: "enter" },
        { kind: "locationTransition", locationId: dockId, transition: "leave" },
      ]);
    });

    it("구역이 하나도 없는 맵에서는 안내 항목을 보여 준다", () => {
      const project = createBlankProject();
      const map: GameMap = {
        id: MAP_ID,
        name: "빈 맵",
        width: 10,
        height: 10,
        tilesetId: "easyrpg_chipset_combined_town",
        tileSize: 16,
        lowerTiles: new Array(100).fill(TILE.GRASS),
        upperTiles: new Array(100).fill(TILE.EMPTY),
        events: [],
      };
      project.maps[MAP_ID] = map;
      project.startMapId = MAP_ID;
      store.replace(project);
      editorState.set({ currentMapId: MAP_ID });

      const trigger = locationTransitionTrigger();
      expect(trigger).toEqual({ kind: "locationTransition", locationId: "", transition: "enter" });
      const fields = renderLocationTransitionTriggerFields(trigger, () => {});
      const picker = fields.querySelector<HTMLSelectElement>("[data-testid='event-page-trigger-location']")!;
      expect(picker.options[0]?.textContent).toContain("이 맵에 로케이션이 없습니다");
      // 안내 문장이 어디서 그리는지 알려 준다.
      const error = fields.querySelector<HTMLElement>("[data-testid='event-page-trigger-location-error']");
      expect(error?.hidden).toBe(false);
      expect(error?.textContent).toContain("로케이션");
      // 어포던스 감사(2026-09-11): 안내 문장만 있던 빈 상태는 막다른 길이었다 — 행동을 함께 낸다.
      const cta = fields.querySelector<HTMLElement>("[data-testid='event-page-trigger-location-draw']");
      expect(cta).not.toBeNull();
      setLocationLayerEnabled(false);
      cta!.click();
      expect(locationLayerState().enabled).toBe(true);
    });
  });
  describe("location transition trigger — 삭제된 구역의 진단·복구 통로", () => {
    function projectWithDeletedTarget(): { project: Project; plazaId: string } {
      const { plazaId } = seedProject();
      store.update((project) => {
        project.maps[MAP_ID]!.events = [eventWithPage({
          kind: "locationTransition",
          locationId: plazaId,
          transition: "enter",
        })];
        deleteMapLocation(project.maps[MAP_ID]!, plazaId);
      }, { scope: "map", mapId: MAP_ID, label: "테스트 이벤트" });
      return { project: store.getCurrent(), plazaId };
    }

    it("선택기에서 사라지지 않고 「(삭제된 로케이션 …)」 항목으로 남는다", () => {
      const { plazaId } = projectWithDeletedTarget();
      const fields = renderLocationTransitionTriggerFields(
        { kind: "locationTransition", locationId: plazaId, transition: "enter" },
        () => {},
      );
      const picker = fields.querySelector<HTMLSelectElement>("[data-testid='event-page-trigger-location']")!;
      // 값이 유지되어야 «조용히 다른 구역으로 갈아치우기» 가 일어나지 않는다.
      expect(picker.value).toBe(plazaId);
      expect(picker.options[0]?.textContent).toContain("삭제된 로케이션");
      const error = fields.querySelector<HTMLElement>("[data-testid='event-page-trigger-location-error']");
      expect(error?.hidden).toBe(false);
      expect(error?.textContent).toContain("삭제됐습니다");
    });

    it("요약 문장이 끊긴 참조임을 그대로 말한다 (조건 문장과 같은 규칙)", () => {
      const { plazaId } = projectWithDeletedTarget();
      expect(locationTransitionSentence({ kind: "locationTransition", locationId: plazaId, transition: "leave" }))
        .toContain("(삭제된 로케이션");
    });

    it("이벤트 검증기가 error 로 막고 구역 선택기를 가리킨다", () => {
      const { project, plazaId } = projectWithDeletedTarget();
      const event = project.maps[MAP_ID]!.events[0]!;
      const result = validateEventDraftBody(project, MAP_ID, event);
      const issue = result.issues.find((entry) => entry.code === "page.trigger.location-missing");
      expect(issue?.severity).toBe("error");
      expect(issue?.message).toContain(plazaId);
      expect(issue?.field?.testId).toBe("event-page-trigger-location");
    });

    it("구역을 고르지 않은 트리거도 error 로 막는다", () => {
      seedProject();
      store.update((project) => {
        project.maps[MAP_ID]!.events = [eventWithPage({ kind: "locationTransition", locationId: "", transition: "enter" })];
      }, { scope: "map", mapId: MAP_ID, label: "테스트 이벤트" });
      const project = store.getCurrent();
      const result = validateEventDraftBody(project, MAP_ID, project.maps[MAP_ID]!.events[0]!);
      expect(result.issues.map((issue) => issue.code)).toContain("page.trigger.location-empty");
    });

    it("정상 참조는 아무 문제도 만들지 않는다", () => {
      const { plazaId } = seedProject();
      store.update((project) => {
        project.maps[MAP_ID]!.events = [eventWithPage({ kind: "locationTransition", locationId: plazaId, transition: "leave" })];
      }, { scope: "map", mapId: MAP_ID, label: "테스트 이벤트" });
      const project = store.getCurrent();
      const result = validateEventDraftBody(project, MAP_ID, project.maps[MAP_ID]!.events[0]!);
      expect(result.issues.filter((issue) => issue.code.startsWith("page.trigger.location"))).toEqual([]);
    });
  });
});

// test/loopBreakWarningBranches.test.ts
//
// fork 1레벨만 보던 구형 walkHasBreak 는 choices/shop/battle 분기 안의 breakLoop 를
// 못 찾아 거짓 「무한 반복」 경고를 냈다. 전 분기 열거(eventCommandBranches)로 전환한
// 회귀 계약이다.
describe("loopBreakWarningBranches", () => {
  isolateTimers();
  const context: CommandEditContext = {
    path: [0],
    actions: {
      addCommand: () => {},
      insertCommand: () => {},
      replaceCommand: () => {},
      deleteCommand: () => {},
      moveCommand: () => {},
      moveCommandTo: () => {},
    },
  };
  function noBreakVisible(body: Command[]): boolean {
    installFakeDom();
    const root = loopBody(context, { kind: "loop", body });
    const warning = root.querySelector('[data-testid="event-loop-no-break-warning"]') as HTMLElement | null;
    return warning ? !warning.hidden : false;
  }
  describe("loop break warning across branches", () => {
    it("sees breakLoop inside a choices branch", () => {
      const body: Command[] = [{
        kind: "choices",
        prompt: "?",
        options: [{ text: "가", branch: [{ kind: "breakLoop" }] }],
        cancelBehavior: "disallow",
      }];
      expect(noBreakVisible(body)).toBe(false);
    });

    it("sees breakLoop inside a fork else branch", () => {
      const body: Command[] = [{
        kind: "fork",
        condition: { kind: "switch", switchId: "sw_x", value: true },
        then: [{ kind: "text", body: "참" }],
        else: [{ kind: "breakLoop" }],
      }];
      expect(noBreakVisible(body)).toBe(false);
    });

    it("still warns when no branch escapes", () => {
      const body: Command[] = [{
        kind: "fork",
        condition: { kind: "switch", switchId: "sw_x", value: true },
        then: [{ kind: "text", body: "참" }],
      }];
      expect(noBreakVisible(body)).toBe(true);
    });
  });
});

describe("mgL5bvisScreenFilter", () => {
  isolateTimers();
  // #37 Tint Screen 확장: 채도 0~200% · 흑백 · 세피아. 맵(필드 오버레이)과 전투(전투장 레이어) 둘 다.

  type M2 = Extract<Command, { kind: "m2Command" }>;
  const TINT_ID = "m2-046-tint-screen";
  function tint(fields: M2["fields"]): M2 {
    return { kind: "m2Command", commandId: TINT_ID, fields };
  }
  function runOnMap(command: M2) {
    const project = store.getCurrent();
    const session = startSession(project);
    executeM2RuntimeCommand(session, m2CommandById(TINT_ID)!, command, { project });
    return session;
  }
  function sceneFor(session: ReturnType<typeof startSession>): { scene: PlaySceneContext; host: HTMLElement } {
    const host = document.createElement("div");
    document.body.append(host);
    const scene = {
      session,
      game: { registry: { get: (key: string) => (key === "dialogueHost" ? host : undefined) } },
    } as unknown as PlaySceneContext;
    return { scene, host };
  }
  beforeEach(() => {
    store.replace(createBlankProject());
    document.body.replaceChildren();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  describe("screen filter model", () => {
    it("reads percentages from command fields and clamps them", () => {
      expect(screenFilterFromFields({ saturation: 250, grayscale: -5, sepia: "40" })).toEqual({ saturation: 200, grayscale: 0, sepia: 40 });
      expect(screenFilterFromFields({})).toEqual(NEUTRAL_SCREEN_FILTER);
    });

    it("builds the CSS filter list and stays empty when neutral", () => {
      expect(screenFilterCss({ saturation: 0, grayscale: 0, sepia: 0 })).toBe("saturate(0%)");
      expect(screenFilterCss({ saturation: 150, grayscale: 30, sepia: 60 })).toBe("saturate(150%) grayscale(30%) sepia(60%)");
      expect(screenFilterCss(NEUTRAL_SCREEN_FILTER)).toBe("");
    });

    it("interpolates between filters for the tint duration", () => {
      expect(interpolateScreenFilter(NEUTRAL_SCREEN_FILTER, { saturation: 0, grayscale: 100, sepia: 50 }, 0.5))
        .toEqual({ saturation: 50, grayscale: 50, sepia: 25 });
    });

    it("adds the three fields to the catalog with neutral defaults", () => {
      const keys = Object.fromEntries(m2CommandById(TINT_ID)!.fields.map((field) => [field.key, field.defaultValue]));
      expect(keys).toMatchObject({ saturation: 100, grayscale: 0, sepia: 0 });
    });
  });
  describe("Tint Screen on the field", () => {
    it("records the filter in m2Runtime.screen and paints a backdrop-filter layer", () => {
      const session = runOnMap(tint({ color: "neutral", value: "", durationMs: 0, saturation: 40, grayscale: 0, sepia: 70 }));
      expect(session.m2Runtime?.screen.filter).toEqual({ saturation: 40, grayscale: 0, sepia: 70 });
      const { scene, host } = sceneFor(session);
      syncScreenEffects(scene);
      const layer = host.querySelector<HTMLElement>("[data-testid='runtime-screen-filter']");
      expect(layer).not.toBeNull();
      expect(layer!.style.getPropertyValue("backdrop-filter")).toBe("saturate(40%) sepia(70%)");
      expect(layer!.dataset.filter).toBe("saturate(40%) sepia(70%)");
    });

    it("clears the filter when a later Tint Screen omits the fields (legacy command)", () => {
      const session = runOnMap(tint({ color: "neutral", durationMs: 0, grayscale: 100 }));
      const { scene, host } = sceneFor(session);
      syncScreenEffects(scene);
      expect(host.querySelector("[data-testid='runtime-screen-filter']")).not.toBeNull();
      executeM2RuntimeCommand(session, m2CommandById(TINT_ID)!, tint({ color: "red", value: "" }), { project: store.getCurrent() });
      expect(session.m2Runtime?.screen.filter).toBeUndefined();
      syncScreenEffects(scene);
      expect(host.querySelector("[data-testid='runtime-screen-filter']")).toBeNull();
      expect(host.querySelector("[data-testid='runtime-screen-effect']")).not.toBeNull();
    });

    it("tweens the filter over durationMs using animation frames", () => {
      const frames: FrameRequestCallback[] = [];
      let now = 0;
      vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
      vi.spyOn(performance, "now").mockImplementation(() => now);
      const session = runOnMap(tint({ color: "neutral", durationMs: 1000, grayscale: 100 }));
      const { scene, host } = sceneFor(session);
      syncScreenEffects(scene);
      expect(host.querySelector("[data-testid='runtime-screen-filter']")).toBeNull();
      now = 500;
      frames.shift()!(now);
      const layer = host.querySelector<HTMLElement>("[data-testid='runtime-screen-filter']");
      expect(layer?.dataset.filter).toBe("grayscale(50%)");
      now = 1000;
      frames.shift()!(now);
      expect(layer?.dataset.filter).toBe("grayscale(100%)");
      expect(frames).toHaveLength(0);
    });

    it("survives a save/load round trip", () => {
      const session = runOnMap(tint({ color: "neutral", durationMs: 0, saturation: 160 }));
      const project = store.getCurrent();
      const snapshot = JSON.parse(JSON.stringify(createSaveSnapshot(project, session)));
      const restored = applySaveSnapshot(project, snapshot);
      expect(restored.m2Runtime?.screen.filter).toEqual({ saturation: 160, grayscale: 0, sepia: 0 });
    });
  });
  describe("Tint Screen in battle", () => {
    function stubBattler(recordId: string): MutableBattler {
      return {
        id: recordId, recordId, name: recordId, maxHp: 50, maxMp: 10, attackPower: 10, defense: 5, mind: 5,
        agility: 10, chargeRate: 0.1, skillIds: [], hidden: false, hp: 50, mp: 10, gauge: 0,
        stateIds: [], stateTurns: {}, defending: false,
      } as MutableBattler;
    }

    function troopWith(commands: Command[]): TroopRecord {
      return {
        id: "troop_tint", name: "tint", enemyIds: [], members: [], autoAlign: true,
        battleEventPages: [{ id: "page1", name: "start", conditions: [{ kind: "onRound", round: 0 }], span: "battle", runOnce: true, commands }],
      };
    }

    it("executes in troop events and exposes the screen state in the event snapshot", () => {
      const project = createBlankProject();
      const runtime = createBattleEventRuntime({
        project,
        troopRecord: troopWith([tint({ color: "blue", value: "", durationMs: 300, saturation: 0, grayscale: 0, sepia: 0 })]),
        actors: [stubBattler("actor_hero")],
        enemies: [],
        stateIds: [],
        state: { switches: {}, variables: {}, inventory: {} },
      });
      runtime.applyTroopEvents({ turn: 0 });
      expect(runtime.snapshot().screen).toEqual({ tint: "blue", tintDurationMs: 300, filter: { saturation: 0, grayscale: 0, sepia: 0 } });
      expect(runtime.logs().some((entry) => entry.kind === "unsupported")).toBe(false);
    });

    it("paints tint + filter on the battle field layer and removes it when neutral", () => {
      const field = document.createElement("div");
      syncBattleScreenFilter(field, { tint: "neutral", tintDurationMs: 250, filter: { saturation: 100, grayscale: 80, sepia: 0 } });
      const layer = field.querySelector<HTMLElement>("[data-testid='battle-screen-filter']")!;
      expect(layer.style.getPropertyValue("backdrop-filter")).toBe("grayscale(80%)");
      expect(layer.style.transition).toContain("250ms");
      syncBattleScreenFilter(field, { tint: "red", tintDurationMs: 0, filter: { saturation: 100, grayscale: 80, sepia: 0 } });
      expect(layer.dataset.tint).toMatch(/^rgba\(/);
      syncBattleScreenFilter(field, { tint: "neutral", tintDurationMs: 0, filter: { saturation: 100, grayscale: 0, sepia: 0 } });
      expect(field.querySelector("[data-testid='battle-screen-filter']")).toBeNull();
      syncBattleScreenFilter(field, undefined);
      expect(field.querySelector("[data-testid='battle-screen-filter']")).toBeNull();
    });

    it("reaches the mounted battle scene through the real runtime", () => {
      const project = createBlankProject();
      const troop = project.database.troops[0]!;
      troop.battleEventPages = [{
        id: "page_tint", name: "start", conditions: [{ kind: "everyRound", start: 1, interval: 1 }], span: "battle", runOnce: true,
        commands: [tint({ color: "neutral", value: "", durationMs: 0, sepia: 90 })],
      }];
      store.replace(project);
      vi.useFakeTimers();
      try {
        const runtime = createBattleRuntime({ project, troopId: troop.id, canEscape: true, canLose: true, rng: () => 0.5 });
        // 트룹 페이지는 행동이 끝난 차례 경계에서 평가된다 — 방어를 몇 번 두며 런타임을 민다.
        for (let step = 0; step < 400 && !runtime.snapshot().eventState.screen && !runtime.snapshot().result; step += 1) {
          if (runtime.snapshot().phase === "actorCommand") runtime.performActorCommand({ kind: "defend" });
          else runtime.tick(500);
        }
        expect(runtime.snapshot().eventState.screen?.filter.sepia).toBe(90);
        const host = document.createElement("div");
        document.body.append(host);
        const controller = mountBattleScene({ host, runtime, onResult: () => undefined, introHold: false });
        const layer = controller.root.querySelector<HTMLElement>(".battle-field [data-testid='battle-screen-filter']");
        expect(layer?.dataset.filter).toBe("sepia(90%)");
        controller.destroy();
      } finally {
        vi.useRealTimers();
      }
    });

    it("is pickable in troop battle events", () => {
      expect(isM2CatalogEntrySelectableInBattleEvent(m2CommandById(TINT_ID)!)).toBe(true);
    });
  });
  describe("Tint Screen editor form", () => {
    it("commits saturation/grayscale/sepia and previews the filter", () => {
      let staged: Command = tint({ color: "neutral", value: "", durationMs: 0 });
      const context = {
        path: [0],
        actions: {
          addCommand: vi.fn(), insertCommand: vi.fn(), deleteCommand: vi.fn(), moveCommand: vi.fn(), moveCommandTo: vi.fn(),
          replaceCommand: (_path: readonly number[], command: Command) => { staged = structuredClone(command); },
        },
        getCurrentCommand: () => staged,
      } as unknown as CommandEditContext;
      const body = renderM2CommandBody(context, staged as M2)!;
      document.body.append(body);
      const set = (key: string, value: string): void => {
        const input = body.querySelector<HTMLInputElement>(`[data-testid='tint-screen-${key}-input']`);
        if (!input) throw new Error(`missing ${key}`);
        input.value = value;
        input.dispatchEvent(new Event("input"));
      };
      set("saturation", "30");
      set("grayscale", "20");
      set("sepia", "50");
      expect((staged as M2).fields).toMatchObject({ saturation: 30, grayscale: 20, sepia: 50 });
      const swatch = body.querySelector<HTMLElement>("[data-testid='tint-screen-preview-swatch']");
      expect(swatch?.dataset.filter).toBe("saturate(30%) grayscale(20%) sepia(50%)");
      // 같은 필드로 맵에서 실행하면 같은 필터가 걸린다.
      expect(runOnMap(staged as M2).m2Runtime?.screen.filter).toEqual({ saturation: 30, grayscale: 20, sepia: 50 });
    });
  });
});
