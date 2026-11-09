#!/usr/bin/env node
/**
 * 쌍둥이 게임 척도 CLI (scripts/fs-scale/lookSimilarity.mjs 의 입구). 모델 호출 0, 네트워크 0.
 *
 *   node scripts/fs-scale/looks.mjs build --out corpus.json --entry <id>:<made_at>:<prompt_sha>:<title.png>[:<start.png>] ... [--default-title a.png] [--default-start b.png]
 *   node scripts/fs-scale/looks.mjs judge --corpus corpus.json [--zero 0.9] [--penalty 0.7]   → 게임별 0점·감점 줄(JSON)
 *   node scripts/fs-scale/looks.mjs table --corpus corpus.json                                → 임계 0.70/0.80/0.90 별 0점 수
 *
 * 코퍼스는 화면 특징만 담는다(그림은 담지 않는다). 판정 이름(measure)과 코퍼스 sha256 을 결과에 찍어 재현할 수 있게 한다.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";
import { MEASURE_ID, THRESHOLDS, features, judgeGame } from "./lookSimilarity.mjs";

function shotOf(path) {
  const png = PNG.sync.read(readFileSync(path));
  return features(png.data, png.width, png.height);
}

export function buildCorpus(entries, defaults = {}) {
  return {
    measure: MEASURE_ID,
    games: entries.map((entry) => ({
      id: entry.id, made_at: entry.made_at, prompt_sha: entry.prompt_sha ?? "",
      shots: { title: shotOf(entry.title), ...(entry.start ? { start: shotOf(entry.start) } : {}) },
    })),
    defaults: Object.fromEntries(Object.entries(defaults).map(([role, path]) => [role, shotOf(path)])),
  };
}

export function judgeCorpus(corpus, options = {}) {
  const measure = corpus.measure;
  const th = options.thresholds ?? THRESHOLDS[measure];
  if (!th) throw new Error(`기준값이 없는 판정: ${measure}`);
  const saved = THRESHOLDS[measure];
  THRESHOLDS[measure] = th;
  try {
    return corpus.games.map((game) => ({ id: game.id, ...judgeGame(game, corpus.games, corpus.defaults, measure) }));
  } finally { THRESHOLDS[measure] = saved; }
}

function parse(argv) {
  const args = { cmd: argv[0], entries: [], out: undefined, corpus: undefined, defaults: {}, zero: undefined, penalty: undefined };
  for (let i = 1; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--out") args.out = argv[(i += 1)];
    else if (a === "--corpus") args.corpus = argv[(i += 1)];
    else if (a === "--default-title") args.defaults.title = argv[(i += 1)];
    else if (a === "--default-start") args.defaults.start = argv[(i += 1)];
    else if (a === "--zero") args.zero = Number(argv[(i += 1)]);
    else if (a === "--penalty") args.penalty = Number(argv[(i += 1)]);
    else if (a === "--entry") {
      const [id, made_at, prompt_sha, title, start] = argv[(i += 1)].split(":");
      args.entries.push({ id, made_at, prompt_sha, title, start });
    }
  }
  return args;
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file://").href) {
  const args = parse(process.argv.slice(2));
  if (args.cmd === "build") {
    const corpus = buildCorpus(args.entries, args.defaults);
    writeFileSync(args.out, JSON.stringify(corpus));
    console.log(`corpus ${args.out}: ${corpus.games.length} games, measure ${corpus.measure}`);
  } else if (args.cmd === "judge" || args.cmd === "table") {
    const raw = readFileSync(args.corpus, "utf8");
    const corpus = JSON.parse(raw);
    const corpusSha = createHash("sha256").update(raw).digest("hex").slice(0, 16);
    const base = THRESHOLDS[corpus.measure];
    if (args.cmd === "judge") {
      const thresholds = { ...base, ...(args.zero !== undefined ? { zero: args.zero } : {}), ...(args.penalty !== undefined ? { penalty: args.penalty } : {}) };
      console.log(JSON.stringify({ measure: corpus.measure, corpus_sha: corpusSha, thresholds, results: judgeCorpus(corpus, { thresholds }) }, null, 2));
    } else {
      for (const zero of [0.7, 0.8, 0.9]) {
        const rows = judgeCorpus(corpus, { thresholds: { ...base, zero } });
        console.log(`zero>=${zero}: ${rows.filter((r) => r.zero).length}/${rows.length} games zero (measure ${corpus.measure}, corpus ${corpusSha})`);
      }
    }
  } else {
    console.error("usage: looks.mjs build|judge|table  (see file header)");
    process.exit(2);
  }
}
