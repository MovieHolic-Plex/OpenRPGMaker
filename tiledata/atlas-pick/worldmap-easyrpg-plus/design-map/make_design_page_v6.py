#!/usr/bin/env python3
"""월드맵 설계 데모 5단계 비교 페이지(자체완결 HTML, 이미지는 data URI).
  python3 make_design_page_v6.py [출력경로]   기본 ~/claude-viz/worldmap-design.html
먼저 CITY_TAG=v6 로 make_cities_v6.py, make_map_v5.py, anim_v5.py (그리고 make_pairkit_v5.py) 를 돌려 design-1x-v5b.png / pairkit-v5.png / pairmatrix-v5.png / anim-v5/ 를 만든다."""
import base64, io, os, sys
from pathlib import Path
import numpy as np
from PIL import Image
import anim_v5 as A

HERE = Path(__file__).resolve().parent
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/claude-viz/worldmap-design.html')
AN = HERE / 'anim-v6'


def b64(data, mime):
    return f'data:{mime};base64,' + base64.b64encode(data).decode()


def png(im):
    b = io.BytesIO(); im.save(b, 'PNG', optimize=True); return b64(b.getvalue(), 'image/png')


def rgba_clean(path):
    a = np.array(Image.open(path).convert('RGBA')); a[a[..., 3] == 0] = 0
    return Image.fromarray(a)


rgb = lambda p: Image.open(p).convert('RGB')
v4, v5, v5old = rgb(HERE / 'design-1x-v4.png'), rgb(HERE / 'design-1x-v6.png'), rgb(HERE / 'design-1x-v5b.png')
ORIG = rgb(HERE / '../../../../public/assets/easyrpg-chipset-world.png')
kit, mat = rgb(HERE / 'pairkit-v5.png'), rgb(HERE / 'pairmatrix-v5.png')
M, ic, _ = A.load()


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


def effect(title, box, scale, cap, ms=140, clouds=False):
    x0, y0, x1, y1 = box
    frs = []
    for f in range(A.N):
        im = A.composite_clouds(fulls[f], cl, sh, f * 10) if clouds else Image.fromarray(fulls[f])
        frs.append(im.crop(box))
    uri, w, h = sheet_gif(frs, scale, ms)
    return f'<figure class="fx"><img src="{uri}" width="{w}" height="{h}"><figcaption><b>{title}</b> — {cap}</figcaption></figure>'


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


def site2(name, sc=4, pad=2):
    x, y, w, h = ic[name]
    box = ((x - pad) * 16, (y - pad) * 16, (x + w + pad) * 16, (y + h + pad) * 16)
    a, b = v5old.crop(box), v5.crop(box)
    o = Image.new('RGB', (a.width * 2 + 8, a.height), (255, 0, 255)); o.paste(a, (0, 0)); o.paste(b, (a.width + 8, 0))
    o = o.resize((o.width * sc, o.height * sc), Image.NEAREST)
    return fig(o, f'{name}: 실제 지도 위 (4배) — 왼쪽 구 5단계 · 오른쪽 새 6단계')


cities = rows_html + '<h3>실제 지도 위 배치</h3>' + site2('대성') + site2('내해 항구', 4, 3) + site2('사바나 마을', 4, 3)

# 동영상 조각
VOLC, WF = A.VOLC, A.WF
fx = ''.join([
    effect('화산 연기', (VOLC[0] - 50, VOLC[1] - 66, VOLC[0] + 60, VOLC[1] + 14), 4, '분화구에서 뜨거운 연기가 올라가며 재로 식고 흩어진다(6덩이, 12프레임)'),
    effect('바닷가 물결', (700, 600, 800, 680), 5, '얕은 물이 해안선을 따라 밀려와 흰 거품선으로 닿는다(4단계 순환, 잔 반짝임)'),
    effect('폭포', (WF[0] - 40, WF[1] - 30, WF[0] + 40, WF[1] + 50), 5, '절벽 틈에서 떨어지는 물줄기와 물보라'),
    effect('마을 굴뚝 연기', (590, 380, 690, 470), 5, '지붕 굴뚝에서 작은 연기 4덩이가 흔들리며 오른쪽으로 흩어진다'),
    effect('용암 일렁임', (1250, 290, 1400, 370), 4, '용암 줄기의 밝고 어두운 띠가 흐르고 불티가 떠올랐다 진다'),
    effect('독늪 기포', (980, 250, 1100, 330), 5, '독수·늪 칸에서 기포가 올라와 터진다'),
    effect('구름과 구름 그림자', (0, 180, 400, 420), 2, '반투명 구름이 지나가며 그림자를 땅 위에 끌고 간다(진짜 알파 대신 4×4 디더)', clouds=True),
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
  window.__ctl={setSpeed:v=>speed=v,clouds:v=>cloudsOn=v,fx:v=>fxOn=v,pause:v=>{paused=v;}};
  function frame(now){
    if(!paused)pt+=(now-(window.__last||now))*speed;window.__last=now;
    const f=Math.floor(pt/140)%12;
    x.drawImage(base,0,0);
    if(fxOn)x.drawImage(diffs[f],0,0);
    if(cloudsOn){const s=Math.floor(pt*0.012)%W;
      for(const L2 of [sh,cl]){x.drawImage(L2,s,0);x.drawImage(L2,s-W,0);}}
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
});
})();
'''
import json
DATA = json.dumps({'base': base_uri, 'diffs': diff_uris, 'cl': cl_uri, 'sh': sh_uri})

PAGE = f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>월드맵 설계 데모 5단계</title>
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
.attr{{margin-top:34px;padding:10px 14px;border:1px solid #2c333d;border-radius:6px;font-size:12.5px;color:#8b96a5}}
</style></head><body>
<h1>월드맵 설계 데모 5단계 — 자연스러운 경계 · 성곽 도시(원본 문법 재작업) · 움직이는 지도</h1>
<p class="sub">4단계 지적 세 가지를 고쳤다. (1) 지형이 만나는 선이 타일 격자대로 딱딱함 → 경계를 칸 단위가 아닌 <b>픽셀 단위 곡선</b>으로 그리고 윗 지형을 안쪽으로 번지게 했다.
(2) 성 안에 마을과 안쪽 성이 들어가는 큰 성곽 도시. (3) 구름·연기·물결 같은 월드맵 애니메이션. 전부 EasyRPG World 팔레트로 좌표를 적어 찍은 손 도트이고 생성 이미지·트레이싱은 없다.</p>

<h2>1. 움직이는 전체 지도 (1536×1152)</h2>
<p>구름이 천천히 흐르고 화산·굴뚝 연기, 물결, 용암, 기포가 12프레임으로 돈다. 아래 버튼으로 효과를 끌 수 있다.</p>
<div class="ctl"><button onclick="__ctl.clouds(false)">구름 끄기</button><button onclick="__ctl.clouds(true)">구름 켜기</button><button onclick="__ctl.fx(false)">효과 끄기</button><button onclick="__ctl.fx(true)">효과 켜기</button><button onclick="__ctl.setSpeed(.3)">느리게</button><button onclick="__ctl.setSpeed(1)">보통</button></div>
<canvas id="mapcv" width="1536" height="1152" style="margin-top:8px"></canvas>
<script>window.__D={DATA};</script><script>{JS}</script>

<h2>2. 부분 애니메이션 (확대, 반복 재생)</h2>
<p class="sub">각 그림이 한 효과다. 12프레임, 프레임당 약 0.14초. 반투명은 진짜 알파가 아니라 4×4 디더로 그려 도트 그림답게 했다.</p>
<div class="fxs">{fx}</div>

<h2>3. 성곽 도시 (실제 지도 위)</h2>
<p>원본 성 문법으로 다시 만들었다. 원본 성·마을 아이콘의 모듈(굵은 탑, 성벽, 성문, 안쪽 성)을 그대로 재배열하고, 집은 원본 마을 아이콘의 집을 붉은·갈색·슬레이트로 색만 바꿔 빽빽이 앉혔다. 원본에 있는 색만 쓴다. 왼쪽부터 원본 · 구 5단계 · 새 6단계.</p>
<div class="grid3">{cities}</div>

<h2>4. 경계 전후 (10가지, 3배)</h2>
<p>왼쪽은 4단계(칸 경계 그대로), 오른쪽은 5단계. 줄지어 직선이던 자리가 들쭉날쭉한 곡선과 섞임으로 바뀐 것을 보면 된다.</p>
<div class="grid">{pairs_html}</div>

<h2>5. 지형 쌍 경계 키트와 쌍 행렬</h2>
<p>실제 이웃 지형 32쌍 × 6가지 모양 = 조각 192개를 손으로 그린 <b>데모 키트</b>(맵 자체는 쌍마다 픽셀 곡선을 절차적으로 그린다). 아래 행렬은 153쌍이 어떤 모양으로 만나는지 한눈에 보는 표다.</p>
{fig(kit, '쌍 키트 (1160×1824)')}
{fig(mat, '쌍 행렬 (153쌍, 1502×1502)')}

<h2>6. 5단계 지도 전체 (1배)</h2>
{fig(v5, '5단계 최종: 경계 픽셀 곡선, 3단 수심, 성곽 도시 3곳')}

<h2>7. 아직 어색한 곳</h2>
<ul><li>숲 같은 물체 타일이 풀밭과 만나는 가장자리는 아직 칸 직선이다.</li><li>해안선 윤곽 자체는 부드럽게 다듬지 않았다.</li><li>수심 얼룩이 약간 불규칙하다.</li><li>대성 왼쪽 아래에 4단계 고원 경로의 각진 돌 조각이 남아 있다.</li><li>항구 부두는 바다에 닿게 고쳤지만 오른쪽 끝은 해안선이 들쭉날쭉해 풀밭에 걸친다.</li><li>요새 읍(사바나 마을) 둘레에 희미한 직사각형 명암 자국이 있다.</li><li>성곽 도시의 굴뚝 연기는 눈에 거슬려 뺐다(대성 제외, 마을·요새 읍만).</li></ul>

<div class="attr">원본 지형·아이콘은 EasyRPG RTP <code>ChipSet/World.png</code> (CC BY 4.0). 5단계 경계·도시·애니메이션은 그 팔레트와 결로 새로 찍은 도트이다. 크로노 트리거·FF6는 구성 방식을 관찰만 했고 그림·데이터는 쓰지 않았다.
출처 표기: <code>tiledata/atlas-pick/worldmap-easyrpg-plus/ATTRIBUTION-NOTE.md</code>. 스크립트: <code>design-map/boundary_v5.py</code>, <code>city_v5.py</code>, <code>make_pairkit_v5.py</code>, <code>anim_v5.py</code>, <code>make_design_page_v6.py</code>.</div>
</body></html>'''
Path(OUT).parent.mkdir(parents=True, exist_ok=True)
Path(OUT).write_text(PAGE, encoding='utf-8')
print('wrote', OUT, len(PAGE) // 1024, 'KB')
