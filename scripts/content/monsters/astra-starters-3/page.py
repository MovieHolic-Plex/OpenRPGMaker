import os, shutil
from PIL import Image, ImageDraw
S='/tmp/astra-s3'; V=os.path.expanduser('~/claude-viz/astra-starters-3'); os.makedirs(V, exist_ok=True)
BG=Image.open('/home/main/z-project/rpg-zzu-astra-starters/public/assets/emerald-monster/battle/grass.png').convert('RGBA')
DIRS=[('a','부드러운 카와이 치비 마스코트','파스텔, 동글동글 말랑한 몸, 크고 반짝이는 눈. 새싹 햄스터 · 촛불 볏 도마뱀용 · 거품 아가미 우파루파'),
      ('b','깔끔한 공식 일러스트풍','굵고 단순한 모양, 자신 있는 선, 2단 셀 음영. 꽃봉오리 뿔 아기사슴 · 불꽃 털 양 · 파도 볏 아기 물범'),
      ('c','봉제인형·스티커풍','펠트·플리스 질감, 박음질 선, 흰 스티커 테두리. 잎사귀 두건 고양이 · 촛불 머리 곰돌이 · 몽글 해파리'),
      ('d','3D 비닐 피규어 렌더','매끈한 플라스틱 피규어, 스튜디오 조명, 애니메이션 영화 느낌. 연잎 모자 카피바라 · 아기 불사조 · 아기 해마용')]
def field(sprite, smooth):
    f=BG.resize((480,240),Image.NEAREST); d=ImageDraw.Draw(f)
    d.ellipse([280,130,440,170],fill=(168,216,128,255),outline=(120,176,88,255),width=3)
    d.ellipse([20,214,220,262],fill=(168,216,128,255),outline=(120,176,88,255),width=3)
    s = sprite.resize((128,128), Image.LANCZOS if smooth else Image.NEAREST) if sprite.width!=128 else sprite
    f.alpha_composite(s,(296,22)); return f
html=['<!doctype html><html lang="ko"><meta charset="utf-8"><title>아스트라 스타터 — 고르기 시트 3</title><style>',
'body{font-family:sans-serif;max-width:1500px;margin:16px auto;background:#f3f2ec;color:#222}h2{margin:28px 0 4px;border-top:3px solid #333;padding-top:10px}',
'.set{background:#fff;border:1px solid #ccc;border-radius:8px;padding:10px;margin:10px 0}.num{font-size:28px;font-weight:bold;color:#c03}',
'.px{image-rendering:pixelated}.row{display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap}.cap{font-size:12px;color:#555}.g{background:#a8d090;padding:6px}',
'</style><h1>아스트라 스타터 — 새로 고르기 (생성형 원화)</h1>',
'<p>4가지 화풍 × 2판 = 8세트. 마음에 드는 세트 <b>번호</b>만 말해 주세요(예: 「2번」). 고르기 전에는 게임에 아무것도 넣지 않습니다.</p>',
'<p><b>A</b> = 지금 게임 규격(64칸 도트)으로 줄인 모습입니다. 그대로 줄이고 윤곽 한 줄만 둘렀습니다. <b>B</b> = 도트로 바꾸지 않은 고해상도 그림을 전투에 그대로 그린 모습입니다. 엔진에 매끈한 그림 경로가 있어 가능하지만, 배경과 글자판은 도트라 섞여 보입니다. 전투 화면 예시는 실제 화면 크기(480×240)이고, 불 스타터를 상대 자리에 놓았습니다.</p>']
n=0
for g,name,desc in DIRS:
    html.append(f'<h2>{name}</h2><div class="cap">{desc}</div>')
    for v in ['1','2']:
        n+=1; t=g+v
        import numpy as np
        _r=np.asarray(Image.open(f'{S}/raw/{t}.png').convert('RGB')).astype(int); _d=np.sqrt((_r[...,0]-255)**2+_r[...,1]**2+(_r[...,2]-255)**2)
        _w=np.clip((_d-60)/90,0,1)[...,None]; _o=(_r*_w+np.array([238,238,232])*(1-_w)).astype('uint8')
        Image.fromarray(_o).resize((1200,800),Image.LANCZOS).save(f'{V}/{n}-raw.jpg',quality=90)
        for el in ['grass','fire','water']:
            shutil.copy(f'{S}/out/{t}-{el}-a64.png',f'{V}/{n}-{el}-a.png'); shutil.copy(f'{S}/out/{t}-{el}-b128.png',f'{V}/{n}-{el}-b.png')
        field(Image.open(f'{S}/out/{t}-fire-a64.png'),False).save(f'{V}/{n}-field-a.png')
        field(Image.open(f'{S}/out/{t}-fire-b128.png'),True).save(f'{V}/{n}-field-b.png')
        a1=''.join(f'<img class="px" src="astra-starters-3/{n}-{el}-a.png" width="64">' for el in ['grass','fire','water'])
        a3=''.join(f'<img class="px" src="astra-starters-3/{n}-{el}-a.png" width="192">' for el in ['grass','fire','water'])
        b1=''.join(f'<img src="astra-starters-3/{n}-{el}-b.png" width="128">' for el in ['grass','fire','water'])
        html.append(f'''<div class="set"><span class="num">{n}번</span> <b>{name}</b> · {v}판
<div class="row"><img src="astra-starters-3/{n}-raw.jpg" width="720"><div>
<div class="cap">A 도트 1배 (64칸 실제 크기)</div><div class="g row">{a1}</div>
<div class="cap">A 도트 3배</div><div class="g row">{a3}</div></div></div>
<div class="row"><div><div class="cap">전투 화면 A (도트, 실제 크기)</div><img class="px" src="astra-starters-3/{n}-field-a.png" width="480"></div>
<div><div class="cap">전투 화면 B (고해상도 그대로, 실제 크기)</div><img src="astra-starters-3/{n}-field-b.png" width="480"></div>
<div><div class="cap">B 그림 128px</div><div class="g row">{b1}</div></div></div></div>''')
html.append('</html>')
open(os.path.expanduser('~/claude-viz/astra-starters-3.html'),'w').write('\n'.join(html)); print('sets',n)
