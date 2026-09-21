import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, it } from 'vitest';
import { startLocalProjectServer, type LocalProjectServer } from '../../electron/serve/runtime';


async function enableAccessCode(host: LocalProjectServer) {
  const response = await fetch(host.url + '/__oprn/bridge', { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-oprn-bridge-token': host.token },
    body: JSON.stringify({ channel: 'oprn:host.access', payload: { required: true } }) });
  expect(response.status).toBe(200);
}

let server: LocalProjectServer | undefined;
let root: string | undefined;
afterEach(async () => { await server?.close(); if (root) await rm(root, { recursive: true, force: true }); });
it('requires membership for HTML, assets and RPC; revocation invalidates an existing cookie', async () => {
  root = await mkdtemp(join(tmpdir(), 'oprn-shared-host-'));
  await writeFile(join(root, 'index.html'), '<html><head></head><body>editor</body></html>');
  server = await startLocalProjectServer({ projectDir: join(root, 'project'), distDir: root,
    browserBridgeSource: '', publicOrigin: 'http://127.0.0.1:0' });
  await enableAccessCode(server);
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
  expect((await rpc(viewer, 'oprn:host.access', { required: false })).status).toBe(403);
  expect((await rpc(viewer, 'oprn:team.invite', { label: 'escalation', role: 'editor' })).ok).toBe(false);
  expect((await fetch(base + '/auth/status', { headers: { cookie: viewer, 'x-oprn-companion-token': server.companionToken } })).status).toBe(403);
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
  await enableAccessCode(server);
  await enableAccessCode(other);
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

it('keeps the owner access code and login across restart, while logout revokes the session', async () => {
  root = await mkdtemp(join(tmpdir(), 'oprn-persistent-login-'));
  await writeFile(join(root, 'index.html'), '<html><head></head></html>');
  const options = { projectDir: join(root, 'project'), distDir: root, browserBridgeSource: '', publicOrigin: 'http://127.0.0.1:0' };
  server = await startLocalProjectServer(options);
  await enableAccessCode(server);
  const code = server.ownerAccessCode!;
  const login = await fetch(server.url + '/__oprn/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ token: code }) });
  const cookie = login.headers.get('set-cookie')!.split(';')[0]!;
  await server.close();
  server = await startLocalProjectServer(options);
  expect(server.ownerAccessCode).toBe(code);
  const page = await fetch(server.url, { headers: { cookie } });
  expect(await page.text()).toContain('window.__OPRN_BRIDGE__');
  const disabledAi = await fetch(server.url + '/v1/agent/run', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: '{}' });
  expect(disabledAi.status).toBe(503);
  await fetch(server.url + '/__oprn/logout', { method: 'POST', redirect: 'manual', headers: { cookie } });
  expect((await fetch(server.url + '/__oprn/bridge', { method: 'POST', headers: { cookie } })).status).toBe(401);
});

it('opens internal hosting by default and persists an explicit access-code opt-in', async () => {
  root = await mkdtemp(join(tmpdir(), 'oprn-internal-host-'));
  await writeFile(join(root, 'index.html'), '<html><head></head><body>editor</body></html>');
  const options = { projectDir: join(root, 'project'), distDir: root, browserBridgeSource: '', publicOrigin: 'http://127.0.0.1:0' };
  server = await startLocalProjectServer(options);
  expect(await (await fetch(server.url)).text()).toContain('window.__OPRN_BRIDGE__');
  const setting = await fetch(server.url + '/__oprn/bridge', { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-oprn-bridge-token': server.token },
    body: JSON.stringify({ channel: 'oprn:host.access', payload: { required: true } }) });
  const cookie = setting.headers.get('set-cookie')!.split(';')[0]!;
  expect(setting.status).toBe(200);
  await server.close();
  server = await startLocalProjectServer(options);
  expect(await (await fetch(server.url)).text()).not.toContain('window.__OPRN_BRIDGE__');
  expect(await (await fetch(server.url, { headers: { cookie } })).text()).toContain('window.__OPRN_BRIDGE__');
  const disabled = await fetch(server.url + '/__oprn/bridge', { method: 'POST',
    headers: { cookie, 'content-type': 'application/json', 'x-oprn-bridge-token': server.token },
    body: JSON.stringify({ channel: 'oprn:host.access', payload: { required: false } }) });
  expect(disabled.status).toBe(200);
  expect(await (await fetch(server.url)).text()).toContain('window.__OPRN_BRIDGE__');
});
