import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";
import { findBattleSites } from "@/editor/battleBackdropCore";
import type { Project } from "@/project/types";

/**
 * 측면 전투 배경을 «그 전투가 벌어지는 맵»을 보고 만든다 — 하네스 battle-backdrop 과 같은 핵심(src/editor/battleBackdropCore.ts).
 * 실제 생성(맵 그리기 → 이미지 모델 → 도트화 → 등록 → 연결)은 편집기가 한다(ui-required, assistantSession 의 분기).
 */
export const BATTLE_BACKDROP_TOOL = "generate_battle_backdrop";

export type BattleBackdropRequest = {
  readonly mapId: string;
  readonly troopId?: string;
  readonly target: "troop" | "map";
  readonly focus?: { readonly x: number; readonly y: number };
  readonly note?: string;
  /** 전투 직전 대사(시간 낱말 근거). */
  readonly texts: readonly string[];
};

export function prepareBattleBackdropRequest(project: Pick<Project, "maps" | "database">, args: Record<string, unknown>): BattleBackdropRequest {
  const troopId = typeof args.troopId === "string" && args.troopId.trim() ? args.troopId.trim() : undefined;
  let mapId = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : undefined;
  if (troopId && !project.database.troops.some((t) => t.id === troopId)) {
    throw new ToolError(`트룹이 없습니다: ${troopId}`, { code: "troop-not-found" });
  }
  const sites = troopId ? findBattleSites(project, troopId) : [];
  if (!mapId) mapId = sites[0]?.mapId;
  if (!mapId) throw new ToolError("mapId 또는 전투 명령에서 쓰이는 troopId 가 필요합니다(troopId 만 주면 그 트룹을 부르는 맵을 찾습니다).", { code: "invalid-args" });
  const map = project.maps[mapId];
  if (!map) throw new ToolError(`맵이 없습니다: ${mapId}`, { code: "map-not-found" });
  const target = args.target === "map" || args.target === "troop" ? args.target : troopId ? "troop" : "map";
  if (target === "troop" && !troopId) throw new ToolError("target='troop' 에는 troopId 가 필요합니다.", { code: "invalid-args" });
  let focus: { x: number; y: number } | undefined;
  if (args.x !== undefined || args.y !== undefined) {
    if (!Number.isInteger(args.x) || !Number.isInteger(args.y)) throw new ToolError("x·y 는 둘 다 정수(칸)여야 합니다.", { code: "invalid-args" });
    focus = { x: Math.max(0, Math.min(map.width - 1, args.x as number)), y: Math.max(0, Math.min(map.height - 1, args.y as number)) };
  }
  if (args.note !== undefined && (typeof args.note !== "string" || args.note.length > 400)) throw new ToolError("note 는 400자 이하 문자열입니다.", { code: "invalid-args" });
  return {
    mapId, target, texts: sites.find((s) => s.mapId === mapId)?.texts ?? [],
    ...(troopId ? { troopId } : {}), ...(focus ? { focus } : {}),
    ...(typeof args.note === "string" && args.note.trim() ? { note: args.note.trim() } : {}),
  };
}

const SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    troopId: { type: "string", description: "이 트룹의 전투 배경으로 건다. mapId 를 안 주면 이 트룹을 부르는 전투 명령이 있는 맵을 찾아 그 맵을 본다." },
    mapId: { type: "string", description: "전투가 벌어지는 맵(그 맵을 그려 참고 그림으로 쓴다)." },
    x: { type: "integer", description: "맵에서 볼 칸(선택). 큰 맵이면 이 칸 둘레만 그린다." },
    y: { type: "integer", description: "맵에서 볼 칸(선택)." },
    target: { type: "string", enum: ["troop", "map"], description: "troop=그 트룹(previewBackgroundResourceId), map=그 맵의 모든 전투(battleBackground). 기본: troopId 가 있으면 troop." },
    note: { type: "string", maxLength: 400, description: "덧붙일 지시(선택, 예: '보름달이 창밖에 보인다')." },
  },
};

const generateBattleBackdrop: ToolDefinition = {
  name: BATTLE_BACKDROP_TOOL,
  description:
    "측면 전투 배경을 그 전투가 벌어지는 맵을 보고 새로 만들어 건다. 맵을 그려 시간(대사·조명)·빛·칩셋 색을 읽고, 그 그림을 참고로 이미지 모델이 측면 배경을 그리면 "
    + "320×180 격자·맵 칩셋 팔레트로 도트화(640×360 저장)해 kind=backdrop 자원으로 등록하고 트룹 또는 맵의 전투 배경으로 연결한다. "
    + "배경이 장소와 안 맞을 때(밤 편의점 전투에 낮 풀밭 등) 쓴다. 기본 바이옴 배경(battle-scenery-*)으로 충분하면 upsert_troop/set_map_properties 로 id 만 고른다. "
    + "system.battleBackdrop 이 field 면 필드 화면이 그려져 이 그림이 안 보인다.",
  mode: "read",
  parameters: SCHEMA,
  run(project, args): ToolExecResult {
    const request = prepareBattleBackdropRequest(project, args);
    return {
      summary: `전투 배경 생성 요청을 준비했습니다(맵 ${request.mapId}${request.troopId ? `, 트룹 ${request.troopId}` : ""}). 생성에는 편집기가 필요하며 아직 등록되지 않았습니다.`,
      data: { status: "ui-required", ...request },
    };
  },
};

export const BATTLE_BACKDROP_TOOLS: readonly ToolDefinition[] = [generateBattleBackdrop];
