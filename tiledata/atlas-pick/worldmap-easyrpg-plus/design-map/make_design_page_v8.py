#!/usr/bin/env python3
"""월드맵 설계 데모 8단계 비교 페이지(자체완결 HTML, 이미지는 data URI).
  CITY_TAG=v8 python3 make_design_page_v8.py [출력경로]   기본 ~/claude-viz/worldmap-design.html
먼저 CITY_TAG=v8 로 make_map_v5.py(→ design-1x-v8.png) 와 anim_v5.py(→ anim-v8/) 를 돌린다. 7단계 판(design-1x-v7.png, landmarks_v7)과 나란히 전/후를 보인다."""
import base64, io, os, sys
from pathlib import Path
import numpy as np
from PIL import Image
import anim_v5 as A

HERE = Path(__file__).resolve().parent
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/claude-viz/worldmap-design.html')
AN = HERE / 'anim-v8'


def b64(data, mime):
    return f'data:{mime};base64,' + base64.b64encode(data).decode()


def png(im):
    b = io.BytesIO(); im.save(b, 'PNG', optimize=True); return b64(b.getvalue(), 'image/png')


def rgba_clean(path):
    a = np.array(Image.open(path).convert('RGBA')); a[a[..., 3] == 0] = 0
    return Image.fromarray(a)


rgb = lambda p: Image.open(p).convert('RGB')
v6, v7 = rgb(HERE / 'design-1x-v6.png'), rgb(HERE / 'design-1x-v7.png')
v8 = rgb(HERE / 'design-1x-v8.png')
v4 = v6; v5 = v8; v5old = v6
ORIG = rgb(HERE / '../../../../public/assets/easyrpg-chipset-world.png')
M, ic, _ = A.load()
import landmarks_v7 as L7
import landmarks_v8 as LM


def fig(im, cap='', w=None):
    return f'<figure><img src="{png(im)}" width="{w or im.width}" height="{(w and im.height * w // im.width) or im.height}"><figcaption>{cap}</figcaption></figure>'


def sheet_gif(frames, scale, ms):
    """프레임 전체를 한 팔레트로 묶어 GIF 로(프레임마다 다른 색이 깨지지 않게)."""
    fr = [f.resize((f.width * scale, f.height * scale), Image.NEAREST).convert('RGB') for f in frames]
    w, h = fr[0].size
    cat = Image.new('RGB', (w, h * len(fr)))
    for i, f in enumerate(fr): cat.paste(f, (0, i * h))
    pal = cat.quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    q = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in fr]
    b = io.BytesIO()
    q[0].save(b, 'GIF', save_all=True, append_images=q[1:], duration=ms, loop=0, optimize=False, disposal=1)
    return b64(b.getvalue(), 'image/gif'), w, h


fulls = [np.array(Image.open(AN / f'full{f:02d}.png').convert('RGB')) for f in range(A.N)]
cl, sh = Image.open(AN / 'clouds.png'), Image.open(AN / 'cloudshadow.png')


def effect(title, box, scale, cap, ms=250, clouds=False, nf=None):
    x0, y0, x1, y1 = box
    frs = []
    for f in range(nf or A.N):
        im = A.composite_clouds(fulls[f], cl, sh, f * 5) if clouds else Image.fromarray(fulls[f])
        frs.append(im.crop(box))
    uri, w, h = sheet_gif(frs, scale, ms)
    return f'<figure class="fx"><img src="{uri}" width="{w}" height="{h}"><figcaption><b>{title}</b> — {cap} [{ms}ms × {nf or A.N}프레임]</figcaption></figure>'


def cmp_pair(win, cap, z=3):
    x0, y0, x1, y1 = win
    cr = lambda im: im.crop((x0 * 16, y0 * 16, x1 * 16, y1 * 16)).resize(((x1 - x0) * 16 * z,) * 1 + ((y1 - y0) * 16 * z,), Image.NEAREST)
    a, b = cr(v4), cr(v5)
    o = Image.new('RGB', (a.width * 2 + 8, a.height), (255, 0, 255)); o.paste(a, (0, 0)); o.paste(b, (a.width + 8, 0))
    return f'<figure><img src="{png(o)}" width="{o.width}" height="{o.height}"><figcaption>{cap} (타일 {x0},{y0}~{x1},{y1}, {z}배) — 왼쪽 4단계 · 오른쪽 5단계</figcaption></figure>'


PAIRS = [
    ((13, 54, 23, 60), '사막|모래언덕'), ((70, 14, 80, 20), '화산재|현무암'), ((17, 43, 27, 49), '사바나|사막'),
    ((41, 37, 51, 43), '바다|초원 해안'),
    ((38, 18, 48, 24), '초원|툰드라'), ((30, 11, 40, 17), '툰드라|눈'), ((74, 43, 84, 49), '사바나|붉은 메사 땅'),
    ((78, 18, 88, 24), '용암|현무암'), ((61, 17, 71, 23), '독수|늪'), ((78, 34, 88, 40), '사막|균열 협곡'),
]
pairs_html = ''.join(cmp_pair(w, c) for w, c in PAIRS)


def site(name, sc, pad=2):
    x, y, w, h = ic[name]
    im = v5.crop(((x - pad) * 16, (y - pad) * 16, (x + w + pad) * 16, (y + h + pad) * 16))
    return fig(im.resize((im.width * sc, im.height * sc), Image.NEAREST), f'{name}: {w}×{h}칸 아이콘 (실제 지도 위, {sc}배)')


def cell(im, cx, cy, w, h, z):
    c = im.crop((cx * 16, cy * 16, (cx + w) * 16, (cy + h) * 16)).convert('RGBA')
    a = np.array(c); a[(a[..., :3] == (255, 103, 139)).all(-1)] = (42, 48, 58, 255)
    return Image.fromarray(a).resize((c.width * z, c.height * z), Image.NEAREST).convert('RGB')


def icon_fig(path, z, cap):
    im = Image.open(path).convert('RGB'); a = np.array(im); a[(a == (255, 103, 139)).all(-1)] = (42, 48, 58)
    im = Image.fromarray(a).resize((im.width * z, im.height * z), Image.NEAREST)
    return f'<figure><img src="{png(im)}" width="{im.width}" height="{im.height}"><figcaption>{cap}</figcaption></figure>'


def ofig(im, cap):
    return f'<figure><img src="{png(im)}" width="{im.width}" height="{im.height}"><figcaption>{cap}</figcaption></figure>'


Z = 6
orig_castle = ofig(cell(ORIG, 20, 10, 2, 2, Z), '원본 어두운 성 (World.png 20,10)')
orig_fort = ofig(cell(ORIG, 22, 10, 2, 2, Z), '원본 푸른 지붕 성 (22,10)')
orig_town = ofig(cell(ORIG, 22, 8, 2, 2, Z), '원본 마을 아이콘 (22,8)')
ROWS = [('대성 (6×6)', [orig_castle, orig_town], 'capital-96.png'),
        ('요새 읍 (4×4)', [orig_castle, orig_fort], 'fort-64.png'),
        ('내해 항구 (5×4)', [orig_town, orig_castle], 'harbor-80x64.png')]
rows_html = ''
for ttl, orig, fn in ROWS:
    rows_html += f'<h3>{ttl}</h3><div class="row8">' + ''.join(orig) \
        + icon_fig(HERE / 'cities-v5' / fn, Z, '구 5단계 (6배)') + icon_fig(HERE / 'cities-v6' / fn, Z, '새 6단계 (6배)') + '</div>'


# 동영상 조각
VOLC, WF = A.VOLC, A.WF
fx = ''.join([
    effect('화산 연기', (VOLC[0] - 50, VOLC[1] - 66, VOLC[0] + 60, VOLC[1] + 14), 4, '분화구에서 뜨거운 연기가 천천히 올라가며 재로 식고 옅어진다(6덩이)', ms=250, nf=6),
    effect('바닷가 물결', (700, 600, 800, 680), 5, '얕은 물이 해안선을 따라 밀려와 흰 거품선으로 닿는다(4단계 순환, 잔 반짝임)', ms=300),
    effect('폭포', (WF[0] - 40, WF[1] - 30, WF[0] + 40, WF[1] + 50), 5, '절벽 틈에서 떨어지는 물줄기와 물보라', ms=250),
    effect('마을 굴뚝 연기', (590, 380, 690, 470), 5, '지붕 굴뚝에서 작은 연기 4덩이가 흔들리며 오른쪽으로 천천히 흩어진다', ms=250, nf=6),
    effect('용암 일렁임', (1250, 290, 1400, 370), 4, '용암 줄기의 밝고 어두운 띠가 흐르고 불티가 떠올랐다 진다', ms=300),
    effect('독늪 기포', (980, 250, 1100, 330), 5, '독수·늪 칸에서 기포가 올라와 터진다', ms=350),
])

# 전체 지도 캔버스 루프
base_uri = png(Image.open(AN / 'base.png').convert('RGB'))
diff_uris = [png(rgba_clean(AN / f'diff{f:02d}.png')) for f in range(A.N)]
cl_uri, sh_uri = png(rgba_clean(AN / 'clouds.png')), png(rgba_clean(AN / 'cloudshadow.png'))
JS = '''
(function(){
const L=(s)=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=s;});
const D=window.__D;
Promise.all([L(D.base),...D.diffs.map(L),L(D.cl),L(D.sh)]).then(ims=>{
  const base=ims[0],diffs=ims.slice(1,13),cl=ims[13],sh=ims[14];
  const c=document.getElementById('mapcv'),x=c.getContext('2d');x.imageSmoothingEnabled=false;
  const W=base.width,H=base.height;c.width=W;c.height=H;
  let speed=1,cloudsOn=true,fxOn=true,t0=performance.now(),paused=false,pt=0;
  window.__ctl={setSpeed:v=>{speed=v;const o=document.getElementById('spv');if(o)o.textContent='×'+v;},clouds:v=>cloudsOn=v,fx:v=>fxOn=v,pause:v=>{paused=v;}};
  function frame(now){
    if(!paused)pt+=(now-(window.__last||now))*speed;window.__last=now;
    const f=Math.floor(pt/250)%12;
    x.drawImage(base,0,0);
    if(fxOn)x.drawImage(diffs[f],0,0);
    if(cloudsOn){const s=Math.floor(pt*0.018)%W;
      for(const L2 of [sh,cl]){x.drawImage(L2,s,0);x.drawImage(L2,s-W,0);}}
    for(const z of document.querySelectorAll('canvas.zoom')){   // 확대 창: 같은 캔버스에서 잘라 그려 이음매가 없다
      const [sx,sy,sw,sh2,k]=z.dataset.box.split(',').map(Number);const zx=z.getContext('2d');zx.imageSmoothingEnabled=false;
      zx.drawImage(c,sx,sy,sw,sh2,0,0,sw*k,sh2*k);}
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
});
})();
'''
import json
DATA = json.dumps({'base': base_uri, 'diffs': diff_uris, 'cl': cl_uri, 'sh': sh_uri})


def crop_pair(win, cap, z=3, a=None, b=None, la='7단계', lb='8단계'):
    a = a or v7; b = b or v8
    x0, y0, x1, y1 = win
    cr = lambda im: im.crop((x0 * 16, y0 * 16, x1 * 16, y1 * 16)).resize(((x1 - x0) * 16 * z, (y1 - y0) * 16 * z), Image.NEAREST)
    A_, B_ = cr(a), cr(b)
    o = Image.new('RGB', (A_.width * 2 + 8, A_.height), (255, 0, 255)); o.paste(A_, (0, 0)); o.paste(B_, (A_.width + 8, 0))
    return f'<figure><img src="{png(o)}" width="{o.width}" height="{o.height}"><figcaption>{cap} (타일 {x0},{y0}~{x1},{y1}, {z}배) — 왼쪽 {la} · 오른쪽 {lb}</figcaption></figure>'


# 도시: 지난 라운드 결과와의 대조는 원본 성 아이콘과 나란히
def site3(name, sc=4, pad=2):
    x, y, w, h = ic[name]
    im = v8.crop(((x - pad) * 16, (y - pad) * 16, (x + w + pad) * 16, (y + h + pad) * 16))
    return fig(im.resize((im.width * sc, im.height * sc), Image.NEAREST), f'{name}: {w}x{h}칸 (실제 지도 위, {sc}배)')
cities = ofig(cell(ORIG, 20, 10, 2, 2, 6), '원본 어두운 성 (World.png 20,10, 6배)') + ofig(cell(ORIG, 22, 8, 2, 2, 6), '원본 마을 (22,8, 6배)') \
    + site3('대성') + site3('내해 항구', 4, 3) + site3('사바나 마을', 4, 3)

# 랜드마크: 원본 성 아이콘과 같은 디테일 수준 비교
def keyed(a, bg=(42, 48, 58)):
    a = a.copy(); a[(a == (255, 103, 139)).all(-1)] = bg
    return Image.fromarray(a)


def icon_row(name, bg, z=6):
    """원본 성(비교 기준) · 7단계 · 8단계 아이콘을 같은 배율로 나란히."""
    f7 = next((f for n, f, *_ in L7.LANDMARKS if n == name), None)
    f8, w, h, desc = next((f, w, h, d) for n, f, w, h, d in LM.LANDMARKS if n == name)
    ref = cell(ORIG, 18, 10, 2, 2, z) if name == 'giant_tree' else cell(ORIG, 20, 10, 2, 2, z)
    refcap = '원본 큰 나무 (World.png 18,10)' if name == 'giant_tree' else '원본 어두운 성 (World.png 20,10)'
    out = ofig(ref, f'{refcap}, {z}배')
    if f7:
        a7 = f7(); out += ofig(keyed(a7, bg).resize((a7.shape[1] * z, a7.shape[0] * z), Image.NEAREST), f'7단계 {desc} ({a7.shape[1] // 16}x{a7.shape[0] // 16}칸)')
    a8 = f8(); out += ofig(keyed(a8, bg).resize((a8.shape[1] * z, a8.shape[0] * z), Image.NEAREST), f'<b>8단계</b> {desc} ({w}x{h}칸)')
    return f'<div class="row8">{out}</div>'


WEAK_LIST = [
    '폐허 도시: 「무너졌다」는 읽히지만 원본 성보다 정보가 빽빽해서 1배 지도에서는 벽 조각·돌무더기·집 벽이 한 덩어리로 뭉친다. 지붕 없는 집 두 채의 벽이 너무 반듯한 네모다.',
    '사막 신전: 윗면+앞면+계단식 기단은 지켜졌지만 돌 색이 모래 바닥과 명도가 가까워 지도 위에서 덜 튄다. 가운데 계단이 층 앞면과 충분히 갈리지 않는다.',
    '거목: 수관은 원본 큰 나무처럼 덩이·어두운 띠·아래오른쪽 테로 바뀌었으나 원본보다 알갱이(7ac83c/40a837 섞임)가 덜 거칠다. 거목 둘레 숲이 칸 단위로 비워져 네모난 공터가 그대로 보인다.',
    '천공섬: 밑동의 돌 덩이가 벽돌처럼 규칙적이고, 섬은 여전히 제자리에 정지해 있다(떠오르는 움직임 없음). 윗면 사당이 작고 단순하다.',
    '절벽: 앞면이 없는 옆·뒤 가장자리는 원본처럼 1px 테뿐이라, 위아래가 같은 바닥인 곳(북서 고원 서쪽, 흙 고원 동쪽)에서는 높이 차가 약하게 읽힌다. 바위 종류마다 돌 덩이 크기가 같다.',
    '메사: 탁상이 되었지만 가장 큰 뷰트가 능선 칸을 따라 길쭉한 뱀 모양이고, 윗판 앞 모서리의 두께감이 얇다.',
    '협곡: 바닥 깊이는 생겼으나 북쪽 끝(강 쪽 입구)에 칸 단위 벽 조각이 네모로 남아 있다.',
    '길: 길찾기가 칸 단위 네 방향이라 랜드마크로 가는 새 길도 ㄱ자로 꺾인다. 흙 고원·황무지 고원 위의 작은 바위 장식은 여전히 칸마다 하나씩 흩어진 느낌이다.',
    '구름 확대 창은 캔버스라 이음매가 없지만, 이 페이지를 정지 이미지로 저장하면 움직임이 보이지 않는다.',
]

lm8 = [
    ('천공섬', 'sky_island', (30, 98, 168), (54, 45, 68, 57),
     '7단계는 매끈한 원뿔에 사선 줄무늬였다. 8단계: 윗면 풀밭(원본 풀 3색 알갱이) · 원본 숲 칸의 나무를 그대로 심고 · 사당은 윗판+앞면+문 · 샘에서 앞 가장자리로 떨어지는 폭포. '
     '밑동은 원본 절벽 문법(어두운 바탕에 밝은 돌 덩이, 줄마다 엇갈림) + 들쭉날쭉한 지층 턱 + 매달린 뿌리 + 뾰족한 바위 끝 셋. 크기는 5x3→5x4칸. 바다 위 그림자는 오른쪽 아래로 비끼고 안쪽 꽉·바깥 체크·가장자리 성긴 점 3단.'),
    ('거목', 'giant_tree', (65, 157, 57), (11, 30, 21, 40),
     '7단계는 둥근 덩이 몇 개에 매끈한 그라디언트였다. 8단계: 원본 큰 나무 칸처럼 테 선 없이 윗·왼쪽은 어두운 초록 자체가 가장자리, 아래·오른쪽만 1d2c33/000000 로 닫는다. '
     '덩이 16개를 4줄로 뒤→앞 겹쳐, 덩이마다 윗왼쪽 7ac83c · 아래끝 어두운 띠 · 오른쪽 아래 테는 체크 디더로 한 단 어둡게. 줄기는 원본 줄기 4색, 뿌리가 세 갈래로 벌어지고 구멍 문. 바닥 그림자는 오른쪽 아래.'),
    ('사막 신전', 'desert_temple', (226, 206, 146), (28, 56, 40, 66),
     '7단계는 정면 입면(윗면이 거의 안 보임)이었다. 8단계: 세 층마다 윗면(밝은 판 · 뒤쪽 한 줄은 윗층이 드리운 그늘 · 앞 모서리 빛 턱) + 앞면(벽돌 결, 왼쪽 밝음 → 오른쪽 어두움) + 가운데 앞 계단(디딤/챌판 교대, 난간). '
     '꼭대기 사당은 판 지붕 윗면 + 처마 + 기둥 둘 + 문. 색은 원본 흙·절벽·신전 아이콘 색만(4f2e21~e1d7c1), 테는 원본 신전과 같은 111618, 그림자는 오른쪽 옆·아래 모래 위.'),
    ('폐허 도시', 'ruined_city', (58, 56, 62), (74, 20, 86, 30),
     '7단계는 윗부분만 톱니로 깎은 성이라 「무너졌다」가 약했다. 8단계: 바닥을 비워 지도 바닥이 비치게 하고, 뒤 성벽은 두 군데가 무너져 돌무더기만 남음 · 왼쪽 큰 탑은 반쯤 부러져 속이 빈 윗면 · 오른쪽 탑은 사선으로 잘림 · '
     '집 둘은 지붕 없이 벽 윗면 테와 어두운 안바닥, 앞벽 일부가 낮게 무너짐 · 앞 낮은 성벽 두 동강 · 무너진 돌덩이(윗면+앞면) 흩어짐 · 오른쪽 아래 그림자.'),
]
lm_html = ''
for ttl, name, bg, win, why in lm8:
    lm_html += f'<h3>{ttl}</h3><p>{why}</p>' + icon_row(name, bg) + crop_pair(win, ttl + ' — 실제 지도 위', 4)

cliff_list = [
    ('북서 고원 남쪽 벽 (좁은 벽의 사다리 지층)', (9, 24, 22, 33)),
    ('북서 고원 모서리 · 옆 가장자리', (6, 14, 18, 24)),
    ('툰드라 고원 (윗면 색 덩이 · 위·오른쪽 풀 테)', (12, 17, 23, 27)),
    ('황무지 고원 (남·서 벽, 분화구 호수)', (62, 30, 82, 46)),
    ('흙 고원 (남서 해협)', (24, 43, 39, 58)),
]
cliffs = ''.join(crop_pair(w, n, 4) for n, w in cliff_list)
orig_cliff = ofig(ORIG.crop((288, 0, 384, 48)).resize((96 * 5, 48 * 5), Image.NEAREST), '원본 물결 절벽 (World.png 18~23,0~2, 5배)') \
    + ofig(ORIG.crop((336, 64, 384, 112)).resize((48 * 5, 48 * 5), Image.NEAREST), '원본 절벽 벽 칸 (21~23,4~6, 5배)')
mesa = crop_pair((11, 47, 21, 58), '사막 메사 (뾰족한 산 → 탁상 뷰트)', 4) + crop_pair((73, 54, 85, 64), '남동 붉은 섬의 메사', 4)
canyon = crop_pair((76, 29, 88, 42), '균열 협곡 (구덩이 깊이)', 4)
roads = crop_pair((38, 26, 54, 42), '거대한 탑 ─ 내해 항구 · 고대 돌원', 3) + crop_pair((10, 24, 22, 38), '거목 ─ 서 고원 경사로', 3) \
    + crop_pair((18, 52, 36, 64), '사막 신전 ─ 사막 폐허', 3) + crop_pair((64, 20, 82, 42), '폐허 도시 ─ 사바나 마을 · 분화구 호수 ─ 동 고원 경사로', 3)
stump = crop_pair((27, 46, 32, 50), '흙 바닥 그루터기 장식 (네모 틀 → 3/4 그루터기)', 8)
full78 = crop_pair((0, 0, 96, 72), '전체 지도', 1)

WEAK = ''.join(f'<li>{t}</li>' for t in WEAK_LIST)
PAGE = f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>월드맵 설계 데모 8단계</title>
<meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{{background:#15181d;color:#dfe5ee;font:14px/1.55 -apple-system,"Noto Sans KR",sans-serif;margin:0;padding:20px 24px 60px;max-width:2120px}}
h1{{font-size:22px;margin:0 0 4px}} h2{{font-size:17px;margin:34px 0 8px;border-bottom:1px solid #2c333d;padding-bottom:4px}}
h3{{margin:22px 0 4px;color:#cfd8e6;font-size:15px}}
p,li{{color:#b9c2cf}} .sub{{color:#8b96a5}} b{{color:#fff}}
figure{{margin:8px 0 18px}} figcaption{{color:#8b96a5;font-size:13px;margin-top:6px}}
img,canvas{{image-rendering:pixelated;max-width:100%;height:auto;border:1px solid #2c333d}}
.row8{{display:flex;flex-wrap:wrap;gap:10px 26px;align-items:flex-start}} .row8 figure{{flex:none}} .row8 img{{max-width:none}} .grid3 h3{{margin:18px 0 4px;color:#cfd8e6}}
.fxs{{display:flex;flex-wrap:wrap;gap:8px 28px}}
.ctl button{{background:#222831;color:#dfe5ee;border:1px solid #3a4350;border-radius:4px;padding:4px 10px;margin-right:6px;cursor:pointer}}
.attr{{margin-top:34px;padding:10px 14px;border:1px solid #2c333d;border-radius:6px;font-size:12.5px;color:#8b96a5}}
</style></head><body>
<h1>월드맵 설계 데모 8단계 — 천공섬·거목·사막 신전·폐허 도시 재작도, 절벽 결·메사·협곡·길</h1>
<p class="sub">7단계 뒤 지적(천공섬 조악 · 거목 수관 · 사막 신전 3/4 아님 · 절벽 외곽 허접 · §9 목록)을 전부 다시 했다. 비교는 모두 <b>왼쪽 7단계 · 오른쪽 8단계</b>, 4배. 원본 EasyRPG World.png 의 성·큰 나무·절벽 칸을 8배로 재어 그 색과 결을 따라 좌표로 찍은 손 도트이고, 생성 이미지·트레이싱은 없다.</p>

<h2>1. 움직이는 전체 지도 (1536×1152)</h2>
<p>구름은 초속 18px(전체 약 85초), 연기 250ms×6프레임, 물결·용암·기포 250~400ms. 7단계와 같은 느린 속도이고 슬라이더로 더 늦출 수 있다.</p>
<div class="ctl"><label>속도 <input type="range" min="0.25" max="4" step="0.25" value="1" oninput="__ctl.setSpeed(+this.value)"> <b id="spv">×1</b> (×1 = 기본·느림)</label> &nbsp; </div>
<div class="ctl"><button onclick="__ctl.clouds(false)">구름 끄기</button><button onclick="__ctl.clouds(true)">구름 켜기</button><button onclick="__ctl.fx(false)">효과 끄기</button><button onclick="__ctl.fx(true)">효과 켜기</button></div>
<canvas id="mapcv" width="1536" height="1152" style="margin-top:8px"></canvas>
<script>window.__D={DATA};</script><script>{JS}</script>

<h2>2. 랜드마크 재작도 (원본 기준 · 7단계 · 8단계, 6배 + 지도 위 4배)</h2>
<p>기준은 원본 어두운 성(거목은 원본 큰 나무)이다. 같은 배율로 나란히 놓고, 1px 테 · 왼쪽 위 빛 · 6단 명암 + 체크 디더 · 윗면+앞면이 그 수준에 닿는지 본다.</p>
{lm_html}

<h2>3. 절벽 외곽선 (4배)</h2>
<p>먼저 원본 절벽을 8배로 다시 봤다: 벽은 291010/411e05 어두운 바탕에 8c5a21/a77b4b 밝은 돌 덩이(폭 3~6, 높이 2~3)가 줄마다 엇갈려 박히고, 덩이마다 윗줄 65442a·아랫줄 4f2e21 테가 있다. 매끈한 띠·물결 줄무늬는 없다.
7단계의 V자 물결 지층을 버리고 이 덩이 결을 해시 격자(줄 높이도 느린 잡음으로 휘게)로 깔아 좁은 벽에서도 사다리가 생기지 않게 했다. 고원 윗면과 둘레는 「높이 없는 바닥」 렌더로 통째로 다시 깔아 옛 칸 조각(네모난 옅은 색 덩이, 툰드라 위·오른쪽의 덩어리진 풀 테)을 지웠고, 윗면 끝은 원본처럼 짙은 풀(1d5728) 한 줄 + 1~2줄 어두운 테, 밑은 부스러기 돌 + 오른쪽 아래 체크 그림자. 경사로 자리에는 테를 두르지 않는다.</p>
<div class="row8">{orig_cliff}</div>
{cliffs}

<h2>4. 메사 — 탁상 모양 (4배)</h2>
<p>뾰족한 산 스프라이트를 버리고 메사 칸을 해시로 끊어 뷰트 여러 개로 나눈 뒤, 발자국을 위로 밀어 윗면 평판(붉은 흙 3단 + 잔금 + 풀 몇 점, 앞 모서리 빛 턱)과 앞 절벽면(같은 돌 덩이 결)을 만들고 오른쪽 아래로 그림자를 끌었다. 큰 뷰트일수록 벽이 높다(7~13px).</p>
{mesa}

<h2>5. 협곡 구덩이 — 깊이 (4배)</h2>
<p>북벽(앞을 보는 안벽)은 돌 덩이 결로 밑으로 갈수록 어둡고, 벽 밑에는 떨어진 돌무더기, 서쪽 안벽은 어둡고 동쪽 안벽은 빛을 받아 밝다. 바닥은 북벽에서 멀어질수록 한 단씩 옅어지는 5단 체크 디더(단색 → 깊이), 잔돌이 흩어진다. 남쪽 가장자리는 땅 끝이 밝은 흙 턱으로 보인다.</p>
{canyon}

<h2>6. 랜드마크를 잇는 길 (3배)</h2>
<p>기존 길찾기(높이 다른 칸·절벽은 막고 경사로만 통과)에 여섯 길을 더했다: 거대한 탑 ─ 내해 항구, 거대한 탑 ─ 고대 돌원, 거목 ─ 서 고원 경사로, 사막 신전 ─ 사막 폐허, 폐허 도시 ─ 사바나 마을, 분화구 호수 ─ 동 고원 경사로. 길 그림은 마을 길과 같은 문법이다.</p>
{roads}
{stump}

<h2>7. 구름 확대 창 (이음매 없음)</h2>
<p>7단계의 구름 GIF 조각은 12프레임만 담아 반복 지점에서 60px 튀었다. 8단계는 GIF 를 버리고 위 캔버스에서 그 부분을 매 프레임 잘라 2배로 그린다 — 같은 시계를 쓰므로 반복 지점이 없다.</p>
<canvas class="zoom" data-box="0,180,400,240,2" width="800" height="480"></canvas>

<h2>8. 부분 애니메이션 (확대, 반복 재생)</h2>
<div class="fxs">{fx}</div>

<h2>9. 성곽 도시 (현재 상태)</h2>
<div class="grid3">{cities}</div>

<h2>10. 전체 지도 (7단계 → 8단계, 1배)</h2>
{full78}

<h2>11. 아직 어색한 곳 (솔직하게)</h2>
<ul>{WEAK}</ul>

<div class="attr">원본 지형·아이콘은 EasyRPG RTP <code>ChipSet/World.png</code> (CC BY 4.0). 천공섬 위 나무 7그루는 원본 숲 칸(0,12)의 나무 한 그루를 풀색만 빼고 그대로 옮겨 심은 것이고, 폐허 도시의 탑·성벽은 원본 어두운 성 모듈을 잘라 부순 것(CC BY 4.0 파생물)이다. 나머지 8단계 도트(천공섬 밑동·사당, 거목, 사막 신전, 폐허 도시의 집·돌무더기, 절벽 결, 메사, 협곡, 그루터기, 섬 그림자)는 원본 팔레트 색을 좌표로 적어 찍었다. 크로노 트리거·FF6는 구성 방식만 관찰했고 그림·데이터는 쓰지 않았다. 생성 이미지·트레이싱 없음.
출처 표기: <code>tiledata/atlas-pick/worldmap-easyrpg-plus/ATTRIBUTION-NOTE.md</code>. 스크립트: <code>design-map/landmarks_v8.py</code>, <code>cliff_v8.py</code>, <code>make_map_v5.py</code>(CITY_TAG=v8), <code>anim_v5.py</code>, <code>make_design_page_v8.py</code>.</div>
</body></html>'''
Path(OUT).parent.mkdir(parents=True, exist_ok=True)
Path(OUT).write_text(PAGE, encoding='utf-8')
print('wrote', OUT, len(PAGE) // 1024, 'KB')
