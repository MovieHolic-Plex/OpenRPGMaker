// 화풍 문장 후보를 같은 컷·같은 구조화 프롬프트로 견준다(ChatGPT 이미지 경로, 동시 3개).
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createOhMyPiAdapters, stopOhMyPiWorker } from '../lib/ohMyPiPiAi.mjs';
import { buildCinematicStillPrompt } from '../../src/editor/openingImageGeneration';
import { prepareOpeningImageRequest } from '../../src/editor/tools/cinematicTools';

const out = resolve(process.argv[2] ?? `${process.env.HOME}/claude-viz/opening-style-ab`);
const PALETTE = 'deep ink blue, bruised violet, one warm amber ember as the only warm accent, bone-white highlights';
const STYLES: Record<string, string> = {
  pixel: '16-bit SNES-era JRPG pixel-art cutscene illustration: clearly visible square pixels, limited 32-colour palette, hand-placed dithering on gradients, crisp 1px outlines, no smooth anti-aliased gradients, like Chrono Trigger key scenes',
  hd2d: 'HD-2D diorama look as in Octopath Traveler: pixel-art characters and props inside a 3D-lit miniature scene, tilt-shift depth of field, soft bloom and volumetric light',
  gouache: 'hand-painted gouache background art in the manner of classic Japanese 2D animation: flat confident colour shapes, visible dry-brush texture, no outlines, painterly but graphic',
};
const SHOTS = [
  { id: '1', shot: 'wide', prompt: 'The northern lighthouse of a star-lantern archipelago has just gone dark; the lamp still smokes and the island chain below loses its guiding light', focus: 'the dead lamp in the lantern room, a thread of smoke rising, one cracked glass pane', angle: 'low angle from the gallery rail looking up and across the dark sea', light: 'cold moonlight from the upper left, the only warm light is a distant island window', cast: 'nobody' },
  { id: '2', shot: 'medium', prompt: "In the keeper's cabin a small armoured pangolin guards a glowing ember jar while the keeper is missing", focus: 'the pangolin curled protectively around the jar, ember reflected on its scales', angle: 'over-the-shoulder from the doorway, the open door frames the scene', light: 'the ember jar is the key light, spilling orange across the floorboards; the room beyond is near-black', cast: 'one small armoured pangolin on all fours, no humans' },
  { id: '3', shot: 'close-up', prompt: 'A hand holds a cracked star-lantern with one ember left, the fingers trembling', focus: 'the single ember inside the cracked glass', angle: 'tight top-down, hand entering from frame bottom-right', light: 'the ember is the only light; skin and glass edges catch rim light', cast: 'only one human hand and forearm, no face, no background figures' },
];
const adapters = await createOhMyPiAdapters();
await mkdir(out, { recursive: true });
const jobs = Object.entries(STYLES).flatMap(([style, text]) => SHOTS.map(s => ({
  file: `${style}-${s.id}.png`,
  prompt: buildCinematicStillPrompt(s.prompt, 'opening', prepareOpeningImageRequest({ prompt: s.prompt, shot: s.shot, artStyle: text, palette: PALETTE, focus: s.focus, angle: s.angle, light: s.light, cast: s.cast })),
})));
await writeFile(join(out, 'prompts.json'), JSON.stringify(jobs, null, 1));
let next = 0;
await Promise.all(Array.from({ length: 3 }, async () => {
  while (next < jobs.length) {
    const job = jobs[next++];
    for (let attempt = 0; attempt < 4; attempt++) {
      try { const image = await adapters.generateImage('openai-codex', { prompt: job.prompt, model: 'codex-image-default' }); await writeFile(join(out, job.file), Buffer.from(image.base64, 'base64')); console.log('ok', job.file); break; }
      catch (error) { console.log('retry', job.file, String(error).slice(0, 120)); }
    }
  }
}));
stopOhMyPiWorker();
