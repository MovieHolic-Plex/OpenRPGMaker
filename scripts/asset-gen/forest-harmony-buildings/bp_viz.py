import json, base64, io, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from fhlib import *
font = ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumSquareB.ttf', 15)
S = 3
def u(im):
    b = io.BytesIO(); im.save(b, 'PNG', optimize=True); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
def field(art, bp, overlay):
    m = bp['map']; H, W = len(m), len(m[0]); M = 3
    im = Image.new('RGBA', ((W + 2 * M + 8) * 16, (H + 2 * M) * 16))
    g = tile(240)
    for y in range(0, im.height, 16):
        for x in range(0, im.width, 16): im.alpha_composite(g, (x, y))
    im.alpha_composite(art, (M * 16, M * 16))
    h = house_render('ref-castle-05'); im.alpha_composite(h, ((W + 2 * M + 1) * 16, im.height - M * 16 - h.height))
    im.alpha_composite(art, (M * 16, M * 16))   # 머리 공간(상위)이 잔디 위에
    big = im.resize((im.width * S, im.height * S), Image.NEAREST)
    if overlay:
        o = Image.new('RGBA', big.size); d = ImageDraw.Draw(o); c = 16 * S
        for y in range(H):
            for x in range(W):
                X, Y = (M + x) * c, (M + y) * c
                col = {'X': (255, 40, 40, 70), 'D': (255, 220, 0, 150), '.': (40, 255, 90, 55), 'G': (0, 230, 255, 110), 'A': (60, 120, 255, 110), '*': (160, 200, 255, 60)}[m[y][x]]
                d.rectangle([X, Y, X + c - 1, Y + c - 1], fill=col, outline=(255, 255, 255, 60))
        doors = [(x, y) for y in range(H) for x in range(W) if m[y][x] == 'D' and not (y + 1 < H and m[y + 1][x] == 'D')]
        for x, y in doors:
            X, Y = (M + x) * c, (M + y + 1) * c
            d.rectangle([X + 4, Y + 4, X + c - 5, Y + c - 5], outline=(0, 230, 255, 255), width=4)
        big.alpha_composite(o)
    return big
BP = json.load(open(os.path.join(ROOT, 'tiledata/forest-harmony-buildings/blueprints.json')))
picks = sys.argv[1:]
css = "body{background:#1b1d1a;color:#e8e6df;font:15px/1.55 system-ui,sans-serif;margin:0;padding:22px}img{image-rendering:pixelated;display:block}h2{font-size:18px;margin:30px 0 4px}p{color:#b8b5aa;max-width:1150px}.pair{position:relative;display:inline-block;cursor:pointer}.pair img.o{position:absolute;left:0;top:0;opacity:0;transition:opacity .12s}.pair:hover img.o{opacity:1}.row{display:flex;gap:22px;align-items:flex-end;flex-wrap:wrap}.cap{font-size:13px;color:#aaa;margin-top:4px}pre{background:#111;padding:8px 12px;display:inline-block;font-size:14px;line-height:1.1}"
h = [f"<!doctype html><meta charset=utf-8><title>설계도 건물 시험</title><style>{css}</style><h1 style='font-size:21px'>{os.environ.get('TITLE') or '설계도 방식 — L자 2층집 · 3층 대저택 · 성'}</h1>",
     os.environ.get('INTRO', ''),
     "<p>설계도가 모양·통행·입구를 정하고, 그림은 검사만 받는다. 게임 해상도 3배. <b>그림에 마우스를 올리면 통행 판정</b>: 빨강 = 막힘, 초록 = 땅(걸을 수 있음), 노랑 = 입구(위 칸 검정 + 아래 칸 359, 아래 칸에 문 이벤트), 하늘색 테두리 = 접근칸, 청록 = 성문 통로(걸어서 지나감), 파랑 = 성문 위 성벽 윗면(상위 레이어 — 그 밑으로 지나감), 옅은 파랑 = 머리 공간(굴뚝·첨탑, 상위 레이어·통행). 오른쪽 작은 집 = 원본(같은 배율).</p>"]
for n in picks:
    bid = n.rsplit('-c', 1)[0]; bp = next(b for b in BP['blueprints'] if b['id'] == bid)
    c = json.load(open(f'{OUT}/{n}-bpcheck.json')); art = Image.open(f'{OUT}/{n}-art.png')
    meta = json.load(open(f'{OUT}/{bid}-ref.json')); ox, oy = meta['origin']; K = meta['scale']; W, H = meta['cells']
    raw = Image.open(f'{OUT}/{n}-raw.png').convert('RGBA'); bb = Image.new('RGBA', raw.size, (255, 0, 255, 255)); bb.alpha_composite(raw)
    raw = bb.convert('RGB').crop((ox, oy, ox + W * 16 * K, oy + H * 16 * K)).resize((W * 16 * 3 // 2, H * 16 * 3 // 2), Image.LANCZOS)
    ref = Image.open(f'{OUT}/{bid}-ref.png').convert('RGB').crop((ox, oy, ox + W * 16 * K, oy + H * 16 * K)).resize((W * 16 * 3 // 2, H * 16 * 3 // 2), Image.NEAREST)
    # 입구 확대: AI 원본 vs 확정, 노랑 = 입구 칸
    from scipy import ndimage
    dl, nd = ndimage.label(np.array([[ch == 'D' for ch in row] for row in bp['map']]))
    rawfull = Image.open(f'{OUT}/{n}-raw.png').convert('RGBA'); rb = Image.new('RGBA', rawfull.size, (255, 0, 255, 255)); rb.alpha_composite(rawfull)
    closes = []
    for gi, sl in enumerate(ndimage.find_objects(dl), 1):
        x0, y0, x1, y1 = sl[1].start * 16, sl[0].start * 16, sl[1].stop * 16, sl[0].stop * 16; P = 14
        box = (x0 - P, y0 - P, x1 + P, min(y1 + 4, H * 16))
        a_ = Image.new('RGBA', (box[2] - box[0], box[3] - box[1]), (60, 110, 50, 255)); a_.alpha_composite(art.crop(box))
        r_ = rb.convert('RGB').crop((ox + box[0] * K, oy + box[1] * K, ox + box[2] * K, oy + box[3] * K)).resize(a_.size, Image.NEAREST)
        pair = []
        for im_ in (r_.convert('RGBA'), a_):
            big_ = im_.resize((im_.width * 6, im_.height * 6), Image.NEAREST); dd = ImageDraw.Draw(big_)
            dd.rectangle([P * 6, P * 6, (P + x1 - x0) * 6 - 1, (P + y1 - y0) * 6 - 1], outline=(255, 230, 0), width=2); pair.append(big_)
        e = c['door_edge'][gi - 1]
        closes.append(f"<div><div class=row style='gap:6px'><img src='{u(pair[0])}'><img src='{u(pair[1])}'></div><div class=cap>입구 {gi}: AI 원본 | 확정 — 검정 번짐 왼 {e['left']} · 오른 {e['right']} · 위 {e['top']} 도트</div></div>")
    ok = ' · '.join(f"{'✔' if v else '✘'} {k}" for k, v in c['checks'].items())
    h.append(f"<h2>{bp['label']} — {n}</h2><p>{ok}<br>스냅(설계도로 잘라 맞춘 칸) {c['snapped']}개 · 입구 {len(c['doors'])}개 모두 접근칸 도달 · 칸 {c['tilesUsed']}개 · 원본 27색 평균 ΔE {c['palette_dE']}</p>")
    h.append(f"<div class=row><div><img src='{u(ref)}'><div class=cap>설계도(기준 이미지)</div></div><div><img src='{u(raw)}'><div class=cap>AI 원본</div></div>"
             f"<div><pre>{chr(10).join(r + ('   ' + z_ if z_ else '') for r, z_ in zip(bp['map'], bp.get('zones') or [''] * len(bp['map'])))}</pre><div class=cap>설계도 (X 막힘 · . 땅 · D 입구 · * 머리 공간 · G 성문 통로 · A 성문 위 / 오른쪽 = 구역: R 지붕 · W 앞벽)</div></div></div>")
    z = c.get('zone') or {}
    if z: h.append(f"<p>지붕/앞벽: 지붕 구역의 지붕색 {z['roof_in_R']:.0%} · 앞벽 구역의 지붕색 {z['roof_in_W']:.0%} · 처마선 칸 {z['eave_cells'] - z['eave_off_n']}/{z['eave_cells']} 이 파란 선 ±4도트 안</p>")
    h.append(f"<div class=row>{''.join(closes)}</div>")
    h.append(f"<div class=pair><img src='{u(field(art, bp, False))}'><img class=o src='{u(field(art, bp, True))}'></div>")
open('/home/main/claude-viz/' + (os.environ.get('PAGE') or 'forest-harmony-blueprint-buildings') + '.html', 'w').write('\n'.join(h)); print('ok')
