# 버들항 웨이브 B — 공용 그리기·조각 등록·오토타일·시각 페이지 도우미 (graveyard-crypt 와 dark-fortress 가 같이 쓴다).
# 모두 손 도트(Pillow). 버들항 7단 램프(ST 돌·LF 잎·WD 나무)와 pz.fin 윤곽을 그대로 쓴다. 3/4 시점, 빛 왼쪽 위, 1칸=16px.
import os, sys, json, math, base64, io
HERE = os.path.dirname(os.path.abspath(__file__))
VAR = os.path.abspath(os.path.join(HERE, '..'))
sys.path.insert(0, os.path.join(VAR, '_lib3'))
from dlib import *                    # noqa  (T, ST, LF, WD, RD, GD, PL, DK, Cv, new, mk, mix, mul, Map, FLOORS …)
import dlib
from dlib import _hash, vnoise
HERE = os.path.dirname(os.path.abspath(__file__))     # dlib 의 HERE(= _lib3) 로 덮어씌워지지 않게 다시 고정
import dprops as D
from PIL import Image, ImageDraw

IRON = D.IRON; FL = D.FL; BONE = D.BONE
slab = D.slab; cyl = D.cyl; shadow = D.shadow; glow = D.glow

def clamp(k, lo=1, hi=6): return max(lo, min(hi, k))
def rampc(r, k): return r[clamp(k, 0, len(r) - 1)]

# ------------------------------------------------------------------ 도형 마스크
class Mk:
    """작은 마스크 캔버스. rect/ell/poly 로 칠하고 vol() 로 입체 음영을 입힌다."""
    def __init__(s, w, h): s.w, s.h = w, h; s.im = Image.new('L', (w, h), 0); s.d = ImageDraw.Draw(s.im)
    def rect(s, x0, y0, x1, y1, v=255): s.d.rectangle((x0, y0, x1 - 1, y1 - 1), fill=v); return s
    def ell(s, cx, cy, rx, ry, v=255):
        for y in range(s.h):
            for x in range(s.w):
                if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1: s.im.putpixel((x, y), v)
        return s
    def poly(s, pts, v=255): s.d.polygon(pts, fill=v); return s
    def at(s, x, y): return 0 <= x < s.w and 0 <= y < s.h and s.im.getpixel((x, y)) > 0
    def sub(s, o):
        for y in range(s.h):
            for x in range(s.w):
                if o.at(x, y): s.im.putpixel((x, y), 0)
        return s

def vol(cv, mk, ramp, x0=None, x1=None, base=4, seed=0, grain=.07, rim=True, ox=0, oy=0):
    """마스크 안을 3/4 음영으로 칠한다: 왼쪽 밝고 오른쪽 어둡다. 위 가장자리 +1, 아래 가장자리 -1."""
    xs = [x for y in range(mk.h) for x in range(mk.w) if mk.at(x, y)]
    if not xs: return
    x0 = min(xs) if x0 is None else x0; x1 = max(xs) + 1 if x1 is None else x1
    wd = max(1, x1 - x0)
    for y in range(mk.h):
        for x in range(mk.w):
            if not mk.at(x, y): continue
            t = (x - x0) / wd; k = base
            if t < .22: k += 1
            elif t > .86: k -= 2
            elif t > .62: k -= 1
            if rim:
                if not mk.at(x, y - 1): k += 1
                elif not mk.at(x, y + 1): k -= 1
            if _hash(x + ox, y + oy, seed + 5) < grain: k += 1 if _hash(y, x, seed + 6) < .5 else -1
            cv.px(x, y, ramp[clamp(k, 1, len(ramp) - 1)])

def pad16(im, anchor='bl'):
    w = -(-im.width // T) * T; h = -(-im.height // T) * T
    if (w, h) == im.size: return im
    o = new(w, h); o.alpha_composite(im, (0, h - im.height)); return o

def fin(cv_or_im, k=.62):
    im = cv_or_im if isinstance(cv_or_im, Image.Image) else cv_or_im.im
    return pz.fin(im, k)

def shadow_under(im, cx, cy, rx, ry, a=70):
    return D.shadow(im, cx, cy, rx, ry, a)

# ------------------------------------------------------------------ 주기 잡음(표본이 3x3 으로 이어 붙게)
def pn(X, Y, sc, seed, period=48):
    return vnoise(X, Y, sc, seed, per=int(period / sc))

# ------------------------------------------------------------------ 조각 등록
class Kit:
    def __init__(s, slug, title):
        s.slug = slug; s.title = title; s.dir = os.path.join(VAR, slug); s.parts = {}; s.meta = {}; s.order = []
        os.makedirs(os.path.join(s.dir, 'parts'), exist_ok=True)
    def add(s, name, img, kind, ko, desc, rules, brows=0, layer=None, role=None):
        img = pad16(img) if img.width % T or img.height % T else img
        s.parts[name] = img; s.order.append(name)
        m = dict(kind=kind, ko=ko, desc=desc, rules=rules, brows=brows)
        if layer: m['layer'] = layer
        if role: m['role'] = role
        s.meta[name] = m; return img
    def save(s):
        pdir = os.path.join(s.dir, 'parts')
        for f in os.listdir(pdir):
            if f.endswith('.png') and f[:-4] not in s.parts: os.remove(os.path.join(pdir, f))
        for n, im in s.parts.items(): im.save(os.path.join(pdir, n + '.png'))
        json.dump(s.meta, open(os.path.join(s.dir, 'partmeta.json'), 'w'), ensure_ascii=False, indent=1)
        with open(os.path.join(s.dir, 'parts.md'), 'w') as f:
            f.write('# %s — 새 조각\n\n손 도트(Pillow, 버들항 7단 램프·pz.fin 윤곽)로 새로 그린 조각만 적는다. 칸 = 16px.\n\n' % s.title)
            for n in s.order:
                im = s.parts[n]; m = s.meta[n]
                f.write('- `parts/%s.png` (%dx%d px) — %s: %s / %dx%d칸\n' % (n, im.width, im.height, m['ko'], m['desc'], im.width // T, im.height // T))
            f.write('\n합계 **%d** 종.\n' % len(s.order))
        return len(s.order)

# ------------------------------------------------------------------ 오토타일 (4x4, 번호 = N1+E2+S4+W8)
def _pn1(i, seed, period=16):
    # 주기 period 인 1차원 값 잡음 0..1 (격자 간격 4)
    g = period // 4; f = (i % period) / 4.0; i0 = int(f); t = f - i0; t = t * t * (3 - 2 * t)
    a = _hash(i0 % g, 0, seed); b = _hash((i0 + 1) % g, 0, seed)
    return a * (1 - t) + b * t

def autotile_sheet(cellfn):
    """cellfn(mask:int, N,E,S,W:bool) -> 16x16 RGBA. 4x4 시트(64x64): 칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8."""
    sh = new(64, 64)
    for m in range(16):
        N, E, S, W = bool(m & 1), bool(m & 2), bool(m & 4), bool(m & 8)
        sh.alpha_composite(cellfn(m, N, E, S, W), (m % 4 * T, m // 4 * T))
    return sh

def edge_overlay(inner, border=None, amp=2, base=2, seed=1, shade=None):
    """이웃이 없는 쪽을 들쭉날쭉하게 깎는 면 오토타일. inner(x,y)->RGB(전역 주기 16 무늬), border(depth)->RGB 가장자리 띠(없으면 안쪽 그대로)."""
    def cell(m, N, E, S, W):
        im = new(); p = im.load()
        for y in range(T):
            for x in range(T):
                dep = 99
                if not W: e = base + int(round(amp * _pn1(y, seed + 1))); dep = min(dep, x - e)
                if not E: e = base + int(round(amp * _pn1(y, seed + 2))); dep = min(dep, 15 - x - e)
                if not N: e = base + int(round(amp * _pn1(x, seed + 3))); dep = min(dep, y - e)
                if not S: e = base + int(round(amp * _pn1(x, seed + 4))); dep = min(dep, 15 - y - e)
                if dep < 0: continue
                c = inner(x, y)
                if border is not None and dep < 99:
                    b = border(dep)
                    if b is not None: c = b
                p[x, y] = tuple(c[:3]) + (255,)
        return im
    return autotile_sheet(cell)

# ------------------------------------------------------------------ 시각 도우미
def png_uri(im, scale=1):
    if scale != 1: im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    b = io.BytesIO(); im.convert('RGBA').save(b, 'PNG'); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()

def board(items, cols=6, scale=3, bg=(48, 56, 44, 255), label=True, pad=8):
    """items = [(이름, 이미지)] 을 번호 붙여 판 한 장으로."""
    from PIL import ImageFont
    cw = max(i.width for _, i in items) * scale + pad; ch = max(i.height for _, i in items) * scale + pad + 12
    rows = (len(items) + cols - 1) // cols
    bd = Image.new('RGBA', (cols * cw, rows * ch), (28, 30, 34, 255)); d = ImageDraw.Draw(bd)
    for k, (n, im) in enumerate(items):
        x = k % cols * cw + pad // 2; y = k // cols * ch + pad // 2
        d.rectangle((x - 1, y - 1, x + im.width * scale, y + im.height * scale), fill=bg)
        bd.alpha_composite(im.resize((im.width * scale, im.height * scale), Image.NEAREST), (x, y))
        d.text((x, y + im.height * scale + 1), '%d %s' % (k + 1, n[:int(cw / 6)]), fill=(214, 218, 226, 255))
    return bd

def save_png(im, path): im.save(path)
