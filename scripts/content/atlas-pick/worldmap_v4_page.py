#!/usr/bin/env python3
"""월드맵 4판 비교 페이지(~/claude-viz/worldmap-v4-demo.html). worldmap_v4_demo.py --html 이 부른다.

자체완결(data URI). 3판/4판 같은 배치 1배·3배, 아이콘 크기 등급표, 바람들 마을 나란히.
FF6 그림은 넣지 않는다(연구는 구도 규칙만 옮겼다).
"""
import pathlib
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parents[3]
CAND = HERE / 'tiledata/atlas-pick/candidates-worldmap'
VILLAGE = pathlib.Path.home() / '.local/share/oprn/ref-cache/gen-grassland/public/assets/gen-grassland/references/village-center.png'
OUT = pathlib.Path.home() / 'claude-viz/worldmap-v4-demo.html'
T = 16

GRADE = {   # 이름: (등급, 용도, 한눈 판독 근거)
    'hamlet': ('소 1×1', '오두막·촌락', '지붕 빨강/파랑 두 채'),
    'village_2x2': ('소 2×2', '작은 마을', '집 셋 + 나무 + 마당길'),
    'town_3x3': ('중 3×3', '성벽 마을', '성벽 + 가운데 종탑, 지붕 둘'),
    'castle_3x3': ('중 3×3', '성', '모서리 탑 둘 + 본성 + 문'),
    'castle_5x5': ('대 5×5', '대성·왕도', '모서리 탑 · 옆탑 · 중앙 본성 · 문루 · 길꼬리'),
    'cave': ('소 1×1', '동굴', '바위 덩이 + 검은 입구'),
    'tower': ('소 1×2', '탑', '깃발 + 원뿔 지붕'),
}


def crop(img, box, k):
    c = img.crop(box)
    return c.resize((c.width * k, c.height * k), Image.NEAREST)


def build(imgs, b64, ICONS4, ISIZE):
    v = Image.open(VILLAGE).convert('RGB')
    v = v.resize((v.width // 2, v.height // 2), Image.NEAREST)
    s3, s4, t3, t4, t40 = (b64(imgs[k]) for k in ('3', '4', '3t', '4t', '4t0'))
    vv = b64(v)
    rows = ''
    for n, _, _ in ICONS4:
        p = Image.open(CAND / n / 'v4-A.png').convert('RGBA')
        bg = Image.new('RGBA', p.size, (62, 128, 52, 255)); bg.alpha_composite(p)
        k = 3 if p.width <= 48 else 2
        w, h = ISIZE[n]
        g, use, why = GRADE[n]
        rows += (f'<tr><td><img src="{b64(bg.convert("RGB").resize((p.width * k, p.height * k), Image.NEAREST))}" '
                 f'width="{p.width * k}" height="{p.height * k}"></td><td><b>{n}</b></td><td>{g}</td>'
                 f'<td>{w}×{h}칸 = {w * T}×{h * T}px</td><td>{use}</td><td>{why}</td></tr>')
    # 1배 아이콘 열: 3판/4판이 같은 자리 (한눈 판독)
    def zoom(src, box, k, cap):
        c = imgs[src].crop(box)
        return (f'<figure><figcaption>{cap}</figcaption><img src="{b64(c.resize((c.width * k, c.height * k), Image.NEAREST))}" '
                f'width="{c.width * k}" height="{c.height * k}"></figure>')
    glance = (zoom('3', (0, 0, 640, 480), 1, '3판 전체 (1배)') + zoom('4', (0, 0, 640, 480), 1, '4판 전체 (1배)'))
    icons_crop = (zoom('3', (180, 110, 596, 350), 2, '3판 아이콘 (2배)') + zoom('4', (180, 110, 596, 350), 2, '4판 아이콘 (2배)'))
    def z3(src, left, top, cap, w=560, h=420):
        return (f'<figure><figcaption>{cap}</figcaption><div class="z" style="width:{w}px;height:{h}px">'
                f'<img src="{src}" width="1920" height="1440" style="left:{-left}px;top:{-top}px"></div></figure>')
    html = f'''<!doctype html><meta charset="utf-8"><title>월드맵 4판 데모</title>
<style>
body{{background:#1b1b1f;color:#e8e8ee;font:14px/1.5 system-ui,sans-serif;margin:0;padding:20px 28px}}
h1{{font-size:20px;margin:0 0 4px}} h2{{font-size:16px;margin:30px 0 6px;color:#9fd0ff}}
p{{margin:4px 0 10px;color:#b8b8c4;max-width:1100px}} li{{color:#b8b8c4;margin:2px 0}}
.row{{display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start;margin-bottom:14px}}
figure{{margin:0}} figcaption{{margin:0 0 4px;font-weight:600}}
img{{image-rendering:pixelated;display:block;background:#000}}
.z{{overflow:hidden;border:1px solid #444}} .z img{{position:relative}}
table{{border-collapse:collapse}} td,th{{border:1px solid #3a3a44;padding:6px 10px;vertical-align:middle;text-align:left}}
th{{background:#26262e;color:#9fd0ff}} td img{{background:none}}
.bad{{color:#ffb4a0}} .ok{{color:#a8e6a0}}
</style>
<h1>월드맵 4판 데모 — 큰 덩이와 크기 등급</h1>
<p>3판의 색·물빛은 그대로 두고 <b>모양</b>만 고쳤다. 같은 40x30 배치·같은 땅 위에서 (1) 산·숲·해안이 같은 조각 반복으로 보이지 않는가,
(2) 아이콘이 크기 등급별로 한눈에 읽히는가를 본다. 겹판(2×2 산봉우리·수관)은 엔진 quarterTile 제약과 무관한 장식층 조각이다.</p>

<h2>1. 같은 배치, 3판 / 4판 (1배)</h2>
<div class="row">{glance}</div>
<p>4판은 성 둘(3×3·5×5)·마을 셋(3×3 성벽 마을·2×2·1×1)·동굴·탑이 크기 등급으로 갈리고, 산은 봉우리 크기가 다른 능선, 숲은 큰 수관이 섞인 덩이, 해안은 변형 조각으로 깔았다.</p>

<h2>2. 지형만, 반복 검사 (3배, 아이콘 없음)</h2>
<p>왼쪽 3판은 산 한 조각이 격자로 찍혀 <span class="bad">「도장 찍은」 무늬</span>가 난다. 가운데 4판은 겹판 2×2가 두 칸 격자에서 흔들려 놓이고 크기가 셋으로 갈린다. 오른쪽은 겹판을 끈 4판(덩이만)으로, 겹판이 하는 일을 분리해 본다.</p>
<div class="row">
{z3(t3, 60, 60, '3판 산·숲 (3배)', 480, 420)}
{z3(t4, 60, 60, '4판 산·숲 (3배)', 480, 420)}
{z3(t40, 60, 60, '4판 겹판 끔 (덩이만)', 480, 420)}
</div>
<div class="row">
{z3(t3, 1000, 0, '3판 북동 숲·해안 (3배)', 480, 420)}
{z3(t4, 1000, 0, '4판 북동 숲·해안 (3배)', 480, 420)}
{z3(t3, 100, 900, '3판 남서 숲 (3배)', 480, 420)}
{z3(t4, 100, 900, '4판 남서 숲 (3배)', 480, 420)}
</div>

<h2>3. 아이콘 크기 등급표</h2>
<p>모두 한 장 그림이라 칸 경계에서 끊기지 않는다. 건물 밑변은 캔버스 바닥 2줄 위, 그 밑에 옅은 그림자를 깔아 「땅에 선다」. 등급이 오를 때 실루엣 요소가 늘어난다: 지붕 → 성벽 → 모서리 탑 → 옆탑·문루.</p>
<table><tr><th>그림(초록 바탕 위)</th><th>이름</th><th>등급</th><th>크기</th><th>용도</th><th>한눈 판독 요소</th></tr>
{rows}</table>

<h2>4. 아이콘 한눈 판독 (3판 / 4판, 2배)</h2>
<div class="row">{icons_crop}</div>

<h2>5. 한 게임인가: 4판 월드맵 / 바람들 마을 (같은 16px 1배)</h2>
<div class="row">
<figure><figcaption>4판 월드맵 (1배)</figcaption><img src="{s4}" width="640" height="480"></figure>
<figure><figcaption>바람들 마을 (village-center, 1배)</figcaption><img src="{vv}" width="720" height="576"></figure>
</div>

<h2>6. 적대적 자체 검토</h2>
<ul>
<li><b>같은 조각 반복이 눈에 띄는가</b> — 산·숲은 좋아졌다(위 2절). 그러나 <span class="bad">언덕(밝은 초록 덩이)과 사막 모래, 풀 바탕은 아직 3판 조각</span>이라 언덕은 여전히 격자 반복이다.</li>
<li><b>산 덩이 바닥</b> — 갈색 바닥 면이 넓어 봉우리 사이가 평평한 카펫처럼 보이는 곳이 있다. 겹판 봉우리를 더 촘촘히 하거나 바닥 질감을 골짜기 음영으로 바꿔야 한다.</li>
<li><b>침엽수 덩이</b> — 가늘고 긴 띠 모양이라 「숲」보다 「울타리」로 읽힌다. 덩이 모양을 두껍게 잡아야 한다.</li>
<li><b>아이콘 판독</b> — 5×5 성·3×3 성·성벽 마을은 실루엣이 갈려 1배에서 읽힌다. 1×1 촌락과 2×2 마을은 크기가 비슷해 구분이 약하다.</li>
</ul>
'''
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html, encoding='utf-8')
    print('wrote', OUT)
