# 조수 v2 파일 목록: 줄 수·들어오는 의존(v2 안/밖)·나가는 의존·다른 곳이 안 쓰는 export. usage: python3 scripts/qa/assistant-v2/inventory.py <repo> > inventory.json
import os,re,sys,json,subprocess,collections
repo=sys.argv[1]; root=os.path.join(repo,'src/ai/v2')
files=sorted(os.path.relpath(os.path.join(d,f),repo) for d,_,fs in os.walk(root) for f in fs if f.endswith('.ts'))
allts=subprocess.run(['git','-C',repo,'ls-files','src','scripts','test','electron'],capture_output=True,text=True).stdout.split('\n')
allts=[f for f in allts if re.search(r'\.(ts|tsx|mts|mjs)$',f)]
src={f:open(os.path.join(repo,f),encoding='utf-8',errors='ignore').read() for f in allts}
def resolve(frm,spec):
    if spec.startswith('@/'): base='src/'+spec[2:]
    elif spec.startswith('.'): base=os.path.normpath(os.path.join(os.path.dirname(frm),spec))
    else: return None
    base=re.sub(r'\.(ts|js|mts|mjs)$','',base)
    for c in (base+'.ts',base+'/index.ts',base+'.tsx',base+'.mts'):
        if c in src: return c
    return None
imp=collections.defaultdict(set)
IMP=re.compile(r'''(?:import|export)\s[^;]*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)''',re.S)
for f,s in src.items():
    for m in IMP.finditer(s):
        t=resolve(f,m.group(1) or m.group(2))
        if t: imp[f].add(t)
rev=collections.defaultdict(set)
for f,ts in imp.items():
    for t in ts: rev[t].add(f)
EXP=re.compile(r'^export\s+(?:async\s+)?(?:function\*?|const|let|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)',re.M)
alltext='\n'.join(src.values())
wordcount=collections.Counter(re.findall(r'[A-Za-z_$][\w$]*',alltext))
out=[]
for f in files:
    s=src.get(f,''); exps=EXP.findall(s)
    own=collections.Counter(re.findall(r'[A-Za-z_$][\w$]*',s))
    unused=[e for e in exps if wordcount[e]-own[e]==0]
    inv=[x for x in rev[f]]
    out.append(dict(file=f[len('src/ai/v2/'):],lines=s.count('\n')+1,exports=len(exps),unusedExports=unused,
        inV2=sorted(x[len('src/ai/v2/'):] for x in inv if x.startswith('src/ai/v2/')),
        inTest=sum(1 for x in inv if x.startswith('test/')), inOther=sorted(x for x in inv if not x.startswith('src/ai/v2/') and not x.startswith('test/')),
        outV2=sorted(x[len('src/ai/v2/'):] for x in imp[f] if x.startswith('src/ai/v2/')), outOther=sorted(x for x in imp[f] if not x.startswith('src/ai/v2/')),
        dated=len(re.findall(r'20(?:25|26)-\d\d-\d\d',s)), regexLists=len(re.findall(r'^\s*(?:export )?const [A-Z_0-9]+\s*(?::\s*RegExp)?\s*=\s*/.*\|.*\|.*\|',s,re.M))))
json.dump(out,sys.stdout,ensure_ascii=False)
