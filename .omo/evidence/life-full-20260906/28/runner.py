import subprocess, pathlib, json, datetime, sys, difflib, os
E = pathlib.Path(__file__).parent

def save(name, text):
    p = E / name
    old = p.read_text() if p.exists() else ''
    patch = ''.join(difflib.unified_diff(old.splitlines(True), text.splitlines(True), fromfile='a/'+str(p).lstrip('/'), tofile='b/'+str(p).lstrip('/')))
    if patch:
        subprocess.run(['/tmp/apply_patch'], input=patch, text=True, cwd='/', check=True, stdout=subprocess.DEVNULL)

def run(name, cwd, cmd, timeout=1200):
    start=datetime.datetime.now(datetime.timezone.utc).isoformat()
    print('START',name,flush=True)
    p=subprocess.run(cmd,cwd=cwd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    save(name+'.stdout.txt',p.stdout if p.stdout.endswith('\n') else p.stdout+'\n')
    save(name+'.stderr.txt',p.stderr if p.stderr.endswith('\n') else p.stderr+'\n')
    receipt={'cwd':cwd,'command':cmd,'start':start,'end':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exit':p.returncode}
    save(name+'.receipt.json',json.dumps(receipt,indent=2)+'\n')
    print('END',name,p.returncode,flush=True)
    return p

if __name__ == '__main__':
    main='/home/main/z-project/rpg-zzu-life-full-p2'
    for label,commit in [('base','87de73785d1c309bbbe975636414f70bbc73a4b9'),('current','4e2d1762264533a5826c48686648093c3fe69ebd')]:
        requested='life-full-p2-gate-'+label
        actual=main+'-'+requested
        desired=main+'-gate-'+label
        p=run('create-'+label,main,['timeout','180','npm','run','wt','--','create',requested,'--base',commit])
        if p.returncode: sys.exit(p.returncode)
        p=run('move-'+label,main,['git','worktree','move',actual,desired])
        if p.returncode: sys.exit(p.returncode)
