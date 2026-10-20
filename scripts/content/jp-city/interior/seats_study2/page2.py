# seat study 2 (사람 합격 2026-10-20) 그림 코드 사본 — 작업 폴더 /tmp/seats34/study2 경로를 그대로 둔다. 정본 그림은 tiledata/seats34/study2/art/, 판정은 human-verdicts.json.
import sys,os,io,json,base64,html
sys.path.insert(0,'/tmp/seats34'); import extract
from PIL import Image
C='/home/main/z-project/rpg-zzu-interior-seats-34/tiledata/hand-interior/pick/candidates/'
O='/tmp/seats34/study2/out/'
mspec=json.load(open('/tmp/seats34/mc-spec-main.json')); extract.S['mc_main']=(mspec,Image.open('/tmp/seats34/mc-sheet-main.png').convert('RGBA'))
def before(ts,pid):
  if ts=='atlas_biome_interior':
    return extract.render(ts,pid)
  return extract.render('mc_main' if ts=='modern_city_interior' else ts,pid)
def uri(im,s):
  b=extract.bg(im.width,im.height,s); b.alpha_composite(im.resize((im.width*s,im.height*s),Image.NEAREST))
  f=io.BytesIO(); b.save(f,'PNG'); return 'data:image/png;base64,'+base64.b64encode(f.getvalue()).decode()
def pair(im): return f'<img src="{uri(im,1)}"><img src="{uri(im,4)}">' if im is not None else '<span class=p>작업 중</span>'
J=json.load(open('/tmp/seats34/study2/verdicts.json')) if os.path.exists('/tmp/seats34/study2/verdicts.json') else {}
def vline(k):
  v=J.get(k)
  if not v: return '<p class=v>판정 대기</p>'
  ok=v['ok']; return f'<p class="v {"g" if ok else "b"}">기준작만큼 좋은가: {"예" if ok else "아니오"} — {html.escape(v["why"])}</p>'
anch=[('POS chair S (손 도트 v5)',Image.open(C+'chair_S/v5.png').convert('RGBA')),('POS hs-bench-row-s',extract.render('jp_city_interior','hs-bench-row-s')),
      ('NEG armchair',extract.render('atlas_biome_interior','armchair')),('NEG mci-chair-wood-e',before('modern_city_interior','mci-chair-wood-e'))]
act=Image.open('/home/main/claude-viz/jrpg-200-assets/sprites/Actor1.png').convert('RGBA').crop((24,0,48,32))
rules=["등받이는 정면 판으로 그려도 된다(윗면 불필요). 좌판만 윗면이 보이면 된다.",
"좌판 윗면이 가장 밝은 큰 면이다: 의자는 2~3행, 벤치는 6~7행. 맨 앞 모서리 한 행이 가장 밝고, 그 밑 앞면 1~2행은 어둡다.",
"등받이 면은 좌판보다 어둡다(머리 테 1~2행만 밝게). 그래야 세운 판과 눕힌 판이 갈린다.",
"등받이와 좌판 사이는 검은 줄이 아니라 중간~어두운 재질 톤의 주름 한 행.",
"사다리 등받이는 3px 기둥 사이로 바닥이 보이는 틈을 연다(통판 금지). 가로대는 위 밝고 아래 어둡게.",
"명암 4단 + 윤곽: 앞면 어둠 / 중간 / 윗면 밝음 / 앞 모서리 하이라이트. 빛은 왼쪽 위 — 왼쪽 열이 밝다.",
"윤곽은 바깥 실루엣에만 거의 검정(또는 재질 최암), 안쪽은 재질 톤으로 나눈다.",
"다리는 짧다(1~3행), 2px. 의자 전체는 폭 10px·높이 15행, Actor1 의 절반 높이.",
"재질 결은 한 가지만: 좌판 널 이음이나 쿠션 이음 한 줄. 점 두 개(눈처럼 읽힘) 금지."]
samples=['dining chair S','dining chair N','dining chair E','dining chair W','office chair S','office chair N','cafe stool','sofa S 2x2','table and chairs set']
smap={'dining chair S':('jp_city_interior','chair-dining-s'),'dining chair N':('jp_city_interior','chair-dining-n'),'dining chair E':('jp_city_interior','chair-dining-e'),'dining chair W':('jp_city_interior','chair-dining-w'),'office chair S':('jp_city_interior','of-desk-chair-s'),'office chair N':('jp_city_interior','of-desk-chair-n'),'cafe stool':('jp_city_interior','fr-counter-stool'),'sofa S 2x2':('jp_city_interior','sofa-s')}
def card(title,b,a,key):
  return f'<div class=c><h3>{html.escape(title)}</h3><div class=r><div><b>전</b>{pair(b)}</div><div><b>후</b>{pair(a)}</div></div>{vline(key)}</div>'
sc=''
for k in samples:
  a=Image.open(O+k.replace(' ','_')+'.png').convert('RGBA'); b=before(*smap[k]) if k in smap else None
  sc+=card(k,b,a,k)
batch=json.load(open('/tmp/seats34/study2/batch-all.json')) if os.path.exists('/tmp/seats34/study2/batch-all.json') else [['jp_city_interior',p] for p in json.load(open('/tmp/seats34/study2/batch.json'))]
bc=''; n=0
for ts,pid in batch:
  p=O+'batch/'+pid.replace(' ','_')+'.png'; a=Image.open(p).convert('RGBA') if os.path.exists(p) else None; n+=a is not None
  try: b=before(ts,pid)
  except Exception: b=None
  bc+=card(pid,b,a,pid)
ah=''.join(f'<div class=a><h3>{html.escape(t)}</h3>{pair(i)}</div>' for t,i in anch)+f'<div class=a><h3>Actor1(크기)</h3>{pair(act)}</div>'
doc=f'''<!doctype html><meta charset="utf-8"><title>앉는 기물 연구 2</title><style>
body{{background:#1e2026;color:#e8e8e8;font:14px/1.5 sans-serif;margin:16px}} h1{{font-size:20px}} h2{{font-size:17px;margin-top:22px}} h3{{margin:0 0 4px;font-size:13px}}
img{{image-rendering:pixelated;margin-right:6px;vertical-align:bottom}} .a{{display:inline-block;background:#2a2d35;padding:8px;margin:4px;border-radius:6px;vertical-align:top}}
.g2{{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:8px}} .c{{background:#2a2d35;border-radius:6px;padding:8px}}
.r{{display:flex;gap:12px}} .r b{{display:block;font-size:11px;color:#aaa}} .v{{margin:4px 0 0;font-size:12px}} .g{{color:#8fe39a}} .b{{color:#ffb0a0}} .p{{color:#e0b050}} li{{margin:2px 0}}
</style><h1>앉는 기물 연구 2 — 좋은 두 기준작에 맞추기</h1><div style="background:#1f6f3a;color:#fff;font-size:22px;font-weight:700;padding:10px 14px;border-radius:6px;margin:8px 0">사용자 합격 2026-10-20 — 아래 89개 전부(그린 크기 그대로). 굽기는 3/4 관문 영수증(프로필 보정) 뒤.</div>
<h2>기준작</h2>{ah}
<h2>두 좋은 기준작에서 뽑은 규칙</h2><ol>{''.join('<li>'+html.escape(r)+'</li>' for r in rules)}</ol>
<h2>견본(RTP 규칙 바탕) — 전/후</h2><div class=g2>{sc}</div>
<h2>실제 앉는 기물 — 전/후 (그림 {n}/{len(batch)})</h2><div class=g2>{bc}</div>'''
open('/home/main/claude-viz/seat-study-2.html','w').write(doc); print('ok',n,len(batch))
