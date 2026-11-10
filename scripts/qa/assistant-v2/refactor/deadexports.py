# v2 export 를 쓰임새로 가른다. usage: deadexports.py <repo> > deadexports.json
# A dead: 어디서도 안 씀(자기 파일에서도 정의뿐) · B private: 자기 파일만 씀 · C testOnly: 테스트만 부름(자기 파일에서도 안 씀) · D testAndOwn: 자기 파일+테스트
import os,re,sys,json,subprocess,collections
repo=sys.argv[1]
ls=subprocess.run(['git','-C',repo,'ls-files','--cached','--others','--exclude-standard','src','scripts','test','electron'],capture_output=True,text=True).stdout.split('\n')
ls=[f for f in ls if re.search(r'\.(ts|tsx|mts|mjs|js)$',f)]
src={f:open(os.path.join(repo,f),encoding='utf-8',errors='ignore').read() for f in ls}
W=re.compile(r'[A-Za-z_$][\w$]*')
cnt={f:collections.Counter(W.findall(s)) for f,s in src.items()}
prod=collections.Counter(); test=collections.Counter()
for f,c in cnt.items():
    (test if f.startswith('test/') else prod).update(c)
EXP=re.compile(r'^export\s+(?:declare\s+)?(?:async\s+)?(function\*?|const|let|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)',re.M)
out=[]
for f in sorted(src):
    if not f.startswith('src/ai/v2/'): continue
    for kind,name in EXP.findall(src[f]):
        own=cnt[f][name]; po=prod[name]-own; t=test[name]
        cat='used' if po>0 else ('A' if own<=1 and t==0 else 'B' if t==0 else 'C' if own<=1 else 'D')
        if cat!='used': out.append(dict(file=f,name=name,kind=kind,own=own,test=t,cat=cat))
json.dump(out,sys.stdout,ensure_ascii=False,indent=0)
