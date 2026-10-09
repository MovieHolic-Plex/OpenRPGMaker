# 전수 감사 보정(2026-10-08, tiledata/beodeul-kits/audit_autotile.py) — autotile-spotlight-pool · autotile-rose-petals.
#  spotlight-pool: 옛 판(os_fix.spot_cell)은 edge_taper(inset 2.6, jag 1.8, 잡음 주기 8)라 출렁임이 얕아 5×5 덩이가 네모(bad 0.561, 곧은 줄 68/80px).
#    새 판: 같은 빛 화가(점 번짐 → 주황 테 → 밝은 초점 테 → 크림 빛·먼지 반짝)에 윤곽만 공용 깊이장 autotile_edge.edge_fields
#    (정원 연못과 같은 큰 혹+잔 혹, 칸 끝 얕게, 볼록 모서리 반지름 7)로 바꿔 칠한다.
#  rose-petals: 옛 판(os_fix.petal_cell)은 칸마다 같은 13자리 흩은 꽃잎이라 덩이 바깥 줄이 칸 경계에서 14px 튀고(seam 14),
#    이웃 쪽 변에 꽃잎이 닿지 않는 칸이 있었다(규약 위반 8).
#    새 판: 주기 16 으로 감기는 촘촘한 꽃잎 결(꽃잎 28장, 칸 경계를 넘어 이어진다 — 속 칸끼리 이음새 없음)을 공용 깊이장으로 자르고,
#    가장자리 깊이 2.6px 안쪽은 꽃잎을 성기게(바닥이 사이로 보인다), 윤곽 바로 안 1px 은 꽃잎 끝을 띄엄띄엄 이어(칸 끝 2px 는 반드시 — 옆 칸과 같은 깊이로 만난다) 덩이 가장자리가 흩어지지 않는다.
#    꽃잎 모양·진홍/분홍 램프·드문 초록 잎·1px 그림자는 옛 판 그대로.
#  덮어쓰는 파일: parts/autotile-spotlight-pool.png · parts/autotile-rose-petals.png (이름 그대로).
#  쓰기: python3 os_fix_autotile.py          → 두 시트만 쓴다
#        python3 os_fix_autotile.py --render → 위 판으로 make_opera_stage.py 를 다시 돌려 render-1x/2x·check-autotile 갱신 후
#                                              compare-ref.png 를 [HEAD 판 | 새 판] 달라진 곳 + 5×5 덩이 비교로 다시 쓴다.
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', '..', 'beodeul-kits'))
import numpy as np
from PIL import Image
import os_fix as FX
from os_fix import hash2, LIT, LIT_HOT, LIT_FRINGE, PET, LEAFG, PETAL_SHAPES, sheet_of, _img
from autotile_edge import edge_fields


def spot_cell(n, seed=1201):
    m = edge_fields(n, inset=3.0, jag=3.0, rad=7.0, seed=seed)[0]
    o = np.zeros((16, 16, 4))
    for y in range(16):
        for x in range(16):
            v = m[y, x]
            if v < -1.6: continue
            if v < 0:
                if (x + y) % 2 == 0 and v > -1.0: o[y, x] = LIT + (30,)
                elif (x + y) % 4 == 1 and v > -1.6: o[y, x] = LIT + (18,)
                continue
            if v < 0.9: o[y, x] = LIT_FRINGE + (96,); continue
            if v < 2.3: o[y, x] = LIT_HOT + (172,); continue
            c = LIT + (120,)
            if v < 3.4 and (x + y) % 2 == 0: c = LIT + (130,)
            hh = hash2(x, y, seed + 7)
            if hh > 0.996: c = LIT_HOT + (180,)
            elif hh < 0.012: c = LIT + (76,)
            o[y, x] = c
    return _img(o)


def _petal_field(seed=1249, k=22, dmin=2.8):
    """주기 16 꽃잎 결: (색 RGBA, 꽃잎 번호) 화소 지도. 꽃잎·그림자는 칸 끝에서 감겨 반대편으로 이어진다."""
    rng = np.random.default_rng(seed); pts = []
    for _ in range(2000):
        if len(pts) >= k: break
        x, y = int(rng.integers(0, 16)), int(rng.integers(0, 16))
        if all(min(abs(x - a), 16 - abs(x - a)) ** 2 + min(abs(y - b), 16 - abs(y - b)) ** 2 >= dmin * dmin for a, b in pts): pts.append((x, y))
    col = np.zeros((16, 16, 4)); pid = np.full((16, 16), -1)
    def put(x, y, c, a, i):
        x %= 16; y %= 16
        if col[y, x, 3] == 0: col[y, x] = tuple(c) + (a,); pid[y, x] = i
    for i, (px, py) in enumerate(pts):
        shp = PETAL_SHAPES[int(hash2(i, 2, seed + 4) * len(PETAL_SHAPES))]
        leaf = hash2(i, 3, seed + 5) > 0.9
        tone = int(hash2(i, 4, seed + 6) * 2)
        ys = [d[1] for d in shp]
        for (dx, dy) in shp:
            top = dy == min(ys)
            if leaf: c = LEAFG[2] if top else LEAFG[1]
            else: c = PET[4 + tone] if top else PET[3 + tone - (1 if dx == max(d[0] for d in shp) else 0)]
            put(px + dx, py + dy, c, 255, i)
        for (dx, dy) in shp:
            if (dx, dy + 1) not in shp: put(px + dx, py + dy + 1, (PET[0] if not leaf else LEAFG[0]), 150, i)
    return col, pid


PFIELD = None


def petal_cell(n, seed=1241):
    global PFIELD
    if PFIELD is None: PFIELD = _petal_field()
    col, pid = PFIELD
    m = edge_fields(n, inset=3.0, jag=3.0, rad=7.0, seed=seed)[0]
    o = np.zeros((16, 16, 4))
    for y in range(16):
        for x in range(16):
            v = m[y, x]
            if v < 0: continue
            if v < 1.0:                                                            # 윤곽 바로 안: 꽃잎 끝이 이어진다
                if col[y, x, 3] > 0: o[y, x] = col[y, x]
                elif min(x, 15 - x, y, 15 - y) > 1 and hash2(x // 2, y // 2, seed + 13) > 0.5: continue   # 칸 끝 2px 는 꼭 잇고(이음매), 가운데는 끊긴다
                else:
                    t = int(hash2(x, y, seed + 9) * 3)
                    o[y, x] = tuple(PET[(2, 3, 4)[t]]) + (255,)
                continue
            if col[y, x, 3] == 0: continue
            dens = 0.74 if v > 4.0 else (0.5 if v > 2.6 else 0.32)                 # 가장자리로 갈수록 성기다
            if hash2(int(pid[y, x]), 7, seed + 11) > dens: continue
            o[y, x] = col[y, x]
    return _img(o)


def patch():
    FX.spot_cell = spot_cell; FX.petal_cell = petal_cell
    FX.SPOT = FX.SHADOW = FX.PETALS = None


def write_parts():
    patch()
    sp, _, pe = FX.sheets()
    sp.save(os.path.join(HERE, 'parts', 'autotile-spotlight-pool.png')); pe.save(os.path.join(HERE, 'parts', 'autotile-rose-petals.png'))
    return sp, pe


def compare_ref(path):
    """[HEAD 판 | 새 판]: 달라진 화소가 가장 많은 곳 4군데(208x160) 2배 + 마지막 줄 5x5 덩이를 무대 널 위에(옛 시트 | 새 시트)."""
    import io, subprocess
    from PIL import ImageDraw
    def git_img(rel):
        raw = subprocess.run(['git', 'show', 'HEAD:tiledata/beodeul-variants/opera-stage/' + rel], cwd=HERE, capture_output=True, check=True).stdout
        return Image.open(io.BytesIO(raw)).convert('RGBA')
    old, new = git_img('render-1x.png'), Image.open(os.path.join(HERE, 'render-1x.png')).convert('RGBA')
    cw, ch = 208, 160
    d = (np.abs(np.array(old.convert('RGB')).astype(int) - np.array(new.convert('RGB')).astype(int)).sum(2) > 0).astype(np.int64)
    ii = np.pad(d.cumsum(0).cumsum(1), ((1, 0), (1, 0))); H, W = d.shape; boxes = []
    for _ in range(4):
        best = None
        for y in range(0, H - ch + 1, 16):
            for x in range(0, W - cw + 1, 16):
                if any(not (x + cw <= bx or bx + cw <= x or y + ch <= by or by + ch <= y) for bx, by in boxes): continue
                v = ii[y + ch, x + cw] - ii[y, x + cw] - ii[y + ch, x] + ii[y, x]
                if best is None or v > best[0]: best = (v, x, y)
        if not best or best[0] == 0: break
        boxes.append(best[1:])
    rows = [[('BEFORE (%d,%d)' % b, old.crop((b[0], b[1], b[0] + cw, b[1] + ch))), ('AFTER (%d,%d)' % b, new.crop((b[0], b[1], b[0] + cw, b[1] + ch)))] for b in boxes]
    from os_kit import stage_px
    Y, X = np.mgrid[0:7 * 16, 0:7 * 16]
    st = np.zeros((7 * 16, 7 * 16, 4), np.uint8)
    for y in range(7 * 16):
        for x in range(7 * 16): st[y, x, :3] = stage_px(x, y)[:3]
    st[..., 3] = 255
    def blob(sheet):
        out = Image.fromarray(st.copy(), 'RGBA')
        inn = lambda x, y: 1 <= x <= 5 and 1 <= y <= 5
        for y in range(1, 6):
            for x in range(1, 6):
                n = (1 if inn(x, y - 1) else 0) | (2 if inn(x + 1, y) else 0) | (4 if inn(x, y + 1) else 0) | (8 if inn(x - 1, y) else 0)
                out.alpha_composite(sheet.crop(((n % 4) * 16, (n // 4) * 16, (n % 4) * 16 + 16, (n // 4) * 16 + 16)), (x * 16, y * 16))
        p = Image.new('RGBA', (cw, ch), (24, 22, 30, 255)); p.alpha_composite(out, ((cw - 112) // 2, (ch - 112) // 2)); return p
    for name in ('spotlight-pool', 'rose-petals'):
        rows.append([('BEFORE autotile-%s 5x5' % name, blob(git_img('parts/autotile-%s.png' % name))),
                     ('AFTER autotile-%s 5x5' % name, blob(Image.open(os.path.join(HERE, 'parts', 'autotile-%s.png' % name)).convert('RGBA')))])
    sheet = Image.new('RGBA', (2 * (cw * 2 + 8) + 8, len(rows) * (ch * 2 + 26) + 4), (24, 22, 30, 255)); dr = ImageDraw.Draw(sheet)
    for r, row in enumerate(rows):
        for i, (lab, t) in enumerate(row):
            x = 8 + i * (cw * 2 + 8); y = 4 + r * (ch * 2 + 26)
            sheet.alpha_composite(t.resize((cw * 2, ch * 2), Image.NEAREST), (x, y + 20))
            dr.text((x, y + 2), lab, fill=(230, 226, 236, 255))
    sheet.convert('RGB').save(path)


if __name__ == '__main__':
    write_parts(); print('wrote parts')
    if '--render' in sys.argv:
        import runpy
        runpy.run_path(os.path.join(HERE, 'make_opera_stage.py'), run_name='__main__')
        compare_ref(os.path.join(HERE, 'compare-ref.png')); print('compare-ref written')
