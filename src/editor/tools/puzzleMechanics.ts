// src/editor/tools/puzzleMechanics.ts
// 품질 퍼즐 프리셋 등록부 — presetId → 시공기(MechanicDef). 여기 있는 id 는 author_map_puzzle 이 옛 무대 시공 대신
// 상태 공간 모형이 있는 방으로 짓는다(puzzleMechanicCore 참고).

import type { PuzzlePresetId } from "./puzzleAuthoringTools";
import type { MechanicDef } from "./puzzleMechanicCore";
import { balanceScaleWeights, elementalOrbPlacement, flipFloorTiles, liarChests, numberCodeLock, twinCisterns } from "./puzzleMechanicsDeduce";
import { brazierRelationalOrder, leverMastermind, organEchoMemory, sealCrystalsLightsOut } from "./puzzleMechanicsLogic";
import { crackedPlankBridge, sokobanPlates } from "./puzzleMechanicsSpatial";

export const PUZZLE_MECHANICS: Partial<Record<PuzzlePresetId, MechanicDef>> = {
  statue_pressure_plates: sokobanPlates,
  boss_seal_monoliths: sealCrystalsLightsOut,
  brazier_ignition_order: brazierRelationalOrder,
  cathedral_organ_tuning: organEchoMemory,
  two_step_sequence: leverMastermind,
  riddle_mimic_chests: liarChests,
  elemental_pedestal_swap: elementalOrbPlacement,
  sluice_lava_bridge: twinCisterns,
  cracked_plank_bridge: crackedPlankBridge,
  number_code_lock: numberCodeLock,
  balance_scale_weights: balanceScaleWeights,
  flip_floor_tiles: flipFloorTiles,
};
