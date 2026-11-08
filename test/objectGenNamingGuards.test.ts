// 2026-11-08 실험 2(terra-game-strategy B1 · B4): 공방 기물 도구의 두 분류 구멍.
//
// B1 — 기존 거절 규칙은 이름 «끝 낱말» 하나만 맞으면 «이미 있는 물건»으로 보고 그리기를 거부했다.
// terra-new-tileset 3판 실측: 「막대사탕 나무」→나무 벤치·도마·기둥, 「사탕지팡이 울타리」→산울타리 로 3판 모두 그리기 0회.
// 끝 낱말은 재질을 말할 뿐이라 그것만으로 같은 물건이 아니다 — 전체 이름이나 «앞 낱말(종류를 정하는 말)» 이 맞을 때만 거절한다.
// B4 — 「과자 나라 전용 타일셋」이 1×1 바닥 기물로 가서 공방 3/4 관문에서 떨어졌다(실측). 타일셋은 지형이다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { buildObjectGenRequest } from "@/editor/tools/objectGenTool";

function interiorProjectWithBench(): { project: ReturnType<typeof createBlankProject>; mapId: string } {
  const project = createBlankProject();
  const mapId = project.startMapId;
  const map = project.maps[mapId]!;
  const tileset = project.tilesets[map.tilesetId]!;
  const kits = (tileset.structureKits ??= []);
  kits.push(
    { id: "kit:bench_wood", name: "나무 벤치", width: 2, height: 1 } as (typeof kits)[number],
    { id: "kit:hedge", name: "산울타리", width: 2, height: 1 } as (typeof kits)[number],
  );
  return { project, mapId };
}

const args = (title: string, mapId: string) => ({ mapId, title, description: "테마 기물", objectKind: "floor", need: "테마 마을" }) as Record<string, unknown>;

describe("object-gen naming guards (B1 · B4)", () => {
  it("a title whose last word matches an unrelated object is drawn, not refused (B1)", () => {
    const { project, mapId } = interiorProjectWithBench();
    // 「막대사탕 나무」 끝 낱말은 「나무」 — 나무 벤치와는 다른 물건이다.
    const result = buildObjectGenRequest(project, args("막대사탕 나무", mapId));
    expect(result.data).toMatchObject({ kind: "workshop-object-request", title: "막대사탕 나무" });
    expect(result.summary).toContain("비슷한 이름의 기물");
  });

  it("a title that really is the existing object is still refused (B1 keeps its purpose)", () => {
    const { project, mapId } = interiorProjectWithBench();
    expect(() => buildObjectGenRequest(project, args("나무 벤치", mapId))).toThrowError(/이미 있다/);
  });

  it("a tileset request is routed to the terrain path, never to a 1x1 object card (B4)", () => {
    const { project, mapId } = interiorProjectWithBench();
    expect(() => buildObjectGenRequest(project, { ...args("과자 나라 전용 타일셋", mapId), objectKind: "flat" })).toThrowError(/타일셋/);
  });
});
