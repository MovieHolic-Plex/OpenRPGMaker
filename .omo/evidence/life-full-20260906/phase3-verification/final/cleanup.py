import pathlib, subprocess, json, hashlib, shutil, os
root=pathlib.Path.cwd(); out=root/'.omo/evidence/life-full-20260906/phase3-verification/final'
identity=json.loads((out/'identity.json').read_text()); producer=pathlib.Path('/home/main/z-project/rpg-zzu-life-full-field-input')
def git(*args,cwd=root):
 p=subprocess.run(['git',*args],cwd=cwd,text=True,capture_output=True)
 return {'command':['git',*args],'cwd':str(cwd),'exit':p.returncode,'stdout':p.stdout,'stderr':p.stderr}
checks=[git('diff','--exit-code'),git('diff','--cached','--exit-code'),git('diff','--check','48195f575^..HEAD','--','src','test')]
assert all(c['exit']==0 for c in checks)
assert git('rev-parse','HEAD')['stdout'].strip()==identity['head']
assert git('rev-parse','HEAD',cwd=producer)['stdout'].strip()==identity['head']
files=json.loads((out/'changed-files.json').read_text()); manifest=[]
for path in files:
 data=(root/path).read_bytes(); result=git('rev-parse',f'HEAD:{path}')
 manifest.append({'path':path,'sha256':hashlib.sha256(data).hexdigest(),'blob':result['stdout'].strip(),'equalsProducer':data==(producer/path).read_bytes()})
assert all(row['equalsProducer'] for row in manifest)
(out/'source.json').write_text(json.dumps({'head':identity['head'],'tree':identity['tree'],'files':manifest},indent=2)+'\n')
removed=[]
for path in [root/'dist',root/'output/edit-activity',out/'native-storage',out/'build-cache',out/'editor-cache',out/'probe-cache',out/'priority-cache',out/'ssr-cache',out/'forage-date-cache',out/'native/player-cache']:
 assert not path.is_symlink(),str(path)
 assert not git('ls-files','--',str(path.relative_to(root)))['stdout'],str(path)
 if path.exists():
  contents=[p for p in path.rglob('*') if p.is_file()] if path.is_dir() else [path]
  record={'path':str(path.relative_to(root)),'files':len(contents),'bytes':sum(p.stat().st_size for p in contents),'removed':True}
  if path.is_dir():shutil.rmtree(path)
  else:path.unlink()
 else:record={'path':str(path.relative_to(root)),'absent':True}
 removed.append(record)
processes=[]
for p in pathlib.Path('/proc').iterdir():
 if not p.name.isdigit():continue
 try:
  cwd=(p/'cwd').resolve();cmd=(p/'cmdline').read_bytes().replace(b'\0',b' ').decode(errors='replace')
 except (OSError,RuntimeError):continue
 if cwd==root and ('node ' in cmd or 'firefox' in cmd or 'chromium' in cmd):processes.append({'pid':p.name,'cmd':cmd})
ss=subprocess.run(['ss','-ltnp',f'sport = :{identity["port"]}'],capture_output=True,text=True)
assert len(ss.stdout.strip().splitlines())==1,ss.stdout
assert not processes,processes
checks += [git('status','--short'),git('status','--short',cwd=producer),git('rev-parse','HEAD','HEAD^{tree}'),git('rev-parse','HEAD','HEAD^{tree}',cwd=producer)]
ancestors=[]
for commit in ['48195f5753556572db0c13e40f6945b9547bbea3','9cb85be84746d84789497a1d4297d0c8416d86c8','98b099f8d73a3d36be96fef17746f48fe5f027fe','27db0af0021fb49414723b64141a0e1c568b8069','038ff8b47b127e604dad6a5c5cb50597ef543c20']:
 r=git('merge-base','--is-ancestor',commit,'HEAD');assert r['exit']==0;ancestors.append(r)
original=pathlib.Path('/home/main/z-project/rpg-zzu-life-full-p3/.omo/evidence/life-full-20260906/phase3-parent-checks/forage-date.mjs')
assert original.read_bytes()==(out/'forage-date.mjs').read_bytes()
receipt={'checks':checks,'ancestors':ancestors,'removed':removed,'listener':{'command':['ss','-ltnp',f'sport = :{identity["port"]}'],'exit':ss.returncode,'output':ss.stdout},'remainingOwnedRuntimeProcesses':processes,'parentProbeCopyIdentical':True,'imageReadResult':'Current model does not support images; no image-level approval','preserved':['tracked .vite-cache/deps','shared node_modules and caches','ignored .env.local','all inherited/parent evidence','detached locked verification worktree; parent owns archival/removal']}
(out/'cleanup.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt,indent=2))
