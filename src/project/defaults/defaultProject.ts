import type { Project } from "../types";
import { configureScarloxyDemoProject, createScarloxyDemoMaps } from "./scarloxyDemoGame";
import { createProjectWithMaps } from "./blankProject";
// 가벼운 핵심은 blankProject.ts 에 있다. 옛 import 경로를 유지하려고 여기서 다시 내보낸다.
export { createBlankProject, ensureSwitchVariableSlots } from "./blankProject";

// 2026-10-07 저작권 정리: 지운 칩셋(EasyRPG 합본 마을·실내·던전, 숲마을, 기후 마을 등) 위에 그려진
// 데모·쇼케이스 프로젝트(이슬 마을 예제, 학습 예시, 집·마을 쇼케이스, 눈산·얼음 평원, 시장 마을,
// 상점·농장 데모, Scarloxy 포켓몬풍 데모)는 지웠다. 남은 예제는 Scarloxy 팩 데모 하나다.

// Scarloxy MPWSP01 팩 데모 — 팩 타일 그림판/캐릭셋/몬스터/전투 배경/이펙트를 조합한 예시.
export function createScarloxyDemoProject(): Project {
  const project = createProjectWithMaps(createScarloxyDemoMaps(), 0);
  configureScarloxyDemoProject(project);
  return project;
}
