import { describe, expect, it } from "vitest";
import { OPRN_BGM_ASSETS } from "@/assets/oprnBgmAssets";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools/toolRunner";
import type { Project } from "@/project/types";

// 조수 곡 추천이 OPRN 전투곡 8곡을 이름이 아니라 곡이 든 장면으로 찾는다(2026-11-26 전투 소리 다양성 분석 제안 1).
describe("recommend_bgm battle scenes", { timeout: 120_000 }, () => {
  const ids = (project: Project, args: Record<string, unknown>): string[] => {
    const result = runTool({ project }, "recommend_bgm", { limit: 20, ...args }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    return (result.data as { candidates: Array<{ resourceId: string }> }).candidates.map((c) => c.resourceId);
  };
  const oprn = (scene: "battle" | "boss") => OPRN_BGM_ASSETS.filter((a) => a.scenes.includes(scene)).map((a) => a.id);
  const allOprn = OPRN_BGM_ASSETS.map((a) => a.id);

  it("finds every OPRN battle track for scene:battle, though no track name says battle", () => {
    // 보스곡도 전투 후보에 든다 — 일반 전투곡 넷 + 보스곡 넷 = 여덟.
    expect(ids(createEmptyToolProject(), { scene: "battle" })).toEqual(expect.arrayContaining(allOprn));
    expect(allOprn).toHaveLength(8);
  });

  it("scene:boss returns only the boss-fight tracks", () => {
    const found = ids(createEmptyToolProject(), { scene: "boss" });
    expect(found).toEqual(expect.arrayContaining(oprn("boss")));
    for (const id of OPRN_BGM_ASSETS.filter((a) => !a.scenes.includes("boss")).map((a) => a.id)) expect(found).not.toContain(id);
  });

  it("drops names that mention battle but are not a battle loop", () => {
    const project = createEmptyToolProject();
    const ogg = "data:audio/ogg;base64,T2dnUwACAAAAAAAAAAA=";
    project.assets.uploaded.qa_pre = { id: "qa_pre", name: "전투 전 마지막 확인", kind: "music", dataUrl: ogg };
    project.assets.uploaded.qa_loop = { id: "qa_loop", name: "전투의 서곡", kind: "music", dataUrl: ogg };
    const found = ids(project, { scene: "battle" });
    expect(found).toContain("qa_loop");
    expect(found).not.toContain("qa_pre");
  });

  it("pushes a track already used as another map's battle theme behind unused ones", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    const first = ids(project, { scene: "battle" })[0]!;
    map.battleBgmResourceId = first;
    const after = ids(project, { scene: "battle" });
    expect(after[0]).not.toBe(first);
    expect(after).toContain(first);
  });
});
