# 버들항 v6 page: per user verdict (1..8) a v5 | v6 crop at 3x, the whole city at half size, the castle district large,
# the animated windmill / bridge / harbour, the 16-quadrant adversarial QA table (v5 -> v6) from qa-v6.json.
# Inputs: /tmp/j8city6/{city5,city6}.png + g5_*.gif (city6.py, _gif6.py), scripts/content/lib/city_v6/qa-v6.json.
# Output: ~/claude-viz/city-beodeul-v6.html (v5 page untouched).   python3 cpage_v6.py
import io, base64, json, html as H, os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); T = '/tmp/j8city6'
v5 = Image.open(f'{T}/city5.png').convert('RGB'); v6 = Image.open(f'{T}/city6.png').convert('RGB')
qa = json.load(open(f'{HERE}/qa-v6.json'))

def u(im, S=1):
    if S != 1: im = im.resize((int(im.width * S), int(im.height * S)), Image.NEAREST if S >= 1 else Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'PNG', optimize=True); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
def gif(name): return '<img src="data:image/gif;base64,' + base64.b64encode(open(f'{T}/{name}.gif', 'rb').read()).decode() + '">'
def pair(box, S=3):
    return (f'<div class=row><div><div class=lab>v5</div><img src="{u(v5.crop(box), S)}"></div>'
            f'<div><div class="lab ok">v6</div><img src="{u(v6.crop(box), S)}"></div></div>')

VERDICTS = [
    ('1. 풍차 — 스케일', '집 두 채 크기의 작은 풍차 둘 → 몸통 4칸 × 7칸 탑풍차 하나. 날개 폭 약 7칸, 8장면 회전은 이음매 없이 그대로. 문 앞까지 길이 이어진다.',
     (0, 520, 220, 780), 'g5_mills'),
    ('2. 포룸 — 시야각·지붕', '민가 우진각 지붕을 얹은 신전·주랑 → 칩셋 집과 같은 정면·위 시점으로 다시 그림: 기단 계단 + 기둥 넷 + 셀라 벽 + 칩셋식 박공, 주랑은 지붕 윗면을 짧게 줄인 열주, 남서쪽에 아치 문.',
     (860, 520, 1220, 800), 'g5_forum'),
    ('3. 왕성 — 진짜 성', '마을 분홍 벽돌 → 밝은 큰 마름돌(줄눈·돌마다 음영), 총안 성벽길, 원뿔 슬레이트 지붕 원탑 여럿, 가파른 슬레이트 본궁 + 아치 창 줄, 쇠창살 성문루와 걸개·방패, 본궁 큰 계단, 석상 진입로. 걸어 다니는 조각 키트(정답 배열은 메타데이터).',
     (0, 0, 560, 400), 'g5_castle'),
    ('4. 귀족 저택 — 한 재료', '분홍 벽돌 몸통 + 흰 고전 현관 → 회벽 + 테라코타 기와로 통일(벽·지붕·문기둥·담).',
     (560, 20, 880, 380), 'g5_estate'),
    ('5. 수도교 — 뺌', '수도교와 그 잔해(흰 아치)를 없앴다. 그 자리는 포룸 아치 문과 길.',
     (1000, 1000, 1240, 1200), None),
    ('6. 다리 — 양쪽 둑의 길과 이어짐', '세로띠 상판·가운데 석상 → 둑에 교대를 둔 아치교, 난간은 둑에서 시작해 둑에서 끝남, 상판이 길 포장과 이어짐. 호숫가 잔교도 길 가장자리에서 시작(모래 둑 쪽 한 칸 모자라던 것 고침).',
     (440, 440, 720, 640), 'g5_bridge'),
    ('7. 항구 물 — 격자 없는 자연 물', 'v5 는 물 전체에 육각·비늘 무늬가 16~64px 주기로 찍혀 포장면처럼 보였다 → 둑 거리 깊이색 + 두 옥타브 잡음, 서·동쪽 호숫가는 잡음으로 깎은 모래 둑. 물 픽셀 자기상관(16/32/64px): q41 0.109/0.095/0.072 → 0.022/0.013/0.004, q42 0.144/0.093/0.058 → 0.058/0.038/0.014.',
     (0, 1200, 400, 1600), 'g5_harbour'),
    ('8. 우산소나무 — 뺌', '가는 줄기 위에 뜬 납작한 수관이 어색해서 칩셋 활엽수로 바꿨다.',
     (1200, 1200, 1600, 1600), None),
]

sec = ''
for t, d, box, g in VERDICTS:
    sec += f'<h2>{H.escape(t)}</h2><p>{H.escape(d)}</p>' + pair(box, 2 if box[2] - box[0] > 300 else 3)
    if g: sec += f'<div class=row><div><div class="lab ok">v6 움직임</div>{gif(g)}</div></div>'

rows = ''; tot = dict(v5M=0, v5m=0, v6M=0, v6m=0)
for q in qa['quadrants']:
    for k in tot: tot[k] += q[k]
    bad = ''.join(f'<li>{H.escape(x)}</li>' for x in q.get('new_in_v6', [])) or '<li>없음</li>'
    fixed = ''.join(f'<li>{H.escape(x)}</li>' for x in q.get('fixed', [])) or '<li>—</li>'
    j, i = int(q['id'][1]) - 1, int(q['id'][2]) - 1; box = (i * 400, j * 400, i * 400 + 400, j * 400 + 400)
    rows += (f'<h3>구역 {q["id"][1]}-{q["id"][2]} — v5 중대 {q["v5M"]}·경미 {q["v5m"]} → v6 중대 {q["v6M"]}·경미 {q["v6m"]}</h3>'
             f'{pair(box, 1.5)}<div class=row><div><p><b>고쳐진 것</b></p><ul class=good>{fixed}</ul></div>'
             f'<div><p><b>v6 에 새로 생기거나 남은 것</b></p><ul class=bad>{bad}</ul></div></div>')
tbl = ('<table><tr><th>구역</th><th>v5 중대</th><th>v5 경미</th><th>v6 중대</th><th>v6 경미</th></tr>'
       + ''.join(f'<tr><td>{q["id"][1]}-{q["id"][2]}</td><td>{q["v5M"]}</td><td>{q["v5m"]}</td><td>{q["v6M"]}</td><td>{q["v6m"]}</td></tr>' for q in qa['quadrants'])
       + f'<tr class=tot><td>합</td><td>{tot["v5M"]}</td><td>{tot["v5m"]}</td><td>{tot["v6M"]}</td><td>{tot["v6m"]}</td></tr></table>')
st = json.load(open(f'{T}/city6_stats.json'))
left = ''.join(f'<li>{H.escape(x)}</li>' for x in qa['left'])

page = f'''<!doctype html><meta charset=utf-8><title>버들항 v6</title>
<style>body{{background:#1b1c1f;color:#ddd;font-family:sans-serif;margin:16px}}img{{image-rendering:pixelated;max-width:none;display:block}}
p,li{{color:#bbb;line-height:1.55;max-width:1150px}}.s{{overflow:auto;margin:6px 0 16px}}.row{{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start;margin:6px 0}}
.lab{{display:inline-block;background:#644;color:#fff;padding:1px 8px;font-size:13px;margin:8px 0 3px}}.ok{{background:#375}}.big{{max-height:88vh;overflow:auto;border:1px solid #333}}
table{{border-collapse:collapse;font-size:14px}}td,th{{border:1px solid #333;padding:3px 10px;text-align:center}}tr.tot td{{font-weight:bold;color:#fff}}
ul.bad li{{color:#e99}} ul.good li{{color:#9d9}} .k{{display:inline-block;background:#264;padding:2px 10px;margin:2px;border-radius:3px}} a{{color:#8cf}}</style>
<h1>버들항 v6 — 지적 8가지 반영 (v5 비교)</h1>
<p><span class=k>16구역 적대적 QA: 중대 {tot["v5M"]} → {tot["v6M"]} · 경미 {tot["v5m"]} → {tot["v6m"]}</span><span class=k>문 {st["doors"]}곳 · 길 안 닿는 문 {st["unreached_after"]}</span>
<span class=k>걷는 칸 {st["walk_cells"]} · 떨어진 칸 {st["walk_unconnected"]}</span><span class=k>한 바퀴 24장면 × 125ms</span></p>
<p>v5 페이지는 그대로: <a href="city-beodeul-v5.html">city-beodeul-v5.html</a>. 메타데이터: <a href="city-beodeul-v6-meta.json">city-beodeul-v6-meta.json</a></p>
<h2>전체 (절반 크기) — 왼쪽 v5, 오른쪽 v6</h2><div class=row><img src="{u(v5, 0.5)}" style="image-rendering:auto"><img src="{u(v6, 0.5)}" style="image-rendering:auto"></div>
{sec}
<h2>왕성 지구 (크게, 2배)</h2><div class=s><img src="{u(v6.crop((0, 0, 560, 440)), 2)}"></div>
<h2>16구역 적대적 QA (v5 → v6, 구역마다 두 판을 한 그림에 놓고 봄)</h2>
<p>구역마다 v5·v6 를 한 장에 나란히 놓고, 서브에이전트 하나가 그 한 장만 열어 흠을 셌다. 기준: 중대 = 시야각·오독·끊긴 길·안 이어진 다리·막힌 입구·반복 격자·떠 있음·잘림, 경미 = 빈 곳·어수선·같은 소품 줄·색·크기.</p>{tbl}
<h3>남은 것 (정직하게)</h3><ul class=bad>{left}</ul>
{rows}
<h2>원래 크기 v6</h2><div class="s big"><img src="{u(v6)}"></div>'''
out = os.path.expanduser('~/claude-viz/city-beodeul-v6.html')
open(out, 'w').write(page); print(out, len(page) // 1024, 'KB', tot)
