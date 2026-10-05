// Focused authoring/readback evidence. No game project is overwritten.
import fs from 'node:fs';
import path from 'node:path';
import { createBlankProject } from '../../src/project/defaults/defaultProject.ts';
import { preferredWorldmapMode, worldmapAuthoringRequest } from '../../src/project/worldmapModes.ts';
import { formatWorldmapChoiceNote } from '../../src/ai/worldmapChoiceNote.ts';
import { getTool, runTool } from '../../src/editor/tools/index.ts';
import { setWorldmapBuilder } from '../../src/editor/worldmap/worldmapBuild.ts';
import { buildWorldmap } from '../lib/worldmapBuild.mjs';
import { initLocalProjectStore, openLocalProjectStore } from '../../electron/local-store/store.ts';
import { inspectWorldAtlas } from '../../src/project/worldAtlasAudit.ts';
import type { Project } from '../../src/project/types.ts';

const out = path.resolve('verify-shots/worldmap-default-choice');
const root = process.argv[2];
if (!root || fs.existsSync(root)) throw new Error('Pass a new canonical project root; existing folders are never overwritten.');
fs.mkdirSync(out, { recursive: true });
setWorldmapBuilder(async request => {
  const result = await buildWorldmap(request);
  if (!result.ok) throw new Error(result.error);
  fs.writeFileSync(path.join(out, 'host-build.json'), JSON.stringify(result));
  return result;
});
const cases: unknown[] = [];
for (const kind of ['default', 'pokemon'] as const) {
  const project = createBlankProject();
  if (kind === 'pokemon') project.system.genre = 'monster-collect';
  const mode = preferredWorldmapMode(project);
  if (mode !== (kind === 'default' ? 'default' : 'region-routes')) throw new Error('Wrong initial mode');
  const { toolName, args } = worldmapAuthoringRequest(mode, 'choice_' + kind, '월드맵 선택 확인 · ' + kind, 7);
  const start = { mapId: project.startMapId, pos: project.startPos };
  const catalogue = getTool('list_worldmap_structures')!.run(project, {});
  const note = formatWorldmapChoiceNote('새 월드맵을 만들어줘', project);
  console.log('Creating', kind, toolName);
  await getTool(toolName)!.prepare?.(args, project);
  const context = { project };
  const result = runTool(context, toolName, args, { dryRun: false });
  if (!result.ok) throw new Error(JSON.stringify(result));
  const authored = context.project;
  if (authored.startMapId !== start.mapId || JSON.stringify(authored.startPos) !== JSON.stringify(start.pos)) throw new Error('Existing start changed');
  const folder = path.resolve(root, kind);
  let store = await initLocalProjectStore({ projectDir: folder });
  const projectId = store.info().projectId;
  const save = await store.saveProject(authored);
  if (save.kind !== 'saved') throw new Error('Save conflict');
  await store.separateInlineMedia(authored);
  store.close();
  store = await openLocalProjectStore({ projectDir: folder });
  const snapshot = store.loadSnapshot()!;
  const reloaded = snapshot.project as Project;
  if (kind === 'default') {
    const map = reloaded.maps.choice_default;
    if (!map?.worldmapSource || map.worldmapSource.theme !== 'fantasy' || map.width !== 96 || map.height !== 72 || reloaded.worldAtlases?.length) throw new Error('Default did not preserve original terrain contract');
    const uploaded = reloaded.assets.uploaded.worldmap_choice_default_image;
    if (!uploaded?.ref || !fs.existsSync(path.join(folder, 'assets', uploaded.ref.sha256 + '.' + uploaded.ref.extension))) throw new Error('Default image was not saved');
  } else {
    const atlas = reloaded.worldAtlases?.[0];
    if (!atlas || atlas.structure !== 'region-routes' || !inspectWorldAtlas(reloaded, atlas).ok) throw new Error('Pokemon navigation contract failed');
  }
  cases.push({ kind, mode, toolName, projectId, folder, revision: snapshot.revision, reloaded: true, startPreserved: true,
    newMaps: Object.keys(reloaded.maps).filter(id => id.startsWith('choice_')), catalogue: catalogue.data, note });
  store.close();
}
fs.writeFileSync(path.join(out, 'canonical-readback.json'), JSON.stringify({ cases }, null, 2));
console.log(JSON.stringify({ cases: cases.length, canonicalReadback: true, root }));
