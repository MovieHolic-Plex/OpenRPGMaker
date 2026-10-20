#!/usr/bin/env node
// object-gate 사본 동기화 — 이 저장소의 네 경로 ↔ 개별 저장소 MovieHolic-Plex/object-gate.
//
//   npm run object-gate:sync -- status [--repo <object-gate 체크아웃>]
//   npm run object-gate:sync -- export [--push]   # origin/main 의 게이트 → object-gate 저장소 (커밋, --push 면 푸시)
//   npm run object-gate:sync -- import            # object-gate 저장소에만 있는 변경 → 이 작업 트리 (PR 로 들인다)
//
// 두 저장소는 같은 경로 배치를 쓰고 파일은 바이트 그대로다(같은 git blob 해시). 영수증·승인은 화소 해시·서명에 묶이므로
// 이 스크립트는 내용을 바꾸지 않고 blob 만 옮긴다. 기준(base)은 object-gate 저장소의 .monorepo-sync 에 적힌,
// 마지막으로 내보낸 이 저장소 origin/main 커밋이다. 경로마다 3-way: 한쪽만 바뀌었으면 그쪽을 따르고, 양쪽이 다르게 바뀌면 멈춘다.
// 내보내기는 항상 origin/main(병합된 것)만 쓴다 — 워크트리의 미병합 커밋이 기준이 되면 다른 클론에서 기준을 못 찾는다.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';

export const GATE_PATHS = [
  'src/harnesses/object-gate',
  'src/harnesses/_core/objectGate',
  'src/harnesses/_core/object_gate',
  'harness-data/object-gate',
];
const SYNC_FILE = '.monorepo-sync';

const argv = process.argv.slice(2);
const cmd = argv[0] ?? 'status';
const opt = (name) => { const i = argv.indexOf(`--${name}`); return i < 0 ? undefined : (argv[i + 1] ?? ''); };
const flag = (name) => argv.includes(`--${name}`);

const mono = git(process.cwd(), ['rev-parse', '--show-toplevel']).trim();
const gate = resolve(opt('repo') ?? process.env.OBJECT_GATE_REPO ?? resolve(homedir(), 'z-project', 'object-gate'));

function git(cwd, args, input) {
  return execFileSync('git', args, { cwd, input, maxBuffer: 1 << 30 }).toString('utf8');
}
function gitBuf(cwd, args) {
  return execFileSync('git', args, { cwd, maxBuffer: 1 << 30 });
}
function tree(cwd, rev) {
  const out = new Map();
  const raw = git(cwd, ['ls-tree', '-r', '-z', rev, '--', ...GATE_PATHS]);
  for (const ent of raw.split('\0')) {
    if (!ent) continue;
    const [meta, path] = ent.split('\t');
    const [mode, , sha] = meta.split(' ');
    out.set(path, `${mode} ${sha}`);
  }
  return out;
}
function hasCommit(cwd, sha) {
  try { git(cwd, ['cat-file', '-e', `${sha}^{commit}`]); return true; } catch { return false; }
}

function plan() {
  if (!existsSync(resolve(gate, '.git'))) throw Error(`object-gate 체크아웃이 없다: ${gate}\n  git clone git@github.com:MovieHolic-Plex/object-gate.git ${gate}  (또는 --repo / OBJECT_GATE_REPO)`);
  git(mono, ['fetch', '-q', 'origin', 'main']);
  try { git(gate, ['fetch', '-q', 'origin']); } catch { /* 오프라인이면 로컬 상태로 */ }
  const syncPath = resolve(gate, SYNC_FILE);
  const base = existsSync(syncPath) ? JSON.parse(readFileSync(syncPath, 'utf8')).commit : null;
  if (!base) throw Error(`${SYNC_FILE} 가 없다 — 기준을 모르면 어느 쪽이 바뀐 것인지 알 수 없다`);
  if (!hasCommit(mono, base)) throw Error(`기준 커밋 ${base} 이 이 저장소에 없다(git fetch origin 후 다시)`);
  const head = git(mono, ['rev-parse', 'origin/main']).trim();
  const B = tree(mono, base), M = tree(mono, head), G = tree(gate, 'HEAD');
  const paths = new Set([...B.keys(), ...M.keys(), ...G.keys()]);
  const toGate = [], toMono = [], conflict = [];
  for (const p of [...paths].sort()) {
    const b = B.get(p), m = M.get(p), g = G.get(p);
    if (m === g) continue;
    if (g === b) toGate.push(p);
    else if (m === b) toMono.push(p);
    else conflict.push(p);
  }
  return { base, head, M, G, toGate, toMono, conflict };
}

function show(list, label) {
  if (!list.length) return;
  console.log(`${label} ${list.length}`);
  for (const p of list.slice(0, 20)) console.log(`  ${p}`);
  if (list.length > 20) console.log(`  … ${list.length - 20}개 더`);
}

function writeBlob(fromCwd, entry, toRoot, path) {
  const dest = resolve(toRoot, path);
  if (!entry) { rmSync(dest, { force: true }); return; }
  const [mode, sha] = entry.split(' ');
  if (mode !== '100644' && mode !== '100755') throw Error(`${path}: 일반 파일이 아니다(mode ${mode}) — 손으로 처리`);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, gitBuf(fromCwd, ['cat-file', 'blob', sha]), { mode: mode === '100755' ? 0o755 : 0o644 });
}

function main() {
  const P = plan();
  console.log(`object-gate 저장소: ${gate}`);
  console.log(`기준 ${P.base.slice(0, 10)} · 이 저장소 origin/main ${P.head.slice(0, 10)}`);
  show(P.toGate, '이 저장소에서 바뀜(export 대상)');
  show(P.toMono, 'object-gate 저장소에서 바뀜(import 대상)');
  show(P.conflict, '양쪽이 다르게 바뀜(충돌 — 손으로 맞춘 뒤 다시)');
  if (cmd === 'status') {
    if (!P.toGate.length && !P.toMono.length && !P.conflict.length) console.log('같다');
    return P.conflict.length ? 2 : (P.toGate.length || P.toMono.length ? 1 : 0);
  }
  if (P.conflict.length) { console.error('멈춤: 충돌이 있다'); return 2; }
  if (cmd === 'export') {
    if (P.toMono.length) { console.error('멈춤: object-gate 저장소에만 있는 변경이 있다 — 먼저 import 해서 이 저장소에 PR 로 들여라'); return 3; }
    if (git(gate, ['status', '--porcelain']).trim()) { console.error(`멈춤: ${gate} 작업 트리가 깨끗하지 않다`); return 3; }
    for (const p of P.toGate) writeBlob(mono, P.M.get(p), gate, p);
    writeFileSync(resolve(gate, SYNC_FILE), `${JSON.stringify({ commit: P.head, at: new Date().toISOString() }, null, 2)}\n`);
    git(gate, ['add', '-A', '--', ...GATE_PATHS, SYNC_FILE]);
    if (!git(gate, ['status', '--porcelain']).trim()) { console.log('바뀐 것 없음'); return 0; }
    const subject = git(mono, ['log', '-1', '--format=%s', P.head]).trim();
    git(gate, ['commit', '-q', '-F', '-'], `sync: OPRN monorepo ${P.head.slice(0, 10)}\n\n${P.toGate.length} files. Last monorepo commit: ${subject}\n\nMonorepo-Commit: ${P.head}\n`);
    console.log(`커밋: ${git(gate, ['log', '-1', '--format=%h %s']).trim()}`);
    if (flag('push')) { git(gate, ['push', '-q', 'origin', 'HEAD']); console.log('푸시함'); }
    // 바이트 일치 확인
    const after = tree(gate, 'HEAD');
    const bad = [...new Set([...after.keys(), ...P.M.keys()])].filter((p) => after.get(p) !== P.M.get(p));
    if (bad.length) { console.error(`불일치 ${bad.length}: ${bad.slice(0, 5).join(', ')}`); return 4; }
    console.log('origin/main 과 바이트 일치');
    return 0;
  }
  if (cmd === 'import') {
    for (const p of P.toMono) writeBlob(gate, P.G.get(p), mono, p);
    console.log(`${P.toMono.length}개를 이 작업 트리에 썼다. 커밋해서 PR 로 병합한 뒤 export 로 기준을 올린다.`);
    return 0;
  }
  console.error('쓰는 법: object-gate-sync.mjs status|export [--push]|import [--repo <경로>]');
  return 64;
}

try { process.exitCode = main(); } catch (e) { console.error(String(e?.message ?? e)); process.exitCode = 1; }
