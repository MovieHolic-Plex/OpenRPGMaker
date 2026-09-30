#!/usr/bin/env python3
"""pxgrid — 텍스트 픽셀 격자를 PNG 로 굽는다. 그림은 사람이(에이전트가) 글자로 한 칸씩 놓는다.

이 도구는 일부러 **그라디언트·노이즈·도형 채우기 함수를 갖지 않는다.** 할 수 있는 것은
글자 격자 붙이기, 한 칸 찍기, 이름 붙인 조각 반복, 좌우 대칭 복사, 층 합성뿐이다.
형식은 README.md 「격자 형식」 절.

  python3 pxgrid.py render FILE.pxg [-o OUT.png]   # OUT.png(1배) + OUT-x4.png + OUT.txt(평탄화 격자)
  python3 pxgrid.py check  FILE.pxg                # 자기 점검 수치(외톨이·윤곽 비·빛 방향·램프 단 수)
  python3 pxgrid.py sheet  OUT.png A.pxg B.pxg ... # 단계별 4배 나란히
  python3 pxgrid.py tile   FILE.pxg OUT.png [N]    # 바닥 타일 N×N 반복(이음매 점검), 4배
"""
import os, sys, math
from PIL import Image, ImageDraw

KEEP, ERASE = '.', '_'
TONES = '0123456789abcde'   # 램프 단 글자(0 = 가장 어두움). `@rampc` 램프 색은 「재료:단」 열쇠로 들어간다
ADJ = {'+': 1, '^': 2, '*': 3, '-': -1, 'v': -2, 'x': -3}   # @tadj 글자 → 단 옮김
CELL = 48   # 기본 칸 크기(REFMAP·RPG Maker MV 와 같다). 파일에서 `@cell 32` 로 바꾼다


# ------------------------------------------------------------------ 팔레트
def load_palette(path):
    """줄마다 `글자 #rrggbb [알파]`. `@ramp 이름 글자들…`(어두운→밝은)은 점검용 램프 정의."""
    pal, ramps = {}, {}
    for raw in open(path, encoding='utf-8'):
        line = raw.strip()
        if not line or line.startswith('//') or line.startswith(';'):
            continue
        if line.startswith('@rampc'):
            # 긴 재료 램프(48px 공통 팔레트): `@rampc 이름 #hex #hex …` → 열쇠 「이름:단」
            body = line.split('//')[0].split(); name = body[1]; keys = []
            for i, hx in enumerate(body[2:]):
                k = f'{name}:{TONES[i]}'; keys.append(k)
                pal[k] = (int(hx[1:3], 16), int(hx[3:5], 16), int(hx[5:7], 16), 255)
            ramps[name] = keys
            continue
        if line.startswith('@ramp'):
            body = line.split('//')[0].split()
            ramps[body[1]] = body[2:]
            continue
        parts = line.split('//')[0].split()
        if len(parts) < 2 or not parts[1].startswith('#'):
            continue
        ch, hx = parts[0], parts[1]
        if len(ch) != 1 or ch in (KEEP, ERASE, ' '):
            raise SystemExit(f'{path}: 팔레트 글자는 한 글자, . _ 공백 금지: {ch!r}')
        a = int(parts[2]) if len(parts) > 2 else 255
        pal[ch] = (int(hx[1:3], 16), int(hx[3:5], 16), int(hx[5:7], 16), a)
    return pal, ramps


# ------------------------------------------------------------------ 격자
def rle(body, path='', line=0):
    """`=` 줄: 「개수+글자」 토큰을 공백으로 나눈다. `= 5. 86# 5.` → 점 5 · # 86 · 점 5. 개수를 빼면 1개.
    같은 색이 길게 이어지는 줄을 세기 쉽게 적는 표기일 뿐이다(색을 계산하지 않는다)."""
    out = []
    for tok in body.split():
        k = 0
        while k < len(tok) - 1 and tok[k].isdigit():
            k += 1
        if len(tok) - k != 1:
            raise SystemExit(f'{path}:{line}: = 줄 토큰은 「개수+글자 하나」: {tok!r}')
        out.append(tok[k] * (int(tok[:k]) if k else 1))
    return ''.join(out)


class Doc:
    def __init__(self, path):
        self.path = os.path.abspath(path)
        self.dir = os.path.dirname(self.path)
        self.W = self.H = None
        self.pal = {}; self.ramps = {}; self.palpath = None
        self.layers = {}; self.order = []; self.cur = 'main'
        self.defs = {}
        self.mats = {}   # @mat 글자 → (램프, 기본 단)
        self.tile = False
        self.cell = CELL
        self._parse()

    # 층
    def layer(self, name):
        if name not in self.layers:
            self.layers[name] = [[KEEP] * self.W for _ in range(self.H)]
            self.order.append(name)
        return self.layers[name]

    def put(self, x, y, c, layer=None):
        g = self.layer(layer or self.cur)
        if c == KEEP:
            return
        if not (0 <= x < self.W and 0 <= y < self.H):
            raise SystemExit(f'{self.path}: 캔버스 밖 ({x},{y})')
        if c != ERASE and c not in self.pal:
            raise SystemExit(f'{self.path}: 팔레트에 없는 글자 {c!r} at ({x},{y})')
        g[y][x] = KEEP if c == ERASE else c

    def paste(self, rows, X, Y, flip=False):
        for j, row in enumerate(rows):
            r = row[::-1] if flip else row
            for i, c in enumerate(r):
                self.put(X + i, Y + j, c)

    def ramp_paste(self, op, rows, X, Y, ramp, ln):
        """램프 격자. 손으로 단을 놓는 것뿐이다(보간·난수 없음).
        @mblock: 글자 = 재료(@mat). 이미 단이 있는 칸은 단을 지키고 재료만 바꾼다(곁 램프 섞기용), 빈 칸은 기본 단.
        @tblock [램프]: 글자 = 단(0~9 a~e). 램프를 안 주면 그 칸에 이미 칠한 재료의 단만 바꾼다.
        @tadj: + 한 단 밝게, ^ 두 단, * 세 단, - 한 단 어둡게, v 두 단, x 세 단. 재료 끝에서 멈춘다.
        셋 다 네 번째 인자로 `only=재료[,재료]` 를 주면 그 재료가 칠해진 칸만 바꾼다."""
        g = self.layer(self.cur)
        only = None
        if ramp and ramp.startswith('only='):   # 거르개: 그 재료가 칠해진 칸만 건드린다(예: 쇠테는 두고 통널만)
            only = set(ramp[5:].split(',')); ramp = None
        for j, row in enumerate(rows):
            for i, c in enumerate(row):
                x, y = X + i, Y + j
                if c == KEEP:
                    continue
                if self.tile:   # 이어 붙이는 타일: 가장자리를 넘은 칸은 반대편으로 감긴다
                    x, y = x % self.W, y % self.H
                if c == ERASE:
                    self.put(x, y, ERASE); continue
                if not (0 <= x < self.W and 0 <= y < self.H):
                    raise SystemExit(f'{self.path}:{ln}: 캔버스 밖 ({x},{y})')
                cur = g[y][x]; cr, ct = (cur.split(':') if ':' in cur else (None, None))
                if only is not None and cr not in only:
                    continue
                if op == '@mblock':
                    if c in self.mats:
                        r, t0 = self.mats[c]; k = f'{r}:{ct if ct is not None else t0}'
                        if k not in self.pal:   # 곁 램프가 더 짧으면 끝 단
                            k = self.ramps[r][-1]
                        self.put(x, y, k)
                    else:
                        self.put(x, y, c)   # 낱 색(그림자 등)
                elif op == '@tblock':
                    r = ramp or cr
                    if r is None:
                        raise SystemExit(f'{self.path}:{ln}: ({x},{y}) 에 재료가 없어 단만 놓을 수 없다(@tblock X Y 램프)')
                    if c not in TONES:
                        raise SystemExit(f'{self.path}:{ln}: 단 글자가 아님 {c!r}')
                    self.put(x, y, f'{r}:{c}')
                else:
                    if cr is None:
                        continue
                    if c not in ADJ:
                        raise SystemExit(f'{self.path}:{ln}: @tadj 글자는 + ^ * - v x : {c!r}')
                    n = len(self.ramps[cr]); t = max(0, min(n - 1, TONES.index(ct) + ADJ[c]))
                    self.put(x, y, f'{cr}:{TONES[t]}')

    def _rows(self, lines, i):
        """i 부터 격자 줄을 모은다. 빈 줄·@ 줄에서 끝. `줄 *N` 은 그 줄을 N번."""
        rows = []
        while i < len(lines):
            s = lines[i].rstrip('\n')
            t = s.strip()
            if not t or t.startswith('@') or t.startswith('//'):
                break
            n = 1
            if ' *' in t:
                t, n = t.rsplit(' *', 1); t = t.strip(); n = int(n)
            if t.startswith('='):
                t = rle(t[1:], self.path, i + 1)
            rows += [t] * n
            i += 1
        return rows, i

    def _parse(self):
        lines = open(self.path, encoding='utf-8').read().split('\n')
        i = 0
        while i < len(lines):
            t = lines[i].strip()
            if not t or t.startswith('//'):
                i += 1; continue
            if not t.startswith('@'):
                raise SystemExit(f'{self.path}:{i + 1}: 격자 줄은 @block/@def 뒤에만: {t[:40]}')
            a = t.split('//')[0].split()
            op = a[0]
            if op == '@size':
                self.W, self.H = int(a[1]), int(a[2])
            elif op == '@palette':
                self.palpath = os.path.join(self.dir, a[1])
                self.pal, self.ramps = load_palette(self.palpath)
            elif op == '@cell':
                self.cell = int(a[1])
            elif op == '@tile':
                self.tile = True
            elif op == '@base':
                b = Doc(os.path.join(self.dir, a[1]))
                self.W, self.H = b.W, b.H
                if not self.palpath:
                    self.pal, self.ramps, self.palpath = b.pal, b.ramps, b.palpath
                self.tile = self.tile or b.tile
                self.cell = b.cell
                self.defs.update(b.defs); self.mats.update(b.mats)
                for n in b.order:
                    self.layers[n] = [r[:] for r in b.layers[n]]; self.order.append(n)
            elif op == '@layer':
                self.cur = a[1]; self.layer(self.cur)
            elif op == '@def':
                rows, i = self._rows(lines, i + 1)
                self.defs[a[1]] = rows
                if i < len(lines) and lines[i].strip().startswith('@end'):
                    i += 1
                continue
            elif op == '@end':
                pass
            elif op == '@block':
                rows, i = self._rows(lines, i + 1)
                self.paste(rows, int(a[1]), int(a[2]))
                continue
            elif op in ('@stamp', '@mirror'):
                rows = self.defs[a[1]]; X, Y = int(a[2]), int(a[3])
                nx, ny, dx, dy = (int(v) for v in (a[4:8] if len(a) >= 8 else (1, 1, 0, 0)))
                for q in range(ny):
                    for p in range(nx):
                        self.paste(rows, X + p * dx, Y + q * dy, flip=(op == '@mirror'))
            elif op == '@mat':
                # 재료 글자: `@mat w oak 8` — @mblock 에서 w 는 oak 램프(처음 칠하면 8단)
                t0 = a[3] if len(a) > 3 else '8'
                self.mats[a[1]] = (a[2], TONES[int(t0)] if t0.isdigit() and len(t0) > 1 else t0)   # 10 → a
            elif op in ('@tstamp', '@tmirror', '@mstamp', '@astamp'):
                # 조각을 램프 격자로 붙인다: @tstamp 이름 X Y [램프] — 단 격자 / @mstamp — 재료 격자 / @astamp — 단 옮김 격자
                rows = self.defs[a[1]]
                if op == '@tmirror':
                    rows = [r[::-1] for r in rows]
                kind = {'@tstamp': '@tblock', '@tmirror': '@tblock', '@mstamp': '@mblock', '@astamp': '@tadj'}[op]
                self.ramp_paste(kind, rows, int(a[2]), int(a[3]), a[4] if len(a) > 4 else None, i)
            elif op in ('@mblock', '@tblock', '@tadj'):
                rows, i = self._rows(lines, i + 1)
                self.ramp_paste(op, rows, int(a[1]), int(a[2]), a[3] if len(a) > 3 else None, i)
                continue
            elif op == '@px':
                v = a[1:]
                for k in range(0, len(v), 3):
                    self.put(int(v[k]), int(v[k + 1]), v[k + 2])
            elif op == '@symx':
                # 열 L..R 의 왼쪽 반을 오른쪽 반에 거울로 복사(실루엣·평면 단계용. 명암 단계에서는 쓰지 말 것).
                L, R = int(a[1]), int(a[2]); g = self.layer(self.cur)
                for y in range(self.H):
                    for x in range(L, (L + R) // 2 + 1):
                        g[y][R - (x - L)] = g[y][x]
            else:
                raise SystemExit(f'{self.path}:{i + 1}: 모르는 지시 {op}')
            i += 1
        if self.W is None:
            raise SystemExit(f'{self.path}: @size 또는 @base 가 필요하다')
        if self.W % self.cell or self.H % self.cell:
            raise SystemExit(f'{self.path}: 캔버스 {self.W}x{self.H} 가 칸 {self.cell}px 의 배수가 아니다')

    # 합성
    def flat(self):
        out = [[KEEP] * self.W for _ in range(self.H)]
        for n in self.order:
            g = self.layers[n]
            for y in range(self.H):
                for x in range(self.W):
                    if g[y][x] != KEEP:
                        out[y][x] = g[y][x]
        return out

    def image(self):
        im = Image.new('RGBA', (self.W, self.H), (0, 0, 0, 0))
        base = Image.new('RGBA', (self.W, self.H), (0, 0, 0, 0))
        for n in self.order:  # 층마다 알파 합성(반투명 그림자 층이 밑에 깔린다)
            lay = Image.new('RGBA', (self.W, self.H), (0, 0, 0, 0)); px = lay.load(); g = self.layers[n]
            for y in range(self.H):
                for x in range(self.W):
                    if g[y][x] != KEEP:
                        px[x, y] = self.pal[g[y][x]]
            # 불투명 칸은 덮어쓰기, 반투명 칸은 얹기
            base.alpha_composite(lay)
        im = base
        return im


def x4(im, k=4, grid=False, bg=None, cell=CELL):
    big = im.resize((im.width * k, im.height * k), Image.NEAREST)
    if bg:
        b = Image.new('RGBA', big.size, bg); b.alpha_composite(big); big = b
    if grid:
        d = ImageDraw.Draw(big)
        for x in range(0, big.width, cell * k):
            d.line([(x, 0), (x, big.height)], fill=(255, 0, 255, 90))
        for y in range(0, big.height, cell * k):
            d.line([(0, y), (big.width, y)], fill=(255, 0, 255, 90))
    return big


def render(path, out=None):
    d = Doc(path)
    out = out or os.path.splitext(path)[0] + '.png'
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    im = d.image(); im.save(out)
    x4(im, 4, bg=(46, 40, 48, 255)).save(os.path.splitext(out)[0] + '-x4.png')
    with open(os.path.splitext(out)[0] + '.txt', 'w', encoding='utf-8') as f:
        f.write(f'// {os.path.basename(path)} 평탄화 격자 {d.W}x{d.H}\n')
        for r in d.flat():
            f.write(''.join(c.split(':')[1] if ':' in c else c for c in r) + '\n')
    return d, im


# ------------------------------------------------------------------ 자기 점검 (수치만. 판정은 README 점검표로 눈으로)
def lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def check(path):
    d = Doc(path); g = d.flat(); W, H = d.W, d.H; pal = d.pal
    if d.tile:  # 이어 붙이는 타일: 이웃을 반대편 끝에서 가져온다(가장자리 = 윤곽이 아니다)
        solid = lambda x, y: g[y % H][x % W] != KEEP and pal[g[y % H][x % W]][3] == 255
    else:
        solid = lambda x, y: 0 <= x < W and 0 <= y < H and g[y][x] != KEEP and pal[g[y][x]][3] == 255
    rep = []
    used = {}
    for y in range(H):
        for x in range(W):
            if g[y][x] != KEEP:
                used[g[y][x]] = used.get(g[y][x], 0) + 1
    rep.append(f'색 {len(used)}개 사용: ' + ' '.join(f'{c}:{n}' for c, n in sorted(used.items(), key=lambda t: -t[1])))
    for rn, chars in d.ramps.items():
        u = [c for c in chars if c in used]
        if not u:
            continue
        rep.append(f'램프 {rn}: {len(u)}/{len(chars)}단 사용 ({"".join(k.split(":")[-1] for k in u)})' + ('  ← 3단 미만: 입체가 안 선다' if len(u) < 3 else '') + ('  ← 8단 초과: 32px 에서 띠가 흐려진다' if len(u) > 8 else ''))
    # 외톨이: 8이웃에 같은 글자가 없는 불투명 칸
    orph = []
    for y in range(H):
        for x in range(W):
            c = g[y][x]
            if c == KEEP or pal[c][3] < 255:
                continue
            if not any((d.tile or (0 <= x + a < W and 0 <= y + b < H)) and g[(y + b) % H][(x + a) % W] == c for a in (-1, 0, 1) for b in (-1, 0, 1) if a or b):
                orph.append((x, y, c))
    rep.append(f'외톨이 {len(orph)}개' + (': ' + ' '.join(f'({x},{y}){c}' for x, y, c in orph[:24]) + (' …' if len(orph) > 24 else '') if orph else ''))
    # 윤곽 비: 실루엣 가장자리 칸(4이웃에 빈 칸) ÷ 속(가장자리에서 2칸 이상 안)
    edge_lt, edge_rb, ring_lt, ring_rb, inner = [], [], [], [], []
    for y in range(H):
        for x in range(W):
            if not solid(x, y):
                continue
            L = lum(pal[g[y][x]])
            up, lf, dn, rt = not solid(x, y - 1), not solid(x - 1, y), not solid(x, y + 1), not solid(x + 1, y)
            if dn or rt:
                edge_rb.append(L)
            elif up or lf:
                edge_lt.append(L)
            elif all(solid(x + a, y + b) for a in (-2, -1, 0, 1, 2) for b in (-2, -1, 0, 1, 2)):
                inner.append(L)
            else:
                # 가장자리 바로 안쪽 한 줄: 빛 쪽(위·왼)과 그늘 쪽(아래·오른)
                if not solid(x, y - 2) or not solid(x - 2, y):
                    ring_lt.append(L)
                elif not solid(x, y + 2) or not solid(x + 2, y):
                    ring_rb.append(L)
    m = lambda v: sum(v) / len(v) if v else float('nan')
    mi = m(inner)
    if d.tile:
        rep.append('타일(@tile): 윤곽 비·빛 방향 점검은 건너뛴다. `tile` 명령으로 3×3 반복을 보고 이음매·반복 무늬를 눈으로 본다.')
    elif inner:
        rep.append(f'윤곽 밝기/속 밝기: 위·왼 {m(edge_lt) / mi:.2f}, 아래·오른 {m(edge_rb) / mi:.2f} (목표 0.55~0.8 · 아래·오른이 더 어둡게)')
        rep.append(f'가장자리 바로 안 한 줄/속: 빛 쪽 {m(ring_lt) / mi:.2f}, 그늘 쪽 {m(ring_rb) / mi:.2f}'
                   + ('  ← 둘 다 1 미만: 베개 명암 의심(가장자리를 사방으로 어둡게 했다)' if m(ring_lt) < mi * 0.97 and m(ring_rb) < mi * 0.97 else '')
                   + ('  ← 그늘 쪽이 더 밝다: 빛 방향 반대' if m(ring_rb) > m(ring_lt) else ''))
    # 같은 폭 띠: 한 가로줄에서 색이 바뀌는 간격이 3번 이상 똑같으면 계단 띠 의심
    bands = 0
    for y in range(H):
        runs = []; s = 0
        for x in range(1, W + 1):
            if x == W or g[y][x] != g[y][s]:
                if g[y][s] != KEEP:
                    runs.append(x - s)
                s = x
        for k in range(len(runs) - 3):
            if runs[k] == runs[k + 1] == runs[k + 2] == runs[k + 3] and runs[k] >= 2:
                bands += 1; break
    rep.append(f'같은 폭 띠가 4번 이어진 가로줄 {bands}개' + ('  ← 수식처럼 보인다. 덩이 크기를 섞어라' if bands > 2 else ''))
    return rep


def sheet(out, paths, k=4):
    ims = [(os.path.basename(p), Doc(p).image()) for p in paths]
    pad = 12; lab = 16
    Wt = sum(im.width * k for _, im in ims) + pad * (len(ims) + 1)
    Ht = max(im.height * k for _, im in ims) + pad * 2 + lab
    s = Image.new('RGBA', (Wt, Ht), (30, 27, 34, 255)); d = ImageDraw.Draw(s); x = pad
    for n, im in ims:
        s.alpha_composite(x4(im, k, bg=(46, 40, 48, 255)), (x, pad + lab)); d.text((x, 2), n, fill=(230, 220, 200, 255)); x += im.width * k + pad
    s.save(out)


def tile(path, out, n=3, k=4):
    im = Doc(path).image(); t = Image.new('RGBA', (im.width * n, im.height * n))
    for j in range(n):
        for i in range(n):
            t.alpha_composite(im, (i * im.width, j * im.height))
    x4(t, k).save(out)


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(1)
    cmd = sys.argv[1]
    if cmd == 'render':
        o = sys.argv[sys.argv.index('-o') + 1] if '-o' in sys.argv else None
        d, im = render(sys.argv[2], o); print(f'{sys.argv[2]}: {d.W}x{d.H}')
    elif cmd == 'check':
        for p in sys.argv[2:]:
            print('==', p); [print('  ' + r) for r in check(p)]
    elif cmd == 'sheet':
        sheet(sys.argv[2], sys.argv[3:])
    elif cmd == 'tile':
        tile(sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 3)
    else:
        print(__doc__); sys.exit(1)
