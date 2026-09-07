"""Create NEW r3 artifacts from read recovered scripts, not historical launchers."""
import receipt as r
import gzip,hashlib,json
B=r.P/'.omo/evidence/life-full-20260906/51/recovered-created'
p=gzip.decompress((B/'r2-final-recorded-patches/public-rights.mts.gz').read_bytes()).decode()
p=p.replace('../../../../../src/',str(r.W)+'/src/')
p=p.replace('const root = realpathSync(fileURLToPath(new URL("../../../../../", import.meta.url)));','const root = realpathSync("'+str(r.W)+'");')
p=p.replace('assert.equal(root, "/home/main/z-project/rpg-zzu-life-full-spatial-rights");','assert.equal(root, "'+str(r.W)+'");')
p=p.replace('"src/player/saveSlots.ts", "src/project/session.ts"','"src/player/saveSlots.ts", "src/project/session.ts", "src/project/defaults.ts", "src/project/itemQuantities.ts"')
p=p.replace('  const original = structuredClone(session.farmBuildingPlacements?.b1);','  captures.push({ label: "public-paid-placement", after: structuredClone(session) });\n  const original = structuredClone(session.farmBuildingPlacements?.b1);')
p=p.replace('  const ordinary = structuredClone(paid);','''  const typesBefore = structuredClone(project.database.homeDecorationTypes);
  for (const mode of ["changed", "deleted"] as const) {
    project.database.homeDecorationTypes = mode === "deleted" ? [] : (typesBefore ?? []).map(type => ({ ...type, placementItemId: "not-the-paid-item" }));
    const ordinaryCase = structuredClone(paid);
    const before = structuredClone(ordinaryCase);
    assert.equal(removeHomeDecoration(project, ordinaryCase, "r1").ok, true);
    assert.equal(ordinaryCase.inventory[itemId], 9);
    assert.equal(ordinaryCase.inventory["not-the-paid-item"], undefined);
    const after = structuredClone(ordinaryCase);
    assert.deepEqual(removeHomeDecoration(project, ordinaryCase, "r1"), { ok: false, reason: "missing" });
    assert.deepEqual(ordinaryCase, after);
    captures.push({ label: `ordinary-${mode}-definition`, before, after, repeatedAfter: structuredClone(ordinaryCase) });
    const incompatible = structuredClone(paid);
    incompatible.farmPlots = { [mapId]: { "10,5": { tilled: true, watered: false } } };
    let restored = roundtrip(`decoration-${mode}-definition`, incompatible);
    const claim = Object.values(restored.lifeRecovery?.claims ?? {}).find(claim => claim.sourceId === "r1");
    assert.ok(claim);
    assert.deepEqual(claim.items, [{ itemId, count: 1 }]);
    const beforeCollect = structuredClone(restored);
    assert.equal(collectLifeRecoveryClaim(project, restored, claim.id).ok, true);
    assert.equal(restored.inventory[itemId], 9);
    captures.push({ label: `decoration-${mode}-collection`, before: beforeCollect, after: structuredClone(restored) });
    restored = roundtrip(`decoration-${mode}-collected`, restored);
    assert.equal(restored.inventory[itemId], 9);
  }
  const ordinary = structuredClone(paid);''')
p=p.replace('  const unknown = structuredClone(paid);','  let unknown = structuredClone(paid);')
p=p.replace('  const unknownClaim = Object.values(unknown.lifeRecovery?.claims ?? {})[0];','  unknown = roundtrip("unknown-item-before-collection", unknown);\n  const unknownClaim = Object.values(unknown.lifeRecovery?.claims ?? {}).find(claim => claim.sourceId === "r1");')
p=p.replace('  project.database.items.push(item);\n  assert.equal(collectLifeRecoveryClaim', '  project.database.items.push(item);\n  const restoredUncollected = roundtrip("restored-item-no-automatic-payout", unknown);\n  assert.deepEqual(restoredUncollected.inventory, unknown.inventory);\n  unknown = restoredUncollected;\n  assert.equal(collectLifeRecoveryClaim')
# Unknown-item Save reconciliation can preserve/remove inventory under existing policy; assert proven delta, not guessed balance.
p=p.replace('  assert.equal(unknown.inventory[itemId], 9);','  assert.equal(unknown.inventory[itemId], (unknownBefore.inventory[itemId] ?? 0) + 1);\n  unknown = roundtrip("restored-item-explicitly-collected", unknown);')
p='// NEW r3 public API evidence; adapted from recovered final r2 script.\n'+p
(r.E/'public-rights.mts').write_text(p)
d=gzip.decompress((B/'r2-line84/diagnostics.mjs.gz').read_bytes()).decode()
d=d.replace('from "typescript"','from "'+str(r.W)+'/node_modules/typescript/lib/typescript.js"')
d=d.replace('.omo/evidence/life-full-20260906/47-48/r2/public-rights.mts',str(r.E/'public-rights.mts'))
(r.E/'diagnostics.mjs').write_text('// NEW r3 configured diagnostics.\n'+d)
runner=gzip.decompress((B/'r2-line84/run-final.sh.gz').read_bytes()).decode()
tests=next(line for line in runner.splitlines() if line.startswith('run tests ')).split()[3:]
commands=[('diagnostics',360,['node',str(r.E/'diagnostics.mjs')]),('tests',420,tests),('public-rights',360,['node','node_modules/vite-node/vite-node.mjs','--config','vitest.config.ts',str(r.E/'public-rights.mts')]),('typecheck',360,['npm','run','typecheck:app']),('build',900,['npm','run','build']),('diff-check',60,['git','diff','--check'])]
(r.E/'final-commands.json').write_text(json.dumps(commands,indent=2))
(r.E/'adaptation.json').write_text(json.dumps({'new_attempt':'r3','source_root':str(r.W),'probe_source_sha256':hashlib.sha256(gzip.decompress((B/'r2-final-recorded-patches/public-rights.mts.gz').read_bytes())).hexdigest(),'changes':['Absolute project imports and root assertion','Durable external evidence outputs','Extra whole-state changed/deleted-definition and unknown/restored-save captures','Configured TypeScript import into R3 dependency link','Exact recovered eighteen-file test argv; original deadlines retained'],'project_imports':[line for line in p.splitlines() if ' from "'+str(r.W)+'/src/' in line]},indent=2))
