import fs from "node:fs";
import { deserialize, serialize } from "../src/project/io";
import { instantiateSpatialDesign } from "../src/project/spatial/instances";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { spatialId } from "../src/project/spatial/domain";
import { validateClusterRules } from "../src/project/lint/clusterRuleValidators";
import { computeReachableCells } from "../src/project/lint/reachability";
import { isPassableLanding } from "../src/project/collision";
const out = "output/evidence/interior-catalog-review";
const source = process.argv[2] ?? `${out}/raw-before.json`;
const suffix = process.argv[3] ?? "before";
const project = structuredClone(deserialize(fs.readFileSync(source, "utf8")));
project.spatialAuthoring!.occurrences = {};
project.spatialAuthoring!.connections = [];
project.spatialAuthoring!.rootOccurrenceIds = [];
const report = [];
const renders = [];
for (const [index, space] of Object.values(
  project.spatialAuthoring!.library.spaces,
)
  .filter((s) => s.environment === "interior" && (process.argv[5] !== "life" || s.tags.includes("생활 구역 구성 20260914")))
  .entries()) {
  const rootId = spatialId(`interior-audit:${index}`);
  const row: any = {
    index,
    id: space.id,
    name: space.name,
    width: space.width,
    height: space.height,
    slots: space.objectSlots.length,
    roomCount: space.interiorLayout?.rooms.length ?? 1,
  };
  try {
    const doc = instantiateSpatialDesign(project.spatialAuthoring!, project, {
      source: { kind: "space", id: space.id },
      rootId,
      x: 0,
      y: 0,
      level: 0,
      seed: Number(process.argv[4] ?? 20260913),
      generatorVersion: "interior-review-v1",
    });
    const result = compileSpatialOccurrence(
      { ...project, spatialAuthoring: doc },
      { occurrenceId: rootId },
    );
    const occurrence = result.spatialAuthoring!.occurrences[rootId]!;
    const map = result.maps[occurrence.bindings[0]!.mapId]!;
    const plan = map.roomHarnessPlan!.plan;
    const reached = computeReachableCells(
      result,
      map,
      plan.door.x,
      plan.door.y,
    );
    const isolated = [];
    let walkable = 0;
    for (let y = 4; y < space.height + 4; y++)
      for (let x = 2; x < space.width + 2; x++)
        if (isPassableLanding(result, map, x, y)) {
          walkable++;
          if (!reached.has(`${x},${y}`)) isolated.push({ x, y });
        }
    const objects = Object.values(result.spatialAuthoring!.occurrences).filter(
      (o) => o.parentId === rootId,
    );
    Object.assign(row, {
      status: "compiled",
      walkable,
      isolated,
      omitted: objects
        .filter((o) => !o.bindings.length)
        .map((o) => o.source.id),
      errors: validateClusterRules(result, map.id).filter(
        (i) => i.severity === "error",
      ),
    });
    renders.push({ index, id: space.id, name: space.name, map });
  } catch (error) {
    Object.assign(row, { status: "failed", error: String(error) });
  }
  report.push(row);
}
fs.writeFileSync(
  `${out}/audit-${suffix}.json`,
  JSON.stringify(report, null, 2),
);
fs.writeFileSync(
  `${out}/renders-${suffix}.json`,
  JSON.stringify({ tilesets: project.tilesets, renders }),
);
console.log(
  JSON.stringify({
    count: report.length,
    compiled: report.filter((r) => r.status === "compiled").length,
    failed: report
      .filter((r) => r.status === "failed")
      .map((r) => ({ id: r.id, error: r.error })),
    bad: report
      .filter(
        (r) => r.errors?.length || r.isolated?.length || r.omitted?.length,
      )
      .map((r) => ({
        id: r.id,
        errors: r.errors?.length,
        isolated: r.isolated?.length,
        omitted: r.omitted?.length,
      })),
  }),
);
