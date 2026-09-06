import pathlib, subprocess, json, hashlib, os, time, shutil
R=pathlib.Path('/home/main/z-project/rpg-zzu-life-full-receipts-parent-astra')
E=R/'.omo/evidence/life-full-20260906/receipt-parent-astra'
S=pathlib.Path('/dev/shm/st_01a078c8-receipt-parent-astra')
P=pathlib.Path('/home/main/z-project/rpg-zzu-life-full-p4/.omo/evidence/life-full-20260906/phase4-parent/payment-capacity-probe.mjs')
files=['src/project/lifeRecovery.ts','src/project/spatialPlacementTransactions.ts','test/spatialPaymentReceipts.test.ts','openwiki/runtime-project-schema.md']
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def git(*args): return subprocess.check_output(['git',*args],cwd=R,text=True).strip()
def identity(): return {'head':git('rev-parse','HEAD'),'tree':git('rev-parse','HEAD^{tree}'),'sourceHashes':{p:digest(R/p) for p in files},'probeHash':digest(P),'trackedStatus':git('status','--porcelain','--untracked-files=no')}
def save(n,d): (E/(n+'.json')).write_text(json.dumps(d,indent=2)+'\n')
def run(n,seconds,args):
 cmd=['flock','--timeout','900','/tmp/rpg-zzu-life-full-qa-01a0727b.lock','timeout','--signal=TERM','--kill-after=15s',str(seconds)+'s',*args]
 before=identity(); started=time.time()
 with (E/(n+'.stdout')).open('w') as out,(E/(n+'.stderr')).open('w') as err:
  result=subprocess.run(cmd,cwd=R,env=env,stdout=out,stderr=err)
 receipt={'command':cmd,'cwd':str(R),'environmentOverrides':overrides,'startedEpoch':started,'endedEpoch':time.time(),'exit':result.returncode,'before':before,'after':identity(),'stdout':n+'.stdout','stderr':n+'.stderr'}
 save(n,receipt); print(n,result.returncode,flush=True); return result.returncode
assert not S.exists()
assert identity()['head']=='0e2af2591f33bab3e1f56f1847e499a1cce0681f'
assert not identity()['trackedStatus']
save('initial',{'identity':identity(),'disk':subprocess.check_output(['df','-B1',str(R),'/dev/shm'],text=True),'model':os.getenv('PI_MODEL'),'adoption':{'command':['node','scripts/agent-worktree.mjs','adopt','--path',str(R)],'exit':0,'stdout':'adoption.stdout','stderr':'adoption.stderr'},'worktree':git('worktree','list','--porcelain')})
# Adoption copies ignored environment files; remove only new-tree copies to prevent remote credentials entering validation.
removedEnv=[]
for n in ['.env','.env.local']:
 p=R/n
 if p.exists(): p.unlink(); removedEnv.append(n)
S.mkdir(); (S/'tmp').mkdir(); (S/'dist').mkdir(); (S/'probe').mkdir()
assert not (R/'dist').exists(); (R/'dist').symlink_to(S/'dist',target_is_directory=True)
overrides={'TMPDIR':str(S/'tmp'),'VITE_CACHE_DIR':str(S/'vite-cache'),'npm_config_cache':str(S/'npm-cache')}
env={**os.environ,**overrides}
results={}
try:
 results['parent-probe']=run('parent-probe',180,['node',str(P),str(S/'probe/payment-capacity-green.json')])
 if (S/'probe/payment-capacity-green.json').exists(): shutil.copy2(S/'probe/payment-capacity-green.json',E/'payment-capacity-green.json')
 producer=json.loads((R/'.omo/evidence/life-full-20260906/11/receipt-correction/green-final.json').read_text())
 tests=[x for x in producer['command'] if x.startswith('test/') and x!='test/p2SpatialPlayIntegration.test.ts']
 results['focused-tests']=run('focused-tests',360,['npm','test','--',*tests,'--config',str(E/'vitest.config.ts'),'--configLoader','runner'])
 results['diagnostics']=run('diagnostics',180,['node',str(E/'diagnostics.mjs')])
 results['typecheck']=run('typecheck',180,['npm','run','typecheck:app'])
 results['build']=run('build',900,['npm','run','build'])
 outputs={str(p.relative_to(S/'dist')):{'bytes':p.stat().st_size,'sha256':digest(p)} for p in sorted((S/'dist').rglob('*')) if p.is_file()}
 save('build-artifact-hashes',outputs)
 save('results',results)
finally:
 final=identity()
 (R/'dist').unlink()
 shutil.rmtree(S)
 # Canonical dependency link is adoption infrastructure, retained for parent archival; no shared targets touched.
 save('cleanup',{'identity':final,'sourceUnchanged':final==json.loads((E/'initial.json').read_text())['identity'],'ownedScratch':str(S),'scratchAbsent':not S.exists(),'distLinkAbsent':not (R/'dist').is_symlink(),'adoptedEnvironmentCopiesRemoved':removedEnv,'dependencyLinkRetained':str((R/'node_modules').readlink()),'sharedCleanup':False,'browserStarted':False,'nativeSceneStarted':False,'probeCleanup':json.loads((E/'payment-capacity-green.json').read_text()).get('cleanup') if (E/'payment-capacity-green.json').exists() else None,'worktree':git('worktree','list','--porcelain')})
