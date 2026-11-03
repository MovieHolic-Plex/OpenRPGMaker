// 넓히기 이력 — 같은 프로젝트에서 이미 쓴 장면을 다시 고르지 않게 한다.
// 정본은 프로젝트 자체다: 넓힌 장면은 맵 이름에 장면 이름을 쓰므로(formatWidenNote), 저장된 맵 이름이 지난 선택을 기억한다.
// 이 세션에서 막 고른 것(아직 맵이 생기기 전)은 메모리에 함께 둔다.
import type { Project } from "@/project/types";
import { WIDEN_MODIFIERS } from "./vagueWidenCatalog";

const SESSION_LIMIT = 24;
const sessionPicks: string[] = [];

/** 오래된 것 → 최근 것. 맵 이름에서 찾은 것이 앞, 이 세션에서 고른 것이 뒤. */
export function widenHistory(project: Project): string[] {
  const names = Object.values(project.maps).map((map) => map.name);
  const fromMaps = WIDEN_MODIFIERS.filter((modifier) => names.some((name) => name.includes(modifier.label))).map((modifier) => modifier.id);
  return [...fromMaps.filter((id) => !sessionPicks.includes(id)), ...sessionPicks];
}

export function rememberWiden(id: string): void {
  const at = sessionPicks.indexOf(id);
  if (at >= 0) sessionPicks.splice(at, 1);
  sessionPicks.push(id);
  if (sessionPicks.length > SESSION_LIMIT) sessionPicks.shift();
}

export function resetWidenHistory(): void {
  sessionPicks.length = 0;
}
