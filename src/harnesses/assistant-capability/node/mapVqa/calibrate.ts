// map-vqa 검수자 보정. 숫자를 인용하기 전에: ① 좋은 맵(사람이 만든 장소 견본)에 일부러 심은 결함을 검수자가 그 자리에서 잡는가
// ② 실제로 확인된 조수 결함(얼려 둔 맵)을 잡는가 ③ 좋은 맵 원본에 «막힘»을 잘못 붙이지 않는가. 기준을 낮춰 통과시키지 않는다 —
// 놓치면 지시문을 더 날카롭게 고치고 판을 올려 다시 잰다. 기록은 harness-data/assistant-capability/map-vqa/calibration/<판>.json.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { createBlankProject } from '../../../../project/defaults';
import type { Project } from '../../../../project/types';
import { mapLimit, newUsage, usageLine } from '../visualJudge';
import { loadCorpusEntry, type MapItem } from './corpus';
import { caught, plant, RECIPE_CLASSES, type Recipe, type Rect } from './decoys';
import { mapFacts } from './facts';
import { reviewMap } from './review';
import { carriedNote, loadReviewer, MAP_VQA_DATA } from './verdict';

const REPO_ROOT = resolve(MAP_VQA_DATA, '../../..');
type Seed = {
  /** 좋은 맵: public/assets/region-references/<이름>.oprn.json. map 을 주면 그 글자가 든 맵만. */
  good: Array<{ base: string; map?: string }>;
  decoys: Array<{ base: string; map?: string; recipe: Recipe }>;
  /** 실제로 확인된 조수 결함(얼려 둔 맵 한 장). expect 마다 그 종류 가운데 하나로, 그 자리와 겹치게 잡아야 한다. */
  positives: Array<{ id: string; file: string; note: string; expect: Array<{ classes: string[]; region: Rect; what: string }> }>;
};

function baseItems(base: string, mapPart?: string): MapItem[] {
  const items = loadCorpusEntry(resolve(REPO_ROOT, 'public/assets/region-references', `${base}.oprn.json`));
  const picked = mapPart ? items.filter(item => String((item.project as any).maps[item.mapId].name).includes(mapPart)) : items;
  if (!picked.length) throw Error(`보정 견본 ${base}${mapPart ? ` · ${mapPart}` : ''}: 맵이 없다`);
  return picked;
}
/** 얼려 둔 조수 맵(맵 한 장 + 이동이 가리키는 맵 이름). */
function positiveItem(positive: Seed['positives'][number]): MapItem {
  const frozen = JSON.parse(gunzipSync(readFileSync(resolve(MAP_VQA_DATA, positive.file))).toString('utf8'));
  const project = createBlankProject() as any;
  project.maps = { [frozen.map.id]: frozen.map, ...Object.fromEntries(Object.entries<string>(frozen.mapNames ?? {}).filter(([id]) => id !== frozen.map.id).map(([id, name]) => [id, { id, name, width: 1, height: 1, tilesetId: frozen.map.tilesetId, tileSize: 16, lowerTiles: [-1], upperTiles: [-1], events: [{ id: `back_${id}`, x: 0, y: 0, pages: [{ id: 'p', conditions: [], graphic: { transparent: true }, trigger: { kind: 'playerTouch' }, commands: [{ kind: 'transfer', mapId: frozen.map.id, x: 0, y: 0 }] }] }] }])) };
  project.startMapId = '';
  return { id: `positive--${positive.id}`, group: 'positive', label: `확인된 결함 · ${frozen.map.name}`, project: project as Project, mapId: frozen.map.id, standalone: false, context: frozen.context ?? 'Part of a game the assistant built.' };
}

/** 확인된 조수 결함이 있는 맵 한 장을 저장소에 얼린다(보정이 저장소 밖 실행 폴더에 기대지 않게). 타일셋은 번들에서 다시 얻는다. */
export function freezePositive(options: { run?: string; map?: string; id?: string }): number {
  if (!options.run || !options.map || !options.id) throw Error('map-vqa-freeze --run <게임 통판 실행 폴더> --map <맵 이름 일부> --id <얼릴 이름>');
  const item = loadCorpusEntry(resolve(options.run)).find(candidate => String((candidate.project as any).maps[candidate.mapId].name).includes(options.map!));
  if (!item) throw Error(`${options.run}: 「${options.map}」 맵이 없다`);
  const project = item.project as any, file = resolve(MAP_VQA_DATA, 'positives', `${options.id}.json.gz`);
  mkdirSync(resolve(MAP_VQA_DATA, 'positives'), { recursive: true });
  writeFileSync(file, gzipSync(JSON.stringify({ source: options.run.split('/').at(-1), context: item.context, map: project.maps[item.mapId], mapNames: Object.fromEntries(Object.values<any>(project.maps).map(map => [map.id, map.name])) }), { level: 9 }));
  console.log(`${file} — ${project.maps[item.mapId].name} ${project.maps[item.mapId].width}×${project.maps[item.mapId].height}`);
  return 0;
}

export type CalibrateOptions = { out?: string; only?: string; noReview?: boolean; concurrency?: string };
export async function runMapVqaCalibration(options: CalibrateOptions): Promise<number> {
  if (!options.out) throw Error('map-vqa-calibrate --out <결과 폴더> [--only good|decoy|positive|글자] [--no-review]');
  const seed = JSON.parse(readFileSync(resolve(MAP_VQA_DATA, 'calibration.json'), 'utf8')) as Seed;
  const reviewer = loadReviewer(), usage = newUsage();
  mkdirSync(options.out, { recursive: true });
  type Job = { item: MapItem; kind: 'good' | 'decoy' | 'positive'; recipe?: Recipe; region?: Rect; note?: string; expect?: Seed['positives'][number]['expect'] };
  const jobs: Job[] = [];
  for (const good of seed.good) for (const item of baseItems(good.base, good.map)) jobs.push({ item: { ...item, id: `good--${item.id}`, group: 'good' }, kind: 'good' });
  const skipped: string[] = [];
  for (const decoy of seed.decoys) for (const item of baseItems(decoy.base, decoy.map)) {
    const planted = plant(decoy.recipe, item.project, item.mapId, mapFacts(item.project, item.mapId, item.standalone));
    if (!planted) { skipped.push(`${decoy.base} · ${decoy.recipe}: 이 맵에는 그 조리법을 쓸 수 없다`); continue; }
    jobs.push({ item: { ...item, id: `decoy--${decoy.recipe}--${item.id}`, group: 'decoy', label: `심은 결함 ${decoy.recipe} · ${item.label}`, project: planted.project, standalone: decoy.recipe === 'exit-on-bare-edge' ? false : item.standalone }, kind: 'decoy', recipe: decoy.recipe, region: planted.region, note: planted.note });
  }
  for (const positive of seed.positives) jobs.push({ item: positiveItem(positive), kind: 'positive', expect: positive.expect, note: positive.note });
  if (skipped.length) throw Error(`보정 씨앗이 맞지 않다:\n${skipped.join('\n')}`);
  const needles = (options.only ?? '').split(',').map(part => part.trim()).filter(Boolean);
  const picked = needles.length ? jobs.filter(job => needles.some(needle => job.kind === needle || job.item.id.includes(needle))) : jobs;
  console.log(`map-vqa-calibrate: 좋은 맵 ${picked.filter(job => job.kind === 'good').length}장 · 심은 결함 ${picked.filter(job => job.kind === 'decoy').length}개 · 확인된 결함 ${picked.filter(job => job.kind === 'positive').length}장 · 지시문 ${reviewer.version}${options.noReview ? ' · 검수 안 함(그림만)' : ''} → ${options.out}`);
  const rows = await mapLimit(picked, Math.max(1, Math.min(6, Number(options.concurrency ?? 4) || 4)), async job => {
    const { review } = await reviewMap(job.item, { out: options.out!, reviewer, usage, noReview: options.noReview });
    const brief = review.defects.map(defect => ({ class: defect.class, severity: defect.severity, region: defect.region, evidence: defect.evidence.slice(0, 160) }));
    if (job.kind === 'good') {
      const blockers = review.defects.filter(defect => defect.severity === 'blocker');
      console.log(`${review.status !== 'reviewed' ? '미검증' : blockers.length ? '헛경보' : 'ok    '} 좋은 맵 ${job.item.label} — 막힘 ${blockers.length} · 큰 결함 ${review.defects.filter(defect => defect.severity === 'major').length}${blockers[0] ? ` :: ${blockers[0].class} ${blockers[0].evidence.slice(0, 100)}` : ''}`);
      return { id: job.item.id, kind: job.kind, label: job.item.label, status: review.status, pictureSha256: review.pictureSha256, blockers: blockers.length, majors: review.defects.filter(defect => defect.severity === 'major').length, defects: brief };
    }
    if (job.kind === 'decoy') {
      const hit = caught(review, RECIPE_CLASSES[job.recipe!], job.region!);
      console.log(`${review.status !== 'reviewed' ? '미검증' : hit.strict ? '잡음  ' : hit.loose ? '종류만 다름' : '놓침  '} ${job.item.label} — ${job.note}${hit.by ? ` :: ${hit.by.severity} ${hit.by.class} ${hit.by.evidence.slice(0, 90)}` : ''}`);
      return { id: job.item.id, kind: job.kind, label: job.item.label, recipe: job.recipe, planted: job.region, note: job.note, status: review.status, pictureSha256: review.pictureSha256, strict: hit.strict, loose: hit.loose, by: hit.by, defects: brief };
    }
    const found = job.expect!.map(expect => ({ what: expect.what, ...caught(review, expect.classes, expect.region) }));
    console.log(`${review.status !== 'reviewed' ? '미검증' : found.every(one => one.strict) ? '잡음  ' : '놓침  '} ${job.item.label} — ${found.map(one => `${one.what}: ${one.strict ? '잡음' : one.loose ? '종류만 다름' : '놓침'}`).join(' · ')}`);
    return { id: job.item.id, kind: job.kind, label: job.item.label, note: job.note, status: review.status, pictureSha256: review.pictureSha256, expect: found, strict: found.every(one => one.strict), loose: found.every(one => one.loose), defects: brief };
  });
  const reviewed = rows.filter(row => row.status === 'reviewed');
  const planted = reviewed.filter(row => row.kind !== 'good'), good = reviewed.filter(row => row.kind === 'good');
  const missed = planted.filter(row => !(row as any).strict), looseMissed = planted.filter(row => !(row as any).loose), falseAlarms = good.filter(row => (row as any).blockers > 0);
  const rate = (part: number, whole: number) => whole ? Math.round(part / whole * 1000) / 1000 : 0;
  const full = !needles.length && !options.noReview && reviewed.length === rows.length;
  const record = { schemaVersion: 1, kind: 'assistant-map-vqa-calibration', version: reviewer.version, at: new Date().toISOString(),
    // 보정됨 = 심은 결함·확인된 결함을 하나도 놓치지 않았고, 좋은 맵에 «막힘»을 붙이지 않았다.
    status: !full ? 'partial' : missed.length === 0 && falseAlarms.length === 0 ? 'calibrated' : 'not-calibrated',
    missRate: rate(missed.length, planted.length), looseMissRate: rate(looseMissed.length, planted.length), falseAlarmRate: rate(falseAlarms.length, good.length),
    planted: { total: planted.length, missed: missed.length, missedLoose: looseMissed.length, byRecipe: Object.fromEntries([...new Set(planted.map(row => (row as any).recipe ?? 'positive'))].map(recipe => { const list = planted.filter(row => ((row as any).recipe ?? 'positive') === recipe); return [recipe, { total: list.length, caught: list.filter(row => (row as any).strict).length }]; })) },
    good: { total: good.length, withBlocker: falseAlarms.length, withMajor: good.filter(row => (row as any).majors > 0).length, majorsPerMap: rate(good.reduce((n, row) => n + (row as any).majors, 0), good.length) },
    unreviewed: rows.filter(row => row.status !== 'reviewed').map(row => row.id),
    // 이어 쓴 답 = 지시문·글·그림이 화소까지 같은 물음에 앞 판이 낸 답(reviewer.json sameQuestionAs). 새로 물은 것은 judgeUsage.calls.
    carried: { from: reviewer.sameQuestionAs, answers: usage.carried },
    judgeUsage: { calls: usage.calls, cached: usage.cached, failures: usage.failures, inputTokens: usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens, outputTokens: usage.outputTokens }, rows };
  writeFileSync(resolve(options.out, 'calibration.json'), JSON.stringify(record, null, 2));
  if (full) { mkdirSync(resolve(MAP_VQA_DATA, 'calibration'), { recursive: true }); writeFileSync(resolve(MAP_VQA_DATA, 'calibration', `${reviewer.version}.json`), JSON.stringify(record, null, 2)); }
  console.log(`\nmap-vqa-calibrate(${reviewer.version}): ${record.status} — 심은·확인된 결함 ${planted.length}개 중 놓침 ${missed.length}(놓침 ${record.missRate}, 종류 무관 ${record.looseMissRate}) · 좋은 맵 ${good.length}장 중 막힘 헛경보 ${falseAlarms.length}(${record.falseAlarmRate}), 큰 결함이 붙은 좋은 맵 ${record.good.withMajor}${carriedNote(record) ? ` · ${carriedNote(record)}` : ''}`);
  console.log(`${usageLine(usage)}\n${resolve(options.out, 'calibration.json')}${full ? `\n${resolve(MAP_VQA_DATA, 'calibration', `${reviewer.version}.json`)}` : existsSync(resolve(MAP_VQA_DATA, 'calibration', `${reviewer.version}.json`)) ? '' : '\n(부분 실행 — 저장소의 보정 기록은 쓰지 않았다)'}`);
  return 0;
}
