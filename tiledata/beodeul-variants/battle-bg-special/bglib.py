# 전투 배경 공용 틀(이 폴더 전용). 각 장소 스크립트(bg_<slug>.py)가 그 장소 복사본(src/<장소>/)을 부른 뒤 이것으로 조립한다.
# 1배 캔버스 320×180 에 16px 칸 그림을 그대로 찍고, 마지막에 정수 2배(최근접)로 640×360 을 만든다 — 맵 render-2x 와 같은 배율.
# 구도(1배 좌표): 하늘 y 0~HZ, 지평선 HZ≈84~92, 전투 바닥 92~170, 맨 아래 10px 는 HUD 가림.
# 배틀러 자리(1배 x 60~280, y 95~165)에는 키 큰 물체·밝은 점을 두지 않는다.
import os, sys, math
import numpy as np
from PIL import Image

W1, H1 = 320, 180
SCALE = 2
KEEP = (60, 95, 280, 165)        # 배틀러 자리(1배)

def _h(x, y, s):
    n = (x * 374761393 + y * 668265263 + s * 1442695041) & 0xffffffff
    n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return ((n ^ (n >> 16)) & 0xffff) / 65535.0

def hx(s): s = s.lstrip('#'); return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))

class BG:
    def __init__(s, slug):
        s.slug = slug
        s.img = Image.new('RGBA', (W1, H1), (0, 0, 0, 255))
        s.objs = []        # (sorty, x, y, im, shadow)
        s.shmask = Image.new('L', (W1, H1), 0)

    # ---- 바닥: 화소 함수 f(X, Y) -> (r,g,b) 를 영역에 칠한다(세계 좌표 오프셋 ox, oy)
    def fill(s, f, y0=0, y1=H1, x0=0, x1=W1, ox=0, oy=0, mask=None):
        p = s.img.load()
        for y in range(y0, y1):
            for x in range(x0, x1):
                if mask is not None and not mask(x, y): continue
                c = f(x + ox, y + oy)
                p[x, y] = tuple(int(v) for v in c[:3]) + (255,)

    def paste_ground(s, im, x=0, y=0):
        """이미 그린 바닥 그림(RGBA)을 그대로 깐다(투명 칸은 밑그림 유지)."""
        s.img.alpha_composite(im.convert('RGBA'), (x, y))

    def tile(s, im, y0, y1, x0=0, x1=W1, dx=0, dy=0):
        """표본(이음새 없는 3×3 등)을 이어 붙여 깐다."""
        im = im.convert('RGBA'); w, h = im.size
        for y in range(y0, y1):
            for x in range(x0, x1):
                c = im.getpixel(((x + dx) % w, (y + dy) % h))
                if c[3]: s.img.putpixel((x, y), c[:3] + (255,))

    # ---- 하늘: 색 띠(단단한 경계, 띠 사이 1px 계단 무늬) + 손으로 찍은 구름 덩이
    def sky(s, bands, y1, seed=1):
        """bands = [(y_end, rgb), ...] 위에서 아래로. 띠 경계는 4~8px 마다 1px 오르내리는 계단(번짐 없음)."""
        p = s.img.load()
        for x in range(W1):
            ends = [ye + (int(_h(x // 7, i, seed) * 3) - 1 if i < len(bands) - 1 else 0) for i, (ye, _) in enumerate(bands)]
            i = 0
            for y in range(y1):
                while i < len(bands) - 1 and y >= ends[i]: i += 1
                p[x, y] = bands[i][1] + (255,)

    def cloud(s, cx, cy, w, h, ramp, seed=1):
        """구름 덩이: 겹친 둥근 혹(위가 밝고 아래 평평, 아래 1줄 그늘). ramp = [그늘, 몸, 빛, 하이라이트]."""
        p = s.img.load()
        bumps = []
        n = max(2, w // 9)
        for i in range(n):
            bx = cx - w / 2 + (i + .5) * w / n + (_h(i, 1, seed) - .5) * 4
            r = h * (.45 + .45 * math.sin(math.pi * (i + .5) / n)) + _h(i, 2, seed) * 2
            bumps.append((bx, cy - r * .35, r))
        base = cy + h * .35
        for y in range(int(cy - h * 1.3), int(base) + 1):
            for x in range(int(cx - w / 2 - 6), int(cx + w / 2 + 6)):
                if not (0 <= x < W1 and 0 <= y < H1): continue
                inside = False; top = 9e9; lx = 0
                for bx, by, r in bumps:
                    d = math.hypot((x + .5 - bx), (y + .5 - by) * 1.15)
                    if d < r and y <= base:
                        inside = True; lx = max(lx, (r - d) / r)
                        top = min(top, (y + .5 - (by - r)) / max(1, r))
                if not inside: continue
                if y >= base - 1: c = ramp[0]
                elif top < .28 and _h(x, y, seed + 3) > .25: c = ramp[3] if len(ramp) > 3 else ramp[2]
                elif top < .7: c = ramp[2]
                else: c = ramp[1]
                p[x, y] = c + (255,)

    def ridge(s, ybase, amp, ramp, seed=1, period=40, rough=3, ytop_min=0, lit=True):
        """먼 산·언덕 띠: 들쭉날쭉한 윗선(겹친 사인 + 칸 잡음), 윗선 1px 빛, 아래로 한 단 어둡게. 번짐 없음."""
        p = s.img.load()
        tops = []
        for x in range(W1):
            t = ybase - amp * (.55 + .3 * math.sin(x / period * 2 * math.pi + seed) + .15 * math.sin(x / period * 5.3 + seed * 2))
            t += (_h(x // rough, 0, seed) - .5) * rough
            tops.append(max(ytop_min, int(t)))
        for x in range(W1):
            t = tops[x]
            for y in range(t, H1):
                if y == t and lit: c = ramp[2]
                elif (y - t) < 3 + int(_h(x // 3, 5, seed) * 3) and (tops[max(0, x - 1)] > t or _h(x, y, seed) > .6) and lit: c = ramp[2] if _h(x, y, seed + 1) > .5 else ramp[1]
                else: c = ramp[1]
                if (y - t) > 10 and _h(x // 2, y // 2, seed + 4) > .93: c = ramp[0]
                p[x, y] = c + (255,)
        return tops

    # ---- 물체: 왼쪽 아래 기준 좌표(x, ybottom). shadow=True 면 버들항처럼 (+6,+3) 곱하기 그림자.
    def put(s, im, x, yb, shadow=True, sorty=None, flip=False):
        im = im.convert('RGBA')
        if flip: im = im.transpose(Image.FLIP_LEFT_RIGHT)
        y = yb - im.height
        s.objs.append((yb if sorty is None else sorty, x, y, im, shadow))
        return im

    def overlay(s, im, x, y):
        s.objs.append((10 ** 6, x, y, im.convert('RGBA'), False))

    def compose(s, shade=(0.52, 0.58, 0.74)):
        mask = Image.new('L', (W1, H1), 0)
        for sy, x, y, im, sh in s.objs:
            if sh and im.height >= 24:
                a = im.split()[3].point(lambda v: 255 if v > 128 else 0)
                mask.paste(255, (x + 6, y + 3), a)
        A = np.array(s.img).astype(np.float64); SH = np.array(mask) > 0
        A[SH, :3] = np.floor(A[SH, :3] * np.array(shade))
        s.img = Image.fromarray(A.astype(np.uint8), 'RGBA')
        for sy, x, y, im, sh in sorted(s.objs, key=lambda o: (o[0], o[1])):
            s.img.alpha_composite(im, (x, y)) if (x >= 0 and y >= 0) else \
                s.img.alpha_composite(im.crop((max(0, -x), max(0, -y), im.width, im.height)), (max(0, x), max(0, y)))
        return s.img

    def save(s, out_dir, maxc=96):
        rgb = s.img.convert('RGB')
        n = len(rgb.getcolors(1 << 20))
        if n > maxc:
            rgb = rgb.quantize(colors=maxc, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
        big = rgb.resize((W1 * SCALE, H1 * SCALE), Image.NEAREST)
        path = os.path.join(out_dir, s.slug + '.png')
        big.save(path)
        nn = len(big.getcolors(1 << 20))
        print(f'{s.slug}: {big.size} colors {n}->{nn}')
        return path

def flipx(im): return im.transpose(Image.FLIP_LEFT_RIGHT)

def crop_alpha(im):
    bb = im.getbbox()
    return im.crop(bb) if bb else im
