import { expect, it } from "vitest";
import { buildSettlementReferenceHouses } from "../scripts/lib/settlementReferenceHouses.mts";
import { inspectHouse30 } from "../scripts/lib/house30Authoring.mts";

// The author_village catalog case is retired: author_village was removed on purpose (see CONSTRUCTION_WRITE_SUPERSEDED in src/editor/tools/toolRegistry.ts).

it("keeps four settlement roof contours connected after removing log walls and map decoration", () => {
  const references = buildSettlementReferenceHouses();
  const report = inspectHouse30(references.map((e,i) => ({ number: i+1, name: e.name, description: "정주지 참고", family: "박공", floors: e.exteriorStories,
    doors: e.doors, kit: { ...e.kit, id: `house-30-0${i+1}-reference-check` } })));
  expect(report).toHaveLength(4);
  expect(report.every(r => r.connectedRoof && r.exteriorDoorApproaches === 1)).toBe(true);
});
