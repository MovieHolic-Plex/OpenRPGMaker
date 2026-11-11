// 조수가 깐 맵의 적대적 시각 검수(map-vqa). 맵마다: 깨끗한 1배 그림 + 확대 그림 + 사실 표시 그림 + 사실 글 → Opus 5.5 검수자 → 결함 목록
// (종류 · 심각도 · 칸 영역 · 근거 한 줄). 판정은 그림 화소 해시와 지시문 판에 묶인다. 검수자가 답하지 못한 맵은 «미검증»이고 집계에서 합격으로 세지 않는다.
// 결과: <out>/maps/<id>/{clean,facts,marked}.png · review.json, <out>/tally.json(종류 × 심각도 × 수, 맵마다 목록), <out>/page.html.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { askJudge, extractJson, mapLimit, newUsage, pixelSha, usageLine, VISUAL_JUDGE, type JudgeUsage } from '../visualJudge';
import { loadCorpus, type MapItem } from './corpus';
import { factsText, mapFacts, type MapFacts } from './facts';
import { cleanPicture, detailPictures, FACTS_LEGEND, factsPicture, markedPicture } from './pictures';
import { writeMapVqaPage } from './page';

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
    if (!raw || !SEVERITIES.includes(raw.severity) || !Object.hasOwn(reviewer.classes, raw.class) || ![region.x, region.y, region.w, region.h].every(Number.isFinite) || typeof raw.evidence !== 'string' || !raw.evidence.trim()) return null;
    const x = Math.max(0, Math.min(size.width - 1, Math.round(region.x))), y = Math.max(0, Math.min(size.height - 1, Math.round(region.y)));
    defects.push({ class: raw.class, severity: raw.severity, region: { x, y, w: Math.max(1, Math.min(size.width - x, Math.round(region.w))), h: Math.max(1, Math.min(size.height - y, Math.round(region.h))) }, evidence: raw.evidence.replace(/\s+/gu, ' ').trim().slice(0, 400) });
  }
  const order = (severity: Severity) => SEVERITIES.indexOf(severity);
  return { purpose: String(data.purpose ?? '').slice(0, 300), checked: Object.fromEntries(Object.entries(data.checked ?? {}).map(([key, value]) => [key, String(value).slice(0, 400)])), defects: defects.sort((a, b) => order(a.severity) - order(b.severity)) };
}

export type ReviewOptions = { out: string; reviewer: Reviewer; usage: JudgeUsage; noReview?: boolean };
/** 맵 한 장: 그림을 만들고(늘) 검수자에게 묻는다(noReview 가 아니면). 그림·판정을 <out>/maps/<id>/ 에 쓴다. */
export async function reviewMap(item: MapItem, options: ReviewOptions): Promise<{ review: MapReview; facts: MapFacts }> {
  const dir = resolve(options.out, 'maps', item.id);
  mkdirSync(dir, { recursive: true });
  const map: any = (item.project as any).maps[item.mapId];
  const facts = mapFacts(item.project, item.mapId, item.standalone);
  const pictures = cleanPicture(item.project, map, facts.tile);
  const factsPng = factsPicture(pictures, facts), details = detailPictures(pictures, map), text = factsText(facts);
  writeFileSync(resolve(dir, 'clean.png'), pictures.clean); writeFileSync(resolve(dir, 'facts.png'), factsPng); writeFileSync(resolve(dir, 'facts.txt'), text);
  const count = (kind: string) => facts.events.filter(event => event.kind === kind).length;
  const base: MapReview = { id: item.id, group: item.group, label: item.label, context: item.context,
    map: { name: facts.name, width: facts.width, height: facts.height, tilesetId: facts.tilesetId, standalone: facts.standalone, walkableShare: Math.round(facts.walkableShare * 1000) / 1000, exits: count('exit'), people: count('person'), invisible: count('invisible') },
    pictureSha256: pixelSha(pictures.clean), promptVersion: options.reviewer.version, judge: VISUAL_JUDGE, status: 'unreviewed', purpose: '', checked: {}, defects: [] };
  let review = base;
  if (options.noReview) review = { ...base, error: '검수자를 부르지 않았다(--no-review)' };
  else {
    const answer = await askJudge({ cacheDir: resolve(options.out, 'judge-cache'), promptVersion: options.reviewer.version, system: options.reviewer.system, usage: options.usage,
      text: `${item.context}\n\n${text}\n\n${FACTS_LEGEND}\n\nInspect this map and reply with the JSON object.`,
      images: [{ label: 'CLEAN picture at 1x (what the player sees)', png: pictures.clean }, ...details.map(detail => ({ label: detail.label, png: detail.png })), { label: 'FACTS picture', png: factsPng }],
      parse: reply => parseReview(reply, options.reviewer, facts) });
    review = 'answer' in answer ? { ...base, status: 'reviewed', ...answer.answer, judgeKey: answer.key } : { ...base, error: answer.error, judgeKey: answer.key };
  }
  writeFileSync(resolve(dir, 'marked.png'), markedPicture(pictures, map, review.defects.map((defect, index) => ({ index: index + 1, severity: defect.severity, region: defect.region }))));
  writeFileSync(resolve(dir, 'review.json'), JSON.stringify(review, null, 2));
  return { review, facts };
}

export type Tally = ReturnType<typeof buildTally>;
/** 종류 × 심각도 × 수 + 맵마다 목록. 같은 말뭉치를 고친 뒤 다시 돌려 이 파일끼리 비교한다. */
export function buildTally(reviews: MapReview[], meta: Record<string, unknown>, reviewer: Reviewer) {
  const done = reviews.filter(review => review.status === 'reviewed');
  const byClass = Object.fromEntries(Object.keys(reviewer.classes).map(id => [id, { blocker: 0, major: 0, polish: 0, maps: 0 }]));
  for (const review of done) {
    const seen = new Set<string>();
    for (const defect of review.defects) { byClass[defect.class]![defect.severity] += 1; seen.add(defect.class); }
    for (const id of seen) byClass[id]!.maps += 1;
  }
  const has = (review: MapReview, severity: Severity) => review.defects.some(defect => defect.severity === severity);
  const count = (list: MapReview[]) => ({ maps: list.length, reviewed: list.filter(review => review.status === 'reviewed').length, withBlocker: list.filter(review => has(review, 'blocker')).length,
    withMajorOrWorse: list.filter(review => has(review, 'blocker') || has(review, 'major')).length, clean: list.filter(review => review.status === 'reviewed' && !has(review, 'blocker') && !has(review, 'major')).length,
    blocker: list.reduce((n, review) => n + review.defects.filter(defect => defect.severity === 'blocker').length, 0), major: list.reduce((n, review) => n + review.defects.filter(defect => defect.severity === 'major').length, 0), polish: list.reduce((n, review) => n + review.defects.filter(defect => defect.severity === 'polish').length, 0) });
  const groups = [...new Set(reviews.map(review => review.group))];
  // 순위: blocker 많은 순 → major 많은 순 → 걸린 맵 수.
  const ranked = Object.entries(byClass).filter(([, n]) => n.blocker + n.major + n.polish > 0).sort(([, a], [, b]) => b.blocker - a.blocker || b.major - a.major || b.maps - a.maps || b.polish - a.polish).map(([id, n]) => ({ class: id, label: reviewer.classes[id], ...n }));
  return { schemaVersion: 1, kind: 'assistant-map-vqa-tally', ...meta, promptVersion: reviewer.version, judge: VISUAL_JUDGE, totals: count(reviews), unreviewed: reviews.filter(review => review.status !== 'reviewed').map(review => ({ id: review.id, error: review.error ?? '' })),
    ranked, byClass, perGroup: Object.fromEntries(groups.map(group => [group, count(reviews.filter(review => review.group === group))])),
    maps: reviews.map(review => ({ id: review.id, group: review.group, label: review.label, name: review.map.name, size: `${review.map.width}x${review.map.height}`, tilesetId: review.map.tilesetId, status: review.status, pictureSha256: review.pictureSha256,
      blocker: review.defects.filter(defect => defect.severity === 'blocker').length, major: review.defects.filter(defect => defect.severity === 'major').length, polish: review.defects.filter(defect => defect.severity === 'polish').length, defects: review.defects })) };
}

/** 보정 기록(harness-data/…/map-vqa/calibration/<판>.json)에서 이 지시문 판의 놓침·헛경보 비율. 없으면 null — 숫자에 «보정 전»이라고 붙인다. */
export function calibrationOf(version: string): any | null {
  const file = resolve(MAP_VQA_DATA, 'calibration', `${version}.json`);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

export type MapVqaOptions = { out?: string; corpus?: string; only?: string; noReview?: boolean; html?: string; before?: string; concurrency?: string };
export async function runMapVqa(options: MapVqaOptions): Promise<number> {
  if (!options.out || !options.corpus) throw Error('map-vqa --corpus <실행 폴더[,폴더…] | whole-games:<상위 폴더>> --out <결과 폴더> [--only 글자] [--no-review] [--html <출력.html>] [--before <앞 tally.json>]');
  const reviewer = loadReviewer(), usage = newUsage();
  let items = loadCorpus(options.corpus);
  if (options.only) { const needles = options.only.split(',').map(part => part.trim()).filter(Boolean); items = items.filter(item => needles.some(needle => item.id.includes(needle) || item.group.includes(needle))); }
  mkdirSync(options.out, { recursive: true });
  console.log(`map-vqa: 맵 ${items.length}장 · 지시문 ${reviewer.version} · 검수자 ${VISUAL_JUDGE.model} ${VISUAL_JUDGE.effort}${options.noReview ? ' · 검수 안 함(그림만)' : ''} → ${options.out}`);
  const results = await mapLimit(items, Math.max(1, Math.min(6, Number(options.concurrency ?? 4) || 4)), async item => {
    try {
      const { review } = await reviewMap(item, { out: options.out!, reviewer, usage, noReview: options.noReview });
      console.log(`${review.status === 'reviewed' ? `B${review.defects.filter(d => d.severity === 'blocker').length} M${review.defects.filter(d => d.severity === 'major').length} P${review.defects.filter(d => d.severity === 'polish').length}` : '미검증  '} ${item.label}${review.error ? ` — ${review.error.slice(0, 120)}` : ''}`);
      return review;
    } catch (error) {
      console.log(`오류     ${item.label} — ${error instanceof Error ? error.message : String(error)}`);
      return { id: item.id, group: item.group, label: item.label, context: item.context, map: { name: item.label, width: 0, height: 0, tilesetId: '', standalone: item.standalone, walkableShare: 0, exits: 0, people: 0, invisible: 0 }, pictureSha256: '', promptVersion: reviewer.version, judge: VISUAL_JUDGE, status: 'unreviewed', error: `그림을 만들지 못했다: ${error instanceof Error ? error.message : String(error)}`.slice(0, 300), purpose: '', checked: {}, defects: [] } as MapReview;
    }
  });
  const calibration = calibrationOf(reviewer.version);
  const tally = buildTally(results, { corpus: options.corpus, generatedAt: new Date().toISOString(), calibration: calibration ? { status: calibration.status, missRate: calibration.missRate, falseAlarmRate: calibration.falseAlarmRate, planted: calibration.planted, good: calibration.good } : { status: 'uncalibrated' },
    judgeUsage: { calls: usage.calls, cached: usage.cached, failures: usage.failures, inputTokens: usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens, outputTokens: usage.outputTokens } }, reviewer);
  writeFileSync(resolve(options.out, 'tally.json'), JSON.stringify(tally, null, 2));
  const before = options.before ? JSON.parse(readFileSync(resolve(options.before), 'utf8')) : null;
  const html = writeMapVqaPage({ out: options.out, tally, reviewer, before, html: options.html });
  const t = tally.totals;
  console.log(`\nmap-vqa: 맵 ${t.maps}장(검수 ${t.reviewed}) · blocker 가 있는 맵 ${t.withBlocker} · major 이상이 있는 맵 ${t.withMajorOrWorse} · 깨끗한 맵 ${t.clean} · 결함 blocker ${t.blocker} / major ${t.major} / polish ${t.polish}`);
  console.log(`${usageLine(usage)}\n보정: ${calibration ? `${calibration.status} — 놓침 ${calibration.missRate} · 헛경보 ${calibration.falseAlarmRate}` : '보정 전(uncalibrated) — 이 숫자는 보정되지 않은 검수자의 것이다'}\n${resolve(options.out, 'tally.json')}\n${html}`);
  return 0;
}
