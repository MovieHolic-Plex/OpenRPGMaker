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

  // 실측(2026-09-17 조수 로그 [33][37][59][61]): 「집 2개만들어」 처럼 **시작 맵** 하나만 범위로
  // 받은 빌더가 집 실내 맵을 새로 달면, 옮기기는 제대로 되는데 팀 보드에는 「범위 밖 변경 버림
  // (시공): mapTree」 가 떴다. 시작 맵은 mapTree 의 **루트**라서(blankProject: mapTree.mapId =
  // startMapId) 감사용 pruneSubtrees 가 루트 자신은 잘라내지 못하고, 루트 밑에 새로 달린 실내
  // 노드가 그대로 남아 base 와 달라 보인 것이다. 버려진 것이 없는데 버렸다고 말하는 거짓 보고다.
  it("시작 맵(트리 루트)에 실내 맵을 새로 달아도 spill 로 보고하지 않는다", () => {
    const base = createBlankProject();
    const rootId = base.mapTree.mapId;
    const a = clone(base);
    for (const [id, name] of [["map_house_a_inner", "엘런의 집"], ["map_house_b_inner", "바르톨의 집"]] as const) {
      a.maps[id] = { ...clone(a.maps[rootId]!), id, name };
      a.mapTree.children.push({ mapId: id, children: [] });
    }

    const merged = mergeMapBundles(base, [{ mapIds: [rootId], project: a }]);

    expect(merged.spills).toEqual([]);
    expect(merged.project.maps.map_house_a_inner?.name).toBe("엘런의 집");
    expect(merged.project.maps.map_house_b_inner?.name).toBe("바르톨의 집");
    expect(mapBundleIds(merged.project, rootId)).toEqual(expect.arrayContaining(["map_house_a_inner", "map_house_b_inner"]));
    expect(commitChangeset(merged.project, base).ok).toBe(true);
  });

  // 경계 고정: 부분 트리를 비우는 것은 **묶음 루트 아래**에만 적용된다. 묶음 밖 맵을 트리에서
  // 떼는 것은 여전히 범위 밖 편집이라 버리고 보고해야 한다 — 아니면 감사가 트리 전체에 눈을 감는다.
  it("묶음 밖 맵을 트리에서 뗀 것은 옮기지 않고 spill 로 보고한다", () => {
    const base = seed();
    const a = clone(base);
    a.mapTree.children = a.mapTree.children.filter((node) => node.mapId !== "map_west");

    const merged = mergeMapBundles(base, [{ mapIds: ["map_east"], project: a }]);

    expect(merged.spills).toEqual([{ mapIds: ["map_east"], keys: ["mapTree"] }]);
    expect(merged.project.mapTree.children.some((node) => node.mapId === "map_west")).toBe(true);
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

  // 실측(2026-09-18): 집·여관 시공은 기존 타일셋에 이식을 민다(`village/builder.ts` 의
  // `ensureInnSignGraft` — combined_town 에 없는 여관 간판을 슬롯 443 에 이식). `createdByKey` 는
  // «새 타일셋» 만 옮기므로 그 이식이 통째로 버려졌는데 **커밋 게이트는 통과**했다. 맵은 443 을
  // 깔았지만 이식이 없어 엉뚱한 타일이 그려진 채 저장된다.
  it("묶음이 기존 타일셋에 덧댄 이식은 함께 옮긴다", () => {
    const base = seed();
    const tilesetId = base.maps.map_east!.tilesetId;
    // 기본 타일셋이 이미 443 에 이식을 싣고 온다 — 비어 있는 슬롯을 고른다.
    const taken = new Set((base.tilesets[tilesetId]!.tileGrafts ?? []).map((entry) => entry.targetTile));
    const free = [...Array(base.tilesets[tilesetId]!.count).keys()].reverse().find((tile) => !taken.has(tile))!;
    const graft = { targetTile: free, sourceChipset: "tex_easyrpg_chipset_retro_house", sourceTile: 443 };
    const a = clone(base);
    const tileset = a.tilesets[tilesetId]!;
    tileset.tileGrafts = [...(tileset.tileGrafts ?? []), graft];

    const merged = mergeMapBundles(base, [{ mapIds: ["map_east"], project: a }]);

    expect(merged.project.tilesets[tilesetId]?.tileGrafts).toContainEqual(graft);
    expect(merged.spills).toEqual([]);
    expect(commitChangeset(merged.project, base).ok).toBe(true);
  });

  // 실측(2026-09-23 추리 도그푸딩): author_village 가 기존 타일셋 끝을 넘는 슬롯에 이식하며
  // count·타일별 배열을 늘렸는데, 병합이 이식만 옮겨 게이트가 `targetTile out of range (count 확장 누락)` 로
  // 에이전트 작업 전체를 거부했다.
  it("이식이 기존 타일셋을 늘렸으면 늘린 꼬리까지 함께 옮긴다", () => {
    const base = seed();
    const tilesetId = base.maps.map_east!.tilesetId;
    const a = clone(base);
    const tileset = a.tilesets[tilesetId]!;
    const oldCount = tileset.count;
    const newCount = oldCount + tileset.tilesPerRow;
    while (tileset.passability.length < newCount) tileset.passability.push({ up: false, down: false, left: false, right: false });
    while (tileset.priority.length < newCount) tileset.priority.push("upper");
    while (tileset.terrain.length < newCount) tileset.terrain.push(0);
    if (tileset.tileMeta) while (tileset.tileMeta.length < newCount) tileset.tileMeta.push({ label: "이식", description: "", source: "unknown" });
    tileset.count = newCount;
    const graft = { targetTile: oldCount + 2, sourceChipset: "tex_easyrpg_chipset_retro_house", sourceTile: 12 };
    tileset.tileGrafts = [...(tileset.tileGrafts ?? []), graft];

    const merged = mergeMapBundles(base, [{ mapIds: ["map_east"], project: a }]);

    expect(merged.project.tilesets[tilesetId]).toEqual(tileset);
    expect(merged.spills).toEqual([]);
    expect(commitChangeset(merged.project, base).ok).toBe(true);
  });

  it("묶음 안 맵으로 옮긴 시작 위치는 함께 옮기고, 묶음 밖 맵이면 버린다", () => {
    const base = seed();
    const inside = clone(base);
    inside.startMapId = "map_east";
    inside.startPos = { x: 3, y: 4 };
    const kept = mergeMapBundles(base, [{ mapIds: ["map_east"], project: inside }]);
    expect([kept.project.startMapId, kept.project.startPos]).toEqual(["map_east", { x: 3, y: 4 }]);
    expect(kept.spills).toEqual([]);

    const outside = clone(base);
    outside.startMapId = "map_west";
    outside.startPos = { x: 1, y: 1 };
    const dropped = mergeMapBundles(base, [{ mapIds: ["map_east"], project: outside }]);
    expect([dropped.project.startMapId, dropped.project.startPos]).toEqual([base.startMapId, base.startPos]);
    expect(dropped.spills[0]?.keys).toEqual(expect.arrayContaining(["startMapId", "startPos"]));
  });

  // 경계 고정: 옮기는 것은 «덧댄 것» 뿐이다. 기존 이식을 갈아치우거나 타일셋의 다른 데이터를
  // 고치는 것은 범위 밖 편집이라 버리고 보고해야 한다 — 저작 범위 규칙과 같은 모양이다
  // (`authorVillageScope.allowedTargetTilesetChange`).
  it("기존 이식 교체와 타일셋의 다른 변경은 옮기지 않고 spill 로 보고한다", () => {
    const base = seed();
    const tilesetId = base.maps.map_east!.tilesetId;
    base.tilesets[tilesetId]!.tileGrafts = [{ targetTile: 443, sourceChipset: "tex_a", sourceTile: 443 }];

    const 교체 = clone(base);
    교체.tilesets[tilesetId]!.tileGrafts = [{ targetTile: 443, sourceChipset: "tex_다른것", sourceTile: 7 }];
    const 이름변경 = clone(base);
    이름변경.tilesets[tilesetId]!.name = "남의 타일셋";

    for (const project of [교체, 이름변경]) {
      const merged = mergeMapBundles(base, [{ mapIds: ["map_east"], project }]);
      expect(merged.spills).toEqual([{ mapIds: ["map_east"], keys: ["tilesets"] }]);
      expect(merged.project.tilesets[tilesetId]).toEqual(base.tilesets[tilesetId]);
    }
  });

  // 불변식. 이 한 줄이 있었으면 mapTree 거짓 보고는 애초에 못 나왔다 — 「버렸다」고 말한 키는
  // 병합본에 반영되어 있으면 안 된다. 시나리오를 늘릴 때마다 여기에 태운다.
  it("보고한 spill 키는 병합본에 반영되어 있지 않다", () => {
    const read = (project: Project, key: string): string => {
      if (key.startsWith("maps.")) return JSON.stringify(project.maps?.[key.slice("maps.".length)]);
      return JSON.stringify((project as unknown as Record<string, unknown>)[key]);
    };
    const base = seed();
    const rootId = base.mapTree.mapId;

    const 실내추가 = clone(base);
    실내추가.maps.map_root_inner = { ...clone(실내추가.maps[rootId]!), id: "map_root_inner", name: "루트 실내" };
    실내추가.mapTree.children.push({ mapId: "map_root_inner", children: [] });

    const 남의맵 = clone(base);
    남의맵.maps.map_west!.name = "남의 맵";
    (남의맵 as { startMapId?: string }).startMapId = "map_west";

    const 트리뗌 = clone(base);
    트리뗌.mapTree.children = 트리뗌.mapTree.children.filter((node) => node.mapId !== "map_west");

    for (const [이름, mapIds, project] of [
      ["루트에 실내 추가", [rootId], 실내추가],
      ["남의 맵 편집", ["map_east"], 남의맵],
      ["묶음 밖 트리 뗌", ["map_east"], 트리뗌],
    ] as const) {
      const merged = mergeMapBundles(base, [{ mapIds, project }]);
      for (const spill of merged.spills) {
        for (const key of spill.keys) {
          expect(read(merged.project, key), `${이름}: ${key} 는 병합본에 없어야 보고가 참이다`)
            .not.toBe(read(project, key));
        }
      }
    }
  });

  // 비동기 배정에서 A 가 먼저 병합되면 병합본은 B 의 사본보다 앞서 나간다. 그 차이를 B 의
  // 「버림」으로 보고하면 팀 보드에 없는 경고가 뜬다 — 보고 기준은 각자의 출발 사본이다.
  it("여러 결과가 각자 실내 맵을 달아도 서로를 spill 로 보고하지 않는다", () => {
    const base = seed();
    const snapshot = clone(base);
    const mk = (mapId: string, innerId: string, name: string): Project => {
      const next = clone(snapshot);
      next.maps[innerId] = { ...clone(next.maps[mapId]!), id: innerId, name };
      next.mapTree.children.find((node) => node.mapId === mapId)!.children.push({ mapId: innerId, children: [] });
      return next;
    };

    const merged = mergeMapBundles(base, [
      { mapIds: ["map_east"], project: mk("map_east", "map_east_inner", "동쪽 실내"), base: snapshot },
      { mapIds: ["map_west"], project: mk("map_west", "map_west_inner", "서쪽 실내"), base: snapshot },
    ]);

    expect(merged.spills).toEqual([]);
    expect(merged.project.maps.map_east_inner?.name).toBe("동쪽 실내");
    expect(merged.project.maps.map_west_inner?.name).toBe("서쪽 실내");
    expect(commitChangeset(merged.project, base).ok).toBe(true);
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
