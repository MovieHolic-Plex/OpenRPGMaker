from pathlib import Path
import os,sys,time,signal,subprocess,json
repo=Path(__file__).resolve().parents[1];os.chdir(repo);sys.path.insert(0,str(repo/'src/harnesses/battle-monster/node'));from pipeline import load,save,stamp
path=repo/'qa-runs/battle-monster-fifty-wave/dispatcher-transition.json';record=load(path);record.update(state='waiting-for-current-wave-terminal',startedAt=stamp());save(path,record);pid=record['currentWavePid']
while True:
 p=Path('/proc',str(pid),'stat')
 if not p.exists():reason='original wave handle missing';break
 fields=p.read_text().rsplit(')',1)[1].split()
 if fields[19]!=record['currentWaveStartTicks']:reason='original wave identity ended';break
 if fields[0]=='Z':reason='original wave terminal zombie';break
 time.sleep(5)
# The stopped dispatcher cannot launch a new model. The current wave has exited.
main=record['oldDispatcherPid'];p=Path('/proc',str(main),'cmdline')
if p.exists():
 assert b'output/run-fifty-remainder.py' in p.read_bytes();os.kill(main,signal.SIGKILL)
result=subprocess.run(['systemctl','--user','restart','oprn-battle-fifty-rest-20261006.service'])
record.update(state='adaptive-dispatcher-started' if result.returncode==0 else 'restart-failed',terminalEvidence=reason,finishedAt=stamp(),restartExitCode=result.returncode);save(path,record);sys.exit(result.returncode)
