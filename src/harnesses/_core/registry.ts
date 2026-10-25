/**
 * 하네스 레지스트리 — 새 하네스는 여기 한 줄을 더한다.
 * 에디터·조수·CLI 는 하네스 폴더를 직접 import 하지 않고 이 레지스트리로 찾는다.
 */
import type { GenrePackId } from "../../project/genrePackId";
import { harnessAppliesTo, type HarnessManifest } from "./manifest";
import { MONSTER_COLLECT_SPECIES_HARNESS } from "../monster-collect-species/harness";
import { MODERN_CHIPSET_HARNESS } from "../modern-chipset/harness";
import { INTERIOR_PROPS_HARNESS } from "../interior-props/harness";
import { MAP_OBJECTS_HARNESS } from "../map-objects/harness";
import { JP_CITY_HARNESS } from "../jp-city/harness";
import { JOSEON_BARAM_HARNESS } from "../joseon-baram/harness";
import { SUPER_HARNESS } from "../super-harness/harness";
import { ROMANCE_SCENE_HARNESS } from "../romance-scene/harness";
import { CHARSET_ACTOR_HARNESS } from "../charset-actor/harness";
import { WORLDMAP_ICONS_HARNESS } from "../worldmap-icons/harness";
import { ASSISTANT_CAPABILITY_HARNESS } from "../assistant-capability/harness";
import { SPACE_CRAFT_HARNESS } from "../space-craft/harness";

import { POKEMON_CHARACTER_MOTION_HARNESS } from "../pokemon-character-motion/harness";
import { POKEMON_CHARACTER_CASTING_HARNESS } from "../pokemon-character-casting/harness";
import { BEODEUL_ARCHITECTURE_HARNESS } from "../beodeul-architecture/harness";
import { BEODEUL_BUILDING_REVIEW_HARNESS } from "../beodeul-building-review/harness";
import { GAME_CONCEPTS_HARNESS } from "../game-concepts/harness";
import { MURIM_CHIPSET_HARNESS } from "../murim-chipset/harness";
import { DUNGEON_CHIPSET_HARNESS } from "../dungeon-chipset/harness";
import { OBJECT_GATE_HARNESS } from "../object-gate/harness";
import { INTERVIEW_SCENE_BANK_HARNESS } from "../interview-scene-bank/harness";
import { BATTLE_TRAINER_SPRITES_HARNESS } from "../battle-trainer-sprites/harness";
import { BUILDING_KIT_HARNESS } from "../building-kit/harness";
import { CAST_PORTRAIT_HARNESS } from "../cast-portrait/harness";

export const HARNESSES: readonly HarnessManifest[] = [
  MONSTER_COLLECT_SPECIES_HARNESS,
  POKEMON_CHARACTER_MOTION_HARNESS,
  POKEMON_CHARACTER_CASTING_HARNESS,
  MODERN_CHIPSET_HARNESS,
  INTERIOR_PROPS_HARNESS,
  MAP_OBJECTS_HARNESS,
  JP_CITY_HARNESS,
  JOSEON_BARAM_HARNESS,
  SUPER_HARNESS,
  ROMANCE_SCENE_HARNESS,
  CHARSET_ACTOR_HARNESS,
  WORLDMAP_ICONS_HARNESS,
  ASSISTANT_CAPABILITY_HARNESS,
  SPACE_CRAFT_HARNESS,
  BEODEUL_ARCHITECTURE_HARNESS,
  BEODEUL_BUILDING_REVIEW_HARNESS,
  GAME_CONCEPTS_HARNESS,
  MURIM_CHIPSET_HARNESS,
  DUNGEON_CHIPSET_HARNESS,
  OBJECT_GATE_HARNESS,
  INTERVIEW_SCENE_BANK_HARNESS,
  BATTLE_TRAINER_SPRITES_HARNESS,
  BUILDING_KIT_HARNESS,
  CAST_PORTRAIT_HARNESS,
];

export function getHarness(id: string): HarnessManifest | undefined {
  return HARNESSES.find((harness) => harness.id === id);
}

export function harnessesForGenre(genre: GenrePackId | null | undefined): HarnessManifest[] {
  return HARNESSES.filter((harness) => harnessAppliesTo(harness, genre));
}
