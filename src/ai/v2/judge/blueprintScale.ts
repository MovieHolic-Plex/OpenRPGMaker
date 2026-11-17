// 관문 하한은 청사진에 모델이 적은 크기를 따른다 — 요청이 짧은·작은 게임을 청했다고 모델이 write_blueprint 의 scale 에 적은 게임.
//
// 왜(2026-11-16 확인 빌드 r6b): 「역 앞 상점가 거리 하나와 라멘집 안 … 전투는 없어도 돼」 요청에 청사진 검사가 6단계·장소 3곳·전투 단계를 요구했고,
// 출하 관문이 맵 6장·퀘스트 3개를 요구해 모델이 «요청 범위 밖» 으로 막힘 처리했다(출하 차단 2건이 남았다). 포구 마을 판(r6a)은 그 수를 채우려고
// 요청에 없는 선술집과 곁 퀘스트 셋을 지었다.
// 요청 글의 낱말로 크기를 가르지 않는다 — 요청을 읽은 모델이 청사진에 적은 값만 읽는다(gameBlueprint.scale · battles).
import type { Project } from "@/project/types";

const key = (s: string) => s.normalize("NFC").replace(/\s+/gu, "").toLowerCase();

/** 이 프로젝트의 청사진이 작은 게임이라고 적혔나. */
export const smallGame = (project: Project): boolean => project.gameBlueprint?.scale === "small";

/** 작은 게임의 세는 맵 하한 — 청사진이 말한 서로 다른 장소 수(단계의 장소와 장소 목록), 1 이상 full 이하. 작은 게임이 아니면 full. */
export function mapsNeed(project: Project, full: number): number {
  const bp = project.gameBlueprint;
  if (!bp || bp.scale !== "small") return full;
  const places = new Set([...bp.steps.map((step) => key(step.place)), ...(bp.places ?? []).map((place) => key(place.name))].filter(Boolean));
  return Math.max(1, Math.min(full, places.size));
}

/** 작은 게임의 진행 깊이 하한 — 청사진 단계가 한 줄로 이어졌을 때의 깊이(단계 수 − 1), 1 이상 full 이하. 작은 게임이 아니면 full. */
export function depthNeed(project: Project, full: number): number {
  const bp = project.gameBlueprint;
  return bp && bp.scale === "small" ? Math.max(1, Math.min(full, bp.steps.length - 1)) : full;
}
