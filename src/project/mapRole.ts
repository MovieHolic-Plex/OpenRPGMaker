// project/mapRole.ts
// 맵 성격(마을·던전·필드·실내) — 저작자가 맵 속성에서 고르는 정본 값.
// 바로 깔기·배치 조수(`ai/mapPlacementContext`)가 이 값을 먼저 믿고, 없을 때만 신호로 추정한다.
// 런타임(플레이어) 동작은 바꾸지 않는다 — 저작 보조용 표지다.
import type { MapRoleKind } from "./types";

export type { MapRoleKind };

export const MAP_ROLE_KINDS = ["town", "dungeon", "field", "interior"] as const satisfies readonly MapRoleKind[];

export const MAP_ROLE_LABELS: Record<MapRoleKind, string> = {
  town: "마을",
  dungeon: "던전",
  field: "필드",
  interior: "실내",
};

export function isMapRoleKind(value: unknown): value is MapRoleKind {
  return typeof value === "string" && (MAP_ROLE_KINDS as readonly string[]).includes(value);
}
