// 생활 원장 메뉴를 열 데이터가 있는지 — 순수 판정만 둔다(타입 import 뿐).
// 내보내기 의존성 수집기(webExportRuntimeAssets → releaseDependencyCollector)가 이것만 쓴다. lifeLedger.ts 를
// 끌면 io·migration·defaults 를 거쳐 번들 타일셋 정의까지 수집기 번들에 들어온다(2026-10-20, 64MiB 검사 상한 초과).
import type { PlaySession } from "@/project/session";
import type { Project } from "@/project/types";

/** 몬스터만 낚이는 낚시터(catches 비어 있음)는 도감에 올릴 어종이 없다 — 그것만으로 생활 기록 메뉴를 만들지 않는다. */
export function fishingHasLedgerData(project: Project): boolean {
  return project.system.fishing?.enabled === true && project.system.fishing.spots.some((spot) => spot.catches.length > 0 || (spot.monsterCatches?.length ?? 0) === 0);
}

/** Project-authored life packages only. Session claims are checked separately. */
export function hasProjectLifeLedgerData(project: Project): boolean {
  return project.system.shipping?.enabled === true
    || (project.system.bundles?.length ?? 0) > 0
    || (project.system.skillSystem?.enabled === true && (project.database.lifeSkills?.length ?? 0) > 0)
    || (project.system.makers?.length ?? 0) > 0
    || (project.database.farmAnimalSpecies?.length ?? 0) > 0
    || (project.system.farmAnimalBuildings?.length ?? 0) > 0
    || (project.session.farmAnimals?.length ?? 0) > 0
    || (project.database.farmBuildingTypes?.length ?? 0) > 0
    || (project.database.homeDecorationTypes?.length ?? 0) > 0
    || (project.session.farmBuildingPlacements?.length ?? 0) > 0
    || (project.session.homeDecorationPlacements?.length ?? 0) > 0
    || fishingHasLedgerData(project)
    || project.system.seasonalForage?.enabled === true
    || project.system.collections?.enabled === true
    || project.system.museum?.enabled === true;
}

export function hasSessionLifeRecoveryClaims(session: PlaySession): boolean {
  const claims = session.lifeRecovery?.claims;
  return !!claims && Object.keys(claims).length > 0;
}

/** Optional session unlocks the recovery-only resume path when packages are all off. */
export function hasLifeLedgerData(project: Project, session?: PlaySession): boolean {
  return hasProjectLifeLedgerData(project) || (session ? hasSessionLifeRecoveryClaims(session) : false);
}
