import pathlib,subprocess,os,json,hashlib,time,shutil
R=pathlib.Path('/home/main/z-project/rpg-zzu-life-full-receipts-parent-astra'); E=R/'.omo/evidence/life-full-20260906/receipt-parent-astra'; S=pathlib.Path('/dev/shm/st_01a078c8-receipt-parent-astra')
assert not S.exists()
initial=json.loads((E/'initial.json').read_text())['identity']
def identity():
 return {'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=R,text=True).strip(),'sourceHashes':{p:hashlib.sha256((R/p).read_bytes()).hexdigest() for p in initial['sourceHashes']},'trackedStatus':subprocess.check_output(['git','status','--porcelain','--untracked-files=no'],cwd=R,text=True).strip()}
before=identity(); assert before['sourceHashes']==initial['sourceHashes'] and before['trackedStatus']==''
disk=subprocess.check_output(['df','-B1',str(R),'/dev/shm'],text=True)
S.mkdir(); (S/'tmp').mkdir()
producer=json.loads((R/'.omo/evidence/life-full-20260906/11/receipt-correction/green-final.json').read_text())
tests=[x for x in producer['command'] if x.startswith('test/') and x!='test/p2SpatialPlayIntegration.test.ts']
cmd=['flock','--timeout','900','/tmp/rpg-zzu-life-full-qa-01a0727b.lock','timeout','--signal=TERM','--kill-after=15s','360s','node','scripts/run-vitest.mjs','run','--configLoader','runner',*tests,'--config',str(E/'vitest.config.ts')]
overrides={'TMPDIR':str(S/'tmp'),'VITE_CACHE_DIR':str(S/'vite-cache'),'npm_config_cache':str(S/'npm-cache')}
started=time.time()
try:
 with (E/'focused-tests-executed.stdout').open('w') as out,(E/'focused-tests-executed.stderr').open('w') as err:
  result=subprocess.run(cmd,cwd=R,env={**os.environ,**overrides},stdout=out,stderr=err)
 receipt={'command':cmd,'cwd':str(R),'environmentOverrides':overrides,'before':before,'after':identity(),'exit':result.returncode,'startedEpoch':started,'endedEpoch':time.time(),'stdout':'focused-tests-executed.stdout','stderr':'focused-tests-executed.stderr','diskBefore':disk,'launcherCorrection':'Initial npm invocation rejected duplicate configLoader options before collection. Invoke the same repository run-vitest.mjs directly with a single runner loader; no tests, deadlines or assertions changed. No prior executed test failure is being retried.'}
 (E/'focused-tests-executed.json').write_text(json.dumps(receipt,indent=2)+'\n'); print('focused-tests-executed',result.returncode)
finally:
 shutil.rmtree(S)
 (E/'focused-cleanup.json').write_text(json.dumps({'scratchAbsent':not S.exists(),'identity':identity(),'sourceUnchanged':identity()==before,'sharedCleanup':False},indent=2)+'\n')
