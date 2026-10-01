"""조선 데모 증거 페이지를 ~/claude-viz/joseon-demo.html 로 만든다. python3 harness/make_page.py"""
import base64, io, json, os, subprocess, sys
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..'))
sys.path.insert(0, os.path.dirname(HERE))
import tk, blocks as K
from tk import Cv, hx


def uri(p): return 'data:image/png;base64,' + base64.b64encode(open(p, 'rb').read()).decode()
def uri_im(im):
    b = io.BytesIO(); im.save(b, 'PNG'); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()

pal = json.load(open(os.path.join(HERE, 'palette.json')))
names = ['giwa', 'earth', 'straw', 'dgreen', 'dblue', 'persimmon', 'pine', 'wood', 'stone', 'water', 'leaf', 'plaster', 'red']
S = 26; sw = Image.new('RGB', (7 * S + 110, len(names) * S), (26, 22, 18)); d = ImageDraw.Draw(sw)
for r, n in enumerate(names):
    d.text((4, r * S + 7), n, fill=(233, 220, 195))
    for i, c in enumerate(pal['ramps'][n]): d.rectangle([110 + i * S, r * S + 2, 110 + (i + 1) * S - 3, (r + 1) * S - 3], fill=c)
sw = sw.resize((sw.width * 2, sw.height * 2), Image.NEAREST)

# 블록 격자 비교: 버들항 h0 vs 조선
bd = Image.open('/tmp/j8city/h0.png') if os.path.exists('/tmp/j8city/h0.png') else None
L = K.library()
rows = K.house('jo', 6, 'lwddwr', 'lfddfr', steps=(2, 3), hip=True)
house = K.assemble(rows, L, post=lambda cv: K.hip_cut(cv, 0, 3, 'jo'))
bg = Cv(house.w + 16, house.h + 16); bg.rect(0, 0, bg.w, bg.h, hx('#58a035')); bg.paste(house, 8, 8)
gim = bg.img().resize((bg.w * 3, bg.h * 3), Image.NEAREST); gd = ImageDraw.Draw(gim)
for x in range(8 * 3, gim.width - 8 * 3 + 1, 48): gd.line([(x, 24), (x, gim.height - 24)], fill=(255, 255, 255, 80))
for y in range(8 * 3, gim.height - 8 * 3 + 1, 48): gd.line([(24, y), (gim.width - 24, y)], fill=(255, 255, 255, 80))
names_row = ' / '.join(rows[i].split()[3] for i in range(len(rows)))

out = subprocess.run([sys.executable, os.path.join(HERE, 'gate.py')], capture_output=True, text=True).stdout
lines = [l for l in out.splitlines() if l.strip() and not l.startswith('FAIL ')]
summ = [l for l in out.splitlines() if l.startswith('FAIL ')][-1]
trs = ''.join('<tr><td>%s</td><td>%s</td><td class="%s">%s</td></tr>' % (l[:14].strip(), l[14:23].strip(), 'bad' if 'FAIL' in l else ('warn' if 'WARN' in l else 'ok'), l[23:].split('   [')[0].strip()) for l in lines)
ver = json.load(open(os.path.join(HERE, 'verdicts.json')))
vtr = ''.join('<tr><td>%s</td><td class="%s">%s</td><td>%s</td></tr>' % (n, {'pass': 'ok', 'note': 'ok', 'user': 'warn', 'redo': 'bad'}[v['status']], v['status'], v['line']) for n, v in ver.items())
pc = json.load(open(os.path.join(ROOT, 'tiledata/joseon-demo/pieces.json')))
R = os.path.join(ROOT, 'tiledata/joseon-demo/review/')
rev = ''.join('<img src="%s">' % uri(R + n + '.png') for n in ('giwa_house_6', 'thatch_house_5', 'pavilion_5', 'gate_4'))
bdimg = '<img src="%s">' % uri('/tmp/j8city/h2.png') if os.path.exists('/tmp/j8city/h2.png') else ''
html = f'''<!doctype html><meta charset=utf-8><title>조선 칩셋 데모 v5 — 바람의나라 연구 반영</title>
<style>body{{background:#1a1612;color:#e9dcc3;font:15px/1.6 system-ui,'Noto Sans KR',sans-serif;margin:0;padding:24px;max-width:1320px;margin:auto}}
h1{{font-size:22px;margin:0 0 4px}}h2{{font-size:16px;margin:30px 0 8px;color:#e0b66a}}p{{margin:4px 0;color:#c9bca3}}
img{{image-rendering:pixelated;display:block;border:1px solid #4a3d2c;background:#000;margin:6px 0}}table{{border-collapse:collapse;font-size:13px}}td,th{{border:1px solid #3b2f20;padding:2px 8px;text-align:left}}
.ok{{color:#9ad06a}}.warn{{color:#e0b66a}}.bad{{color:#e0654a}}.tag{{display:inline-block;background:#3b2f20;border-radius:4px;padding:1px 8px;margin-right:6px;font-size:13px}}.row{{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start}}</style>
<h1>조선 칩셋 데모 v5 — 바람의나라 지붕·초가·담 연구 반영 (후보, 확정 아님)</h1>
<p><b>현재 상태:</b> 바람의나라 스크린샷 3장을 읽고 지붕(세로 기왓골+날개면+곡선 처마), 초가(둥근 방석), 담(주황 덮개+막돌), 정자(개방+단청 기둥), 처마 디더 그림자를 반영했습니다. 연구 노트는 <code>harness/BARAM_STUDY.md</code>. <b>이 새 모양은 아직 독립 적대 리뷰를 받지 않았습니다</b>(A·V 가 FAIL 로 남은 이유). 직전 나무·공간감 리뷰는 3/3 (revise).</p>
<p><span class=tag>허용 {len(pal['allowed'])}색 잠금</span><span class=tag>게이트 {summ}</span><span class=tag>지도 = 시트 칸 재조립 0화소 차이</span></p>
<h2>1. 같은 문법 비교 — 왼쪽 버들항(h2 격자) / 오른쪽 조선 한옥(16px 격자)</h2>
<div class=row>{bdimg}<img src="{uri_im(gim)}"></div>
<p>조선 조립표(위→아래): 치미 달린 ridge 행 → front → eave → 벽 위행 u → 벽 아래행 b → 석축 plinth → 계단 step. 지붕은 벽보다 좌우 한 칸씩 넓고(깊은 처마), 팔작 쐐기는 hip_cut.</p>
<h2>2. 데모 마을 48×42 (시트 칸 번호만으로 조립)</h2>
<img src="{uri(os.path.join(ROOT, 'tiledata/joseon-demo/joseon-demo-map.png'))}" style="width:1536px">
<h2>3. 검수 시트 — 버들항 기준 조각 옆에서 같은 배율</h2>
{rev}
<h2>4. 조각별 판정</h2>
<table><tr><th>조각</th><th>상태</th><th>판정</th></tr>{vtr}</table>
<p>pass=기준과 같은 문법 · note=통과하나 차이 있음 · user=윗면 안 보이는 정면 소품이라 <b>사용자 판정 필요</b> · redo=다시(게이트가 막음)</p>
<h2>5. 자동 게이트</h2>
<table><tr><th>조각</th><th>분류</th><th>결과</th></tr>{trs}</table>
<p>P 팔레트 · E 외곽선 · T 1px 줄 · L 빛 · S 그림자 · <b>K 건물은 블록 조립</b> · V 판정. 통과선은 버들항 객체 112개 실측. 계약: harness/CONTRACT.md</p>
<h2>6. 팔레트 (잠금)</h2>
<img src="{uri_im(sw)}">
<h2>7. 칩셋 시트 ({pc['cols']}×{pc['rows']}칸)</h2>
<img src="{uri(os.path.join(ROOT, 'tiledata/joseon-demo/joseon-demo-chipset.png'))}" style="width:768px;background:#58a035">'''
open(os.path.expanduser('~/claude-viz/joseon-demo.html'), 'w').write(html)
print(len(html) // 1024, 'KB')
