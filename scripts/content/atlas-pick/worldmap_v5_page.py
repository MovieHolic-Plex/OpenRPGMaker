#!/usr/bin/env python3
"""월드맵 5판 비교 페이지(~/claude-viz/worldmap-v5-demo.html). worldmap_v5_demo.py --html 이 부른다.

자체완결(data URI). 4판/5판 같은 배치 1배·3배, 「FF6 실측 vs 5판」 수치표.
FF6 그림은 넣지 않는다 — 표의 FF6 열은 내가 잰 숫자뿐이다(tiledata/atlas-pick/worldmap-ff6-study.md 「실측」).
"""
import pathlib
import numpy as np
from PIL import Image
from scipy import ndimage as nd

OUT = pathlib.Path.home() / 'claude-viz/worldmap-v5-demo.html'
T = 16
GRADE = {
    'hamlet': '소 1×1', 'village_2x2': '소 2×2', 'town_3x3': '중 3×3', 'castle_3x3': '중 3×3',
    'castle_5x5': '대 5×5', 'cave': '소 1×1', 'tower': '소 1×2',
}


def lum(a):
    return 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]


def ncolors(px, share=0.01):
    """전체의 share 이상을 차지하는 색 수(가끔 찍힌 반짝임은 세지 않는다)."""
    if not len(px): return 0
    _, c = np.unique(px.reshape(-1, 3), axis=0, return_counts=True)
    return int((c / c.sum() >= share).sum())


def measure(img):
    """장면 PNG 한 장에서 FF6 실측 표와 같은 항목을 잰다."""
    a = np.array(img.convert('RGB')).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    L = lum(a)
    sea = (b > r + 25) & (b > g)
    sea = nd.binary_opening(sea, iterations=1)
    deep = nd.binary_erosion(sea, iterations=8)
    grass = (g > r + 14) & (g > b + 8) & ~sea
    grass = nd.binary_erosion(grass, iterations=2)
    out = {}
    out['sea_colors'] = ncolors(a[deep])
    out['sea_lum'] = float(L[deep].mean())
    out['sea_sparkle'] = float((L[deep] >= 80).mean() * 100)
    out['grass_colors'] = ncolors(a[grass])
    out['grass_lum'] = float(L[grass].mean())
    # 노이즈 %: 풀 안에서 오른쪽 이웃과 색이 다른 픽셀 비율
    same = (a[:, :-1] != a[:, 1:]).any(-1) & grass[:, :-1] & grass[:, 1:]
    out['grass_noise'] = float(same.sum() / max(1, (grass[:, :-1] & grass[:, 1:]).sum()) * 100)
    sdeep = deep
    same = (a[:, :-1] != a[:, 1:]).any(-1) & sdeep[:, :-1] & sdeep[:, 1:]
    out['sea_noise'] = float(same.sum() / max(1, (sdeep[:, :-1] & sdeep[:, 1:]).sum()) * 100)
    # 해안: 물쪽 거리별 밝기, 땅쪽 거리별 밝기
    dw = nd.distance_transform_cdt(sea, metric='chessboard')          # 바다 픽셀에서 가장 가까운 땅까지
    dl = nd.distance_transform_cdt(~sea, metric='chessboard')         # 땅 픽셀에서 가장 가까운 바다까지
    out['water'] = [float(L[sea & (dw == d)].mean()) for d in range(1, 9)]
    out['land'] = [float(L[~sea & (dl == d)].mean()) for d in range(1, 7)]
    base = out['sea_lum']
    out['foam_w'] = next((d for d in range(1, 9) if out['water'][d - 1] < base + 8), 9) - 1   # 바다 밝기+8 안으로 들어오는 폭
    return out


def build(imgs, b64, ICONS4, ISIZE):
    m4, m5 = measure(imgs['4']), measure(imgs['5'])
    print('measure 4', m4); print('measure 5', m5)

    def zoom(src, box, k, cap):
        c = imgs[src].crop(box)
        return (f'<figure><figcaption>{cap}</figcaption><img src="{b64(c.resize((c.width * k, c.height * k), Image.NEAREST))}" '
                f'width="{c.width * k}" height="{c.height * k}"></figure>')

    def z3(src, left, top, cap, w=480, h=360):
        c = imgs[src].crop((left, top, left + w // 3, top + h // 3))
        return (f'<figure><figcaption>{cap}</figcaption><img src="{b64(c.resize((c.width * 3, c.height * 3), Image.NEAREST))}" '
                f'width="{c.width * 3}" height="{c.height * 3}"></figure>')

    glance = zoom('4', (0, 0, 640, 480), 1, '4판 (1배)') + zoom('5', (0, 0, 640, 480), 1, '5판 (1배)')
    icons = zoom('4', (180, 110, 596, 350), 2, '4판 아이콘 (2배)') + zoom('5', (180, 110, 596, 350), 2, '5판 아이콘 (2배)')
    rows = ''
    from worldmap_v5_demo import CAND
    for n, _, _ in ICONS4:
        p = Image.open(CAND / n / 'v5-A.png').convert('RGBA')
        bg = Image.new('RGBA', p.size, (40, 88, 40, 255)); bg.alpha_composite(p)
        k = 3 if p.width <= 48 else 2
        w, h = ISIZE[n]
        rows += (f'<tr><td><img src="{b64(bg.convert("RGB").resize((p.width * k, p.height * k), Image.NEAREST))}" '
                 f'width="{p.width * k}" height="{p.height * k}"></td><td><b>{n}</b></td><td>{GRADE[n]}</td>'
                 f'<td>{w}×{h}칸 = {w * T}×{h * T}px</td></tr>')

    def wl(v): return ' · '.join(f'{x:.0f}' for x in v)
    ff_water = [83, 70, 59, 57, 50, 45, 43, 43]
    tbl = f'''<table><tr><th>항목</th><th>FF6 실측(네이티브)</th><th>4판</th><th>5판</th></tr>
<tr><td>깊은 바다 색 수(1% 이상)</td><td>4 (반짝임 합 4%)</td><td>{m4['sea_colors']}</td><td>{m5['sea_colors']}</td></tr>
<tr><td>깊은 바다 평균 밝기</td><td>38</td><td>{m4['sea_lum']:.0f}</td><td>{m5['sea_lum']:.0f}</td></tr>
<tr><td>바다 밝은 점(밝기 80 이상) %</td><td>약 5</td><td>{m4['sea_sparkle']:.1f}</td><td>{m5['sea_sparkle']:.1f}</td></tr>
<tr><td>바다 인접 픽셀 색변화 %</td><td>(측정 안 함)</td><td>{m4['sea_noise']:.0f}</td><td>{m5['sea_noise']:.0f}</td></tr>
<tr><td>풀 색 수(1% 이상)</td><td>3</td><td>{m4['grass_colors']}</td><td>{m5['grass_colors']}</td></tr>
<tr><td>풀 평균 밝기</td><td>61~80</td><td>{m4['grass_lum']:.0f}</td><td>{m5['grass_lum']:.0f}</td></tr>
<tr><td>풀 인접 픽셀 색변화 %</td><td>(측정 안 함)</td><td>{m4['grass_noise']:.0f}</td><td>{m5['grass_noise']:.0f}</td></tr>
<tr><td>해안 물쪽 밝기 (1~8px)</td><td>{wl(ff_water)}</td><td>{wl(m4['water'])}</td><td>{wl(m5['water'])}</td></tr>
<tr><td>해안 물쪽 거품 폭(px)</td><td>약 2 (깊은 색까지 6~7)</td><td>{m4['foam_w']}</td><td>{m5['foam_w']}</td></tr>
<tr><td>해안 땅쪽 밝기 (1~6px)</td><td>1px 58 · 3px 86 · 풀 안 약 71 (1~2px 어두운 테, 3~5px 모래띠)</td><td>{wl(m4['land'])}</td><td>{wl(m5['land'])}</td></tr>
</table>'''
    html = f'''<!doctype html><meta charset="utf-8"><title>월드맵 5판 데모</title>
<style>
body{{background:#1b1b1f;color:#e8e8ee;font:14px/1.5 system-ui,sans-serif;margin:0;padding:20px 28px}}
h1{{font-size:20px;margin:0 0 4px}} h2{{font-size:16px;margin:30px 0 6px;color:#9fd0ff}}
p{{margin:4px 0 10px;color:#b8b8c4;max-width:1100px}} li{{color:#b8b8c4;margin:2px 0}}
.row{{display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start;margin-bottom:14px}}
figure{{margin:0}} figcaption{{margin:0 0 4px;font-weight:600}}
img{{image-rendering:pixelated;display:block;background:#000}}
table{{border-collapse:collapse}} td,th{{border:1px solid #3a3a44;padding:6px 10px;vertical-align:middle;text-align:left}}
th{{background:#26262e;color:#9fd0ff}} td img{{background:none}}
.bad{{color:#ffb4a0}}
</style>
<h1>월드맵 5판 데모 — 어둡고 눌린 톤, 재질은 질감으로</h1>
<p>4판의 큰 덩이·아이콘 크기 등급은 그대로 두고, <b>색과 윤곽</b>만 FF6 월드맵을 잰 값(어두운 남색 바다·올리브 풀·굵은 윤곽 없음)으로 바꿨다.
같은 40x30 배치라 왼쪽(4판)과 오른쪽(5판)을 같은 자리에서 비교한다. 먼저 1배로 「월드맵으로 읽히는가」, 다음 3배로 질감을 본다.</p>

<h2>1. 같은 배치, 4판 / 5판 (1배)</h2>
<div class="row">{glance}</div>

<h2>2. 3배 확대</h2>
<div class="row">
{z3('4', 0, 0, '4판 북서 (3배)')}
{z3('5', 0, 0, '5판 북서 (3배)')}
{z3('4', 300, 180, '4판 남동 (3배)')}
{z3('5', 300, 180, '5판 남동 (3배)')}
</div>

<h2>3. 지형만 (아이콘 없음, 3배)</h2>
<div class="row">
{z3('5t', 60, 60, '5판 산·숲 (3배)')}
{z3('5t', 340, 20, '5판 북동 숲·해안 (3배)')}
</div>

<h2>4. 아이콘 (2배)</h2>
<div class="row">{icons}</div>
<table><tr><th>그림(풀 바탕 위)</th><th>이름</th><th>등급</th><th>크기</th></tr>{rows}</table>

<h2>5. FF6 실측 vs 5판 (숫자만)</h2>
<p>FF6 열은 내가 네이티브 크기로 잰 값이다(그림은 싣지 않는다). 4·5판 열은 위 장면 PNG 에서 같은 방식으로 다시 쟀다.</p>
{tbl}

<h2>6. 적대적 자체 검토</h2>
<ul>
<li><span class="bad">산은 어두운 한 덩이라 16px 반복이 보인다</span>: FF6 는 능선 하이라이트가 더 촘촘하다.</li>
<li><span class="bad">언덕은 4판 윤곽(둥근 물결)이 남아</span> 밝은 조개무늬로 읽힌다.</li>
<li><span class="bad">성 아이콘이 밝은 회색</span>이라 지형보다 튄다. FF6 는 성도 지형 톤에 가라앉는다.</li>
<li>바다 반짝임은 무작위지만 눈으로는 성긴 격자로 보인다.</li>
</ul>
'''
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html, encoding='utf-8')
    print('wrote', OUT)
