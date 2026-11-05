#!/usr/bin/env node
// Deterministic stage + observer frame selection + candidate clustering for one run directory.
//   node vm/triage.mjs --run <runDir> --phase detect     -> deterministic.json, observe-frames.json, detect-meta.json
//   node vm/triage.mjs --run <runDir> --phase cluster    -> candidates.json (after observe.mjs wrote observations.jsonl)
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { detectRun, groupDeterministic, selectForObserver } from "../lib/detect.mjs";
import { buildCandidates } from "../lib/cluster.mjs";

const { values } = parseArgs({ options: { run: { type: "string" }, phase: { type: "string" }, "max-observe": { type: "string", default: "600" } } });
const RUN = values.run;
const readJsonl = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : []);

function loadRuns() {
  const dir = path.join(RUN, "jobs");
  return fs.readdirSync(dir).map((id) => {
    const job = JSON.parse(fs.readFileSync(path.join(dir, id, "job.json"), "utf8"));
    const summaryFile = path.join(dir, id, "summary.json");
    return { job, summary: fs.existsSync(summaryFile) ? JSON.parse(fs.readFileSync(summaryFile, "utf8")) : { fatal: "no summary (killed)" }, rows: readJsonl(path.join(dir, id, "trace.jsonl")) };
  });
}

const runs = loadRuns();
const { findings, frames } = detectRun(runs);
if (values.phase === "detect") {
  const grouped = groupDeterministic(findings);
  const selected = selectForObserver(frames).slice(0, Number(values["max-observe"]));
  fs.writeFileSync(path.join(RUN, "deterministic.json"), JSON.stringify(grouped, null, 1));
  fs.writeFileSync(path.join(RUN, "observe-frames.json"), JSON.stringify(selected));
  const meta = {
    sessions: runs.length, frames: frames.length, settled: frames.filter((f) => f.settled).length,
    dark: frames.filter((f) => (f.lum ?? 0) < 10).length, observeSelected: selected.length,
    deterministicRaw: findings.length, deterministicGroups: grouped.length,
    byCheck: Object.fromEntries([...new Set(grouped.map((g) => g.check))].map((c) => [c, grouped.filter((g) => g.check === c).length])),
    fatal: runs.filter((r) => r.summary?.fatal).length, blockedRequests: runs.reduce((a, r) => a + (r.summary?.blockedCount ?? 0), 0),
  };
  fs.writeFileSync(path.join(RUN, "detect-meta.json"), JSON.stringify(meta, null, 1));
  console.log("DETECT " + JSON.stringify(meta));
} else if (values.phase === "cluster") {
  const job0 = runs[0]?.job ?? {};
  const candidates = buildCandidates({
    deterministic: JSON.parse(fs.readFileSync(path.join(RUN, "deterministic.json"), "utf8")),
    staticFindings: fs.existsSync(path.join(RUN, "static.json")) ? JSON.parse(fs.readFileSync(path.join(RUN, "static.json"), "utf8")) : [],
    observations: readJsonl(path.join(RUN, "observations.jsonl")),
    frames, game: job0.slug, version: job0.version,
  });
  // Evidence paths stay run-relative so the orchestrator can pull exactly these files.
  for (const c of candidates) for (const f of c.frames) f.rel = `jobs/${f.job}/shots/${f.file}`;
  fs.writeFileSync(path.join(RUN, "candidates.json"), JSON.stringify(candidates, null, 1));
  const obs = readJsonl(path.join(RUN, "observations.jsonl"));
  const meta = { candidates: candidates.length, bySource: Object.fromEntries(["deterministic", "static", "observer"].map((s) => [s, candidates.filter((c) => c.source === s).length])), observed: obs.length, observedFailed: obs.filter((o) => !o.ok).length, observerIssues: obs.reduce((a, o) => a + o.issues.length, 0) };
  fs.writeFileSync(path.join(RUN, "cluster-meta.json"), JSON.stringify(meta, null, 1));
  console.log("CLUSTER " + JSON.stringify(meta));
}
