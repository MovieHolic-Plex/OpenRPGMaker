// editor/tools/spaceBlueprintTools.ts
// AI 참고 청사진 도구 — 조수가 「오피스 로비」「대학 강의실」「강변 산책로」「왕성 알현실」 같은 공간 한 장을 말받으면
// 청사진(spacePresetCatalog)의 구역·초점·가구 무리·동선·리듬을 참고해 요청 뉘앙스와 새 씨앗으로 매번 다른 배치를 짓는다.
// 2026-10-18 사용자 반려: 사람이 20종 버튼을 눌러 같은 견본을 찍는 대신 AI 가 참고해 똑같지 않게 깐다.
import { composeSpaceFromBlueprintOnDraft, SPACE_BLUEPRINTS, spaceBlueprintBrief } from "@/editor/spacePresetCatalog";
import type { Project } from "@/project/types";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

export const COMPOSE_SPACE_BLUEPRINT_TOOL: ToolDefinition = {
  name: "compose_space_blueprint",
  mode: "write",
  domains: ["tile", "map"],
  fillsCurrentMapId: true,
  description: "AI 참고 청사진으로 공간 맵 한 장을 새로 짓는다 — 청사진은 좌표가 아니라 규칙(구역 비율·중심 초점·필수 가구 무리·융단/길 동선·벽 리듬)이고, "
    + "요청 문장의 규모(작은·대형)·분위기(아늑·모던·어두운)·선택 구역(카페·도서관·무기고·탕비실…)과 씨앗에 따라 방 비율·좌우·구역·가구·팔레트가 달라진다. "
    + "같은 공간을 다시 지으면 seed 를 바꾼다(똑같이 깔지 않는다). 맵은 청사진 칩셋의 새 맵으로 바뀌고 이름은 request 를 쓴다(야외는 기존 이벤트를 남긴다). "
    + `청사진: ${SPACE_BLUEPRINTS.map((bp) => `${bp.id}(${bp.name})`).join(" · ")}.`,
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "지을 맵 id(지금 보는 맵이면 그 id)" },
      request: { type: "string", description: "사용자가 말한 공간 그대로(예: \"카페 있는 아담한 오피스 로비\", \"무기고 딸린 왕성 알현실\")" },
      blueprintId: { type: "string", enum: SPACE_BLUEPRINTS.map((bp) => bp.id), description: "청사진 id(생략하면 request 낱말로 고른다)" },
      seed: { type: "integer", minimum: 0, description: "배치 씨앗(생략하면 새 씨앗) — 바꾸면 다른 배치" },
    },
    required: ["mapId", "request"],
    additionalProperties: false,
  },
  invalidArgsExample: { mapId: "map_1", request: "카페 있는 오피스 로비", seed: 7 },
  run(draft: Project, args): ToolExecResult {
    const mapId = typeof args.mapId === "string" ? args.mapId.trim() : "";
    if (!mapId || !draft.maps[mapId]) throw new ToolError(`맵 '${mapId}' 이 없다 — 지금 보는 맵 id 나 create_map 으로 만든 id 를 준다`, { code: "map-not-found" });
    const request = typeof args.request === "string" ? args.request.trim() : "";
    if (!request) throw new ToolError("request(지을 공간 문장)가 비었다", { code: "invalid-args" });
    const blueprintId = typeof args.blueprintId === "string" ? args.blueprintId : undefined;
    const seed = typeof args.seed === "number" && Number.isInteger(args.seed) ? args.seed : undefined;
    let r;
    try { r = composeSpaceFromBlueprintOnDraft(draft, mapId, { request, blueprintId, seed }); }
    catch (e) { throw new ToolError(`청사진으로 짓지 못했다 — ${(e as Error).message}`, { code: "compose-failed", mapId }); }
    const bp = SPACE_BLUEPRINTS.find((b) => b.id === r.blueprintId)!;
    return {
      summary: `청사진 「${bp.name}」을 참고해 ${r.width}×${r.height} 맵(${mapId})을 씨앗 ${r.seed} 로 새로 지었다. ${r.summary} 청사진 — ${spaceBlueprintBrief(bp)}`,
      data: { mapId, blueprintId: r.blueprintId, seed: r.seed, width: r.width, height: r.height },
    };
  },
};

export const SPACE_BLUEPRINT_TOOLS: readonly ToolDefinition[] = [COMPOSE_SPACE_BLUEPRINT_TOOL];
