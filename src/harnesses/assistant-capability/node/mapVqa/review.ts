// 조수가 깐 맵의 적대적 시각 검수(map-vqa). 맵마다: 깨끗한 1배 그림 + 확대 그림 + 사실 표시 그림 + 사실 글 → Opus 5.5 검수자 → 결함 목록
// (종류 · 심각도 · 칸 영역 · 근거 한 줄). 판정은 그림 화소 해시와 지시문 판에 묶인다. 검수자가 답하지 못한 맵은 «미검증»이고 집계에서 합격으로 세지 않는다.
// 결과: <out>/maps/<id>/{clean,facts,marked}.png · review.json, <out>/tally.json(종류 × 심각도 × 수, 맵마다 목록), <out>/page.html.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { askJudge, mapLimit, newUsage, pixelSha, usageLine, VISUAL_JUDGE, type JudgeUsage } from '../visualJudge';
import { askArtGaps, battleFacts, buildArtGaps, clusterThings, toolReportsOfSession, ART_GAPS_VERSION, type GapEntry } from './artGaps';
import { corpusSessions, layJobsOf, loadCorpus, type MapItem } from './corpus';
import { factsText, mapFacts, type MapFacts } from './facts';
import { cleanPicture, detailPictures, FACTS_LEGEND, factsPicture, markedPicture } from './pictures';
import { writeMapVqaPage } from './page';
import { buildTally, calibrationOf, loadReviewer, parseReview, type MapReview, type Reviewer } from './verdict';

export type ReviewOptions = { out: string; reviewer: Reviewer; usage: JudgeUsage; noReview?: boolean; /** 없는 그림 장부용 둘째 물음도 한다. */ art?: boolean };
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
  if (options.art && !options.noReview) {
    review = { ...review, art: await askArtGaps({ cacheDir: resolve(options.out, 'judge-cache'), usage: options.usage, context: item.context, factsText: text, battle: battleFacts(item.project, item.mapId), size: facts,
      images: [{ label: 'CLEAN picture at 1x (what the player sees)', png: pictures.clean }, ...details.map(detail => ({ label: detail.label, png: detail.png }))] }) };
  }
  writeFileSync(resolve(dir, 'marked.png'), markedPicture(pictures, map, review.defects.map((defect, index) => ({ index: index + 1, severity: defect.severity, region: defect.region }))));
  writeFileSync(resolve(dir, 'review.json'), JSON.stringify(review, null, 2));
  return { review, facts };
}

export type MapVqaOptions = { out?: string; corpus?: string; only?: string; noReview?: boolean; /** 없는 그림 장부를 만들지 않는다(둘째 물음 생략). */ noArt?: boolean; html?: string; before?: string; concurrency?: string };
export async function runMapVqa(options: MapVqaOptions): Promise<number> {
  if (!options.out || !options.corpus) throw Error('map-vqa --corpus <실행 폴더[,폴더…] | whole-games:<상위 폴더>> --out <결과 폴더> [--only 글자] [--no-review] [--html <출력.html>] [--before <앞 tally.json>]');
  const reviewer = loadReviewer(), usage = newUsage();
  let items = loadCorpus(options.corpus);
  if (options.only) { const needles = options.only.split(',').map(part => part.trim()).filter(Boolean); items = items.filter(item => needles.some(needle => item.id.includes(needle) || item.group.includes(needle))); }
  mkdirSync(options.out, { recursive: true });
  console.log(`map-vqa: 맵 ${items.length}장 · 지시문 ${reviewer.version} · 검수자 ${VISUAL_JUDGE.model} ${VISUAL_JUDGE.effort}${options.noReview ? ' · 검수 안 함(그림만)' : ''} → ${options.out}`);
  const results = await mapLimit(items, Math.max(1, Math.min(6, Number(options.concurrency ?? 4) || 4)), async item => {
    try {
      const { review } = await reviewMap(item, { out: options.out!, reviewer, usage, noReview: options.noReview, art: !options.noArt });
      console.log(`${review.status === 'reviewed' ? `B${review.defects.filter(d => d.severity === 'blocker').length} M${review.defects.filter(d => d.severity === 'major').length} P${review.defects.filter(d => d.severity === 'polish').length}` : '미검증  '} ${item.label}${review.error ? ` — ${review.error.slice(0, 120)}` : ''}`);
      return review;
    } catch (error) {
      console.log(`오류     ${item.label} — ${error instanceof Error ? error.message : String(error)}`);
      return { id: item.id, group: item.group, label: item.label, context: item.context, map: { name: item.label, width: 0, height: 0, tilesetId: '', standalone: item.standalone, walkableShare: 0, exits: 0, people: 0, invisible: 0 }, pictureSha256: '', promptVersion: reviewer.version, judge: VISUAL_JUDGE, status: 'unreviewed', error: `그림을 만들지 못했다: ${error instanceof Error ? error.message : String(error)}`.slice(0, 300), purpose: '', checked: {}, defects: [] } as MapReview;
    }
  });
  const calibration = calibrationOf(reviewer.version);
  const tally = buildTally(results, { corpus: options.corpus, generatedAt: new Date().toISOString(), layJobs: layJobsOf(options.corpus), calibration: calibration ? { status: calibration.status, missRate: calibration.missRate, falseAlarmRate: calibration.falseAlarmRate, planted: calibration.planted, good: calibration.good } : { status: 'uncalibrated' },
    judgeUsage: { calls: usage.calls, cached: usage.cached, failures: usage.failures, inputTokens: usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens, outputTokens: usage.outputTokens } }, reviewer);
  writeFileSync(resolve(options.out, 'tally.json'), JSON.stringify(tally, null, 2));
  // 없는 그림 장부: 검수자가 본 것 + 도구가 적은 것 + 다른 주제의 대역.
  let artGaps: any = null;
  if (!options.noArt && !options.noReview) {
    const entries: GapEntry[] = [], chipsetOf = new Map<string, string>();
    for (const review of results) {
      const where = { group: review.group, label: review.label, chipset: review.map.tilesetId, theme: review.art?.theme ?? '' };
      if (!chipsetOf.has(review.group) && review.map.tilesetId) chipsetOf.set(review.group, review.map.tilesetId);
      for (const missing of review.art?.missing ?? []) entries.push({ source: 'reviewer', thing: missing.thing, instead: missing.instead, unsure: missing.unsure, namedBy: missing.namedBy, where });
      for (const wrong of review.art?.wrongTheme ?? []) entries.push({ source: 'theme', thing: wrong.fitting || wrong.thing, instead: wrong.thing, kind: wrong.kind, where });
    }
    const sessions = corpusSessions(options.corpus).filter(session => !options.only || results.some(review => review.group === session.group));
    for (const session of sessions) for (const report of toolReportsOfSession(session.sessionDir)) entries.push({ source: 'tool', thing: report.thing, instead: report.instead, kind: report.kind, where: { group: session.group, label: session.label, chipset: report.chipset || chipsetOf.get(session.group) || '', theme: '' } });
    const cluster = await clusterThings(entries.map(entry => entry.thing), resolve(options.out, 'judge-cache'), usage);
    const rows = buildArtGaps(entries, cluster.map);
    artGaps = { schemaVersion: 1, kind: 'assistant-map-vqa-art-gaps', corpus: options.corpus, generatedAt: new Date().toISOString(), promptVersion: ART_GAPS_VERSION, clustered: cluster.clustered,
      note: '검수자의 이 물음(이름은 있는데 그림에 없는 것)은 따로 보정하지 않았다 — 그릴 차례를 정하는 목록이지 합격 판정이 아니다.',
      totals: { rows: rows.length, entries: entries.length, fromReviewer: entries.filter(entry => entry.source === 'reviewer').length, fromTools: entries.filter(entry => entry.source === 'tool').length, wrongTheme: entries.filter(entry => entry.source === 'theme').length, mapsAsked: results.filter(review => review.art?.status === 'reviewed').length, mapsUnanswered: results.filter(review => review.art?.status === 'unreviewed').length },
      rows, entries };
    writeFileSync(resolve(options.out, 'art-gaps.json'), JSON.stringify(artGaps, null, 2));
  }
  const before = options.before ? JSON.parse(readFileSync(resolve(options.before), 'utf8')) : null;
  const html = writeMapVqaPage({ out: options.out, tally, reviewer, before, html: options.html, artGaps, reviews: results });
  const t = tally.totals;
  console.log(`\nmap-vqa: 맵 ${t.maps}장(검수 ${t.reviewed}) · blocker 가 있는 맵 ${t.withBlocker} · major 이상이 있는 맵 ${t.withMajorOrWorse} · 깨끗한 맵 ${t.clean} · 결함 blocker ${t.blocker} / major ${t.major} / polish ${t.polish}`);
  if (artGaps) console.log(`없는 그림 장부: ${artGaps.totals.rows}줄(검수자 ${artGaps.totals.fromReviewer} · 도구 신고 ${artGaps.totals.fromTools} · 다른 주제 대역 ${artGaps.totals.wrongTheme}) → ${resolve(options.out, 'art-gaps.json')}`);
  console.log(`${usageLine(usage)}\n보정: ${calibration ? `${calibration.status} — 놓침 ${calibration.missRate} · 헛경보 ${calibration.falseAlarmRate}` : '보정 전(uncalibrated) — 이 숫자는 보정되지 않은 검수자의 것이다'}\n${resolve(options.out, 'tally.json')}\n${html}`);
  return 0;
}
