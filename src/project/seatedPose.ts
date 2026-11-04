// project/seatedPose.ts
// 앉은 자세(graphic.pose = "seated") — 의자 칸에 선 정지 프레임을 그대로 두면 의자 세 개가 사람에 완전히 가려
// 책상에 줄 선 것처럼 읽혔다(첫사랑 r7). 앉은 그림은 몸을 조금 내리고 아랫단을 잘라 의자 좌판·다리가 사람 아래로 보인다.
// 의자 칸은 이름 추측이 아니라 타일 메타의 태그(「의자」/chair)로 판정한다.
import type { EventPageGraphic, GameMap, Project } from "./types";

/** 그림을 아래로 내리는 양(월드 px, 16px 타일 기준 — 칸 크기가 다르면 비례). */
export const SEATED_LOWER_PX = 5;
/** 그림 아랫단을 자르는 양(월드 px, 16px 타일 기준). */
export const SEATED_CLIP_PX = 8;

export const EVENT_POSES = ["seated"] as const;
export type EventPose = (typeof EVENT_POSES)[number];

export function isEventPose(value: unknown): value is EventPose {
  return typeof value === "string" && (EVENT_POSES as readonly string[]).includes(value);
}

/** 저장용. 모르는 값은 생략(undefined) — 옛 JSON 바이트를 유지한다. */
export function normalizeEventPose(value: unknown): EventPose | undefined {
  return isEventPose(value) ? value : undefined;
}

export function isSeatedGraphic(graphic: Pick<EventPageGraphic, "pose"> | undefined): boolean {
  return graphic?.pose === "seated";
}

const CHAIR_TAGS = new Set(["의자", "chair"]);

type TileMeta = { readonly tags?: readonly string[] } | undefined;

/** 이 칸 어느 층에든 「의자」 태그 타일이 있는가. */
export function cellHasChair(project: Pick<Project, "tilesets">, map: Pick<GameMap, "width" | "tilesetId" | "lowerTiles" | "upperTiles" | "lowerOverlayTiles" | "upperOverlayTiles">, x: number, y: number): boolean {
  const index = y * map.width + x;
  const meta = project.tilesets[map.tilesetId]?.tileMeta as unknown as readonly TileMeta[] | undefined;
  if (!meta) return false;
  const layers = [map.lowerTiles, map.lowerOverlayTiles, map.upperTiles, map.upperOverlayTiles] as readonly (ArrayLike<number> | undefined)[];
  return layers.some((layer) => {
    const tile = layer?.[index];
    return typeof tile === "number" && tile >= 0 && (meta[tile]?.tags ?? []).some((tag) => CHAIR_TAGS.has(tag));
  });
}
