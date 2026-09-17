import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createHouseTemplateGalleryProject } from '@/project/defaults/defaultProject';
import { projectWithoutEventDrafts } from '@/project/eventDrafts';
import { serialize } from '@/project/io';
import { mergeTeamProject } from '@/project/persistence/core/teamMerge';
import { createProjectSessionRegistry } from '../../electron/main/sessions';
import { createStoreHandlers } from '../../electron/main/dispatch';
import { OPRN_CHANNELS as C } from '../../electron/shared/channels';
import { openLocalProjectStore } from '../../electron/local-store/store';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'oprn-team-'));
  const sessions = createProjectSessionRegistry();
  const a = await sessions.open('a', dir);
  await sessions.open('b', dir);
  const base = projectWithoutEventDrafts(createHouseTemplateGalleryProject());
  await a.store.saveProject(base);
  const invoke = createStoreHandlers(sessions);
  cleanups.push(async () => { sessions.close('a'); sessions.close('b'); await rm(dir, { recursive: true, force: true }); });
  const patch = (key: string, project: typeof base) => invoke[C.projectSaveMapPatch]!(key, { projectDir: dir, baseSerialized: serialize(base), serialized: serialize(project) });
  return { dir, sessions, a, base, invoke, patch };
}

describe('shared project service', () => {
  it('rejects stale full replacement and preserves the accepted revision', async () => {
    const { dir, a, invoke, base } = await setup();
    const sha = a.store.info().sha256;
    const local = structuredClone(base); local.meta.title = 'first';
    expect(await invoke[C.projectSave]!('a', { projectDir: dir, serialized: serialize(local), expectedSha: sha })).toMatchObject({ kind: 'saved' });
    local.meta.title = 'stale';
    expect(await invoke[C.projectSave]!('b', { projectDir: dir, serialized: serialize(local), expectedSha: sha })).toMatchObject({ kind: 'conflict' });
    expect(a.store.loadSnapshot()!.project.meta.title).toBe('first');
  });

  it('merges different maps and preserves a concurrently changed non-map root', async () => {
    const { base, patch, a } = await setup();
    const [one, two] = Object.keys(base.maps);
    const first = structuredClone(base), second = structuredClone(base);
    first.maps[one!]!.name = 'first'; first.meta.title = 'team title';
    second.maps[two!]!.name = 'second';
    await patch('a', first);
    const result = await patch('b', second) as { kind: string; serialized: string };
    expect(result.kind).toBe('saved');
    const accepted = JSON.parse(result.serialized);
    expect(accepted.meta.title).toBe('team title');
    expect(accepted.maps[one!].name).toBe('first');
    expect(accepted.maps[two!].name).toBe('second');
    expect(a.store.info().revision).toBe(3);
  });

  it('locks prevent another session writing the map and revocation blocks existing sessions', async () => {
    const { base, sessions, invoke, patch, a } = await setup();
    const invited = a.team.invite('editor', 'editor');
    sessions.setMember('b', invited.member.id);
    const mapId = Object.keys(base.maps)[0]!;
    expect(await invoke[C.teamLock]!('a', { resource: `map:${mapId}` })).toMatchObject({ kind: 'held' });
    expect(await invoke[C.teamLock]!('b', { resource: `map:${mapId}` })).toMatchObject({ kind: 'locked' });
    const changed = structuredClone(base); changed.maps[mapId]!.name = 'blocked';
    expect(await patch('b', changed)).toMatchObject({ kind: 'conflict' });
    await invoke[C.teamRevoke]!('a', { memberId: invited.member.id });
    await expect(invoke[C.projectLoad]!('b', {})).rejects.toThrow('취소');
  });

  it('viewers cannot write or grant themselves access', async () => {
    const { sessions, invoke, base, patch, a } = await setup();
    const invited = a.team.invite('viewer', 'viewer');
    sessions.setMember('b', invited.member.id);
    await expect(patch('b', base)).rejects.toThrow('읽기 전용');
    await expect(invoke[C.teamInvite]!('b', { label: 'escalation', role: 'editor' })).rejects.toThrow();
    expect(await invoke[C.projectLoad]!('b', {})).not.toBeNull();
  });

  it('backup restores membership, project and content-addressed asset bytes together', async () => {
    const { a, dir } = await setup();
    const invited = a.team.invite('member', 'editor');
    const ref = await a.store.putAsset(new Uint8Array([1, 2, 3]), { mime: 'image/png', extension: 'png' });
    const path = a.store.backup();
    expect(path.startsWith(join(dir, 'backups'))).toBe(true);
    const restored = await openLocalProjectStore({ projectDir: dirname(path) });
    try {
      expect(restored.loadSnapshot()!.project).toEqual(a.store.loadSnapshot()!.project);
      expect(await restored.assetBytes(ref.sha256)).toEqual(new Uint8Array([1, 2, 3]));
    } finally { restored.close(); }
    expect(a.team.authenticate(invited.token)?.id).toBe(invited.member.id);
  });
});

describe('record merge policy', () => {
  it('merges independent DB records but rejects concurrent edits to the same record', () => {
    const base = projectWithoutEventDrafts(createHouseTemplateGalleryProject());
    base.database.actors = [base.database.actors[0]!, { ...structuredClone(base.database.actors[0]!), id: 'team-second-actor' }];
    const a = structuredClone(base), b = structuredClone(base);
    a.database.actors[0]!.name = 'Alice'; b.database.actors[1]!.name = 'Bob';
    const merged = mergeTeamProject(base, b, a);
    expect(merged.kind).toBe('merged');
    if (merged.kind === 'merged') {
      expect(merged.project.database.actors[0]!.name).toBe('Alice');
      expect(merged.project.database.actors[1]!.name).toBe('Bob');
    }
    b.database.actors[0]!.name = 'Conflict';
    expect(mergeTeamProject(base, b, a).kind).toBe('conflict');
  });
});
