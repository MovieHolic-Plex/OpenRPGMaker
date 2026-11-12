/**
 * battle-backdrop Opus 검수 — 순수 부분(질문·답 읽기·묶음 효력·최고점 고르기). 호출·파일은 node/cli.ts.
 *
 * 2026-11-04 오너: 「이제 사람이 고르지 않아. AI 가 해야함」(폴른 스타 몬스터 스레드, 리드 전달).
 * 그래서 사람 선택 대신 Claude Opus 가 후보를 점수로 매기고, 통과한 후보 중 최고점이 설치된다.
 *   - 한 묶음 = 맵 캡처 1장 + 기계 검사를 통과한 후보들 + 숨긴 디코이(위아래 뒤집은 후보·맵 캡처 그대로·다른 장소 번들 배경).
 *     표시는 무작위 두 자리 번호뿐이고 어느 것이 디코이인지는 묻지 않는다.
 *   - 점수 1~5, 0.5 단위. 통과 = v "pass" 이면서 점수 ≥ 3.5. 점수가 낮은 pass 는 reject 로 읽는다.
 *   - 묶음은 모든 번호에 답했고 디코이를 하나 이상 넣었고 디코이를 모두 떨어뜨렸을 때만 효력이 있다.
 *   - 판정은 후보 도트 화소 해시에 묶인다. 그림이 바뀌면 그 판정은 쓰지 않는다.
 */
import type { BackdropFacts } from "@/editor/battleBackdropCore";

export const BACKDROP_PASS_SCORE = 3.5;
export const BACKDROP_REVIEW_STANDARD = "battle-backdrop-opus/1";

export type BackdropControlKind = "flipped" | "top-down" | "wrong-place";
export type ReviewEntry = {
  readonly label: string;
  readonly pixelSha256: string;
  readonly letter?: string;
  readonly control?: BackdropControlKind;
};
export type ReviewAnswer = { readonly v: "pass" | "reject"; readonly score: number; readonly why: string };
export type ReviewBatch = {
  readonly id: string;
  readonly at: string;
  readonly standard: string;
  readonly model: string;
  readonly runId: string;
  readonly rawFile: string;
  readonly rawSha256: string;
  readonly entries: readonly ReviewEntry[];
  readonly answers: Readonly<Record<string, ReviewAnswer>>;
  readonly counted: boolean;
  readonly reason: string;
  /** 이 묶음에 든 검수 비용(달러) — 호출 경로가 값을 돌려줄 때만(claude-cli). */
  readonly costUsd?: number;
};

const OPUS = /(^|[/:_.-])claude[-_ ]?opus|(^|[/:_.-])opus([-_ .]|$)/iu;
const BANNED = /argon|gemini|gpt|sonnet|haiku|fable|deepseek|qwen|llama|mistral|grok/iu;
/** 검수자는 Opus 만. 요청 전(요청 모델)과 후(응답이 밝힌 모델) 모두 본다. */
export const isOpusModel = (name: string | undefined | null): boolean => !!name && OPUS.test(name) && !BANNED.test(name);

export function backdropReviewPrompt(facts: BackdropFacts, labels: readonly string[]): string {
  const time = facts.timeCertain ? `${facts.timeOfDay}, light ${facts.light}` : `light ${facts.light} (indoor; time of day is not judged)`;
  return [
    "You are a strict art director reviewing side-view JRPG battle backgrounds (battlebacks) for a 16-bit pixel-art game.",
    `The FIRST image is a top-down game map of the exact place where the battle happens: "${facts.mapName}" (${facts.indoor ? "indoor" : "outdoor"}, expected ${time}). Place words: ${facts.placeWords.slice(0, 8).join(" / ")}.`,
    `Every following image is preceded by its label. Labels: ${labels.join(", ")}. Judge EACH labelled image on its own against the map.`,
    "A labelled image passes only if ALL hold:",
    "1. it is a SIDE / eye-level view (not a top-down map, not upside down: sky or ceiling at the top, floor or ground at the bottom);",
    "2. it shows the same kind of place as the map (same biome, materials, landmarks, indoor/outdoor) and the expected time and light;",
    "3. no people, silhouettes, animals or monsters; no letters, numbers, logos, UI, frames or watermarks;",
    "4. the lower ~45% is open, flat, calm floor or ground where battle characters can stand, with no props or strong patterns;",
    "5. it reads as crisp 16-bit pixel art with a limited palette (no smooth painting, photo texture or noise) and would not distract from sprites standing on it.",
    "Give each label a score from 1 to 5 in steps of 0.5 (5 = ready to ship, 3.5 = acceptable, 3 or lower = reject).",
    'Answer ONLY one JSON object: {"<label>": {"v": "pass"|"reject", "score": <number>, "why": "<one concrete sentence>"}, ...} with every label.',
  ].join("\n");
}

/** Opus 답 → 번호별 판정. 번호가 빠졌거나 점수가 0.5 격자 밖이면 null(한 번 더 묻는다). */
export function parseBackdropReview(text: string, labels: readonly string[]): Record<string, ReviewAnswer> | null {
  const m = /\{[\s\S]*\}/u.exec(text);
  if (!m) return null;
  let obj: Record<string, unknown>;
  try { obj = JSON.parse(m[0]) as Record<string, unknown>; } catch { return null; }
  const out: Record<string, ReviewAnswer> = {};
  for (const label of labels) {
    const a = obj[label] as { v?: unknown; score?: unknown; why?: unknown } | undefined;
    if (!a || (a.v !== "pass" && a.v !== "reject")) return null;
    const score = Number(a.score);
    if (!Number.isFinite(score) || score < 1 || score > 5 || !Number.isInteger(score * 2)) return null;
    const v = a.v === "pass" && score >= BACKDROP_PASS_SCORE ? "pass" : "reject";
    out[label] = { v, score, why: String(a.why ?? "") };
  }
  return out;
}

/** 묶음 효력: 모든 번호 답, 디코이 ≥1, 디코이 전부 reject. */
export function backdropBatchCounts(entries: readonly ReviewEntry[], answers: Readonly<Record<string, ReviewAnswer>> | null): { counted: boolean; reason: string } {
  if (!answers) return { counted: false, reason: "answer unreadable" };
  const missing = entries.filter((e) => !answers[e.label]);
  if (missing.length) return { counted: false, reason: `labels not answered: ${missing.map((e) => e.label).join(",")}` };
  const controls = entries.filter((e) => e.control);
  if (!controls.length) return { counted: false, reason: "batch has no hidden control" };
  const passed = controls.filter((e) => answers[e.label]!.v !== "reject");
  if (passed.length) return { counted: false, reason: `hidden control passed: ${passed.map((e) => `${e.label}(${e.control})`).join(",")}` };
  return { counted: true, reason: "all hidden controls rejected" };
}

export type CandidateNow = { readonly letter: string; readonly nativePixelSha256?: string; readonly machineOk: boolean };
export type ScoredCandidate = { readonly letter: string; readonly score: number; readonly why: string; readonly batch: string; readonly pixelSha256: string };

/** 효력 있는 묶음의 통과 후보(지금 화소 해시와 같고 기계 검사 통과), 점수 높은 순(같으면 글자 순). */
export function passingBackdrops(batches: readonly ReviewBatch[], candidates: readonly CandidateNow[]): ScoredCandidate[] {
  const out: ScoredCandidate[] = [];
  for (const c of candidates) {
    if (!c.machineOk || !c.nativePixelSha256) continue;
    let best: ScoredCandidate | null = null;
    for (const b of batches) {
      if (!b.counted || b.standard !== BACKDROP_REVIEW_STANDARD) continue;
      const e = b.entries.find((x) => !x.control && x.letter === c.letter && x.pixelSha256 === c.nativePixelSha256);
      const a = e ? b.answers[e.label] : undefined;
      if (!a) continue;
      if (a.v !== "pass") { best = null; break; } // 같은 화소에 효력 있는 reject 가 있으면 통과가 아니다
      if (!best || a.score > best.score) best = { letter: c.letter, score: a.score, why: a.why, batch: b.id, pixelSha256: c.nativePixelSha256 };
    }
    if (best) out.push(best);
  }
  return out.sort((x, y) => y.score - x.score || x.letter.localeCompare(y.letter));
}

/** 이미 효력 있는 묶음에서 판정받은 화소는 다시 묻지 않는다. */
export function reviewedShas(batches: readonly ReviewBatch[]): Set<string> {
  return new Set(batches.filter((b) => b.counted).flatMap((b) => b.entries.filter((e) => !e.control).map((e) => e.pixelSha256)));
}
