"""party-pixel(비인간형 파티원 9칸 전투 시트) 공용 그리기·검증 모듈 — r2w6 묶음 b2(탈것) 이후 공용.

규격(src/assets/pixelEnemySheets.ts 머리 주석과 같다, 방향만 다르다): 셀 cell(48|64) 정사각 3열×3행, 알파 0/255, ≤16색,
**왼쪽(적 쪽)을 본다**(아군 파티원이므로), 바닥 기준선 = 가장 아래 불투명 행이 y=cell-4, 가로 중심 x=cell/2.
  (0,0)(1,0)(2,0) 대기 a·b·c  (0,1) windup  (1,1) move  (2,1) attack  (0,2) recover  (1,2) hit  (2,2) dead
모든 픽셀은 PIL 다각형·선·수식으로 최종 격자에 직접 찍는다. 외부 그림을 읽거나 줄이지 않는다.

생성기 <chip>.py 는 PAL(키 → '#rrggbb'), CELL, draw(name) -> Pen 을 정의하고 run(globals()) 를 부른다.
산출: public/assets/generated/party-pixel/<chip>.png, 검수판: .omo/r2w6/b2/<chip>/ (preview.png 4x, cycle.gif, scale.png).
"""
import math
import sys
from pathlib import Path

sys.dont_write_bytecode = True
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'public/assets/generated/party-pixel'
QA = ROOT / '.omo/r2w6/b2'
NAMES = ['idle_a', 'idle_b', 'idle_c', 'windup', 'move', 'attack', 'recover', 'hit', 'dead']
BG = (0x20, 0x28, 0x40, 255)


def rgba(h):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


def ipt(p):
    return (int(round(p[0])), int(round(p[1])))


def pol(cx, cy, r, deg, squash=1.0):
    """deg 0 = 오른쪽, 90 = 위."""
    a = math.radians(deg)
    return (cx + math.cos(a) * r, cy - math.sin(a) * r * squash)


class Pen:
    def __init__(self, cell, pal):
        self.cell = cell
        self.pal = {k: rgba(v) for k, v in pal.items()}
        self.im = Image.new('RGBA', (cell, cell), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.im)

    # -- 기본 -------------------------------------------------------------
    def px(self, x, y, k):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < self.cell and 0 <= y < self.cell:
            self.im.putpixel((x, y), self.pal[k])

    def get(self, x, y):
        if 0 <= x < self.cell and 0 <= y < self.cell:
            return self.im.getpixel((x, y))
        return (0, 0, 0, 0)

    def rect(self, x0, y0, x1, y1, k):
        if x1 < x0 or y1 < y0:
            return
        self.d.rectangle((int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1))), fill=self.pal[k])

    def line(self, pts, k, w=1):
        pts = [ipt(p) for p in pts]
        if len(pts) == 1 or all(p == pts[0] for p in pts):
            self.px(pts[0][0], pts[0][1], k)
            return
        self.d.line(pts, fill=self.pal[k], width=w)

    def disc(self, x, y, r, k):
        if r < 0.6:
            self.px(x, y, k)
            return
        self.d.ellipse((round(x - r), round(y - r), round(x + r), round(y + r)), fill=self.pal[k])

    def oval(self, x, y, rx, ry, k):
        self.d.ellipse((round(x - rx), round(y - ry), round(x + rx), round(y + ry)), fill=self.pal[k])

    def poly(self, pts, k):
        self.d.polygon([ipt(p) for p in pts], fill=self.pal[k])

    def grid(self, x, y, rows, over=None):
        """문자 격자. '.' 투명, 그 밖은 PAL 키(1글자). over 는 {문자: 키} 치환."""
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch == '.':
                    continue
                self.px(x + i, y + j, (over or {}).get(ch, ch))

    # -- 덩어리(면 + 1px 명암 + 바깥 윤곽) ----------------------------------------
    def _mask(self, pts):
        m = Image.new('L', (self.cell, self.cell), 0)
        ImageDraw.Draw(m).polygon([ipt(p) for p in pts], fill=255)
        return m

    def solid(self, pts, base, hi=None, lo=None, edge='o', mask=None):
        """다각형 하나를 base 로 채우고 위·왼 가장자리 1px 는 hi, 아래·오른 가장자리 1px 는 lo, 바깥 1px 는 edge."""
        m = mask or self._mask(pts)
        mp = m.load()
        n = self.cell

        def inside(x, y):
            return 0 <= x < n and 0 <= y < n and mp[x, y] > 0
        ring, body = [], []
        for y in range(n):
            for x in range(n):
                if inside(x, y):
                    body.append((x, y))
                elif edge and (inside(x - 1, y) or inside(x + 1, y) or inside(x, y - 1) or inside(x, y + 1)):
                    ring.append((x, y))
        for x, y in ring:
            self.px(x, y, edge)
        for x, y in body:
            k = base
            if hi and (not inside(x, y - 1) or not inside(x - 1, y)) and not (lo and (not inside(x, y + 1) or not inside(x + 1, y))):
                k = hi
            elif lo and (not inside(x, y + 1) or not inside(x + 1, y)):
                k = lo
            self.px(x, y, k)
        return m

    def globe(self, cx, cy, rx, ry, base, hi=None, lo=None, edge='o'):
        """타원 덩어리: 왼쪽 위 밝음, 오른쪽 아래 어두움."""
        for y in range(int(cy - ry) - 2, int(cy + ry) + 3):
            for x in range(int(cx - rx) - 2, int(cx + rx) + 3):
                u, v = (x + .5 - cx) / rx, (y + .5 - cy) / ry
                r = math.hypot(u, v)
                if r > 1.0:
                    continue
                if r > 0.82 and edge:
                    self.px(x, y, edge)
                    continue
                L = -(u * 0.6 + v * 0.8)
                k = base
                if hi and L > 0.5:
                    k = hi
                elif lo and L < -0.35:
                    k = lo
                self.px(x, y, k)

    def outline(self, k, keep_inside=True):
        """이미 그려진 전체 실루엣 바깥에 1px 윤곽(4방향)."""
        n = self.cell
        a = self.im.getchannel('A').load()
        add = []
        for y in range(n):
            for x in range(n):
                if a[x, y]:
                    continue
                for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    xx, yy = x + ox, y + oy
                    if 0 <= xx < n and 0 <= yy < n and a[xx, yy]:
                        add.append((x, y))
                        break
        for x, y in add:
            self.im.putpixel((x, y), self.pal[k])

    def ddots(self, x0, y0, x1, y1, k, parity=0, only_empty=True):
        for y in range(int(y0), int(y1) + 1):
            for x in range(int(x0), int(x1) + 1):
                if (x + y + parity) % 2 == 0 and (not only_empty or self.get(x, y)[3] == 0):
                    self.px(x, y, k)

    def paste(self, other, dx=0, dy=0):
        self.im.alpha_composite(other.im if isinstance(other, Pen) else other, (dx, dy))
        self.d = ImageDraw.Draw(self.im)

    def flash(self, k='w', parity=0, keep=('o',)):
        """피격 번쩍임: 윤곽이 아닌 불투명 픽셀 절반(체크무늬)을 흰색으로."""
        keeps = {self.pal[x] for x in keep}
        for y in range(self.cell):
            for x in range(self.cell):
                c = self.im.getpixel((x, y))
                if c[3] and c not in keeps and (x + y + parity) % 2 == 0:
                    self.im.putpixel((x, y), self.pal[k])

    def recolor(self, mapping):
        rev = {v: k for k, v in self.pal.items()}
        for y in range(self.cell):
            for x in range(self.cell):
                c = self.im.getpixel((x, y))
                if c[3] and rev.get(c) in mapping:
                    self.im.putpixel((x, y), self.pal[mapping[rev[c]]])


def shift(pen, dx=0, dy=0):
    out = Image.new('RGBA', pen.im.size, (0, 0, 0, 0))
    out.paste(pen.im, (dx, dy))
    pen.im = out
    pen.d = ImageDraw.Draw(out)
    return pen


def pitch(pen, slope, cx=None, hold=0):
    """열마다 세로로 밀어 기울인다(픽셀 계단 기울기). slope>0 = 왼쪽(앞)이 아래로."""
    cx = pen.cell / 2 if cx is None else cx
    src = pen.im
    out = Image.new('RGBA', src.size, (0, 0, 0, 0))
    for x in range(src.width):
        dy = int(round((cx - x) * slope))
        col = src.crop((x, 0, x + 1, src.height))
        out.paste(col, (x, dy))
    pen.im = out
    pen.d = ImageDraw.Draw(out)
    return pen


def settle(pen, ground=None, margin=1):
    """가장 아래 불투명 행을 ground 로 내리고 좌우 여백 margin 을 지킨다."""
    box = pen.im.getbbox()
    if not box:
        return pen
    g = pen.cell - 4 if ground is None else ground
    dy = g - (box[3] - 1)
    dx = 0
    if box[0] < margin:
        dx = margin - box[0]
    elif box[2] > pen.cell - margin:
        dx = pen.cell - margin - box[2]
    if dx or dy:
        shift(pen, dx, dy)
    return pen


def settle_x(pen, margin=1):
    box = pen.im.getbbox()
    dx = 0
    if box[0] < margin:
        dx = margin - box[0]
    elif box[2] > pen.cell - margin:
        dx = pen.cell - margin - box[2]
    if dx:
        shift(pen, dx, 0)
    return pen


def check(chip, cell, sheet, frames):
    problems = []
    if sheet.size != (cell * 3, cell * 3):
        problems.append(f'size {sheet.size}')
    if not set(sheet.getchannel('A').tobytes()) <= {0, 255}:
        problems.append('alpha not 0/255')
    inks = {c for _, c in sheet.getcolors(cell * cell * 9) if c[3]}
    if len(inks) > 16:
        problems.append(f'{len(inks)} colours > 16')
    boxes = {}
    for n, fr in zip(NAMES, frames):
        b = fr.getbbox()
        if not b:
            problems.append(f'{n} empty')
            continue
        boxes[n] = b
        if b[0] < 1 or b[2] > cell - 1 or b[1] < 0 or b[3] > cell - 3:
            problems.append(f'{n} bbox {b} breaks margins')
    for i in range(1, len(frames)):
        a, b = frames[i - 1].tobytes(), frames[i].tobytes()
        dc = sum(1 for j in range(0, len(a), 4) if a[j:j + 4] != b[j:j + 4])
        if dc < 6:
            problems.append(f'{NAMES[i-1]}->{NAMES[i]} nearly same ({dc}px)')
    return problems, len(inks), boxes


def run(mod, quiet=False):
    chip, cell, pal, draw = mod['CHIP'], mod['CELL'], mod['PAL'], mod['draw']
    frames = []
    for n in NAMES:
        pen = draw(n)
        frames.append(pen.im)
    sheet = Image.new('RGBA', (cell * 3, cell * 3), (0, 0, 0, 0))
    for i, im in enumerate(frames):
        sheet.paste(im, (i % 3 * cell, i // 3 * cell))
    problems, ncol, boxes = check(chip, cell, sheet, frames)
    OUT.mkdir(parents=True, exist_ok=True)
    qa = QA / chip
    qa.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT / f'{chip}.png', optimize=True)
    back = Image.open(OUT / f'{chip}.png').convert('RGBA')
    if back.tobytes() != sheet.tobytes():
        problems.append('png roundtrip changed pixels')
    # 4배 확인판(3x3, 라벨) — 1900px 이하: cell 64 → 768, cell 48 → 576
    sc = 4
    board = Image.new('RGBA', (cell * 3 * sc, cell * 3 * sc), BG)
    board.alpha_composite(sheet.resize((cell * 3 * sc, cell * 3 * sc), Image.NEAREST))
    d = ImageDraw.Draw(board)
    font = ImageFont.load_default()
    for i, n in enumerate(NAMES):
        x, y = i % 3 * cell * sc, i // 3 * cell * sc
        d.rectangle((x, y, x + cell * sc - 1, y + cell * sc - 1), outline=(0x3a, 0x46, 0x62, 255))
        d.line((x, y + (cell - 3) * sc, x + cell * sc - 1, y + (cell - 3) * sc), fill=(0x39, 0x46, 0x5e, 255))
        d.text((x + 4, y + 3), n, fill=(0xf0, 0xf0, 0xa0, 255), font=font)
    board.convert('RGB').save(qa / 'preview.png')
    seq = [0, 1, 2, 1, 0, 1, 2, 1, 3, 4, 5, 6, 7, 0, 8]
    dur = [180] * 8 + [320, 240, 420, 320, 420, 300, 1000]
    gifs = []
    for i in seq:
        base = Image.new('RGBA', (cell, cell), BG)
        base.alpha_composite(frames[i])
        gifs.append(base.convert('RGB').resize((cell * 3, cell * 3), Image.NEAREST))
    gifs[0].save(qa / 'cycle.gif', save_all=True, append_images=gifs[1:], duration=dur, loop=0, disposal=2)
    line = f'{"OK " if not problems else "BAD"} {chip:<11} cell={cell} colours={ncol}'
    if problems:
        line += ' :: ' + '; '.join(problems)
    if not quiet:
        print(line)
    return not problems


# -- 공용 소품: 물결·연기·불꽃 -----------------------------------------------------
def waves(pen, y, x0, x1, phase, dark='b1', light='b2', foam='f', depth=4, gap=None, taper=(0, 2, 4, 7)):
    """수면 띠(렌즈 모양): 위 줄이 가장 넓고 아래로 갈수록 좌우가 줄어든다. gap=(a,b) 구간의 맨 윗줄은 비운다."""
    for r in range(depth):
        yy = y + r
        t = taper[min(r, len(taper) - 1)]
        for x in range(x0 + t, x1 - t + 1):
            if gap and gap[0] <= x <= gap[1] and r == 0:
                continue
            k = dark if (r > 0 or (x + phase) % 4 in (1, 2)) else light
            if r == 0 and (x + phase) % 6 == 0:
                k = foam
            elif r == 1 and (x + phase) % 5 == 0:
                k = light
            pen.px(x, yy, k)


def puff(pen, x, y, r, keys, seed=0):
    """연기 덩이: keys 어두움 → 밝음. 픽셀 체크 디더 가장자리."""
    import random
    rr = random.Random(seed)
    for i, k in enumerate(keys):
        s = max(0.6, r * (1 - i * 0.24))
        pen.disc(x - i * 0.7, y - i * 0.9, s, k)
    for _ in range(3):
        a = rr.uniform(0, 6.28)
        pen.px(x + math.cos(a) * (r + 1), y + math.sin(a) * (r + 1) * 0.8, keys[0])


def spark(pen, x, y, r, core, arm=None):
    arm = arm or core
    r = int(round(r))
    if r <= 0:
        pen.px(x, y, core)
        return
    pen.line([(x - r, y), (x + r, y)], arm)
    pen.line([(x, y - r), (x, y + r)], arm)
    pen.px(x, y, core)
    if r >= 3:
        pen.line([(x - 1, y), (x + 1, y)], core)
        pen.line([(x, y - 1), (x, y + 1)], core)


def burst(pen, x, y, r, keys):
    """포구 불꽃/폭발: 바깥 → 안쪽 키. 별 모양 다각형."""
    for i, k in enumerate(keys):
        rr = r * (1 - i / len(keys))
        pts = []
        for j in range(12):
            a = j * math.pi / 6
            rad = rr * (1.0 if j % 2 == 0 else 0.55)
            pts.append((x + math.cos(a) * rad, y + math.sin(a) * rad))
        pen.poly(pts, k)
