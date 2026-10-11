// jp_city 컨셉의 시작 맵이 완성 장소로 열리는지 — bun scripts/qa/jp-start-probe.mts [--out output/evidence/jp-start]
import { readFileSync } from "node:fs";
import { setRegionReferenceDownloadLoader } from "../../src/project/regionReferenceImport.ts";
import fs from "node:fs";
import { renderMapPng } from "../qa-game/render.mts";
import { createNewProjectSeed } from "../../src/editor/genrePacks.ts";
import { newProjectChoiceById } from "../../src/editor/newProjectChoices.ts";
import { ensureBundledTilesets } from "../../src/project/defaults/defaultAssets.ts";
import { conceptBrief } from "../../src/concepts/brief.ts";
import { bundledConcepts } from "../../src/concepts/source.ts";
import { buildPlayableSegmentSkeleton, judgePlayableSegment, preloadKitStartPlaces, supportsPlayableSegment } from "../../src/project/playableSegment.ts";
import { planStartForBrief } from "../../src/project/startVariety.ts";
import type { Project } from "../../src/project/types.ts";
setRegionReferenceDownloadLoader(async (url: string) => JSON.parse(readFileSync(`public${url}`, "utf8")));
const i = process.argv.indexOf("--out"); const OUT = i >= 0 ? process.argv[i + 1]! : "output/evidence/jp-start";
fs.mkdirSync(OUT, { recursive: true });
await preloadKitStartPlaces();
for (const concept of bundledConcepts().filter((c) => c.tilesetHint === "jp_city")) {
  const choice = newProjectChoiceById(concept.presetId)!;
  const base = createNewProjectSeed(choice.packId, concept.title) as Project;
  ensureBundledTilesets(base);
  base.gameDesignBrief = { ...conceptBrief(concept), generationPending: true };
  if (!supportsPlayableSegment(base)) { console.log(concept.slug, "skeleton n/a", concept.presetId); continue; }
  const plan = planStartForBrief(base.gameDesignBrief, base.meta.title);
  try {
    const project = buildPlayableSegmentSkeleton(structuredClone(base));
    const v = judgePlayableSegment(project);
    const start = project.maps[project.startMapId]!;
    fs.writeFileSync(`${OUT}/${concept.slug}-start.png`, renderMapPng(project, start).png);
    console.log(concept.slug, plan.placeId, `${start.width}x${start.height}`, "ok", v.ok, v.ok ? "" : v.blockers.slice(0, 2));
  } catch (e) { console.log(concept.slug, plan.placeId, "ERR", String((e as Error).message).slice(0, 200)); }
}
