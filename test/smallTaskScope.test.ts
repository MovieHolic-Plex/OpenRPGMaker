import { describe, expect, it } from "vitest";
import { onlyEventPageCommandsChanged } from "@/ai/eventCommandScope";
import { checkSmallTaskScope, smallTaskScopeAllowsTool, type SmallTaskScope } from "@/ai/smallTaskScope";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { setLayerTileAt, setShadowAt } from "@/project/mapLayers";
import type { EventPage, GameEvent, Project } from "@/project/types";

const town = "town";
const chest = "chest";
const pageId = "greeting";
const dialogue = { kind: "dialogue", mapId: town, eventId: chest, pageId } as const;
const eventPage = { ...dialogue, kind: "eventPage" } as const;
const tile = { kind: "tileEvent", mapId: town, x: 1, y: 1, eventId: chest } as const;
const emptyTile = { ...tile, x: 2, eventId: null } as const;
const item = { kind: "dbEntries", entries: [{ collection: "items", id: "potion" }] } as const;
const createItem = { ...item, create: { collection: "items", max: 1 } } as const;

function potion(id: string, name: string) {
  return normalizeItemRecord({ id, name, price: 20 });
}
function event(id: string, name: string, x: number): GameEvent {
  return { id, name, x, y: 1, trigger: { kind: "action" }, commands: [] };
}
const seed = createBlankProject();
const firstMap = seed.maps[seed.startMapId]!;
const greeting: EventPage = {
  id: pageId, name: "첫 만남", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "below",
  movement: { type: "fixed", speed: 3, frequency: 3 },
  commands: [
    { kind: "text", body: "어서 오세요.", speaker: "문지기" },
    { kind: "text", body: "오래 기다렸습니다.", speaker: "문지기" },
    { kind: "wait", ms: 120 },
    { kind: "setSelfSwitch", key: "A", value: true },
    { kind: "choices", options: [
      { text: "연다", branch: [{ kind: "text", body: "열었다." }, { kind: "wait", ms: 10 }] },
      { text: "둔다", branch: [] },
    ], cancelBranch: [] },
  ],
};
const base: Project = {
  ...seed, tilesets: {}, startMapId: town,
  database: { ...seed.database, items: [potion("potion", "회복약"), potion("ether", "마력약")] },
  maps: {
    [town]: {
      ...firstMap, id: town, name: "마을", width: 3, height: 3, lowerTiles: Array(9).fill(0), upperTiles: Array(9).fill(-1),
      events: [{ ...event(chest, "보물상자", 1), pages: [greeting] }, event("gate", "문지기", 0)],
    },
    woods: { ...firstMap, id: "woods", name: "숲", events: [] },
  },
};
const target = (p: Project) => p.maps[town]!.events[0]!;
const page = (p: Project) => target(p).pages![0]!;

function verify(scope: SmallTaskScope, mutate: (after: Project) => void) {
  const before = structuredClone(base);
  const after = structuredClone(before);
  mutate(after);
  const result = checkSmallTaskScope(before, after, scope);
  expect(before).toEqual(base);
  return result;
}

function rejects(scope: SmallTaskScope, mutate: (after: Project) => void, label: string) {
  const result = verify(scope, mutate);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("범위 검사가 변경을 통과시켰습니다.");
  expect(result.reason).toMatch(/^[가-힣]/u);
  expect(result.reason).toMatch(/\n범위 밖: /u);
  expect(result.reason).toContain(label);
  expect(result.reason).not.toMatch(/[{}]|"(mapId|commands|database)"\s*:/u);
  expect(result.violations.some(({ what }) => what.includes(label))).toBe(true);
}

describe("작은 일 범위 검사", () => {
  it("대사를 끼우고 지우고 고치며 선택지 문구와 분기 안 대사도 바꾼다", () => {
    expect(verify(dialogue, p => {
      const commands = page(p).commands;
      commands[0] = { ...commands[0], body: "안녕하세요." } as typeof commands[number];
      commands.splice(1, 1);
      commands.splice(3, 0, { kind: "text", body: "여기는 마을입니다." });
      const choices = commands[4];
      if (choices?.kind !== "choices") throw new Error("선택지 누락");
      choices.options[0]!.text = "상자를 연다";
      choices.options[0]!.branch.splice(0, 1, { kind: "text", body: "상자 뚜껑이 열렸다." });
      choices.cancelBranch!.push({ kind: "text", body: "마음을 바꿨다." });
    })).toEqual({ ok: true });
    expect(verify(dialogue, p => { page(p).commands.splice(0, 1); })).toEqual({ ok: true });
    expect(verify(dialogue, p => { page(p).commands.unshift({ kind: "text", speaker: "주인공", body: "잠깐만요." }); })).toEqual({ ok: true });
  });

  it("그대로인 대사를 사이에 둔 삭제와 추가를 구분한다", () => {
    expect(verify(dialogue, p => {
      const commands = page(p).commands;
      commands.splice(0, 1);
      commands.splice(1, 0, { kind: "text", speaker: "상인", body: "이쪽으로 오세요." });
    })).toEqual({ ok: true });
  });

  it("대사 외 명령의 값과 순서, 화자·얼굴, 선택지 수·조건과 페이지 설정을 지킨다", () => {
    rejects(dialogue, p => { page(p).commands.splice(2, 2, greeting.commands[3]!, greeting.commands[2]!); }, "『보물상자』");
    rejects(dialogue, p => { page(p).commands[2] = { kind: "wait", ms: 50 }; }, "『첫 만남』");
    rejects(dialogue, p => { (page(p).commands[0] as Extract<EventPage["commands"][number], { kind: "text" }>).speaker = "다른 사람"; }, "『첫 만남』");
    rejects(dialogue, p => { Object.assign(page(p).commands[0]!, { listenerBust: "다른 얼굴" }); }, "『첫 만남』");
    rejects(dialogue, p => { const command = page(p).commands[4]; if (command?.kind === "choices") command.options.pop(); }, "『첫 만남』");
    rejects(dialogue, p => { const command = page(p).commands[4]; if (command?.kind === "choices") command.options[0]!.branch.pop(); }, "『첫 만남』");
    rejects(dialogue, p => { const command = page(p).commands[4]; if (command?.kind === "choices") command.options[1]!.showWhen = { kind: "gold", op: ">=", amount: 1 }; }, "『첫 만남』");
    rejects(dialogue, p => { page(p).trigger = { kind: "auto" }; }, "『보물상자』 이벤트");
  });

  it("보물상자의 두 번째 페이지와 셀프 스위치, 대상 칸의 층을 함께 변경한다", () => {
    expect(verify(tile, p => {
      target(p).pages!.push({
        ...greeting, id: "opened", name: "열린 상자", conditions: [{ kind: "selfSwitch", key: "A", value: true }], commands: [],
      });
      p.session.selfSwitches = { [chest]: { A: true } };
      setLayerTileAt(p.maps[town]!, 1, 4, 3);
      setLayerTileAt(p.maps[town]!, 2, 4, 7);
      setLayerTileAt(p.maps[town]!, 4, 4, 9);
      setShadowAt(p.maps[town]!, 4, 1);
      p.maps[town]!.upperTileStacks = { 4: [1, 2] };
    })).toEqual({ ok: true });
    const before = structuredClone(base);
    setLayerTileAt(before.maps[town]!, 2, 4, 7);
    setShadowAt(before.maps[town]!, 4, 1);
    before.session.selfSwitches = { [chest]: { A: true } };
    expect(checkSmallTaskScope(before, base, tile)).toEqual({ ok: true });
  });

  it("대상 이벤트를 삭제할 때 그 이벤트의 셀프 스위치도 지울 수 있다", () => {
    const before = structuredClone(base);
    before.session.selfSwitches = { [chest]: { A: true } };
    const after = structuredClone(before);
    after.maps[town]!.events.shift();
    delete after.session.selfSwitches;
    expect(checkSmallTaskScope(before, after, tile)).toEqual({ ok: true });
    after.maps[town]!.events.push(event("new", "다른 상자", 1));
    expect(checkSmallTaskScope(before, after, tile)).toMatchObject({ ok: false });
  });

  it("빈 대상에서는 새 이벤트 하나 또는 타일만 허용한다", () => {
    expect(verify(emptyTile, p => { p.maps[town]!.events.unshift(event("new", "표지판", 2)); })).toEqual({ ok: true });
    expect(verify(emptyTile, p => { setLayerTileAt(p.maps[town]!, 3, 5, 2); })).toEqual({ ok: true });
    rejects(emptyTile, p => { p.maps[town]!.events.push(event("new1", "표지판", 2), event("new2", "회복소", 2)); }, "『회복소』 이벤트");
    rejects(emptyTile, p => { p.maps[town]!.events.push(event("new", "표지판", 0)); }, "『표지판』 이벤트");
  });

  it("다른 이벤트·칸·맵과 자료집 변경을 차단하고 대상 이벤트의 위치를 지킨다", () => {
    rejects(tile, p => { p.maps[town]!.events[1]!.name = "장사꾼"; }, "『마을』 맵의 『문지기』 이벤트");
    rejects(tile, p => { setLayerTileAt(p.maps[town]!, 2, 5, 4); }, "『마을』 맵의 타일");
    rejects(tile, p => { p.maps[town]!.name = "북쪽 마을"; }, "『마을』 맵의 속성");
    rejects(tile, p => { p.maps.woods!.name = "북쪽 숲"; }, "『숲』 맵의 속성");
    rejects(tile, p => { p.database.items[0]!.price++; }, "아이템 『회복약』");
    rejects(tile, p => { target(p).x = 2; }, "『보물상자』 이벤트");
    rejects(tile, p => { p.session.selfSwitches = { gate: { B: true } }; }, "『문지기』 이벤트의 셀프 스위치");
    rejects(tile, p => { p.maps[town]!.events.reverse(); }, "이벤트 목록의 순서");
  });

  it("선택된 아이템 가격과 한도 내 새 아이템을 허용한다", () => {
    expect(verify(item, p => { p.database.items[0]!.price = 75; })).toEqual({ ok: true });
    expect(verify(createItem, p => { p.database.items[0]!.price = 75; p.database.items.unshift(potion("mega", "특효약")); })).toEqual({ ok: true });
  });

  it("다른 자료집 항목, 초과 생성, 삭제, 중복 ID와 이벤트 변경을 차단한다", () => {
    rejects(item, p => { p.database.items[1]!.price++; }, "아이템 『마력약』");
    rejects(item, p => { p.database.items.splice(0, 1); }, "아이템 『회복약』");
    rejects(createItem, p => { p.database.items.push(potion("mega", "특효약"), potion("max", "만병통치약")); }, "아이템 『만병통치약』");
    rejects(createItem, p => { p.database.items.push(potion("potion", "중복 약")); }, "아이템 목록");
    rejects(createItem, p => { p.database.items.reverse(); }, "아이템 목록의 순서");
    rejects(item, p => { page(p).commands = []; }, "『보물상자』 이벤트");
    rejects(item, p => { p.database.items[0]!.skillId = "missing-skill"; }, "아이템 『회복약』의 참조");
  });

  it("키 정렬과 관계없이 같게 판정하고 기존 이벤트 페이지 가드가 명령만 허용한다", () => {
    const after = structuredClone(base);
    after.maps = { woods: after.maps.woods!, town: after.maps.town! };
    page(after).commands[0] = { body: "어서 오세요.", speaker: "문지기", kind: "text" };
    expect(checkSmallTaskScope(base, after, dialogue)).toEqual({ ok: true });
    page(after).commands = [{ kind: "wait", ms: 50 }];
    expect(onlyEventPageCommandsChanged(base, after, eventPage)).toBe(true);
    page(after).conditions = [{ kind: "selfSwitch", key: "A", value: true }];
    expect(onlyEventPageCommandsChanged(base, after, eventPage)).toBe(false);
    expect(onlyEventPageCommandsChanged(base, base, { ...eventPage, pageId: "unknown" })).toBe(false);
    rejects(eventPage, p => { p.maps[town]!.events[1]!.x = 2; }, "『문지기』 이벤트");
  });

  it("대사 스코프의 쓰기는 명령 한 줄과 대사 고치기로 한정한다", () => {
    for (const name of ["get_event", "list_dialogue", "lint_dialogue", "rewrite_dialogue", "insert_event_command", "update_event_command", "delete_event_command"]) {
      expect(smallTaskScopeAllowsTool(dialogue, name), name).toBe(true);
    }
    for (const name of ["patch_event_page", "event_command_assist", "upsert_event", "upsert_item", "invented_tool"]) {
      expect(smallTaskScopeAllowsTool(dialogue, name), name).toBe(false);
    }
  });
});
