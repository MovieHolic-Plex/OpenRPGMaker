// 없는 그림 장부(art-gaps) — 맵을 잘못 깐 결함과 따로 센다. 세 갈래를 모은다:
//   (a) 검수자가 본 «이름은 있는데 그림에 없는 것»: 요청·이벤트 이름·빌더 이름표가 가리키는데 맵에 그려지지 않은 것(노점 없는 시장, 배 없는 항구, 맨바닥의 «책장» 이벤트)
//   (b) 빌더·도구가 스스로 적은 것: 결과의 missingArt, «그리기 카드를 대기열에», «이름이 맞는 기물이 이미 있다 → 이것을 써라», «…쪽을 보는 그림이 없다», «그림이 없어 빠졌다», 그림을 까닭으로 막힌 할 일
//   (c) 다른 주제의 대역: 사막 맵의 숲 전투 배경, 피라미드의 «광산 해골 궁수» — 문서의 사실(전투 배경 id · 싸우는 적 이름)을 검수자에게 주고 판단을 받는다
// 결과 art-gaps.json = 칩셋 × 없는 것 × 그것을 바란 맵·실행 수 × 대신 쓰인 것, 많이 바란 순 — 그림 하네스의 그릴 차례다.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Project } from '../../../../project/types';
import { askJudge, extractJson, type JudgeUsage } from '../visualJudge';
import { allCommands } from '../smallJobs/checkSupport';

export const ART_GAPS_VERSION = 'art-gaps-v1';
export const ART_GAPS_SYSTEM = [
  'You keep the MISSING-ART LEDGER for a 16px top-down JRPG maker. An AI assistant laid the map in front of you from a chipset (a fixed set of tiles and object pieces). When the chipset has no art for a thing, the assistant leaves it out or puts something else there. Your job is to list what a pixel artist would have to DRAW so that this map could show what it is supposed to show.',
  'This is NOT a layout review. Do not list badly placed things, empty space, blocked doors or roads. List only art that is absent or replaced.',
  '',
  'You receive the clean picture of the map (1x and magnified), and a FACTS text: the request or story, event names and texts, the builder\'s own area labels, the chipset name, the battle backdrop id and the names of the foes fought on this map.',
  '',
  'A. "missing" — things that are NAMED but NOT DRAWN. A thing is named when the request sentence asks for it, when an event is named after it or its text describes it (an examine event «책장», «우물», «표지판»), or when a builder label claims it («노점», «부두»). Look at the place where it should be (the event cell, the labelled area, or anywhere on the map for a request). If nothing of that kind is drawn there, list it. If something else is drawn in its place, list it and say what is drawn instead.',
  '   - Only drawable things: objects, furniture, buildings, vehicles, animals, terrain features. Not people, not names of persons, not abstract things (a mood, a rumour), not sounds.',
  '   - If the thing IS drawn (even roughly), do not list it. When you cannot tell whether a drawn shape is the named thing, list it with "unsure": true.',
  '   - One entry per kind of thing per map (three missing stalls = one entry "노점" with count 3).',
  'B. "wrong_theme" — art or foes from a different theme standing in on this map: a battle backdrop whose id names another biome (forest backdrop on a desert or cave map), a foe whose name belongs elsewhere (a «광산 …» or «초원 …» foe inside a pyramid), tiles or props from another era or climate (a snowy tree in a desert, a modern vending machine in a medieval town). Say what theme the map is and what a fitting piece would be.',
  '',
  'OUTPUT — reply with ONE JSON object and nothing else:',
  '{"theme":"한국어 한 줄: 이 맵의 주제(예: 사막 궁전, 눈 마을, 현대 편의점)","missing":[{"thing":"한국어 짧은 이름(예: 노점, 배, 책장)","count":1,"named_by":"request|event|label","where":{"x":0,"y":0,"w":1,"h":1},"instead":"그 자리에 대신 그려진 것(없으면 맨바닥)","unsure":false}],"wrong_theme":[{"thing":"한국어: 대역으로 쓰인 것","kind":"backdrop|foe|tile","fitting":"한국어: 이 맵에 맞는 것","why":"한국어 한 줄"}]}',
  '- "where" may be null when the request names a thing that is nowhere on the map.',
  '- Use plain short Korean nouns for "thing" so that the same thing on another map gets the same name.',
  '- Empty lists are fine: {"missing":[],"wrong_theme":[]} means the art is all there.',
].join('\n');

export type MissingThing = { thing: string; count: number; namedBy: 'request' | 'event' | 'label'; where: { x: number; y: number; w: number; h: number } | null; instead: string; unsure: boolean };
export type WrongTheme = { thing: string; kind: 'backdrop' | 'foe' | 'tile'; fitting: string; why: string };
export type ArtReview = { status: 'reviewed' | 'unreviewed'; error?: string; theme: string; missing: MissingThing[]; wrongTheme: WrongTheme[]; judgeKey?: string };

/** 그 맵에서 싸우는 적 이름(이벤트 전투·무작위 조우)과 전투 배경 id. */
export function battleFacts(project: Project, mapId: string): { backdrop: string; foes: string[] } {
  const doc = project as any, map = doc.maps[mapId];
  const troops = new Map<string, any>((doc.database?.troops ?? []).map((troop: any) => [troop.id, troop])), enemies = new Map<string, any>((doc.database?.enemies ?? []).map((enemy: any) => [enemy.id, enemy]));
  const ids = new Set<string>([...(map.troopIds ?? []), ...((map.encounterTable ?? []) as any[]).map(entry => entry.troopId)]);
  for (const event of (map.events ?? []) as any[]) for (const command of allCommands(event)) if (command.kind === 'battleProcessing' && command.troopId) ids.add(command.troopId);
  const foes = [...ids].flatMap(id => ((troops.get(id)?.members ?? []) as any[]).map(member => String(enemies.get(member.enemyId)?.name ?? ''))).filter(Boolean);
  return { backdrop: String(map.battleBackground ?? ''), foes: [...new Set(foes)] };
}
export function battleFactsText(facts: { backdrop: string; foes: string[] }): string {
  return `BATTLE BACKDROP id of this map: ${facts.backdrop || 'none set (the game default is used)'}.\nFOES fought on this map (by name): ${facts.foes.join(', ') || 'none'}.`;
}

const KINDS = ['backdrop', 'foe', 'tile'], NAMED = ['request', 'event', 'label'];
export function parseArtReview(reply: string, size: { width: number; height: number }): { theme: string; missing: MissingThing[]; wrongTheme: WrongTheme[] } | null {
  const data = extractJson(reply) as any;
  if (!data || typeof data !== 'object' || !Array.isArray(data.missing) || !Array.isArray(data.wrong_theme)) return null;
  const missing: MissingThing[] = [], wrongTheme: WrongTheme[] = [];
  for (const raw of data.missing) {
    if (!raw || typeof raw.thing !== 'string' || !/[가-힣]/u.test(raw.thing) || !NAMED.includes(raw.named_by)) return null;
    const where = raw.where && [raw.where.x, raw.where.y, raw.where.w, raw.where.h].every(Number.isFinite)
      ? { x: Math.max(0, Math.min(size.width - 1, Math.round(raw.where.x))), y: Math.max(0, Math.min(size.height - 1, Math.round(raw.where.y))), w: Math.max(1, Math.round(raw.where.w)), h: Math.max(1, Math.round(raw.where.h)) } : null;
    missing.push({ thing: raw.thing.trim().slice(0, 40), count: Math.max(1, Math.round(Number(raw.count) || 1)), namedBy: raw.named_by, where, instead: String(raw.instead ?? '').trim().slice(0, 80), unsure: raw.unsure === true });
  }
  for (const raw of data.wrong_theme) {
    if (!raw || typeof raw.thing !== 'string' || !raw.thing.trim() || !KINDS.includes(raw.kind)) return null;
    wrongTheme.push({ thing: raw.thing.trim().slice(0, 60), kind: raw.kind, fitting: String(raw.fitting ?? '').trim().slice(0, 80), why: String(raw.why ?? '').replace(/\s+/gu, ' ').trim().slice(0, 240) });
  }
  return { theme: String(data.theme ?? '').slice(0, 80), missing, wrongTheme };
}

export async function askArtGaps(input: { cacheDir: string; usage: JudgeUsage; context: string; factsText: string; battle: { backdrop: string; foes: string[] }; images: Array<{ label: string; png: Buffer }>; size: { width: number; height: number } }): Promise<ArtReview> {
  const answer = await askJudge({ cacheDir: input.cacheDir, promptVersion: ART_GAPS_VERSION, system: ART_GAPS_SYSTEM, usage: input.usage, images: input.images,
    text: `${input.context}\n\n${input.factsText}\n${battleFactsText(input.battle)}\n\nList the missing art and the wrong-theme stand-ins of this map. Reply with the JSON object.`,
    parse: reply => parseArtReview(reply, input.size) });
  return 'answer' in answer ? { status: 'reviewed', ...answer.answer, judgeKey: answer.key } : { status: 'unreviewed', error: answer.error, theme: '', missing: [], wrongTheme: [], judgeKey: answer.key };
}

// ── (b) 빌더·도구가 적은 것 ───────────────────────────────────────────────
export type ToolReport = { kind: 'missing-art' | 'card-queued' | 'stand-in-offered' | 'no-direction-art' | 'feature-dropped' | 'blocked-todo'; thing: string; instead: string; chipset: string; tool: string; text: string };
/** 도구 결과 글 하나에서 «그림이 없다»는 신고를 꺼낸다. 엔딩·타이틀 그림 이야기(맵 칩셋과 무관)는 건드리지 않는다. */
export function toolReportsIn(tool: string, text: string): ToolReport[] {
  const out: ToolReport[] = [], seen = new Set<string>();
  const push = (report: Omit<ToolReport, 'tool' | 'text' | 'chipset'> & { chipset?: string }, at: number) => {
    const key = `${report.kind}|${report.thing}`;
    if (!report.thing || seen.has(key)) return;
    seen.add(key);
    out.push({ chipset: '', ...report, tool, text: text.slice(Math.max(0, at - 60), at + 200).replace(/\s+/gu, ' ') });
  };
  for (const match of text.matchAll(/"missingArt":\s*\[([^\]]+)\]/gu)) {
    for (const item of match[1]!.matchAll(/"((?:[^"\\]|\\.)+)"/gu)) push({ kind: 'missing-art', thing: item[1]!.replace(/\s*\(.*$/u, '').trim(), instead: /카드 대기/u.test(item[1]!) ? '없음(그리기 카드 대기)' : '' }, match.index!);
  }
  for (const match of text.matchAll(/「([^」]{1,40})」 그리기 카드를 대기열에 올렸다([^\n]{0,160})/gu)) push({ kind: 'card-queued', thing: match[1]!, instead: '없음(그리기 카드 대기)', chipset: /칩셋 ([\w-]+)/u.exec(match[2]!)?.[1] ?? '' }, match.index!);
  for (const match of text.matchAll(/「([^」]{1,40})」과\(와\) 이름이 맞는 기물이 이 칩셋에 이미 있다[^:]*:\s*([\w-]+)\(((?:[^()]|\([^()]*\)){1,60})\)/gu)) push({ kind: 'stand-in-offered', thing: match[1]!, instead: `${match[3]}(${match[2]})` }, match.index!);
  for (const match of text.matchAll(/([가-힣A-Za-z ]{1,24})\(\d+,\d+\) — ([NSEW]) 쪽을 보는 그림이 없다/gu)) push({ kind: 'no-direction-art', thing: `${match[1]!.trim()} (${match[2]} 쪽을 보는 그림)`, instead: '다른 쪽을 보는 그림 그대로' }, match.index!);
  for (const match of text.matchAll(/특징 ([\w가-힣-]{1,30}) 은 놓을 빈 바닥·그림이 없어 빠졌다/gu)) push({ kind: 'feature-dropped', thing: match[1]!, instead: '뺌' }, match.index!);
  for (const match of text.matchAll(/✗blocked \S+ ([^\n—]{2,80}) — ([^\n"]{0,200})/gu)) {
    if (/그림|공방|기물이 없|칩셋에 없|objectId/u.test(match[2]!) && !/엔딩|타이틀|오프닝/u.test(match[1]! + match[2]!)) push({ kind: 'blocked-todo', thing: match[1]!.replace(/· attempts \d+/u, '').trim(), instead: '막힘(놓지 못함)' }, match.index!);
  }
  return out;
}
/** 실행 폴더(게임 통판 또는 맵 깔기 요청 하나)의 턴 기록 전체에서 신고를 모은다. */
export function toolReportsOfSession(sessionDir: string): ToolReport[] {
  const turns = resolve(sessionDir, 'turns');
  if (!existsSync(turns)) return [];
  const all = new Map<string, ToolReport>();
  for (const name of readdirSync(turns).filter(file => /^\d+\.json$/u.test(file)).sort()) {
    let turn: any; try { turn = JSON.parse(readFileSync(resolve(turns, name), 'utf8')); } catch { continue; }
    for (const call of turn.toolCalls ?? []) for (const report of toolReportsIn(String(call.name ?? ''), String(call.modelText ?? call.summary ?? ''))) all.set(`${report.kind}|${report.thing}`, all.get(`${report.kind}|${report.thing}`) ?? report);
  }
  return [...all.values()];
}

// ── 장부 ─────────────────────────────────────────────────────────────────
export type GapSource = { group: string; label: string; chipset: string; theme: string; /** 같은 게임의 실행들을 하나로 세는 열쇠(없으면 묶음 이름). */ run?: string };
export type GapEntry = { source: 'reviewer' | 'tool' | 'theme'; thing: string; instead: string; unsure?: boolean; namedBy?: string; kind?: string; where: GapSource };
export type ArtGapRow = { chipset: string; thing: string; maps: number; runs: number; fromReviewer: number; fromTools: number; wrongTheme: number; unsureOnly: boolean; instead: string[]; examples: string[]; names: string[] };

/** 장부 줄: (칩셋, 이름)마다 그것을 바란 맵 수·실행 수·대신 쓰인 것. canonical 은 이름 묶기 표(없으면 적힌 이름 그대로). */
export function buildArtGaps(entries: GapEntry[], canonical: Record<string, string> = {}): ArtGapRow[] {
  const rows = new Map<string, { row: ArtGapRow; maps: Set<string>; runs: Set<string>; instead: Map<string, number>; names: Set<string>; sure: boolean }>();
  for (const entry of entries) {
    const thing = canonical[entry.thing] ?? entry.thing, chipset = entry.where.chipset || '(칩셋 모름)', key = `${chipset}|${thing}`;
    let slot = rows.get(key);
    if (!slot) rows.set(key, slot = { row: { chipset, thing, maps: 0, runs: 0, fromReviewer: 0, fromTools: 0, wrongTheme: 0, unsureOnly: false, instead: [], examples: [], names: [] }, maps: new Set(), runs: new Set(), instead: new Map(), names: new Set(), sure: false });
    slot.maps.add(entry.where.label); slot.runs.add(entry.where.run ?? entry.where.group); slot.names.add(entry.thing); // 묶음(A:<실행> · B:<요청>) 하나가 실행 하나 — 같은 게임의 사본은 run 열쇠로 한 번만
    if (entry.source === 'reviewer') slot.row.fromReviewer += 1; else if (entry.source === 'tool') slot.row.fromTools += 1; else slot.row.wrongTheme += 1;
    if (!entry.unsure) slot.sure = true;
    if (entry.instead) slot.instead.set(entry.instead, (slot.instead.get(entry.instead) ?? 0) + 1);
  }
  return [...rows.values()].map(slot => ({ ...slot.row, maps: slot.maps.size, runs: slot.runs.size, unsureOnly: !slot.sure, instead: [...slot.instead.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([text]) => text), examples: [...slot.maps].slice(0, 4), names: [...slot.names].slice(0, 6) }))
    .sort((a, b) => b.runs - a.runs || b.maps - a.maps || Number(a.unsureOnly) - Number(b.unsureOnly) || a.thing.localeCompare(b.thing, 'ko'));
}

const CLUSTER_SYSTEM = 'You tidy a list of Korean names of game-map things (objects, furniture, buildings, vehicles, terrain) written by different reviewers. Group names that mean the same drawable thing and give each group ONE short plain Korean noun (e.g. "시장 가판대", "좌판", "노점상 천막" -> "노점"). Do not merge different things (a 배 is not a 부두). Names that are sentences («항구에 드나드는 배 표현하기») map to the thing they are about («배»). Reply with ONE JSON object mapping EVERY input name to its group name, nothing else: {"<input name>":"<group name>", ...}.';
/** 여러 검수가 다르게 적은 이름을 같은 것끼리 묶는다(검수자 모델 한 번). 실패하면 빈 표 — 적힌 이름 그대로 센다. */
export async function clusterThings(things: string[], cacheDir: string, usage: JudgeUsage): Promise<{ map: Record<string, string>; clustered: boolean }> {
  const names = [...new Set(things)].sort();
  if (names.length < 2) return { map: {}, clustered: false };
  const answer = await askJudge({ cacheDir, promptVersion: 'art-gaps-cluster-v1', system: CLUSTER_SYSTEM, usage, images: [], text: JSON.stringify(names),
    parse: reply => { const data = extractJson(reply) as any; return data && typeof data === 'object' && !Array.isArray(data) && names.every(name => typeof data[name] === 'string' && data[name].trim()) ? data as Record<string, string> : null; } });
  return 'answer' in answer ? { map: answer.answer, clustered: true } : { map: {}, clustered: false };
}
