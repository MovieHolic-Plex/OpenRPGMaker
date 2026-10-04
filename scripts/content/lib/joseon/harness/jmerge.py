import json,subprocess,sys
f=sys.argv[1]
def show(n): return json.loads(subprocess.check_output(['git','show',f':{n}:{f}']))
b,o,t=show(1),show(2),show(3)
def merge(b,o,t):
    r=dict(o)
    for k,v in t.items():
        if k not in o: r[k]=v
        elif o[k]!=v and b.get(k)!=v:
            if isinstance(v,dict) and isinstance(o[k],dict): r[k]=merge(b.get(k,{}),o[k],v)
            else: print('conflict',k)
    return r
json.dump(merge(b,o,t),open(f,'w'),ensure_ascii=False,indent=1)
