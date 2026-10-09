import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { createBlankProject } from '@/project/defaults/blankProject';
import { serialize } from '@/project/io';
import { startLocalProjectServer, type LocalProjectServer } from '../../electron/serve/runtime';
import { OPRN_CHANNELS as C } from '../../electron/shared/channels';


async function enableAccessCode(host: LocalProjectServer) {
  const response = await fetch(host.url + '/__oprn/bridge', { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-oprn-bridge-token': host.token },
    body: JSON.stringify({ channel: 'oprn:host.access', payload: { required: true } }) });
  expect(response.status).toBe(200);
}

let host: LocalProjectServer | undefined;
let root: string | undefined;
afterEach(async () => { await host?.close(); if (root) await rm(root, { recursive: true, force: true }); });

it('creates separate durable projects, preserves the original and shares team permissions after restart', async () => {
  root = await mkdtemp(join(tmpdir(), 'oprn-web-create-'));
  await writeFile(join(root, 'index.html'), '<html><head></head></html>');
  const options = { projectDir: join(root, 'project'), distDir: root, browserBridgeSource: '', publicOrigin: 'http://127.0.0.1:0' };
  host = await startLocalProjectServer(options);
  await enableAccessCode(host);
  const login = async (token: string, project = '') => {
    const response = await fetch(host!.url + '/__oprn/login?hostProject=' + project, {
      method: 'POST', redirect: 'manual', body: new URLSearchParams({ token }),
    });
    expect(response.status).toBe(303);
    if (project) expect(response.headers.get('location')).toBe('/?hostProject=' + project);
    return response.headers.get('set-cookie')!.split(';')[0]!;
  };
  let cookie = await login(host.ownerAccessCode!);
  const rpc = (channel: string, payload?: unknown, project = '', identity = cookie) => fetch(host!.url + '/__oprn/bridge', {
    method: 'POST', headers: { cookie: identity, 'content-type': 'application/json', 'x-oprn-bridge-token': host!.token,
      'x-oprn-session': 'browser-tab', 'x-oprn-project': project }, body: JSON.stringify({ channel, payload }),
  });
  const seed = serialize(createBlankProject());
  expect((await rpc(C.projectSave, { projectDir: 'host-project', serialized: seed, expectedSha: null })).status).toBe(200);
  const original = await (await rpc(C.projectLoad)).json();
  const created = await (await rpc(C.startCreateProject, { title: '웹 새 프로젝트', seed })).json();
  expect(created.projectDir).toMatch(/^[0-9a-f-]{36}$/);
  const load = await (await rpc(C.projectLoad, undefined, created.projectDir)).json();
  expect(JSON.parse(load.serialized).meta.title).toBe('웹 새 프로젝트');
  expect(await (await rpc(C.projectLoad)).json()).toEqual(original);
  expect((await rpc(C.projectLoad, undefined, '../project')).status).toBe(400);
  expect((await rpc(C.startCreateProject, { title: '잘못된 시드', seed: '{}' })).status).toBe(400);
  const invite = await (await rpc(C.teamInvite, { label: '열람자', role: 'viewer' })).json();
  const viewer = await login(invite.token);
  expect((await rpc(C.projectLoad, undefined, created.projectDir, viewer)).status).toBe(200);
  expect((await rpc(C.startCreateProject, { title: '금지', seed }, created.projectDir, viewer)).status).toBe(400);
  expect((await rpc(C.projectSave, { projectDir: 'host-project', serialized: seed, expectedSha: load.sha256 }, created.projectDir, viewer)).status).toBe(400);
  await host.close(); host = undefined;
  host = await startLocalProjectServer(options);
  cookie = await login(host.ownerAccessCode!, created.projectDir);
  const reopened = await (await rpc(C.projectLoad, undefined, created.projectDir)).json();
  expect(reopened).toEqual(load);
  expect(await (await rpc(C.projectLoad)).json()).toEqual(original);
});
