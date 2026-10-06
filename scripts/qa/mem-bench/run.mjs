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
await step('409 blobs (rebuild + verify, dropped)', async () => { if (plan) { const b = await M.withHeavyBlobs(plan, 'bench', [...plan.blobs.keys()]); const ok = Object.keys(b.heavyBlobs ?? {}).sort().join() === Object.values(b.heavy ?? {}).sort().join(); if (!ok || b.heavy !== plan.body.heavy) console.log('HASH CHANGED', b.heavy, plan.body.heavy); } });
const clone = await step('checkpoint clone', () => M.cloneProjectSharingSharedDictionaries(project));
await step('clone identity digest', () => M.projectIdentityDigest(clone, 'proposal'));
await step('clone lint roundtrip', () => M.warmRoundtripCheck(clone));
await step('clone heavy wire plan', () => M.planHeavyWire({ project: clone }));
await step('untrusted re-digest (save receipt / visual fingerprint)', () => M.jsonContentDigest(clone));
await step('save serialize (reuse)', () => M.serializeReusingSharedDictionaries(clone).length);
// 글자 동일성: 조립한 글이 JSON.stringify 와 같아야 해시·저장이 그대로다.
for (const [name, p] of [['project', project], ['clone', clone]]) {
  const same = M.serializeReusingSharedDictionaries(p) === M.serialize(p)
    && M.stringifySharedDictionary(p.tilesets) === JSON.stringify(p.tilesets)
    && M.stringifyAssets(p.assets) === JSON.stringify(p.assets);
  M.deserialize(M.serializeForRoundtripCheck(p));
  console.log(`byte-identical ${name}:`, same);
  if (!same) process.exitCode = 1;
}
console.table(rows);
console.log('TOTAL retained over seed:', Math.round(last - rows[0].heapMB), 'MB', plan ? `heavy keys ${[...plan.blobs.values()].map(s => s.key).join(',')}` : '');
