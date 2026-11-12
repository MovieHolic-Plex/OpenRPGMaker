// 목표가 «가리키는 이벤트»를 들고 다닌다 — 명령(fields.targetMapId · targetEventId) → 세션 목표(target) → 저장 칸 → QA 체크포인트 → 표시.
// 2026-11-12 r1 눈가림 플레이: 표시가 글의 이름으로 대상을 찾아 이름이 같은 다른 이벤트(r1-farm 「보리」 둘, r1-fantasy 「광산 수호자」 말 이벤트)에 섰다.
// 글 찾기는 옛 저장본·손으로 만든 게임의 대비로 남는다(openwiki/runtime-sessions.md 「목표가 가리키는 이벤트」).
import { describe, expect, it } from "vitest";
import { createInterpreter } from "@/player/interpreter";
import { ensureM2Runtime } from "@/player/interpreter/m2RuntimeState";
import { objectiveTargetViews } from "@/player/objectiveTarget";
import { sessionFromQaCheckpoint } from "@/player/qaCheckpoint";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveToSlot, type SaveSnapshot } from "@/player/saveSlots";
import { currentObjective, currentObjectiveText } from "@/player/zoneFeedback";
import { createBlankProject } from "@/project/defaults";
import { validateCommandArray } from "@/project/io/shapeCommandFields";
import { runtimeEventViewsForMap } from "@/project/runtimeEventState";
import { startSession } from "@/project/session";
import type { Command, GameEvent, GameMap, Project } from "@/project/types";

const chip = (message: string, target?: { mapId: string; eventId: string }): Command => ({
  kind: "m2Command", commandId: "m2-214-ui-command",
  fields: { surface: "objectiveChip", message, durationMs: 0, ...(target ? { targetMapId: target.mapId, targetEventId: target.eventId } : {}) },
}) as Command;

function run(session: ReturnType<typeof startSession>, commands: Command[]): void {
  const it = createInterpreter(commands, session);
  let r = it.start();
  for (let guard = 0; r.kind !== "done" && guard < 100; guard += 1) r = it.resume(undefined as never);
}

function memoryStorage(): Storage {
  const backing = new Map<string, string>();
  return {
    get length() { return backing.size; },
    clear: () => backing.clear(),
    getItem: (key: string) => backing.get(key) ?? null,
    key: (index: number) => [...backing.keys()][index] ?? null,
    removeItem: (key: string) => void backing.delete(key),
    setItem: (key: string, value: string) => void backing.set(key, value),
  } satisfies Storage;
}

describe("objective target: load · play · save", () => {
  it("loads: the two flat string fields pass the command shape check (an object field would not)", () => {
    expect(() => validateCommandArray("commands", [chip("보리와 이야기한다", { mapId: "m_field", eventId: "ev_bori" })])).not.toThrow();
    const nested = { kind: "m2Command", commandId: "m2-214-ui-command", fields: { surface: "objectiveChip", message: "x", durationMs: 0, target: { mapId: "m", eventId: "e" } } };
    expect(() => validateCommandArray("commands", [nested])).toThrow(/fields/);
  });

  it("plays: the objective command hands its target to the session objective; a later objective without one clears it", () => {
    const project = createBlankProject();
    const session = startSession(project);
    run(session, [chip("보리와 이야기한다", { mapId: "m_field", eventId: "ev_bori" })]);
    expect(currentObjective(session.m2Runtime?.ui)).toEqual({ text: "보리와 이야기한다", target: { mapId: "m_field", eventId: "ev_bori" } });
    expect(currentObjectiveText(session.m2Runtime?.ui)).toBe("보리와 이야기한다");
    run(session, [chip("마을로 돌아간다")]);
    expect(currentObjective(session.m2Runtime?.ui)).toEqual({ text: "마을로 돌아간다" });
    // 한쪽 칸만 있으면 대상으로 치지 않는다.
    run(session, [{ kind: "m2Command", commandId: "m2-214-ui-command", fields: { surface: "objectiveChip", message: "반쪽", durationMs: 0, targetEventId: "ev_bori" } } as Command]);
    expect(currentObjective(session.m2Runtime?.ui)).toEqual({ text: "반쪽" });
  });

  it("saves and loads: the target rides the save slot next to the objective text", () => {
    const project = createBlankProject();
    const session = startSession(project);
    run(session, [chip("보리와 이야기한다", { mapId: project.startMapId, eventId: "ev_bori" })]);
    const snapshot = createSaveSnapshot(project, session);
    expect(snapshot.session.objective).toBe("보리와 이야기한다");
    expect(snapshot.session.objectiveTarget).toEqual({ mapId: project.startMapId, eventId: "ev_bori" });
    const storage = memoryStorage();
    expect(saveToSlot(storage, 1, snapshot).ok).toBe(true);
    const read = readSaveSlot(storage, 1);
    expect(read.kind).toBe("present");
    const loaded = applySaveSnapshot(project, (read as { snapshot: SaveSnapshot }).snapshot);
    expect(currentObjective(loaded.m2Runtime?.ui)).toEqual({ text: "보리와 이야기한다", target: { mapId: project.startMapId, eventId: "ev_bori" } });
  });

  it("an old save (objective text only) still loads — the marker then finds its target by the text", () => {
    const project = createBlankProject();
    const session = startSession(project);
    run(session, [chip("보리와 이야기한다")]);
    const snapshot = createSaveSnapshot(project, session);
    expect("objectiveTarget" in snapshot.session).toBe(false);
    const storage = memoryStorage();
    saveToSlot(storage, 1, snapshot);
    const loaded = applySaveSnapshot(project, (readSaveSlot(storage, 1) as { snapshot: SaveSnapshot }).snapshot);
    expect(currentObjective(loaded.m2Runtime?.ui)).toEqual({ text: "보리와 이야기한다" });
  });

  it("a save whose objectiveTarget is malformed loads with the text only", () => {
    const project = createBlankProject();
    const session = startSession(project);
    run(session, [chip("보리와 이야기한다", { mapId: project.startMapId, eventId: "ev_bori" })]);
    const storage = memoryStorage();
    saveToSlot(storage, 1, createSaveSnapshot(project, session));
    const key = [...Array(storage.length).keys()].map((i) => storage.key(i)!).find((k) => (storage.getItem(k) ?? "").includes("objectiveTarget"))!;
    storage.setItem(key, storage.getItem(key)!.replace(/"objectiveTarget":\{[^}]*\}/u, '"objectiveTarget":{"mapId":7}'));
    const read = readSaveSlot(storage, 1);
    expect(read.kind).toBe("present");
    const loaded = applySaveSnapshot(project, (read as { snapshot: SaveSnapshot }).snapshot);
    expect(currentObjective(loaded.m2Runtime?.ui)).toEqual({ text: "보리와 이야기한다" });
  });

  it("QA checkpoint: objectiveTarget starts the board with the same target", () => {
    const project = createBlankProject();
    const session = sessionFromQaCheckpoint(project, { id: "cp", mapId: project.startMapId, objective: "보리와 이야기한다", objectiveTarget: { mapId: project.startMapId, eventId: "ev_bori" } });
    expect(currentObjective(session.m2Runtime?.ui)).toEqual({ text: "보리와 이야기한다", target: { mapId: project.startMapId, eventId: "ev_bori" } });
    const plain = sessionFromQaCheckpoint(project, { id: "cp2", mapId: project.startMapId, objective: "보리와 이야기한다" });
    expect(currentObjective(plain.m2Runtime?.ui)).toEqual({ text: "보리와 이야기한다" });
  });
});

type Page = { commands: unknown[]; conditions?: unknown[]; trigger?: string };
type Ev = { id: string; name?: string; x: number; y: number; pages: Page[] };
const talk = (...commands: unknown[]): Page => ({ commands: [{ kind: "text", body: "…" }, ...commands] });
const door = (to: string, conditions: unknown[] = []): Page => ({ trigger: "playerTouch", conditions, commands: [{ kind: "transfer", mapId: to, x: 1, y: 1 }] });
const on = (switchId: string) => ({ kind: "switch", switchId, value: true });
const has = (itemId: string) => ({ kind: "item", itemId, present: true });
const set = (switchId: string) => ({ kind: "setSwitch", switchId, value: true });

function world(maps: Record<string, { name: string; events: Ev[] }>): Project {
  const project = createBlankProject();
  const template = project.maps[project.startMapId]!;
  const out: Record<string, GameMap> = {};
  for (const [id, spec] of Object.entries(maps)) {
    out[id] = {
      ...structuredClone(template), id, name: spec.name,
      events: spec.events.map((e) => ({
        id: e.id, name: e.name ?? "", x: e.x, y: e.y,
        pages: e.pages.map((p, i) => ({ id: `${e.id}_p${i}`, trigger: { kind: p.trigger ?? "action" }, priority: "same", graphic: {}, conditions: p.conditions ?? [], commands: p.commands })),
      })) as unknown as GameEvent[],
    } as GameMap;
  }
  project.maps = out as Project["maps"];
  project.startMapId = Object.keys(maps)[0]!;
  return project;
}

function ids(project: Project, mapId: string, text: string, options: { target?: { mapId: string; eventId: string }; switches?: string[]; items?: string[]; blind?: boolean } = {}): string[] {
  const session = startSession(project);
  for (const id of options.switches ?? []) session.switches[id] = true;
  for (const id of options.items ?? []) session.inventory[id] = 1;
  const map = project.maps[mapId]!;
  const views = runtimeEventViewsForMap(project, map, session, {});
  return objectiveTargetViews(project, map, views, text, { target: options.target, ...(options.blind ? {} : { session }) }).map((view) => view.event.id);
}

describe("objective target: the marker stands on the event the objective carries", () => {
  // 밭에 「보리」 가 둘 — 이야기를 넘기는 쪽(ev_bori)과 같은 이름의 곁 이벤트(ev_bori_story).
  const farm = () => world({
    m_field: { name: "보리밭", events: [
      { id: "ev_bori_story", name: "보리", x: 3, y: 3, pages: [talk()] },
      { id: "ev_bori", name: "보리", x: 12, y: 9, pages: [talk(set("sw_talked"))] },
      { id: "ev_gate_field_barn", x: 19, y: 7, pages: [door("m_barn")] },
    ] },
    m_barn: { name: "헛간", events: [
      { id: "ev_gate_barn_field", x: 0, y: 7, pages: [door("m_field")] },
      { id: "ev_chest", name: "씨앗 상자", x: 5, y: 5, pages: [talk(set("sw_seed")), { conditions: [on("sw_seed")], commands: [] }] },
    ] },
  });

  it("text alone finds both namesakes; the carried target picks the one that advances the step", () => {
    const project = farm();
    expect(ids(project, "m_field", "보리와 이야기한다 (보리)").sort()).toEqual(["ev_bori", "ev_bori_story"]);
    expect(ids(project, "m_field", "보리와 이야기한다 (보리)", { target: { mapId: "m_field", eventId: "ev_bori" } })).toEqual(["ev_bori"]);
  });

  it("a target on another map: the first exit toward that map, whatever the text says", () => {
    const project = farm();
    expect(ids(project, "m_field", "보리와 이야기한다 (보리)", { target: { mapId: "m_barn", eventId: "ev_chest" } })).toEqual(["ev_gate_field_barn"]);
  });

  it("falls back to the text when the target event is gone, on an unknown map, or its open page does nothing", () => {
    const project = farm();
    const text = "씨앗 상자를 연다 (씨앗 상자)";
    expect(ids(project, "m_barn", text, { target: { mapId: "m_barn", eventId: "ev_missing" } })).toEqual(["ev_chest"]);
    expect(ids(project, "m_barn", text, { target: { mapId: "m_nowhere", eventId: "ev_chest" } })).toEqual(["ev_chest"]);
    expect(ids(project, "m_field", "보리와 이야기한다 (보리)", { target: { mapId: "m_barn", eventId: "ev_missing" } }).sort()).toEqual(["ev_bori", "ev_bori_story"]);
    // 상자를 이미 열었다(빈 페이지) — 대상은 눌러도 아무 일이 없으니 글이 이름을 댄 쪽으로.
    expect(ids(project, "m_barn", "보리에게 돌아간다 (보리밭 입구: 서쪽 → 보리)", { target: { mapId: "m_barn", eventId: "ev_chest" }, switches: ["sw_seed"] })).toEqual(["ev_gate_barn_field"]);
  });
});

describe("objective target: a locked exit on the way points at what opens it", () => {
  // 찻집 → 시장 → 여관. 시장→여관 길목은 나디아(시장)와 아말(찻집) 둘 다와 이야기해야 열린다 — 어느 쪽이 먼저든 된다.
  const bazaar = () => world({
    m_tea: { name: "별빛 찻집", events: [
      { id: "ev_gate_tea_market", x: 9, y: 14, pages: [door("m_market")] },
      { id: "ev_amal", name: "아말", x: 4, y: 4, pages: [talk(set("sw_amal")), { conditions: [on("sw_amal")], commands: [{ kind: "text", body: "다녀와." }] }] },
    ] },
    m_market: { name: "황금 천막 시장", events: [
      { id: "ev_gate_market_tea", x: 9, y: 0, pages: [door("m_tea")] },
      { id: "ev_gate_market_inn", x: 19, y: 7, pages: [
        { commands: [{ kind: "text", body: "(나디아와 아말에게 먼저 길을 물어야 한다.)" }] },
        door("m_inn", [on("sw_nadia"), on("sw_amal")]),
      ] },
      { id: "ev_nadia", name: "나디아", x: 6, y: 9, pages: [talk(set("sw_nadia"))] },
    ] },
    m_inn: { name: "모래바람 여관", events: [
      { id: "ev_gate_inn_market", x: 0, y: 7, pages: [door("m_market")] },
      { id: "ev_idris", name: "이드리스", x: 8, y: 6, pages: [talk(set("sw_idris"))] },
    ] },
  });
  const text = "궁전 가는 길을 듣는다 (황금 천막 시장 입구: 남쪽 → 황금 천막 시장에서 동쪽 → 모래바람 여관 · 이드리스)";

  it("on the map of the locked exit: the events that give what is still missing, not the shut exit", () => {
    const project = bazaar();
    expect(ids(project, "m_market", text)).toEqual(["ev_nadia"]);
    // 나디아와는 이야기했다 — 남은 것은 찻집의 아말이므로 찻집으로 가는 문.
    expect(ids(project, "m_market", text, { switches: ["sw_nadia"] })).toEqual(["ev_gate_market_tea"]);
  });

  it("one map before the lock: the opener standing here first, then the way on", () => {
    const project = bazaar();
    expect(ids(project, "m_tea", text)).toEqual(["ev_amal"]);
    expect(ids(project, "m_tea", text, { switches: ["sw_amal"] })).toEqual(["ev_gate_tea_market"]);
  });

  it("once everything is given the exit is the target again; the carried target behaves the same", () => {
    const project = bazaar();
    expect(ids(project, "m_market", text, { switches: ["sw_nadia", "sw_amal"] })).toEqual(["ev_gate_market_inn"]);
    const target = { mapId: "m_inn", eventId: "ev_idris" };
    expect(ids(project, "m_market", "길을 듣는다", { target })).toEqual(["ev_nadia"]);
    expect(ids(project, "m_market", "길을 듣는다", { target, switches: ["sw_nadia", "sw_amal"] })).toEqual(["ev_gate_market_inn"]);
    expect(ids(project, "m_inn", "길을 듣는다", { target, switches: ["sw_nadia", "sw_amal"] })).toEqual(["ev_idris"]);
  });

  it("without the board (editor, checks) the lock is not read — as before: the shut exit carries no marker, the open one does", () => {
    const project = bazaar();
    expect(ids(project, "m_market", text, { blind: true })).toEqual([]);
    expect(ids(project, "m_tea", text, { blind: true })).toEqual(["ev_gate_tea_market"]);
  });

  it("an opener that is itself locked: go to what opens the opener (an item given on another map)", () => {
    const project = world({
      m_mine: { name: "버려진 광산", events: [
        { id: "ev_gate_mine_forest", x: 0, y: 7, pages: [door("m_forest")] },
        { id: "ev_gate_mine_deep", x: 19, y: 7, pages: [{ commands: [{ kind: "text", body: "(물길이 막혀 있다.)" }] }, door("m_deep", [on("sw_water")])] },
        // 수문은 이끼의 부적이 있어야 돌아간다.
        { id: "ev_sluice", name: "수문", x: 10, y: 4, pages: [talk(), { conditions: [has("item_charm")], commands: [{ kind: "text", body: "돌렸다." }, set("sw_water")] }] },
      ] },
      m_forest: { name: "속삭임 숲", events: [
        { id: "ev_gate_forest_mine", x: 19, y: 7, pages: [door("m_mine")] },
        { id: "ev_moss", name: "숲지기 이끼", x: 6, y: 6, pages: [talk({ kind: "changeItem", itemId: "item_charm", op: "+=", amount: 1 })] },
      ] },
      m_deep: { name: "깊은 수로", events: [{ id: "ev_gate_deep_mine", x: 0, y: 7, pages: [door("m_mine")] }, { id: "ev_spring", name: "샘", x: 9, y: 9, pages: [talk(set("sw_end"))] }] },
    });
    const goal = "샘을 살핀다 (깊은 수로 입구: 동쪽 → 샘)";
    expect(ids(project, "m_mine", goal)).toEqual(["ev_gate_mine_forest"]);
    expect(ids(project, "m_forest", goal)).toEqual(["ev_moss"]);
    expect(ids(project, "m_mine", goal, { items: ["item_charm"] })).toEqual(["ev_sluice"]);
    expect(ids(project, "m_mine", goal, { items: ["item_charm"], switches: ["sw_water"] })).toEqual(["ev_gate_mine_deep"]);
  });

  it("a lock nothing gives: the shut exit itself (its own line says what is missing)", () => {
    const project = world({
      m_a: { name: "안뜰", events: [{ id: "ev_gate_a_b", x: 19, y: 7, pages: [{ commands: [{ kind: "text", body: "(잠겨 있다.)" }] }, door("m_b", [on("sw_never")])] }] },
      m_b: { name: "탑", events: [{ id: "ev_gate_b_a", x: 0, y: 7, pages: [door("m_a")] }, { id: "ev_top", name: "종", x: 5, y: 5, pages: [talk()] }] },
    });
    expect(ids(project, "m_a", "종을 울린다 (탑 입구: 동쪽 → 종)")).toEqual(["ev_gate_a_b"]);
  });
});

it("a toast shown after the objective does not hide the objective or its target", () => {
  const project = createBlankProject();
  const session = startSession(project);
  ensureM2Runtime(session).ui.push({ surface: "objectiveChip", message: "옛 목표", durationMs: 0, target: { mapId: "m", eventId: "e" } });
  ensureM2Runtime(session).ui.push({ surface: "toast", message: "알림", durationMs: 1600 });
  expect(currentObjective(session.m2Runtime?.ui)).toEqual({ text: "옛 목표", target: { mapId: "m", eventId: "e" } });
});
