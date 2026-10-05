// 사용: node --expose-gc scripts/qa/mem-bench/run.mjs [packId]
// 새 프로젝트 하나로 조수 턴 시작 경로(권위 요약 → 왕복 검사 → 무거운 키 해시)를 차례로 돌리고,
// 단계마다 GC 뒤 살아 남은 힙과 걸린 시간을 찍는다. 두 번째 줄은 체크포인트 하나(복제 → 같은 경로)다.
import { buildTsModule } from '../../ontology-ts-loader.mjs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
if (typeof gc !== 'function') { console.error('node --expose-gc 로 실행'); process.exit(2); }
const file = resolve(tmpdir(), `oprn-mem-bench-${process.pid}.mjs`);
await buildTsModule(resolve('scripts/qa/mem-bench/entry.ts'), file);
const M = await import(file);
const mb = () => { gc(); gc(); return process.memoryUsage().heapUsed / 1048576; };
const rows = [];
let last = mb();
const step = async (label, run) => {
  const t = performance.now(); const keep = await run(); const ms = performance.now() - t;
  const now = mb(); rows.push({ label, ms: Math.round(ms), retainedMB: Math.round(now - last), heapMB: Math.round(now) }); last = now;
  return keep;
};
const project = await step('seed project', () => M.createNewProjectSeed(process.argv[2] ?? 'adventure-jrpg', 'bench'));
await step('identity digest (proposal)', () => M.projectIdentityDigest(project, 'proposal'));
await step('save-diff trust (sharedEntryDigest)', () => { for (const [id, e] of Object.entries(project.tilesets)) M.sharedEntryDigest(e, id); });
await step('lint roundtrip', () => M.warmRoundtripCheck(project));
const plan = await step('heavy wire plan', () => M.planHeavyWire({ project }));
const clone = await step('checkpoint clone', () => M.cloneProjectSharingSharedDictionaries(project));
await step('clone identity digest', () => M.projectIdentityDigest(clone, 'proposal'));
await step('clone lint roundtrip', () => M.warmRoundtripCheck(clone));
await step('clone heavy wire plan', () => M.planHeavyWire({ project: clone }));
await step('untrusted re-digest (save receipt / visual fingerprint)', () => M.jsonContentDigest(clone));
await step('save serialize (reuse)', () => M.serializeReusingSharedDictionaries(clone).length);
console.table(rows);
console.log('TOTAL retained over seed:', Math.round(last - rows[0].heapMB), 'MB', plan ? `heavy blobs ${[...plan.blobs.values()].reduce((a, s) => a + s.length, 0) >> 20}MB chars` : '');
