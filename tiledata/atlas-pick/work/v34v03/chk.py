import sys, subprocess, json
R='/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick'
def sh(c):
    p=subprocess.run(c,shell=True,cwd=R,capture_output=True,text=True); return p.returncode,(p.stdout+p.stderr).strip()
for arg in sys.argv[1:]:
    slug,mode=arg.split(':')[:2]
    v=(arg.split(':')+['A'])[2]
    d='tiledata/atlas-pick/candidates-school/%s/v34-%s'%(slug,v)
    rc,o=sh('python3 scripts/content/atlas-pick/check_candidate.py %s.pxg'%d)
    try:
        j=json.load(open(R+'/'+d+'.check.json')); fails=j['hard']
        fails=[k for k,x in (j.get('hard') or {}).items() if not (x.get('ok',x) if isinstance(x,dict) else x)]
    except Exception as e: fails=['?%s'%e]
    if mode=='wall': rc2,o2=sh('python3 scripts/content/atlas-pick/interior_view34_audit.py --wall-tall %s.png'%d)
    elif mode=='obj': rc2,o2=sh('python3 scripts/content/atlas-pick/interior_view34_audit.py --object %s.png'%d)
    else: rc2,o2=sh('python3 scripts/content/atlas-pick/view34_check.py %s.png:%s'%(d,mode))
    ctxf={'wall':'--wall','obj':'--in'}.get(mode,'')
    sh('python3 scripts/content/atlas-pick/view34_context.py %s.png %s'%(d,ctxf))
    print(slug,'hardfail=',fails,'| view rc',rc2,'|',o2.splitlines()[-1] if o2 else '')
