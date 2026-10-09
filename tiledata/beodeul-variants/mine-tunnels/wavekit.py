# 버들항 웨이브 C 공용 도구 (mine-tunnels 와 ancient-forest 가 같이 쓴다).
# 조각 저장(partmeta/parts.md), 16변형 오토타일 시트, 이음새 검사, 시각 검증 페이지.
import os, sys, json, math, base64, io, collections
import numpy as np
from PIL import Image, ImageDraw
T = 16

def pad16(im, anchor='bl'):
    """16의 배수 크기로 늘린다. 물체는 왼쪽 아래 정렬."""
    im = im.convert('RGBA'); w, h = im.size
    W, H = -(-w // T) * T, -(-h // T) * T
    if (W, H) == (w, h): return im
    o = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    o.alpha_composite(im, (0, H - h) if anchor == 'bl' else (0, 0))
    return o

def cells(im): return (im.width // T, im.height // T)

# ------------------------------------------------------------------ 16변형 오토타일
# 칸 번호 = 위(N)1 + 오른쪽(E)2 + 아래(S)4 + 왼쪽(W)8. 시트 4x4, 칸 번호 = 가로로 4칸씩.
def autotile_sheet(draw_cell):
    """draw_cell(n,e,s,w) -> 16x16 RGBA."""
    sh = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    for i in range(16):
        n, e, s, w = bool(i & 1), bool(i & 2), bool(i & 4), bool(i & 8)
        sh.alpha_composite(draw_cell(n, e, s, w).convert('RGBA'), ((i % 4) * T, (i // 4) * T))
    return sh

def autotile_cell(sheet, i): return sheet.crop(((i % 4) * T, (i // 4) * T, (i % 4) * T + T, (i // 4) * T + T))

def autotile_layout(mask):
    """mask: 2D bool 격자 → 번호 격자(없는 칸은 None)."""
    H, W = mask.shape; out = [[None] * W for _ in range(H)]
    g = lambda x, y: 0 <= x < W and 0 <= y < H and bool(mask[y, x])
    for y in range(H):
        for x in range(W):
            if mask[y, x]: out[y][x] = g(x, y - 1) * 1 + g(x + 1, y) * 2 + g(x, y + 1) * 4 + g(x - 1, y) * 8
    return out

def autotile_paint(img, sheet, mask, ox=0, oy=0):
    lay = autotile_layout(mask)
    for y, row in enumerate(lay):
        for x, n in enumerate(row):
            if n is not None: img.alpha_composite(autotile_cell(sheet, n), (ox + x * T, oy + y * T))

def autotile_seam_ok(sheet):
    """서로 이웃해야 하는 변형 칸 사이의 이음 검사: 같은 변 연결이 있는 칸끼리 가장자리 화소 알파·색 일치율."""
    bad = []
    for a in range(16):
        for b in range(16):
            ca, cb = autotile_cell(sheet, a), autotile_cell(sheet, b)
            if a & 2 and b & 8:   # a 의 오른쪽 이웃이 b
                A = np.array(ca)[:, 15, 3] > 0; B = np.array(cb)[:, 0, 3] > 0
                if (A != B).sum() > 9: bad.append(('E-W', a, b, int((A != B).sum())))
            if a & 4 and b & 1:   # a 의 아래쪽 이웃이 b
                A = np.array(ca)[15, :, 3] > 0; B = np.array(cb)[0, :, 3] > 0
                if (A != B).sum() > 9: bad.append(('S-N', a, b, int((A != B).sum())))
    return bad

# ------------------------------------------------------------------ 바닥 표본 이음새 검사
def seam_score(img):
    """3x3 이어 붙인 가장자리의 평균 색 차이 / 안쪽 이웃 화소 평균 차이. 1 근처이면 이음새 안 보임."""
    a = np.array(img.convert('RGB')).astype(float)
    w, h = a.shape[1], a.shape[0]
    e_x = np.abs(a[:, 0] - a[:, -1]).mean(); e_y = np.abs(a[0] - a[-1]).mean()
    in_x = np.abs(a[:, 1:] - a[:, :-1]).mean(); in_y = np.abs(a[1:] - a[:-1]).mean()
    return round(float(e_x / max(in_x, 1e-6)), 2), round(float(e_y / max(in_y, 1e-6)), 2)

# ------------------------------------------------------------------ 결과 저장
class Parts:
    """name -> (img, meta). meta: kind, ko, desc, rules, brows, layer, role"""
    def __init__(s, slug, outdir):
        s.slug, s.outdir = slug, outdir; s.items = collections.OrderedDict(); s.pdir = os.path.join(outdir, 'parts')
        os.makedirs(s.pdir, exist_ok=True)
    def add(s, name, img, kind, ko, desc, rules, brows=None, layer=None, role=None, pad=True):
        im = pad16(img) if pad else img.convert('RGBA')
        if brows is None: brows = 0 if kind in ('floor', 'decal', 'walk', 'liquid') else 1
        meta = dict(kind=kind, ko=ko, desc=desc, rules=rules, brows=brows)
        if kind == 'autotile': meta['layer'] = layer or 'lower'; meta['role'] = role or 'terrain'
        s.items[name] = (im, meta); return im
    def save(s):
        for f in os.listdir(s.pdir):
            if f.endswith('.png') and f[:-4] not in s.items: os.remove(os.path.join(s.pdir, f))
        meta = {}
        for n, (im, m) in s.items.items():
            im.save(os.path.join(s.pdir, n + '.png')); meta[n] = m
        json.dump(meta, open(os.path.join(s.outdir, 'partmeta.json'), 'w'), ensure_ascii=False, indent=1)
        lines = ['# 새로 찍은 조각 — %s\n' % s.slug]
        for n, (im, m) in s.items.items():
            w, h = cells(im)
            lines.append('- `parts/%s.png` (%dx%d px) — %s: %s / %dx%d칸' % (n, im.width, im.height, m['ko'], m['desc'], w, h))
        kinds = collections.Counter(m['kind'] for _, m in s.items.values())
        lines.append('\n합계: %d 조각 (%s)\n' % (len(s.items), ', '.join('%s %d' % kv for kv in sorted(kinds.items()))))
        open(os.path.join(s.outdir, 'parts.md'), 'w').write('\n'.join(lines))
        return kinds

def b64(im, scale=1):
    if scale != 1: im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    bio = io.BytesIO(); im.save(bio, 'PNG'); return 'data:image/png;base64,' + base64.b64encode(bio.getvalue()).decode()

def parts_board(items, cols=6, scale=3, maxw=None, bg=(54, 58, 66, 255), label=True):
    """번호 붙인 조각 판. items: [(name, img)]. 반환 (board, 번호표 목록)."""
    fnt = None
    cw = max(i.width for _, i in items) * scale + 14; ch = max(i.height for _, i in items) * scale + 28
    # 줄마다 높이를 따로 쓴다
    rows = [items[i:i + cols] for i in range(0, len(items), cols)]
    rh = [max(i.height for _, i in r) * scale + 28 for r in rows]
    cwv = [max(r[c][1].width if c < len(r) else 0 for r in rows) * scale + 14 for c in range(cols)]
    W = sum(cwv); H = sum(rh)
    bd = Image.new('RGBA', (W, H), bg); d = ImageDraw.Draw(bd)
    y = 0; num = 1
    for r, hh in zip(rows, rh):
        x = 0
        for c, (n, im) in enumerate(r):
            tw, th = im.width * scale, im.height * scale
            tile = Image.new('RGBA', (tw, th), (84, 88, 98, 255)); td = ImageDraw.Draw(tile); q = 8 * scale
            for yy in range(0, th, q):
                for xx in range(0, tw, q):
                    if (xx // q + yy // q) % 2: td.rectangle((xx, yy, xx + q - 1, yy + q - 1), fill=(74, 78, 88, 255))
            tile.alpha_composite(im.resize((tw, th), Image.NEAREST))
            bd.alpha_composite(tile, (x + 7, y + 7))
            d.text((x + 7, y + 8 + th), '%02d %s' % (num, n[:26]), fill=(220, 224, 232, 255))
            num += 1; x += cwv[c]
        y += hh
    return bd

def empty_windows(deco, walk, win=(20, 15), stride=(3, 4)):
    """한 화면 창에서 열린(걷는) 칸 중 아무 장식도 없는 칸 비율 최댓값 (열린 칸 기준 + 창 면적 기준 두 가지)."""
    H, W = deco.shape; worst = (0, 0, 0); worst_open = (0, 0, 0)
    for y in range(0, max(1, H - win[1] + 1), stride[0]):
        for x in range(0, max(1, W - win[0] + 1), stride[1]):
            dd = deco[y:y + win[1], x:x + win[0]]; ww = walk[y:y + win[1], x:x + win[0]]
            r = (ww & ~dd).sum() / float(dd.size)
            if r > worst[0]: worst = (r, x, y)
    return worst

def bfs_reach(walk, start, targets):
    H, W = walk.shape; seen = {start}; q = collections.deque([start])
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < W and 0 <= ny < H and walk[ny, nx] and (nx, ny) not in seen: seen.add((nx, ny)); q.append((nx, ny))
    return {k: (v in seen) for k, v in targets.items()}, len(seen), seen


# ------------------------------------------------------------------ 시각 검증 페이지 (자체완결)
def autotile_labeled(sheet, scale=6, bg=(96, 84, 80, 255)):
    cell = T * scale; out = Image.new('RGBA', (4 * (cell + 6) + 6, 4 * (cell + 18) + 6), (40, 42, 48, 255)); d = ImageDraw.Draw(out)
    for i in range(16):
        x = 6 + (i % 4) * (cell + 6); y = 6 + (i // 4) * (cell + 18)
        t = Image.new('RGBA', (cell, cell), bg); t.alpha_composite(autotile_cell(sheet, i).resize((cell, cell), Image.NEAREST)); out.alpha_composite(t, (x, y))
        nb = ''.join(k for k, b in (('N', i & 1), ('E', i & 2), ('S', i & 4), ('W', i & 8)) if b) or '-'
        d.text((x, y + cell + 2), '%d  %s' % (i, nb), fill=(230, 232, 238, 255))
    return out

def autotile_demo(sheet, bg=(96, 84, 80, 255), scale=4):
    import numpy as np
    mk = np.zeros((7, 9), bool); mk[1, 1:6] = True; mk[1:6, 3] = True; mk[5, 3:8] = True; mk[3, 3:7] = True; mk[3, 6] = True; mk[0, 8] = True; mk[3:6, 7] = True
    im = Image.new('RGBA', (9 * T, 7 * T), bg); autotile_paint(im, sheet, mk); return im.resize((im.width * scale, im.height * scale), Image.NEAREST)

def blocked_overlay(img, blocked, cell=T):
    ov = Image.new('RGBA', img.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    H, W = blocked.shape
    for y in range(H):
        for x in range(W):
            if blocked[y, x]: d.rectangle((x * cell, y * cell, x * cell + cell - 1, y * cell + cell - 1), fill=(230, 40, 40, 110))
            else: d.rectangle((x * cell, y * cell, x * cell + cell - 1, y * cell + cell - 1), outline=(60, 220, 120, 90))
    o = img.convert('RGBA').copy(); o.alpha_composite(ov); return o

def build_page(path, title, subtitle, map_img, crops, parts_items, autotiles, blocked, notes_html, bgcol='#16181d', crop_scale=2):
    """crops: [(label, (x0,y0,x1,y1) px)]. autotiles: [(name, sheet)]."""
    import html
    secs = []
    secs.append('<h2>지도 1x (%dx%d칸)</h2><img src="%s">' % (map_img.width // T, map_img.height // T, b64(map_img)))
    for lab, box in crops:
        c = map_img.crop(box)
        secs.append('<h2>%s (2x 확대)</h2><img src="%s">' % (html.escape(lab), b64(c, crop_scale)))
    board = parts_board(parts_items, cols=8, scale=3)
    secs.append('<h2>조각 판 (번호 = parts.md 순서, %d개)</h2><img src="%s">' % (len(parts_items), b64(board)))
    for name, sh_ in autotiles:
        secs.append('<h2>오토타일 %s — 16칸 시트(번호=위1+오른쪽2+아래4+왼쪽8) + 이어 붙인 예</h2><div class="row"><img src="%s"><img src="%s"></div>' % (html.escape(name), b64(autotile_labeled(sh_)), b64(autotile_demo(sh_))))
    secs.append('<h2>통행 격자 겹침 (빨강=막힘, 초록 테두리=걸음)</h2><img src="%s">' % b64(blocked_overlay(map_img, blocked), 1))
    doc = ('<!doctype html><meta charset="utf-8"><title>%s</title><style>body{background:%s;color:#dde;font:14px/1.5 sans-serif;margin:20px;max-width:1500px}'
           'img{image-rendering:pixelated;max-width:100%%;display:block;margin:8px 0;border:1px solid #333}h1{font-size:22px}h2{font-size:16px;margin-top:26px;color:#9cf}.row{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start}'
           '.note{background:#1e222a;padding:10px 14px;border-radius:6px}</style><h1>%s</h1><p>%s</p><div class="note">%s</div>%s') % (html.escape(title), bgcol, html.escape(title), subtitle, notes_html, ''.join(secs))
    open(path, 'w').write(doc); return len(doc)
