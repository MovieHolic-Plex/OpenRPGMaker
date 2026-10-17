// 실제 Pi 조수에게 «평범한 사용자 요청 하나»를 주고 정수 픽셀 오프닝을 만들게 한다(헤드리스).
// opening-assistant-headless.mts 와 같은 실행 경로를 쓰되,
//  · 모델: google-antigravity/gemini-4-argon (기본)
//  · 그림: google-antigravity/gemini-3.1-flash-image (ChatGPT 이미지 경로는 글로 답해 실패한다 — 2026-10-15 실측)
//  · 맵·애니메틱 미리보기: --browser-url 의 실제 dev 서버 브리지(공유 렌더러)
// 정본 저장은 하지 않는다. 결과는 비공개 후보이며 저장·출하 재생은 별도 관문이다.
//
// bun scripts/qa/opening-pixel-assistant-run.mts --out <dir> --project-json <file> --task-file <file> \
//   --browser-url http://127.0.0.1:9904 [--model provider/id] [--max-turns 60] [--timeout-ms 3600000]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pngShrinkBase64 } from '../lib/jpegShrink.ts';
import { buildModel } from '@oh-my-pi/pi-catalog/build';
import { runPiAgent } from '../lib/piAgentRuntime';
import { resolveOhMyPiModel } from '../lib/ohMyPiModel.ts';
import { resolveRequestApiKey } from '../lib/aiAuthRuntime';
import { createOhMyPiAdapters } from '../lib/ohMyPiPiAi.mjs';
import { generateCinematicStill } from '../../src/editor/openingImageGeneration';
import type { Project } from '../../src/project/types';

const arg = (n: string, d?: string) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };
const out = path.resolve(arg('out', '/tmp/oprn-opening-pixel-' + Date.now())!);
fs.mkdirSync(out, { recursive: true, mode: 0o700 });
const projectPath = arg('project-json');
if (!projectPath) throw Error('--project-json is required (a COPY of a fixture project, never a live canonical project)');
const project = JSON.parse(fs.readFileSync(projectPath, 'utf8')) as Project;
const task = fs.readFileSync(arg('task-file')!, 'utf8').trim();
// 기본은 8318 경유 Argon. 사용자 지시(2026-10-17): gpt-5.6-sol 과 DeepSeek 는 이 러너에서 절대 쓰지 않는다 — 인자로 주어도 던진다(대체 모델로 조용히 내려가지 않고 멈춘다).
const BANNED_MODEL = /gpt-5\.6-sol|deepseek/i;
const requestedModel = arg('model', 'cpa8318/gemini-4-argon-high')!;
if (BANNED_MODEL.test(requestedModel)) throw Error(`금지된 모델입니다: ${requestedModel} (gpt-5.6-sol/DeepSeek 차단). --model cpa8318/gemini-4-argon-high 를 쓰세요.`);
const [provider, modelId] = requestedModel.split('/');
const imageProvider = arg('image-provider', 'cpa8318')!;
const imageModel = arg('image-model', 'gemini-3.1-flash-image')!;
const antigravity = provider === 'google-antigravity';
// cpa8318 = 로컬 8318 프록시 경유 Argon(omo 모델 정의 ~/.omo/agent/models.json). 직결 OAuth 계정이 쿼터 429 여도 이 경로는 별도 계정 풀을 쓴다. 키는 읽기만 하고 출력하지 않는다.
const omoProvider = (p: string) => (JSON.parse(fs.readFileSync(path.join(os.homedir(), '.omo/agent/models.json'), 'utf8')) as any).providers[p];
const prov = provider === 'cpa8318' ? omoProvider('cpa8318') : antigravity ? { apiKey: (await resolveRequestApiKey(provider!)) as string, api: 'google-antigravity' } : (Bun.YAML.parse(fs.readFileSync(path.join(os.homedir(), '.omp/agent/models.yml'), 'utf8')) as any).providers[provider!];
let model: any;
if (antigravity) model = resolveOhMyPiModel(provider!, modelId!);
else {
  const listed = prov?.models?.find((m: any) => m.id === modelId);
  if (!listed || !prov?.apiKey) throw Error('모델/키를 찾지 못했습니다');
  model = buildModel({ id: modelId, name: modelId, api: prov.api, provider, baseUrl: prov.baseUrl, reasoning: listed.reasoning, thinking: listed.thinking, input: listed.input, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: listed.contextWindow, maxTokens: listed.maxTokens, compat: { ...prov.compat, ...listed.compat } } as never);
}
const providerApiKeys: Record<string, string | undefined> = { [provider!]: prov.apiKey };
for (const p of [imageProvider, 'openai-codex', 'google-antigravity']) { try { providerApiKeys[p] ??= (await resolveRequestApiKey(p)) as string | undefined; } catch { /* absent */ } }
if (antigravity) setInterval(async () => { try { const k = (await resolveRequestApiKey(provider!)) as string | undefined; if (k) providerApiKeys[provider!] = k; } catch { /* next tick */ } }, 30000).unref();

const log: unknown[] = [];
const t0 = Date.now();
const ARG_LOGGED = /^(set_opening|edit_opening|create_opening_animatic_shot|upsert_opening_layer|set_opening_pixel_grid|set_opening_region_loop|upsert_opening_light_fx|upsert_opening_emote|set_opening_caption|apply_opening_walk|place_opening_charset_actor|animate_opening_layer|animate_opening_camera|set_opening_transition|generate_opening_image|generate_opening_layer|preview_opening_animatic|review_opening|plan_opening|author_pixel_art|retime_opening_shot|remove_opening_layer|upsert_opening_audio_cue)$/;
const note = (e: any) => {
  const row: Record<string, unknown> = { t: Math.round((Date.now() - t0) / 1000), type: e.type, name: e.name, ok: e.ok, summary: String(e.summary ?? e.text ?? e.message ?? '').slice(0, 400) };
  if (e.type === 'tool_start' && ARG_LOGGED.test(String(e.name))) row.args = JSON.parse(JSON.stringify(e.args ?? {}).slice(0, 12000));
  if (e.type === 'tool_end' && e.name === 'generate_opening_image') row.image = String(JSON.stringify(e.data ?? {})).slice(0, 200);
  if (e.visuals?.length) row.visuals = e.visuals.map((v: any) => ({ title: v.title, caption: v.caption }));
  if (['assistant', 'error', 'execution_status', 'tool_start', 'tool_end', 'turn'].includes(e.type)) {
    log.push(row);
    fs.writeFileSync(path.join(out, 'activity.json'), JSON.stringify(log, null, 1));
    if (e.type !== 'execution_status') console.log(`[${row.t}s] ${row.type} ${row.name ?? ''} ${String(row.summary).slice(0, 150)}`);
  }
  if (e.type === 'tool_end' && e.visuals) for (const [i, v] of e.visuals.entries()) if (v.uploaded?.startsWith('data:')) fs.writeFileSync(path.join(out, `view-${String(e.id).slice(-8)}-${i}-${String(v.caption).slice(0, 40)}.png`), Buffer.from(v.uploaded.split(',')[1], 'base64'));
};
// 열람(for previews)은 원본 크기가 클 수 있다 — 실제 브라우저 렌더러가 그린 PNG 만 줄여서 돌려준다.
const origin = arg('browser-url');
let bridgePort = 0; let bridge: ReturnType<typeof spawn> | undefined;
if (origin) {
  bridge = spawn('node', [path.resolve('scripts/qa/opening-assistant-browser-bridge.mjs'), origin], { stdio: ['ignore', 'pipe', 'ignore'] });
  bridgePort = await new Promise<number>((resolve, reject) => { let acc = ''; const t = setTimeout(() => reject(Error('bridge timeout')), 300000); bridge!.stdout!.on('data', c => { acc += c; const l = acc.split('\n').find(x => x.startsWith('{"ready":')); if (l) { clearTimeout(t); resolve(JSON.parse(l).port); } }); });
}
const adapters = await createOhMyPiAdapters();
// --image-provider cpa8318 = 8318 프록시의 /v1/chat/completions 이미지 모델(응답 message.images[0].image_url.url). 직결 OAuth 계정 쿼터와 무관하다.
const genImage8318 = async (req: { prompt: string }) => {
  const p = omoProvider('cpa8318');
  const res = await fetch(`${p.baseUrl}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${p.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: imageModel, messages: [{ role: 'user', content: req.prompt }], max_tokens: 2000 }) });
  if (!res.ok) throw new Error(`8318 image ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const j = await res.json() as any;
  const url: string | undefined = j?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  const m = /^data:(image\/[a-z+.-]+);base64,/i.exec(url ?? '');
  if (!url || !m) throw new Error('8318 image: 응답에 그림이 없습니다');
  return { dataUrl: url, mimeType: m[1]!, model: imageModel, provider: 'cpa8318' };
};
const genImage = async (req: { prompt: string; signal?: AbortSignal }) => {
  for (let a = 0; ; a++) {
    try { if (imageProvider === 'cpa8318') return await genImage8318(req); const r = await adapters.generateImage(imageProvider, { prompt: req.prompt, model: imageModel }); return { dataUrl: `data:image/png;base64,${r.base64}`, mimeType: 'image/png', model: imageModel, provider: imageProvider }; }
    catch (e) { console.log('image retry', a + 1, String(e).slice(0, 160)); if (a >= 3) throw e; await new Promise(r => setTimeout(r, 5000 * (a + 1))); }
  }
};
const initialToolNames = [
  'find_tools', 'get_opening', 'list_opening_media', 'get_title_screen', 'show_title_opening', 'review_opening', 'plan_opening', 'set_opening', 'edit_opening',
  'generate_opening_image', 'generate_opening_layer', 'get_opening_direction', 'get_animatic_capabilities', 'create_opening_animatic_shot', 'upsert_opening_layer',
  'remove_opening_layer', 'animate_opening_layer', 'animate_opening_camera', 'set_opening_transition', 'upsert_opening_audio_cue', 'inspect_opening_timeline',
  'preview_opening_animatic', 'upsert_opening_light_fx', 'upsert_opening_emote', 'set_opening_caption', 'set_opening_pixel_grid', 'set_opening_region_loop',
  'apply_opening_walk', 'place_opening_charset_actor', 'set_opening_sprite_states', 'retime_opening_shot', 'list_resources', 'get_project_summary', 'show_opening_image', 'show_map_region', 'author_pixel_art',
];
let live = project;
const request = { provider: provider!, model: modelId!, task, mapIds: [], scopeStrict: false, project, maxTurns: Number(arg('max-turns', '60')), thinkingLevel: (arg('thinking', 'high') as 'high'),
  imageProvider, imageModel, initialToolNames };
const done = await runPiAgent(request as never, {
  model: model as never, apiKey: prov.apiKey, providerApiKeys, timeoutMs: Number(arg('timeout-ms', '3600000')),
  generateOpeningImage: (p: Project, args: Record<string, unknown>, signal?: AbortSignal) => generateCinematicStill(args, 'opening', { signal, generateImage: genImage as never, resolveReference: async (id: string) => { const u = p.assets.uploaded[id]?.dataUrl; if (!u?.startsWith('data:image')) throw new Error('참고 그림을 읽을 수 없습니다: ' + id); return u; } }),
  renderToolImage: async (p: Project, name: string, data: any) => {
    // 캐릭터 칩 검색 미리보기도 실제 그림이어야 한다 — 이 분기가 없어 run-2 의 list_resources 3회가
    // «그림 데이터를 찾을 수 없습니다: undefined» 로 죽었다(2026-10-16). 브라우저 다리가 편집기와 같은
    // renderPiToolImage 를 부른다(칩 시트 로드 + drawCharsetPreview).
    if (bridgePort && (data?.charsetCandidates?.length ?? 0) > 0) {
      const r = await fetch(`http://127.0.0.1:${bridgePort}/toolimage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project: p, toolName: name, data }) });
      const j = await r.json() as { png?: string; error?: string };
      if (!r.ok || !j.png) throw new Error(j.error ?? '브라우저 캐릭터칩 렌더 실패');
      return await pngShrinkBase64(Buffer.from(j.png, 'base64'), 640);
    }
    if (bridgePort && ['show_map_region', 'inspect_interior_layout', 'preview_opening_animatic', 'preview_opening_reference'].includes(name)) {
      const r = await fetch(`http://127.0.0.1:${bridgePort}/render`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project: p, toolName: name, data }) });
      const j = await r.json() as { png?: string; error?: string };
      if (!r.ok || !j.png) throw new Error(j.error ?? '브라우저 렌더 실패');
      return await pngShrinkBase64(Buffer.from(j.png, 'base64'), 640);
    }
    const id = data?.resourceId as string | undefined; let url = id ? p.assets.uploaded[id]?.dataUrl : undefined;
    if (!url && id) {
      const { resolveAssetResourceUrl } = await import('../../src/assets/generatedAssetResourceResolver');
      const u = resolveAssetResourceUrl(id, { project: p }); const rel = u?.startsWith('/') ? u.split('?')[0]! : undefined;
      const file = rel ? path.join(process.cwd(), 'public', rel) : undefined;
      if (file && fs.existsSync(file) && /\.(png|jpe?g|webp)$/iu.test(file)) return await pngShrinkBase64(fs.readFileSync(file), 512);
    }
    if (!url?.startsWith('data:image')) throw new Error('그림 데이터를 찾을 수 없습니다: ' + id);
    return await pngShrinkBase64(Buffer.from(url.split(',')[1]!, 'base64'), 512);
  },
  onEvent: note,
  measureToolRender: async (p: Project, name: string, data: any) => {
    if (!bridgePort || name !== 'preview_opening_animatic') return null;
    const r = await fetch(`http://127.0.0.1:${bridgePort}/measure`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project: p, data }) });
    const j = await r.json() as { measurements?: { atMs: number; paletteColors: number; captionBandContrast: number | null; movingRatio: number }[]; error?: string };
    if (!r.ok || !j.measurements?.length) return null;
    const rows = j.measurements.map(m => `${Math.round(m.atMs)}ms: 팔레트 ${m.paletteColors}색 · 자막바 대비 ${m.captionBandContrast ?? '없음'} · 움직이는 화소 ${(m.movingRatio * 100).toFixed(1)}%`);
    const worst = j.measurements.reduce((a, b) => (b.paletteColors > a.paletteColors ? b : a));
    return `렌더 측정(실제 프레임): ${rows.join(' / ')}. 최대 팔레트 ${worst.paletteColors}색(격자 무대는 한 팔레트로 내려가야 합니다 — 48색을 넘으면 샷이 다른 화풍입니다). 자막바 대비가 4.5:1 미만이면 바 위 글자가 읽히지 않고, 움직이는 화소가 1% 미만이면 정지 그림 + 효과입니다. 이 수치를 보고 샷을 고친 뒤 다시 preview_opening_animatic 하세요.`;
  },
  onToolCall: (r: any) => { fs.appendFileSync(path.join(out, 'calls.log'), `${r.name} ${r.ok}\n`); },
} as never);
live = done.project;
fs.writeFileSync(path.join(out, 'project.json'), JSON.stringify(live));
fs.writeFileSync(path.join(out, 'SUMMARY.json'), JSON.stringify({ task, provider, model: modelId, imageProvider, imageModel, stats: done.stats, issues: done.openingProduction?.issues, stoppedEarly: done.stoppedEarly, finalText: (done as any).text ?? (done as any).finalMessage }, null, 1));
console.log('DONE', out, JSON.stringify(done.stats), done.openingProduction?.issues);
bridge?.kill('SIGTERM');
process.exit(0);
