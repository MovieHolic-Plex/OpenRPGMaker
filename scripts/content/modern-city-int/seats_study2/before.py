# seat study 2 (사람 합격 2026-10-20) 그림 코드 사본 — 작업 폴더 /tmp/seats34/study2 경로를 그대로 둔다. 정본 그림은 tiledata/seats34/study2/art/, 판정은 human-verdicts.json.
import sys,json
sys.path.insert(0,'/tmp/seats34'); import extract
from PIL import Image
mspec=json.load(open('/tmp/seats34/mc-spec-main.json')); extract.S['mc_main']=(mspec,Image.open('/tmp/seats34/mc-sheet-main.png').convert('RGBA'))
IDS="mci-cafe-chair-e mci-cafe-chair-w cinema-seat-row hospital-wheelchair aud-seat-row karaoke-sofa court-judge-bench mci-chair-office-e mci-chair-office-w mci-chair-wood-n mci-armchair-n mci-sofa-n mci-chair-wood-e mci-chair-wood-w mci-chair-wood-s mci-armchair mci-armchair-e mci-armchair-w home-bath-stool mci-bar-stool mci-chair-office-n hosp-wheelchair-bay clinic-dental-chair svc-barber-chair home-zabuton".split()
for i in IDS:
  im=extract.render('mc_main',i); im.save(f'/tmp/seats34/study2/mc/b_{i}.png')
  cols={}
  for p in im.getdata():
    if p[3]: cols[p[:3]]=cols.get(p[:3],0)+1
  print(i,im.size,len(cols),sorted(cols.items(),key=lambda x:-x[1])[:12])
