"""Bounded supervisor for the currently authorized50-species production job.
No drawing/review fabrication. Existing harness commands and dashboard guards
perform all acceptance/audits. Root final art review remains required.
"""
from pathlib import Path
import json,sys,os,time,subprocess,argparse,fcntl
repo=Path(__file__).resolve().parents[1];os.chdir(repo)
sys.path.insert(0,str(repo/'src/harnesses/battle-monster/node'))
from pipeline import Harness,load,save,stamp
from accept_batch import request
work=repo/'qa-runs/battle-monster-fifty-wave';planfile=repo/'harness-data/battle-monster/fifty-monsters-plan.json';plan=load(planfile)
assert plan['count']==50 and len(plan['roster'])==50
assert plan['authorization']['originalUserText'] in (work/'authorization.txt').read_text()
assert load(work/'pilot-root-review.json')['passed'] is True
public=repo/'qa-runs/harnesses/battle-monster';statefile=work/'observer-controller.json'
state={'state':'running','startedAt':stamp(),'expectedSpecies':50,'goalCompleteClaim':False,'actions':[],'browserVerified':[]}
last_signature=None;round_number=0

def command(argv,tag):
 path=work/('observer-'+tag+'.log')
 with path.open('a') as log:
  result=subprocess.run(argv,stdout=log,stderr=subprocess.STDOUT,cwd=repo)
 state['actions'].append({'at':stamp(),'stage':tag,'exitCode':result.returncode,'log':str(path.relative_to(repo))})
 save(statefile,state)
 return result.returncode

def harness(stage,*args):
 return ['npm','run','harness','--','battle-monster',stage,*map(str,args)]

def production_live():
 result=subprocess.run(['systemctl','--user','show','oprn-battle-fifty-early-20261006.service','oprn-battle-fifty-rest-20261006.service','--property=MainPID,ActiveState'],capture_output=True,text=True)
 for group in result.stdout.strip().split('\n\n'):
  props=dict(line.split('=',1) for line in group.splitlines() if '=' in line)
  pid=int(props.get('MainPID','0'))
  if props.get('ActiveState')=='active' and pid and Path('/proc',str(pid)).exists():return True
 return False

with (work/'observer.lock').open('a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 save(statefile,state)
 while True:
  try:
   dashboard=request('http://127.0.0.1:18346','/api/state');items={i['key']:i for i in dashboard['items']}
   eligible=[];signature=[]
   for row in plan['roster']:
    ident=row['id'];key=ident+'/'+plan['candidate'];d=public/key;item=items.get(key)
    if not item or not d.exists():continue
    signature.append((key,item['choice'],item.get('active'),item.get('working'),item.get('failed'),item['bindings'].get('suite')))
    if item['choice'] in ('allow','deny','modify') or not item['ready'] or item['phase']!='suite':continue
    h=Harness(argparse.Namespace(seed=str(repo/'harness-data/battle-monster/seed.json'),root=str(public),monster=ident,candidate=plan['candidate']))
    baked=load(d/'check-suite.json');q=h.current_critique(d,'suite',baked)
    if baked['pass'] and q and q['recommendation']=='keep':eligible.append(ident)
   current=json.dumps(signature,sort_keys=True)
   if eligible:
    round_number+=1
    rc=command(harness('accept-batch','--plan',planfile,'--authorization',work/'authorization.txt','--out',work/('observer-allow-%03d.json'%round_number),*eligible),'allow-%03d'%round_number)
    if rc!=0:state['lastError']='Acceptance not finished; current state will be reread.'
   if eligible or current!=last_signature:
    command(harness('audit-batch','--plan',planfile,'--out',work/'batch-audit.json'),'audit')
    audit=load(work/'batch-audit.json');passed=[r for r in audit['items'] if r['passed']]
    state.update(passedSpecies=audit['passedSpecies'],posesVerified=audit['posesVerified'],motionGifsVerified=audit['motionGifsVerified'],lastAuditAt=audit['at'])
    if command(['python3',str(repo/'output/archive-fifty-monsters.py')],'archive')!=0:raise RuntimeError('Actual source archive reload not finished.')
    # Reuse actual previous browser evidence only when its selected binding is current.
    verified=set(state['browserVerified'])
    for proofpath in (repo/'verify-shots/battle-monster-fifty').glob('browser-proof-*.json'):
     proof=load(proofpath)
     if proof.get('errors') or not proof.get('noChoiceButtonsClicked'):continue
     bindings={r['key']:r['bindings'].get('suite') for r in proof.get('finalSelection',[])}
     for b in proof.get('items',[]):
      actual=next((r for r in passed if r['key']==b['key']),None)
      if actual and bindings.get(b['key'])==actual['binding'] and b.get('pauseResume') and b.get('motionTiles')==8 and b.get('nativeGifImages',0)>=8:verified.add(b['key'])
    todo=[r['key'].split('/')[0] for r in passed if r['key'] not in verified]
    if todo:
     rc=command(['node',str(repo/'output/capture-fifty-dashboard.mjs'),*todo],'browser-%03d'%round_number)
     if rc!=0:raise RuntimeError('Actual browser check not finished; remaining evidence will be retried.')
     verified.update(i+'/'+plan['candidate'] for i in todo)
    state['browserVerified']=sorted(verified);last_signature=current;save(statefile,state)
    if audit['passed'] and len(verified)==50 and load(repo/'harness-data/battle-monster/authored/fifty-20261006/manifest.json')['archivedPassedSpecies']==50:
     state.update(state='all-packs-audited-awaiting-root-final-review',finishedAt=stamp(),goalCompleteClaim=False);save(statefile,state);print('Actual50 audited/archived/browser-verified; root final review still required.',flush=True);break
   state.update(lastPollAt=stamp(),productionHandleLive=production_live());save(statefile,state)
   if not state['productionHandleLive']:
    state.update(state='needs-production-repair',finishedAt=stamp(),goalCompleteClaim=False);save(statefile,state);print('Production services terminal; inspect real missing/failed species.',flush=True);sys.exit(1)
  except Exception as error:
   state.update(lastError=str(error),lastErrorAt=stamp());save(statefile,state)
   if not production_live():state.update(state='needs-production-repair',finishedAt=stamp());save(statefile,state);raise
  time.sleep(15)
