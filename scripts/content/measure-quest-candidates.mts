// 퀘스트 후보 탐지기를 정답표와 맞춰 잰다.
//   bun scripts/content/measure-quest-candidates.mts <project.json 폴더 루트> [--split tune|report|all] [--json out.json]
// 폴더 루트 아래 <game>/project.json 을 읽고, 정답표 test/fixtures/quest-candidates/labels/<game>.json 과 맞춘다.
// 후보가 정답 퀘스트와 「맞다」 = 후보의 부탁·보고·수행 이벤트 중 하나가 정답 퀘스트의 giver/turnIn/stepEvents 에 있다.
import fs from "node:fs";
import path from "node:path";
import { loadHeadlessProject } from "../../src/headless/index.ts";
import { findQuestCandidates, QUEST_CANDIDATE_MIN_CONFIDENCE } from "../../src/project/quest/questCandidates.ts";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const FIXTURES = path.join(ROOT, "test/fixtures/quest-candidates");
const args = process.argv.slice(2);
const opt = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const base = args.find((value, index) => !value.startsWith("--") && !(index > 0 && args[index - 1]!.startsWith("--")));
if (!base) { console.error("usage: measure-quest-candidates.mts <games root> [--split tune|report|all] [--json out]"); process.exit(2); }
const split = JSON.parse(fs.readFileSync(path.join(FIXTURES, "split.json"), "utf8")) as Record<"tune" | "report", string[]>;
const which = (opt("split") ?? "all") as "tune" | "report" | "all";
const games = which === "all" ? [...split.tune, ...split.report] : split[which];

interface Ref { mapId: string; eventId: string }
interface LabelQuest { id: string; title: string; giver: Ref; turnIn: Ref[]; stepEvents: Ref[]; registeredAs?: string | null }
const k = (ref: Ref) => `${ref.mapId}/${ref.eventId}`;

const rows: unknown[] = [];
let tp = 0, fp = 0, fn = 0;
for (const game of games) {
  const label = JSON.parse(fs.readFileSync(path.join(FIXTURES, "labels", `${game}.json`), "utf8")) as { quests: LabelQuest[] };
  const file = path.join(base, game, "project.json");
  const project = loadHeadlessProject(fs.readFileSync(file, "utf8"));
  const before = (project.quests ?? []).length;
  const candidates = findQuestCandidates(project).filter((c) => c.confidence >= QUEST_CANDIDATE_MIN_CONFIDENCE);
  const matched = new Set<string>();
  const verdicts = candidates.map((candidate) => {
    const refs = new Set([candidate.giver, candidate.turnIn, ...candidate.steps].map(k));
    // 부탁자가 같은 정답 → 보고 자리가 같은 정답 → 수행 이벤트가 겹치는 정답 순. 한 이벤트가 여러 정답의 수행에 들어 있을 수 있다(본편이 곁가지 이벤트를 단계로 쓴다).
    const open = label.quests.filter((quest) => !matched.has(quest.id));
    const hit = open.find((quest) => k(quest.giver) === k(candidate.giver))
      ?? open.find((quest) => quest.turnIn.some((ref) => k(ref) === k(candidate.turnIn)))
      ?? open.find((quest) => [quest.giver, ...quest.turnIn, ...quest.stepEvents].some((ref) => refs.has(k(ref))));
    if (hit) matched.add(hit.id);
    return { id: candidate.id, title: candidate.title, confidence: candidate.confidence, giver: k(candidate.giver), turnIn: k(candidate.turnIn), steps: candidate.steps.map(k), request: candidate.request, registeredAs: candidate.registeredAs, verdict: hit ? `quest:${hit.id}` : "not-quest" };
  });
  const gTp = verdicts.filter((v) => v.verdict !== "not-quest").length;
  const gFp = verdicts.length - gTp;
  const missed = label.quests.filter((quest) => !matched.has(quest.id)).map((quest) => quest.id);
  tp += gTp; fp += gFp; fn += missed.length;
  const pending = candidates.filter((c) => c.registeredAs === null && c.registrable).length;
  rows.push({ game, questsBefore: before, questsAfterOneClick: before + pending, labelled: label.quests.length, candidates: verdicts.length, tp: gTp, fp: gFp, missed, verdicts });
  console.log(`${game.padEnd(40)} quests ${before}→${before + pending}  labelled ${label.quests.length}  cand ${verdicts.length}  tp ${gTp} fp ${gFp} miss ${missed.length}${missed.length ? ` (${missed.join(",")})` : ""}`);
}
const precision = tp + fp ? tp / (tp + fp) : 1;
const recall = tp + fn ? tp / (tp + fn) : 1;
console.log(`\n[${which}] games ${games.length}  tp ${tp} fp ${fp} fn ${fn}  precision ${(precision * 100).toFixed(1)}%  recall ${(recall * 100).toFixed(1)}%  (min confidence ${QUEST_CANDIDATE_MIN_CONFIDENCE})`);
const out = opt("json");
if (out) fs.writeFileSync(out, JSON.stringify({ split: which, tp, fp, fn, precision, recall, rows }, null, 1));
