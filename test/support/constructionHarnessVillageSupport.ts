import { runAuthorVillage, AUTHOR_VILLAGE_TOOL } from "@/editor/tools/authorVillageTool";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { getTool } from "@/editor/tools/toolRegistry";
import { createBlankMap } from "@/project/defaults";
import type { Project } from "@/project/types";

import {
  HarnessInvariantError,
  projectQa,
  projectSha256,
  recordObservation,
  requiredAudit,
} from "./constructionHarnessRecord";
import type {
  HarnessCaseRecord,
  HarnessCategory,
  HarnessOutcome,
  HarnessQa,
} from "./constructionHarnessTypes";

type VillageScenarioIdentity = {
  readonly id: string;
  readonly category: HarnessCategory;
  readonly seed: number;
  readonly expectedOutcome: HarnessOutcome;
};

type VillageScenarioInput = {
  readonly identity: VillageScenarioIdentity;
  readonly project: Project;
  readonly args: Record<string, unknown>;
  readonly verify: (qa: HarnessQa, result: ReturnType<typeof runAuthorVillage>) => boolean;
};

export function existingVillageProject(size: number): Project {
  const project = createEmptyToolProject("construction harness village");
  const map = createBlankMap("Existing Harness Village", size, size);
  map.id = "map_village_harness";
  project.maps = { [map.id]: map };
  project.mapTree = { mapId: map.id, children: [] };
  project.startMapId = map.id;
  project.startPos = { x: 1, y: 1 };
  return project;
}

export async function runVillageScenario(input: VillageScenarioInput): Promise<HarnessCaseRecord> {
  const registered = getTool("author_village");
  if (registered === undefined || registered.run !== AUTHOR_VILLAGE_TOOL.run) {
    throw new HarnessInvariantError(input.identity.id, "author_village is not registered to the canonical facade");
  }
  const context = { project: input.project };
  const beforeHash = await projectSha256(context.project);
  const result = runAuthorVillage(context, input.args);
  const audit = requiredAudit(input.identity.id, result);
  const qa = projectQa(context.project, audit, {
    interiorMapIds: result.data.village.interiorMapIds,
    structuralQaOk: result.data.village.structuralQa.ok,
  });
  return recordObservation({
    ...input.identity,
    beforeHash,
    project: context.project,
    result,
    qa,
    extraChecksPassed: input.verify(qa, result),
  });
}

export function existingTarget(mapId = "map_village_harness") {
  return { kind: "existing", mapId } as const;
}
