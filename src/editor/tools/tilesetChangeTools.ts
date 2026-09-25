// editor/tools/tilesetChangeTools.ts
// ask_tileset_change — 사용자가 보는 맵과 다른 칩셋 계열이 필요할 때 사용자에게 묻는 도구(2026-09-25 사용자 결정).
// 도구는 질문 자료만 돌려준다. 패널이 이 결과를 보고 견본 그림 두 장(지금 / 바뀔 것)이 든 질문 카드를 띄우고,
// 승인하면 그 계열을 대화 승인 목록(ToolContext.approvedTilesetFamilies)에 넣는다. 실행기 계열 검사는 toolRunner.ts.

import { tilesetFamily, tilesetFamilyLabel } from "@/project/tilesetFamily";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

export const ASK_TILESET_CHANGE_TOOL = "ask_tileset_change";

/** ask_tileset_change 가 돌려주는 data. 패널 질문 카드(aiTilesetChangeCard.ts)가 읽는다. */
export interface TilesetChangeQuestion {
  readonly kind: "tileset-change-question";
  readonly mapId: string | null;
  readonly fromTilesetId: string;
  readonly toTilesetId: string;
  readonly fromFamily: string;
  readonly toFamily: string;
  readonly fromLabel: string;
  readonly toLabel: string;
  readonly reason: string;
  readonly purpose: string | null;
}

export function isTilesetChangeQuestion(value: unknown): value is TilesetChangeQuestion {
  return !!value && typeof value === "object" && (value as { kind?: unknown }).kind === "tileset-change-question";
}

const askTilesetChange: ToolDefinition = {
  name: "ask_tileset_change",
  description: "사용자가 보고 있는 맵과 다른 그림체(칩셋 계열)의 타일셋이 꼭 필요할 때 사용자에게 묻는다. "
    + "화면에 지금 맵과 바뀔 칩셋의 견본 그림이 나란히 뜬다. 부른 뒤에는 더 칠하지 말고 이 턴을 끝내라 — 사용자의 답이 다음 요청으로 온다. "
    + "같은 계열 타일셋으로 만들 수 있으면 부르지 말고 그 타일셋을 써라.",
  mode: "read",
  domains: ["core"],
  // 실행기가 비어 있는 mapId 를 사용자가 보는 맵(ctx.currentMapId)으로 채운다.
  fillsCurrentMapId: true,
  parameters: {
    type: "object",
    properties: {
      toTilesetId: { type: "string", description: "바꾸고 싶은 칩셋(타일셋) id. 프로젝트에 있는 것만." },
      reason: { type: "string", description: "왜 이 칩셋이 필요한지 사용자에게 보여 줄 쉬운 한국어 한두 문장." },
      purpose: { type: "string", description: "만들려는 것의 용도(예: castle_interior, town_village). 견본 그림을 고를 때 쓴다." },
      mapId: { type: "string", description: "비교 기준 맵 id. 생략하면 사용자가 보고 있는 맵." },
    },
    required: ["toTilesetId", "reason"],
    additionalProperties: false,
  },
  invalidArgsExample: { toTilesetId: "opengameart_castle", reason: "성 안을 만들려면 성채 타일이 필요해요." },
  run(project, args): ToolExecResult {
    const toTilesetId = String(args.toTilesetId).trim();
    const reason = String(args.reason).trim();
    const purpose = typeof args.purpose === "string" && args.purpose.trim() ? args.purpose.trim() : null;
    const mapId = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : null;
    if (!project.tilesets[toTilesetId]) {
      throw new ToolError(`타일셋을 찾을 수 없습니다: ${toTilesetId}. 프로젝트에 있는 타일셋 id 만 물을 수 있다.`, { code: "tileset-not-found" });
    }
    if (!reason) throw new ToolError("reason 이 비었다 — 사용자에게 보여 줄 이유를 적어라.", { code: "invalid-args" });
    const map = mapId ? project.maps[mapId] : undefined;
    if (!map) {
      throw new ToolError(
        mapId ? `맵을 찾을 수 없습니다: ${mapId}` : "사용자가 보고 있는 맵을 알 수 없다 — mapId 로 비교할 맵을 지정하라.",
        { code: "map-not-found" },
      );
    }
    const fromFamily = tilesetFamily(project, map.tilesetId);
    const toFamily = tilesetFamily(project, toTilesetId);
    if (fromFamily === toFamily) {
      throw new ToolError(
        `${toTilesetId} 는 지금 맵 칩셋(${map.tilesetId})과 같은 ${tilesetFamilyLabel(project, fromFamily)} 계열이다 — 묻지 말고 그대로 써라.`,
        { code: "tileset-same-family" },
      );
    }
    const question: TilesetChangeQuestion = {
      kind: "tileset-change-question",
      mapId: map.id,
      fromTilesetId: map.tilesetId,
      toTilesetId,
      fromFamily,
      toFamily,
      fromLabel: tilesetFamilyLabel(project, fromFamily),
      toLabel: tilesetFamilyLabel(project, toFamily),
      reason,
      purpose,
    };
    return {
      summary: "사용자에게 칩셋 계열 변경을 물었다. 답을 기다리며 이 턴을 끝내라(더 칠하지 마라).",
      data: question,
    };
  },
};

export const TILESET_CHANGE_TOOLS: readonly ToolDefinition[] = [askTilesetChange];
