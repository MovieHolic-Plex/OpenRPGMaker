#!/usr/bin/env python3
"""~/claude-viz/jp-style-demo.html 재생성: 강남 결 / 1차 / 2차 비교 + 공간감 확대 잘라 보기. 그림은 data URI 로 넣는다(자체완결).
  python3 scripts/content/atlas-pick/jp_style_demo_page.py
입력: style-demo-jp2/street/{dm1-gangnam,dm2-D,dm3-D}.png (참고 상용 스크린샷은 넣지 않는다)."""
import base64, io, os
from PIL import Image
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'tiledata', 'atlas-pick', 'style-demo-jp2', 'street')
OUT = os.path.expanduser('~/claude-viz/jp-style-demo.html')
def load(n): return Image.open(os.path.join(D, n)).convert('RGBA')
def uri(im, k=1, box=None):
    if box: im = im.crop(box)
    if k != 1: im = im.resize((im.width * k, im.height * k), Image.NEAREST)
    b = io.BytesIO(); im.save(b, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
def img(im, k=1, box=None): return f'<img src="{uri(im, k, box)}">'
G, A, B = load('dm1-gangnam.png'), load('dm2-D.png'), load('dm3-D.png')
CROPS = [
 ('벽: 층 슬래브 · 그림자 · 들어간 창 · 실외기 · 배관', (0, 0, 128, 64), 4, '1차는 한 색 채움 + 창 격자. 2차는 층마다 슬래브(윗면 밝게)와 그 밑 그림자, 창틀 그늘·문턱, 벽 옆 배관과 실외기.'),
 ('벽: 발코니 · 벽돌 · 튀어나온 모서리', (256, 0, 384, 64), 4, '발코니 슬래브 윗면·난간 살 그림자·안쪽 어두운 방. 오른쪽 끝은 앞으로 나온 모서리(밝은 앞면 + 어두운 옆면)가 옆 건물에 그림자를 드린다.'),
 ('건물 앞뒤 + 1층 가게 + 큰 가로수', (96, 36, 224, 130), 4, '슬래브가 가게 윗부분에 그림자를 내리고 입구는 안으로 들어가 있다. 가로수는 32x48 수관, 가는 줄기, 보도에 그림자.'),
 ('옥상: 난간 두께 · 물탱크 · 실외기 · 계단실', (0, 208, 176, 292), 3, '1차는 판때기 위에 소품. 2차는 뒷난간 안쪽 벽면, 바닥에 떨어지는 난간 그림자, 원통 명암 물탱크, 모든 기물이 오른쪽 아래로 그림자.'),
 ('옥상: 기와 지붕 · 태양광 · 다락창', (360, 216, 512, 296), 3, '용마루 윗면/앞면, 기왓줄, 처마 끝 두께, 다락창의 작은 지붕·옆면, 패널 두께와 그림자.'),
]
h = ['''<!doctype html><html lang="ko"><meta charset="utf-8"><title>일본 세트 새 결 데모 (2차)</title>
<style>
body{background:#1b1826;color:#e6e2f0;font:14px/1.6 system-ui,sans-serif;margin:0;padding:20px 28px;max-width:1600px}
h1{font-size:20px;margin:0 0 4px} h2{font-size:15px;margin:26px 0 6px;color:#c8c0e0}
.s{color:#9c94b4} img{image-rendering:pixelated;display:block;border:1px solid #4c4560}
.row{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start} .b{margin-bottom:10px} .b small{display:block;color:#9c94b4;margin-bottom:3px}
ol{padding-left:20px} li{margin:3px 0} .tag{display:inline-block;padding:1px 8px;border-radius:9px;font-size:12px;margin-right:6px}
.o{background:#4c4560} .n{background:#8a3a4a} .n2{background:#3a6a5a}
</style>
<h1>일본 세트 「새 결」 — 같은 거리 세 가지: 강남 결 / 1차 / 2차(공간감)</h1>
<div class="s">512x384px (32x24칸, 16px 칸). 2차는 벽의 층띠·그림자·창 깊이, 옥상 난간 두께와 기물 그림자, 큰 가로수를 고친 것. 판정 포인트: 벽이 아직 평평해 보이는지, 옥상 기물이 바닥에 서 있는지.</div>
<h2>원본 크기 (왼쪽부터 강남 결 / 1차 / 2차)</h2><div class="row">''']
for tag, cls, im in (('강남 결', 'o', G), ('1차', 'n', A), ('2차', 'n2', B)):
    h.append(f'<div class="b"><small><span class="tag {cls}">{tag}</span></small>{img(im)}</div>')
h.append('</div><h2>3배 — 1차</h2>' + img(A, 3) + '<h2>3배 — 2차</h2>' + img(B, 3))
h.append('<h2>확대 비교 (왼쪽 1차 / 오른쪽 2차, 같은 영역)</h2>')
for title, box, k, note in CROPS:
    h.append(f'<div class="b"><small><b>{title}</b> — {note}</small><div class="row">{img(A, k, box)}{img(B, k, box)}</div></div>')
h.append('''<h2>공간감 규칙 요약</h2><ol>
<li>벽은 층마다 슬래브를 낀다: 윗면 밝게 - 앞면 - 아래 모서리 어둡게, 그 밑 3줄은 슬래브가 드리운 그림자. 창 사이에는 튀어나온 기둥.</li>
<li>창은 들어가 있다: 창틀 그늘(위 2줄·왼 1줄), 문턱 윗면, 문턱 밑 그림자, 안쪽 어두운 물건. 발코니·실외기·배관도 옆면과 벽 그림자를 가진다.</li>
<li>건물은 앞뒤가 있다: 튀어나온 모서리(앞면+옆면)와 옆 건물 벽에 떨어지는 그림자, 가게 입구는 안으로 들어가고 차양 밑은 어둡다.</li>
<li>옥상은 난간에 두께가 있고(뒷난간 안쪽 벽면 · 좌우 윗면), 그 안쪽 바닥에 난간 그림자, 모든 기물은 오른쪽 아래로 길게 그림자를 드리운다.</li>
<li>빛은 항상 왼쪽 위: 윗면·왼쪽 면 밝게, 오른쪽·아래 어둡게, 그림자는 오른쪽 아래. 그림자는 반투명이 아니라 같은 램프의 어두운 단으로 굽는다.</li>
</ol>
<div class="s">한계: 2차도 손으로 배치한 한 장이고 킷 부품 시트로는 아직 변환하지 않았다(데모는 한 층 16px, 킷은 한 층 32px). 그림자는 이미 그린 픽셀의 단을 내리는 방식(sh)이라 부품 경계를 넘는 그림자는 부품화 때 다시 짜야 한다. 강남 결은 같은 구도의 근사 조립이다.</div>
</html>''')
open(OUT, 'w', encoding='utf-8').write('\n'.join(h)); print(OUT, os.path.getsize(OUT))
