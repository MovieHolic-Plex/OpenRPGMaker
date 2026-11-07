// plan-run 의 작업표에 plant 표식을 다시 찍는다(깨끗한 실행 작업표를 재사용할 때).
//   node stamp-plant.mjs <jobs.json> <plantId> [out.json]
import fs from "node:fs";
const [jobsFile, plant, outFile] = process.argv.slice(2);
if (!jobsFile || !plant) throw new Error("usage: stamp-plant.mjs <jobs.json> <plantId> [out]");
const jobs = JSON.parse(fs.readFileSync(jobsFile, "utf8"));
for (const job of jobs) job.plant = plant;
fs.writeFileSync(outFile ?? jobsFile, JSON.stringify(jobs, null, 1));
console.log(JSON.stringify({ jobs: jobs.length, plant, out: outFile ?? jobsFile }));
