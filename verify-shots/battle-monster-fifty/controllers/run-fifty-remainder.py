"""Preserve existing work; reserve early/human chains while filling model slots."""
from pathlib import Path
import os,sys,subprocess,time,json
repo=Path(__file__).resolve().parents[1];os.chdir(repo);sys.path.insert(0,str(repo/'src/harnesses/battle-monster/node'))
from pipeline import load,save,stamp
work=repo/'qa-runs/battle-monster-fifty-wave';plan=load(repo/'harness-data/battle-monster/fifty-monsters-plan.json');early=['jade-mantis','lantern-goblin'];human=['red-tassel-swordswoman'];external=early+human
ids=[r['id'] for r in plan['roster'] if r['id'] not in plan['pilot']+external and load(work/'tasks'/(r['id']+'.json'))['state']!='done']
base=['npm','run','harness','--','battle-monster','wave','--work','qa-runs/battle-monster-fifty-wave','--candidate',plan['candidate'],'--visual-repairs','4','--visual-repair-authorization','qa-runs/battle-monster-fifty-wave/authorization.txt','--note-file','qa-runs/battle-monster-fifty-wave/direction.txt']
statefile=work/'remainder-controller.json';old=load(statefile) if statefile.exists() else {};history=work/'dispatcher-before-adaptive.json'
if not history.exists():save(history,old)
s={'state':'running','startedAt':stamp(),'remainingSpecies':len(ids),'externalSpecies':external,'goalSpeciesCount':50,'maxModelConcurrency':3,'requiresActualVisualKeep':True,'runs':[]};save(statefile,s)
assert load(work/'pilot-root-review.json')['passed'] is True

def service_live(unit):
 r=subprocess.run(['systemctl','--user','show',unit,'--property=MainPID,ActiveState'],capture_output=True,text=True);props=dict(line.split('=',1) for line in r.stdout.splitlines() if '=' in line);pid=int(props.get('MainPID','0'));return props.get('ActiveState')=='active' and pid and Path('/proc',str(pid)).exists()

def reserve(unit,folder,identifiers):
 live_models=0
 for p in Path('/proc').glob('[0-9]*/cmdline'):
  try:
   argv=p.read_bytes().split(b'\0');cmd=b' '.join(argv).decode(errors='replace')
   if argv and argv[0].endswith(b'/bin/codex') and b'exec' in argv and str(repo/'qa-runs'/folder/'candidates') in cmd:live_models+=1
  except OSError:pass
 chains=0
 if service_live(unit):
  for ident in identifiers:
   task=repo/'qa-runs'/folder/'tasks'/(ident+'.json');task=task if task.exists() else work/'tasks'/(ident+'.json')
   if load(task)['state'] not in ['done','failed']:chains+=1
 return max(live_models,chains)

while ids:
 reserved=reserve('oprn-battle-fifty-early-20261006.service','battle-monster-fifty-early-wave',early)+reserve('oprn-battle-fifty-human-20261006.service','battle-monster-fifty-human-wave',human)
 free=max(0,3-reserved)
 if not free:time.sleep(5);continue
 batch=ids[:free] if reserved else list(ids);ids=ids[len(batch):]
 command=base+['--workers',str(free),*batch];entry={'startedAt':stamp(),'reservedExternalChains':reserved,'workerSlots':free,'species':batch,'command':command};s['runs'].append(entry);save(statefile,s)
 result=subprocess.run(command);entry.update(exitCode=result.returncode,finishedAt=stamp());save(statefile,s)
# Final production state includes the three external species; it cannot approve them.
while service_live('oprn-battle-fifty-early-20261006.service') or service_live('oprn-battle-fifty-human-20261006.service'):time.sleep(5)
failed=[r['id'] for r in plan['roster'] if load(work/'tasks'/(r['id']+'.json'))['state']!='done'];s.update(state='done' if not failed else 'failed',failedSpecies=failed,exitCode=1 if failed else 0,finishedAt=stamp());save(statefile,s);sys.exit(s['exitCode'])
