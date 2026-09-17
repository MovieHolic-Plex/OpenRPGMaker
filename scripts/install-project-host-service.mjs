#!/usr/bin/env node
// Explicitly replace the legacy Vite preview service with the persistent SQLite host.
import { existsSync } from 'node:fs';
import { mkdir, writeFile, copyFile, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { withTsModule } from './ontology-ts-loader.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const options = new Map();
let initialize = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--init-new') { initialize = true; continue; }
  if (!['--project-dir', '--public-origin'].includes(args[i]) || !args[i + 1]) {
    throw new Error('Usage: node scripts/install-project-host-service.mjs --project-dir <folder> --public-origin <http(s)://host:port> [--init-new]');
  }
  options.set(args[i], args[++i]);
}
if (!options.has('--project-dir') || !options.has('--public-origin')) throw new Error('project-dir와 public-origin이 필요합니다.');
const projectDir = resolve(options.get('--project-dir'));
const origin = new URL(options.get('--public-origin'));
if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
  throw new Error('public-origin은 경로와 자격증명이 없는 HTTP(S) origin이어야 합니다.');
}
for (const file of ['dist/index.html', 'dist-electron/browser-bridge.js']) {
  if (!existsSync(join(repo, file))) throw new Error('먼저 npm run build:packaged && npm run build:electron을 실행하세요.');
}
const configRoot = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
const serviceRoot = join(configRoot, 'systemd/user');
if (!existsSync(join(serviceRoot, 'rpg-zzu.service'))) throw new Error('기존 사용자 rpg-zzu.service를 찾을 수 없습니다.');
// Initialization is explicit and refuses an existing directory, including an existing project.
if (initialize) {
  await mkdir(dirname(projectDir), { recursive: true });
  await mkdir(projectDir, { mode: 0o700 });
  await withTsModule(join(repo, 'electron/local-store/store.ts'), 'init-web-host.mjs', async ({ initLocalProjectStore }) => {
    const store = await initLocalProjectStore({ projectDir });
    store.close();
  });
}
if (!existsSync(join(projectDir, 'project.sqlite'))) throw new Error('project.sqlite가 없습니다. 새 작업실은 --init-new로 명시적으로 만드세요.');
// systemd performs percent expansion even inside quotes. ExecStart also expands dollars.
const quote = value => '"' + value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('%', '%%').replaceAll('$', '$$') + '"';
for (const value of [repo, projectDir, process.execPath]) if (/[\r\n\0]/.test(value)) throw new Error('invalid path');
const dropInDir = join(serviceRoot, 'rpg-zzu.service.d');
await mkdir(dropInDir, { recursive: true });
const dropIn = join(dropInDir, '50-project-host.conf');
if (existsSync(dropIn)) await copyFile(dropIn, dropIn + '.' + Date.now() + '.bak');
const config = `[Service]\nWorkingDirectory=${quote(repo)}\nExecStart=\nExecStart=${[process.execPath, join(repo, 'scripts/start-preview.mjs'), '--project-dir', projectDir, '--host', '0.0.0.0', '--port', '9888', '--public-origin', origin.origin].map(quote).join(' ')}\n`;
await writeFile(dropIn + '.tmp', config, { mode: 0o600 });
await rename(dropIn + '.tmp', dropIn);
execFileSync('systemctl', ['--user', 'daemon-reload'], { stdio: 'inherit' });
execFileSync('systemctl', ['--user', 'restart', 'rpg-zzu.service'], { stdio: 'inherit' });
execFileSync('systemctl', ['--user', 'is-active', 'rpg-zzu.service'], { stdio: 'inherit' });
console.log(`저장 서버로 전환했습니다: ${origin.origin}\n작업실: ${projectDir}\n소유자 접속 코드: ${join(projectDir, '.oprn-host-access')} (서버 기동 후 생성)`);
