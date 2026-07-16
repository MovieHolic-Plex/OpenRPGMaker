// editor/tools/villageBuilder.ts
// 파사드 — 구현은 village/ 하위 모듈로 분할했다(동작 불변). 외부 import 경로 호환용 re-export 전용.
// 3층: plan_village(계층 계획) → build_village(제약 시공) → critique_village(비평 루프).

export { VILLAGE_TOOLS } from "./village/builder";
export { snapshotProjectMaps, wipeAttemptMaps } from "./village/pipeline";
export type { ProjectMapsBaseline } from "./village/pipeline";
