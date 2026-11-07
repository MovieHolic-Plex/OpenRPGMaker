#!/usr/bin/env node
// Review stage: a top model (Anthropic Opus by default) reads every candidate defect with its evidence,
// rejects misreads / transition frames / by-design behavior, then a second whole-report pass merges
// duplicates and ranks what is left. Output: review.jsonl (per candidate), final.json, fix-queue.json.
//
// usage: node scripts/qa/pipeline/review.mjs --candidates <candidates.json> --out <dir> [--pool 6] [--model claude-opus-5-5]
// env:   ANTHROPIC_BASE_URL + ANTHROPIC_AUTH_TOKEN (the same pair the claude CLI uses)
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { defaultReviewerChain, extractJson, imageBlockAnthropic, pool, reviewerChain, usageLedger } from "./lib/models.mjs";

const VERDICTS = ["real", "misread", "transition", "by_design", "not_visible", "environment"];
const SEVERITIES = ["blocker", "save-data", "function", "visual", "text"];
const OWNERS = ["game-data", "engine", "editor", "assistant"];

const SYSTEM = [
  "You are the final reviewer of an automated QA run on a pixel-art RPG made with OpenRPGMaker.",
  "Cheap vision models produced candidate defects; many are wrong. Your job is to keep only defects that the evidence proves.",
  "Read the screenshots yourself. Small pixel fonts are often misread by the cheap models: compare every quoted string, number and name",
  "against the DOM text dump when one is given (the DOM text is ground truth for what the UI printed) and against the pixels.",
  "Verdicts: real (visible in the evidence and wrong for a player), misread (the claim misreads text/numbers/objects or describes something not there),",
  "transition (a fade/battle-entry/scene-cut frame that the next frame resolves; one dark frame is not a hang),",
  "by_design (intended presentation: greyed disabled items, cutscene letterbox, hidden HUD during events, pixel-art style, intended empty space),",
  "not_visible (the claimed defect cannot be seen in any provided frame), environment (QA harness artifact: loading screen, error page, 429).",
  "Be strict: if you cannot point at the defect in a specific frame, it is not real.",
  "Text that does not fit its box (a name, label or line cut at the box edge in a list, menu, shop, HUD or a finished dialogue page) is never a transition.",
  "Typewriter reveal is only a transition when the next frame shows the same box with more text and the page indicator; say which frame shows it.",
  "Owner: game-data (fix in this game's project data: text, map, event, balance, asset choice) vs engine (player/runtime code affecting every game)",
  "vs editor (authoring tool lets authors create it) vs assistant (the AI assistant generated it and should be prevented).",
  "Answer with one JSON object only.",
].join(" ");

function candidatePrompt(c) {
  const lines = [
    `Candidate ${c.id} (game ${c.game}${c.version ? " " + c.version : ""}, source ${c.source ?? "observer"}, check ${c.check ?? "?"})`,
    `Claim: ${c.title ?? ""} — ${c.claim ?? ""}`,
    c.where ? `Where: ${c.where}` : "",
    c.observerReason ? `Observer's reasoning: ${c.observerReason}` : "",
    c.observerSeverity ? `Observer severity: ${c.observerSeverity}` : "",
    c.count ? `Reported ${c.count} times across ${c.sessions ?? "?"} sessions.` : "",
    c.state ? `Runtime state: ${c.state}` : "",
    c.inputs ? `Inputs before the frame: ${c.inputs}` : "",
    c.domText ? `DOM text on screen (ground truth): ${c.domText.slice(0, 1500)}` : "",
    c.signals ? `Deterministic signals: ${JSON.stringify(c.signals).slice(0, 1200)}` : "",
    isMeasured(c) ? "This finding was MEASURED by the harness (DOM geometry, network, runtime state or project data), not guessed from pixels. It stands unless the evidence shows a QA-harness artifact (verdict environment). Rank it, name the owner, explain it." : "",
    (c.frames ?? []).length ? `Frames attached in order: ${c.frames.map((f) => f.role).join(", ")}` : "No frames attached.",
    "",
    "Return JSON: {\"verdict\":\"" + VERDICTS.join("|") + "\",\"confidence\":0.0-1.0,\"severity\":\"" + SEVERITIES.join("|") + "\",",
    "\"owner\":\"" + OWNERS.join("|") + "\",\"title_ko\":\"한 줄 제목\",\"evidence_ko\":\"어느 프레임 어디에서 무엇이 보이는지 2문장 이내\",",
    "\"repro_ko\":\"재현 절차 한 줄(입력·위치)\",\"fix_hint_ko\":\"고칠 곳 한 줄\"}",
  ];
  return lines.filter(Boolean).join("\n");
}

/**
 * Machine-measured findings (DOM overflow, HTTP 404, page errors, stuck state, static data checks) are facts the
 * reviewer cannot overturn by looking at a frame that does not show them: the reviewer ranks and explains them,
 * and only `environment` (a QA-harness artifact) may remove one.
 */
const MEASURED = new Set(["garbled-text", "placeholder-text", "text-clipped", "offscreen-ui", "asset-request", "missing-resource", "missing-texture", "page-error", "black-screen", "bad-transfer", "bad-shop", "endless-loop", "portrait-kind", "sprite-cell-range", "session-fatal", "event-no-response"]);
// Harness-dependent signals (stuck / battle-not-started / input-mode-ignored) are NOT measured facts: they depend on
// how the scripted player drove the game, so the reviewer may reject them.
export function isMeasured(c) {
  return (c.source === "deterministic" || c.source === "static") && MEASURED.has(c.check);
}
function applyMeasuredFloor(c, row) {
  if (!isMeasured(c) || row.verdict === "real" || row.verdict === "environment" || row.verdict === null) return row;
  return { ...row, reviewerVerdict: row.verdict, verdict: "real", confidence: Math.min(row.confidence || 0.6, 0.6), floor: "measured" };
}

export async function reviewCandidates(candidates, { client, poolSize = 6, onRow }) {
  return pool(candidates, poolSize, async (c) => {
    const content = [];
    for (const frame of (c.frames ?? []).slice(0, 4)) {
      if (!fs.existsSync(frame.file)) continue;
      content.push({ type: "text", text: `[${frame.role}] ${path.basename(frame.file)}` });
      content.push(imageBlockAnthropic(frame.file));
    }
    content.push({ type: "text", text: candidatePrompt(c) });
    let res = await client(content, { system: SYSTEM, maxTokens: 3000 });
    let parsed = res.ok ? extractJson(res.text, ["verdict"]) : null;
    if (res.ok && !parsed) {
      res = await client([...content, { type: "text", text: "Return only the JSON object now." }], { system: SYSTEM, maxTokens: 1200 });
      parsed = res.ok ? extractJson(res.text, ["verdict"]) : null;
    }
    const row = applyMeasuredFloor(c, {
      id: c.id,
      verdict: VERDICTS.includes(parsed?.verdict) ? parsed.verdict : null,
      confidence: Number(parsed?.confidence ?? 0),
      severity: SEVERITIES.includes(parsed?.severity) ? parsed.severity : null,
      owner: OWNERS.includes(parsed?.owner) ? parsed.owner : null,
      title_ko: parsed?.title_ko ?? null,
      evidence_ko: parsed?.evidence_ko ?? null,
      repro_ko: parsed?.repro_ko ?? null,
      fix_hint_ko: parsed?.fix_hint_ko ?? null,
      error: res.ok ? (parsed ? null : "unparsed") : res.error,
    });
    onRow?.(row);
    return row;
  });
}

const MERGE_SYSTEM = [
  "You are the final QA editor. You get the defects that survived per-item review, as JSON.",
  "Merge items that are the same underlying defect (same UI element/asset/event, even on different maps or frames) into one group.",
  "Rank groups by player impact: blocker > save-data > function > visual > text; within a tier, by how often a player meets it.",
  "Keep every input id in exactly one group. Answer with one JSON object only.",
].join(" ");

export async function mergeReport(kept, { client }) {
  if (kept.length === 0) return { groups: [] };
  const brief = kept.map((k) => ({ id: k.id, game: k.game, title: k.review.title_ko, evidence: k.review.evidence_ko, severity: k.review.severity, owner: k.review.owner, where: k.where, check: k.check, confidence: k.review.confidence }));
  const prompt = `${JSON.stringify(brief)}\n\nReturn {"groups":[{"ids":["..."],"title_ko":"...","severity":"${SEVERITIES.join("|")}","owner":"${OWNERS.join("|")}","confidence":0.0-1.0,"why_ko":"병합·순위 근거 한 줄"}]} ordered most important first.`;
  const res = await client([{ type: "text", text: prompt }], { system: MERGE_SYSTEM, maxTokens: 6000 });
  const parsed = res.ok ? extractJson(res.text, ["groups"]) : null;
  if (!parsed) return { groups: kept.map((k) => ({ ids: [k.id], title_ko: k.review.title_ko, severity: k.review.severity, owner: k.review.owner, confidence: k.review.confidence, why_ko: "merge pass failed; kept per-item" })), mergeError: res.error ?? "unparsed" };
  const seen = new Set(parsed.groups.flatMap((g) => g.ids));
  for (const k of kept) if (!seen.has(k.id)) parsed.groups.push({ ids: [k.id], title_ko: k.review.title_ko, severity: k.review.severity, owner: k.review.owner, confidence: k.review.confidence, why_ko: "omitted by merge pass; re-added" });
  return parsed;
}

/** Fix queue for fix lanes: one entry per merged defect, split by where the fix belongs. */
export function buildFixQueue(final, byId) {
  return final.groups.map((g, index) => {
    const members = g.ids.map((id) => byId.get(id)).filter(Boolean);
    const lead = members[0];
    return {
      rank: index + 1,
      id: `QA-${String(index + 1).padStart(3, "0")}`,
      game: lead?.game,
      version: lead?.version,
      severity: g.severity,
      owner: g.owner,
      track: g.owner === "game-data" ? "game-data" : "engine/editor/assistant",
      title_ko: g.title_ko,
      confidence: g.confidence,
      candidates: g.ids,
      evidence: members.flatMap((m) => (m.frames ?? []).map((f) => f.file)).slice(0, 6),
      repro_ko: lead?.review?.repro_ko ?? null,
      fix_hint_ko: lead?.review?.fix_hint_ko ?? null,
      rule: "QA fix = (a) game-data change + (b) engine/editor/assistant improvement, each agreed by ultrabrain before applying",
    };
  });
}

async function main() {
  const { values } = parseArgs({
    options: {
      candidates: { type: "string" },
      out: { type: "string" },
      pool: { type: "string", default: "6" },
      model: { type: "string", default: process.env.QA_REVIEW_MODEL ?? "claude-opus-5-5" },
      "base-url": { type: "string", default: process.env.ANTHROPIC_BASE_URL ?? "" },
      /** Override the reviewer order for this run (default Opus → Astra → Argon). */
      chain: { type: "string", default: "" },
    },
  });
  if (!values.candidates || !values.out) throw new Error("usage: review.mjs --candidates <file> --out <dir>");
  fs.mkdirSync(values.out, { recursive: true });
  const log = usageLedger(path.join(values.out, "usage.jsonl"));
  const members = values.chain ? values.chain.split(",").map((id) => defaultReviewerChain().find((m) => m.id === id.trim())).filter(Boolean) : defaultReviewerChain();
  const client = reviewerChain(members, { log, stage: "review" });
  console.log(JSON.stringify({ stage: "review", reviewerChain: client.chain.join(" -> ") }));
  const candidates = JSON.parse(fs.readFileSync(values.candidates, "utf8"));
  const reviewFile = path.join(values.out, "review.jsonl");
  const done = new Map(fs.existsSync(reviewFile) ? fs.readFileSync(reviewFile, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.verdict).map((r) => [r.id, r]) : []);
  const todo = candidates.filter((c) => !done.has(c.id));
  const t0 = Date.now();
  console.log(JSON.stringify({ stage: "review", candidates: candidates.length, cached: done.size, todo: todo.length, model: values.model }));
  await reviewCandidates(todo, { client, poolSize: Number(values.pool), onRow: (row) => { fs.appendFileSync(reviewFile, JSON.stringify(row) + "\n"); if (row.verdict) done.set(row.id, row); } });
  const reviewed = candidates.map((c) => ({ ...c, review: done.get(c.id) ?? { verdict: null, error: "no verdict" } }));
  const kept = reviewed.filter((c) => c.review.verdict === "real");
  const merged = await mergeReport(kept, { client });
  const byId = new Map(reviewed.map((c) => [c.id, c]));
  const verdictCounts = Object.fromEntries([...VERDICTS, "null"].map((v) => [v, reviewed.filter((c) => String(c.review.verdict) === v).length]));
  const final = { model: values.model, reviewerChain: client.chain, reviewerAnsweredBy: client.answeredBy(), reviewedAt: new Date().toISOString(), ms: Date.now() - t0, candidates: candidates.length, verdictCounts, groups: merged.groups, mergeError: merged.mergeError ?? null };
  fs.writeFileSync(path.join(values.out, "final.json"), JSON.stringify(final, null, 1));
  fs.writeFileSync(path.join(values.out, "reviewed.json"), JSON.stringify(reviewed, null, 1));
  fs.writeFileSync(path.join(values.out, "fix-queue.json"), JSON.stringify(buildFixQueue(final, byId), null, 1));
  console.log(JSON.stringify({ stage: "review", done: true, verdictCounts, groups: merged.groups.length, ms: final.ms }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => { console.error(error); process.exit(1); });
}
