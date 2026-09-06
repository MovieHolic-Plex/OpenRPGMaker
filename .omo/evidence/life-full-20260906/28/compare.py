import sys,json
from runner import run,save,E
metadata=json.loads((E/'environment.json').read_text())
files=json.loads((E/'input-selected.json').read_text())['newFailureFiles']
for tree in metadata['trees']:
    label=tree['label'];cwd=tree['path']
    prefix=['timeout','--kill-after=15','1500','flock','--timeout','900','/tmp/rpg-zzu-life-full-qa-01a0727b.lock','timeout','--kill-after=15','600','env','DEV_SERVER_PORT='+tree['assignedRuntimePort'],'VITE_CACHE_DIR='+str(E/('cache-'+label))]
    run(label+'-25',cwd,prefix+['npm','test','--',*files,'--maxWorkers=4','--no-cache','--reporter=verbose','--reporter=json'])
    run(label+'-surface',cwd,prefix+['npm','run','gates','--','--only','surface','--json'])
