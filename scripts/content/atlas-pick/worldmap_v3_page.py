#!/usr/bin/env python3
"""월드맵 3판 비교 페이지(~/claude-viz/worldmap-v3-demo.html). worldmap_v3_demo.py --html 이 부른다.

자체완결(data URI). 2판 / 3판 같은 배치 + 바람들 마을 그림을 나란히 둬 「한 게임인가」를 본다.
EasyRPG 원본은 넣지 않는다(구도만 참고했고 그림은 쓰지 않았다).
"""
import os, pathlib
from PIL import Image

VILLAGE = pathlib.Path.home() / '.local/share/oprn/ref-cache/gen-grassland/public/assets/gen-grassland/references/village-center.png'
OUT = pathlib.Path.home() / 'claude-viz/worldmap-v3-demo.html'

# 같은 램프의 2판 → 3판 대표색(swatch)
SWATCH = [
    ('풀', ['163a1e', '225428', '367834', '549c46', '82be64', 'c4e4a0'], ['1d3b24', '2b5a2d', '3d7a34', '57983f', '77b14c', 'a2cb62']),
    ('바다', ['0e3a5a', '14567a', '1e7494', '2c96b0', '5ec0cc', 'a0e4e0'], ['1b3159', '254a86', '335eae', '4a80cc', '78a9e0', 'c6e1f5']),
    ('흙길', ['3e2814', '5e3e24', '845c38', 'a87e52', 'cca676'], ['44301f', '664a2d', '8a693f', 'b08d55', 'd8b982']),
]


def sw(cols):
    return ''.join(f'<i style="background:#{c}" title="#{c}"></i>' for c in cols)


def build(imgs, b64):
    v = Image.open(VILLAGE).convert('RGB')
    v = v.resize((v.width // 2, v.height // 2), Image.NEAREST)   # 16px 기준 1배(720x576)
    s2, s3 = b64(imgs[2]), b64(imgs[3]); vv = b64(v)
    rows = ''.join(f'<div class="sw"><b>{n}</b><span>2판</span>{sw(a)}<span>3판</span>{sw(c)}</div>' for n, a, c in SWATCH)
    html = f'''<!doctype html><meta charset="utf-8"><title>월드맵 3판 결 데모</title>
<style>
body{{background:#1b1b1f;color:#e8e8ee;font:14px/1.5 system-ui,sans-serif;margin:0;padding:20px 28px}}
h1{{font-size:20px;margin:0 0 4px}} h2{{font-size:16px;margin:28px 0 6px;color:#9fd0ff}}
p{{margin:4px 0 10px;color:#b8b8c4;max-width:1100px}}
.row{{display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start}}
figure{{margin:0}} figcaption{{margin:0 0 4px;font-weight:600}}
img{{image-rendering:pixelated;display:block;background:#000}}
.z{{overflow:hidden;border:1px solid #444}} .z img{{position:relative}}
.sw{{display:flex;align-items:center;gap:6px;margin:3px 0}} .sw b{{width:42px}} .sw span{{color:#9a9aa8;font-size:12px;width:26px}}
.sw i{{width:26px;height:18px;display:inline-block}}
</style>
<h1>월드맵 3판 「바람들 결」 데모</h1>
<p>같은 40x30칸 배치를 2판과 3판으로 깐 것. 3판은 EasyRPG 구도(큰 덩이 대륙·산맥·숲 덩이·아이콘)에 바람들 v3(마을 그림)의 색·질감·물빛을 입혔다.
보고 판단할 것: 월드맵에서 마을 맵으로 들어갈 때 <b>한 게임</b>처럼 보이는가.</p>

<h2>1. 같은 배치, 2판 / 3판 (1배)</h2>
<div class="row">
<figure><figcaption>2판 (연한 체커 풀·옅은 청록 물결·가는 윤곽)</figcaption><img src="{s2}" width="640" height="480"></figure>
<figure><figcaption>3판 (바람들 결: 진한 풀+짙은 뭉치·로열블루 물+흰 물결·갈색 둑)</figcaption><img src="{s3}" width="640" height="480"></figure>
</div>

<h2>2. 한 게임인가: 3판 월드맵 / 바람들 마을 (같은 16px 1배)</h2>
<p>오른쪽이 바람들 v3로 만든 마을 그림(village-center). 풀 초록·흙길 갈색·강 파랑·잉크 윤곽이 같은 계열이면 통과.</p>
<div class="row">
<figure><figcaption>3판 월드맵 전체 (1배)</figcaption><img src="{s3}" width="640" height="480"></figure>
<figure><figcaption>바람들 마을 (village-center, 1배)</figcaption><img src="{vv}" width="720" height="576"></figure>
</div>

<h2>3. 확대 비교 (3배, 같은 자리: 강·다리·풀)</h2>
<div class="row">
<figure><figcaption>2판</figcaption><div class="z" style="width:560px;height:420px"><img src="{s2}" width="1920" height="1440" style="left:-760px;top:-660px"></div></figure>
<figure><figcaption>3판</figcaption><div class="z" style="width:560px;height:420px"><img src="{s3}" width="1920" height="1440" style="left:-760px;top:-660px"></div></figure>
</div>
<div class="row" style="margin-top:14px">
<figure><figcaption>2판 산·숲·언덕 (3배)</figcaption><div class="z" style="width:560px;height:420px"><img src="{s2}" width="1920" height="1440" style="left:-330px;top:-130px"></div></figure>
<figure><figcaption>3판 산·숲·언덕 (3배)</figcaption><div class="z" style="width:560px;height:420px"><img src="{s3}" width="1920" height="1440" style="left:-330px;top:-130px"></div></figure>
</div>

<h2>4. 색 램프 (2판 → 3판)</h2>
{rows}
'''
    OUT.write_text(html, encoding='utf-8')
    print('wrote', OUT)
