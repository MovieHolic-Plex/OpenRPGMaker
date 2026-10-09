// test/regionChangeSummary.test.ts
// 영역 작업 제안의 "타일이 아닌 변경" 요약 — 이벤트 목록 + 영역 밖 변경 경고.
import { describe, expect, it } from "vitest";
import { SVG_ICON_NAMES } from "@/editor/panels/tileToolbarIcons";
import { createBlankProject } from "@/project/defaults";
import {
  regionEventChangeLabel,
  summarizeOutsideRegionChanges,
  summarizeRegionEventChanges,
} from "@/editor/regionTask/regionChangeSummary";
import type { GameEvent, MapId, Project, RegionRect } from "@/project/types";

const REGION: RegionRect = { x: 4, y: 4, width: 6, height: 6 };

function makeProject(): { project: Project; mapId: MapId } {
  const project = createBlankProject();
  return { project, mapId: project.startMapId };
}

function withEvents(base: Project, mapId: MapId, events: GameEvent[]): Project {
  const next: Project = structuredClone(base);
  next.maps[mapId]!.events = events;
  return next;
}

function npc(id: string, x: number, y: number, name?: string): GameEvent {
  return {
    id,
    x,
    y,
    trigger: "action",
    commands: [],
    sprite: { kind: "character", key: "villager", index: 0 } as never,
    ...(name ? { pages: [{ name, trigger: "action", priority: "same", commands: [], conditions: [] }] as never } : {}),
  } as GameEvent;
}

describe("summarizeRegionEventChanges", () => {
  it("영역 안에 새로 놓인 이벤트를 잡는다", () => {
    const { project, mapId } = makeProject();
    const proposed = withEvents(project, mapId, [npc("shop_merchant", 6, 6, "잡화점 주인")]);
    const changes = summarizeRegionEventChanges(project, proposed, mapId, REGION);
    expect(changes).toHaveLength(1);
    expect(changes[0]!.kind).toBe("added");
    expect(changes[0]!.name).toBe("잡화점 주인");
    expect(changes[0]!.icon).toBe("shop"); // id 에 shop → 상점 아이콘
    expect(SVG_ICON_NAMES).toContain(changes[0]!.icon);
    expect(regionEventChangeLabel(changes[0]!)).toContain("(6,6)");
    expect(regionEventChangeLabel(changes[0]!)).toContain("새로 놓임");
  });

  it("영역 밖에 놓인 이벤트는 목록에 넣지 않는다", () => {
    const { project, mapId } = makeProject();
    const proposed = withEvents(project, mapId, [npc("npc_far", 20, 20)]);
    expect(summarizeRegionEventChanges(project, proposed, mapId, REGION)).toHaveLength(0);
  });

  it("이동과 삭제를 구분한다", () => {
    const { project, mapId } = makeProject();
    const before = withEvents(project, mapId, [npc("npc_a", 5, 5), npc("npc_b", 7, 7)]);
    const after = withEvents(project, mapId, [npc("npc_a", 6, 5)]);
    const changes = summarizeRegionEventChanges(before, after, mapId, REGION);
    const byId = new Map(changes.map((change) => [change.eventId, change.kind]));
    expect(byId.get("npc_a")).toBe("moved");
    expect(byId.get("npc_b")).toBe("removed");
  });

  it("좌표는 같고 내용만 바뀌면 '내용 바뀜'", () => {
    const { project, mapId } = makeProject();
    const before = withEvents(project, mapId, [npc("npc_a", 5, 5, "경비")]);
    const after = withEvents(project, mapId, [npc("npc_a", 5, 5, "대장장이")]);
    const changes = summarizeRegionEventChanges(before, after, mapId, REGION);
    expect(changes).toHaveLength(1);
    expect(changes[0]!.kind).toBe("modified");
  });

  it("변경이 없으면 빈 목록", () => {
    const { project, mapId } = makeProject();
    expect(summarizeRegionEventChanges(project, structuredClone(project), mapId, REGION)).toHaveLength(0);
  });

  it("변경 아이콘이 SvgIconName 이고 라벨·이름에 이모지가 없다", () => {
    const { project, mapId } = makeProject();
    const proposed = withEvents(project, mapId, [npc("shop_merchant", 6, 6, "잡화점 주인")]);
    const changes = summarizeRegionEventChanges(project, proposed, mapId, REGION);
    for (const change of changes) {
      expect(SVG_ICON_NAMES).toContain(change.icon);
      expect(change.name).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(regionEventChangeLabel(change)).not.toMatch(/\p{Extended_Pictographic}/u);
    }
    const outside = summarizeOutsideRegionChanges(project, proposed, mapId);
    for (const row of outside) {
      expect(row.label).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});

describe("summarizeOutsideRegionChanges", () => {
  // 안전 관련 핵심: clipToRegion 은 영역 밖 **타일·이벤트만** 되돌린다. 아래 변경들은
  // 미리보기도 승인도 없이 통과하므로 최소한 목록에 드러나야 한다.
  it("타일만 바뀌면 영역 밖 변경이 없다", () => {
    const { project, mapId } = makeProject();
    const proposed: Project = structuredClone(project);
    proposed.maps[mapId]!.lowerTiles[0] = 999;
    expect(summarizeOutsideRegionChanges(project, proposed, mapId)).toHaveLength(0);
  });

  it("다른 맵 변경을 잡는다", () => {
    const { project, mapId } = makeProject();
    const otherId = Object.keys(project.maps).find((id) => id !== mapId);
    if (!otherId) {
      // 빈 프로젝트에 맵이 하나뿐이면 새 맵 추가 경로로 확인한다.
      const proposed: Project = structuredClone(project);
      proposed.maps["map_new"] = { ...structuredClone(project.maps[mapId]!), id: "map_new", name: "새 맵" } as never;
      const changes = summarizeOutsideRegionChanges(project, proposed, mapId);
      expect(changes.some((change) => change.kind === "map-added")).toBe(true);
      return;
    }
    const proposed: Project = structuredClone(project);
    proposed.maps[otherId]!.lowerTiles[0] = 999;
    const changes = summarizeOutsideRegionChanges(project, proposed, mapId);
    expect(changes.some((change) => change.kind === "map-changed")).toBe(true);
  });

  it("퀘스트·스위치 신규 등록을 개수 변화로 알린다", () => {
    const { project, mapId } = makeProject();
    const proposed: Project = structuredClone(project);
    proposed.switches = [...(proposed.switches ?? []), { id: "sw_new", name: "새 스위치" } as never];
    const changes = summarizeOutsideRegionChanges(project, proposed, mapId);
    const row = changes.find((change) => change.kind === "switches");
    expect(row).toBeTruthy();
    expect(row!.label).toContain("개 →");
  });

  it("타일셋 변경은 경고하지 않는다 — 배치에 필요한 보조 데이터라 매번 떠서 소음이 된다", () => {
    const { project, mapId } = makeProject();
    const proposed: Project = structuredClone(project);
    const tilesetId = Object.keys(proposed.tilesets)[0];
    if (tilesetId) {
      proposed.tilesets[tilesetId] = { ...proposed.tilesets[tilesetId]!, name: "바뀐 이름" } as never;
    }
    expect(summarizeOutsideRegionChanges(project, proposed, mapId)).toHaveLength(0);
  });
});
