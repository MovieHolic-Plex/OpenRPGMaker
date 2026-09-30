#!/usr/bin/env python3
"""~/claude-viz/size-spec.html 생성 — 1칸=16px=1m(§12) 칸수 표준과 h34-B 6종 비교.
자체완결(data URI). 사용: python3 scripts/content/atlas-pick/make_size_spec_page.py [--out 경로]
"""
import argparse, base64, io, json, os
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
AP = ROOT / 'tiledata' / 'atlas-pick'
Z = 4
FLOOR = (104, 116, 100, 255)
GRID = (255, 255, 255, 46)
GRID_M = (255, 230, 120, 120)

ITEMS = [
    ('jp', 'vending_drink', '음료 자판기(1대)', 'vending_1'),
    ('jp', 'vending_ice', '아이스크림 자판기(1대)', 'vending_1'),
    ('school', 'locker_row', '사물함 줄(6문)', 'locker_row6'),
    ('school', 'lab_cabinet', '약품장(4문)', 'lab_cabinet'),
    ('horror', 'wardrobe_ajar', '반쯤 열린 옷장', 'wardrobe_1'),
    ('horror', 'dresser', '서랍장(3단)', 'chest_dresser'),
]
HERO = Image.open(AP / 'ascii-pixelize' / 'hero-c-ascii.png').convert('RGBA')


def uri(im):
    b = io.BytesIO(); im.save(b, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def bbox(im):
    return im.getchannel('A').point(lambda v: 255 if v else 0).getbbox()


def scene(parts, cw, ch, labels=False, ruler=False):
    """parts: [(Image, x_px, bottom_px)] 를 cw x ch (원 픽셀) 칸 바닥 위에 4배로 그린다."""
    pad = 22 if ruler else 0
    W, H = cw * Z + pad, ch * Z
    out = Image.new('RGBA', (W, H), FLOOR)
    for im, x, bottom in parts:
        big = im.resize((im.width * Z, im.height * Z), Image.NEAREST)
        out.alpha_composite(big, (pad + x * Z, bottom * Z - big.height))
    g = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(g)
    for x in range(0, cw + 1, 16):
        d.line([(pad + x * Z, 0), (pad + x * Z, H)], fill=GRID)
    for y in range(0, ch + 1, 16):
        d.line([(pad, H - y * Z), (W, H - y * Z)], fill=GRID)
    if ruler:                      # 1 m = 16 px 눈금 (바닥선 기준)
        for m in range(0, 4):
            y = H - int(m * 16 * Z)
            if y < 0: break
            d.line([(pad - 8, y), (W, y)], fill=GRID_M)
            d.text((1, y - 11), f'{m}m', fill=(255, 235, 150, 255))
    out.alpha_composite(g)
    return out


def load(set_, slug, tag):
    return Image.open(AP / f'candidates-{set_}' / slug / f'{tag}.png').convert('RGBA')


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--out', default=os.path.expanduser('~/claude-viz/size-spec.html'))
    a = ap.parse_args()
    std = json.load(open(AP / 'size-std.json'))
    audit = json.load(open(AP / 'size-audit.json'))
    rows, cards, errs = [], [], []
    for set_, slug, name, table in ITEMS:
        s = std[set_][slug]; b = s['basis']
        A, B = load(set_, slug, 'h34-A'), load(set_, slug, 'h34-B')
        bb = bbox(B); bw, bh = bb[2] - bb[0], bb[3] - bb[1]
        ba = bbox(A); aw, ah = ba[2] - ba[0], ba[3] - ba[1]
        want_h = b['F'] + b['T']
        errs.append(dict(slug=slug, spec=[b['wpx'], want_h], drawn=[bw, bh], err=[bw - b['wpx'], bh - want_h]))
        fcut = '' if b['F'] == b['F_raw'] else ' · F 깎음 %d→%d' % (b['F_raw'], b['F'])
        oldc = f"{A.width // 16}x{A.height // 16}"; newc = f"{s['cells'][0]}x{s['cells'][1]}"
        rows.append(f"<tr><td>{name}<br><small>{set_}/{slug}</small></td><td>{table}</td>"
                    f"<td>{b['W']}x{b['D']}x{b['H']} m</td><td>{b['wpx']}</td>"
                    f"<td class=old>F {b['F_raw']} · T {b['T_raw']}<br><small>({b['W']*16:.0f}px 폭)</small></td>"
                    f"<td>F {b['F']} + T {b['T']} = {want_h}<br><small>T 압축 {b['T_raw']}→{b['T']}{fcut}</small></td>"
                    f"<td><b>{newc}</b></td><td>{bw}x{bh}</td><td>{bw - b['wpx']:+d} / {bh - want_h:+d}</td><td class=old>{oldc}<br><small>그린 {aw}x{ah}</small></td></tr>")
        cw = max(A.width, B.width) * 2 + 16 + 24
        ch = 48
        xa = 0; xh = -(-A.width // 16) * 16 + 16; xb = xh + 32   # 칸 경계에 맞춤: 옛 | 한 칸 띄움 | 주인공 | 한 칸 띄움 | 새
        cmp_ = scene([(A, xa, ch), (HERO, xh, ch), (B, xb, ch)], xb + B.width + 16, ch, ruler=True)
        pa = scene([(A, 0, A.height)], A.width, A.height)
        pb = scene([(B, 0, B.height)], B.width, B.height)
        cards.append(f"""<section class=card><h3>{name} <small>{set_}/{slug} · 표 {table}</small></h3>
<div class=trio>
<figure><img src="{uri(pa)}"><figcaption>옛 h34-A · 캔버스 {oldc}칸<br>그린 {aw}x{ah}px</figcaption></figure>
<figure><img src="{uri(pb)}"><figcaption>새 h34-B · 캔버스 <b>{newc}칸</b><br>그린 {bw}x{bh}px (표 {b['wpx']}x{want_h})</figcaption></figure>
<figure class=wide><img src="{uri(cmp_)}"><figcaption>같은 배율: 옛(왼쪽) · 주인공 16x24 · 새(오른쪽). 노란 줄 = 1 m = 16px = 한 칸, 흰 줄 = 16px 칸. 주인공 16x24 는 1.5 m 축척(실제 170cm 와 모순)</figcaption></figure>
</div></section>""")
    # 감사 요약
    order = ['modern', 'jp', 'school', 'horror']
    bs = audit['summary']['by_set']; tot = audit['summary']['total']
    arows = ''.join(f"<tr><td>{k}</td><td>{bs[k]['total']}</td><td>{bs[k]['ok']}</td><td class=bad>{bs[k]['too_small']}</td><td class=bad>{bs[k]['too_big']}</td><td>{bs[k]['mixed']}</td><td>{bs[k]['unclear']}</td><td>{bs[k]['exempt']}</td></tr>" for k in order)
    arows += f"<tr class=tot><td>합계</td><td>{tot['total']}</td><td>{tot['ok']}</td><td class=bad>{tot['too_small']}</td><td class=bad>{tot['too_big']}</td><td>{tot['mixed']}</td><td>{tot['unclear']}</td><td>{tot['exempt']}</td></tr>"
    pick = [('jp', 'vending_coffee'), ('school', 'desk_pair'), ('school', 'cafeteria_table'), ('horror', 'bed_manor'), ('jp', 'phone_booth'), ('jp', 'jp_signal'), ('horror', 'wheelchair'), ('modern', 'gn_street_stall')]
    ex = []
    by = {(i['set'], i['slug']): i for i in audit['items']}
    for k in pick:
        i = by.get(k)
        if not i: continue
        p = AP / f'candidates-{k[0]}' / k[1] / f"{i['drawn']['file']}.png"
        if not p.exists(): continue
        im = Image.open(p).convert('RGBA')
        ch2 = max(48, im.height)
        sc = scene([(im, 0, im.height), (HERO, im.width + 4, im.height)], im.width + 4 + 16, im.height)
        vb = '작다' if i['verdict'] == 'too_small' else '크다'
        ex.append(f"<figure><img src=\"{uri(sc)}\"><figcaption>{i['name']}<br>지금 {i['current'][0]}x{i['current'][1]} → 표 {i['spec'][0]}x{i['spec'][1]} (<span class=bad>{vb}</span>)<br><small>{k[0]}/{k[1]} · {i['drawn']['file']} · 곁에 주인공 16x24</small></figcaption></figure>")
    html = f"""<!doctype html><meta charset=utf-8><title>칸수 = 1칸 16px 1m 기준</title>
<style>
body{{font:14px/1.5 system-ui,sans-serif;background:#1c211c;color:#e6eadf;margin:24px auto;max-width:1240px;padding:0 16px}}
h1{{font-size:22px}} h2{{margin-top:36px;border-bottom:1px solid #3b453a;padding-bottom:4px}} h3{{margin:0 0 8px}} small{{color:#9aa596;font-weight:400}}
table{{border-collapse:collapse;width:100%;margin:8px 0;font-size:13px}} td,th{{border:1px solid #3b453a;padding:4px 8px;text-align:center}} th{{background:#2a322a}}
td:first-child{{text-align:left}} .bad{{color:#ff9a86;font-weight:600}} .old{{color:#9aa596}} .tot td{{background:#2a322a;font-weight:700}}
.card{{background:#242b24;border-radius:8px;padding:12px 16px;margin:14px 0}} .trio{{display:flex;gap:18px;align-items:flex-end;flex-wrap:wrap}}
figure{{margin:0}} figcaption{{font-size:12px;color:#b8c2b3;margin-top:4px}} img{{image-rendering:pixelated;display:block;border:1px solid #3b453a}}
.grid{{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-end}} .rule{{background:#242b24;padding:10px 14px;border-radius:8px}}
</style>
<h1>칸수 = 1칸 16px = 1m 기준 (주인공 16x24 는 물건 곁에 같은 배율)</h1>
<div class=rule>사용자 결정: <b>1칸 = 16px = 1m</b>, 주인공은 16x24 그대로(발판 1칸). 폭 칸수 = ceil(실제 폭 m), F = H x 16, T = D x 16 x 압축계수. F+T 가 16xN 을 넘으면 <b>T 를 먼저 줄이고, 그래도 넘으면 F 를 줄이고(최대 4px·15%), 그래도 안 되면 N+1 칸</b>. 표는 압축 전 값과 압축 후 값을 함께 적는다. <b>모순 기록:</b> 24px 주인공은 16px/m 로 1.5m — 실제 키 170cm 와 어긋나므로 캐릭터는 양식화된 것으로 두고 표는 1칸=1m 에 묶는다. 정본: <code>tiledata/atlas-pick/modern-style-bible.md §12</code>, 계산기 <code>size_calc.py</code>.</div>
<h2>새로 그린 6종 (h34-B)</h2>
<table><tr><th>물건</th><th>표 id</th><th>실제 W x D x H</th><th>폭 px</th><th>압축 전(F·T)</th><th>압축 후 F+T</th><th>칸수</th><th>그린 크기</th><th>오차(폭/높이)</th><th>옛 칸수</th></tr>{''.join(rows)}</table>
{''.join(cards)}
<h2>전수 점검 (object 층: modern · jp · school · horror)</h2>
<table><tr><th>세트</th><th>항목</th><th>맞음</th><th>너무 작음</th><th>너무 큼</th><th>혼재</th><th>불명</th><th>제외(축약 관례)</th></tr>{arows}</table>
<p><small>불명 = 표에 대응이 없거나 그림 크기를 못 믿는 것(가로수·건물·차량 등). 제외 = 가로등·전봇대·신호등·차량처럼 화면 관례로 줄이는 것. 월드맵·바닥 층·키트 조각은 범위 밖.</small></p>
<h3>대표 불일치 (곁에 주인공 16x24)</h3>
<div class=grid>{''.join(ex)}</div>
"""
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_text(html)
    print(json.dumps(errs, ensure_ascii=False))
    print('written', a.out, len(html) // 1024, 'KB')

main()
