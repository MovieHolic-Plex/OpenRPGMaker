// upsert_resource(AI 툴)로 올린 4×4 얼굴 시트가 낱장으로 쪼개지는지.
//
// 왜 이 테스트가 필요한가(실측 회귀, 2026-08-28): 사람이 리소스 관리자에서 올리는 경로는
// planFacesetSheetSplit → sliceFacesetSheetDataUrls 로 낱장이 되는데, AI 툴 경로에는 그
// 배선이 없었다. 192×192 를 그대로 한 장으로 저장했고 얼굴 피커에도 그대로 나왔다
// (실브라우저: 피커 113 → 114). 고르면 48px 칸에 시트 전체가 축소돼 16장이 뭉갠 채 보인다.
//
// run() 은 동기라 canvas 로 픽셀을 자를 수 없다. 그래서 마이그레이션
// (splitUploadedFacesetSheetAssets)과 같은 방식을 쓴다 — 낱장 id 로 등록하되 각 칸에
// sheetCell/sheetSourceId 표식을 달아 두고, 실제 절단은 로드 직후
// repairUploadedFacesetSheets 가 마무리한다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import type { ToolContext } from "@/editor/tools/types";

function context(): ToolContext {
  return { project: createEmptyToolProject("얼굴 시트 업로드") };
}

/** IHDR 만 있는 최소 PNG. 툴은 앞 24바이트에서 가로·세로만 읽는다. */
function pngDataUrl(width: number, height: number): string {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set([73, 72, 68, 82], 12);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
}

function upload(ctx: ToolContext, id: string, width: number, height: number) {
  return runTool(ctx, "upsert_resource", {
    resource: { id, name: "업로드 얼굴", kind: "faceset", dataUrl: pngDataUrl(width, height) },
  });
}

describe("upsert_resource 의 faceset 시트 업로드", () => {
  it("192×192 시트는 낱장 16장이 되고 통짜 시트는 남지 않는다", () => {
    const ctx = context();
    const result = upload(ctx, "res_face_sheet", 192, 192);
    expect(result.ok, result.summary).toBe(true);

    const uploaded = ctx.project.assets.uploaded;
    expect(uploaded.res_face_sheet).toBeUndefined();
    const faceIds = Object.keys(uploaded).filter((id) => /^res_face_sheet-\d\d$/.test(id));
    expect(faceIds).toHaveLength(16);
    expect(faceIds).toContain("res_face_sheet-00");
    expect(faceIds).toContain("res_face_sheet-15");
  });

  it("96×96 시트는 4장이 된다", () => {
    const ctx = context();
    expect(upload(ctx, "res_small_sheet", 96, 96).ok).toBe(true);
    const faceIds = Object.keys(ctx.project.assets.uploaded).filter((id) =>
      /^res_small_sheet-\d\d$/.test(id)
    );
    expect(faceIds).toHaveLength(4);
  });

  it("낱장마다 48×48 크기와 지연 절단 표식을 단다", () => {
    const ctx = context();
    upload(ctx, "res_face_sheet", 192, 192);
    const cell7 = ctx.project.assets.uploaded["res_face_sheet-07"];
    expect(cell7).toBeDefined();
    const meta = cell7!.meta as Record<string, unknown>;
    expect(meta.width).toBe(48);
    expect(meta.height).toBe(48);
    expect(meta.sheetCell).toBe(7);
    expect(meta.sheetSourceId).toBe("res_face_sheet");
    // 픽셀은 아직 시트 그대로 — repairUploadedFacesetSheets 가 로드 때 자른다.
    expect(cell7!.dataUrl).toBe(pngDataUrl(192, 192));
  });

  it("이미 낱장인 48×48 은 쪼개지 않고 그대로 한 장이다", () => {
    const ctx = context();
    expect(upload(ctx, "res_one_face", 48, 48).ok).toBe(true);
    expect(ctx.project.assets.uploaded.res_one_face).toBeDefined();
    expect(Object.keys(ctx.project.assets.uploaded).filter((id) => id.startsWith("res_one_face-"))).toEqual([]);
  });

  it("비정사각 아트는 저자가 그린 낱장으로 보고 건드리지 않는다", () => {
    const ctx = context();
    expect(upload(ctx, "res_tall_face", 48, 96).ok).toBe(true);
    expect(ctx.project.assets.uploaded.res_tall_face).toBeDefined();
    expect(Object.keys(ctx.project.assets.uploaded).filter((id) => id.startsWith("res_tall_face-"))).toEqual([]);
  });

  it("faceset 이 아닌 종류는 정사각 시트여도 쪼개지 않는다", () => {
    const ctx = context();
    const result = runTool(ctx, "upsert_resource", {
      resource: { id: "res_pic", name: "그림", kind: "picture", dataUrl: pngDataUrl(192, 192) },
    });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.assets.uploaded.res_pic).toBeDefined();
    expect(Object.keys(ctx.project.assets.uploaded).filter((id) => id.startsWith("res_pic-"))).toEqual([]);
  });
});
