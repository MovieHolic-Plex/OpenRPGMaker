# seat study 2 (사람 합격 2026-10-20) 그림 코드 사본 — 작업 폴더 /tmp/seats34/study2 경로를 그대로 둔다. 정본 그림은 tiledata/seats34/study2/art/, 판정은 human-verdicts.json.
import sys,os;sys.path.insert(0,'/tmp/seats34');import cmp
ids=sys.argv[2:]; out=sys.argv[1]
sp=[]
for i in ids:
  sp.append(['OLD '+i,'/tmp/seats34/study2/mc/b_'+i+'.png'])
  if os.path.exists('/tmp/seats34/study2/out/batch/'+i+'.png'): sp.append(['NEW '+i,'/tmp/seats34/study2/out/batch/'+i+'.png'])
cmp.sheet(sp,out,int(os.environ.get('S','8')))
