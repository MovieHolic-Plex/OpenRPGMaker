import { describe, expect, it } from "vitest";
import { mapBundleIds, mapBundleSpill, mergeMapBundles } from "@/ai/piAgent/mapBundle";
import { changedProjectKeys, createPiAgentLineDecoder, encodePiAgentEvent } from "@/ai/piAgent/protocol";
import { commitChangeset } from "@/editor/tools";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}


function seed(): Project {
  const ctx = { project: createBlankProject() };
  for (const [id, name] of [["map_east", "동쪽"], ["map_west", "서쪽"]] as const) {
    const result = runTool(ctx, "create_map", { id, name, width: 20, height: 16 });
    if (!result.ok) throw new Error(result.summary);
  }
  return ctx.project;
}


describe("piAgent mapBundle", () => {
  it("묶음은 맵 + mapTree 아래 파생 맵이다", () => {
    const base = seed();
    const result = clone(base);
    result.maps.map_east_inner = { ...clone(result.maps.map_east!), id: "map_east_inner", name: "실내" };
    const eastNode = result.mapTree.children.find((node) => node.mapId === "map_east")!;
    eastNode.children.push({ mapId: "map_east_inner", children: [] });
    expect(mapBundleIds(result, "map_east").sort()).toEqual(["map_east", "map_east_inner"]);
    expect(mapBundleIds(result, "map_west")).toEqual(["map_west"]);
    expect(mapBundleIds(result, "nope")).toEqual(["nope"]);
  });

  it("실내 맵과 mapTree 항목까지 함께 옮기고, 다른 결과와 합쳐도 게이트를 통과한다", () => {
    const base = seed();
    const a = clone(base);
    a.maps.map_east!.name = "동쪽 (A)";
    a.maps.map_east_inner = { ...clone(a.maps.map_east!), id: "map_east_inner", name: "동쪽 실내" };
    a.mapTree.children.find((node) => node.mapId === "map_east")!.children.push({ mapId: "map_east_inner", children: [] });
    const b = clone(base);
    b.maps.map_west!.name = "서쪽 (B)";

    const merged = mergeMapBundles(base, [
      { mapIds: ["map_east"], project: a },
      { mapIds: ["map_west"], project: b },
    ]);
    expect(merged.spills).toEqual([]);
    expect(merged.conflicts).toEqual([]);
    expect(merged.project.maps.map_east!.name).toBe("동쪽 (A)");
    expect(merged.project.maps.map_west!.name).toBe("서쪽 (B)");
    expect(merged.project.maps.map_east_inner?.name).toBe("동쪽 실내");
    expect(mapBundleIds(merged.project, "map_east").sort()).toEqual(["map_east", "map_east_inner"]);
    expect(changedProjectKeys(base, merged.project).sort()).toEqual(["mapTree", "maps.map_east", "maps.map_east_inner", "maps.map_west"]);
    const gate = commitChangeset(merged.project, base);
    expect(gate.ok).toBe(true);
  });

  it("묶음 밖 변경은 버리고 spill 로 보고한다", () => {
    const base = seed();
    const a = clone(base);
    a.maps.map_east!.name = "동쪽 (A)";
    a.maps.map_west!.name = "남의 맵";
    (a as { startMapId?: string }).startMapId = "map_west";
    const merged = mergeMapBundles(base, [{ mapIds: ["map_east"], project: a }]);
    expect(merged.spills).toEqual([{ mapIds: ["map_east"], keys: ["maps.map_west", "startMapId"] }]);
    expect(merged.project.maps.map_west!.name).toBe(base.maps.map_west!.name);
    expect(merged.project.startMapId).toBe(base.startMapId);
    expect(mapBundleSpill(base, a, ["map_east", "map_west"])).toEqual(["startMapId"]);
  });

  it("같은 맵을 두 결과가 주장하면 뒤의 것이 이기고 conflicts 로 보고한다", () => {
    const base = seed();
    const a = clone(base); a.maps.map_east!.name = "A";
    const b = clone(base); b.maps.map_east!.name = "B";
    const merged = mergeMapBundles(base, [{ mapIds: ["map_east"], project: a }, { mapIds: ["map_east"], project: b }]);
    expect(merged.conflicts).toEqual(["map_east"]);
    expect(merged.project.maps.map_east!.name).toBe("B");
  });

  // 깨질 것: 비동기 배정에서 에이전트는 자기가 출발한 사본을 기준으로 판정해야 한다. 병합 시점의
  // working 을 기준으로 삼으면, 그 사이 다른 에이전트가 남의 맵을 병합했다는 이유만으로 멀쩡한
  // 결과가 "범위 밖 변경"으로 보고된다(팀 보드에 없는 경고가 뜬다).
  it("결과의 출발 사본을 주면 그 사이 남이 바꾼 맵을 spill 로 오인하지 않는다", () => {
    const base = seed();
    const snapshot = clone(base);
    const east = clone(snapshot);
    east.maps.map_east!.name = "동쪽 (A)";

    // A 가 도는 동안 B 가 map_west 를 이미 병합해 working 이 앞서 나갔다.
    const working = clone(base);
    working.maps.map_west!.name = "서쪽 (B)";

    const withoutBase = mergeMapBundles(working, [{ mapIds: ["map_east"], project: east }]);
    expect(withoutBase.spills).toEqual([{ mapIds: ["map_east"], keys: ["maps.map_west"] }]);

    const merged = mergeMapBundles(working, [{ mapIds: ["map_east"], project: east, base: snapshot }]);
    expect(merged.spills).toEqual([]);
    expect(merged.project.maps.map_east!.name).toBe("동쪽 (A)");
    expect(merged.project.maps.map_west!.name).toBe("서쪽 (B)");
  });

  // 실측(2026-09-14): 묶음이 맵만 옮기고 **그 맵이 만든 스위치 정의를 버리면**, 병합본은
  // 자기 이벤트가 가리키는 스위치가 없는 프로젝트가 된다. 커밋 게이트가 serialize 왕복에서
  // 그걸 잡아 `/pi` 는 "적용 실패(commit-rejected): 직렬화 왕복 실패: setSwitch: switchId가
  // 존재하지 않습니다: …" 로 **에이전트가 한 일 전부를 거부**했다.
  it("묶음이 만든 스위치 정의는 함께 옮겨 커밋 게이트를 통과한다", () => {
    const base = seed();
    const ctx = { project: clone(base) };
    const blocked = runTool(ctx, "place_battle_blocker", {
      mapId: "map_east",
      x: 4,
      y: 4,
      troopId: ctx.project.database.troops[0]!.id,
    });
    expect(blocked.ok).toBe(true);
    const { eventId, clearSwitchId } = (blocked.data ?? {}) as { eventId: string; clearSwitchId: string };
    expect(ctx.project.switches.some((entry) => entry.id === clearSwitchId)).toBe(true);

    const merged = mergeMapBundles(base, [{ mapIds: ["map_east"], project: ctx.project }]);

    expect(merged.project.maps.map_east!.events.some((event) => event.id === eventId)).toBe(true);
    expect(merged.project.switches.some((entry) => entry.id === clearSwitchId)).toBe(true);
    expect(merged.spills).toEqual([]);
    expect(commitChangeset(merged.project, base).ok).toBe(true);
  });

  // 경계 고정: 옮기는 것은 «만든 것» 뿐이다. 기존 정의를 고치는 것은 묶음 밖 편집이라
  // 지금처럼 버리고 spill 로 보고해야 한다 — 아니면 범위 계약이 스위치 탭까지 새어 나간다.
  it("묶음 밖에서 기존 스위치를 고친 것은 옮기지 않고 spill 로 보고한다", () => {
    const base = seed();
    const seeded = base.switches[0] ?? { id: "sw_scope_probe", name: "범위 탐침" };
    if (base.switches.length === 0) base.switches.push(seeded);
    const a = clone(base);
    a.switches.find((entry) => entry.id === seeded.id)!.name = "남의 스위치";

    const merged = mergeMapBundles(base, [{ mapIds: ["map_east"], project: a }]);

    expect(merged.project.switches.find((entry) => entry.id === seeded.id)!.name).toBe(seeded.name);
    expect(merged.spills).toEqual([{ mapIds: ["map_east"], keys: ["switches"] }]);
  });

  it("NDJSON 디코더는 조각 경계와 깨진 줄을 견딘다", () => {
    const events: string[] = [];
    const decoder = createPiAgentLineDecoder((event) => events.push(event.type));
    const wire = encodePiAgentEvent({ type: "turn", index: 1 }) + encodePiAgentEvent({ type: "assistant", text: "안녕" });
    decoder.push(wire.slice(0, 7));
    decoder.push(wire.slice(7));
    decoder.push("{not json\n");
    decoder.push('{"type":"error","message":"x"}');
    decoder.flush();
    expect(events).toEqual(["turn", "assistant", "error"]);
  });
});
