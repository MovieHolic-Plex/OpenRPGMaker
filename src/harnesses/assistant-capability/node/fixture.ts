import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createEmberQuestProject } from '../../../project/defaults/emberQuestGame';
import { createBlankMap } from '../../../project/defaults/defaultMaps';
import { COMBINED_TOWN_TILESET_ID } from '../../../project/defaults/constants';
import { initLocalProjectStore } from '../../../../electron/local-store/store';

export async function prepareWorldmapProof(root: string, selected?: string): Promise<void> {
  if (existsSync(root)) throw Error(`기존 실행 덮어쓰기 거부: ${root}`);
  const ids = selected ? selected.split(',') : ['default', 'pokemon'];
  if (ids.some(id => !['default', 'pokemon'].includes(id))) throw Error('지원하는 녹화: default,pokemon');
  for (const id of ids) {
    const dir = resolve(root, id), projectDir = resolve(dir, 'project');
    const project = createEmberQuestProject();
    project.meta.title = `월드맵 조수 실제 녹화 · ${id}`;
    if (id === 'pokemon') project.system.genre = 'monster-collect';
    if (project.system.opening) project.system.opening.enabled = false;
    mkdirSync(dir, { recursive: true });
    const store = await initLocalProjectStore({ projectDir });
    try {
      await store.saveProject(project);
      const snapshot = store.loadSnapshot()!;
      writeFileSync(resolve(dir, 'fixture.json'), JSON.stringify({caseId:id, projectId:store.projectId,
        projectDir, revision:snapshot.revision, sha256:snapshot.sha256}, null, 2));
    } finally { store.close(); }
    console.log(`prepared worldmap ${id}`);
  }
}

export async function prepare(root: string, selected?: string): Promise<void> {
  const seed = JSON.parse(readFileSync(resolve('harness-data/assistant-capability/seed.json'), 'utf8'));
  const ids = selected?.split(',');
  const cases = seed.cases.filter((entry: { id: string }) => !ids || ids.includes(entry.id));
  if (!cases.length) throw Error(`모르는 과제: ${selected}`);
  for (const entry of cases) {
    const dir = resolve(root, entry.id), projectDir = resolve(dir, 'project');
    if (existsSync(resolve(dir, 'initial.json')) || existsSync(resolve(projectDir, 'project.sqlite'))) throw Error(`기존 실행 덮어쓰기 거부: ${dir}`);
    const project = createEmberQuestProject();
    // Minimal fixture, not authored game content. Keep the shipped database/assets
    // and a second map as a sentinel for accidental changes to another map.
    const original = project.maps[seed.mapId]!;
    const map = createBlankMap('잿불 마을', 24, 18, COMBINED_TOWN_TILESET_ID);
    map.id = seed.mapId;
    map.events = ['ev_ember_child', 'ev_ember_inn', 'ev_ember_guard'].map((id, i) => {
      const event = structuredClone(original.events.find(value => value.id === id)!);
      event.x = 8 + i * 4; event.y = 7;
      for (const page of event.pages ?? []) page.movement = { type: 'fixed', speed: 3, frequency: 3 };
      return event;
    });
    const other = createBlankMap('재진입 검증 맵', 24, 18, COMBINED_TOWN_TILESET_ID);
    other.id = 'map_capability_return';
    const portal = (id: string, target: string) => {
      const event = structuredClone(original.events.find(value => value.id === 'ev_ember_gate_a')!);
      event.id = id; event.x = 2; event.y = 8; event.trigger = { kind: 'action' };
      event.pages = [event.pages![0]!];
      event.pages[0]!.id = `${id}_page`; event.pages[0]!.name = '재진입 검증 문';
      event.pages[0]!.trigger = { kind: 'action' };
      event.pages[0]!.commands = [{ kind: 'transfer', mapId: target, x: 2, y: 8, fade: 'black' }];
      return event;
    };
    map.events.push(portal('ev_capability_exit', other.id));
    other.events.push(portal('ev_capability_return', map.id));
    project.maps[other.id] = other;
    project.mapTree.children.push({ mapId: other.id, children: [] });
    project.maps[map.id] = map;
    project.startMapId = map.id; project.startPos = { x: 8, y: 8 };
    if (entry.check === 'move') project.startPos = { x: 9, y: 8 };
    if (entry.check === 'inn') project.startPos = { x: 12, y: 8 };
    project.meta.title = `조수 기능 검증 · ${entry.id}`;
    if (project.system.opening) project.system.opening.enabled = false;
    project.session.gold = 100;
    // Existing unrelated maps and database records are retained as sentinels.
    mkdirSync(dir, { recursive: true });
    const store = await initLocalProjectStore({ projectDir });
    try {
      await store.saveProject(project);
      const initial = store.loadSnapshot()!;
      writeFileSync(resolve(dir, 'initial.json'), JSON.stringify(initial.project));
      const folded = store.exportFolded();
      writeFileSync(resolve(dir, 'initial-check.json'), folded?.folded ?? JSON.stringify(initial.project));
      writeFileSync(resolve(dir, 'fixture.json'), JSON.stringify({ schemaVersion: 1, caseId: entry.id,
        fixtureVersion: seed.fixtureVersion, projectId: store.projectId, projectDir, revision: initial.revision,
        sha256: initial.sha256, task: entry.prompt, mapId: map.id }, null, 2));
    } finally { store.close(); }
    console.log(`prepared ${entry.id}`);
  }
}
