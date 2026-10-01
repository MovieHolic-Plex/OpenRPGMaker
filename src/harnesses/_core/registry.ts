/**
 * 하네스 레지스트리 — 새 하네스는 여기 한 줄을 더한다.
 * 에디터·조수·CLI 는 하네스 폴더를 직접 import 하지 않고 이 레지스트리로 찾는다.
 */
import type { GenrePackId } from "../../project/genrePackId";
import { harnessAppliesTo, type HarnessManifest } from "./manifest";
import { MONSTER_COLLECT_SPECIES_HARNESS } from "../monster-collect-species/harness";

export const HARNESSES: readonly HarnessManifest[] = [
  MONSTER_COLLECT_SPECIES_HARNESS,
];

export function getHarness(id: string): HarnessManifest | undefined {
  return HARNESSES.find((harness) => harness.id === id);
}

export function harnessesForGenre(genre: GenrePackId | null | undefined): HarnessManifest[] {
  return HARNESSES.filter((harness) => harnessAppliesTo(harness, genre));
}
