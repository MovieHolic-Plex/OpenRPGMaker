// 관문 하한은 청사진에 모델이 적은 크기를 따른다 — 요청이 짧은·작은 게임을 청했다고 모델이 write_blueprint 의 scale 에 적은 게임.
//
// 왜(2026-11-16 확인 빌드 r6b): 「역 앞 상점가 거리 하나와 라멘집 안 … 전투는 없어도 돼」 요청에 청사진 검사가 6단계·장소 3곳·전투 단계를 요구했고,
// 출하 관문이 맵 6장·퀘스트 3개를 요구해 모델이 «요청 범위 밖» 으로 막힘 처리했다(출하 차단 2건이 남았다). 포구 마을 판(r6a)은 그 수를 채우려고
// 요청에 없는 선술집과 곁 퀘스트 셋을 지었다.
// 요청 글의 낱말로 크기를 가르지 않는다 — 요청을 읽은 모델이 청사진에 적은 값만 읽는다(gameBlueprint.scale · battles).
import type { Project } from "@/project/types";
import { MVP_REACHED_SWITCH } from "@/project/gameBlueprint";

const key = (s: string) => s.normalize("NFC").replace(/\s+/gu, "").toLowerCase();

/**
 * 새 게임의 첫 판(MVP) 크기 — 장소 3~5곳(2026-11-23 오너: «처음에 프로젝트를 시작하면 맵을 3개에서 5개 정도 만드는 소규모로 MVP 만»).
 * 더 키우는 것은 사용자가 «다음 지역 만들어 줘» 처럼 이어서 청할 때다.
 */
export const MVP_PLACES = { min: 3, max: 5 } as const;

/** 이 프로젝트의 청사진이 작은 게임(요청한 작은 판 또는 첫 판 MVP)이라고 적혔나 — 관문이 그 청사진의 크기를 언다. */
export const smallGame = (project: Project): boolean => project.gameBlueprint?.scale === "small" || project.gameBlueprint?.scale === "mvp";

/** 첫 판 MVP 청사진인가(다음 단계 제안을 단다). */
export const mvpGame = (project: Project): boolean => project.gameBlueprint?.scale === "mvp";

/**
 * 첫 판 MVP 의 끝 지점 스위치 — MVP 는 엔딩·결말 이벤트를 만들지 않는다(2026-11-23 오너: «3맵에 굳이 엔딩이 있어야하나? 그냥 거기까지만 만들고
 * 사용자에게 MVP 까지 만들었다고 안내하면 그만»). 마지막 단계(몬스터는 첫 배지)가 이 스위치를 켜고, 자동 플레이·측정은 여기까지 간다.
 */
export { MVP_REACHED_SWITCH };

/** 엔딩을 요구하는 검사를 건너뛸 게임인가 — MVP 청사진, 또는 MVP 끝 스위치를 든 몬스터 첫 판. */
export const endsAtMvp = (project: Project): boolean => mvpGame(project) || (project.switches ?? []).some((s) => s.id === MVP_REACHED_SWITCH);

/**
 * 작은 게임의 세는 맵 하한 — 청사진이 말한 서로 다른 장소 수(단계의 장소와 장소 목록), 1 이상 full 이하. 작은 게임이 아니면 full.
 * 첫 판 MVP 는 청사진이 장소를 덜 적었어도 MVP_PLACES.min(3) 장을 센다 — 모델이 «할머니 집» 한 곳만 적은 MVP 가 맵 1장으로 끝났다
 * (2026-11-25 assistant-measure 회상 r5-clb). 모자라면 끝맺음이 더 짓게 할 일로 알리고, 세 번 되풀이되면 막힘으로 닫는다(막지 않는다 — shipChecks mapsMinBlocker).
 */
export function mapsNeed(project: Project, full: number): number {
  const bp = project.gameBlueprint;
  if (!bp || !smallGame(project)) return full;
  const places = new Set([...bp.steps.map((step) => key(step.place)), ...(bp.places ?? []).map((place) => key(place.name))].filter(Boolean));
  const floor = mvpGame(project) ? MVP_PLACES.min : 1;
  return Math.max(1, Math.min(full, Math.max(floor, places.size)));
}

/** 작은 게임의 진행 깊이 하한 — 청사진 단계가 한 줄로 이어졌을 때의 깊이(단계 수 − 1), 1 이상 full 이하. 작은 게임이 아니면 full. */
export function depthNeed(project: Project, full: number): number {
  const bp = project.gameBlueprint;
  return bp && smallGame(project) ? Math.max(1, Math.min(full, bp.steps.length - 1)) : full;
}
