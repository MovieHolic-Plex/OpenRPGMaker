// ai/imagePlanPick.ts
// 도안 여러 장 중 고르기(2026-11-05): 도안을 2장 동시에 뽑아 비전 판정자가 요청에 맞는 쪽을 고르고, 둘 다 기준 미달이면 1장 더(최대 3장).
// 이 파일은 순수 계산만 한다 — 읽은 배치에서 빌더 입력이 몇 개 나오는지(읽기 성공도), 판정 지시문, 판정 JSON 해석, 고르기.
import type { ImagePlanRead, ImagePlanScene } from "./imagePlan";

export const IMAGE_PLAN_MAX_CANDIDATES = 3;
export const IMAGE_PLAN_FIRST_ROUND = 2;

const MIN_YIELD: Record<string, number> = { village: 6, forest: 3, dungeon: 8, castle: 8, house: 3 };

const count = (v: unknown): number => (Array.isArray(v) ? v.length : 0);
const present = (v: unknown): number => (v && typeof v === "object" ? 1 : 0);

/** 읽은 배치에서 빌더 입력(칸 좌표·방·통로·설계)이 몇 개 나오는가. 못 읽었으면 0. */
export function readYield(read: ImagePlanRead | null): number {
  if (!read) return 0;
  const d = read.data;
  if (read.subject === "village") {
    const terrain = Array.isArray(d.terrain) && d.terrain.length >= 6 ? 1 : 0;
    return present(d.gather) + present(d.landmark) + present(d.anchor) + present(d.work) + count(d.houses) + count(d.fields) + count(d.forests) + terrain;
  }
  if (read.subject === "forest") {
    return (Number.isFinite(Number(d.entryAt)) ? 1 : 0) + (Number.isFinite(Number(d.exitAt)) ? 1 : 0) + count(d.branches) + count(d.clearings);
  }
  return count(d.rooms) + count(d.links);
}

export function yieldNorm(subject: string, read: ImagePlanRead | null): number {
  return Math.min(1, readYield(read) / (MIN_YIELD[subject] ?? 4));
}

export interface PlanCandidate {
  readonly dataUrl: string;
  readonly read: ImagePlanRead | null;
}

export interface JudgedCandidate {
  readonly elements: number;
  readonly setting: boolean;
  readonly clean: boolean;
}

export interface PlanJudge {
  readonly candidates: readonly JudgedCandidate[];
  readonly reason: string;
}

export function imagePlanJudgePrompt(scene: ImagePlanScene, count: number): string {
  const indoor = scene.subject === "house" ? "실내 평면도(집 안)" : scene.subject === "dungeon" || scene.subject === "castle" ? "방과 통로의 평면도(허공 위)" : "바깥 탑뷰 지도";
  return `RPG 맵 도안 후보 ${count}장이 차례로 붙어 있다(그림 1~${count}). 요청한 장소: "${scene.label}" — 들어가야 할 것: ${scene.traits.join(", ") || "(없음)"}.
각 후보를 따로 채점해 JSON 하나만 답하라. 형식:
{"candidates":[{"i":1,"elements":0~5,"setting":true|false,"clean":true|false}, ...],"reason":"어느 후보가 왜 나은지 한국어 한 줄"}
- elements: 요청의 요소(집 수·물·높낮이 단·출구·방 종류·랜드마크)가 그림에 다 있나. 다 있으면 5, 절반이면 3, 거의 없으면 0.
- setting: 요청에 맞는 시점인가 — ${indoor} 이어야 한다. 아니면 false(예: 집인데 바깥 풍경, 던전인데 바깥).
- clean: 그림 안에 글자·라벨·사람·잘린 가장자리가 없나. 있으면 false.`;
}

function bool(v: unknown): boolean {
  return v === true || v === "true";
}

export function parsePlanJudge(data: Record<string, unknown> | null, count: number): PlanJudge | null {
  if (!data || !Array.isArray(data.candidates)) return null;
  const out: JudgedCandidate[] = [];
  for (let i = 1; i <= count; i += 1) {
    const hit = (data.candidates as Array<Record<string, unknown>>).find((c) => Number(c?.i) === i);
    if (!hit) return null;
    const elements = Number(hit.elements);
    out.push({ elements: Number.isFinite(elements) ? Math.max(0, Math.min(5, elements)) : 0, setting: bool(hit.setting), clean: bool(hit.clean) });
  }
  return { candidates: out, reason: typeof data.reason === "string" ? data.reason.trim().slice(0, 140) : "" };
}

/** 후보 하나가 기준을 넘나: 요소 3점 이상 · 요청에 맞는 시점 · 글자/잘림 없음 · 읽기에서 빌더 입력이 기준만큼 나옴. */
export function meetsBar(subject: string, read: ImagePlanRead | null, j: JudgedCandidate): boolean {
  return j.elements >= 3 && j.setting && j.clean && yieldNorm(subject, read) >= 1;
}

/** 점수 = 요소(0~5) + 읽기 성공도(0~2). 시점이 틀리거나 글자·잘림이 있으면 크게 깎는다. 동점이면 앞 후보. */
export function pickBest(subject: string, cands: readonly PlanCandidate[], judge: PlanJudge | null): { index: number; met: boolean; scores: number[] } {
  const scores = cands.map((c, i) => {
    const j = judge?.candidates[i];
    const base = (j?.elements ?? 2.5) + 2 * yieldNorm(subject, c.read);
    return base - (j && !j.setting ? 4 : 0) - (j && !j.clean ? 1.5 : 0);
  });
  let index = 0;
  scores.forEach((s, i) => { if (s > (scores[index] ?? -Infinity)) index = i; });
  const j = judge?.candidates[index];
  return { index, met: !!j && meetsBar(subject, cands[index]?.read ?? null, j), scores };
}

export function pickLine(total: number, index: number, reason: string): string {
  return `도안 ${total}장 중 ${index + 1}번째를 골랐어요${reason ? ` — ${reason}` : ""}`;
}
