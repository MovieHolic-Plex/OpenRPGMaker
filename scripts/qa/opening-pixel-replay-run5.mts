import fs from 'node:fs';
import type { Project } from '../../src/project/types.ts';
import { runTool } from '../../src/editor/tools/index.ts';

const activity = JSON.parse(fs.readFileSync('/tmp/opening-run-5/assistant/activity.json', 'utf8')) as { type?: string; name?: string; args?: Record<string, unknown> }[];
const initial = JSON.parse(fs.readFileSync('/tmp/opening-run-5/fixture/run5.json', 'utf8')) as Project;
const ctx = { project: initial, assistantRun: true } as never;
const replayable = new Set(['create_opening_animatic_shot', 'upsert_opening_layer', 'remove_opening_layer', 'animate_opening_layer', 'animate_opening_camera', 'set_opening_transition', 'set_opening_pixel_grid', 'set_opening_region_loop', 'upsert_opening_light_fx', 'upsert_opening_emote', 'set_opening_caption', 'place_opening_background', 'place_opening_charset_actor', 'apply_opening_walk', 'set_opening_sprite_states', 'set_opening', 'edit_opening']);
const errors: { name: string; summary: string }[] = [];
let calls = 0;
for (const event of activity) {
  if (event.type !== 'tool_start' || !event.name || !replayable.has(event.name) || !event.args) continue;
  calls += 1;
  const result = runTool(ctx, event.name, event.args);
  if (!result.ok && /dedicated-backdrop|오프닝 배경.*재사용/iu.test(result.summary ?? '')) errors.push({ name: event.name, summary: result.summary ?? '' });
}
const output = { calls, backdropReuseErrors: errors, projectScenes: (ctx.project as Project).system.opening?.scenes.length ?? 0 };
console.log(JSON.stringify(output, null, 1));
if (errors.length > 0) process.exitCode = 1;
