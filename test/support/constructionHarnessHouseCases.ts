import { AUTHOR_HOUSE_TOOL, runAuthorHouse } from "@/editor/tools/authorHouseFacade";
import { getTool } from "@/editor/tools/toolRegistry";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { createBlankMap } from "@/project/defaults";
import type { Project } from "@/project/types";

import {
  HarnessInvariantError,
  projectQa,
  projectSha256,
  recordObservation,
  requiredAudit,
} from "./constructionHarnessRecord";
import type { HarnessCaseDefinition, HarnessOutcome } from "./constructionHarnessTypes";

const EXTERIOR_REQUEST = {
  kind: "single",
  mapId: "map_house_harness",
  kitId: "blue-stone",
  wings: [{ x: 3, y: 3, w: 8, h: 6 }],
  interior: "exterior-only",
  door: true,
} as const;

export function houseHarnessCases(seed: number, negativeControl: boolean): readonly HarnessCaseDefinition[] {
  const exteriorExpectation: HarnessOutcome = negativeControl ? "blocked" : "exact";
  return [
    {
      id: "house-exterior",
      category: "happy",
      seed,
      expectedOutcome: exteriorExpectation,
      run: () => runHouseExterior(seed, exteriorExpectation),
    },
    {
      id: "house-linked-interior",
      category: "happy",
      seed,
      expectedOutcome: "exact",
      run: () => runHouseLinkedInterior(seed),
    },
    {
      id: "house-bad-bounds",
      category: "blocked",
      seed,
      expectedOutcome: "blocked",
      run: () => runHouseBadBounds(seed),
    },
  ];
}

function houseProject(): Project {
  const project = createEmptyToolProject("construction harness house");
  const map = createBlankMap("House Harness", 48, 36);
  map.id = "map_house_harness";
  project.maps = { [map.id]: map };
  project.mapTree = { mapId: map.id, children: [] };
  project.startMapId = map.id;
  project.startPos = { x: 1, y: 1 };
  return project;
}

function assertHouseRegistered(caseId: string): void {
  const registered = getTool("author_house");
  if (registered === undefined || registered.run !== AUTHOR_HOUSE_TOOL.run) {
    throw new HarnessInvariantError(caseId, "author_house is not registered to the canonical facade");
  }
}

async function runHouseExterior(seed: number, expectedOutcome: HarnessOutcome) {
  const id = "house-exterior";
  assertHouseRegistered(id);
  const context = { project: houseProject() };
  const beforeHash = await projectSha256(context.project);
  const result = runAuthorHouse(context, EXTERIOR_REQUEST);
  const audit = requiredAudit(id, result);
  const qa = projectQa(context.project, audit);
  return recordObservation({
    id,
    category: "happy",
    seed,
    expectedOutcome,
    beforeHash,
    project: context.project,
    result,
    qa,
    extraChecksPassed: result.data.houses.length === 1
      && result.data.houses[0]?.interior === undefined
      && qa.actualCount === 1,
  });
}

async function runHouseLinkedInterior(seed: number) {
  const id = "house-linked-interior";
  assertHouseRegistered(id);
  const context = { project: houseProject() };
  const beforeHash = await projectSha256(context.project);
  const result = runAuthorHouse(context, {
    ...EXTERIOR_REQUEST,
    ownerName: "Harness Resident",
    interior: "linked-interior",
  });
  const audit = requiredAudit(id, result);
  const interiorMapIds = result.data.houses.flatMap((house) =>
    house.interior === undefined ? [] : [house.interior.interiorMapId]);
  const qa = projectQa(context.project, audit, { interiorMapIds });
  return recordObservation({
    id,
    category: "happy",
    seed,
    expectedOutcome: "exact",
    beforeHash,
    project: context.project,
    result,
    qa,
    extraChecksPassed: result.data.houses.length === 1
      && interiorMapIds.length === 1
      && qa.linkedTransferCount >= 2,
  });
}

async function runHouseBadBounds(seed: number) {
  const id = "house-bad-bounds";
  assertHouseRegistered(id);
  const context = { project: houseProject() };
  const beforeHash = await projectSha256(context.project);
  const result = runAuthorHouse(context, {
    ...EXTERIOR_REQUEST,
    wings: [{ x: 44, y: 32, w: 8, h: 6 }],
  });
  const audit = requiredAudit(id, result);
  const qa = projectQa(context.project, audit);
  return recordObservation({
    id,
    category: "blocked",
    seed,
    expectedOutcome: "blocked",
    beforeHash,
    project: context.project,
    result,
    qa,
    extraChecksPassed: result.data.houses.length === 0 && qa.actualCount === 0,
  });
}
