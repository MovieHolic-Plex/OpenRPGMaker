// 실제 조수(Pi + LLM)에게 평범한 사용자 요청 하나를 주고 오프닝·타이틀을 만들게 한다(브라우저 없이).
// 이미지는 조수 도구가 ChatGPT 이미지 경로로 직접 만들고, 그림 열람(show_*)은 리소스 PNG를 줄여 돌려준다.
// bun scripts/qa/opening-assistant-headless.mts --out <dir> --task "..." [--model opencodex/gpt-6-astra] [--project-json f]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Jimp from 'jimp';
import { spawn } from 'node:child_process';
import { buildModel } from '@oh-my-pi/pi-catalog/build';
import { runPiAgent } from '../lib/piAgentRuntime';
import { resolveRequestApiKey } from '../lib/aiAuthRuntime';
import { createOhMyPiAdapters } from '../lib/ohMyPiPiAi.mjs';
import { generateCinematicStill } from '../../src/editor/openingImageGeneration';
import type { Project } from '../../src/project/types';
import { createBlankProject } from '../../src/project/defaults/blankProject';
const arg = (n: string, d?: string) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };
const out = path.resolve(arg('out', '/tmp/oprn-opening-headless-' + Date.now())!); fs.mkdirSync(out, { recursive: true });
const project = (arg('project-json') ? JSON.parse(fs.readFileSync(arg('project-json')!, 'utf8')) : createBlankProject()) as Project;
const task = arg('task')!;
const [provider, modelId] = arg('model', 'opencodex/gpt-6-astra')!.split('/');
const cfg = Bun.YAML.parse(fs.readFileSync(path.join(os.homedir(), '.omp/agent/models.yml'), 'utf8')) as any;
const prov = (cfg.providers ?? cfg)[provider!];
const like = arg('model-like');
const listed = prov?.models?.find((m: any) => m.id === (prov.models.some((m: any) => m.id === modelId) ? modelId : like));
if (!listed || !prov?.apiKey) throw Error('모델/키를 models.yml에서 찾지 못했습니다');
const md = { ...listed, id: modelId, name: listed.id === modelId ? listed.name : modelId };
const model = buildModel({ id: md.id, name: md.name, api: prov.api, provider, baseUrl: prov.baseUrl, reasoning: md.reasoning, thinking: md.thinking, input: md.input, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: md.contextWindow, maxTokens: md.maxTokens, compat: { ...prov.compat, ...md.compat } } as never);
const imageProvider = arg('image-provider', 'openai-codex')!, imageModel = arg('image-model', 'codex-image-default')!;
const providerApiKeys: Record<string, string | undefined> = { [provider!]: prov.apiKey };
for (const p of [imageProvider, 'google-antigravity', 'openai-codex']) { try { providerApiKeys[p] ??= (await resolveRequestApiKey(p)) as string | undefined; } catch { /* absent */ } }
const log: unknown[] = [];
const t0 = Date.now();
const note = (e: any) => {
  const row = { t: Math.round((Date.now() - t0) / 1000), type: e.type, name: e.name, ok: e.ok, summary: String(e.summary ?? e.text ?? e.message ?? '').slice(0, 300), visuals: e.visuals?.map((v: any) => ({ title: v.title, caption: v.caption })), ...(e.type === 'tool_start' && /^script_cutscene/u.test(String(e.name)) ? { args: e.args } : {}) };
  if (['assistant', 'error', 'execution_status', 'tool_start', 'tool_end'].includes(e.type)) { log.push(row); fs.writeFileSync(path.join(out, 'activity.json'), JSON.stringify(log, null, 1)); console.log(`[${row.t}s] ${row.type} ${row.name ?? ''} ${row.summary.slice(0, 140)}${row.visuals?.length ? ` (그림 ${row.visuals.length}장)` : ''}`); }
  if (e.type === 'tool_end' && e.visuals) for (const [i, v] of e.visuals.entries()) if (v.uploaded?.startsWith('data:')) fs.writeFileSync(path.join(out, `${e.id.slice(-8)}-${i}-${v.caption}.jpg`), Buffer.from(v.uploaded.split(',')[1], 'base64'));
};
let live = project;
const request = { provider: provider!, model: modelId!, task, mapIds: [], scopeStrict: false, project, maxTurns: Number(arg('max-turns', '60')), thinkingLevel: (arg('thinking', 'high') as 'high'), imageProvider, imageModel,
  initialToolNames: ['find_tools', 'get_opening', 'list_opening_media', 'get_title_screen', 'show_title_opening', 'review_opening', 'script_cutscene_staged', 'preview_cutscene', 'read_directing_guide', 'show_map_region'] };
// 맵·애니메틱 미리보기는 실제 브라우저 렌더러(편집기 dev 서버)로 그린다 — --browser-url 이 있을 때만.
const origin = arg('browser-url');
let bridgePort = 0; let bridge: ReturnType<typeof spawn> | undefined;
if (origin) {
  bridge = spawn('node', [path.resolve('scripts/qa/opening-assistant-browser-bridge.mjs'), origin], { stdio: ['ignore', 'pipe', 'ignore'] });
  bridgePort = await new Promise<number>((resolve, reject) => { let acc = ''; const t = setTimeout(() => reject(Error('bridge timeout')), 90000); bridge!.stdout!.on('data', c => { acc += c; const l = acc.split('\n').find(x => x.startsWith('{"ready":')); if (l) { clearTimeout(t); resolve(JSON.parse(l).port); } }); });
}
const adapters = await createOhMyPiAdapters();
const genImage = async (req: { prompt: string }) => { for (let a = 0; ; a++) { try { const r = await adapters.generateImage('openai-codex', { prompt: req.prompt, model: 'codex-image-default' }); return { dataUrl: `data:image/png;base64,${r.base64}`, mimeType: 'image/png', model: 'codex-image-default', provider: 'openai-codex' }; } catch (e) { if (a >= 3) throw e; } } };
const done = await runPiAgent(request as never, {
  model: model as never, apiKey: prov.apiKey, providerApiKeys, timeoutMs: Number(arg('timeout-ms', '3000000')),
  generateOpeningImage: (p: Project, args: Record<string, unknown>) => generateCinematicStill(args, 'opening', { generateImage: genImage as never, resolveReference: async (id: string) => { const u = p.assets.uploaded[id]?.dataUrl; if (!u?.startsWith('data:image')) throw new Error('참고 그림을 읽을 수 없습니다: ' + id); return u; } }),
  renderToolImage: async (p: Project, name: string, data: any) => {
    if (bridgePort && ['show_map_region', 'inspect_interior_layout', 'preview_opening_animatic', 'preview_opening_reference'].includes(name)) {
      const r = await fetch(`http://127.0.0.1:${bridgePort}/render`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project: p, toolName: name, data }) });
      const j = await r.json() as { png?: string; error?: string };
      if (!r.ok || !j.png) throw new Error(j.error ?? '브라우저 렌더 실패');
      const img = await Jimp.read(Buffer.from(j.png, 'base64')); if (img.bitmap.width > 640) img.resize(640, Jimp.AUTO);
      return (await img.getBufferAsync(Jimp.MIME_PNG)).toString('base64');
    }
    const id = data?.resourceId as string | undefined; const url = id ? p.assets.uploaded[id]?.dataUrl : undefined;
    if (!url?.startsWith('data:image')) throw new Error('그림 데이터를 찾을 수 없습니다: ' + id);
    const img = await Jimp.read(Buffer.from(url.split(',')[1]!, 'base64')); if (img.bitmap.width > 512) img.resize(512, Jimp.AUTO);
    return (await img.getBufferAsync(Jimp.MIME_PNG)).toString('base64');
  },
  onEvent: (e: any) => { note(e); },
  onToolCall: (r: any) => { void r; },
} as never);
live = done.project;
fs.writeFileSync(path.join(out, 'project.json'), JSON.stringify(live));
fs.writeFileSync(path.join(out, 'SUMMARY.json'), JSON.stringify({ task, model: arg('model'), stats: done.stats, issues: done.openingProduction?.issues, stoppedEarly: done.stoppedEarly, finalText: (done as any).text ?? (done as any).finalMessage }, null, 1));
console.log('DONE', out, JSON.stringify(done.stats), done.openingProduction?.issues);
bridge?.kill('SIGTERM');
process.exit(0);
