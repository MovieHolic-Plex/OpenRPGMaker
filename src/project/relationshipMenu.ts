// project/relationshipMenu.ts
// 「관계 중심」(현대 연애) 게임의 ESC 메뉴 판정(2026-10-16). 이런 게임의 메뉴는 전투 능력치(HP·MP·EX·직업·Lv)를 첫 화면에 내지 않고
// 호감도·오늘 남은 시간을 보인다. 잠금(system.genreLock romance)이나 인터뷰 주 장르(romance)가 근거다 — 저작자가 직접 정한 메뉴(meta.oprnFieldMenu)가 있으면
// 항목 구성은 그대로 따르되 첫 화면의 수치 표시만 이 판정을 따른다. 무거운 의존이 없는 잎 모듈이다(플레이어·편집기 양쪽이 쓴다).
import type { Project } from "./types";

export function usesRelationshipMenu(project: Pick<Project, "system" | "gameDesignBrief">): boolean {
  if (project.system?.genreLock?.preset === "romance") return true;
  const interview = project.gameDesignBrief?.interview;
  return interview?.genre === "romance" && interview.secondary === undefined && project.system?.monsterCollection !== true;
}
