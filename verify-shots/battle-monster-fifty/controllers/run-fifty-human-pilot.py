from pathlib import Path
import os,sys,subprocess,shutil
repo=Path(__file__).resolve().parents[1];os.chdir(repo);sys.path.insert(0,str(repo/'src/harnesses/battle-monster/node'))
from pipeline import load,save,stamp
primary=repo/'qa-runs/battle-monster-fifty-wave';work=repo/'qa-runs/battle-monster-fifty-human-wave';ident='red-tassel-swordswoman';source=primary/'candidates'/ident/'fifty-v1';dest=work/'candidates'/ident/'fifty-v1';dest.parent.mkdir(parents=True,exist_ok=True)
if not dest.exists():shutil.copytree(source,dest)
task=load(primary/'tasks'/(ident+'.json'));assert task['state']=='queued';task.update(state='running',startedAt=stamp(),sourceWork=str(work.relative_to(repo)),controller='human-controller.json');save(primary/'tasks'/(ident+'.json'),task)
command=['npm','run','harness','--','battle-monster','wave','--work',str(work.relative_to(repo)),'--candidate','fifty-v1','--workers','1','--visual-repairs','4','--visual-repair-authorization','qa-runs/battle-monster-fifty-wave/authorization.txt','--note-file','qa-runs/battle-monster-fifty-wave/direction.txt',ident]
state={'state':'running','startedAt':stamp(),'command':command,'species':[ident],'goalSpeciesCount':50,'reason':'One actual free model slot; inspect adult woman face/clothing/sword style early.'};save(primary/'human-controller.json',state)
result=subprocess.run(command);task=load(work/'tasks'/(ident+'.json'));task['sourceWork']=str(work.relative_to(repo));save(primary/'tasks'/(ident+'.json'),task);state.update(state='done' if result.returncode==0 else 'failed',exitCode=result.returncode,finishedAt=stamp());save(primary/'human-controller.json',state);sys.exit(result.returncode)
