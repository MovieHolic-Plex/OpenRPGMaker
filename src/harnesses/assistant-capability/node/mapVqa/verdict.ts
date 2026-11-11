// map-vqa 의 판정 자료형과 모델 없는 부품: 검수자 지시문 읽기 · 검수자 답 읽기 · 집계(tally) · 보정 기록 읽기.
// 그림·말뭉치·검수자 호출은 review.ts 가 한다 — 이 파일은 무거운 것을 불러오지 않는다(CI 테스트가 이것만 읽는다).
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractJson, VISUAL_JUDGE } from '../visualJudge';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
export const MAP_VQA_DATA = resolve(REPO_ROOT, 'harness-data/assistant-capability/map-vqa');
export type Severity = 'blocker' | 'major' | 'polish';
export const SEVERITIES: Severity[] = ['blocker', 'major', 'polish'];
export type Defect = { class: string; severity: Severity; region: { x: number; y: number; w: number; h: number }; evidence: string };
export type MapReview = {
  id: string; group: string; label: string; context: string;
  map: { name: string; width: number; height: number; tilesetId: string; standalone: boolean; walkableShare: number; exits: number; people: number; invisible: number };
  /** 깨끗한 1배 그림의 화소 해시 — 판정이 묶이는 그림. */
  pictureSha256: string;
  promptVersion: string; judge: typeof VISUAL_JUDGE;
  status: 'reviewed' | 'unreviewed';
  /** unreviewed 의 까닭(검수자 실패·--no-review). */
  error?: string;
  purpose: string; checked: Record<string, string>; defects: Defect[]; judgeKey?: string;
};
export type Reviewer = { version: string; system: string; classes: Record<string, string> };

export function loadReviewer(): Reviewer {
  const seed = JSON.parse(readFileSync(resolve(MAP_VQA_DATA, 'reviewer.json'), 'utf8'));
  return { version: seed.version, system: (seed.system as string[]).join('\n'), classes: seed.classes };
}

/** 검수자 답 → 결함 목록. 종류·심각도·영역이 형식에 안 맞으면 null(그 호출을 다시 한다). */
export function parseReview(reply: string, reviewer: Reviewer, size: { width: number; height: number }): { purpose: string; checked: Record<string, string>; defects: Defect[] } | null {
  const data = extractJson(reply) as any;
  if (!data || typeof data !== 'object' || !Array.isArray(data.defects)) return null;
  const defects: Defect[] = [];
  for (const raw of data.defects) {
    const region = raw?.region ?? {};
    if (!raw || !SEVERITIES.includes(raw.severity) || !Object.hasOwn(reviewer.classes, raw.class) || ![region.x, region.y, region.w, region.h].every(Number.isFinite) || typeof raw.evidence !== 'string' || !/[가-힣]/u.test(raw.evidence)) return null; // 근거는 한국어 한 줄이어야 한다
    const x = Math.max(0, Math.min(size.width - 1, Math.round(region.x))), y = Math.max(0, Math.min(size.height - 1, Math.round(region.y)));
    defects.push({ class: raw.class, severity: raw.severity, region: { x, y, w: Math.max(1, Math.min(size.width - x, Math.round(region.w))), h: Math.max(1, Math.min(size.height - y, Math.round(region.h))) }, evidence: raw.evidence.replace(/\s+/gu, ' ').trim().slice(0, 400) });
  }
  const order = (severity: Severity) => SEVERITIES.indexOf(severity);
  return { purpose: String(data.purpose ?? '').slice(0, 300), checked: Object.fromEntries(Object.entries(data.checked ?? {}).map(([key, value]) => [key, String(value).slice(0, 400)])), defects: defects.sort((a, b) => order(a.severity) - order(b.severity)) };
}

export type Tally = ReturnType<typeof buildTally>;
/** 종류 × 심각도 × 수 + 맵마다 목록. 같은 말뭉치를 고친 뒤 다시 돌려 이 파일끼리 비교한다. */
export function buildTally(reviews: MapReview[], meta: Record<string, unknown>, reviewer: Reviewer) {
  const done = reviews.filter(review => review.status === 'reviewed');
  const classCounts = (list: MapReview[]) => {
    const table = Object.fromEntries(Object.keys(reviewer.classes).map(id => [id, { blocker: 0, major: 0, polish: 0, maps: 0 }]));
    for (const review of list) {
      const seen = new Set<string>();
      for (const defect of review.defects) { table[defect.class]![defect.severity] += 1; seen.add(defect.class); }
      for (const id of seen) table[id]!.maps += 1;
    }
    return table;
  };
  const byClass = classCounts(done);
  const has = (review: MapReview, severity: Severity) => review.defects.some(defect => defect.severity === severity);
  const count = (list: MapReview[]) => ({ maps: list.length, reviewed: list.filter(review => review.status === 'reviewed').length, withBlocker: list.filter(review => has(review, 'blocker')).length,
    withMajorOrWorse: list.filter(review => has(review, 'blocker') || has(review, 'major')).length, clean: list.filter(review => review.status === 'reviewed' && !has(review, 'blocker') && !has(review, 'major')).length,
    blocker: list.reduce((n, review) => n + review.defects.filter(defect => defect.severity === 'blocker').length, 0), major: list.reduce((n, review) => n + review.defects.filter(defect => defect.severity === 'major').length, 0), polish: list.reduce((n, review) => n + review.defects.filter(defect => defect.severity === 'polish').length, 0) });
  const groups = [...new Set(reviews.map(review => review.group))];
  // 말뭉치(A 게임 통판 · B 맵 깔기 · …)별 합계와 종류 표 — 고친 뒤 한쪽 말뭉치만 다시 돌려도 비교할 수 있게.
  const corpora = [...new Set(reviews.map(review => review.group.split(':')[0]!))];
  // 순위 점수 = 막힘 × 3 + 큰 결함(다듬기는 세지 않는다). 같으면 걸린 맵이 많은 순.
  const ranked = Object.entries(byClass).filter(([, n]) => n.blocker + n.major + n.polish > 0).map(([id, n]) => ({ class: id, label: reviewer.classes[id], score: n.blocker * 3 + n.major, ...n }))
    .sort((a, b) => b.score - a.score || b.maps - a.maps || b.polish - a.polish);
  return { schemaVersion: 1, kind: 'assistant-map-vqa-tally', ...meta, promptVersion: reviewer.version, judge: VISUAL_JUDGE, totals: count(reviews), unreviewed: reviews.filter(review => review.status !== 'reviewed').map(review => ({ id: review.id, error: review.error ?? '' })),
    ranked, byClass, perCorpus: Object.fromEntries(corpora.map(corpus => { const list = reviews.filter(review => review.group.split(':')[0] === corpus); return [corpus, { ...count(list), byClass: classCounts(list.filter(review => review.status === 'reviewed')) }]; })), perGroup: Object.fromEntries(groups.map(group => [group, count(reviews.filter(review => review.group === group))])),
    maps: reviews.map(review => ({ id: review.id, group: review.group, label: review.label, name: review.map.name, size: `${review.map.width}x${review.map.height}`, tilesetId: review.map.tilesetId, status: review.status, pictureSha256: review.pictureSha256,
      blocker: review.defects.filter(defect => defect.severity === 'blocker').length, major: review.defects.filter(defect => defect.severity === 'major').length, polish: review.defects.filter(defect => defect.severity === 'polish').length, defects: review.defects })) };
}

/** 보정 기록(harness-data/…/map-vqa/calibration/<판>.json)에서 이 지시문 판의 놓침·헛경보 비율. 없으면 null — 숫자에 «보정 전»이라고 붙인다. */
export function calibrationOf(version: string): any | null {
  const file = resolve(MAP_VQA_DATA, 'calibration', `${version}.json`);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}
