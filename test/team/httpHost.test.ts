import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, it } from 'vitest';
import { startLocalProjectServer, type LocalProjectServer } from '../../electron/serve/runtime';

let server: LocalProjectServer | undefined;
let root: string | undefined;
afterEach(async () => { await server?.close(); if (root) await rm(root, { recursive: true, force: true }); });
it('requires membership for HTML, assets and RPC; revocation invalidates an existing cookie', async () => {
  root = await mkdtemp(join(tmpdir(), 'oprn-shared-host-'));
  await writeFile(join(root, 'index.html'), '<html><head></head><body>editor</body></html>');
  server = await startLocalProjectServer({ projectDir: join(root, 'project'), distDir: root,
    browserBridgeSource: '', publicOrigin: 'http://127.0.0.1:0' });
  const base = server.url;
  expect(await (await fetch(base)).text()).not.toContain('window.__OPRN_BRIDGE__');
  expect((await fetch(base + '/__oprn/asset/' + 'a'.repeat(64))).status).toBe(401);
  const login = async (token: string) => {
    const response = await fetch(base + '/__oprn/login', { method: 'POST', redirect: 'manual',
      headers: { 'content-type': 'application/x-www-form-urlencoded', origin: base }, body: new URLSearchParams({ token }) });
    expect(response.status).toBe(303);
    return response.headers.get('set-cookie')!.split(';')[0]!;
  };
  const owner = await login(server.ownerAccessCode!);
  const rpc = (cookie: string, channel: string, payload?: unknown) => fetch(base + '/__oprn/bridge', {
    method: 'POST', headers: { cookie, origin: base, 'content-type': 'application/json', 'x-oprn-bridge-token': server!.token, 'x-oprn-session': 'tab' },
    body: JSON.stringify({ channel, payload }),
  });
  const invitation = await (await rpc(owner, 'oprn:team.invite', { label: 'reader', role: 'viewer' })).json();
  const viewer = await login(invitation.token);
  expect((await rpc(viewer, 'oprn:team.status')).status).toBe(200);
  expect((await rpc(viewer, 'oprn:team.invite', { label: 'escalation', role: 'editor' })).ok).toBe(false);
  expect((await fetch(base + '/auth/status', { headers: { cookie: viewer, 'x-oprn-companion-token': server.companionToken } })).status).toBe(404);
  await rpc(owner, 'oprn:team.revoke', { memberId: invitation.member.id });
  expect((await rpc(viewer, 'oprn:team.status')).status).toBe(401);
  expect((await fetch(base, { headers: { cookie: owner, origin: 'https://other.example' } })).status).toBe(403);
});

it('scopes login and logout cookies to the hosted project', async () => {
  root = await mkdtemp(join(tmpdir(), 'oprn-cookie-host-'));
  await writeFile(join(root, 'index.html'), '<html><head></head></html>');
  server = await startLocalProjectServer({ projectDir: join(root, 'a'), distDir: root,
    browserBridgeSource: '', publicOrigin: 'http://127.0.0.1:0' });
  const other = await startLocalProjectServer({ projectDir: join(root, 'b'), distDir: root,
    browserBridgeSource: '', publicOrigin: 'http://127.0.0.1:0' });
  try {
    const login = async (host: LocalProjectServer) => {
      const response = await fetch(host.url + '/__oprn/login', { method: 'POST', redirect: 'manual',
        body: new URLSearchParams({ token: host.ownerAccessCode! }) });
      return response.headers.get('set-cookie')!.split(';')[0]!;
    };
    const a = await login(server), b = await login(other);
    expect(a.split('=')[0]).not.toBe(b.split('=')[0]);
    const cookie = a + '; ' + b;
    for (const host of [server, other]) {
      expect((await fetch(host.url + '/__oprn/team', { headers: { cookie } })).status).toBe(200);
    }
    await fetch(other.url + '/__oprn/logout', { method: 'POST', redirect: 'manual', headers: { cookie } });
    expect((await fetch(server.url + '/__oprn/team', { headers: { cookie } })).status).toBe(200);
  } finally { await other.close(); }
});
