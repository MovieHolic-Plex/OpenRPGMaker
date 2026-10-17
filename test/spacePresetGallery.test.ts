// AI 참고 청사진 — 사람이 고르는 프리셋 버튼 대신 조수가 청사진 규칙을 참고해 요청·씨앗마다 다른 배치를 짓는다(2026-10-18 사용자 반려).
import { describe, expect, it } from "vitest";
import { getTool } from "@/editor/tools/toolRegistry";
import { composeSpaceFromBlueprint, matchSpaceBlueprint, SPACE_BLUEPRINTS } from "@/editor/spacePresetCatalog";
import { createBlankProject } from "@/project/defaults";

const signature = (project: ReturnType<typeof composeSpaceFromBlueprint>["project"], mapId: string): string => {
  const m = project.maps[mapId]!;
  return `${m.width}x${m.height}|${m.lowerTiles.join(",")}|${(m.upperTiles ?? []).join(",")}`;
};

describe("AI 참고 청사진", () => {
  it("청사진마다 구역·초점·무리·동선·리듬 규칙을 갖는다", () => {
    expect(new Set(SPACE_BLUEPRINTS.map((bp) => bp.id)).size).toBe(SPACE_BLUEPRINTS.length);
    for (const bp of SPACE_BLUEPRINTS) for (const v of Object.values(bp.guide)) expect(v.length, bp.id).toBeGreaterThan(0);
  });

  it("요청 낱말로 청사진을 고른다", () => {
    expect(matchSpaceBlueprint("카페 있는 오피스 로비")?.id).toBe("office-lobby");
    expect(matchSpaceBlueprint("대학 강의실")?.id).toBe("university-lecture");
    expect(matchSpaceBlueprint("강변 산책로")?.id).toBe("riverside-promenade");
    expect(matchSpaceBlueprint("왕성 알현실")?.id).toBe("fantasy-throne");
    expect(matchSpaceBlueprint("우주 정거장")).toBeUndefined();
  });

  it.each(["오피스 로비", "대학 강의실", "강변 산책로", "왕성 알현실"])("「%s」는 씨앗이 다르면 같은 맵을 찍지 않는다", (request) => {
    const base = createBlankProject();
    const a = composeSpaceFromBlueprint(base, { request, seed: 1 });
    const b = composeSpaceFromBlueprint(base, { request, seed: 2 });
    const again = composeSpaceFromBlueprint(base, { request, seed: 1 });
    expect(signature(a.project, a.mapId)).not.toBe(signature(b.project, b.mapId));
    expect(signature(a.project, a.mapId)).toBe(signature(again.project, again.mapId));
  });

  it("compose_space_blueprint 도구가 조수에게 열려 있고 청사진 규칙을 돌려준다", () => {
    const tool = getTool("compose_space_blueprint");
    expect(tool).toBeDefined();
    const project = createBlankProject();
    const mapId = project.startMapId;
    const res = tool!.run(project, { mapId, request: "무기고 딸린 왕성 알현실", seed: 5 });
    expect(res.summary).toContain("왕성 알현실");
    expect(res.summary).toContain("동선");
    expect(project.maps[mapId]!.tilesetId).toBe("atlas_biome_interior");
  });
});
