// ai/conversationTurnContext.ts
// "이 채팅이 어느 맵·화면·선택 상태에서 입력됐는가"의 구조화 스냅샷 — 순수 함수만.
//
// 왜: 대화 세션은 맵 이동을 건너 살아 있다(맵마다 세션을 버리면 진행 중인 계획·제안·자율
// 런이 날아간다). 그래서 한 대화에 여러 맵의 턴이 섞이는데, 그 사실은 지금까지 사용자
// 메시지 꼬리표(`[컨텍스트] 현재 맵: …`)에 문자열로만 남아 저장된 기록에서 되읽을 수 없었고
// 뷰포트·선택 영역은 아예 남지 않았다.

import type { MapViewportSnapshot } from "./mapViewportContext";
import type { Project } from "@/project/types";

/** 턴 시점의 에디터 선택 영역(맵 좌표). */
export interface TurnSelectionSnapshot {
  readonly mapId: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * 한 사용자 턴의 편집 상황. 시각은 `AuditEntry.at`이 이미 들고 있으므로 중복하지 않는다.
 * 맵이 없을 수 있는 상태(부팅 직후·맵 삭제 후)도 정상이므로 `mapId`는 nullable.
 */
export interface ConversationTurnContext {
  readonly mapId: string | null;
  readonly mapName: string | null;
  readonly mapWidth?: number;
  readonly mapHeight?: number;
  readonly viewport?: MapViewportSnapshot;
  readonly selection?: TurnSelectionSnapshot;
}

export interface TurnContextInput {
  readonly mapId?: string | null;
  readonly viewport?: MapViewportSnapshot | null;
  readonly selection?: TurnSelectionSnapshot | null;
}

function withinMap(
  map: { readonly width: number; readonly height: number } | undefined,
  selection: TurnSelectionSnapshot,
): boolean {
  if (!map) {
    return selection.width > 0 && selection.height > 0;
  }
  return (
    selection.width > 0 &&
    selection.height > 0 &&
    selection.x >= 0 &&
    selection.y >= 0 &&
    selection.x + selection.width <= map.width &&
    selection.y + selection.height <= map.height
  );
}

export function buildConversationTurnContext(
  project: Pick<Project, "maps">,
  input: TurnContextInput,
): ConversationTurnContext {
  const mapId = input.mapId ?? input.viewport?.mapId ?? null;
  const map = mapId ? project.maps[mapId] : undefined;
  // 뷰포트/선택은 **현재 맵의 것**일 때만 기록한다. 맵을 옮겨도 남아 있던 이전 맵 좌표를
  // 새 맵 좌표로 오인하던 결함과 같은 규칙(aiChatPanel contextFooter).
  const viewport = input.viewport && input.viewport.mapId === mapId ? input.viewport : null;
  const selection =
    input.selection && input.selection.mapId === mapId && withinMap(map, input.selection) ? input.selection : null;
  return {
    mapId,
    mapName: map?.name ?? null,
    ...(map ? { mapWidth: map.width, mapHeight: map.height } : {}),
    ...(viewport ? { viewport } : {}),
    ...(selection ? { selection } : {}),
  };
}

/**
 * 턴 사이 맵 이동 알림. 같은 맵이거나 이전 맵을 모르면 null — 대화 첫 턴은 이동이 아니다.
 * 맵 이동으로 세션을 리셋하지 않는 대신, 전사(transcript)에 경계를 한 줄 남겨 모델과 사람이
 * 이전 맵 좌표를 새 맵에 그대로 적용하지 않게 한다.
 */
export function mapTransitionNote(
  previous: ConversationTurnContext | null,
  next: ConversationTurnContext,
): string | null {
  if (!previous || previous.mapId === next.mapId) return null;
  const label = (context: ConversationTurnContext): string => context.mapName ?? context.mapId ?? "맵 없음";
  return `맵 이동: ${label(previous)} → ${label(next)}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isViewportSnapshot(value: unknown): value is MapViewportSnapshot {
  return (
    isObject(value) &&
    typeof value.mapId === "string" &&
    isNumber(value.centerX) &&
    isNumber(value.centerY) &&
    isNumber(value.x) &&
    isNumber(value.y) &&
    isNumber(value.w) &&
    isNumber(value.h)
  );
}

function isSelectionSnapshot(value: unknown): value is TurnSelectionSnapshot {
  return (
    isObject(value) &&
    typeof value.mapId === "string" &&
    isNumber(value.x) &&
    isNumber(value.y) &&
    isNumber(value.width) &&
    isNumber(value.height)
  );
}

/** 저장된 기록(localStorage/Supabase jsonb)에서 다시 읽을 때의 형태 검증. */
export function isConversationTurnContext(value: unknown): value is ConversationTurnContext {
  if (!isObject(value)) return false;
  if (!(value.mapId === null || typeof value.mapId === "string")) return false;
  if (!(value.mapName === null || typeof value.mapName === "string")) return false;
  if (!(value.mapWidth === undefined || isNumber(value.mapWidth))) return false;
  if (!(value.mapHeight === undefined || isNumber(value.mapHeight))) return false;
  if (!(value.viewport === undefined || isViewportSnapshot(value.viewport))) return false;
  return value.selection === undefined || isSelectionSnapshot(value.selection);
}
