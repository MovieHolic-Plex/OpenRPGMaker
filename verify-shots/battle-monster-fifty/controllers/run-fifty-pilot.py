from pathlib import Path
import subprocess,json,os,sys
repo=Path(__file__).resolve().parents[1];os.chdir(repo)
sys.path.insert(0,str(repo/'src/harnesses/battle-monster/node'))
from pipeline import save,stamp
plan=json.loads((repo/'harness-data/battle-monster/fifty-monsters-plan.json').read_text())
statefile=repo/'qa-runs/battle-monster-fifty-wave/pilot-controller.json'
command=['npm','run','harness','--','battle-monster','wave','--work','qa-runs/battle-monster-fifty-wave','--candidate',plan['candidate'],'--workers','3','--visual-repairs','4','--visual-repair-authorization','qa-runs/battle-monster-fifty-wave/authorization.txt','--note-file','qa-runs/battle-monster-fifty-wave/direction.txt',*plan['pilot']]
s={'state':'running','startedAt':stamp(),'command':command,'pilotSpecies':plan['pilot'],'goalSpeciesCount':50,'requiresActualVisualKeep':True};save(statefile,s)
r=subprocess.run(command);s.update(state='done' if r.returncode==0 else 'failed',exitCode=r.returncode,finishedAt=stamp());save(statefile,s);sys.exit(r.returncode)
