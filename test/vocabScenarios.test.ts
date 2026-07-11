// vocab 개편(2026-07-11)의 사용자 시나리오 고정 테스트.
// ① 돌벽: 없는 id → 후보 제시(추측 루프 종결) ② 잔디: fill 즉시 성공
// ③ 번들 벽: soft-confirm 없이 즉시 시공(승인 시드)
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { COMBINED_TOWN_HARNESS_PREFIX } from "@/project/tilesetHarness/combinedTownGroups";

describe("vocab 시나리오", () => {
  it("① 없는 material 문자열은 실패하되 라벨 후보 안내를 준다", () => {
    const project = createBlankProject();
    const mapId = Object.keys(project.maps)[0];
    const result = runTool({ project }, "build_wall", {
      mapId, rect: { x: 4, y: 4, w: 5, h: 4 }, material: "no-such-material-xyz",
    }, { dryRun: true });
    expect(result.ok).toBe(false);
    const message = `${result.summary} ${JSON.stringify(result.issues ?? [])}`;
    expect(message).toMatch(/비슷한 라벨|비슷한 그룹|labels|찾지 못했/);
  });

  it("② 잔디 채우기가 한 번에 성공한다", () => {
    const project = createBlankProject();
    const mapId = Object.keys(project.maps)[0];
    const result = runTool({ project }, "fill_region", {
      mapId, rect: { x: 2, y: 2, w: 3, h: 3 }, material: "잔디",
    }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
  });

  it("③ 번들 벽 시공에 soft-confirm 경고가 없다", () => {
    const project = createBlankProject();
    const mapId = Object.keys(project.maps)[0];
    const result = runTool({ project }, "build_wall", {
      mapId, rect: { x: 4, y: 4, w: 5, h: 5 }, material: "흰 집 벽",
    }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    expect((result.diff?.warnings ?? []).join("\n")).not.toContain("목업 확인 대기");
  });
});
