// 맵 진입 BGM 해석 — GameMap.bgm 이 실제로 소리로 이어지는지 지키는 가드.
// 배경: bgm 타입과 에디터 UI 는 있었지만 플레이어가 읽는 곳이 없어 게임이 무음이었다.
import { describe, expect, it } from "vitest";
import {
  mapAncestorIds,
  resolveMapBgm,
  applyMapBgmToSession,
  FALLBACK_BGM_RESOURCE_ID,
} from "@/player/mapBgm";
import type { GameMap, MapBgmSetting, MapTreeNode } from "@/project/types";

function map(id: string, bgm?: MapBgmSetting): GameMap {
  return { id, name: id, width: 1, height: 1, lowerTiles: [0], upperTiles: [-1], events: [], tilesetId: "t", bgm } as unknown as GameMap;
}

// 루트 → 지역 → 마을 → 여관 4단 트리. 상속 체인을 실제로 타는지 보려면 2단 이상이어야 한다.
const TREE: MapTreeNode = {
  mapId: "root",
  children: [
    { mapId: "region", children: [{ mapId: "town", children: [{ mapId: "inn", children: [] }] }] },
    { mapId: "orphanless", children: [] },
  ],
};

function project(maps: GameMap[], defaultBgmResourceId?: string) {
  return {
    maps: Object.fromEntries(maps.map((m) => [m.id, m])),
    mapTree: TREE,
    system: { defaultBgmResourceId },
  } as unknown as Parameters<typeof resolveMapBgm>[0];
}

describe("resolveMapBgm", () => {
  it("custom 은 지정 곡을 그대로 쓴다", () => {
    const p = project([map("inn", { mode: "custom", resourceId: "bgm-inn", fadeInMs: 800 })]);
    expect(resolveMapBgm(p, "inn")).toEqual({ kind: "play", resourceId: "bgm-inn", fadeInMs: 800 });
  });

  it("none 은 무음이며 부모로 상속하지 않는다", () => {
    const p = project([
      map("town", { mode: "custom", resourceId: "bgm-town" }),
      map("inn", { mode: "none" }),
    ]);
    expect(resolveMapBgm(p, "inn")).toEqual({ kind: "silence" });
  });

  it("parent 는 가장 가까운 조상의 결정을 따른다", () => {
    const p = project([
      map("region", { mode: "custom", resourceId: "bgm-field" }),
      map("town", { mode: "custom", resourceId: "bgm-town" }),
      map("inn", { mode: "parent" }),
    ]);
    // region 이 아니라 town — 가까운 쪽이 이겨야 한다.
    expect(resolveMapBgm(p, "inn")).toEqual({ kind: "play", resourceId: "bgm-town" });
  });

  it("bgm 미지정 맵도 조상 곡을 물려받는다", () => {
    const p = project([map("region", { mode: "custom", resourceId: "bgm-field" }), map("inn")]);
    expect(resolveMapBgm(p, "inn")).toEqual({ kind: "play", resourceId: "bgm-field" });
  });

  it("조상 중 아무도 정하지 않으면 프로젝트 기본으로 떨어진다", () => {
    const p = project([map("inn", { mode: "parent" })], "bgm-default");
    expect(resolveMapBgm(p, "inn")).toEqual({ kind: "play", resourceId: "bgm-default" });
  });

  it("프로젝트 기본이 없어도 내장 폴백으로 소리가 난다 — 기존 프로젝트는 이 필드를 영원히 갖지 않는다", () => {
    // 실측: 샘플 게임은 동결된 JSON fixture 라 defaultBgmResourceId 가 없다.
    // 폴백이 없으면 기존 게임 전부가 계속 무음이었다.
    expect(resolveMapBgm(project([map("inn")]), "inn")).toEqual({
      kind: "play",
      resourceId: FALLBACK_BGM_RESOURCE_ID,
    });
  });

  it("명시적 none 은 폴백보다 우선한다 — 침묵의 탈출구가 남아 있어야 한다", () => {
    expect(resolveMapBgm(project([map("inn", { mode: "none" })]), "inn")).toEqual({ kind: "silence" });
  });

  it("custom 인데 resourceId 가 비면 지정이 없는 것으로 보고 상속한다", () => {
    const p = project([
      map("region", { mode: "custom", resourceId: "bgm-field" }),
      map("inn", { mode: "custom", resourceId: "   " }),
    ]);
    expect(resolveMapBgm(p, "inn")).toEqual({ kind: "play", resourceId: "bgm-field" });
  });

  it("트리에 없는 고아 맵은 조상이 없어 프로젝트 기본을 쓴다", () => {
    const p = project([map("nowhere", { mode: "parent" })], "bgm-default");
    expect(resolveMapBgm(p, "nowhere")).toEqual({ kind: "play", resourceId: "bgm-default" });
  });
});

describe("mapAncestorIds", () => {
  it("가까운 부모부터 뿌리 방향으로 반환한다", () => {
    expect(mapAncestorIds(TREE, "inn")).toEqual(["town", "region", "root"]);
  });

  it("트리에 없는 맵은 빈 배열이다", () => {
    expect(mapAncestorIds(TREE, "nowhere")).toEqual([]);
  });
});

describe("applyMapBgmToSession", () => {
  it("재생은 세션에 기록한다 — 전투 진입 시 필드 BGM 복원과 세이브가 이 값을 쓴다", () => {
    const audio: { bgm?: { resourceId: string; loop: boolean } } = {};
    applyMapBgmToSession(audio, { kind: "play", resourceId: "bgm-town" });
    expect(audio.bgm).toEqual({ resourceId: "bgm-town", loop: true });
  });

  it("무음은 세션 값을 지운다", () => {
    const audio: { bgm?: { resourceId: string; loop: boolean } } = { bgm: { resourceId: "x", loop: true } };
    applyMapBgmToSession(audio, { kind: "silence" });
    expect(audio.bgm).toBeUndefined();
  });
});
