#!/usr/bin/env python3
"""월드맵 6판 비교 페이지 -> ~/claude-viz/worldmap-v6-demo.html (자체완결 data URI).

5판 장면 vs 6판 장면(1배·2배), 6판 조각 도감, 라운드별 작은 그림, 출처 표.
목표 그림은 싣지 않는다(잰 숫자만 tiledata/atlas-pick/worldmap-v6-target.md).
  python3 scripts/content/atlas-pick/worldmap_v6_page.py
"""
import base64, io, pathlib, sys
from PIL import Image, ImageDraw
HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from worldmap_v3_gen import ROOT, CAND
import worldmap_v6_demo as D

OUT = pathlib.Path.home() / 'claude-viz/worldmap-v6-demo.html'
S5 = ROOT / 'tiledata/atlas-pick/style-demo-worldmap5/scene-5.png'
S6 = ROOT / 'tiledata/atlas-pick/style-demo-worldmap6'


def b64(im):
    buf = io.BytesIO(); im.convert('RGB').save(buf, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()


def fig(im, cap, k=1):
    im = im.convert('RGB')
    if k != 1: im = im.resize((im.width * k, im.height * k), Image.NEAREST)
    return f'<figure><figcaption>{cap}</figcaption><img src="{b64(im)}" width="{im.width}" height="{im.height}"></figure>'


def sheet():
    slugs = [s for s in D.SLUGS]
    tiles = []
    for s in slugs:
        p = Image.open(CAND / s / 'v6-A.png').convert('RGBA')
        k = 2 if p.width <= 64 else 1
        p = p.resize((p.width * k, p.height * k), Image.NEAREST)
        bg = Image.new('RGBA', (max(p.width, 90) + 8, p.height + 22), (46, 70, 24, 255))
        bg.alpha_composite(p, (4, 4))
        ImageDraw.Draw(bg).text((4, p.height + 8), s, fill=(230, 230, 200, 255))
        tiles.append(bg)
    W = 1240; x = y = rowh = 0; pos = []
    for t in tiles:
        if x + t.width > W: x = 0; y += rowh + 6; rowh = 0
        pos.append((x, y)); x += t.width + 6; rowh = max(rowh, t.height)
    im = Image.new('RGB', (W, y + rowh), (24, 24, 28))
    for t, p in zip(tiles, pos): im.paste(t.convert('RGB'), p)
    return im


def main():
    s5 = Image.open(S5).convert('RGB'); s6 = Image.open(S6 / 'scene-6.png').convert('RGB')
    rounds = ''.join(fig(Image.open(S6 / f'scene-6-r{i}.png'), f'라운드 {i}', 1) for i in range(0, 5))
    zoom = (lambda im, box, cap: fig(im.crop(box), cap, 3))
    rows = [
        ('mountain_cliff', '남·동쪽 세로 절벽 전 칸(산 덩이의 약 17%가 어두운 벽)', '라운드 1'),
        ('field_wheat / field_crop', '세로 줄무늬 6톤 + 어두운 테, 둥근 육각 배치', '라운드 1'),
        ('road', '올리브 검정 테두리 2~3px 구불길', '라운드 1'),
        ('house_blue_a/b · hall_blue · tower_blue · gate_tower · city_district · castle_keep', '파란 지붕 + #242018 윤곽, 성·도시 덩어리', '라운드 0~2'),
        ('timber_a / timber_b', '황토 벽 + 목재 골조 + 붉은 갈색 지붕 2층 집', '라운드 0'),
        ('wall_h / wall_v / wall_tower', '3px 얇은 벽 + 네모 탑 (모서리 계단 배치)', '라운드 0·4'),
        ('shore_rocks', '기슭 둥근 자갈, 거품 없음', '라운드 0'),
        ('ground_mottle / mountain_strata / cast_shadows', '절차(좌표 결정적 값 잡음): 풀 얼룩, 산 사선 결, 절벽 그림자', '라운드 3'),
    ]
    tbl = ''.join(f'<tr><td><b>{a}</b></td><td>{b}</td><td>{c}</td><td>손으로 좌표 찍음 / 절차, 생성 밑그림 없음</td></tr>' for a, b, c in rows)
    html = f'''<!doctype html><meta charset="utf-8"><title>월드맵 6판 데모</title>
<style>
body{{background:#1b1b1f;color:#e8e8ee;font:14px/1.5 system-ui,sans-serif;margin:0;padding:20px 28px}}
h1{{font-size:20px;margin:0 0 4px}} h2{{font-size:16px;margin:30px 0 6px;color:#9fd0ff}}
p,li{{color:#b8b8c4;max-width:1100px}} .row{{display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start;margin-bottom:14px}}
figure{{margin:0}} figcaption{{margin:0 0 4px;font-weight:600}} img{{image-rendering:pixelated;display:block;background:#000}}
table{{border-collapse:collapse}} td,th{{border:1px solid #3a3a44;padding:6px 10px;text-align:left;vertical-align:top}} th{{background:#26262e;color:#9fd0ff}}
.bad{{color:#ffb4a0}}
</style>
<h1>월드맵 6판 데모 — 그린 형태(절벽·결·파란 지붕)로</h1>
<p>5판은 어두운 잡음 질감이었고, 6판은 사용자가 준 월드맵 수준을 목표로 <b>형태</b>(산 절벽·사선 결, 밭 육각, 얇은 성벽, 파란 지붕 마을)를 그렸다.
위 5판·아래 6판을 먼저 1배로 보고 「월드맵으로 읽히는가」, 다음 2배로 산·성·해안을 본다. 5판은 40x30, 6판은 37x43칸이라 배치는 다르다.</p>
<h2>1. 5판 / 6판 (1배)</h2>
<div class="row">{fig(s5, '5판 (1배)')}{fig(s6, '6판 (1배)')}</div>
<h2>2. 2배</h2>
<div class="row">{fig(s5.crop((0, 0, 320, 300)), '5판 북서 (2배)', 2)}{fig(s6.crop((0, 0, 320, 300)), '6판 북서 마을 (2배)', 2)}</div>
<div class="row">{fig(s6.crop((400, 130, 592, 520)), '6판 동쪽 산 (2배)', 2)}{fig(s6.crop((0, 420, 320, 688)), '6판 남서 도시·해안 (2배)', 2)}</div>
<h2>3. 라운드별 변화 (작게, 1배)</h2>
<div class="row">{rounds}</div>
<ul><li>0: 첫 조립 · 1: 산 절벽·밭·길 · 2: 기슭 턱·건물 · 3: 풀 얼룩·산 결·그림자 · 4: 성벽 다각·해안 만</li></ul>
<h2>4. 6판 조각 도감 (34종, 풀 바탕 위)</h2>
{fig(sheet(), '전 조각 v6-A.pxg — 모두 worldmap_check 합격')}
<h2>5. 출처 표</h2>
<table><tr><th>조각</th><th>내용</th><th>라운드</th><th>출처</th></tr>{tbl}</table>
<p>목표 그림은 보고 잰 숫자만 썼다(화소 복사·축소 이식·생성 모델 입력 없음). 자세한 기록: tiledata/atlas-pick/worldmap-v6/NOTES.md.</p>
<h2>6. 적대적 자체 검토 — 아직 못 미치는 점</h2>
<ul>
<li class="bad">산이 반복 칸이다: 목표는 하나하나 그린 큰 능선·밝은 면, 내 산은 결과 절벽 칸의 16px 주기가 보이고 봉우리는 작은 원뿔.</li>
<li class="bad">성·도시가 아이콘을 늘어놓은 모양이다: 목표는 파란 지붕이 붙은 한 덩어리와 안뜰.</li>
<li class="bad">숲이 타일 반복: 목표는 큰 침엽수(8x14px) 열.</li>
<li class="bad">성벽이 직선: 목표는 지형을 따라 굽는다. 기슭 턱은 균일한 갈색 띠.</li>
</ul>
'''
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html, encoding='utf-8'); print('wrote', OUT, len(html) // 1024, 'KB')


if __name__ == '__main__':
    main()
