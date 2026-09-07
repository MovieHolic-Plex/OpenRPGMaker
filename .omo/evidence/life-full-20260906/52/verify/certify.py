import hashlib,json,os,pathlib,subprocess
R=pathlib.Path('/home/main/z-project/rpg-zzu-life-full-p4');E=R/'.omo/evidence/life-full-20260906/52/verify';P=E.parent/'producer'
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def dump(p,o): p.write_text(json.dumps(o,indent=2)+'\n')
def command(label,argv):
 r=subprocess.run(argv,cwd=R,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0'))
 dump(E/(label+'.command.json'),{'cwd':str(R),'argv':argv});(E/(label+'.stdout')).write_bytes(r.stdout);(E/(label+'.stderr')).write_bytes(r.stderr);(E/(label+'.exit')).write_text(str(r.returncode)+'\n');return r
h=json.loads((P/'SOURCE-HANDOFF.json').read_text());initial=json.loads((E/'initial.json').read_text())
assert h['carryoverBefore']==h['carryoverAfter']
assert len(h['carryoverBefore'])==14
for p,s in h['carryoverBefore'].items(): assert sha(R/p)==s,p
assert (E/'actual-product.diff').read_bytes()==(P/'product-diff.stdout').read_bytes()
assert sha(P/'scoped.diff')==h['scopedDiff']['sha256']
assert sha(R/h['correction']['path'])==h['correction']['sha256']
assert sha(R/h['newTest']['path'])==h['newTest']['sha256']
assert (R/h['newTest']['path']).read_bytes()==(P/'red-contract.test.ts').read_bytes()
b=command('baseline-source',['git','show','HEAD:src/project/databaseRecordModel.ts']);assert b.returncode==0;assert b.stdout==(P/'databaseRecordModel.before.ts').read_bytes()
for label in ['diagnostics','focused','public-probe','typecheck-app']:
 assert (E/(label+'.exit')).read_text().strip()=='0'
 assert json.loads((E/(label+'.before.json')).read_text())==initial
 assert json.loads((E/(label+'.after.json')).read_text())==initial
 assert json.loads((E/(label+'.cleanup.json')).read_text())['removed']
for argv,label in [(['git','diff','--check'],'whitespace'),(['node','--check',str(E/'diagnostics.mjs')],'diagnostics-syntax'),(['node','--check',str(E/'probe-runner.mjs')],'probe-runner-syntax')]:
 result=command(label,argv);assert result.returncode==0,(label,result.stderr.decode())
# Test is intentionally untracked; retain the actual nonempty new-file diff and direct exit1.
r=command('new-test-diff',['git','diff','--no-index','--','/dev/null','test/playerBodyProjectPersistence.test.ts']);assert r.returncode==1 and r.stdout and not r.stderr
for f in ['HANDOFF.md','SOURCE-HANDOFF.json','scoped.diff','baseline.test.ts','red.test.ts','red-contract.test.ts','databaseRecordModel.before.ts']:
 assert (P/f).is_file()
producer={str(p.relative_to(P)): {'sha256':sha(p),'bytes':p.stat().st_size} for p in sorted(P.iterdir()) if p.is_file()}
dump(E/'producer-original-manifest.json',producer)
captures={str(p.relative_to(E)): {'sha256':sha(p),'bytes':p.stat().st_size} for p in sorted((E/'captures').iterdir()) if p.is_file()}
dump(E/'capture-manifest.json',captures)
dump(E/'preservation.json',{'head':h['head'],'normalizer':h['correction'],'newTest':h['newTest'],'carryover':h['carryoverBefore'],'producerCarryoverBeforeAfterEqual':True,'allValidatorIdentitiesEqual':True,'initialIndexSha256':initial['index'],'model':os.environ.get('PI_MODEL'),'captures':len(captures),'captureBytes':sum(v['bytes'] for v in captures.values()),'sourceReadOnly':True,'gitMutation':False,'fullBuildRun':False,'nativeRun':False})
print(json.dumps({'status':'confirmed','requiredFixes':0,'model':os.environ.get('PI_MODEL'),'carryoverFilesUnchanged':14,'captures':len(captures),'captureBytes':sum(v['bytes'] for v in captures.values()),'producerOriginalsHashed':len(producer)},indent=2))
