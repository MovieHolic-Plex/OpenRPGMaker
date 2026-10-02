/**
 * 월드맵 키트 빌드 클라이언트 — 조수의 지형 편집 도구(edit_world_terrain·read_world_terrain)가 쓴다.
 *
 * 실제 빌드는 Python 키트(tiledata/worldmap-kit/kit/build_world.py)라서 호스트에서만 돈다:
 * - 브라우저: 동반 서비스 `POST /v1/worldmap/build`(scripts/lib/ohMyPiHttp.mjs → scripts/lib/worldmapBuild.mjs)
 * - Pi 워커·헤드리스: 시작할 때 `setWorldmapBuilder(buildWorldmap)` 로 노드 구현을 직접 꽂는다.
 */
import { companionTokenHeaders } from "@/ai/companionToken";
import { companionRequestBaseUrl } from "@/ai/llmClient";

export const WORLDMAP_GROUNDS = [
  "grass", "farm", "crop", "savanna", "sand", "dune", "dirt", "badlands", "ash", "basalt", "swamp", "marsh", "tundra", "snow", "glacier", "jungle",
] as const;
export const WORLDMAP_OPS = ["land", "sea", "island", "biome", "ridge", "pass", "river", "forest", "clear", "plateau", "volcano", "move_place"] as const;

export interface WorldmapPlace { id: string; role: string; act: number; x: number; y: number; w: number; h: number; icon: string }

export interface WorldmapWorld {
  width: number;
  height: number;
  terrain: string;
  palette: string | null;
  ground: number[][];
  object: number[][];
  height_level: number[][];
  /** 행마다 '0'/'1' — 걸을 수 있는 칸(다리·경사로·장소 발자국 포함). */
  walk: string[];
  places: WorldmapPlace[];
  road_cells: [number, number][];
  ramp: [number, number][];
  bridges: { x: number; y: number; dir: string }[];
  sky_site: [string, number, number, number, number];
  /** 장소 id → 여정 규칙 한 줄(몇 막에 무엇으로 처음 닿는가·열쇠 장소·길로 이어진 장소). */
  placeRules: Record<string, string>;
}

export interface WorldmapBuildRequest {
  theme: string;
  terrain?: { id?: string; ops: Array<Record<string, unknown>> } | null;
  /** 픽셀 렌더 없이 칸 배열·도식 그림만(몇 초). */
  preview?: boolean;
}

export type WorldmapBuildResult =
  | {
    ok: true;
    preview: boolean;
    theme: string;
    /** preview 면 도식 그림, 아니면 완성 지도(1536×1152, 칸 16px). */
    imageDataUrl: string;
    world: WorldmapWorld;
    ascii: string;
    /** 테마가 지형을 어떻게 칠하는지(지역 팔레트면 같은 바닥도 자리마다 다른 색). */
    themeNote: string;
    journeyCheck: { ok: boolean; bad: string[] } | null;
    warnings: string[];
    seconds: number;
  }
  | { ok: false; error: string };

export type WorldmapBuilder = (request: WorldmapBuildRequest) => Promise<WorldmapBuildResult>;

let builderOverride: WorldmapBuilder | undefined;
/** Pi 워커·qa 하네스가 동반 서비스 HTTP 대신 노드 구현(scripts/lib/worldmapBuild.mjs)을 꽂는다. */
export function setWorldmapBuilder(builder: WorldmapBuilder | undefined): void {
  builderOverride = builder;
}

/** 지형이 바뀌면 100초 남짓 걸린다 — 넉넉히 기다린다. */
const REQUEST_TIMEOUT_MS = 7 * 60 * 1000;

export async function buildWorldmap(request: WorldmapBuildRequest): Promise<WorldmapBuildResult> {
  if (builderOverride) return builderOverride(request);
  let response: Response;
  try {
    response = await fetch(`${companionRequestBaseUrl().replace(/\/$/, "")}/worldmap/build`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...companionTokenHeaders() },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (cause) {
    return { ok: false, error: `월드맵 빌드 요청을 보내지 못했다(동반 서비스가 떠 있어야 한다): ${cause instanceof Error ? cause.message : String(cause)}` };
  }
  const text = await response.text();
  try {
    const payload = JSON.parse(text) as WorldmapBuildResult;
    if (!response.ok && payload && (payload as { ok?: unknown }).ok !== false) return { ok: false, error: `월드맵 빌드 HTTP ${response.status}` };
    return payload;
  } catch {
    return { ok: false, error: `월드맵 빌드 응답을 읽지 못했다(HTTP ${response.status}): ${text.slice(0, 200)}` };
  }
}
