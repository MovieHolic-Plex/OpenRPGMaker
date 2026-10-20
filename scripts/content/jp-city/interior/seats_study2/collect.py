# seat study 2 (사람 합격 2026-10-20) 그림 코드 사본 — 작업 폴더 /tmp/seats34/study2 경로를 그대로 둔다. 정본 그림은 tiledata/seats34/study2/art/, 판정은 human-verdicts.json.
import json,glob,re,os
V={}
def parse(path):
  if not os.path.exists(path): return
  for l in open(path):
    m=re.match(r'\s*(?:\d+\.\s*)?([^|]+?)\s*\|\s*(yes|no)\b\s*\|\s*([^|]*)',l.strip(),re.I)
    if m: V[m.group(1).strip()]={'ok':m.group(2).lower()=='yes','why':m.group(3).strip()}
import sys
for f in sys.argv[1:]: parse(f)
for f in glob.glob('/tmp/seats34/study2/verdicts-*.jsonl'):
  for l in open(f):
    try: d=json.loads(l); V[d['id']]={'ok':bool(d['ok']),'why':d.get('why','')}
    except Exception: pass
# sample aliases
for a,b in [('set','table and chairs set'),('sofa','sofa S 2x2')]:
  if a in V: V[b]=V[a]
json.dump(V,open('/tmp/seats34/study2/verdicts.json','w'),ensure_ascii=False,indent=0)
print(len(V), sum(v['ok'] for v in V.values()))
