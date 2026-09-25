"""큰 마을 시각화 페이지.  python3 village_viz.py → ~/claude-viz/forest-harmony-big-village.html"""
import base64, glob, io, json, os, re
import numpy as np
from PIL import Image
from fhlib import *
import bp_fit as F
V = f'{OUT}/village'
v = json.load(open(f'{V}/village.json'))
def u(im, fmt='PNG'):
    b = io.BytesIO(); im.save(b, fmt, optimize=True); return f'data:image/{fmt.lower()};base64,' + base64.b64encode(b.getvalue()).decode()
base, over = Image.open(f'{V}/village.png'), Image.open(f'{V}/village-pass.png')
# 통과율: 이번 판(프롬프트 칸 수 명시·주황 칠·새 검사)으로 뽑은 후보만
BP = {b['id']: b for b in json.load(open(os.path.join(ROOT, 'tiledata/forest-harmony-buildings/blueprints.json')))['blueprints']}
rounds = {'bp3': (1, 6), 'bp2-l-house': (61, 64), 'bp2-manor-3f': (61, 64)}
rate = []
for bid, b in BP.items():
    if bid == 'bp2-castle': continue
    lo, hi = rounds.get(bid, rounds['bp3'] if bid.startswith('bp3') else (0, -1))
    cs = [f'{OUT}/{bid}-c{c}-bpcheck.json' for c in range(lo, hi + 1) if os.path.exists(f'{OUT}/{bid}-c{c}-bpcheck.json')]
    if cs: rate.append((b['label'], sum(json.load(open(c))['pass'] for c in cs), len(cs)))
# 지붕 명암 단 비중: 원본 집 vs 고른 그림(명암 맞춤 뒤)
rc = F.roof_colors()
def dark_share(img):
    a = np.array(img.convert('RGBA')); px = a[a[..., 3] > 200][:, :3]
    m = (px[:, None, :] == rc[None]).all(-1).any(-1); r = px[m]
    return (r @ F.LUM < 70).mean(), (r @ F.LUM).mean()
sd, sl = dark_share(house_render('ref-castle-05'))
tone = [(b['label'], b['art']) + dark_share(Image.open(f"{OUT}/{b['art']}-art.png")) for b in v['buildings']]
cards = []
for b in v['buildings']:
    a = Image.open(f"{OUT}/{b['art']}-art.png"); g = Image.new('RGBA', a.size, (84, 150, 62, 255)); g.alpha_composite(a)
    c = json.load(open(f"{OUT}/{b['art']}-bpcheck.json")); z = c.get('zone') or {}
    cards.append(f"<div class=card><img src='{u(g)}' style='width:{a.width * 2}px'><div class=cap><b>{b['role']}</b> · {b['label']} · {b['w']}×{b['h']}칸<br>{b['art'].split('-c')[-1]}번 후보 · 문 {len(b['doors'])} · 처마 {z.get('eave_cells', 0) - z.get('eave_off_n', 0)}/{z.get('eave_cells', 0)} · 번짐 {c['door_over']}도트</div></div>")
fixrows, fixcards = [], []
for b in v['buildings']:
    c = json.load(open(f"{OUT}/{b['art']}-bpcheck.json"))
    fixrows.append(f"<tr><td>{b['role']} ({b['label']})</td><td>+{c['head_extra']}칸</td><td>{c['outline_folded']}도트</td><td>{'예' if c['head_clipped_top'] else '아니오'}</td></tr>")
    if c['head_extra'] or c['outline_folded']:
        new_, old_ = Image.open(f"{OUT}/{b['art']}-art.png"), Image.open(f"{OUT}/{b['art']}-art-old.png")
        g = Image.new('RGBA', (old_.width * 2 + 24, new_.height + 8), (84, 150, 62, 255))
        g.alpha_composite(old_, (4, 4 + new_.height - old_.height)); g.alpha_composite(new_, (old_.width + 20, 4))
        fixcards.append(f"<div class=card><img src='{u(g)}' style='width:{g.width * 2}px'><div class=cap>{b['role']} · 왼쪽 옛 규칙 | 오른쪽 지금</div></div>")
css = """body{background:#1b1d1a;color:#e8e6df;font:15px/1.55 system-ui,sans-serif;margin:0;padding:22px}img{image-rendering:pixelated;display:block}
h1{font-size:21px}h2{font-size:18px;margin:34px 0 6px}p{color:#b8b5aa;max-width:1150px}.map{position:relative;display:inline-block;cursor:crosshair}
.map img.o{position:absolute;left:0;top:0;opacity:0;transition:opacity .12s}.map:hover img.o{opacity:1}
.cards{display:flex;flex-wrap:wrap;gap:18px;align-items:flex-end}.card{background:#111;padding:8px}.cap{font-size:12.5px;color:#aaa;margin-top:6px;max-width:320px}
table{border-collapse:collapse;margin:8px 0}td,th{border:1px solid #444;padding:4px 10px;text-align:left;font-size:14px}th{background:#262826}"""
doors = sum(len(b['doors']) for b in v['buildings'])
h = [f"<!doctype html><meta charset=utf-8><title>생성 건물 큰 숲마을</title><style>{css}</style>",
     f"<h1>생성 건물 큰 숲마을 — {v['map']['width']}×{v['map']['height']}칸</h1>",
     f"<p>건물 {len(v['buildings'])}채는 모두 Tibo 생성(설계도 방식, 검사 통과작만). 길·숲 윤곽·나무·소품·밭은 기존 숲마을 부품과 도구 그대로. 게임 해상도 1배(16px/칸). "
     f"<b>지도에 마우스를 올리면 통행 판정</b>: 초록 = 입구(맨 아래 가운데)에서 걸어서 닿는 칸, 빨강 = 막힘, 노랑 = 문(위 329 검정 · 아래 359), 하늘색 테두리 = 문 앞 칸. "
     f"문 {doors}개 문 앞 칸 전부 엔진 canMove BFS 로 도달({len(v['blocked'])}개 막힘). 새 타일 {v['genTiles']}칸(시트 480×{Image.open(f'{V}/gen-sheet.png').height}), 숲 {v['grove']['canopyCells']}칸, 나무 {len(v['trees'])}그루, 소품 {len(v['props'])}개.</p>",
     f"<div class=map><img src='{u(base.convert('RGB'))}'><img class=o src='{u(over.convert('RGB'))}'></div>",
     "<h2>굴뚝·첨탑 잘림 — 고친 것</h2><p>원인: 설계도 위 머리 공간이 1칸(16도트)뿐이라, 그보다 높이 솟은 굴뚝·첨탑은 설계도 상자 윗선에서 평평하게 잘렸다(예배당 첨탑은 30도트 = 2칸 가까이). "
     "그리고 몸통을 1도트 넓게 그린 그림은 오른쪽 바깥 윤곽이 칸 밖으로 밀려 잘렸다(14채 중 8채). "
     "고침: ① 설계도 위로 3칸까지 더 보고, <b>몸통과 이어진 그림만</b> 남겨 필요한 만큼 머리 줄을 늘린다(상위 레이어·통행). 같은 열에서 지붕보다 위에 있는 빈 칸(예배당 탑 옆)도 머리 공간으로 본다 — 마당 칸은 아니다. "
     "② 칸 밖으로 밀린 어두운 윤곽은 가장자리 픽셀로 접어 넣는다. 왼쪽 = 옛 규칙, 오른쪽 = 지금.</p>"
     + "<table><tr><th>건물</th><th>늘린 머리 줄</th><th>접어 넣은 윤곽</th><th>3칸으로도 모자람</th></tr>" + ''.join(fixrows) + "</table>"
     + "<div class=cards>" + ''.join(fixcards) + "</div>",
     "<h2>남은 문제 1 — 지붕이 원본보다 밝던 것</h2><p>원인은 색상이 아니라 명암이었다. 원본 지붕은 진한 보라 기와 윤곽이 30%인데 AI 기와는 그늘이 옅어 가장 가까운 색으로 잠그면 그 단이 0~11%로 사라졌다. "
     "지붕색 픽셀만 AI 밝기 순서는 그대로 두고 명암 단(진보라·적갈·주황·크림) 비중을 원본 집 지붕에 맞춘다. 아래는 마을에 쓴 그림의 진한 단 비중(명암 맞춤 뒤).</p>",
     "<table><tr><th>그림</th><th>진한 기와 단</th><th>지붕 평균 밝기</th></tr>" + f"<tr><td>원본 집(화풍 기준)</td><td>{sd:.0%}</td><td>{sl:.0f}</td></tr>"
     + ''.join(f"<tr><td>{l} ({a.split('-c')[-1]}번)</td><td>{d:.0%}</td><td>{m:.0f}</td></tr>" for l, a, d, m in tone) + "</table>",
     "<h2>남은 문제 2 — 통과율</h2><p>프롬프트 글자 수 한도가 풀려 부분별 칸 수(「지붕 5칸, 그다음 앞벽 5칸」)를 설계도에서 뽑아 적어 준다. 검사는 그대로(처마 ±4도트) — 오히려 X칸 빈 곳 메움 한도는 50%→20%로 조였다(메움이 갈색 줄무늬로 번졌음). "
     "떨어진 처마선은 12건 모두 같은 방향(목재 띠가 파란 선 5~6도트 위)이라 AI 버릇이고, 통과작이 충분해서 검사를 느슨하게 하지 않았다.</p>",
     "<table><tr><th>설계도</th><th>통과 / 후보</th></tr>" + ''.join(f"<tr><td>{l}</td><td>{p} / {n}</td></tr>" for l, p, n in rate)
     + f"<tr><th>합계</th><th>{sum(r[1] for r in rate)} / {sum(r[2] for r in rate)}</th></tr></table><p>이전 판: L자 2/6·대저택 1/4(약 25%).</p>",
     "<h2>마을에 쓴 건물 14채</h2><div class=cards>" + ''.join(cards) + "</div>"]
open(os.path.expanduser('~/claude-viz/forest-harmony-big-village.html'), 'w').write('\n'.join(h)); print('ok')
