#!/usr/bin/env python3
"""서양 도시 건물 조립 — Fable 5.2 가 그린 부품(tiledata/modern-city/west/parts·mats·pieces)을 사양(buildings-*.txt)대로 코드로 잇는다.

  python3 scripts/content/modern-city-street/west_build.py            # 전부 → tiledata/modern-city/west/buildings/<id>.png + build-report.json
  python3 scripts/content/modern-city-street/west_build.py bakery …   # 고른 것만

건물 = 정면(층 부품을 아래부터 쌓음) + 위에서 본 넓은 지붕 면(직사각형, 재질 타일 + 난간/용마루·처마) + 옥상 기물 + 얹는 부품(간판·시계·돔).
부품이 아직 없으면 그 건물은 건너뛴다(보고에 적는다). 모델 호출 없음.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(ROOT, 'src', 'harnesses', 'modern-chipset'))
import numpy as np                                  # noqa: E402
from PIL import Image                               # noqa: E402
import palette as PAL                               # noqa: E402
import west_spec as W                               # noqa: E402

WEST = W.WEST
T = 16
RAMPS = {name: [tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) for c in cols] for name, _ch, cols, _d in PAL.build()}
TONE = {c: (r, i) for r, cols in RAMPS.items() for i, c in enumerate(cols)}
INK = RAMPS['ink'][1]
FLAT = {'tar', 'gravel'}          # 난간 두른 평지붕. 나머지는 용마루·처마가 있는 직각 지붕(위에서 본 띠).


def shade(im, d):
    """그림의 불투명 화소를 제 램프에서 d 단 옮긴다(어둡게 −, 밝게 +). 램프 밖 색은 그대로."""
    a = np.array(im.convert('RGBA'))
    for y in range(a.shape[0]):
        for x in range(a.shape[1]):
            if a[y, x, 3] != 255: continue
            t = TONE.get(tuple(int(v) for v in a[y, x, :3]))
            if t: a[y, x, :3] = RAMPS[t[0]][min(len(RAMPS[t[0]]) - 1, max(0, t[1] + d))]
    return Image.fromarray(a, 'RGBA')


def load(kind, pid):
    p = os.path.join(WEST, kind, pid + '.png')
    return Image.open(p).convert('RGBA') if os.path.exists(p) else None


def roof_face(w, h, mat_id):
    """위에서 본 지붕 면 w×h. 윤곽은 직사각형 — 좌우 가장자리 수직."""
    mat = load('mats', mat_id); assert mat is not None, mat_id
    im = Image.new('RGBA', (w, h))
    for y in range(0, h, mat.height):
        for x in range(0, w, mat.width): im.paste(mat, (x, y))
    px = im.load()
    def line(x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): px[x, y] = (*c, 255)
    if mat_id in FLAT:
        rim, rim_d, rim_l = RAMPS['body'][5], RAMPS['body'][2], RAMPS['white'][1]
        line(0, 0, w - 1, 3, rim); line(0, h - 4, w - 1, h - 1, rim); line(0, 0, 3, h - 1, rim); line(w - 4, 0, w - 1, h - 1, rim)     # 난간 윗면
        line(1, 1, w - 2, 1, rim_l); line(1, 1, 1, h - 2, rim_l)                                                                         # 빛(왼쪽 위)
        line(4, 4, w - 5, 4, rim_d); line(4, 4, 4, h - 5, rim_d)                                                                         # 난간 안쪽 그늘
        dk = shade(im.crop((5, 5, w - 4, 7)), -1); im.paste(dk, (5, 5)); px = im.load()
        line(0, h - 1, w - 1, h - 1, rim_d)
    else:
        ridge = shade(im.crop((0, 0, w, 4)), -1); im.paste(ridge, (0, 0))
        hl = shade(im.crop((0, 1, w, 2)), +2); im.paste(hl, (0, 1))
        eave = shade(im.crop((0, h - 3, w, h)), -1); im.paste(eave, (0, h - 3))
        vl = shade(im.crop((1, 0, 3, h)), +1); im.paste(vl, (1, 0)); vr = shade(im.crop((w - 3, 0, w - 1, h)), -1); im.paste(vr, (w - 3, 0)); px = im.load()
    line(0, 0, w - 1, 0, INK); line(0, 0, 0, h - 1, INK); line(w - 1, 0, w - 1, h - 1, INK); line(0, h - 1, w - 1, h - 1, INK)
    return im


def build(b, P):
    """→ (그림, 빠진 부품 목록, 메모). 부품이 빠지면 그림은 None."""
    vols, hc = W.geometry(b, P)
    need = {t for v in b['volumes'] for r in v['rows'] for t, _ in r} | {x[0] for v in b['volumes'] for x in v['extras']}
    miss = sorted(t for t in need if load('parts', t) is None) + sorted({'obj:' + o for v in b['volumes'] for o in v['roofObjects'] if o != '_' and load('pieces', o) is None})
    if miss: return None, miss, []
    Wp, Hp = b['w'] * T, hc * T
    im = Image.new('RGBA', (Wp, Hp)); notes = []
    for v, g in zip(b['volumes'], vols):
        y = Hp
        for row, rh in zip(v['rows'], g['rowH']):
            y -= rh; x = g['x0']
            for pid, flip in row:
                part = load('parts', pid)
                if flip: part = part.transpose(Image.FLIP_LEFT_RIGHT)
                im.alpha_composite(part, (x, y)); x += part.width
        y0 = y                                                    # 정면 윗선 = 지붕 아랫선
        px = im.load()
        for yy in range(y0, Hp):                                  # 정면 좌우 윤곽
            px[g['x0'], yy] = (*INK, 255); px[g['x0'] + g['w'] - 1, yy] = (*INK, 255)
        rw, rh = g['w'] - 2 * v['inset'], g['roof']
        rf = roof_face(rw, rh, v['roof'])
        rx, ry = g['x0'] + v['inset'], y0 - rh
        im.alpha_composite(rf, (rx, ry))
        for pid, cx, by in v['extras']:                           # 지붕 면에 까는 것(경기장 잔디)
            if pid.endswith('-pitch'):
                part = load('parts', pid)
                for xx in range(rx + 4, rx + rw - 4, part.width):
                    im.alpha_composite(part.crop((0, 0, min(part.width, rx + rw - 4 - xx), part.height)), (xx, y0 + by - part.height))
        objs = v['roofObjects']; n = len(objs)
        for i, oid in enumerate(objs):
            if oid == '_': continue
            o = load('pieces', oid); a = np.array(o)[:, :, 3] > 0; ys = np.nonzero(a.any(1))[0]; xs = np.nonzero(a.any(0))[0]
            o = o.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
            cx = rx + int((i + 0.5) * rw / n); bottom = y0 - 6 - (4 if i % 2 else 0)
            top = bottom - o.height
            if top < ry + 2 - b['top'] * T or o.width > rw / n + 10:
                notes.append(f'옥상 기물 {oid} 가 지붕 면({rw}x{rh})에 안 맞아 뺐다'); continue
            ox = min(max(cx - o.width // 2, rx + 5), rx + rw - 5 - o.width)
            im.alpha_composite(o, (ox, top))
        for pid, cx, by in v['extras']:
            if pid.endswith('-pitch'): continue
            part = load('parts', pid); ox, oy = g['x0'] + cx - part.width // 2, y0 + by - part.height
            if ox < 0 or oy < 0 or ox + part.width > Wp or oy + part.height > Hp:
                notes.append(f'얹는 부품 {pid} 가 그림 밖으로 나가 잘렸다 ({ox},{oy})')
            im.alpha_composite(part, (ox, oy))
    a = np.array(im); a[a[:, :, 3] == 0] = 0                       # 투명 화소 RGB 0(해시 안정)
    return Image.fromarray(a, 'RGBA'), [], notes


def taper(im, b, P):
    """지붕 좁아짐(계약 §1): 첫 덩이 지붕 줄들의 좌·우 끝 x 퍼짐(화소). 얹는 부품·솟은 칸 줄은 뺀다."""
    vols, hc = W.geometry(b, P); g = vols[0]; v = b['volumes'][0]
    y0 = hc * T - g['front']; a = np.array(im)[:, :, 3] > 0
    lx, rx = g['x0'] + v['inset'], g['x0'] + g['w'] - v['inset'] - 1
    ls = [int(np.nonzero(a[y, lx - 2 if lx >= 2 else 0:lx + 6])[0].min()) for y in range(y0 - g['roof'], y0) if a[y, lx:lx + 6].any()]
    rs = [int(np.nonzero(a[y, rx - 5:rx + 1])[0].max()) for y in range(y0 - g['roof'], y0) if a[y, rx - 5:rx + 1].any()]
    return (max(ls) - min(ls) if ls else 0), (max(rs) - min(rs) if rs else 0)


def main():
    B, P, _M = W.buildings(); only = set(sys.argv[1:])
    out = os.path.join(WEST, 'buildings'); os.makedirs(out, exist_ok=True)
    rp = os.path.join(WEST, 'build-report.json'); rep = json.load(open(rp, encoding='utf-8')) if os.path.exists(rp) else {}
    for b in B:
        if only and b['id'] not in only: continue
        im, miss, notes = build(b, P)
        if im is None: rep[b['id']] = dict(built=False, missing=miss); print('skip', b['id'], 'missing', len(miss)); continue
        im.save(os.path.join(out, b['id'] + '.png'))
        tl, tr = taper(im, b, P)
        rep[b['id']] = dict(built=True, size=[im.width // T, im.height // T], roofTaperPx=[tl, tr], notes=notes)
        print('built', b['id'], im.size, 'taper', tl, tr, *notes)
    json.dump(rep, open(rp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
