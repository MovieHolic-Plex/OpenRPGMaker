import { describe, expect, it } from "vitest";
import { countedContent } from "../scripts/fs-scale/score.mjs";
import { countMaps, MIN_COUNTED_MAPS, MIN_MAP_CELLS, MIN_TILE_KINDS } from "@/ai/v2/mapCount";
import { mapsMinBlocker } from "@/ai/v2/shipChecks";
import { splitPreexisting } from "@/ai/v2/judge/gates";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

// 2026-11-10 오너 「맵을 가장 우선」: 끝맺음 관문이 세는 맵 6장을 강제한다(4 → 6, 한 번에 한 단계). 맵을 세는 규칙은 완성도 척도(scripts/fs-scale/score.mjs)와 같아야 하고,
// 못 센 맵은 이유와 함께 문구에 실린다. 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(CI 에서 돈다).

type Doc = Record<string, unknown>;
const tiles = (n: number, kinds: number, seed = 0) => Array.from({ length: n }, (_, i) => (i % kinds) + seed);
function event(id: string, commands: unknown[]) {
  return { id, name: id, x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [{ id: `${id}_p`, conditions: [], trigger: { kind: "action" }, commands }] };
}
const transferTo = (mapId: string) => ({ kind: "transfer", mapId, x: 1, y: 1 });
const say = (body: string) => ({ kind: "text", speaker: "누군가", body });
function map(id: string, opts: { w?: number; h?: number; kinds?: number; seed?: number; events?: unknown[] } = {}) {
  const w = opts.w ?? 12, h = opts.h ?? 10;
  return { id, name: `맵 ${id}`, width: w, height: h, tilesetId: "ts_a", lowerTiles: tiles(w * h, opts.kinds ?? 8, opts.seed ?? 0), upperTiles: Array(w * h).fill(-1), events: opts.events ?? [event(`ev_${id}`, [say(`안녕 ${id}`)])] };
}
function doc(maps: Record<string, unknown>, extra: Doc = {}): Doc {
  return { startMapId: "m1", maps, commonEvents: [], endings: [], quests: [], database: {}, system: {}, meta: {}, ...extra };
}
const ids = (rows: { id: string }[]) => rows.map((r) => r.id).sort();

const cases: Record<string, Doc> = {
  "시작 맵 하나": doc({ m1: map("m1") }),
  "문으로 이어진 네 장": doc({ m1: map("m1", { events: [event("a", [transferTo("m2")]), event("b", [say("x")])] }), m2: map("m2", { seed: 1, events: [event("c", [transferTo("m3")]), event("d", [say("y")])] }), m3: map("m3", { seed: 2, events: [event("e", [transferTo("m4")]), event("f", [say("z")])] }), m4: map("m4", { seed: 3 }) }),
  "문으로 이어진 여섯 장": doc({ m1: map("m1", { events: [event("a", [transferTo("m2")]), event("b", [say("x")])] }), m2: map("m2", { seed: 1, events: [event("c", [transferTo("m3")]), event("d", [say("y")])] }), m3: map("m3", { seed: 2, events: [event("e", [transferTo("m4")]), event("f", [say("z")])] }), m4: map("m4", { seed: 3, events: [event("g", [transferTo("m5")]), event("h", [say("w")])] }), m5: map("m5", { seed: 4, events: [event("i", [transferTo("m6")]), event("j", [say("v")])] }), m6: map("m6", { seed: 5 }) }),
  "문이 없어 안 닿는 맵": doc({ m1: map("m1"), m2: map("m2", { seed: 1 }) }),
  "넓이 모자란 맵": doc({ m1: map("m1", { events: [event("a", [transferTo("m2")])] }), m2: map("m2", { w: 9, h: 8, seed: 1 }) }),
  "타일 종류 모자란 맵": doc({ m1: map("m1", { events: [event("a", [transferTo("m2")])] }), m2: map("m2", { kinds: 3, seed: 1 }) }),
  "명령 든 이벤트 없는 맵": doc({ m1: map("m1", { events: [event("a", [transferTo("m2")])] }), m2: map("m2", { seed: 1, events: [event("e", [])] }) }),
  "배치를 복사한 맵": doc({ m1: map("m1", { events: [event("a", [transferTo("m2")])] }), m2: map("m2", { events: [event("b", [say("복사")])] }) }),
};

describe("세는 맵 — 완성도 척도(score.mjs countedContent)와 같은 규칙", () => {
  for (const [name, d] of Object.entries(cases)) {
    it(`${name}: 센 맵 집합이 척도와 같다`, () => {
      expect(ids(countMaps(d as unknown as Project).counted.map((id) => ({ id })))).toEqual(ids(countedContent(d).countedMaps));
    });
  }
  it("못 센 맵은 이유와 함께 나온다(안 닿음·좁음·타일 적음·이벤트 없음·복사)", () => {
    const reasons = (d: Doc) => countMaps(d as unknown as Project).uncounted.map((m) => m.reason);
    expect(reasons(cases["문이 없어 안 닿는 맵"]!)).toEqual(["unreachable"]);
    expect(reasons(cases["넓이 모자란 맵"]!)).toEqual(["small"]);
    expect(reasons(cases["타일 종류 모자란 맵"]!)).toEqual(["few-tiles"]);
    expect(reasons(cases["명령 든 이벤트 없는 맵"]!)).toEqual(["no-event"]);
    expect(reasons(cases["배치를 복사한 맵"]!)).toEqual(["copy"]);
    expect(MIN_MAP_CELLS).toBe(100); expect(MIN_TILE_KINDS).toBe(6);
  });
});

describe("maps-min 출하 차단", () => {
  const whole = "포켓몬 같은 몬스터 수집 모험 게임 만들어줘";
  const asProject = (d: Doc, request = whole): Project => { const p = createBlankProject() as unknown as Doc; Object.assign(p, d, { gameBlueprint: { request, title: "t", genre: "g", premise: "p", playerGoal: "g", steps: [], ending: { name: "e", how: "h", feeling: "f" } } }); return p as unknown as Project; };
  it("세는 맵이 모자라면 장수·부족분·못 센 이유·make_place 를 한 문장에 싣는다", () => {
    const [b] = mapsMinBlocker(asProject(cases["넓이 모자란 맵"]!), whole);
    expect(b!.id).toBe("maps-min");
    expect(b!.message).toContain(`1/${MIN_COUNTED_MAPS}장`);
    expect(b!.message).toContain(`${MIN_COUNTED_MAPS - 1}장 더`);
    expect(b!.message).toContain("넓이 72칸<100");
    expect(b!.message).toContain("make_place");
  });
  it("세는 맵이 최소 수 이상이면 차단이 없다", () => {
    expect(mapsMinBlocker(asProject(cases["문으로 이어진 여섯 장"]!), whole)).toEqual([]);
  });
  it("네 장은 더 이상 통과하지 않는다 — 최소 6장(오너 「맵을 가장 우선」, 4 에서 한 단계 올림)", () => {
    expect(MIN_COUNTED_MAPS).toBe(6);
    const [b] = mapsMinBlocker(asProject(cases["문으로 이어진 네 장"]!), whole);
    expect(b!.message).toContain("4/6장");
    expect(b!.message).toContain("2장 더");
  });
  it("방 하나짜리 게임(방탈출)은 한 장이면 통과한다", () => {
    expect(mapsMinBlocker(asProject(cases["시작 맵 하나"]!, "방 하나만 있는 방탈출 게임 만들어줘"), "방 하나만 있는 방탈출 게임 만들어줘")).toEqual([]);
  });
  it("안 세는 맵 이름이 달라도 할 일 항목의 열쇠(문구 앞 160자, 숫자는 #)는 같다 — 3번 뒤 막힘이 걸리려면 열쇠가 안정해야 한다", () => {
    const key = (text: string) => text.replace(/\d+/gu, "#").replace(/\s+/gu, " ").trim().slice(0, 160);
    const named = (name: string): Doc => doc({ m1: map("m1", { events: [event("a", [transferTo("m2")])] }), m2: { ...map("m2", { w: 9, h: 8, seed: 1 }), name } });
    const [x] = mapsMinBlocker(asProject(named("창고")), whole), [y] = mapsMinBlocker(asProject(named("지하 통로의 아주 긴 이름")), whole);
    expect(key(`[출하 차단 ${x!.id}] ${x!.message}`)).toBe(key(`[출하 차단 ${y!.id}] ${y!.message}`));
    expect(x!.message).toContain("창고");
    expect(y!.message).toContain("지하 통로");
  });
  it("이어 하는 턴에서도 «기존 결함» 으로 면제되지 않는다(시작 저장본에 이미 있어도 이번 턴이 끝낼 일)", () => {
    const text = "[출하 차단 maps-min] 세는 맵이 1/6장이다 — 5장 더.";
    const problem = { key: "game:" + text.replace(/\d+/gu, "#"), text, source: "gate" as const };
    const { current, preexisting } = splitPreexisting([problem], new Set([problem.key]), undefined, undefined);
    expect(current).toHaveLength(1);
    expect(preexisting).toHaveLength(0);
  });
});
