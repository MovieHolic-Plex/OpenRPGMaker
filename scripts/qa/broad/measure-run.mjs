// 심은 결함 포착 측정 — review 디렉터리의 reviewed.json + 진실 목록 + jobs.json.
//   node scripts/qa/broad/measure-run.mjs <reviewDir> <truth.json> <jobs.json> <out.json>
import fs from "node:fs";
import path from "node:path";
import { measurePlants } from "../pipeline/lib/measure.mjs";

const [reviewDir, truthFile, jobsFile, outFile] = process.argv.slice(2);
if (!reviewDir || !truthFile || !jobsFile) throw new Error("usage: measure-run.mjs <reviewDir> <truth.json> <jobs.json> [out.json]");
const reviewed = JSON.parse(fs.readFileSync(path.join(reviewDir, "reviewed.json"), "utf8"));
const truth = JSON.parse(fs.readFileSync(truthFile, "utf8"));
const jobs = JSON.parse(fs.readFileSync(jobsFile, "utf8"));
const measure = measurePlants(truth, reviewed, jobs);
if (outFile) fs.writeFileSync(outFile, `${JSON.stringify(measure, null, 1)}\n`);
console.log(JSON.stringify({
  planted: measure.planted,
  caughtBefore: measure.caughtBefore,
  caughtAfter: measure.caughtAfter,
  perPlant: measure.plants.map((plant) => ({ type: plant.type, where: `${plant.mapId}/${plant.eventId ?? "-"}`, before: plant.caughtBefore, after: plant.caughtAfter, candidates: plant.candidates.map((c) => `${c.id}:${c.check}:${c.verdict}`) })),
}, null, 1));
