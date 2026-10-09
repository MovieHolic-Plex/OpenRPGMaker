// test/parity/parityRig.ts
// Parity tests MUST build projects through editorProject() (real editor mutators +
// serialize/deserialize round-trip) — never by hand — so the editor->player seam is tested.
import { simulateBattle, type SimulateBattleInput, type SimulateBattleResult } from "@/battle/simulate";
import { runSceneTest, type SceneTestInput, type SceneTestResult } from "@/testing/sceneTestRunner";
import {
  addDatabaseRecord,
  deleteDatabaseRecord,
  duplicateDatabaseRecord,
  updateDatabaseRecord,
} from "@/editor/databaseActions";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { collectProjectReferenceIssues } from "@/project/io/references";
import { store } from "@/project/store";
import type { Project } from "@/project/types";

export const DEFAULT_SEED = 1234;
export const DEFAULT_SIM_N = 20;

export { addDatabaseRecord, deleteDatabaseRecord, duplicateDatabaseRecord, updateDatabaseRecord };

/** Runs `mutator` on a fresh blank project via the real editor mutators, then returns the
 * serialize->deserialize round-trip. Mutator errors propagate (never swallowed). */
export function editorProject(mutator: () => void): Project {
  store.replace(createBlankProject());
  mutator();
  return deserialize(serialize(store.getCurrent()));
}

export function referenceIssues(project: Project): string[] {
  return collectProjectReferenceIssues(project);
}

/** Deterministic headless battle: fixed `seed`/`n` defaults so two runs are identical. */
export function battle(project: Project, args: Omit<SimulateBattleInput, "project">): SimulateBattleResult {
  return simulateBattle({ seed: DEFAULT_SEED, n: DEFAULT_SIM_N, ...args, project });
}

export function scene(project: Project, input: SceneTestInput): SceneTestResult {
  return runSceneTest(project, input);
}

export function firstMapId(project: Project): string {
  return Object.keys(project.maps)[0] ?? "";
}
