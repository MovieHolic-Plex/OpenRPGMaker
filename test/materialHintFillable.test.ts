// 재료 실패 힌트가 실패한 라벨을 다시 추천하던 순환(「"돌바닥" 없음 → 비슷한 라벨: "돌바닥"」) 을 끊는다.
// 2026-09-03 적대적 리뷰 01·05·14 — 조수가 같은 라벨로 재시도하다 잘못된 툴로 우회했다.
import { describe, expect, it } from "vitest";
import { runTool, type ToolContext } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { resolveMaterialByLabel } from "@/project/tileVocabulary";

const MAP_ID = "map_blank_start";

describe("면 채우기 재료 힌트", () => {
  it("있는 라벨이지만 채울 수 없는 재료(돌바닥)는 이유와 채울 수 있는 재료를 준다", () => {
    const tileset = createBlankProject().tilesets[DEFAULT_TILESET_ID];
    const result = resolveMaterialByLabel(tileset, "돌바닥", { preferGroup: true, preferRoles: ["water", "terrain"], requireAutotileGroup: true });
    expect(result.status).toBe("missing");
    if (result.status !== "missing") return;
    expect(result.message).toContain("면 채우기 재료가 아닙니다");
    const labels = result.suggestions.map((suggestion) => suggestion.label);
    expect(labels).not.toContain("돌바닥");
    expect(labels.some((label) => /물|모래|흙길/u.test(label)), labels.join(",")).toBe(true);
  });

  it("fill_region 실패 문구는 실패한 라벨을 다시 추천하지 않고 채울 수 있는 재료를 든다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const result = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 2, y: 2, w: 3, h: 3 }, material: "돌바닥" });
    expect(result.ok).toBe(false);
    expect(result.summary).not.toMatch(/비슷한 라벨[^:]*: "돌바닥"/u);
    expect(result.summary).toContain("채울 수 있는 재료");
    expect(result.summary).toMatch(/"물"|"모래"|"흙길"/u);
  });
});
