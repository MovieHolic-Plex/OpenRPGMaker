// 보고서 렌더 준비 — 실행 디렉터리에 summary/reviewed/final/fix-queue 를 채운다(검토 전 중간 렌더·최종 렌더 공용).
//   node /tmp/fsbroad/stage-report.mjs <runDir> <reviewDir|none> [plantMeasure.json]
import fs from "node:fs";
import path from "node:path";

const [RUN, REVIEW_DIR, MEASURE] = process.argv.slice(2);
const read = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null);
const readJsonl = (file) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line)) : []);

const detected = read(path.join(RUN, "detect-meta.json"));
const play = read(path.join(RUN, "play-meta.json"));
const cluster = read(path.join(RUN, "cluster-meta.json"));
const coverage = read(path.join(RUN, "coverage-plan.json"));
const reviewed = REVIEW_DIR && REVIEW_DIR !== "none" ? read(path.join(REVIEW_DIR, "reviewed.json")) ?? [] : [];
const final = REVIEW_DIR && REVIEW_DIR !== "none" ? read(path.join(REVIEW_DIR, "final.json")) ?? { candidates: 0, verdictCounts: {}, groups: [] } : { candidates: 0, verdictCounts: {}, groups: [], reviewerChain: ["opus", "astra", "argon"] };
const queue = REVIEW_DIR && REVIEW_DIR !== "none" ? read(path.join(REVIEW_DIR, "fix-queue.json")) ?? [] : [];
const measure = MEASURE ? read(MEASURE) : null;

// usage rows live in two files (observer on the VM, reviewer next to reviewed.json); copy the reviewer's next to the run
// so the report's token table can read both from one place.
if (REVIEW_DIR && REVIEW_DIR !== "none") {
  for (const name of ["usage.jsonl", "review-usage.jsonl"]) {
    const from = path.join(REVIEW_DIR, name);
    if (fs.existsSync(from)) fs.copyFileSync(from, path.join(RUN, name === "usage.jsonl" ? "review-usage.jsonl" : name));
  }
}

const summary = {
  tag: path.basename(RUN),
  game: "fallen-star",
  version: "1.39",
  plant: measure ? "p1" : null,
  timings: {},
  usage: {},
  coverage,
  play,
  detect: detected,
  cluster,
  final,
  measure,
};
fs.writeFileSync(path.join(RUN, "summary.json"), JSON.stringify(summary, null, 1));
fs.writeFileSync(path.join(RUN, "reviewed.json"), JSON.stringify(reviewed, null, 1));
fs.writeFileSync(path.join(RUN, "final.json"), JSON.stringify(final, null, 1));
fs.writeFileSync(path.join(RUN, "fix-queue.json"), JSON.stringify(queue, null, 1));
console.log(JSON.stringify({ run: RUN, reviewed: reviewed.length, groups: (final.groups ?? []).length, measure: measure ? `${measure.caughtAfter}/${measure.planted}` : null }));
