// HUD 검수 — 조수가 만든 게임을 출하 플레이어로 켜서 맵마다 필드 화면(HUD · 목표 줄 · 주인공)을 찍고, 검수자(Opus)가 HUD 가 그 게임에 맞게 놓였는지 본다.
// 맵 렌더에는 HUD 가 없다. 오너(2026-11-11): «HUD 를 조수가 제대로 설정을 못하는거같다 — HUD 위주로 검토».
// 검수자에게 주는 사실(모델 없음): 저장된 fieldHud 설정, 그 설정이 화면에 띄우는 것(hudOnScreen), 이 게임이 실제로 쓰는 몸 게이지(projectHudUse), 전투가 턴제인지 액션인지.
// `hudOnScreen`·`projectHudUse` 는 src/project/fieldHud.ts 에 있으면 그것을 쓰고(PR #4607), 없으면 같은 뜻의 작은 셈을 여기서 한다.
// 이 검수자는 따로 보정하지 않았다 — 숫자에 «보정 전»이 붙는다. 판정 파일은 손으로 쓰지 않는다.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import * as fieldHud from '../../../../project/fieldHud';
import type { Project } from '../../../../project/types';
import { askJudge, mapLimit, newUsage, usageLine, type JudgeUsage } from '../visualJudge';
import { allCommands } from '../smallJobs/checkSupport';
import { loadCorpus, type MapItem } from './corpus';
import { isBlankMap, mapFacts } from './facts';
import { buildHudTally, HUD_CLASSES, HUD_VERSION, parseHudReview, type HudDefect, type HudShot } from './hudVerdict';

export { buildHudTally, HUD_CLASSES, HUD_VERSION, parseHudReview } from './hudVerdict';

const SYSTEM = [
  'You are an adversarial reviewer of the on-screen HUD of a 16px top-down JRPG that an AI assistant built. You get ONE screenshot of the shipped player (960x720) standing on a field map, and FACTS read from the saved game. A player would see exactly this screen.',
  'Look only at what is overlaid on the game view: gauges/bars, numbers, hearts, tool or item slots, rings, clocks, gold, the objective line or chip (usually top-right), and any label. Do NOT review the map itself (tiles, buildings, roads) — another reviewer does that.',
  '',
  'Report a defect only when you can point at it on the screenshot. Classes:',
  '- "unused-gauge": a gauge, bar or number for a stat this game never changes. Use the FACTS line "What this game actually uses": e.g. an MP bar «마력 43/43» when no skill costs MP, an HP bar when nothing can hurt the hero, a stamina ring without action combat. A lone gauge left over after the others were hidden is the typical case.',
  '- "wrong-genre-hud": HUD pieces from another kind of game: action-game pieces (tool/weapon slots, stamina ring, hearts as life) on a turn-based or story game, a farm clock/energy bar on a dungeon crawler, and so on. Use the FACTS line about combat.',
  '- "unreadable": HUD text or numbers that are hard to read where they sit (light text on bright sand/snow, no backing panel, tiny text, text cut by the screen edge).',
  '- "covers-play": a HUD piece or the objective chip sits on top of the hero or of the thing the player must look at or walk to.',
  '- "objective-text": the objective line wraps awkwardly (one orphan word on the second line, mid-word break), is truncated, overflows its chip, or — ONLY when FACTS say this is the start screen — tells the player to go to the place they are already standing in.',
  '- "other": any other HUD defect a player would notice (two pieces overlapping each other, an empty frame with nothing in it, a label in the wrong language).',
  'Severity: "major" = a player notices at once and it makes the game look unfinished or misleads them; "polish" = you have to look for it. There is no "blocker" here.',
  'If the screen shows a dialogue window or a cutscene instead of the open field, say so in "screen" and review only what is visible.',
  '',
  'OUTPUT — ONE JSON object and nothing else:',
  '{"screen":"한국어 한 줄: 화면에 무엇이 떠 있는지(게이지·목표 줄 등, 위치와 글자 그대로)","defects":[{"class":"unused-gauge|wrong-genre-hud|unreadable|covers-play|objective-text|other","severity":"major|polish","evidence":"한국어 한 줄: 화면의 어디에 무엇이 어떻게 잘못됐는지(글자는 그대로 인용)"}]}',
  'No defects is a valid answer: {"screen":"…","defects":[]}. Write "screen" and "evidence" in Korean.',
].join('\n');

/** 저장된 게임의 HUD 사실(모델 없음). */
export function hudFacts(project: Project): { config: unknown; onScreen: string[]; use: { hp: boolean; mp: boolean; stamina: boolean }; actionCombat: boolean; unused: string[]; text: string } {
  const doc = project as any, hud = fieldHud as any;
  const config = hud.effectiveFieldHud?.(doc) ?? doc.system?.fieldHud;
  const widgets: any[] = config ? (hud.resolvedHudWidgets?.(config) ?? []).filter((widget: any) => widget.enabled !== false) : [];
  const onScreen: string[] = config ? (hud.hudOnScreen?.(config) ?? [...widgets.map(widget => `${widget.kind === 'gauge' ? `${widget.source} gauge${widget.shape && widget.shape !== 'bar' ? ` (${widget.shape})` : ''}` : widget.kind === 'slots' ? `${widget.source} slots x${widget.slots ?? '?'}` : `${widget.source ?? ''} ${widget.kind}`.trim()}${widget.label ? ` «${widget.label}»` : ''} at ${widget.anchor}`), ...(config.objective ? ['objective line at top-right'] : [])]) : [];
  const actionCombat = doc.system?.actionCombat?.enabled === true || Object.values<any>(doc.maps ?? {}).some(map => map.actionCombat?.enabled === true);
  const costsMp = (cost: unknown): boolean => typeof cost === 'number' ? cost > 0 : !!cost && typeof cost === 'object' && Object.values(cost as Record<string, unknown>).some(value => typeof value === 'number' && value > 0);
  const canLoseHp = actionCombat || hud.projectCanLoseHp?.(doc) === true;
  const use = hud.projectHudUse?.(doc) ?? { hp: canLoseHp, mp: canLoseHp && ((doc.database?.skills ?? []) as any[]).some(skill => costsMp(skill.mpCost)), stamina: actionCombat };
  const unused = widgets.filter(widget => widget.kind === 'gauge' && ((widget.source === 'hp' && !use.hp) || (widget.source === 'mp' && !use.mp) || (widget.source === 'stamina' && !use.stamina))).map(widget => String(widget.source));
  const battles = Object.values<any>(doc.maps ?? {}).some(map => (map.events ?? []).some((event: any) => allCommands(event).some(command => command.kind === 'battleProcessing')) || ((map.encounterRate ?? 0) > 0 && (map.encounterTable ?? []).length > 0));
  const text = [
    `Saved HUD setting (project.system.fieldHud): ${config ? JSON.stringify({ ...config, widgets: config.widgets ? `${config.widgets.length} custom widgets` : undefined }) : 'none saved (the runtime default is used)'}.`,
    `What that setting puts on the field screen: ${onScreen.join('; ') || 'nothing'}.`,
    `What this game actually uses: HP can go down: ${use.hp ? 'yes' : 'NO'} · some skill costs MP: ${use.mp ? 'yes' : 'NO'} · stamina (action combat): ${use.stamina ? 'yes' : 'NO'}.`,
    `Combat: ${actionCombat ? 'real-time ACTION combat on the field' : battles ? 'TURN-BASED battles on a separate battle screen (the field itself has no action combat, no tools to swing)' : 'NO battles at all (a story / exploration game)'}.`,
    ...(unused.length ? [`Model-free check: the setting shows a gauge for ${unused.join(', ')}, which this game never changes.`] : []),
  ].join('\n');
  return { config, onScreen, use, actionCombat, unused, text };
}

/** 맵마다 주인공을 세울 칸: 시작 맵은 시작 칸, 아니면 그 맵으로 들어오는 이동의 도착 칸, 그것도 없으면 가장 큰 걷는 덩어리의 가운데 가까운 칸. */
export function hudSpots(project: Project, mapIds: string[]): Array<{ mapId: string; x: number; y: number; start: boolean }> {
  const doc = project as any, out: Array<{ mapId: string; x: number; y: number; start: boolean }> = [];
  for (const mapId of mapIds) {
    const map = doc.maps[mapId];
    if (!map) continue;
    if (doc.startMapId === mapId) { out.push({ mapId, x: doc.startPos?.x ?? 0, y: doc.startPos?.y ?? 0, start: true }); continue; }
    let spot: { x: number; y: number } | null = null;
    for (const other of Object.values<any>(doc.maps)) {
      if (spot || other.id === mapId) continue;
      for (const event of other.events ?? []) { const transfer = allCommands(event).find(command => command.kind === 'transfer' && command.mapId === mapId && Number.isFinite(command.x)); if (transfer) { spot = { x: transfer.x, y: transfer.y }; break; } }
    }
    if (!spot) {
      const facts = mapFacts(project, mapId, true), cx = map.width / 2, cy = map.height / 2;
      let best = Infinity;
      for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) { if (facts.blocked.has(`${x},${y}`)) continue; const distance = (x - cx) ** 2 + (y - cy) ** 2; if (distance < best) { best = distance; spot = { x, y }; } }
    }
    if (spot) out.push({ mapId, ...spot, start: false });
  }
  return out;
}

const esc = (text: unknown): string => String(text ?? '').replace(/[&<>"]/gu, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]!));
function writeHudPage(tally: ReturnType<typeof buildHudTally>, html: string): string {
  const rows = tally.ranked.map((row, index) => `<tr><td>${index + 1}</td><td><b>${esc(row.label)}</b><div class="id">${esc(row.class)}</div></td><td class="n major">${row.major}</td><td class="n">${row.polish}</td><td class="n">${row.shots}</td><td class="n"><b>${row.games}</b></td></tr>`).join('');
  const gameRows = tally.perGame.map(game => `<tr><td>${esc(game.label)}</td><td class="n">${game.skipped ? '-' : game.reviewed}</td><td class="n major">${game.skipped ? '-' : game.major}</td><td class="n">${game.skipped ? '-' : game.polish}</td><td>${game.skipped ? esc(game.skipped) : esc(game.classes.join(' · ') || '-')}</td><td>${esc(game.modelFreeUnusedGauges.join(', ') || '-')}</td></tr>`).join('');
  const sections = tally.games.filter(game => !game.skipped).map(game => {
    const shots = tally.shots.filter(shot => shot.group === game.group);
    return `<section><h2>${esc(game.label)}</h2><pre>${esc(game.factsText)}</pre>${shots.map(shot => `<div class="shot"><h3>${esc(shot.mapName)}${shot.start ? ' <span class="badge">시작 화면</span>' : ''} ${shot.defects.some(defect => defect.severity === 'major') ? '<span class="badge major">큰 결함</span>' : ''}</h3>${shot.file && existsSync(shot.file) ? `<img src="data:image/png;base64,${readFileSync(shot.file).toString('base64')}" width="960" height="720" alt="">` : '<p class="warn">화면을 찍지 못했다</p>'}<p class="id">${shot.status === 'reviewed' ? `검수자가 본 화면: ${esc(shot.screen)}` : `미검증 — ${esc(shot.error ?? '')}`}${shot.chip ? ` · 목표 줄 글: «${esc(shot.chip)}»` : ''}</p>${shot.defects.length ? `<ol>${shot.defects.map(defect => `<li><span class="${defect.severity}">${defect.severity === 'major' ? '큰 결함' : '다듬기'}</span> <b>${esc(HUD_CLASSES[defect.class])}</b> — ${esc(defect.evidence)}</li>`).join('')}</ol>` : shot.status === 'reviewed' ? '<p class="ok">HUD 결함 없음</p>' : ''}</div>`).join('')}</section>`;
  });
  const t = tally.totals;
  const body = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>조수가 만든 게임의 HUD — 화면 검수</title><style>
body{background:#17181c;color:#e8e8ec;font:15px/1.6 system-ui,'Noto Sans KR',sans-serif;margin:0;padding:24px 40px;max-width:1240px}
h1{font-size:24px;margin:0 0 6px}h2{font-size:19px;margin:34px 0 8px;border-bottom:1px solid #3a3c44;padding-bottom:4px}h3{font-size:15px;margin:18px 0 6px}
table{border-collapse:collapse;width:100%;margin:8px 0 14px}th,td{border:1px solid #33353d;padding:6px 8px;text-align:left;vertical-align:top}th{background:#22242b}
td.n{text-align:right;white-space:nowrap}.major{color:#ffb454;font-weight:700}.polish{color:#ffe066}.id{color:#8d8f99;font-size:13px}.warn{color:#ffb454}.ok{color:#7ddc8a}
.badge{font-size:12px;padding:1px 6px;border-radius:4px;background:#3a3c44;color:#e8e8ec}.badge.major{background:#ffb454;color:#17181c}
img{image-rendering:pixelated;border:1px solid #33353d;max-width:100%;height:auto;display:block}pre{background:#1e2026;padding:8px 10px;border:1px solid #33353d;white-space:pre-wrap;font-size:13px;color:#b9bbc6}
</style></head><body>
<h1>조수가 만든 게임의 HUD — 화면 검수</h1>
<p>출하 플레이어로 게임을 실제로 켜서 맵마다 필드 화면을 찍고, 검수자(Claude Opus 5.5)가 HUD(게이지·슬롯·목표 줄)가 그 게임에 맞게 떠 있는지 봤습니다. 시작 화면이 아닌 맵은 같은 세션에서 계측 훅으로 옮겨 찍은 것이라 목표 글은 «처음 세운 목표» 그대로입니다 — 그 화면에서는 목표 글이 자리에 맞는지 판정하지 않았습니다.</p>
<p class="warn"><b>보정 전 숫자입니다.</b> 이 HUD 검수자는 심은 결함으로 재지 않았습니다. 아래 «모델 없이 본 것» 칸은 저장된 설정과 게임 데이터만으로 셈한 것입니다.</p>
<p><b>게임 ${t.games}개 · 화면 ${t.shots}장</b>(검수 ${t.reviewed}) · 큰 결함이 있는 화면 <b>${t.shotsWithMajor}</b> · 큰 결함이 있는 게임 <b>${t.gamesWithMajor}</b> · 결함 수: 큰 결함 ${t.major} / 다듬기 ${t.polish}</p>
<h2>HUD 결함 종류</h2>
<table><tr><th>#</th><th>종류</th><th>큰 결함</th><th>다듬기</th><th>걸린 화면</th><th>걸린 게임</th></tr>${rows}</table>
<h2>게임마다</h2>
<table><tr><th>게임</th><th>검수한 화면</th><th>큰 결함</th><th>다듬기</th><th>큰 결함 종류</th><th>모델 없이 본 것: 안 쓰는 게이지</th></tr>${gameRows}</table>
${sections.join('\n')}
</body></html>`;
  writeFileSync(html, body);
  return html;
}

export type HudOptions = { out?: string; corpus?: string; only?: string; html?: string; playerRoot?: string; noReview?: boolean; concurrency?: string };
export async function runHudVqa(options: HudOptions): Promise<number> {
  if (!options.out || !options.corpus) throw Error('map-vqa-hud --corpus <실행 폴더[,폴더…] | whole-games:<상위 폴더>> --out <결과 폴더> [--player-root <dist/export-player 가 있는 체크아웃>] [--only 글자] [--no-review] [--html <출력.html>]');
  const playerRoot = resolve(options.playerRoot ?? '.');
  if (!existsSync(resolve(playerRoot, 'dist/export-player/player.html'))) throw Error(`map-vqa-hud: ${playerRoot}/dist/export-player/player.html 이 없다 — 출하 플레이어가 빌드된 체크아웃을 --player-root 로 준다`);
  let items = loadCorpus(options.corpus);
  if (options.only) { const needles = options.only.split(',').map(part => part.trim()).filter(Boolean); items = items.filter(item => needles.some(needle => item.id.includes(needle) || item.group.includes(needle))); }
  const groups = new Map<string, MapItem[]>();
  for (const item of items) groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
  const root = resolve(options.out, 'hud'), usage: JudgeUsage = newUsage();
  mkdirSync(root, { recursive: true });
  console.log(`map-vqa-hud: 게임 ${groups.size}개 · 맵 ${items.length}장 · 지시문 ${HUD_VERSION} · 플레이어 ${playerRoot} → ${root}`);
  const games: Array<{ group: string; label: string; factsText: string; unused: string[]; skipped?: string }> = [];
  const shots: HudShot[] = [];
  // 화면 찍기 — 게임 하나에 브라우저 하나, 동시에 둘까지.
  await mapLimit([...groups.entries()], 2, async ([group, list]) => {
    const first = list[0]!, project = first.project, label = first.label.split(' · ')[0]!, facts = hudFacts(project);
    if (!first.projectDir) { games.push({ group, label, factsText: facts.text, unused: facts.unused, skipped: '프로젝트 폴더가 없는 말뭉치(견본)' }); return; }
    // 맵 깔기 묶음(B)은 조수가 HUD 를 건드린 요청만 본다 — 건드리지 않았으면 빈 프로젝트의 기본 HUD 다.
    if (group.startsWith('B:') && !(project as any).system?.fieldHud) { games.push({ group, label, factsText: facts.text, unused: facts.unused, skipped: '조수가 HUD 를 설정하지 않은 요청(빈 프로젝트의 기본 HUD)' }); return; }
    games.push({ group, label, factsText: facts.text, unused: facts.unused });
    const dir = resolve(root, group.replace(/[^\w가-힣-]+/gu, '_'));
    const wanted = list.filter(item => !isBlankMap((project as any).maps[item.mapId]) || (project as any).startMapId === item.mapId);
    const spots = hudSpots(project, wanted.map(item => item.mapId)).map(spot => ({ ...spot, id: wanted.find(item => item.mapId === spot.mapId)!.id }));
    if (!existsSync(resolve(dir, 'shots.json'))) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(resolve(dir, 'spots.json'), JSON.stringify(spots, null, 1));
      const code = await new Promise<number>(done => {
        const child = spawn('node', [resolve('src/harnesses/assistant-capability/node/mapVqa/hudShots.mjs'), '--project-dir', first.projectDir!, '--out', dir, '--spots', resolve(dir, 'spots.json'), '--player-root', playerRoot], { stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = ''; child.stderr.on('data', chunk => { stderr += chunk; });
        const timer = setTimeout(() => child.kill('SIGKILL'), 15 * 60_000);
        child.once('exit', exit => { clearTimeout(timer); if (exit) console.log(`  화면 찍기 실패 ${label}: ${stderr.slice(-300)}`); done(exit ?? 1); });
      });
      if (code !== 0 && !existsSync(resolve(dir, 'shots.json'))) writeFileSync(resolve(dir, 'shots.json'), JSON.stringify({ rows: [], errors: ['화면 찍기 실패'] }));
    }
    const taken: any[] = JSON.parse(readFileSync(resolve(dir, 'shots.json'), 'utf8')).rows ?? [];
    for (const item of wanted) {
      const row = taken.find(entry => entry.id === item.id), mapName = String((project as any).maps[item.mapId]?.name ?? item.mapId);
      const base = { id: item.id, group, label: item.label, mapName, start: (project as any).startMapId === item.mapId, file: row?.file ?? '', chip: row?.chip ?? null, screen: '', defects: [] as HudDefect[] };
      if (!row?.file || !existsSync(row.file) || row.onMap === false) { shots.push({ ...base, status: 'no-shot', error: row?.error ?? (row?.onMap === false ? '그 맵에 서지 못했다' : '화면이 없다') }); continue; }
      shots.push({ ...base, status: 'unreviewed', error: '검수자를 부르지 않았다' });
    }
    console.log(`찍음  ${label} — 화면 ${taken.filter(entry => entry.file).length}/${wanted.length}`);
  });
  if (!options.noReview) {
    const factsOf = new Map(games.map(game => [game.group, game.factsText]));
    await mapLimit(shots.filter(shot => shot.status === 'unreviewed'), Math.max(1, Math.min(6, Number(options.concurrency ?? 4) || 4)), async shot => {
      const png = readFileSync(shot.file);
      const answer = await askJudge({ cacheDir: resolve(options.out!, 'judge-cache'), promptVersion: HUD_VERSION, system: SYSTEM, usage, images: [{ label: 'SCREENSHOT of the shipped player (960x720)', png }],
        text: `GAME: ${shot.label.split(' · ')[0]} — map «${shot.mapName}».\n${shot.start ? 'This IS the start screen: the first field the player sees after the opening. The objective line is the one the game set.' : 'This is NOT the start screen: the test harness moved the hero here in the same session, so the objective line still shows the game\'s FIRST objective. Do not judge whether the objective text fits this place; judge its wrapping and everything else.'}\n\nFACTS\n${factsOf.get(shot.group) ?? ''}\nObjective line text read from the page: ${shot.chip ? `«${shot.chip}»` : 'none'}.\n\nReview the HUD on this screenshot and reply with the JSON object.`,
        parse: parseHudReview });
      if ('answer' in answer) { shot.status = 'reviewed'; shot.screen = answer.answer.screen; shot.defects = answer.answer.defects; delete shot.error; }
      else shot.error = answer.error;
      console.log(`${shot.status === 'reviewed' ? `M${shot.defects.filter(defect => defect.severity === 'major').length} P${shot.defects.filter(defect => defect.severity === 'polish').length}` : '미검증'} ${shot.label}`);
    });
  }
  const order = [...groups.keys()];
  games.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
  shots.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || Number(b.start) - Number(a.start));
  const htmlFile = resolve(options.html ?? resolve(options.out, 'hud.html'));
  const tally = buildHudTally(shots, games, { corpus: options.corpus, generatedAt: new Date().toISOString(), playerRoot, page: basename(htmlFile), judgeUsage: { calls: usage.calls, cached: usage.cached, failures: usage.failures, inputTokens: usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens, outputTokens: usage.outputTokens } });
  writeFileSync(resolve(options.out, 'hud.json'), JSON.stringify(tally, null, 2));
  const html = writeHudPage(tally, htmlFile);
  const t = tally.totals;
  console.log(`\nmap-vqa-hud: 게임 ${t.games}개 · 화면 ${t.shots}장(검수 ${t.reviewed}) · 큰 결함이 있는 화면 ${t.shotsWithMajor} · 큰 결함이 있는 게임 ${t.gamesWithMajor} · 큰 결함 ${t.major} / 다듬기 ${t.polish} — 보정 전\n${usageLine(usage)}\n${resolve(options.out, 'hud.json')}\n${html}`);
  return 0;
}
