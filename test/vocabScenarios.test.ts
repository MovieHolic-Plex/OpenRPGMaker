// vocab 개편(2026-07-11)의 사용자 시나리오 고정 테스트.
// ① 돌벽: 없는 id → 후보 제시(추측 루프 종결) ② 잔디: fill 즉시 성공
// ③ 번들 벽: soft-confirm 없이 즉시 시공(승인 시드)
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { COMBINED_TOWN_HARNESS_PREFIX } from "@/project/tilesetHarness/combinedTownGroups";

describe("vocab 시나리오", () => {
  it("① 돌벽 추측 id는 실패하되 실존 후보를 알려준다", () => {
    const project = createBlankProject();
    const mapId = Object.keys(project.maps)[0];
    const result = runTool({ project }, "build_wall", {
      mapId, rect: { x: 4, y: 4, w: 5, h: 4 }, wallVocabId: "stone-wall",
    }, { dryRun: true });
    expect(result.ok).toBe(false);
    const message = `${result.summary} ${JSON.stringify(result.issues ?? [])}`;
    expect(message).toContain("비슷한 그룹");
  });

  it("② 잔디 채우기가 한 번에 성공한다", () => {
    const project = createBlankProject();
    const mapId = Object.keys(project.maps)[0];
    const result = runTool({ project }, "fill_region", {
      mapId, rect: { x: 2, y: 2, w: 3, h: 3 }, tileVocabId: `${COMBINED_TOWN_HARNESS_PREFIX}grass-autotile`,
    }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
  });

  it("③ 번들 벽 시공에 soft-confirm 경고가 없다", () => {
    const project = createBlankProject();
    const mapId = Object.keys(project.maps)[0];
    const result = runTool({ project }, "build_wall", {
      mapId, rect: { x: 4, y: 4, w: 5, h: 5 }, wallVocabId: `${COMBINED_TOWN_HARNESS_PREFIX}plaster-wall-9slice`,
    }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    expect((result.diff?.warnings ?? []).join("\n")).not.toContain("목업 확인 대기");
  });
});
