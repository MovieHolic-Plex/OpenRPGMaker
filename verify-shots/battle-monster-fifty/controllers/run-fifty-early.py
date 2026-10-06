from pathlib import Path
import subprocess,json,os,sys,shutil
repo=Path(__file__).resolve().parents[1];os.chdir(repo);sys.path.insert(0,str(repo/'src/harnesses/battle-monster/node'))
from pipeline import save,load,stamp
primary=repo/'qa-runs/battle-monster-fifty-wave';work=repo/'qa-runs/battle-monster-fifty-early-wave';work.mkdir(parents=True,exist_ok=True);ids=['jade-mantis','lantern-goblin']
for id in ids:
 source=primary/'candidates'/id/'fifty-v1';dest=work/'candidates'/id/'fifty-v1';dest.parent.mkdir(parents=True,exist_ok=True)
 if not dest.exists():shutil.copytree(source,dest)
 task=load(primary/'tasks'/(id+'.json'));task.update(state='running',startedAt=stamp(),sourceWork=str(work.relative_to(repo)),controller='early-controller.json');save(primary/'tasks'/(id+'.json'),task)
command=['npm','run','harness','--','battle-monster','wave','--work',str(work.relative_to(repo)),'--candidate','fifty-v1','--workers','2','--visual-repairs','4','--visual-repair-authorization','qa-runs/battle-monster-fifty-wave/authorization.txt','--note-file','qa-runs/battle-monster-fifty-wave/direction.txt',*ids]
s={'state':'running','startedAt':stamp(),'command':command,'species':ids,'goalSpeciesCount':50,'reason':'64px deer and96px bell real keep/Allow verified; fill2 free artist slots while128px pilot finishes.'};save(primary/'early-controller.json',s)
r=subprocess.run(command)
for id in ids:
 task=load(work/'tasks'/(id+'.json'));task.update(sourceWork=str(work.relative_to(repo)));save(primary/'tasks'/(id+'.json'),task)
s.update(state='done' if r.returncode==0 else 'failed',exitCode=r.returncode,finishedAt=stamp());save(primary/'early-controller.json',s);sys.exit(r.returncode)
