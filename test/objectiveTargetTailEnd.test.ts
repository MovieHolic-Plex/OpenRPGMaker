// 목표 꼬리 「(<첫 맵> 입구: … → <거쳐 가는 맵>에서 … → <끝 맵> · <대상>)」 는 어느 맵에서 읽든 «끝»을 먼저 본다.
// 2026-11-12 r1 눈가림 플레이 여섯 판: 끝 맵(전당) 안에서 화살표가 온 길(마을로 나가는 문)을 가리켜 마을↔전당을 맴돌았다
// (openwiki/assistant-v2.md 「목표 꼬리는 끝부터 읽는다」).
import { describe, expect, it } from "vitest";
import { objectiveTargetViews, objectiveTextOnMap } from "@/player/objectiveTarget";
import type { RuntimeEventView } from "@/project/runtimeEventState";
import type { GameMap, Project } from "@/project/types";

type Ev = { id: string; name?: string; x: number; y: number; to?: string };
const mapOf = (id: string, name: string, events: Ev[]): GameMap => ({
  id, name, width: 20, height: 15,
  events: events.map((e) => ({ id: e.id, name: e.name ?? "", x: e.x, y: e.y, pages: [{ id: `${e.id}_p`, trigger: { kind: e.to ? "playerTouch" : "action" }, commands: e.to ? [{ kind: "transfer", mapId: e.to, x: 1, y: 1 }] : [{ kind: "text", body: "…" }] }] })),
}) as unknown as GameMap;
const viewsOf = (map: GameMap): RuntimeEventView[] => (map.events ?? []).map((event) => {
  const page = event.pages![0]!;
  return { event, page, pageId: page.id, x: event.x, y: event.y, trigger: page.trigger } as unknown as RuntimeEventView;
});

// 장터 ↔ 마을 ↔ 전당, 마을 ↔ 호수. 목표는 장터에서 걸렸다.
const market = mapOf("m_market", "겨울 장터", [{ id: "ev_gate_market_village", x: 0, y: 9, to: "m_village" }, { id: "ev_thor", name: "토르", x: 15, y: 12 }]);
const village = mapOf("m_village", "눈울타리 마을", [
  { id: "ev_gate_village_market", x: 19, y: 6, to: "m_market" }, { id: "ev_gate_village_hall", x: 10, y: 8, to: "m_hall" }, { id: "ev_gate_village_lake", x: 19, y: 12, to: "m_lake" },
  { id: "ev_record_copy", name: "선조의 기록", x: 3, y: 3 },
]);
const hall = mapOf("m_hall", "불씨의 전당", [{ id: "ev_gate_hall_village", x: 9, y: 14, to: "m_village" }, { id: "ev_record", name: "선조의 기록", x: 8, y: 3 }]);
const lake = mapOf("m_lake", "얼어붙은 호수", [{ id: "ev_gate_lake_village", x: 0, y: 7, to: "m_village" }]);
const project = { maps: { m_market: market, m_village: village, m_hall: hall, m_lake: lake } } as unknown as Pick<Project, "maps">;
const tail = "기록을 읽는다 (눈울타리 마을 입구: 이 맵 서쪽 끝 북쪽 편 → 눈울타리 마을에서 가운데 → 불씨의 전당 · 선조의 기록)";
const ids = (map: GameMap, text: string) => objectiveTargetViews(project, map, viewsOf(map), text).map((view) => view.event.id);

describe("objective tail is read from its end", () => {
  it("on the map where the objective was set: the first exit toward the end map", () => {
    expect(ids(market, tail)).toEqual(["ev_gate_market_village"]);
  });

  it("on the pass-through map: the door to the end map, not an event that only shares the target's name", () => {
    expect(ids(village, tail)).toEqual(["ev_gate_village_hall"]);
  });

  it("on the end map: the target event, never the door back to the map named 「입구」", () => {
    expect(ids(hall, tail)).toEqual(["ev_record"]);
  });

  it("on a map off the route: the first exit toward the end map", () => {
    expect(ids(lake, tail)).toEqual(["ev_gate_lake_village"]);
  });

  it("a target name that is only part of a map name is not read as that map", () => {
    // 「→ 전당」 은 이벤트 이름이다(맵 「불씨의 전당」 의 일부) — 끝 맵은 「입구」 맵이다.
    const hallNamed = mapOf("m_village2", "눈울타리 마을", [{ id: "ev_gate_v2_hall", x: 10, y: 8, to: "m_hall" }, { id: "ev_hall_sign", name: "전당", x: 4, y: 4 }]);
    const p2 = { maps: { m_market: market, m_village2: hallNamed, m_hall: hall } } as unknown as Pick<Project, "maps">;
    const got = objectiveTargetViews(p2, hallNamed, viewsOf(hallNamed), "전당 표지를 읽자 (눈울타리 마을 입구: 서쪽 → 전당)").map((view) => view.event.id);
    expect(got).toEqual(["ev_hall_sign"]);
  });

  it("keeps the one-hop tail behaviour: entrance door first, target after arriving", () => {
    const oneHop = "단서를 듣는다 (겨울 장터 입구: 이 맵 동쪽 끝 북쪽 편 → 토르)";
    expect(ids(village, oneHop)).toEqual(["ev_gate_village_market"]);
    expect(ids(market, oneHop)).toEqual(["ev_thor"]);
  });
});

describe("objectiveTextOnMap on the end map", () => {
  it("shows only the target once the hero stands on the end map of a pass-through tail", () => {
    expect(objectiveTextOnMap(hall, tail)).toBe("기록을 읽는다 (선조의 기록)");
  });

  it("still re-bases on the pass-through map and keeps the whole tail elsewhere", () => {
    expect(objectiveTextOnMap(village, tail)).toBe("기록을 읽는다 (불씨의 전당 입구: 가운데 → 선조의 기록)");
    expect(objectiveTextOnMap(market, tail)).toBe(tail);
  });
});
