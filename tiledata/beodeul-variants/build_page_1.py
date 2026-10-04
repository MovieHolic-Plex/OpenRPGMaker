"""변형 1 결과 페이지 생성기: python3 build_page_1.py -> ~/claude-viz/beodeul-var-1.html (자체완결, data URI)."""
import base64, io, os, glob
from PIL import Image
HERE=os.path.dirname(os.path.abspath(__file__))
def uri(im):
    b=io.BytesIO(); im.save(b,'PNG'); return 'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
def uri_file(p): return uri(Image.open(p).convert('RGBA'))
MAPS=[
 ('fishing-port','어촌 포구 마을','52x40','소박한 포구. 서쪽 길 → 시장 마당 → 잔교 → 등대 길목. 그물 말림·생선 시장·어선.',
  [('잔교와 시장',(300,520,1100,1100)),('등대 곶',(1000,380,1664,1000))]),
 ('vineyard','언덕 포도원 마을','56x54','3단 구릉. 남쪽 입구 → 광장·여관 → 계단 → 포도주 창고 → 언덕 위 신전.',
  [('아랫마을 광장',(400,1100,1250,1750)),('언덕 위 신전',(500,0,1300,560))]),
 ('walled-market','성벽 교역 도시의 시장 구역','64x55','북문 → 대로 → 광장 시장 → 여관·대장간·마구간 → 남문. 성벽 바깥은 밭·야영지.',
  [('중앙 광장 좌판',(600,600,1500,1300)),('북문',(500,0,1500,560))]),
 ('riverside-mill','강가 물레방아 마을','56x44','강이 마을을 가르고 큰 돌다리·섶다리가 잇는다. 물레방아·방앗간이 중심, 가장자리에 밀밭.',
  [('물레방아와 방앗간',(760,20,1500,470)),('큰 돌다리와 광장',(200,700,1200,1250))]),
]
def md_plan(slug):
    out=[]
    for l in open(f'{HERE}/{slug}/plan.md',encoding='utf8'):
        l=l.rstrip()
        if l.startswith('- 어색한') or l.startswith('- 남은 어색') or '어색한 곳' in l[:12]: out.append(l.lstrip('- '))
    return out
css="""body{background:#15171b;color:#e6e1d6;font:14px/1.6 system-ui,'Noto Sans KR',sans-serif;margin:0;padding:24px 32px;max-width:1500px}
h1{font-size:22px}h2{font-size:18px;border-bottom:1px solid #444;padding-bottom:4px;margin-top:44px}h3{font-size:14px;margin:14px 0 4px;color:#cdb87a}
img{image-rendering:pixelated;max-width:100%;display:block;border:1px solid #333}.row{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start}
.card{background:#1d2026;padding:8px;border-radius:4px}.small{font-size:12px;color:#a9a496}.parts{display:flex;flex-wrap:wrap;gap:10px}
.parts .p{background:#2b3a2a;padding:6px;text-align:center;font-size:11px;border-radius:3px}.parts img{margin:auto;border:none;background:#3c5a34}
nav a{color:#9ec5ff;margin-right:14px}p.a{color:#e0a97a}"""
h=['<!doctype html><meta charset=utf-8><title>버들항 변형 1 — 마을 4곳</title><style>'+css+'</style>',
   '<h1>버들항 변형 1 — 마을 4곳</h1><p class=small>버들항 로마풍 팔레트·3/4 시점·왼쪽 위 빛. 아래 그림은 모두 원 해상도(1x)이고, 확대는 2x 크롭이다. 새 조각은 3x.</p><nav>']
for s,n,*_ in MAPS: h.append(f'<a href="#{s}">{n}</a>')
h.append('</nav>')
for s,n,sz,purpose,crops in MAPS:
    d=f'{HERE}/{s}'
    h.append(f'<h2 id={s}>{n} <span class=small>{sz}칸</span></h2><p>{purpose}</p>')
    h.append(f'<h3>전체 1x</h3><img src="{uri_file(d+"/render-1x.png")}">')
    im2=Image.open(d+'/render-2x.png').convert('RGBA')
    h.append('<h3>확대 2x</h3><div class=row>')
    for t,box in crops:
        b=(box[0],box[1],min(box[2],im2.width),min(box[3],im2.height))
        h.append(f'<div class=card><div class=small>{t}</div><img src="{uri(im2.crop(b))}"></div>')
    h.append('</div><h3>새로 찍은 조각 (3x)</h3><div class=parts>')
    for p in sorted(glob.glob(d+'/parts/*.png')):
        im=Image.open(p).convert('RGBA'); im=im.resize((im.width*3,im.height*3),Image.NEAREST)
        h.append(f'<div class=p><img src="{uri(im)}"><br>{os.path.basename(p)[:-4]}</div>')
    h.append('</div><h3>스스로 보기에 어색한 곳</h3>')
    for l in md_plan(s): h.append(f'<p class=a>{l}</p>')
open(os.path.expanduser('~/claude-viz/beodeul-var-1.html'),'w',encoding='utf8').write('\n'.join(h))
