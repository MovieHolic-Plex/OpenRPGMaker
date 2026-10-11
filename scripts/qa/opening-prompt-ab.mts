// Same story shots, baseline vs structured prompt, through the real image provider. Output goes to a viz folder for human comparison.
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createOhMyPiAdapters, stopOhMyPiWorker } from '../lib/ohMyPiPiAi.mjs';
import { buildCinematicStillPrompt } from '../../src/editor/openingImageGeneration';
import { prepareOpeningImageRequest } from '../../src/editor/tools/cinematicTools';

const out = resolve(process.argv[2] ?? `${process.env.HOME}/claude-viz/opening-prompt-ab`);
const STYLE = 'moody hand-painted pixel-adjacent JRPG illustration, chunky visible brush clusters, hard-edged shadow shapes, ink-dark outlines on the focal subject only';
const PALETTE = 'deep ink blue, bruised violet, warm amber ember as the only warm accent, bone-white highlights';

/** Verbatim copy of the pre-change builder, so the comparison does not depend on git state. */
function baseline(prompt: string, shot: string): string {
  const composition = shot === 'close-up' ? 'a close-up, emphasizing the important face, object or incident'
    : shot === 'medium' ? 'a medium shot that clearly shows the characters and their immediate surroundings'
    : 'a wide establishing shot with clear foreground, middle ground and background';
  return [
    'Create exactly one full-screen, 16:9 cinematic background still for the opening sequence of a 2D JRPG.',
    'Scene brief: ' + JSON.stringify(prompt) + '.',
    `Fill the entire canvas with the scene. Compose it as ${composition}. Honor the requested shot distance, viewpoint and composition: an establishing shot, medium shot and close-up must look visibly different. Keep the lower 18 percent calm enough that a narration box at the bottom stays readable.`,
    'Render it as hand-painted 2D game art with coherent lighting and restrained detail. Avoid photographic rendering and 3D-rendered surfaces.',
    'Do not add any text, letters, captions, logos, watermarks, signatures, interface elements, borders, letterboxing bars or icon-style framing. Do not return a sprite sheet, an item icon or a character portrait on a flat background.',
  ].join('\n\n');
}

const SHOTS = [
  { id: '1-wide', shot: 'wide', prompt: 'The northern lighthouse of a star-lantern archipelago has just gone dark; the lamp still smokes and the island chain below loses its guiding light', focus: 'the dead lamp in the lantern room, a thread of smoke rising, one cracked glass pane', angle: 'low angle from the gallery rail looking up and across the dark sea', light: 'cold moonlight from the upper left, the only warm light is a distant far-off island window' },
  { id: '2-medium', shot: 'medium', prompt: 'In the keeper\'s cabin a small armoured pangolin guards a glowing ember jar while the keeper is missing', focus: 'the pangolin curled protectively around the jar, ember reflected on its scales', angle: 'over-the-shoulder from the doorway, the open door frames the scene', light: 'the ember jar is the key light, spilling orange across the floorboards; the room beyond is near-black' },
  { id: '3-close', shot: 'close-up', prompt: 'A hand holds a cracked star-lantern with one ember left, the fingers trembling', focus: 'the single ember inside the cracked glass', angle: 'tight top-down, hand entering from frame bottom-right', light: 'ember is the only light; skin and glass edges catch rim light' },
  { id: '4-wide', shot: 'wide', prompt: 'A small boat leaves the harbor at dawn, following the last line of lights toward a violet storm island', focus: 'the tiny boat and its single lantern on a vast dark sea', angle: 'high overhead on the harbor cliff, boat small in the lower third', light: 'a thin violet-pink dawn line on the horizon, the boat lantern as accent' },
];

const adapters = await createOhMyPiAdapters();
await mkdir(out, { recursive: true });
const jobs = SHOTS.flatMap(s => {
  const brief = prepareOpeningImageRequest({ prompt: s.prompt, shot: s.shot, artStyle: STYLE, palette: PALETTE, focus: s.focus, angle: s.angle, light: s.light, captionSide: 'bottom' });
  return [
    { file: `${s.id}-before.png`, prompt: baseline(s.prompt, s.shot) },
    { file: `${s.id}-after.png`, prompt: buildCinematicStillPrompt(s.prompt, 'opening', brief) },
  ];
});
await writeFile(join(out, 'prompts.json'), JSON.stringify(jobs, null, 1));
await Promise.all(jobs.map(async job => {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const image = await adapters.generateImage('google-antigravity', { prompt: job.prompt, model: 'gemini-3.1-flash-image' });
      await writeFile(join(out, job.file), Buffer.from(image.base64, 'base64')); console.log('ok', job.file); return;
    } catch (error) { console.log('retry', job.file, String(error).slice(0, 200)); }
  }
  console.log('FAILED', job.file);
}));
stopOhMyPiWorker();
