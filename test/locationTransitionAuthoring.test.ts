/** @vitest-environment happy-dom */
// 「구역에 들어오면/나가면」 **저작 표면**: 이벤트 편집기에서 고를 수 있고, 구역을 **이름으로**
// 고르며(좌표 입력 금지), 삭제된 구역은 조건과 **같은** 진단·복구 통로를 탄다.
import { beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { locationLayerState, setLocationLayerEnabled } from "@/editor/mapLocationLayerState";
import { validateEventDraftBody } from "@/editor/eventDraftValidator";
import {
  LOCATION_TRANSITION_TRIGGER_LABEL,
  locationTransitionSentence,
  locationTransitionTrigger,
  renderLocationTransitionTriggerFields,
} from "@/editor/locationTriggerAuthoring";
import { TRIGGER_OPTIONS } from "@/editor/panels/eventEditor/options";
import { renderEventPageProps } from "@/editor/panels/eventEditor/pageProps";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { addMapLocation, deleteMapLocation } from "@/project/mapNamedLocations";
import { store } from "@/project/store";
import type { EventPage, GameEvent, GameMap, Project, Trigger } from "@/project/types";

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
