// space-craft 3·4단계 — 그림 판정자와 판정자 보정.
//
// 판정: measure 가 그린 맵 그림을 확대해 비전 모델에 보여 주고, 요청 문장·필수 물건 목록·고정 루브릭으로 점수를 받는다.
// 보정(--calibrate): 같은 맵을 기계적으로 망가뜨린 사본(가구 빼기·가구 층 밀기)을 함께 보여 주고, 판정자가 원본을
// 더 높게 매기는지 잰다. 이걸 못 하는 판정자는 믿지 않는다 — 점수는 사람 판정과 맞춰 본 뒤에만 근거로 쓴다.
//
//   bun src/harnesses/space-craft/node/judge.mts --out <실행 폴더> [--case a,b] [--judges gpt,gemini] [--calibrate]
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { loadHeadlessProject } from '../../../headless/index';
import { renderMapPng } from '../../../../scripts/qa-game/render.mts';
import { store } from '../../../project/store';
import { completeProvider } from '../../../../scripts/lib/ohMyPiPiAiRuntime.ts';
import { resolveRequestApiKey } from '../../../../scripts/lib/aiAuthRuntime.ts';
import type { GameMap, Project } from '../../../project/types';

const args = process.argv.slice(2);
const option = (name: string) => { const i = args.indexOf(`--${name}`); return i < 0 ? undefined : args[i + 1]; };
const root = resolve(option('out') ?? '');
const chosen = option('case')?.split(',');
const calibrate = args.includes('--calibrate');
const seed = JSON.parse(readFileSync(resolve('harness-data/space-craft/seed.json'), 'utf8'));

/** 판정자 — 사용자 결정(2026-10-07): 그림 판정은 gpt-6.1-sol medium. Gemini 는 교차 확인용. */
const JUDGES: Record<string, { provider: string; model: string }> = {
  gpt: { provider: 'openai-codex', model: 'gpt-6.1-sol' },
  gemini: { provider: 'google-antigravity', model: 'gemini-3.8-flash' },
};
const judgeIds = (option('judges') ?? 'gpt').split(',').filter(id => JUDGES[id]);

const readProject = (file: string): Project => {
  const text = existsSync(file) ? readFileSync(file, 'utf8') : gunzipSync(readFileSync(`${file}.gz`)).toString('utf8');
  try { return loadHeadlessProject(text); } catch { return JSON.parse(text) as Project; }
};

/** 픽셀이 뭉개지지 않게 정수배로 키운다 — 긴 변 약 1100px. */
function renderForJudge(project: Project, map: GameMap): Buffer {
  const tile = project.tilesets[map.tilesetId]?.tileSize ?? 16;
  const scale = Math.max(1, Math.min(4, Math.floor(1100 / (Math.max(map.width, map.height) * tile))));
  return renderMapPng(project, map, scale).png;
}

/** 망가뜨린 사본. 정답이 분명한 비교만 만든다 — 판정자가 이것도 못 가르면 미감 점수는 의미가 없다. */
function degrade(map: GameMap, kind: 'stripped' | 'shifted'): GameMap {
  const layers = ['upperTiles', 'upperOverlayTiles', 'lowerOverlayTiles'] as const;
  const copy = { ...map } as GameMap & Record<string, unknown>;
  for (const key of layers) {
    const source = (map as unknown as Record<string, number[] | undefined>)[key];
    if (!Array.isArray(source)) continue;
    if (kind === 'stripped') { copy[key] = source.map(() => -1); continue; }
    // 가구 층만 오른쪽 3·아래 2칸 민다 — 가구가 벽에 박히고 문이 막힌다.
    const out = source.map(() => -1);
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
      const nx = x + 3, ny = y + 2;
      if (nx < map.width && ny < map.height) out[ny * map.width + nx] = source[y * map.width + x]!;
    }
    copy[key] = out;
  }
  return copy;
}

// 판정자는 「종합 점수」를 매기지 않는다 — 보정 1회차(2026-10-07): 벽난로·선반·액자가 벽에서 떨어져 바닥 한가운데 선
// 사본에 두 판정자 모두 원본과 같은 3점을 줬다(글로는 문제를 적으면서도). 그래서 구체적인 예/아니오를 먼저 묻고,
// 종합은 코드가 규칙으로 낸다(overallFrom).
// 보정 2회차: gpt 판정자가 칸막이에 건 방패·옆벽에 기댄 책장·화면 끝에 닿은 출입 계단을 위반으로 봐서 두 판정자가 2점 대 5점으로
// 갈렸다 — 벽·출입구 규칙을 구체적으로 적었다.
const RUBRIC = `너는 16px 탑뷰 JRPG 실내 맵을 검수하는 까다로운 미술 감독이다. 그림 한 장을 보고 아래 JSON 하나만 답한다. 다른 글은 쓰지 않는다.
먼저 구조 검사(각각 true/false + 위반이면 어디가 무엇인지):
- wallItemsOnWall: 벽에 걸거나 붙는 것(벽난로·벽 선반·액자·창문·벽시계·무기 걸이·방패 장식)이 벽면(바깥벽이든 방 사이 칸막이든)에 붙어 있다. 바닥 한가운데 홀로 선 벽난로·벽 선반·액자·창문만 위반이다. 책장·옷장처럼 바닥에 서는 큰 가구가 옆벽에 기대 있는 것은 정상이다.
- insideRoom: 모든 가구·물건이 방 안에 있다. 외벽·칸막이에 겹치거나 방 밖(검은 곳)으로 튀어나온 것이 있으면 위반이다.
- wholeObjects: 잘리거나 반쪽만 보이는 가구·계단이 없다. 맨 아래 출입구에서 밖으로 이어지는 길·계단이 그림 끝에 닿는 것은 정상이다.
- clearPaths: 문·계단·출입구 앞이 가구로 막히지 않았다.
- fitsMap: 방이 맵을 채운다. 큰 빈 공간(검은 곳) 구석에 작은 방이 있으면 위반이다.
- emptiness: 빈 바닥의 정도 "none"|"some"|"large"(large = 화면의 3분의 1 이상이 아무것도 없는 바닥).
items: 필수 물건마다 실제로 알아볼 수 있게 보이는지와 대략 위치(「왼쪽 위」처럼).
그다음 느낌 점수(1~5): layout(구역·동선·가구 묶음), style(화풍·시점이 한 세트인가, 같은 물건의 기계적 반복이 없는가), genre(요청 세계관이 느껴지는가).
형식: {"checks":{"wallItemsOnWall":{"ok":true,"where":""},"insideRoom":{"ok":true,"where":""},"wholeObjects":{"ok":true,"where":""},"clearPaths":{"ok":true,"where":""},"fitsMap":{"ok":true,"where":""}},"emptiness":"none","items":[{"name":"","present":true,"where":""}],"feel":{"layout":0,"style":0,"genre":0},"defects":[""],"summary":"한 문장"}`;

type Verdict = { checks?: Record<string, { ok?: boolean }>; emptiness?: string; items?: { present?: boolean }[]; feel?: Record<string, number> };
/** 규칙 종합(1~5). 구조 위반·필수 물건 누락은 느낌 점수로 덮지 못한다. */
function overallFrom(v: Verdict | null): { overall: number; caps: string[] } | null {
  if (!v || !v.checks || !v.feel) return null;
  const caps: string[] = [];
  let cap = 5;
  const broken = Object.entries(v.checks).filter(([, c]) => c?.ok === false).map(([k]) => k);
  if (broken.some(k => k === 'wallItemsOnWall' || k === 'insideRoom' || k === 'wholeObjects')) { cap = Math.min(cap, 2); caps.push(`구조 위반 ${broken.join(',')}`); }
  else if (broken.length) { cap = Math.min(cap, 3); caps.push(`배치 위반 ${broken.join(',')}`); }
  const missing = (v.items ?? []).filter(i => i.present === false).length;
  if (missing >= 2) { cap = Math.min(cap, 2); caps.push(`필수 물건 ${missing}개 없음`); }
  else if (missing === 1) { cap = Math.min(cap, 3); caps.push('필수 물건 1개 없음'); }
  if (v.emptiness === 'large') { cap = Math.min(cap, 3); caps.push('빈 바닥 넓음'); }
  const feel = Object.values(v.feel).filter(n => typeof n === 'number');
  const mean = feel.length ? feel.reduce((a, n) => a + n, 0) / feel.length : 0;
  return { overall: Math.round(Math.min(cap, mean) * 10) / 10, caps };
}

async function askJudge(judgeId: string, request: string, requires: readonly string[], png: Buffer) {
  const judge = JUDGES[judgeId]!;
  const apiKey = await resolveRequestApiKey(judge.provider);
  const started = Date.now();
  const { completion } = await completeProvider(judge.provider, {
    model: judge.model,
    reasoning: { effort: 'medium' },
    messages: [
      { role: 'system', content: RUBRIC },
      { role: 'user', content: [
        { type: 'text', text: `요청: ${request}\n필수 물건: ${requires.join(', ')}` },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${png.toString('base64')}` } },
      ] },
    ],
  }, { apiKey: apiKey as string | undefined }) as { completion: { choices: { message: { content: string | null } }[] } };
  const text = completion.choices[0]?.message.content ?? '';
  const match = text.match(/\{[\s\S]*\}/);
  let parsed: Record<string, unknown> | null = null;
  try { parsed = match ? JSON.parse(match[0]) : null; } catch { parsed = null; }
  return { judge: judgeId, model: judge.model, ms: Date.now() - started, parsed, score: overallFrom(parsed as Verdict | null), raw: parsed ? undefined : text.slice(0, 600) };
}

const attempts = readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory() && existsSync(resolve(root, d.name, 'measure.json')))
  .map(d => d.name).filter(name => !chosen || chosen.some(id => name === id || name.startsWith(`${id}-r`))).sort();
for (const attempt of attempts) {
  const dir = resolve(root, attempt);
  const measure = JSON.parse(readFileSync(resolve(dir, 'measure.json'), 'utf8'));
  if (!measure.maps?.length) { console.log(`${attempt}: 맵 없음 — 판정 안 함`); continue; }
  const caseDef = seed.cases.find((c: { id: string }) => c.id === measure.caseId);
  const project = readProject(resolve(dir, 'live.json'));
  store.replaceProject(project);
  const current = store.getCurrent();
  const out: Record<string, unknown>[] = [];
  for (const entry of measure.maps as { mapId: string }[]) {
    const map = current.maps[entry.mapId];
    if (!map) continue;
    const variants: { kind: string; png: Buffer }[] = [{ kind: 'original', png: renderForJudge(current, map) }];
    if (calibrate) for (const kind of ['stripped', 'shifted'] as const) variants.push({ kind, png: renderForJudge(current, degrade(map, kind)) });
    for (const variant of variants) writeFileSync(resolve(dir, 'render', `${entry.mapId}.judge-${variant.kind}.png`), variant.png);
    const verdicts = await Promise.all(variants.flatMap(variant => judgeIds.map(async judgeId => ({
      variant: variant.kind, ...(await askJudge(judgeId, caseDef.prompt, caseDef.requires ?? [], variant.png).catch((error: Error) => ({ judge: judgeId, error: error.message }))),
    }))));
    out.push({ mapId: entry.mapId, images: variants.map(v => `render/${entry.mapId}.judge-${v.kind}.png`), verdicts });
    const line = verdicts.map(v => `${v.judge}/${v.variant}=${(v as { score?: { overall: number } | null }).score?.overall ?? (v as { error?: string }).error?.slice(0, 40) ?? '?'}`).join(' ');
    console.log(`${attempt} ${entry.mapId}: ${line}`);
  }
  writeFileSync(resolve(dir, 'judge.json'), JSON.stringify({ schemaVersion: 1, attempt, caseId: measure.caseId, judgedAt: new Date().toISOString(), judges: judgeIds, calibrate, maps: out }, null, 2));
}
