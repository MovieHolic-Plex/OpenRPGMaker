import os, pathlib, json, hashlib, subprocess, datetime
R=pathlib.Path('/home/main/z-project/rpg-zzu-life-full-p4'); os.chdir(R)
E=R/'.omo/evidence/life-full-20260906/12/ui/build-r3'; P=E.parent/'producer-r3'
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()
def save(n,v): (E/n).write_text(json.dumps(v,indent=2,ensure_ascii=False)+'\n')
def cmd(a):return subprocess.check_output(a,text=True).strip()
H=json.loads((P/'SOURCE-HANDOFF.json').read_text()); declared={x['path']:x['sha256'] for x in H['changed']+H['task52Frozen']}
def snapshot():
 files=cmd(['git','ls-files','src','test','scripts','public','vendor','package.json','package-lock.json','tsconfig*.json','vite*.ts']).splitlines()
 files=sorted(set(files)|set(declared))
 return {'head':cmd(['git','rev-parse','HEAD']),'index':sha(pathlib.Path(cmd(['git','rev-parse','--git-path','index']))),'status':cmd(['git','status','--porcelain=v1','-uall']),'hashes':{f:sha(R/f) for f in files if (R/f).is_file()},'declaredMatches':all(sha(R/f)==h for f,h in declared.items()),'docs':{f:sha(R/f) for f in H['wikiCurrentSha256']},'producer':{str(f.relative_to(P)):sha(f) for f in sorted(P.rglob('*')) if f.is_file()}}
if __name__=='__main__':
 s=snapshot();save('initial-identity.json',s);assert s['declaredMatches'];assert s['head']==H['head']
 statuspaths=cmd(['git','ls-files','--modified','--others','--exclude-standard']).splitlines();unknown=sorted(set(statuspaths)-set(declared)-set(H['wikiCurrentSha256']));assert not unknown,unknown
 save('scope.json',{'declared':declared,'unknown':unknown,'wikiCarryoverMatches':all(sha(R/f)==h for f,h in H['wikiCurrentSha256'].items())})
 processes=[]
 for p in pathlib.Path('/proc').iterdir():
  if not p.name.isdigit():continue
  try:
   cwd=os.readlink(p/'cwd');args=(p/'cmdline').read_bytes().replace(b'\0',b' ').decode(errors='replace')
   if cwd==str(R) or str(R) in args:
    processes.append({'pid':int(p.name),'cwd':cwd,'argv':args if len(args)<1800 else args[:1800]+' [truncated]'})
  except (OSError,PermissionError):pass
 save('writer-check.json',{'processes':processes,'inspection':'No producer/native source writer observed; child execution and inspection processes are retained. Parent handoff declares serial source freeze.'})
 for label,base in [('task52',R/'.omo/evidence/life-full-20260906/52/verify/focused.before.json'),('core355',R/'.omo/evidence/life-full-20260906/47-48/r3/verify-r2/tests.before.json')]:
  old=json.loads(base.read_text())['hashes'];comparisons=[]
  for f,h in s['hashes'].items():
   if f in old:comparisons.append({'path':f,'expected':old[f],'actual':h,'equal':old[f]==h,'declaredCombinedChange':f in declared})
  save(label+'-source-comparison.json',{'base':str(base),'baseSha256':sha(base),'comparisons':comparisons,'unexpectedDifferences':[x for x in comparisons if not x['equal'] and not x['declaredCombinedChange']],'declaredDifferences':[x for x in comparisons if not x['equal'] and x['declaredCombinedChange']]})
 n=json.loads((P/'native/native-qa-final-evidence.json').read_text());steps=n['steps'];raw=json.loads((P/'native/raw-slot-1.json').read_text());parsed=json.loads((P/'native/raw-slot-1.parsed.json').read_text());fixture=json.loads((P/'native/fixture.json').read_text());remote=json.loads((P/'native/remote-proof.json').read_text());owner=raw.get('session',raw)
 loaded=next(x for x in steps if x['step']=='load-restored')
 save('native-audit.json',{'steps':[x for x in steps if x['step'] not in ['menu-step','walk-step','open-spaces-start','menu-close-step','menu-closed-idle']], 'terminal':{k:v for k,v in n.items() if k not in ['steps','screenshots']},'rawBuildingsEqualParsed':owner['farmBuildingPlacements']==parsed['buildings'],'rawDecorationsEqualParsed':owner['homeDecorationPlacements']==parsed['decorations'],'rawBuildingsEqualLoaded':owner['farmBuildingPlacements']==loaded['loadedBuildings'],'rawPlotsEqualParsed':owner['farmPlots']==parsed['farmPlots'],'fixtureSha256':sha(P/'native/fixture.json'),'remoteSha256':remote['sha256'],'fixtureBody':fixture['system'].get('playerFootprint'),'fixturePassRows':fixture['system'].get('playerPassRows'),'screenshots':[{'path':str(f.relative_to(P)),'sha256':sha(f),'bytes':f.stat().st_size} for f in sorted((P/'native').glob('*.png'))],'finalAliasesEqual':{suffix:(P/f'native/native-qa-final.{suffix}').read_bytes()==(P/f'native/native-qa-18.{suffix}').read_bytes() for suffix in ['log','stderr','exit']},'finalEvidenceAliasEqual':(P/'native/native-qa-final-evidence.json').read_bytes()==(P/'native/native-evidence.json').read_bytes(),'unexpectedTimeoutFallbackObserved':any(x['step'] in ['rug-walk-down-failed','last-exit-face-right'] for x in steps),'scriptCaveat':'equipHoe catches message timeout; walk-onto-rug and last-exit movement have failure fallbacks. Final log shows digit1 equipped in under 4s and no movement failure branch; no actual swallowed timeout established. Last-exit false is only noted, not asserted.'})
 print(json.dumps({'declaredMatches':s['declaredMatches'],'unknown':unknown,'producerFiles':len(s['producer']),'sourceFiles':len(s['hashes'])}))
