import sys,base64,io,os; sys.path.insert(0,'tiledata/hand-interior/v5')
import objs3 as O, cat, ko, rooms
from PIL import Image
def u(im):
    b=io.BytesIO(); im.save(b,'PNG'); return 'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
bycat={}
for k,(c,f) in O.OBJ.items(): bycat.setdefault(c,[]).append((ko.ko(k),f()))
order=['pharm','fish','bake','butcher','veg','smith','tavern','church','study','tailor','home','kitchen','decor','magic','misc','shop']
uniq=sum(1 for k in O.OBJ if ':' not in k)
h=f'''<!doctype html><meta charset=utf-8><title>실내 기물 {len(O.OBJ)}종 + 실내 13곳</title><style>body{{background:#16161a;color:#ddd;font:14px/1.6 system-ui;margin:24px}}img{{image-rendering:pixelated;display:block;margin:6px 0 20px}}h2{{margin-top:34px}}.rooms img{{max-width:100%}}</style>
<h1>실내 기물 {len(O.OBJ)}종 + 실내 13곳</h1>
<p>모두 손 도트(스크립트) — RTP 판독 규칙(말린 테두리·앞 모서리 4줄·고정 명암단·가장자리 결)으로 그렸다. 전체 {len(O.OBJ)}개 중 고유 디자인 {uniq}개, 나머지 {len(O.OBJ)-uniq}개는 같은 그릇(궤짝·바구니·통·선반·진열장·걸이·탁자)에 담긴 상품만 다른 재고 변형이다. 한 건물은 벽 재질 하나만 쓴다(바닥만 구역별로 바뀜).</p>
<h2>실내 13곳 (2배)</h2><div class=rooms>'''
names={k:v['name'] for k,v in rooms.R.items()}
for k,n in list(names.items())+[('cottage','오두막 (벽 재질 통일)'),('inn','여관 (벽 재질 통일)'),('shop','도구점 (벽 재질 통일)')]:
    im=Image.open(f'tiledata/hand-interior/v5/room_{k}.png' if k in names else f'tiledata/hand-interior/v5/{k}.png')
    h+=f'<h3>{n}</h3><img src="{u(im.resize((im.width*2,im.height*2),Image.NEAREST))}">'
h+='</div><h2>기물 목록 (3배, 분류별)</h2>'
for c in order:
    if c not in bycat: continue
    cat.sheet(bycat[c],'tiledata/hand-interior/v5/_c.png',3,11)
    h+=f'<h3>{ko.CAT[c]} — {len(bycat[c])}</h3><img src="{u(Image.open("tiledata/hand-interior/v5/_c.png"))}">'
open(os.path.expanduser('~/claude-viz/interior-objects.html'),'w').write(h)
print(len(O.OBJ),uniq)
