import { describe, expect, it } from "vitest";
import { measure } from "../scripts/fs-scale/score.mjs";
import { MIN_ACT_DEPTH, progressionDepth } from "@/ai/v2/actDepth";
import { actDepthMinBlocker } from "@/ai/v2/shipChecks";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

type Doc = Record<string, unknown>;
const tiles = (n: number, kinds: number, seed = 0) => Array.from({ length: n }, (_, i) => (i % kinds) + seed);
const say = (body: string) => ({ kind: "text", speaker: "누군가", body });
const setSwitch = (switchId: string) => ({ kind: "setSwitch", switchId, value: true });
const event = (id: string, commands: unknown[], conditions: unknown[] = []) => ({
  id, name: id, x: 1, y: 1, trigger: { kind: "action" }, commands: [],
  pages: [{ id: `${id}_p`, conditions, trigger: { kind: "action" }, commands }],
});
const gate = (switchId: string) => ({ kind: "switch", switchId, value: true });
const mapWith = (id: string, events: unknown[], seed = 0, transfer?: string) => ({
  id, name: `맵 ${id}`, width: 12, height: 10, tilesetId: "ts_a",
  lowerTiles: tiles(120, 8, seed), upperTiles: Array(120).fill(-1),
  events: transfer ? [...events, event(`go_${id}`, [{ kind: "transfer", mapId: transfer, x: 1, y: 1 }])] : events,
});
const doc = (maps: Record<string, unknown>, extra: Doc = {}): Doc => ({ startMapId: "m1", maps, commonEvents: [], endings: [], quests: [], database: {}, system: {}, meta: {}, ...extra });
const asProject = (d: Doc, request = "마을과 던전이 있는 모험 게임을 만들어 줘"): Project => {
  const p = createBlankProject() as unknown as Doc;
  Object.assign(p, d, { gameBlueprint: { request, title: "t", genre: "g", premise: "p", playerGoal: "g", steps: [], ending: { name: "e", how: "h", feeling: "f" } } });
  return p as unknown as Project;
};

const chain = (n: number): Doc => {
  const evs = Array.from({ length: n }, (_, i) => event(`step${i}`, [say(`단계 ${i} 대사`), setSwitch(`s_${i}`)], i > 0 ? [gate(`s_${i - 1}`)] : []));
  return doc({ m1: mapWith("m1", evs, 0, "m2"), m2: mapWith("m2", [event("far", [say("다른 맵")])], 1) });
};

const cases: Record<string, Doc> = {
  "사슬 없음": doc({ m1: mapWith("m1", [event("a", [say("안녕")])]) }),
  "3단계 사슬": chain(3),
  "5단계 사슬": chain(5),
  "8단계 사슬": chain(8),
  "이름만 다른 같은 이벤트": doc({ m1: mapWith("m1", [event("a", [say("같은 대사"), setSwitch("s_0")]), event("b", [say("같은 대사"), setSwitch("s_0")], [gate("s_0")])]) }),
};

describe("진행 깊이 — 완성도 척도(score.mjs measure.act_structure)와 같은 값", () => {
  for (const [name, d] of Object.entries(cases)) {
    it(`${name}: 깊이가 척도와 같다`, () => {
      expect(progressionDepth(d as unknown as Project)).toBe((measure(d) as { act_structure: number }).act_structure);
    });
  }
  it("사슬 길이가 곧 깊이다(3·5·8단계)", () => {
    expect(progressionDepth(cases["3단계 사슬"] as unknown as Project)).toBe(2);
    expect(progressionDepth(cases["5단계 사슬"] as unknown as Project)).toBe(4);
    expect(progressionDepth(cases["8단계 사슬"] as unknown as Project)).toBe(7);
  });
});

describe("act-depth-min 출하 차단", () => {
  it("깊이가 모자라면 write_blueprint 6~8단계·새 이름·patch_event_page 를 한 문장에 싣는다", () => {
    const [b] = actDepthMinBlocker(asProject(cases["3단계 사슬"]!), "마을과 던전이 있는 모험 게임을 만들어 줘");
    expect(b!.id).toBe("act-depth-min");
    expect(b!.message).toContain(`2/${MIN_ACT_DEPTH}`);
    expect(b!.message).toContain("write_blueprint");
    expect(b!.message).toContain("새 이름");
    expect(b!.message).toContain("patch_event_page");
  });
  it("깊이가 충분하면 차단이 없다", () => {
    expect(actDepthMinBlocker(asProject(cases["8단계 사슬"]!), "마을과 던전이 있는 모험 게임을 만들어 줘")).toEqual([]);
  });
  it("이름만 늘리거나 같은 이벤트를 복사해도 깊이가 늘지 않아 막힌다", () => {
    expect(progressionDepth(cases["이름만 다른 같은 이벤트"] as unknown as Project)).toBeLessThan(MIN_ACT_DEPTH);
    expect(actDepthMinBlocker(asProject(cases["이름만 다른 같은 이벤트"]!), "마을과 던전이 있는 모험 게임을 만들어 줘")).toHaveLength(1);
  });
  it("방탈출·한 장소 게임은 면제다", () => {
    expect(actDepthMinBlocker(asProject(cases["사슬 없음"]!, "방탈출 게임 하나 만들어 줘"), "방탈출 게임 하나 만들어 줘")).toEqual([]);
    expect(actDepthMinBlocker(asProject(cases["사슬 없음"]!, "방 하나만 있는 게임 만들어줘"), "방 하나만 있는 게임 만들어줘")).toEqual([]);
  });
});
