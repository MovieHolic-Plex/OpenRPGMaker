// editor/tools/quickTerrainTool.ts
/**
 * 공방 「빠른 지형」을 조수 도구로 노출한다(2026-11-08, terra-game-strategy B3 · 실험 2).
 *
 * 왜: src/project/workshopQuickTerrain.ts 의 「빠른 지형」은 지금 칩셋에 이미 있는 오토타일(물·길·모랫길)의
 * 모양(가장자리 변형·움직이는 칸)은 그대로 두고 재질 색만 글에 맞게 바꿔 같은 칩셋에 새 그룹으로 덧붙인다.
 * 이음매가 원본과 같아 검수 실패가 구조적으로 적고 몇 초면 끝난다. 그런데 호출 경로가 공방 화면
 * (src/editor/workshop/oneClick/oneClickPanel.ts)뿐이라 조수·에이전트는 「과자 땅」「젤리 길」을 만들 길이 없었다
 * (terra-new-tileset 3판: 새 지형 0).
 *
 * 이 도구는 순수하다 — 그림 읽기·PNG 쓰기(canvas)는 브라우저 일이라 도구가 하지 않고, 요청만 돌려준다.
 * 편집기 카드(aiStoreCard.ts 의 quickTerrainCard)가 oneClick/quickTerrain.ts 의 makeQuickTerrain 을 불러 굽고,
 * 다 되면 「[공방 지형을 칩셋에 넣음] … 그룹 id …」 후속 요청으로 붓에 든 타일을 알려 준다.
 */
import { quickMaterialOf, pickQuickTerrainSource } from "@/project/workshopQuickTerrain";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import type { Project } from "@/project/types";

export const QUICK_TERRAIN_REQUEST_KIND = "workshop-quick-terrain-request" as const;

export interface QuickTerrainRequest {
  readonly kind: typeof QUICK_TERRAIN_REQUEST_KIND;
  /** 재질 글(「초콜릿 강」「젤리 길」「비스킷 땅」). 하나의 재질만 — 여러 재질은 도구를 여러 번 부른다. */
  readonly text: string;
  readonly tilesetId: string;
  readonly tilesetName: string;
  readonly mapId: string;
  /** 원래 사용자 요청 — 후속 요청에 그대로 돌려준다. */
  readonly need: string;
  /** 지금 칩셋에서 골라질 원본 오토타일 이름(미리 보기용, 실패하면 카드가 자세히 말한다). */
  readonly sourceName?: string;
  readonly materialName?: string;
}

export function isQuickTerrainRequest(value: unknown): value is QuickTerrainRequest {
  return (value as { kind?: unknown } | null)?.kind === QUICK_TERRAIN_REQUEST_KIND;
}

const requestQuickTerrain: ToolDefinition = {
  name: "request_quick_terrain",
  description:
    "지금 맵 칩셋의 **이미 있는 지형(물·길·모랫길) 모양은 그대로 두고 재질 색만 바꾼 새 지형 그룹**을 몇 초 만에 만든다. "
    + "「과자 땅(비스킷 바닥)」「초콜릿 강」「젤리 길」「용암 바닥」「독 늪」처럼 **테마 지형**이 필요할 때 쓴다. "
    + "새로 그리는 것이 아니라 색을 바꾸는 길이라 이음매가 원본과 같다. 만들 수 있는 재질은 15종(용암·독·늪·핏물·깊은 물·얼음·눈·모래·돌·풀·흙·물)과 색 낱말(빨강·파랑·초록·보라·노랑·분홍·검정·흰색)이다 — "
    + "비스킷·젤리·초콜릿처럼 목록에 없는 재질은 색 낱말로 고르거나(「초콜릿 강」→ 흙/진흙 계열) ask_missing_tiles 로 묻는다. "
    + "한 번에 재질 하나다 — 땅·강·길이 다 필요하면 재질마다 한 번씩 부른다(같은 턴에 여러 번 불러도 된다). "
    + "카드가 굽고 나면 「[공방 지형을 칩셋에 넣음]」 후속 요청이 오고, 그때 그 그룹 id 로 맵을 칠한다. 그렸다고 먼저 말하지 않는다.",
  mode: "read",
  domains: ["core"],
  fillsCurrentMapId: true,
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "지형을 넣을 맵(비우면 지금 보는 맵). 그 맵의 칩셋에 덧붙는다" },
      text: { type: "string", description: "재질 한 낱말(짧게): 「비스킷 땅」 「초콜릿 강」 「젤리 길」 「용암」 「독 늪」 「눈」 — 색·재질 낱말이 들어가야 고른다" },
      need: { type: "string", description: "사용자의 원래 요청을 한 문장으로(후속 요청에 그대로 돌려준다)" },
    },
    required: ["text", "need"],
    additionalProperties: false,
  },
  invalidArgsExample: { text: "초콜릿 강", need: "과자 나라 모험 게임을 만들어 줘. 강은 녹은 초콜릿이야." },
  run(project: Project, args: Record<string, unknown>): ToolExecResult {
    const map = requireMap(project, String(args.mapId ?? ""));
    const tileset = project.tilesets[map.tilesetId];
    if (!tileset) throw new ToolError(`맵 ${map.id} 의 칩셋 ${map.tilesetId} 이 프로젝트에 없다.`, { code: "not-found", mapId: map.id });
    const text = String(args.text ?? "").trim();
    const need = String(args.need ?? "").trim();
    if (!text || !need) throw new ToolError("text·need 를 채워라.", { code: "invalid-args" });
    const material = quickMaterialOf(text);
    const source = pickQuickTerrainSource(tileset, material, Number.MAX_SAFE_INTEGER);
    if (!source) {
      throw new ToolError(
        `칩셋 ${tileset.id} 에는 바탕으로 삼을 물·길 오토타일 모양이 없다 — 이 칩셋에는 빠른 지형을 만들 수 없다. ask_missing_tiles 로 묻거나 있는 지형을 쓴다.`,
        { code: "no-quick-terrain-source", mapId: map.id },
      );
    }
    const request: QuickTerrainRequest = {
      kind: QUICK_TERRAIN_REQUEST_KIND, text, tilesetId: tileset.id, tilesetName: tileset.name ?? tileset.id, mapId: map.id, need,
      sourceName: source.name, materialName: material.name,
    };
    return {
      summary: `「${text}」 빠른 지형 카드를 띄운다(재질 ${material.name}, 원본 모양 ${source.name}, 칩셋 ${tileset.id}). 몇 초면 끝나고 이음매는 원본과 같다. 카드가 끝나면 「[공방 지형을 칩셋에 넣음]」 후속 요청이 온다 — 지금 칠하지 말고, 다른 재질도 필요하면 같은 턴에 이어서 부르고 이 턴을 끝낸다. 만들었다고 먼저 말하지 않는다.`,
      data: request,
    };
  },
};

export const QUICK_TERRAIN_TOOLS: readonly ToolDefinition[] = [requestQuickTerrain];
