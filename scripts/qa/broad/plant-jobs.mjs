// 심은 결함이 있는 자리만 골라 작업표를 만든다 — plant 판본으로 그 이벤트·맵을 실제로 플레이하기 위해서.
//   node plant-jobs.mjs <cleanJobs.json> <truth.json> <plantId> [out.json]
import fs from "node:fs";
const [jobsFile, truthFile, plant, outFile] = process.argv.slice(2);
if (!jobsFile || !truthFile || !plant) throw new Error("usage: plant-jobs.mjs <jobs.json> <truth.json> <plantId> [out]");
const jobs = JSON.parse(fs.readFileSync(jobsFile, "utf8"));
const truth = JSON.parse(fs.readFileSync(truthFile, "utf8"));
const wantedEvents = new Set(truth.map((entry) => entry.eventId).filter(Boolean));
const wantedMaps = new Set(truth.map((entry) => entry.mapId).filter(Boolean));
const picked = jobs.filter((job) => {
  if (job.kind === "event" && wantedEvents.has(job.target?.eventId)) return true;
  // The map walk of a planted map sees void tiles and any planted NPC on it.
  if (job.kind === "map" && wantedMaps.has(job.target?.mapId)) return true;
  // A shop playthrough is what shows a planted over-long item name.
  if (job.kind === "shop" && wantedMaps.has(job.target?.mapId)) return true;
  return false;
});
for (const job of picked) job.plant = plant;
const file = outFile ?? jobsFile;
fs.writeFileSync(file, JSON.stringify(picked, null, 1));
console.log(JSON.stringify({ planted: truth.length, jobs: picked.length, ids: picked.map((job) => `${job.id}:${job.kind}`) }));
