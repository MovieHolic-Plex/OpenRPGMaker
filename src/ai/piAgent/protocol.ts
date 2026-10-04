import type { ActivityVisual } from "../activityVisual";
import type { PiVillageCompletion } from "./villageCompletion";
import type { PiApplyMode } from "./applyMode";
import type { SpecialistModels } from "../modelRoles";
import type { SpatialToolProof } from "@/editor/tools/spatialToolState";
import type { ConstructionLog } from "@/editor/tools/constructionLog";
// Pi 에이전트 경로의 공용 규약. 브라우저(클라이언트)·동반 서비스(Node)·Bun 워커(런타임)가 같은
// 요청/이벤트 모양을 쓴다. 전송은 NDJSON 한 줄 = 이벤트 하나.
//
// 왜 별도 규약인가: 기존 세션은 OpenAI chat.completions 모양을 브라우저 루프가 소비했다.
// Pi 경로는 루프가 Bun 쪽에 있어 브라우저는 진행 이벤트만 받고, 마지막 `done` 에 결과
// 프로젝트가 실린다. 적용은 브라우저의 커밋 게이트가 그대로 맡는다.

import type { GameMap, Project } from "@/project/types";
import type { PiMapDelta } from "./mapDelta";
import type { PiTeamSpec } from "./teamSpec";
import { jsonEqual } from "../../util/structuralJson";

// "minimal" 은 antigravity 가 "off" 를 거부할 때 낮추는 자리다(`normalizePiThinkingLevel`). 실측(2026-09-26):
// off 로 보내면 스트림 error 이벤트 `Supported efforts: minimal, low, medium, high` 로 실행이 시작부터 죽는다.
export type PiAgentThinkingLevel = "off" | "minimal" | "low" | "medium" | "high";

export type PiAgentMode = "single" | "team";

export interface PiAgentRequest {
  /** Inherited by team members so task paraphrasing cannot drop the modern-map palette constraint. */
  readonly modernTilesetOnly?: boolean;
  readonly villageContract?: import("./villageContract").VillageContract;
  readonly applyMode?: PiApplyMode;
  /** 기본 single. team 이면 팀장 에이전트가 맵별 시공·검수 에이전트를 띄운다. */
  readonly mode?: PiAgentMode;
  readonly roleModels?: SpecialistModels;
  readonly provider: string;
  /** 비우면 제공자 기본 모델. */
  readonly model?: string;
  readonly task: string;
  /** 에이전트가 소유하는 맵. 비우면 프로젝트 전체가 작업 범위다. */
  readonly mapIds: readonly string[];
  /**
   * `mapIds` 가 **계약**인가(사용자가 `/pi 맵id …` 로 직접 적었다), 아니면 단순 기본 대상인가.
   * 기본 true — 옛 호출자(CLI·테스트)의 뜻은 「이 맵들만」이었다. 평문 채팅 턴만 false 로 보낸다.
   * 계약일 때만 시스템 프롬프트가 「범위 밖은 건드리지 마라」를 말하고 병합이 실제로 버린다.
   */
  readonly scopeStrict?: boolean;
  /**
   * 이 실행의 결과가 호출자 쪽 맵 묶음 병합(`mergeMapBundles`)을 거치는가 — 호출 시점 범위 가드 전용 신호.
   * `scopeStrict` 는 프롬프트(DB·시스템 편집 허용)에도 쓰여 바꾸지 않는다. 평문 턴이라도 에이전트가 둘 이상이면
   * 브라우저가 병합하므로, 가드 없이 두면 범위 밖 맵 변경이 도구에선 성공하고 병합에서 버려진다.
   */
  readonly mapBundleMerge?: boolean;
  /**
   * 사용자가 지금 보고 있는 맵. 팀장이 「여기」「이 맵」을 해석하는 기준이자, 다른 맵을 지목하지 않은 지시의 기본 대상이다.
   * 후보(mapIds)를 제한하지 않는다 — 실측(2026-09-15) 팀 모드가 이걸 버려 팀장이 43맵 중 엉뚱한 마을에 배정했다.
   */
  readonly currentMapId?: string;
  /**
   * 사용자가 이 대화에서 승인한 칩셋 계열(`src/project/tilesetFamily.ts`). 도구 ctx 에 그대로 실려
   * 실행기 계열 검사(`tileset-family-change`)가 이 계열로의 변경을 통과시킨다. 비우면 승인 없음.
   */
  readonly approvedTilesetFamilies?: readonly string[];
  readonly project: Project;
  /** 기본 시스템 프롬프트를 대체한다(테스트·CLI 용). */
  readonly systemPrompt?: readonly string[];
  readonly maxTurns?: number;
  readonly thinkingLevel?: PiAgentThinkingLevel;
  /** 노출할 툴 도메인. 비우면 살아 있는 레지스트리 전부. */
  readonly toolDomains?: readonly string[];
  /** Initial schema candidates only; discovery may expand them. Not a permission boundary. */
  readonly initialToolNames?: readonly string[];
  /** 팀 모드의 팀원 명세. 비우면 기본 팀. */
  readonly team?: PiTeamSpec;
  /** 읽기 전용 실행: 쓰기 툴을 주지 않고 조회·보고만 한다(자율성 「읽기 전용」·계획 턴). */
  readonly readOnly?: boolean;
  /** 한 실행의 시간 상한(ms). 비우면 런타임 기본 PI_AGENT_DEFAULT_TIMEOUT_MS(3000초). 팀은 하위 에이전트마다 같은 값이 걸린다. */
  readonly timeoutMs?: number;
}
export interface PiAgentStats {
  readonly ms: number;
  readonly turns: number;
  readonly toolCalls: number;
  readonly toolErrors: number;
  readonly usage?: PiAgentUsage;
}

/**
 * 실행 하나의 토큰 합계(모든 모델 호출). 예전엔 마지막 호출의 값으로 덮어써서 원장이 사실상 비었다 —
 * 캐시 적중·도구 스키마 비용을 아무도 볼 수 없었다.
 */
export interface PiAgentUsage {
  readonly input: number;
  readonly output: number;
  readonly cacheRead: number;
  readonly cacheWrite: number;
  readonly totalTokens: number;
  /** 합친 모델 호출 수. */
  readonly calls: number;
}

/** 두 합계를 더한다. 제공자가 준 한 호출분(`{input, output, …}`)도 받는다 — 모르는 모양은 0으로 센다. */
export function addPiAgentUsage(total: PiAgentUsage | undefined, next: unknown): PiAgentUsage | undefined {
  if (!next || typeof next !== "object") return total;
  const raw = next as Record<string, unknown>;
  const n = (key: string) => (typeof raw[key] === "number" && Number.isFinite(raw[key]) ? raw[key] as number : 0);
  const calls = typeof raw.calls === "number" ? raw.calls : 1;
  const base = total ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, calls: 0 };
  return {
    input: base.input + n("input"),
    output: base.output + n("output"),
    cacheRead: base.cacheRead + n("cacheRead"),
    cacheWrite: base.cacheWrite + n("cacheWrite"),
    totalTokens: base.totalTokens + (n("totalTokens") || n("input") + n("output") + n("cacheRead") + n("cacheWrite")),
    calls: base.calls + calls,
  };
}

export type PiTeamRoleId = "orchestrator" | "builder" | "reviewer";

/**
 * 한 에이전트 실행의 기본 시간 상한. 팀장·시공·검수가 각자 이 상한을 따로 가진다(요청의 timeoutMs 가 있으면 그 값).
 * 처음 10분이었다 — 실측이 19~213초일 때 잡은 값이다. 기존 마을 맵을 손보는 팀 실행은 시공 팀원이 도구 거부를
 * 우회하느라 한 맵에 100초 넘게 쓰고, 검수 → 수정 → 재검수까지 가면 10분이 팀장을 먼저 끊었다(2026-09-15).
 * 유휴 끊김은 heartbeat 가 따로 막으므로 이 값은 «정말 끝나지 않는 실행» 만 잡으면 된다.
 */
export const PI_AGENT_DEFAULT_TIMEOUT_MS = 3_000 * 1_000;

/**
 * 워커가 heartbeat 줄을 쓰는 간격. 진행 이벤트는 턴·툴 경계에만 나오므로 모델이 생각하는 동안 와이어가
 * 비는데, 그 침묵을 유휴 타임아웃 층(Bun.serve idleTimeout 10초 — 지금은 꺼 둠, undici bodyTimeout 300초,
 * 앞으로 끼어들 프록시)이 끊었다(실측 2026-09-14: 팀 모드 「마을 만들어줘」 가 매번 `terminated`).
 */
export const PI_AGENT_HEARTBEAT_MS = 5_000;
/** 브라우저 워치독: 이 시간 동안 줄이 하나도 안 오면 워커가 죽은 것으로 보고 끊는다. heartbeat 의 6배. */
export const PI_AGENT_STALE_MS = 30_000;
/**
 * 델타 중계 간격. 토큰마다 줄을 쓰면 NDJSON 이 수천 줄이 된다. 보드가 이미 1초마다 행을 통째 다시 그리므로
 * (`aiTeamBoard` 티커) 그보다 잔 간격은 보이지 않는 렌더만 늘린다. 와이어가 살아 있는 것은 heartbeat 가 맡는다.
 */
export const PI_AGENT_DELTA_FLUSH_MS = 1_000;

export interface PiTeamAgentStats extends PiAgentStats {}

/**
 * 줄에서 빼고 받는 쪽이 자기 사본을 다시 붙이는 무거운 키. `assets` 는 2026-09-27 에 더했다 — 업로드 그림 dataURL 이
 * 새 프로젝트 기본 자료에서 66MB 까지 커졌고, 작업 중에는 거의 바뀌지 않는다.
 */
export type PiCheckpointHeavyKey = "tilesets" | "database" | "assets";

export interface PiProjectCheckpoint {
  readonly project: Project;
  readonly label: string;
  readonly toolName: string;
  readonly spatialProof?: SpatialToolProof | null;
  /** 이 키는 project 에서 뺐다. 받는 쪽이 직전 프로젝트의 같은 객체를 다시 붙인다. */
  readonly unchangedKeys?: readonly PiCheckpointHeavyKey[];
  /**
   * tilesets 가 바뀐 줄에서, 그중 내용이 그대로인 타일셋 id. project.tilesets 에서 뺐고 받는 쪽이 자기 사본에서 다시 붙인다.
   * 마을 한 번 짓기가 forest_harmony 하나만 고쳐도 39개 타일셋(25MB)이 통째로 실렸다(2026-09-28 실측) — 그 줄이 팀 중계를
   * 지나며 101MB 체크포인트가 되어 브라우저 워치독(30초)이 연결을 끊었다.
   */
  readonly unchangedTilesetIds?: readonly string[];
  /**
   * 이 체크포인트를 낳은 도구가 실제로 밟은 시공 단계(constructionLog). 저장하지 않는다 — 편집기가 맵 위에서
   * 그 순서대로 다시 틀 때만 쓴다(마을 짓기처럼 도구 한 번이 맵 전체를 짓는 경우).
   */
  readonly constructionLogs?: readonly ConstructionLog[];
}
export type PiAgentEvent = PiAgentEventPayload & { readonly at?: number };
type PiAgentEventPayload =
  | { readonly type: "prompt_inspection"; readonly snapshot: import("../authoring/promptInspection").PromptInspection }
  | { readonly type: "execution_status"; readonly name: string; readonly summary: string; readonly ok?: boolean; readonly data?: unknown }
  | ({ readonly type: "checkpoint"; readonly checkpointId: string } & PiProjectCheckpoint)
  | { readonly type: "render_request"; readonly renderId: string; readonly project: Project; readonly unchangedKeys?: readonly PiCheckpointHeavyKey[]; readonly unchangedTilesetIds?: readonly string[]; readonly toolName: string; readonly data: unknown }
  | { readonly type: "start"; readonly provider: string; readonly model: string; readonly toolCount: number }
  // ── 팀 이벤트. 하위 에이전트의 진행은 agent_event 로 감싸서 흘린다(보드가 행 단위로 그린다). ──
  | { readonly type: "team_start"; readonly task: string; readonly roles: readonly { id: PiTeamRoleId; label: string }[] }
  | { readonly type: "agent_spawn"; readonly agentId: string; readonly role: PiTeamRoleId; readonly mapId: string | null; readonly mapName: string | null; readonly task: string; readonly memberId?: string; readonly label?: string; /** 검수 지적을 고치러 간 배정이면 그 검수 에이전트 id. 보드가 두 행을 잇는다. */ readonly fixOf?: string }
  | { readonly type: "agent_event"; readonly agentId: string; readonly event: PiAgentEvent }
  | { readonly type: "agent_done"; readonly agentId: string; readonly ok: boolean; readonly summary: string; readonly stats: PiAgentStats; readonly changedKeys: readonly string[]; readonly spills: readonly string[]; readonly conflicts: readonly string[] }
  | { readonly type: "review"; readonly agentId: string; readonly mapId: string | null; readonly ok: boolean; readonly findings: readonly string[]; readonly artChecks?: unknown }
  | { readonly type: "team_report"; readonly text: string }
  | { readonly type: "turn"; readonly index: number }
  /** 연결이 살아 있음. 내용은 없다 — 유휴 타임아웃을 지나가게 하고 브라우저 워치독의 시계가 된다. 보드는 무시한다. */
  | { readonly type: "heartbeat"; readonly at: number }
  /** 모델 스트림 조각. 생각(thinking)·본문(text)을 PI_AGENT_DELTA_FLUSH_MS 간격으로 합친 것 — 보드의 「생각 중」 재료. */
  | { readonly type: "delta"; readonly kind: "thinking" | "text"; readonly text: string }
  | { readonly type: "assistant"; readonly text: string }
  | { readonly type: "tool_start"; readonly id: string; readonly name: string; readonly args: unknown }
  | { readonly type: "tool_end"; readonly id: string; readonly name: string; readonly ok: boolean; readonly summary: string; readonly result?: unknown; readonly durationMs?: number; readonly visuals?: readonly ActivityVisual[] }
  /**
   * 툴이 맵에 한 일. 바뀐 칸만 싣는다 — 캔버스 시공 표시(고스트)가 턴 내내 먹는 재료다.
   * 결과 프로젝트는 맨 끝 `done` 에만 실리므로, 이게 없으면 턴이 끝날 때까지 캔버스가 조용하다.
   * 맵 밖 변경(데이터베이스·퀘스트·스위치)은 그릴 자리가 없어 담지 않는다.
   */
  | { readonly type: "map_delta"; readonly maps: readonly PiMapDelta[] }
  | { readonly type: "error"; readonly message: string }
  /**
   * 쓰기 실행의 정본 증거. 프루프가 객체 정체성에 살아 이 경계를 넘지 못하므로 다이제스트로
   * 실어 보낸다 — 브라우저의 수용 게이트가 이걸로 «도구가 만든 제안»임을 확인한다.
   */
  | { readonly type: "done"; readonly villageCompletion?: PiVillageCompletion; readonly interiorCompletion?: readonly { mapId: string; issues: readonly unknown[] }[]; readonly project: Project; readonly stats: PiAgentStats; readonly changedKeys: readonly string[]; readonly spatialProof?: SpatialToolProof | null;
      /** 요청 프로젝트와 내용이 같아 project 에서 뺀 무거운 키. 클라이언트가 요청 프로젝트의 것을 다시 붙인다. */
      readonly unchangedKeys?: readonly PiCheckpointHeavyKey[];
      /** tilesets 가 바뀐 done 에서 그대로인 타일셋 id(PiProjectCheckpoint.unchangedTilesetIds 와 같은 뜻). */
      readonly unchangedTilesetIds?: readonly string[];
      /**
       * 실행 전에 얼린 마을 계약을 실행 도중 풀었다 — 계약 인자 그대로 부른 시공이 대상·범위·칩셋 규칙에 막혔다.
       * 패널은 이 실행을 계약 실행이 아니라 일반 실행으로 마무리한다(완료 검사·검수·적용 정책).
       */
      readonly villageContractReleased?: { readonly code: string; readonly message: string };
      /**
       * 모델·제공자 오류나 상한으로 **도중에 멈춘** 실행의 사유. 반영된 작업은 남지만 요청을 끝까지 하지 않았다 —
       * 패널이 「만들었어요 · 플레이해 보세요」 대신 멈췄다고 말하게 한다(2026-09-24 연애 도그푸딩: 공략 인물 하나 없이 완료 표시).
       */
      readonly stoppedEarly?: string };

export type PiAgentDoneEvent = Extract<PiAgentEvent, { type: "done" }>;

export function encodePiAgentEvent(event: PiAgentEvent): string {
  return `${JSON.stringify(event)}\n`;
}

/** 빈 줄·깨진 줄은 null. 워커가 죽으며 반 토막 난 마지막 줄을 조용히 버리기 위함. */
export function parsePiAgentEventLine(line: string): PiAgentEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as { type?: unknown };
    return parsed && typeof parsed === "object" && typeof parsed.type === "string" ? (parsed as PiAgentEvent) : null;
  } catch {
    return null;
  }
}

/**
 * 스트림 조각을 줄 단위 이벤트로 바꾼다. 조각 경계가 줄 중간에 걸려도 된다.
 * 새 조각만 훑고 미완 줄은 조각 배열로 모은다 — 버퍼를 처음부터 다시 훑으면 수십 MB 짜리
 * done·체크포인트 한 줄이 조각 수의 제곱으로 느려진다(33.5 MB 에 3~51 s).
 */
export function createPiAgentLineDecoder(onEvent: (event: PiAgentEvent) => void): {
  push(chunk: string): void;
  flush(): void;
} {
  let pending: string[] = [];
  const emit = (line: string) => {
    const event = parsePiAgentEventLine(line);
    if (event) onEvent(event);
  };
  return {
    push(chunk) {
      let start = 0;
      let index = chunk.indexOf("\n");
      while (index >= 0) {
        const head = chunk.slice(start, index);
        if (pending.length) {
          pending.push(head);
          const line = pending.join("");
          pending = [];
          emit(line);
        } else {
          emit(head);
        }
        start = index + 1;
        index = chunk.indexOf("\n", start);
      }
      if (start < chunk.length) pending.push(start === 0 ? chunk : chunk.slice(start));
    },
    flush() {
      const line = pending.join("");
      pending = [];
      emit(line);
    },
  };
}

/** 최상위 키 기준 변경 목록. maps 는 맵 id 단위로 쪼갠다(어느 맵이 바뀌었는지가 곧 범위 감사다). */
export function changedProjectKeys(before: Project, after: Project): string[] {
  const out: string[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (key === "maps") {
      const ids = new Set([...Object.keys(before.maps ?? {}), ...Object.keys(after.maps ?? {})]);
      for (const id of ids) {
        const left = before.maps?.[id];
        const right = after.maps?.[id];
        if (left === right) continue;
        if (mapContentChanged(left, right)) out.push(`maps.${id}`);
      }
      continue;
    }
    const a = (before as unknown as Record<string, unknown>)[key];
    const b = (after as unknown as Record<string, unknown>)[key];
    if (a === b) continue;
    if (!jsonEqual(a, b)) out.push(key);
  }
  return out.sort();
}

function mapContentChanged(left: GameMap | undefined, right: GameMap | undefined): boolean {
  if (left === right) return false;
  if (!left || !right) return true;
  const count = Math.max(left.lowerTiles.length, right.lowerTiles.length);
  for (let index = 0; index < count; index += 1) {
    if (left.lowerTiles[index] !== right.lowerTiles[index] || left.upperTiles?.[index] !== right.upperTiles?.[index]) return true;
  }
  return !jsonEqual(mapWithoutTileArrays(left), mapWithoutTileArrays(right));
}

function mapWithoutTileArrays(map: GameMap): Record<string, unknown> {
  const copy = { ...map } as Record<string, unknown>;
  delete copy.lowerTiles;
  delete copy.upperTiles;
  return copy;
}

/** 기준과 내용이 같은 무거운 키. 이 키들은 줄에서 빼고 받는 쪽이 자기 사본을 다시 붙인다. */
export function unchangedHeavyKeys(base: Project, project: Project): PiCheckpointHeavyKey[] {
  const keys: PiCheckpointHeavyKey[] = [];
  if (jsonEqual(project.tilesets, base.tilesets)) keys.push("tilesets");
  if (jsonEqual(project.database, base.database)) keys.push("database");
  if (jsonEqual(project.assets, base.assets)) keys.push("assets");
  return keys;
}

/** 줄로 내보낼 done. 무거운 키가 요청 그대로면 빼서 보낸다 — 타일셋 이미지만 수십 MB 다. */
export function slimDoneEvent(done: PiAgentDoneEvent, base: Project): PiAgentDoneEvent {
  const slim = slimProjectForWire(base, done.project);
  if (!slim.unchangedKeys.length && !slim.unchangedTilesetIds.length) return done;
  return { ...done, project: slim.project, unchangedKeys: slim.unchangedKeys, ...(slim.unchangedTilesetIds.length ? { unchangedTilesetIds: slim.unchangedTilesetIds } : {}) };
}

/** tilesets 가 바뀌었을 때 그중 그대로인 타일셋 id. 새 타일셋은 싣는다. */
export function unchangedTilesetIds(base: Project, project: Project): string[] {
  const ids: string[] = [];
  for (const [id, tileset] of Object.entries(project.tilesets ?? {})) {
    const before = base.tilesets?.[id];
    if (before !== undefined && (before === tileset || jsonEqual(before, tileset))) ids.push(id);
  }
  return ids;
}

/**
 * 줄로 보낼 프로젝트. 무거운 키가 통째로 그대로면 빼고(unchangedKeys), tilesets 가 바뀌었으면 그대로인 타일셋만 뺀다
 * (unchangedTilesetIds). 받는 쪽은 restoreCheckpointProject 에 두 목록을 같이 넘겨 자기 사본을 다시 붙인다.
 */
export function slimProjectForWire(base: Project, project: Project): { project: Project; unchangedKeys: PiCheckpointHeavyKey[]; unchangedTilesetIds: string[] } {
  const unchangedKeys = unchangedHeavyKeys(base, project);
  let slim = slimCheckpointProject(project, unchangedKeys);
  const tilesetIds = unchangedKeys.includes("tilesets") ? [] : unchangedTilesetIds(base, project);
  if (tilesetIds.length) {
    const skip = new Set(tilesetIds);
    slim = { ...slim, tilesets: Object.fromEntries(Object.entries(project.tilesets).filter(([id]) => !skip.has(id))) as Project["tilesets"] };
  }
  return { project: slim, unchangedKeys, unchangedTilesetIds: tilesetIds };
}

/** 체크포인트 줄에서 빼도 되는 무거운 키. 받는 쪽이 unchangedKeys 로 다시 붙인다. */
export function slimCheckpointProject(project: Project, unchangedKeys: readonly PiCheckpointHeavyKey[]): Project {
  if (unchangedKeys.length === 0) return project;
  const next = { ...project };
  for (const key of unchangedKeys) {
    if (key === "tilesets") next.tilesets = {} as Project["tilesets"];
    if (key === "database") next.database = {} as Project["database"];
    if (key === "assets") next.assets = { sprites: {}, uploaded: {} } as Project["assets"];
  }
  return next;
}

export function restoreCheckpointProject(current: Project, incoming: Project, unchangedKeys: readonly PiCheckpointHeavyKey[] | undefined, tilesetIds?: readonly string[]): Project {
  if (!unchangedKeys?.length && !tilesetIds?.length) return incoming;
  const next = { ...incoming };
  if (unchangedKeys?.includes("tilesets")) next.tilesets = current.tilesets;
  else if (tilesetIds?.length) {
    const tilesets = { ...incoming.tilesets } as Record<string, unknown>;
    for (const id of tilesetIds) {
      const own = (current.tilesets as Record<string, unknown>)[id];
      if (own === undefined) throw new Error(`체크포인트가 뺀 타일셋 '${id}' 이 받는 쪽 사본에 없습니다.`);
      tilesets[id] = own;
    }
    next.tilesets = tilesets as Project["tilesets"];
  }
  if (unchangedKeys?.includes("database")) next.database = current.database;
  if (unchangedKeys?.includes("assets")) next.assets = current.assets;
  return next;
}

/** 비교용 스냅샷. 타일셋·데이터베이스·에셋은 같은 객체를 공유해 매 도구 JSON 비교를 피한다. */
export function snapshotProjectKeepingHeavy(project: Project): Project {
  const { tilesets, database, assets, ...light } = project;
  return { ...structuredClone(light), tilesets, database, assets };
}

/**
 * 호출 시점 맵 범위 가드 옵션(`createPiToolset`·`resolvePiToolShape` 에 그대로 펼친다).
 * 계약 범위(`scopeStrict` 기본 true)거나 병합 실행(`mapBundleMerge`)이면 켠다 — 병합이 버릴 변경만 막는다.
 * `scopeAllowsSystem` 은 평문 병합 실행 표시: DB·시스템 편집은 허용이고 다른 맵만 안 된다고 말하게 한다.
 */
export function piMapScopeGuard(
  request: Pick<PiAgentRequest, "mapIds" | "scopeStrict" | "mapBundleMerge">,
): { scopeMapIds?: readonly string[]; scopeAllowsSystem?: boolean } {
  if (request.mapIds.length === 0) return {};
  const strict = request.scopeStrict !== false;
  if (!strict && request.mapBundleMerge !== true) return {};
  return { scopeMapIds: request.mapIds, scopeAllowsSystem: !strict };
}
