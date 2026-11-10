# 범위 tsc 를 돌려 기준선에 없던 오류만 보고, 「안 쓰는 선언/임포트」는 prune 작업 목록으로 만든다.
# usage: tsloop.py <repo> <baseline.log> [--fix]   (--fix 면 ops 를 써서 prune.mts 를 돌린다)
import os,re,sys,json,subprocess,collections
repo,base=sys.argv[1],sys.argv[2]; fix='--fix' in sys.argv
here=os.path.dirname(os.path.abspath(__file__))
def norm(line):
    m=re.match(r'^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$',line)
    return m and (m.group(1),m.group(4),m.group(5),int(m.group(2)),int(m.group(3)))
basekeys=collections.Counter((n[0],n[1],n[2]) for n in map(norm,open(base,encoding='utf-8',errors='ignore')) if n)
subprocess.run(['python3',os.path.join(here,'mktsconfig.py'),repo],capture_output=True)
out=subprocess.run(['node','--max-old-space-size=12000','node_modules/typescript/bin/tsc','-p','tsconfig.v2scope.tmp.json','--noEmit'],cwd=repo,capture_output=True,text=True).stdout
os.remove(os.path.join(repo,'tsconfig.v2scope.tmp.json'))
errs=[n for n in map(norm,out.split('\n')) if n]
seen=collections.Counter(); new=[]
for e in errs:
    k=(e[0],e[1],e[2]); seen[k]+=1
    if seen[k]>basekeys[k]: new.append(e)
ops={'remove':[],'unimport':[]}; other=[]
for f,code,msg,ln,col in new:
    lines=open(os.path.join(repo,f),encoding='utf-8').read().split('\n'); text=lines[ln-1]
    m=re.match(r"'([^']+)' is declared but (its value is never read|never used)",msg)
    if code in('TS6133','TS6196') and m:
        # 임포트 줄(여러 줄 임포트 포함)인가 — 위로 올라가며 import 문 시작을 찾는다
        j=ln-1
        while j>=0 and not re.match(r'^\s*(import|export|const|let|function|async|class|type|interface|enum|\}|//|/\*)',lines[j]) : j-=1
        isimp = re.match(r'^\s*import\b',lines[j]) is not None or re.match(r'^\s*import\b',text) is not None
        if not isimp and re.match(r'^\S',text) is None and not re.match(r'^\s*import',lines[j] if j>=0 else ''):
            other.append((f,ln,code,msg,text.strip()[:90])); continue
        (ops['unimport'] if isimp else ops['remove']).append({'file':f,'name':m.group(1)})
    elif code=='TS6192':
        j=ln-1; block=''
        while j<len(lines):
            block+=lines[j]
            if 'from' in lines[j]: break
            j+=1
        for name in re.findall(r'[A-Za-z_$][\w$]*',re.sub(r'\bas\s+','',re.search(r'import\s+(?:type\s+)?(.*?)\s+from',block,re.S).group(1))):
            if name!='type': ops['unimport'].append({'file':f,'name':name})
    else: other.append((f,ln,code,msg[:120],text.strip()[:90]))
print(f"errors {len(errs)} (baseline {sum(basekeys.values())}) · new {len(new)} · auto remove {len(ops['remove'])} · auto unimport {len(ops['unimport'])} · other {len(other)}")
for o in other[:40]: print('  ',o)
if fix and (ops['remove'] or ops['unimport']):
    p=os.path.join(here,'ops-loop.json'); json.dump(ops,open(p,'w'),ensure_ascii=False)
    print(subprocess.run(['bun',os.path.join(here,'prune.mts'),repo,p],capture_output=True,text=True).stdout[-1500:])
