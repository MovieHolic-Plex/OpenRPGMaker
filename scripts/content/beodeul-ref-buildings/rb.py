"""버들항 참고 건물(reference building types) 조립기 — 부품(지붕 판·벽 판·문·창·트인 칸·난간 …)을 덩어리(volume)로 놓아 건물 한 채를 만든다.

조립 규칙은 집 양식 조립기(scripts/content/beodeul-house-styles/hs.py, 가지 agent/beodeul-house-styles)를 옮겨 온 것이고 재질·색 줄도 그쪽과 같다(같은 마을에 나란히 선다).
부품은 tiledata/beodeul-ref-buildings/parts/*.png, 색 줄은 ramps.json, 건물마다의 조립 순서는 recipes.py, 어느 판이 Fable 그림이고 어느 판이 코드인지는 parts.json.

덩어리 — 지붕 옆선은 수직이고 옆벽은 보이지 않는다(직교 3/4 시점):
 · 처마 정면(k 'e', 용마루가 좌우): 지붕은 직사각형.
 · 박공 정면(k 'g', 용마루가 앞뒤): 지붕은 «옆선 수직 + 위·아래가 갈매기 모양» 띠이고 그 밑에 세모 박공벽.
 · 탑 뾰족지붕(k 's'): 정면에서 본 세모(좌우 대칭, 왼쪽 밝고 오른쪽 어둡다 — 옆면은 그리지 않는다). 옆선 수직 측정에서 뺀다.
 · 지붕 없음(k 'f'): 성벽 조각·축대처럼 윗면을 따로 얹는 것.
십자·ㄱ·ㅜ 지붕은 덩어리의 합이고, 지붕창은 처마 정면 지붕 위의 작은 박공 정면 덩어리다. 사다리꼴·모임지붕·옆면은 그리지 않는다.
"""
import json, pathlib
import numpy as np
from PIL import Image
HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
STORE = ROOT / "tiledata/beodeul-ref-buildings"
T = 16
def hx(c): return tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))
def ramps_of(style=None): return json.loads((STORE / "ramps.json").read_text(encoding="utf-8"))["ramps"]
def flatness(im):
    """오른쪽·아래 이웃과 같은 색인 화소의 몫(%)과 색 수 — 원본 버들항 집은 11~22%, 8% 아래는 잡음, 30% 위는 민무늬."""
    a = np.array(im.convert("RGBA")); op = a[:, :, 3] >= 200; rgb = a[:, :, :3].astype(int)
    same = (rgb[:-1, :-1] == rgb[:-1, 1:]).all(2) & (rgb[:-1, :-1] == rgb[1:, :-1]).all(2) & op[:-1, :-1]
    return 100.0 * same.sum() / max(1, int(op.sum())), len({tuple(p) for p in rgb[op]})
class Kit:
    # 지붕 재질(색 줄 이름) → 앞면 판 · (기와만) 왼·오른 물매 판 · frm: 그 판이 그려진 색 줄(다르면 같은 단으로 옮긴다) · fascia: 처마 끝 띠 색
    ROOFS = dict(roof=dict(face='shingle'), tile=dict(face='tile', l='tile-l', r='tile-r'), shake=dict(face='shingle', frm='roof', fascia=('trim:3', 'trim:1')), slate=dict(face='slate'),
                 tealroof=dict(face='shingle', frm='roof'))
    STONY = ('stone', 'fstone', 'ashlar', 'buff')
    def __init__(s, style='ref'):
        s.style = style; s.R = ramps_of(); s.P = {}; s.idx = {}; s.roofmat = 'roof'
        s.cfg = dict(frame=('plaster',), barge=('timber:5', 'timber:4', 'timber:3', 'timber:1'), corner=None)
        for r, cs in s.R.items():
            for i, c in enumerate(cs): s.idx.setdefault(hx(c), (r, i))
    ROOFED = ('ridge', 'eave', 'dormer', 'logdormer', 'win-shop')        # 지붕 색이 실린 부품 — 기와 집에서는 너와 색 줄을 기와 색 줄의 같은 단으로 옮긴다
    def part(s, name):
        ro = s.ROOFS[s.roofmat]; recol = (name in s.ROOFED and s.roofmat != 'roof') or (name == ro['face'] and bool(ro.get('frm')))
        key = (name, s.roofmat if recol else '')
        if key not in s.P:
            a = np.array(Image.open(STORE / 'parts' / f'{name}.png').convert('RGBA'))
            if recol:
                src = [hx(c) for c in s.R['roof']]; dst = [hx(c) for c in s.R[s.roofmat]]; out = a.copy()
                for i, c in enumerate(src): out[(a[:, :, :3] == c).all(2) & (a[:, :, 3] > 0), :3] = dst[min(i, len(dst) - 1)]
                a = out
            s.P[key] = a
        return s.P[key]
    def face(s): return s.ROOFS[s.roofmat]['face']
    def c(s, name):
        r, i = name.split(':'); r = s.roofmat if r == 'roof' else r; return hx(s.R[r][int(i)]) + (255,)
    def shifted(s, px, k):
        r, i = s.idx.get(tuple(int(v) for v in px[:3]), (None, 0))
        if r is None: return px
        cs = s.R[r]; return hx(cs[max(0, min(len(cs) - 1, i + k))]) + (255,)
    def shift(s, a, k, x0, y0, x1, y1, mask=None):
        """[x0,x1)×[y0,y1) 의 불투명 화소를 같은 색 줄 안에서 k 단 옮긴다(음수 = 어둡게)."""
        H, W = a.shape[:2]; lut = {}
        for y in range(max(0, y0), min(H, y1)):
            for x in range(max(0, x0), min(W, x1)):
                if a[y, x, 3] and (mask is None or mask[y, x]):
                    key = tuple(a[y, x]); 
                    if key not in lut: lut[key] = s.shifted(key, k)
                    a[y, x] = lut[key]
    def shift_floor(s, a, k, floor, x0, y0, x1, y1, mask=None):
        H, W = a.shape[:2]; lut = {}
        for y in range(max(0, y0), min(H, y1)):
            for x in range(max(0, x0), min(W, x1)):
                if a[y, x, 3] and (mask is None or mask[y, x]):
                    key = tuple(a[y, x])
                    if key not in lut:
                        r, i = s.idx.get(key[:3], (None, 0))
                        lut[key] = key if r is None else hx(s.R[r][0 if i < 2 else max(floor, i + k)]) + (255,)
                    a[y, x] = lut[key]
    def tile(s, name, w, h, ox=0, oy=0):
        t = s.part(name); th, tw = t.shape[:2]
        ys = (np.arange(h) + oy) % th; xs = (np.arange(w) + ox) % tw
        return t[ys][:, xs].copy()
    @staticmethod
    def put(a, src, x, y, mask=None):
        H, W = a.shape[:2]; h, w = src.shape[:2]
        x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
        if x1 <= x0 or y1 <= y0: return
        sub = src[y0 - y:y1 - y, x0 - x:x1 - x]; on = sub[:, :, 3] > 0
        if mask is not None: on &= mask[y0:y1, x0:x1]
        a[y0:y1, x0:x1][on] = sub[on]
    def px(s, a, x, y, name):
        if 0 <= y < a.shape[0] and 0 <= x < a.shape[1]: a[y, x] = s.c(name)
    def hline(s, a, x0, x1, y, name):
        for x in range(x0, x1): s.px(a, x, y, name)
    def vline(s, a, x, y0, y1, name):
        for y in range(y0, y1): s.px(a, x, y, name)
    def line(s, a, x0, y0, x1, y1, names, mask=None):
        """굵기 len(names) 의 비스듬한 부재(위에서 아래로 names 순서)."""
        n = max(abs(x1 - x0), abs(y1 - y0)) or 1
        for i in range(n + 1):
            x = round(x0 + (x1 - x0) * i / n); y = round(y0 + (y1 - y0) * i / n)
            for j, nm in enumerate(names):
                if mask is None or (0 <= y + j < a.shape[0] and 0 <= x < a.shape[1] and mask[y + j, x]): s.px(a, x, y + j, nm)
    # ── 벽 ──────────────────────────────────────────────────────────────
    def wall(s, a, x0, y0, w, h, mat, mask=None):
        tex = s.tile(mat, w, h, ox=x0 * 5 + y0 * 3, oy=y0 * 7 + x0)
        s.put(a, tex, x0, y0, mask)
    def beam(s, a, x0, y, w, th=4, mask=None):
        b = s.tile('beam', w, 5, ox=x0 * 3 + y)[[0, 1, 3, 4] if th == 4 else [0, 2, 4] if th == 3 else [0, 1, 2, 3, 4]]
        s.put(a, b, x0, y, mask)
    def post(s, a, x, y0, h, th=3, mask=None):
        b = s.tile('beam', h, 5, ox=x * 5 + y0)[[0, 2, 4] if th == 3 else [0, 1, 3, 4]]
        s.put(a, np.rot90(b, 1)[::-1].copy(), x, y0, mask)   # 윗변(빛) → 왼쪽
    def footing(s, a, x0, x1, y):
        """벽 밑동 두 줄 — 버들항 중세 집과 같은 회색 돌 줄 + 어두운 줄."""
        for x in range(x0, x1):
            s.px(a, x, y, 'iron:7' if (x * 7 + y) % 11 == 0 else 'iron:3' if (x * 5) % 13 == 0 else 'iron:5'); s.px(a, x, y + 1, 'iron:2' if (x * 3) % 9 == 0 else 'iron:1')
    # ── 지붕 ────────────────────────────────────────────────────────────
    def eave_roof(s, a, x0, w, ytop, rh, back=3):
        """처마 정면 지붕(용마루 좌우): 직사각형 [x0, x0+w) × [ytop, ytop+rh) + 그 아래 처마 끝 2줄 그늘. 위에서 back 줄은 뒤 물매, 그 밑이 용마루."""
        f = s.tile(s.face(), w, rh, ox=x0 * 3, oy=ytop * 4); s.put(a, f, x0, ytop)
        if back: s.shift(a, -1, x0, ytop, x0 + w, ytop + back)
        s.put(a, s.tile('ridge', w, 6, ox=x0 * 3), x0, ytop + back)
        third = max(3, (rh - back - 6) // 3)
        if not s.ROOFS[s.roofmat].get('l'): s.shift(a, +1, x0, ytop + back + 6, x0 + w, ytop + back + 6 + third)          # 용마루 쪽이 밝다(기와는 원본처럼 처마 쪽만 어둡게)
        else: s.shift(a, -1, x0, ytop + rh - 6 - third // 2, x0 + w, ytop + rh - 3)
        ev = s.tile('eave', w, 8, ox=x0 * 3); body = ev[:6]; s.put(a, body, x0, ytop + rh - 6)
        s.shift(a, -1, x0, ytop + rh - 3, x0 + w, ytop + rh)
        s.vline(a, x0, ytop, ytop + rh - 1, 'roof:5'); s.shift(a, -1, x0 + w - 3, ytop, x0 + w, ytop + rh)
        s.vline(a, x0 + w - 1, ytop, ytop + rh, 'roof:0'); s.hline(a, x0, x0 + w, ytop, 'roof:1')
        fa = s.ROOFS[s.roofmat].get('fascia')
        if fa:                                                                         # 처마 끝 칠한 띠(통나무 집의 풀빛 띠)
            s.hline(a, x0 + 1, x0 + w - 1, ytop + rh - 2, fa[0]); s.hline(a, x0 + 1, x0 + w - 1, ytop + rh - 1, fa[1])
        s.hline(a, x0 + 1, x0 + w - 1, ytop + rh, 'roof:0')                           # 처마 밑줄
    def gable_shape(s, x0, w, ye, rd, rise):
        """박공 정면 지붕의 열마다 (위, 아래) — 옆선 수직, 위·아래 갈매기 모양. ye = 옆 처마 끝 줄."""
        cx = x0 + (w - 1) / 2.0; half = (w - 1) / 2.0; out = {}
        for x in range(x0, x0 + w):
            drop = round(rise * abs(x - cx) / half); bot = ye - rise + drop; out[x] = (bot - rd, bot)
        return out
    def gable_roof(s, a, x0, w, ye, rd, rise, barge=True):
        sh = s.gable_shape(x0, w, ye, rd, rise); cx = x0 + w // 2; y00 = ye - rise - rd; fh = rd + rise + 2
        # 용마루선 기준 왼 물매는 빛, 오른 물매는 그늘(빛은 왼쪽 위). 기와는 원본의 왼·오른 물매 무늬를 그대로, 너와는 같은 판을 색 줄 안에서 옮긴다.
        alt = s.ROOFS[s.roofmat]; tile = bool(alt.get('l'))     # 왼·오른 물매 판이 따로 있는 지붕(원본 붉은 기와)
        fl = s.tile(alt['l'] if tile else s.face(), w, fh, ox=0, oy=ye * 4); fr = s.tile(alt['r'] if tile else s.face(), w, fh, ox=0, oy=ye * 4)
        for x, (t, b) in sh.items():
            src = fl if x < cx else fr
            for y in range(max(0, t), min(a.shape[0], b)):
                if 0 <= x < a.shape[1]: a[y, x] = src[(y - y00) % fh, x - x0]
        m = np.zeros(a.shape[:2], bool)
        for x, (t, b) in sh.items():
            if 0 <= x < a.shape[1]: m[max(0, t):max(0, b), x] = True
        if not tile:
            s.shift(a, +1, x0, 0, cx - 1, a.shape[0], m); s.shift_floor(a, -1, 1, cx + 1, 0, x0 + w, a.shape[0], m)   # 오른 물매 한 단만 — 두 단이면 낱장이 묻힌다
            s.shift(a, -1, x0, 0, x0 + 5, a.shape[0], m); s.shift_floor(a, -1, 1, x0 + w - 5, 0, x0 + w, a.shape[0], m)      # 옆 처마 쪽
        else:
            s.shift(a, -1, x0 + w - 5, 0, x0 + w, a.shape[0], m)
        for x, (t, b) in sh.items():
            s.px(a, x, t, 'roof:1' if x >= cx else 'roof:5')                                              # 뒤쪽 끝 줄
            if barge:                                                                                    # 박공널(앞 끝) 3줄
                bg = s.cfg['barge']; s.px(a, x, b - 3, bg[0] if x < cx else bg[1]); s.px(a, x, b - 2, bg[1] if x < cx else bg[2]); s.px(a, x, b - 1, bg[3])
        t0, b0 = sh[cx]
        for y in range(t0, b0 - 3):                                                                       # 용마루(앞뒤로 달린다)
            s.px(a, cx - 1, y, 'roof:6' if y % 6 < 4 else 'roof:5'); s.px(a, cx, y, 'roof:4' if y % 6 < 5 else 'roof:1'); s.px(a, cx + 1, y, 'roof:0')
        t, b = sh[x0]; s.vline(a, x0, t, b, 'roof:5'); t, b = sh[x0 + w - 1]; s.vline(a, x0 + w - 1, t, b, 'roof:0')
        return sh
    def spire(s, a, x0, w, ye, sh, rec):
        """탑 뾰족지붕: 정면에서 본 세모 — 밑변 [x0, x0+w) 이 줄 ye-1, 꼭짓점이 줄 ye-sh. 왼쪽 반은 한 단 밝고 오른쪽 반은 한 단 어둡다."""
        cx2 = 2 * x0 + w - 1; f = s.tile(s.face(), w, sh, ox=x0 * 3, oy=ye * 4); m = np.zeros(a.shape[:2], bool); spans = {}
        for r in range(sh):
            y = ye - sh + r; half = (w / 2.0) * (r + 1) / sh; xl = int(round((cx2 + 1) / 2.0 - half)); xr = int(round((cx2 + 1) / 2.0 + half)) - 1
            xl = max(x0, xl); xr = min(x0 + w - 1, xr)
            if xr < xl or not (0 <= y < a.shape[0]): continue
            spans[y] = (xl, xr)
            for x in range(xl, xr + 1):
                if 0 <= x < a.shape[1]: a[y, x] = f[r, x - x0]; m[y, x] = True
        mid = (cx2 + 1) // 2
        s.shift(a, +1, x0, 0, mid - 1, a.shape[0], m); s.shift_floor(a, -1, 1, mid + 1, 0, x0 + w, a.shape[0], m)
        for y, (xl, xr) in spans.items():
            s.px(a, xl, y, 'roof:5'); s.px(a, xr, y, 'roof:0')
            if xr - xl >= 4: s.px(a, mid - 1, y, 'roof:6' if y % 5 < 3 else 'roof:5'); s.px(a, mid, y, 'roof:1')
        s.shift(a, -1, x0, ye - 3, x0 + w, ye, m); s.hline(a, x0, x0 + w, ye - 1, 'roof:0'); s.hline(a, x0 + 1, x0 + w - 1, ye, 'roof:0')
        ya = min(spans); s.px(a, mid - 1, ya - 1, 'iron:6'); s.px(a, mid - 1, ya - 2, 'iron:7'); s.px(a, mid - 1, ya - 3, 'accent:4')      # 꼭대기 쇠 장식
        rec['roofs'].append(dict(k='s', x0=x0, x1=x0 + w - 1, side=(ye - 2, ye), mask=m, wall_top=ye))
    def shade_under(s, a, x0, x1, y, rows=3, mask=None):
        """돌출한 것(처마·들보·발코니) 바로 밑 벽의 그늘 띠: 첫 줄 두 단, 나머지 한 단 어둡게."""
        s.shift(a, -2, x0, y, x1, y + 1, mask); s.shift(a, -1, x0, y + 1, x1, y + rows, mask)
    # ── 덩어리 ──────────────────────────────────────────────────────────
    def volume(s, a, v, H, rec):
        """v: k 'e'|'g' · x,w(벽 px) · floors [(재질, 높이)…] 아래층부터 · base(벽 밑, 기본 H-2) · ov(지붕 옆 내밂) ·
        e: rh(지붕 높이) back · g: rd(지붕 띠 두께) rise(박공 높이) · posts [x…] braces [(x0,x1,방향)] · frame False 면 목골 없음."""
        x, w = v['x'], v['w']; base = v.get('base', H - 2); ov = v.get('ov', 2); y = base; bands = []
        for mat, fh in v['floors']: bands.append((mat, y - fh, y)); y -= fh
        top = y; m = np.zeros(a.shape[:2], bool)
        for i, (mat, y0, y1) in enumerate(bands):
            inset = 1 if (mat in s.STONY and i == 0 and len(bands) > 1 and v.get('inset', True)) else 0
            s.wall(a, x + inset, y0, w - 2 * inset, y1 - y0, mat)
            framed = mat in s.cfg['frame'] and v.get('frame', True)
            if not framed:   # 목골이 없는 벽은 오른쪽 끝 넉 줄을 한 단 어둡게(빛은 왼쪽 위) — 모서리 널이 있는 양식은 그 널이 끝을 맺는다
                s.shift(a, -1, x + w - 4 - inset, y0, x + w - inset, y1)
                if mat in s.STONY: s.vline(a, x + w - 1 - inset, y0, y1, 'stone:1' if mat == 'stone' else 'iron:1')
                if s.cfg['corner'] and mat not in s.STONY:
                    cn = s.cfg['corner']
                    for i, nm in enumerate(cn): s.vline(a, x + i, y0, y1, nm); s.vline(a, x + w - len(cn) + i, y0, y1, nm)
            if mat in s.cfg['frame'] and v.get('frame', True):
                s.beam(a, x, y0, w, 4); s.beam(a, x, y1 - (5 if i > 0 else 4), w, 5 if i > 0 else 4)
                for px_ in [x, x + w - 3] + [x + p for p in v.get('posts', {}).get(i, [])]: s.post(a, px_, y0, y1 - y0, 3)
                for (bx0, bx1, d) in v.get('braces', {}).get(i, []):
                    ya, yb = y0 + 4, y1 - 6
                    s.line(a, x + (bx0 if d > 0 else bx1), ya, x + (bx1 if d > 0 else bx0), yb, ['timber:5', 'timber:3', 'timber:1'])
            if i > 0: s.shade_under(a, x, x + w, y1, 2)                       # 위층 들보 밑 그늘(아래층 벽 윗줄)
        if v.get('foot', True): s.footing(a, x, x + w, base)
        if v['k'] == 'f': pass
        elif v['k'] == 's': s.spire(a, x - ov, w + 2 * ov, top + 2, v['sh'], rec)
        elif v['k'] == 'e':
            rh = v['rh']; ry = top - rh + 3
            s.shade_under(a, x, x + w, top + 3, 3)
            before = a[:, :, 3].copy(); s.eave_roof(a, x - ov, w + 2 * ov, ry, rh, v.get('back', 3))
            rm = np.zeros(a.shape[:2], bool); rm[max(0, ry):ry + rh, max(0, x - ov):x + w + ov] = True
            rec['roofs'].append(dict(k='e', x0=x - ov, x1=x + w + ov - 1, side=(ry, ry + rh), mask=rm, wall_top=top + 3))
        else:
            rd, rise = v['rd'], v['rise']; ye = top + 2; sh = s.gable_shape(x - ov, w + 2 * ov, ye, rd, rise); mat = v.get('gable', v['floors'][-1][0])
            for xx, (t, b) in sh.items():
                if 0 <= xx < a.shape[1] and x <= xx < x + w: m[b:top, xx] = True
            s.wall(a, x, top - rise - 2, w, rise + 2, mat, m)
            if mat in s.cfg['frame'] and v.get('frame', True):
                cx = x + w // 2
                s.post(a, cx - 1, top - rise, rise, 3, m)                                   # 왕대공
                q = w // 4
                s.line(a, cx - q, top - 1, cx - 2, top - rise // 2 - 1, ['timber:5', 'timber:3', 'timber:1'], m)
                s.line(a, cx + q, top - 1, cx + 2, top - rise // 2 - 1, ['timber:5', 'timber:3', 'timber:1'], m)
            s.gable_roof(a, x - ov, w + 2 * ov, ye, rd, rise)
            for xx, (t, b) in sh.items():
                if x <= xx < x + w: s.shade_under(a, xx, xx + 1, b, 3)
            rm = np.zeros(a.shape[:2], bool)
            for xx, (t, b) in sh.items():
                if 0 <= xx < a.shape[1]: rm[max(0, t):b, xx] = True
            rec['roofs'].append(dict(k='g', x0=x - ov, x1=x + w + ov - 1, side=(sh[x - ov][0], ye), mask=rm, wall_top=ye))
        rec['walls'].append((x, top if v['k'] == 'e' else top, x + w, base + 2))
    # ── 붙는 것 ─────────────────────────────────────────────────────────
    def feat(s, a, f, H):
        """f: (부품, x, 밑 y[, 옵션]) — 밑 y 는 부품 맨 아랫줄 다음 줄. 옵션: crop (x0,y0,x1,y1) · w 이어 붙일 폭 · flip · dark 어둡게 한 단."""
        name, x, yb = f[0], f[1], f[2]; o = f[3] if len(f) > 3 else {}
        p = s.part(name)
        if 'w' in o: p = s.tile(name, o['w'], p.shape[0], ox=o.get('ox', 0))
        if 'crop' in o: x0, y0, x1, y1 = o['crop']; p = p[y0:y1, x0:x1]
        if o.get('flip'): p = p[:, ::-1]
        y = yb - p.shape[0]; s.put(a, p.copy(), x, y)
        if o.get('shade', name.startswith(('balcony', 'win-shop'))): s.shade_under(a, x + 1, x + p.shape[1] - 1, yb - (2 if name == 'balcony' else 0), 2)
def assemble(kit, h):
    """h: dict(w, h(칸), vols, feats) → (본체 RGBA, 기록)."""
    W, H = h['w'] * T, h['h'] * T; a = np.zeros((H, W, 4), np.uint8); rec = dict(roofs=[], walls=[]); kit.roofmat = h.get('roof', 'roof')
    for v in h.get('vols', []):
        kit.roofmat = v.get('roof', h.get('roof', 'roof')); kit.volume(a, v, H, rec)
        for f in v.get('feats', []): kit.feat(a, f, H)
    kit.roofmat = h.get('roof', 'roof')
    for f in h.get('feats', []): kit.feat(a, f, H)
    return a, rec
def measure(a, rec):
    """지붕 덩어리마다 옆선 수직 편차(px): 옆선 구간 줄들에서 그 덩어리 지붕 화소의 맨 왼쪽·맨 오른쪽 x 의 흩어짐."""
    worst = 0
    for r in rec['roofs']:
        if r['k'] == 's': continue
        y0, y1 = r['side']; ls, rs = [], []
        for y in range(max(0, y0), min(a.shape[0], y1)):
            xs = np.nonzero(r['mask'][y])[0]
            if len(xs): ls.append(int(xs.min())); rs.append(int(xs.max()))
        if ls: worst = max(worst, max(ls) - min(ls), max(rs) - min(rs))
    return worst
def blocked_cells(a, rec, hc, wc):
    """막힌 칸: 벽이 실린 칸(벽 사각형이 칸 높이의 절반 넘게 덮는 칸) — 열마다 맨 아래 불투명 칸은 늘 막힌다. 나머지(지붕·처마)는 사람 위로 그려지는 통행 칸."""
    blk = set()
    for cy in range(hc):
        for cx in range(wc):
            cell = a[cy * T:(cy + 1) * T, cx * T:(cx + 1) * T, 3]
            if not cell.any(): continue
            cover = 0
            for (x0, y0, x1, y1) in rec['walls']:
                ox = max(0, min(x1, (cx + 1) * T) - max(x0, cx * T)); oy = max(0, min(y1, (cy + 1) * T) - max(y0, cy * T)); cover = max(cover, ox * oy)
            if cover >= T * T * 0.5: blk.add((cx, cy))
    for cx in range(wc):
        ys = [cy for cy in range(hc) if a[cy * T:(cy + 1) * T, cx * T:(cx + 1) * T, 3].any()]
        if ys: blk.add((cx, max(ys)))
    return sorted(blk)
def footrow(a, blocked):
    """기초 줄: 막힌 칸 열의 맨 아랫줄 밑동에 흙빛 낱줄(집 양식의 기초 그림과 같은 화소 규칙)을 본체 안에 찍는다 — 본체 한 장만으로 선다."""
    hc, wc = a.shape[0] // T, a.shape[1] // T; blk = set(map(tuple, blocked))
    for cx in range(wc):
        ys = [y for y in range(hc) if (cx, y) in blk]
        if not ys: continue
        foot = (max(ys) + 1) * T - 1
        for xx in range(cx * T, (cx + 1) * T):
            if a[foot, xx, 3] and xx % 5 != 0: a[foot, xx] = hx('#8b7650') + (255,)
def cover(rects, cx, cy):
    return max([max(0, min(x1, (cx + 1) * T) - max(x0, cx * T)) * max(0, min(y1, (cy + 1) * T) - max(y0, cy * T)) for (x0, y0, x1, y1) in rects] or [0])
def build(names=None):
    """건물들을 조립한다 → {이름: dict(im, blocked, door, passage, side 옆선 편차, flat, cols, spec)}. types.json 의 칸 크기·문 칸을 지킨다.
    조립 순서의 열쇠: vols · feats · roof · door(문 부품 이름 또는 (부품, x, 밑 y, 옵션), None 이면 문 없음) · block [(x0,y0,x1,y1)…] 막힌 곳을 더한다 · blockonly True 면 block 만으로 막는다(덩어리 없는 구조물)."""
    import importlib, sys
    if str(HERE) not in sys.path: sys.path.insert(0, str(HERE))
    spec = {t['name']: t for t in json.loads((STORE / 'types.json').read_text(encoding='utf-8'))['types']}
    RS = importlib.import_module('recipes').R(); kit = Kit(); out = {}
    for n in (names or [n for n in spec if n in RS]):
        sp = spec[n]; r = dict(RS[n]); r['w'], r['h'] = sp['w'], sp['h']; feats = list(r.get('feats', [])); passage = [tuple(c) for c in sp.get('passage', [])]
        if sp.get('door') and not passage and r.get('door', 'door'):
            dx, dy = sp['door']; assert dy == sp['h'] - 1, n
            door = r.get('door', 'door'); feats.append(door if isinstance(door, tuple) else (door, dx * T, r['h'] * T, dict(shade=False)))
        r['feats'] = feats
        a, rec = assemble(kit, r)
        if r.get('blockonly'): rec['walls'] = []
        rec['walls'] += [tuple(b) for b in r.get('block', [])]
        if r.get('blockonly'): blocked = {(cx, cy) for cy in range(r['h']) for cx in range(r['w']) if cover(rec['walls'], cx, cy) >= T * T * 0.5 and a[cy * T:(cy + 1) * T, cx * T:(cx + 1) * T, 3].any()}
        else: blocked = set(map(tuple, blocked_cells(a, rec, r['h'], r['w'])))
        for c in passage: blocked.discard(c)
        if sp.get('door') and not passage:
            dx, dy = sp['door']
            for xx in range(dx, dx + sp.get('doorw', 1)):
                for y in (dy - 1, dy):
                    assert a[y * T:(y + 1) * T, xx * T:(xx + 1) * T, 3].any(), f'{n}: 문 칸 ({xx},{y}) 이 비었다'
                    blocked.add((xx, y))
        for (cx, cy) in passage:
            al = a[cy * T:(cy + 1) * T, cx * T:(cx + 1) * T, 3]; assert (al == 255).all() or not al.any(), f'{n}: 지나가는 칸 ({cx},{cy}) 은 빈 칸이거나 빈 화소 없는 바닥 그림이어야 한다(바닥 그림은 아래층에 깐다)'
        blocked = sorted(blocked); footrow(a, blocked)
        im = Image.fromarray(a, 'RGBA'); fl, cols = flatness(im)
        out[n] = dict(im=im, blocked=[list(b) for b in blocked], door=sp.get('door'), passage=[list(c) for c in passage], side=measure(a, rec), flat=fl, cols=cols, spec=sp,
                      roofs=[r_['k'] for r_ in rec['roofs']], roof=r.get('roof', 'roof'))
    return out
