# v2 와 v2 를 끌어오는 모든 파일만 넣은 tsconfig 를 저장소 루트에 쓴다(전체 typecheck 금지 규칙 — 파일 범위). usage: mktsconfig.py <repo>
import os,re,sys,json,subprocess
repo=sys.argv[1]
ls=subprocess.run(['git','-C',repo,'ls-files','--cached','--others','--exclude-standard','src','scripts','test','electron'],capture_output=True,text=True).stdout.split('\n')
inc=set()
for f in ls:
    if not re.search(r'\.(ts|tsx|mts)$',f): continue
    if f.startswith('src/ai/v2/'): inc.add(f); continue
    s=open(os.path.join(repo,f),encoding='utf-8',errors='ignore').read()
    if re.search(r'''from\s+["'][^"']*ai/v2[/"']|from\s+["'][^"']*assistantV2Runtime|import\(\s*["'][^"']*ai/v2''',s): inc.add(f)
json.dump({"extends":"./tsconfig.json","include":sorted(inc)+["src/vite-env.d.ts","src/**/*.d.ts"],"exclude":["node_modules","dist"]},open(os.path.join(repo,'tsconfig.v2scope.tmp.json'),'w'))
print(len(inc),'files in scope')
