// Total mapping from the 51 audited coverage rows + F01..F13 findings to fixture
// scenario ids. Kept beside the fixture so the test can assert it is exhaustive.
import { LIFE_FULL_SCENARIOS as S, type LifeFullScenarioId } from "./lifeFullProject";

export const LIFE_FULL_FEATURE_SCENARIOS: Readonly<Record<string, LifeFullScenarioId>> = {
  C1: S.authoring, C2: S.authoring, C3: S.farming, C4: S.farming,
  C5: S.farming, C6: S.treeChop, C7: S.farming, C8: S.farming,
  R1: S.residents, R2: S.residents, R3: S.residents, R4: S.residents,
  R5: S.residents, R6: S.residents, R7: S.residents, R8: S.residents,
  L0: S.authoring, L1: S.crafting, L2: S.crafting, L3: S.crafting,
  L4: S.gathering, L5: S.treeChop, L6: S.gathering, L7: S.upgrade,
  L8: S.bundle, L9: S.bundle, L10: S.crafting,
  W1: S.dayCycle, W2: S.dayCycle, W3: S.dayCycle, W4: S.dayCycle, W5: S.dayCycle,
  A1: S.animals, A2: S.animals, A3: S.animals, A4: S.animals,
  A5: S.animals, A6: S.animals,
  S1: S.buildings, S2: S.buildings, S3: S.buildings,
  S4: S.buildings, S5: S.buildings, S6: S.buildings,
  K1: S.shipping, K2: S.shipping, K3: S.shipping, K4: S.saveResume,
  K5: S.saveResume, K6: S.saveResume, K7: S.recovery,
};

export const LIFE_FULL_FINDING_SCENARIOS: Readonly<Record<string, LifeFullScenarioId>> = {
  F01: S.farming, F02: S.farming, F03: S.craftingFailure, F04: S.saveResume,
  F05: S.shipping, F06: S.treeChop, F07: S.residents, F08: S.buildings,
  F09: S.buildings, F10: S.shipping, F11: S.animals, F12: S.dayCycle,
  F13: S.authoring,
};
