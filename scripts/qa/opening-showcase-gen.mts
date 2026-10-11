// 개선된 파이프라인으로 6컷 오프닝의 그림을 만든다: 바이블 자동 적용 → 컷당 후보 3장 → 독립 판정자 선택(권고가 regenerate 면 fix 를 넣어 1회 재생성).
// 계획·글은 이 스크립트가 직접 준다(실조수 실행이 아니라 도구 파이프라인 시연). 컷 5는 컷 3의 승자를 참고 그림으로 쓴다.
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createOhMyPiAdapters, stopOhMyPiWorker } from '../lib/ohMyPiPiAi.mjs';
import { generateCinematicStill } from '../../src/editor/openingImageGeneration';
import { generateBestStill } from '../lib/openingStillCritic.ts';
import { PiOpeningProduction } from '../../src/ai/piAgent/openingProduction';

const out = resolve(process.argv[2] ?? `${process.env.HOME}/claude-viz/opening-showcase`);
export const bible = { premise: '별등 군도의 북쪽 등대가 꺼지고, 작은 천산갑이 마지막 불씨를 안고 바다로 나선다', question: '등대지기는 어디로 갔는가', motifs: ['금 간 별등', '불씨 하나'],
  palette: 'deep ink blue, bruised violet, one warm amber ember as the only warm accent, bone-white highlights',
  artStyle: '16-bit SNES-era JRPG pixel-art cutscene illustration: clearly visible square pixels, limited 32-colour palette, hand-placed dithering on gradients, crisp 1px outlines, no smooth anti-aliased gradients', voice: '짧은 과거형. 구체적 명사. 설명하지 않는다.' };
const SHOTS = [
  { id: '1', shot: 'wide', prompt: 'The northern lighthouse of a star-lantern archipelago has gone dark for the first time in memory; the lamp still smokes, and across the black sea a few island lights burn tiny and far apart', focus: 'the dead lamp in the lantern room, a thread of smoke rising, one cracked glass pane', angle: 'low angle from the gallery rail looking up and across the dark sea', light: 'cold moonlight from the upper left, tiny warm island windows far away', cast: 'nobody' },
  { id: '2', shot: 'close-up', prompt: 'A hand holds a cracked star-shaped lantern with one ember left, the fingers trembling', focus: 'the single ember inside the cracked glass', angle: 'tight top-down, the hand entering from the frame bottom-right', light: 'the ember is the only light; skin and glass edges catch rim light', cast: 'only one human hand and forearm, no face, no background figures' },
  { id: '3', shot: 'medium', prompt: "In the keeper's cabin a small armoured pangolin guards a glowing ember jar; a worn leather glove lies dropped near the door and a coat still hangs on its hook, but the keeper is gone", focus: 'the pangolin curled protectively around the jar, ember reflected on its scales', angle: 'over-the-shoulder from the doorway, the open door frames the scene', light: 'the ember jar is the key light, spilling orange across the floorboards; the room beyond is near-black', cast: 'one small armoured pangolin on all fours, no humans' },
  { id: '4', shot: 'wide', prompt: 'The harbor pier at night: every dock lantern post is cold and dark, small boats are moored, and one boat has a mooring rope hanging cut and loose', focus: 'the cut mooring rope and the empty berth beside it', angle: 'high overhead from the cliff above the pier, looking straight down along the planks', light: 'a thin violet-pink dawn line on the horizon is the only light source', cast: 'nobody' },
  { id: '5', shot: 'medium', prompt: 'The small armoured pangolin carries the glowing ember jar on its back along the pier toward a moored boat, leaving a trail of faint ember light on the wet planks', focus: 'the pangolin with the ember jar on its back, small against the long pier', angle: 'low ground-level view from behind and beside the pangolin, long pier receding', light: 'the ember jar is the key light; cold blue moonlight on the water beyond', cast: 'only the one small armoured pangolin, no humans', ref: '3' },
  { id: '6', shot: 'wide', prompt: 'A tiny boat with a single lantern leaves the harbor and sails toward a violet storm island on the horizon; the dark sea ahead has no lights', focus: 'the tiny boat and its single lantern on a vast dark sea', angle: 'high overhead on the harbor cliff, the boat small in the lower third', light: 'a thin violet-pink dawn line on the horizon, lightning inside the distant storm, the boat lantern as accent', cast: 'one small boat carrying one tiny pangolin, nobody else' },
];
const production = new PiOpeningProduction(true, '오프닝');
production.record('plan_opening', true, {} as never, { shots: SHOTS.map(s => ({ angle: s.angle })), bible });
const adapters = await createOhMyPiAdapters();
await mkdir(out, { recursive: true });
const winners = new Map<string, string>();
const report: Record<string, unknown> = {};
const generateImage = async (req: { prompt: string }) => { for (let a = 0; ; a++) { try { const r = await adapters.generateImage('openai-codex', { prompt: req.prompt, model: 'codex-image-default' }); return { dataUrl: `data:image/png;base64,${r.base64}`, mimeType: 'image/png', model: 'codex-image-default', provider: 'openai-codex' }; } catch (e) { if (a >= 3) throw e; } } };
async function make(s: (typeof SHOTS)[number]) {
  let extra = '';
  for (let round = 0; round < 2; round++) {
    const args = production.withBible({ ...s, prompt: s.prompt + extra, ...(s.ref ? { referenceResourceIds: ['ref'] } : {}) });
    const resolveReference = async () => winners.get(s.ref!)!;
    const result = await generateBestStill(() => generateCinematicStill(args, 'opening', { generateImage: generateImage as never, resolveReference }), 3, production.criticContext(args));
    for (const c of result.candidates) await writeFile(join(out, `shot${s.id}-r${round}-${c.id}.png`), Buffer.from((c.still as { dataUrl: string }).dataUrl.split(',')[1]!, 'base64'));
    const win = (result.still as { dataUrl: string }).dataUrl;
    report[s.id] = { round, critique: result.critique, prompt: args.prompt };
    console.log('shot', s.id, 'round', round, result.critique.verdict, 'winner', result.critique.winnerId, result.critique.scores.map(x => `${x.id}:${x.total}`).join(' '));
    winners.set(s.id, win); await writeFile(join(out, `shot${s.id}.png`), Buffer.from(win.split(',')[1]!, 'base64'));
    if (result.critique.verdict !== 'regenerate') break;
    extra = ` Fix from the art director: ${result.critique.fix}`;
  }
}
const phase1 = SHOTS.filter(s => !s.ref); let next = 0;
await Promise.all(Array.from({ length: 2 }, async () => { while (next < phase1.length) await make(phase1[next++]!); }));
for (const s of SHOTS.filter(s => s.ref)) await make(s);
await writeFile(join(out, 'report.json'), JSON.stringify({ bible, shots: SHOTS, report }, null, 1));
stopOhMyPiWorker();
