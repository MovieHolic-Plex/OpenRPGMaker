// 타이틀 배경으로 «오프닝 애니메틱 한 컷의 한 순간»을 쓴다 — resourceId `opening-still:<sceneId>@<ms>`.
//
// 게임 맵·걷기 칩으로 지은 오프닝 컷(map-view 배경, place_opening_charset_actor 인물, 빛·색조)을 그대로 멈춰 세워
// 타이틀 그림으로 쓴다. 예전에는 같은 일을 하려면 저장소 밖 스크립트(render_title.py)로 맵을 그려 PNG 를 합성해야 했다.
// 그림 파일은 만들지 않는다: 플레이어가 타이틀을 열 때 그 컷을 그 시각으로 한 번 그려 쓴다(src/player/openingStill.ts).
// @<ms> 를 빼면 컷의 0ms(첫 화면)다.
import type { CinematicScene } from "@/project/cinematicSettings";
import type { Project } from "@/project/types";

export const OPENING_STILL_PREFIX = "opening-still:";

type AnimaticScene = Extract<CinematicScene, { kind: "animatic" }>;

export function openingStillResourceId(sceneId: string, atMs?: number): string {
  return `${OPENING_STILL_PREFIX}${sceneId}${atMs !== undefined && atMs > 0 ? `@${Math.round(atMs)}` : ""}`;
}

/** `opening-still:<sceneId>[@ms]` 이면 {sceneId, atMs}, 아니면 undefined. */
export function parseOpeningStill(resourceId: string | undefined): { sceneId: string; atMs: number } | undefined {
  if (!resourceId?.startsWith(OPENING_STILL_PREFIX)) return undefined;
  const body = resourceId.slice(OPENING_STILL_PREFIX.length).trim();
  const match = /^(.+?)(?:@(\d+))?$/u.exec(body);
  if (!match?.[1]) return undefined;
  return { sceneId: match[1], atMs: match[2] ? Number(match[2]) : 0 };
}

/** 시각을 뗀 id(리소스 검증 목록과 비교용). opening-still 이 아니면 undefined. */
export function openingStillBaseId(resourceId: string): string | undefined {
  const parsed = parseOpeningStill(resourceId);
  return parsed ? openingStillResourceId(parsed.sceneId) : undefined;
}

function animaticScenes(project: Pick<Project, "system">): AnimaticScene[] {
  return [...(project.system?.opening?.scenes ?? []), ...(project.system?.titleIntro?.scenes ?? [])]
    .filter((scene): scene is AnimaticScene => scene.kind === "animatic");
}

/** 그 컷(오프닝·타이틀 인트로의 애니메틱). 없으면 undefined. */
export function findOpeningStillScene(project: Pick<Project, "system">, sceneId: string): AnimaticScene | undefined {
  return animaticScenes(project).find((scene) => scene.id === sceneId);
}

/** 애니메틱 컷마다 쓸 수 있는 opening-still id(리소스 검증 목록용, 시각 없는 꼴). */
export function openingStillResourceIds(project: Pick<Project, "system">): string[] {
  return animaticScenes(project).map((scene) => openingStillResourceId(scene.id));
}
