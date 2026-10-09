# 하늘 도시·부유섬 (sky-city) 공용 바탕: 버들항 파이프라인(scripts/content/lib/city_v6)을 그대로 부르고,
# 새 재질(구름 바다·구름 길·하늘)만 버들항 7단 램프 규칙(0=윤곽, 1~6 명암)으로 더한다. 공용 라이브러리는 읽기만 한다.
import os, sys, json, math, random
HERE = os.path.dirname(os.path.abspath(__file__))
VAR = os.path.abspath(os.path.join(HERE, '..'))
ROOT = os.path.abspath(os.path.join(VAR, '..', '..'))
for p in (HERE, os.path.join(VAR, '_lib-5'), VAR):
    if p not in sys.path: sys.path.insert(0, p)
import numpy as np
from PIL import Image, ImageDraw
import bd5                                   # palette.apply + city_v6 경로
from bd5 import _hash
import terrain, roman, castle6 as C6, pz, px2, palette, terrain7, ground
from px2 import vnoise, PAL
from roman import ST, TRV, CRM, WDr, mul, mix
T = 16

def hx(s): s = s.lstrip('#'); return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))
def rp(name): return [hx(c) for c in PAL[name]]

SL = C6.SL                     # 버들항 성 지붕 슬레이트(푸른 보라)
GOLD = C6.GOLD
WD = terrain.WD
LF = [hx('#071528')] + [hx(c) for c in palette.RAMPS_CHIP['leaf']]
ROPE = rp('rope'); DIRT = rp('dirt'); CRY = rp('cryst'); IRON = rp('iron'); BONE = rp('bone')

# ---- 새 램프(7단): 구름 바다 / 구름 길 / 구름 아래 깊은 하늘 ----
# 구름: 윗면 흰빛 → 아랫면 라벤더 그늘, 윤곽은 짙은 쪽빛(버들항 윤곽처럼 색 윤곽).
CL = [hx(c) for c in ('#3c4478', '#6a74a8', '#8e9ac6', '#b0bcde', '#d0daee', '#eaf0f8', '#ffffff')]
# 구름 길: 다져진 구름 — 같은 구조에 살짝 따뜻한 상아빛(밟는 곳이 다르게 읽히도록), 윤곽 보랏빛.
CP = [hx(c) for c in ('#4a3e6a', '#7e7298', '#a49cba', '#c8c0d4', '#e2dce6', '#f4f0ee', '#fffcf4')]
# 구름 사이로 보이는 저 아래 하늘(탑 내부 발코니 하늘과 같은 밝기대).
SK = [hx(c) for c in ('#2c4a86', '#4c70b0', '#6c8fc8', '#8eaedc', '#acc6e8', '#c6daf0', '#e2ecf8')]

def dither(a, b, X, Y, t):
    """두 색 사이 t(0..1) 체크 디더(손 도트 경계)."""
    if t <= 0.25: return a
    if t >= 0.75: return b
    return b if (X + Y) % 2 == 0 else a

def new(w, h): return Image.new('RGBA', (w, h), (0, 0, 0, 0))

def autotile_sheet(cellfn):
    """cellfn(m, N, E, S, W) -> 16x16 RGBA. 64x64 시트, 칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8."""
    sh = new(64, 64)
    for m in range(16):
        N, E, S, W = bool(m & 1), bool(m & 2), bool(m & 4), bool(m & 8)
        sh.alpha_composite(cellfn(m, N, E, S, W), (m % 4 * T, m // 4 * T))
    return sh
def at_cell(sheet, m): return sheet.crop((m % 4 * T, m // 4 * T, m % 4 * T + T, m // 4 * T + T))
def at_paint(img, sheet, mask, ox=0, oy=0):
    H = len(mask); W = len(mask[0])
    g = lambda x, y: 0 <= x < W and 0 <= y < H and bool(mask[y][x])
    for y in range(H):
        for x in range(W):
            if mask[y][x]:
                m = g(x, y - 1) * 1 + g(x + 1, y) * 2 + g(x, y + 1) * 4 + g(x - 1, y) * 8
                img.alpha_composite(at_cell(sheet, m), (ox + x * T, oy + y * T))

def pad16(im):
    w, h = im.size; W = (w + 15) // 16 * 16; H = (h + 15) // 16 * 16
    if (W, H) == (w, h): return im
    o = new(W, H); o.alpha_composite(im, (0, H - h)); return o

class Parts:
    """parts/*.png + partmeta.json + parts.md (앞 장소들과 같은 형식)."""
    def __init__(s, outdir):
        s.out = outdir; s.dir = os.path.join(outdir, 'parts'); os.makedirs(s.dir, exist_ok=True)
        for f in os.listdir(s.dir):
            if f.endswith('.png'): os.remove(os.path.join(s.dir, f))
        s.meta = {}; s.imgs = {}; s.order = []
    def add(s, name, im, kind, ko, desc, rules, brows=None, layer=None, role=None, pad=True):
        im = pad16(im.convert('RGBA')) if pad else im.convert('RGBA')
        assert im.width % 16 == 0 and im.height % 16 == 0, name
        s.imgs[name] = im; s.order.append(name)
        m = {'kind': kind, 'ko': ko, 'desc': desc, 'rules': rules}
        if brows is not None: m['brows'] = brows
        if layer: m['layer'] = layer
        if role: m['role'] = role
        s.meta[name] = m
        im.save(os.path.join(s.dir, name + '.png'))
        return im
    def finish(s, title):
        json.dump(s.meta, open(os.path.join(s.out, 'partmeta.json'), 'w'), ensure_ascii=False, indent=1)
        lines = ['# 새로 찍은 조각 — %s\n' % title]
        for n in s.order:
            im = s.imgs[n]; m = s.meta[n]
            lines.append('- `parts/%s.png` (%dx%d px) — %s / %dx%d칸' % (n, im.width, im.height, m['ko'] + ': ' + m['desc'], im.width // 16, im.height // 16))
        kinds = {}
        for n in s.order: kinds[s.meta[n]['kind']] = kinds.get(s.meta[n]['kind'], 0) + 1
        lines.append('\n합계: %d 조각 (%s)' % (len(s.order), ', '.join('%s %d' % kv for kv in sorted(kinds.items()))))
        open(os.path.join(s.out, 'parts.md'), 'w').write('\n'.join(lines) + '\n')
        return len(s.order), kinds
