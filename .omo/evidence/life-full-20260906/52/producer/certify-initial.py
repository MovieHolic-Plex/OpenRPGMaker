import hashlib, json, pathlib, subprocess
ROOT = pathlib.Path('/home/main/z-project/rpg-zzu-life-full-p4')
E = ROOT / '.omo/evidence/life-full-20260906/52/producer'
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def save(name, value): (E/name).write_text(json.dumps(value, indent=2)+'\n')
def command(label, argv):
    r = subprocess.run(argv, cwd=ROOT, capture_output=True)
    save(label+'.command.json', {'cwd':str(ROOT), 'argv':argv})
    (E/(label+'.stdout')).write_bytes(r.stdout)
    (E/(label+'.stderr')).write_bytes(r.stderr)
    (E/(label+'.exit')).write_text(str(r.returncode)+'\n')
    return r
head = subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT).decode().strip()
assert head == 'ea6b2b358088cb6061783f6ffd162169764a07e9'
before = json.loads((E/'carryover-before.json').read_text())
after = {p:sha(ROOT/p) for p in before}
assert before == after
save('carryover-after.json', after)
build = json.loads((ROOT/'.omo/evidence/life-full-20260906/12/ui/build-r2/final-identity.json').read_text())
assert all(after[p] == h for p,h in {**build['source'], **build['docs']}.items())
assert len(after)==14
source='src/project/databaseRecordModel.ts'; test='test/playerBodyProjectPersistence.test.ts'
initial = json.loads((E/'baseline.before.json').read_text())['sha256']
final = json.loads((E/'typecheck-app.after.json').read_text())['sha256']
changed = [p for p in initial if initial[p] != final.get(p)]
assert sorted(changed)==sorted([source,test])
assert (E/'red-contract.test.ts').read_bytes()==(ROOT/test).read_bytes()
assert (E/'databaseRecordModel.before.ts').read_bytes()==subprocess.check_output(['git','show','HEAD:'+source],cwd=ROOT)
for label, expected in [('baseline',0),('red',1),('red-contract',1),('diagnostics',0),('green',0),('public-probe',0),('typecheck-app',0)]:
    assert int((E/(label+'.exit')).read_text())==expected
    pre=json.loads((E/(label+'.before.json')).read_text()); post=json.loads((E/(label+'.after.json')).read_text())
    assert pre==post
    cleanup=json.loads((E/(label+'.cleanup.json')).read_text())
    assert cleanup['removed'] and not pathlib.Path(cleanup['scratch']).exists()
assert command('whitespace', ['git','diff','--check']).returncode==0
# --no-index reports 1 for a clean nonempty addition; --check reports 0 when whitespace is clean.
assert command('whitespace-new-test', ['git','diff','--no-index','--check','/dev/null',test]).returncode==0
assert command('probe-runner-syntax', ['node','--check',str(E/'probe-runner.mjs')]).returncode==0
assert command('diagnostics-runner-syntax', ['node','--check',str(E/'diagnostics.mjs')]).returncode==0
assert command('index-unchanged', ['git','diff','--cached','--exit-code']).returncode==0
product_diff = command('product-diff', ['git','diff','--',source]); assert product_diff.returncode==0
new_diff = command('test-diff', ['git','diff','--no-index','/dev/null',test]); assert new_diff.returncode==1
(E/'scoped.diff').write_bytes(product_diff.stdout+new_diff.stdout)
status=command('final-status',['git','status','--short']); assert status.returncode==0
save('preservation.json', {'head':head,'carryoverCount':14,'uiAndTests':11,'wiki':3,'carryoverBeforeEqualsAfter':True,'matchesProducerR2SourceAndBuildR2SourceDocs':True,'onlyChangedAcrossTrackedVerificationInputs':changed,'finalTestEqualsBehavioralRedTest':True,'sourceBeforeEqualsHEAD':True,'eachValidationBeforeEqualsAfter':True})
save('cleanup.json', {'runtimeScratchRemoved':True,'commandCleanupReceipts':[p.name for p in sorted(E.glob('*.cleanup.json'))],'probeLoaderClosed': 'Public probe Vite module loader closed' in (E/'public-probe.stdout').read_text(),'httpListenerStarted':False,'browserStarted':False,'remoteWrites':False,'evidenceRemoved':False,'indexUnchanged':True,'build':'not run; explicitly owned by later final combined Task12 CLI node','frozenUncommitted':True})
receipts = {label: {'exit':int((E/(label+'.exit')).read_text()),'command':label+'.command.json','stdout':label+'.stdout','stderr':label+'.stderr','beforeIdentity':label+'.before.json','afterIdentity':label+'.after.json','cleanup':label+'.cleanup.json'} for label in ['baseline','red','red-contract','diagnostics','green','public-probe','typecheck-app']}
save('SOURCE-HANDOFF.json', {
 'task':'52','taskId':'st_01a07af2','status':'FROZEN UNCOMMITTED','head':head,'worktree':str(ROOT),
 'correction':{'path':source,'beforeSha256':sha(E/'databaseRecordModel.before.ts'),'sha256':sha(ROOT/source),'bytes':(ROOT/source).stat().st_size,'addedLines':7},
 'newTest':{'path':test,'sha256':sha(ROOT/test),'bytes':(ROOT/test).stat().st_size,'tests':22},
 'carryoverBefore':before,'carryoverAfter':after,'carryoverUnchanged':True,
 'scopedDiff':{'path':'scoped.diff','sha256':sha(E/'scoped.diff')},
 'publicProbe':{'path':'public-probe.ts','sha256':sha(E/'public-probe.ts'),'runnerSha256':sha(E/'probe-runner.mjs'),'inputSha256':sha(E/'public-input.json'),'resultSha256':sha(E/'public-result.json')},
 'coreAcceptance':str(ROOT/'.omo/evidence/life-full-20260906/47-48/VERIFY.md'),
 'canonicalPlan':'/home/main/.herdr/worktrees/rpg-zzu/wish-html/.omo/plans/life-systems-full-implementation.md',
 'receipts':receipts,'counts':{'baseline':{'passed':28,'files':5},'initialRed':{'failed':20,'passed':2},'contractCorrectedRed':{'failed':20,'passed':2},'green':{'passed':135,'files':9}},
 'originalRedRetained':True,'testContractCorrection':'Initial RED expected malformed wire values to normalize. Existing strict shape validation instead rejects them. Final test preserves all cases, asserts rejection, then separately checks direct helper normalization. Exact final test failed before product edit; no test skipped or removed.',
 'diagnostics':'configured tsconfig.json source/test plus explicit evidence probe root; zero diagnostics before app typecheck',
 'saveBoundary':'Existing Save4->5 tests pass; probe applies Save5 without session body overrides. No override persistence contract invented.',
 'build':{'run':False,'owner':'later final combined Task12 CLI delivery after native prerequisites','waived':False},
 'docsBrief':'WIKI-BRIEF.md','cleanup':'cleanup.json','preservation':'preservation.json',
 'approvals':{'task12':False,'native':False,'phase4':False,'overall':False},'commitCreated':False
})
print(json.dumps({'head':head,'productSha256':sha(ROOT/source),'testSha256':sha(ROOT/test),'carryoverPreserved':len(after),'green':135,'frozenUncommitted':True},indent=2))
