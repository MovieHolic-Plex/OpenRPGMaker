/**
 * 하네스 레지스트리 — 새 하네스는 여기 한 줄을 더한다.
 * 에디터·조수·CLI 는 하네스 폴더를 직접 import 하지 않고 이 레지스트리로 찾는다.
 */
import type { GenrePackId } from "../../project/genrePackId";
import { harnessAppliesTo, type HarnessManifest } from "./manifest";
import { MONSTER_COLLECT_SPECIES_HARNESS } from "../monster-collect-species/harness";
import { MODERN_CHIPSET_HARNESS } from "../modern-chipset/harness";
import { INTERIOR_PROPS_HARNESS } from "../interior-props/harness";
import { JP_CITY_HARNESS } from "../jp-city/harness";
import { JOSEON_BARAM_HARNESS } from "../joseon-baram/harness";

import { POKEMON_CHARACTER_MOTION_HARNESS } from "../pokemon-character-motion/harness";
import { POKEMON_CHARACTER_CASTING_HARNESS } from "../pokemon-character-casting/harness";

export const HARNESSES: readonly HarnessManifest[] = [
  MONSTER_COLLECT_SPECIES_HARNESS,
  POKEMON_CHARACTER_MOTION_HARNESS,
  POKEMON_CHARACTER_CASTING_HARNESS,
  MODERN_CHIPSET_HARNESS,
  INTERIOR_PROPS_HARNESS,
  JP_CITY_HARNESS,
  JOSEON_BARAM_HARNESS,
];

export function getHarness(id: string): HarnessManifest | undefined {
  return HARNESSES.find((harness) => harness.id === id);
}

export function harnessesForGenre(genre: GenrePackId | null | undefined): HarnessManifest[] {
  return HARNESSES.filter((harness) => harnessAppliesTo(harness, genre));
}

/** 에디터 「공방」에 보일 하네스 — 에디터 화면이 있고 실행기가 있고 장르가 맞는 것. */
export function workshopHarnesses(genre: GenrePackId | null | undefined): HarnessManifest[] {
  return harnessesForGenre(genre).filter((harness) => harness.entrypoints.editorUi && harness.workshop !== undefined);
}
