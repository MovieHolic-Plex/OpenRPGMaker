#!/usr/bin/env python3
"""월드맵 설계 데모 5단계 비교 페이지(자체완결 HTML, 이미지는 data URI).
  python3 make_design_page_v7.py [출력경로]   기본 ~/claude-viz/worldmap-design.html
먼저 CITY_TAG=v6 로 make_cities_v6.py, make_map_v5.py, anim_v5.py (그리고 make_pairkit_v5.py) 를 돌려 design-1x-v5b.png / pairkit-v5.png / pairmatrix-v5.png / anim-v5/ 를 만든다."""
import base64, io, os, sys
from pathlib import Path
import numpy as np
from PIL import Image
import anim_v5 as A

HERE = Path(__file__).resolve().parent
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/claude-viz/worldmap-design.html')
AN = HERE / 'anim-v7'


def b64(data, mime):
    return f'data:{mime};base64,' + base64.b64encode(data).decode()


def png(im):
    b = io.BytesIO(); im.save(b, 'PNG', optimize=True); return b64(b.getvalue(), 'image/png')


def rgba_clean(path):
    a = np.array(Image.open(path).convert('RGBA')); a[a[..., 3] == 0] = 0
    return Image.fromarray(a)


rgb = lambda p: Image.open(p).convert('RGB')
v6, v7 = rgb(HERE / 'design-1x-v6.png'), rgb(HERE / 'design-1x-v7.png')
v7pre = rgb(HERE / 'design-1x-v7-precliff.png')   # 절벽 재작도 직전(랜드마크까지 반영)
v4 = v6; v5 = v7; v5old = v6
ORIG = rgb(HERE / '../../../../public/assets/easyrpg-chipset-world.png')
M, ic, _ = A.load()
import landmarks_v7 as LM


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
    effect('구름과 구름 그림자', (0, 180, 400, 420), 2, '반투명 구름이 지나가며 그림자를 땅 위에 끌고 간다(진짜 알파 대신 4×4 디더). 이 조각은 프레임마다 5px(초속 20px)로 전체 지도를 약 77초에 건넌다. 반복 지점에서 튀는 것은 GIF 한계이고 위 캔버스는 이음매 없이 흐른다', clouds=True),
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
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
});
})();
'''
import json
DATA = json.dumps({'base': base_uri, 'diffs': diff_uris, 'cl': cl_uri, 'sh': sh_uri})


def crop_pair(win, cap, z=3, a=None, b=None, la='6단계', lb='7단계'):
    a = a or v6; b = b or v7
    x0, y0, x1, y1 = win
    cr = lambda im: im.crop((x0 * 16, y0 * 16, x1 * 16, y1 * 16)).resize(((x1 - x0) * 16 * z, (y1 - y0) * 16 * z), Image.NEAREST)
    A_, B_ = cr(a), cr(b)
    o = Image.new('RGB', (A_.width * 2 + 8, A_.height), (255, 0, 255)); o.paste(A_, (0, 0)); o.paste(B_, (A_.width + 8, 0))
    return f'<figure><img src="{png(o)}" width="{o.width}" height="{o.height}"><figcaption>{cap} (타일 {x0},{y0}~{x1},{y1}, {z}배) — 왼쪽 {la} · 오른쪽 {lb}</figcaption></figure>'


coast = crop_pair((6, 40, 26, 58), '서대륙 남서 해안선', 3) + crop_pair((40, 26, 56, 44), '내해 동안 해안과 숲 가장자리', 3) \
    + crop_pair((58, 44, 78, 62), '남쪽 바다와 섬줄기', 3)
seas = crop_pair((0, 0, 24, 14), '북서 바다: 수심 띠 경계', 3)
forest = crop_pair((4, 26, 24, 40), '서부 숲 가장자리(둥근 수관 덩이 줄)', 3)

# 도시: 지난 라운드 결과와의 대조는 원본 성 아이콘과 나란히
def site3(name, sc=4, pad=2):
    x, y, w, h = ic[name]
    im = v7.crop(((x - pad) * 16, (y - pad) * 16, (x + w + pad) * 16, (y + h + pad) * 16))
    return fig(im.resize((im.width * sc, im.height * sc), Image.NEAREST), f'{name}: {w}x{h}칸 (실제 지도 위, {sc}배)')
cities = ofig(cell(ORIG, 20, 10, 2, 2, 6), '원본 어두운 성 (World.png 20,10, 6배)') + ofig(cell(ORIG, 22, 8, 2, 2, 6), '원본 마을 (22,8, 6배)') \
    + site3('대성') + site3('내해 항구', 4, 3) + site3('사바나 마을', 4, 3)

# 랜드마크: 원본 성 아이콘과 같은 디테일 수준 비교
lm_figs = ofig(cell(ORIG, 20, 10, 2, 2, 6), '비교용 원본 어두운 성 (2x2칸, 6배)')
for name, fn, w, h, desc in LM.LANDMARKS:
    a = fn(); im = Image.fromarray(a)
    arr = np.array(im); arr[(arr == (255, 103, 139)).all(-1)] = (42, 48, 58)
    im = Image.fromarray(arr).resize((w * 16 * 6, h * 16 * 6), Image.NEAREST)
    lm_figs += ofig(im, f'{desc} ({w}x{h}칸, 6배)')
def lmsite(name, win, z=3):
    return crop_pair(win, name + ' — 실제 지도 위', z, a=v6, b=v7, la='랜드마크 전', lb='랜드마크 후')
lm_maps = lmsite('천공섬(바다 위, 섬 밑 그림자)', (54, 45, 68, 56)) + lmsite('폐허 도시', (74, 20, 86, 30)) + lmsite('분화구 호수', (64, 36, 76, 46)) \
    + lmsite('사막 신전', (28, 56, 40, 66)) + lmsite('거대한 탑과 돌원', (44, 26, 54, 42)) + lmsite('거목', (11, 30, 21, 40))
cliffs = ''.join(crop_pair(w, n, 4, a=v7pre, b=v7, la='전', lb='후') for n, w in [
    ('북서 고원 남쪽 벽', (10, 26, 22, 33)), ('북서 고원 모서리', (8, 14, 18, 23)), ('툰드라 고원', (12, 17, 23, 27)),
    ('황무지 고원 남쪽 벽', (63, 37, 75, 46)), ('협곡(구덩이 북벽)', (76, 29, 88, 42)), ('흙 고원 남서', (25, 44, 37, 54)),
    ('메사 군(미처리: 원뿔 스프라이트 그대로)', (11, 47, 21, 58))])
PAGE = f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>월드맵 설계 데모 7단계</title>
<meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{{background:#15181d;color:#dfe5ee;font:14px/1.55 -apple-system,"Noto Sans KR",sans-serif;margin:0;padding:20px 24px 60px;max-width:2120px}}
h1{{font-size:22px;margin:0 0 4px}} h2{{font-size:17px;margin:34px 0 8px;border-bottom:1px solid #2c333d;padding-bottom:4px}}
p,li{{color:#b9c2cf}} .sub{{color:#8b96a5}} b{{color:#fff}}
figure{{margin:8px 0 18px}} figcaption{{color:#8b96a5;font-size:13px;margin-top:6px}}
img,canvas{{image-rendering:pixelated;max-width:100%;height:auto;border:1px solid #2c333d}}
.row8{{display:flex;flex-wrap:wrap;gap:10px 26px;align-items:flex-start}} .row8 figure{{flex:none}} .row8 img{{max-width:none}} .grid3 h3{{margin:18px 0 4px;color:#cfd8e6}}
.grid{{display:flex;flex-wrap:wrap;gap:6px 26px}} .grid figure{{margin:6px 0 14px}}
.fxs{{display:flex;flex-wrap:wrap;gap:8px 28px}}
.ctl button{{background:#222831;color:#dfe5ee;border:1px solid #3a4350;border-radius:4px;padding:4px 10px;margin-right:6px;cursor:pointer}}
.ev{{border-collapse:collapse;width:100%;font-size:13px}} .ev th,.ev td{{border:1px solid #2c333d;padding:6px 9px;vertical-align:top;text-align:left}} .ev th{{background:#1d222a;color:#cfd8e6}} .gm{{color:#e8c872}} .gb{{color:#f09a8a}}
.attr{{margin-top:34px;padding:10px 14px;border:1px solid #2c333d;border-radius:6px;font-size:12.5px;color:#8b96a5}}
</style></head><body>
<h1>월드맵 설계 데모 7단계 — 3/4 랜드마크 · 절벽 외곽선 · 느린 애니메이션</h1>
<p class="sub">6단계 뒤 지적 세 가지를 고쳤다. (1) 랜드마크 7종을 3/4 시점 계약(위면+앞면, 측면 없음, 좌상 광원, 원통 음영, 3/4 계단 문법)으로 다시 찍었다. (2) 고원·협곡 절벽의 계단 직각을 없앴다(둥근 모서리, 지층 띠, 풀·흙 턱, 밑 그림자). (3) 구름·연기·물결을 느리게 하고 속도 슬라이더를 달았다(기본이 느린 쪽). 전부 EasyRPG World 팔레트로 좌표를 적어 찍은 손 도트이고 생성 이미지·트레이싱은 없다.</p>

<h2>1. 움직이는 전체 지도 (1536×1152)</h2>
<p>구름은 초속 18px(전체 약 85초), 연기는 250ms×6프레임 주기, 물결·용암·기포는 250~400ms 간격이다. 슬라이더로 바꾼다.</p>
<div class="ctl"><label>속도 <input type="range" min="0.25" max="4" step="0.25" value="1" oninput="__ctl.setSpeed(+this.value)"> <b id="spv">×1</b> (×1 = 기본·느림)</label> &nbsp; </div>
<div class="ctl"><button onclick="__ctl.clouds(false)">구름 끄기</button><button onclick="__ctl.clouds(true)">구름 켜기</button><button onclick="__ctl.fx(false)">효과 끄기</button><button onclick="__ctl.fx(true)">효과 켜기</button></div>
<canvas id="mapcv" width="1536" height="1152" style="margin-top:8px"></canvas>
<script>window.__D={DATA};</script><script>{JS}</script>

<h2>2. 성곽 도시 (원본 성 옆에 나란히)</h2>
<p>원본 성·마을 아이콘과 같은 굵은 탑·성벽·성문·안쪽 성 모듈을 재배열했다. 수도는 팔각 성벽과 안쪽 성, 항구 성읍은 남쪽이 부두다.</p>
<div class="grid3">{cities}</div>

<h2>3. 해안선 · 숲 가장자리 (전 → 후)</h2>
<p>땅/바다 경계를 잡음으로 재성형해 불규칙하게 하고, 육지 쪽에 1px 어두운 테·모래선, 바다 쪽에 거품선을 그렸다. 숲 가장자리는 둥근 수관 덩이가 줄지어 서서 격자 직선이 사라졌다.</p>
{coast}
{forest}

<h2>4. 바다 수심 띠 (전 → 후)</h2>
<p>해안에서 멀어지며 얕은 물 → 중간 → 깊은 바다 세 띠. 띠 경계는 잡음으로 굽이치고 1~2px 체크 디더만 쓴다. 얕은 물에는 산호 점이 있다.</p>
{seas}

<h2>5. 랜드마크 7종 (손 도트)</h2>
<p>원본 어두운 성 아이콘과 같은 디테일(1px 어두운 테, 좌상단 광원, 6단 명암 + 체크 디더)로 새로 찍었다. 위 왼쪽이 비교용 원본이다.</p>
<div class="row8">{lm_figs}</div>
<h3>실제 지도 위 배치 (전 → 후)</h3>
{lm_maps}

<h2>5b. 절벽 외곽선 (전 → 후, 4배)</h2>
<p>원본 EasyRPG World 의 절벽·산 문법을 8배로 재어 적용했다. 둥근 모서리의 평판에 1~2px 들쭉날쭉한 어두운 테, 산줄기의 V자 지층 띠(밝고 어두운 3~4px), 위쪽은 풀·흙 턱, 아래쪽은 부스러기와 밑 그림자. 안팎 모서리의 계단 직각과 45도 경계는 둥글게 깎았다. 왼쪽이 전(6단계 절벽 면), 오른쪽이 후.</p>
{cliffs}

<h2>6. 부분 애니메이션 (확대, 반복 재생)</h2>
<p>연기는 6프레임·250ms, 물결·용암은 4단계·300ms, 기포 350ms, 구름은 초속 20px 이하다.</p>
<div class="fxs">{fx}</div>

<h2>7. FF6·크로노 트리거와 비교한 솔직한 자기 평가</h2>
<p class="sub">두 게임의 월드맵은 기억과 공개된 구성 관찰로만 비교했다(그림·데이터는 쓰지 않음). 「격차」는 지금 이 데모가 어디까지 왔고 어디가 모자란지다.</p>
<table class="ev"><tr><th>항목</th><th>FF6·크로노 트리거</th><th>이 데모(7단계)</th><th>격차</th></tr>
<tr><td>지형 종류</td><td>FF6 는 모래·풀·숲·설원·황무지·용암·폐허 지대까지 한 판에 수십 종, 크로노는 시대마다 다른 지형 세트.</td><td>초원·숲·설원·사막·사바나·정글·늪·화산재·용암·붉은 메사·빙하 11종 이상, 강·호수.</td><td class="gm">중간. 종류 수는 근접. 지형 안의 잔무늬(풀 결, 모래 물결)가 단조롭고 고저 단이 적다.</td></tr>
<tr><td>경계</td><td>지형끼리 타일 전용 경계 조각이 있어 곡선으로 이어지고 해안은 불규칙하다.</td><td>픽셀 곡선 경계, 해안선은 잡음으로 들쭉날쭉하게 재성형하고 모래선·거품선을 그렸다. 숲 가장자리는 둥근 수관 줄.</td><td class="gm">작음~중간. 모양은 비슷해졌으나 해안 굴곡이 아직 대륙 전체에 고르게 큰 만·곶 없이 잔물결 위주다.</td></tr>
<tr><td>아이콘</td><td>성·마을·탑·동굴·부유 대륙·거대 나무 등 고유 랜드마크 수십 개가 모두 제각각.</td><td>성곽 도시 3종(크기 다름) + 랜드마크 7종(천공섬·거대 탑·폐허 도시·거목·분화구 호수·사막 신전·돌원) + 원본 마을·성·탑·동굴 재조립.</td><td class="gb">큼. 고유 아이콘이 10종 정도로 수가 적고, 같은 마을 그림이 여러 곳에 반복된다. 사건마다 다른 장소성이 모자라다.</td></tr>
<tr><td>애니메이션</td><td>FF6 는 바다·강 물결이 있고 크로노는 구름 그림자·바다 반짝임이 있다. 부유 대륙은 떠 있다.</td><td>물결, 폭포, 화산·굴뚝 연기, 용암, 기포, 구름과 구름 그림자(12프레임).</td><td class="gm">중간. 종류는 충분하나 천공섬이 제자리에 정지해 있고 캐릭터·탈것이 없다.</td></tr>
<tr><td>색 분위기</td><td>대륙마다 채도와 명도를 달리해 지역 느낌이 크게 갈린다.</td><td>지형 색은 갈리지만 전체 채도가 균일하고 대륙 간 분위기 차이(시간대·날씨)는 없다.</td><td class="gm">중간. 지역별 색조 보정이나 폐허·독 지대의 탁한 색 처리가 더 필요하다.</td></tr>
<tr><td>구도</td><td>중앙에 큰 내해, 대륙마다 역할(시작·위기·종반)이 있고 여행 경로가 눈에 읽힌다.</td><td>두 대륙+내해+남쪽 섬줄기, 길과 다리로 장소를 잇는다. 랜드마크는 목적(탑·신전·폐허)별로 흩어 배치했다.</td><td class="gb">큼. 지도는 예쁘지만 여정 서사(어디서 시작해 무엇을 넘는가)를 돕는 지형 장벽·관문 배치는 설계하지 않았다.</td></tr>
</table>
<p class="sub">결론: 한 화면 구성 요소(지형·경계·성곽·애니)는 FF6·크로노에 꽤 가까워졌지만, 고유 랜드마크의 수와 서사적 구도는 아직 한참 모자란다. 더 좋은 지도를 만들려면 타일이 아니라 <b>장소 목록과 여정 설계</b>가 먼저다.</p>

<h2>8. 7단계 지도 전체 (1배)</h2>
{fig(v7, '7단계 최종: 성곽 도시 3곳, 불규칙 해안선, 3띠 바다, 랜드마크 7종')}

<h2>9. 아직 어색한 곳</h2>
<ul><li>메사(붉은 원뿔 덩이)는 절벽 문법으로 다시 그리지 않았다. 납작한 탁상 모양이 아니라 여전히 뾰족한 산 스프라이트다.</li><li>북서 고원 서쪽의 좁은 벽은 지층이 사다리처럼 보이고, 툰드라 고원 위·오른쪽 가장자리의 풀 테는 원본 절벽보다 부자연스럽다.</li><li>고원 위에 예전 타일 기반 색 덩이(네모난 옅은 영역)가 비쳐 보인다.</li><li>협곡 구덩이는 바닥이 단색에 가깝고 깊이 단서(안쪽 벽 바닥 돌)가 모자란다.</li><li>천공섬은 고정이고 폐허 도시는 「무너졌다」는 인상이 약하다. 랜드마크 사이 길이 없다.</li><li>구름 GIF 조각은 반복 지점에서 튄다(캔버스는 이음매 없음).</li></ul>

<div class="attr">원본 지형·아이콘은 EasyRPG RTP <code>ChipSet/World.png</code> (CC BY 4.0). 5~7단계 경계·도시·해안선·랜드마크·절벽·애니메이션은 그 팔레트와 결로 새로 찍은 도트이다. 크로노 트리거·FF6는 구성 방식을 관찰만 했고 그림·데이터는 쓰지 않았다.
출처 표기: <code>tiledata/atlas-pick/worldmap-easyrpg-plus/ATTRIBUTION-NOTE.md</code>. 스크립트: <code>design-map/city_v7.py</code>, <code>coast_v6.py</code>, <code>cliff_v7.py</code>, <code>landmarks_v7.py</code>, <code>anim_v5.py</code>, <code>make_design_page_v7.py</code>.</div>
</body></html>'''
Path(OUT).parent.mkdir(parents=True, exist_ok=True)
Path(OUT).write_text(PAGE, encoding='utf-8')
print('wrote', OUT, len(PAGE) // 1024, 'KB')
