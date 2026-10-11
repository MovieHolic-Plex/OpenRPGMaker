// 실제 경로 시연: 구조화 프롬프트(generateCinematicStill) → 후보 3장 병렬 생성 → 독립 판정자 선택. 결과는 viz 폴더에 남긴다.
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createOhMyPiAdapters, stopOhMyPiWorker } from '../lib/ohMyPiPiAi.mjs';
import { generateCinematicStill } from '../../src/editor/openingImageGeneration';
import { generateBestStill } from '../lib/openingStillCritic.ts';
import { PiOpeningProduction } from '../../src/ai/piAgent/openingProduction';

const out = resolve(process.argv[2] ?? `${process.env.HOME}/claude-viz/opening-critic`);
const bible = { premise: '별등 군도의 북쪽 등대가 꺼지고, 작은 천산갑이 마지막 불씨를 지킨다', question: '등대지기는 어디로 갔는가', motifs: ['금 간 별등', '불씨 하나'], palette: 'deep ink blue, bruised violet, one warm amber ember as the only warm accent, bone-white highlights',
  artStyle: '16-bit SNES-era JRPG pixel-art cutscene illustration: clearly visible square pixels, limited 32-colour palette, hand-placed dithering on gradients, crisp 1px outlines, no smooth anti-aliased gradients', voice: 'v' };
const production = new PiOpeningProduction(true, '오프닝');
production.record('plan_opening', true, {} as never, { shots: [{}, {}], bible });
const SHOTS = [
  { id: 'wide', shot: 'wide', prompt: 'The northern lighthouse of a star-lantern archipelago has just gone dark; the lamp still smokes and the island chain below loses its guiding light', focus: 'the dead lamp in the lantern room, a thread of smoke rising, one cracked glass pane', angle: 'low angle from the gallery rail looking up and across the dark sea', light: 'cold moonlight from the upper left, the only warm light is a distant island window', cast: 'nobody' },
  { id: 'medium', shot: 'medium', prompt: "In the keeper's cabin a small armoured pangolin guards a glowing ember jar while the keeper is missing", focus: 'the pangolin curled protectively around the jar, ember reflected on its scales', angle: 'over-the-shoulder from the doorway, the open door frames the scene', light: 'the ember jar is the key light, spilling orange across the floorboards; the room beyond is near-black', cast: 'one small armoured pangolin on all fours, no humans' },
];
const adapters = await createOhMyPiAdapters();
await mkdir(out, { recursive: true });
const report: unknown[] = [];
for (const s of SHOTS) {
  const args = production.withBible({ ...s });
  const generateImage = async (req: { prompt: string }) => { for (let a = 0; ; a++) { try { const r = await adapters.generateImage('openai-codex', { prompt: req.prompt, model: 'codex-image-default' }); return { dataUrl: `data:image/png;base64,${r.base64}`, mimeType: 'image/png', model: 'codex-image-default', provider: 'openai-codex' }; } catch (e) { if (a >= 3) throw e; } } };
  const result = await generateBestStill(() => generateCinematicStill(args, 'opening', { generateImage: generateImage as never }), 3, production.criticContext(args));
  for (const c of result.candidates) await writeFile(join(out, `${s.id}-${c.id}.png`), Buffer.from((c.still as { dataUrl: string }).dataUrl.split(',')[1]!, 'base64'));
  report.push({ shot: s.id, critique: result.critique, candidates: result.candidates.map(c => c.id) });
  console.log(s.id, result.critique.judge, result.critique.verdict, 'winner', result.critique.winnerId, result.critique.scores.map(x => `${x.id}:${x.total}`).join(' '));
}
await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 1));
stopOhMyPiWorker();
