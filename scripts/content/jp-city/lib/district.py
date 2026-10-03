"""지구(district) 조립기 — 96x64 칸 등 넓은 맵.
평면도(문자 격자) → 칸 종류 지도. 건물 필지는 (col,row_bottom,spec) 로 놓고, 뒤(위)쪽 건물부터 그린다.
하나의 'surface' 지도(road/sidewalk/lot...)와 건물·소품 오버레이로 구성."""
import jpenv
import numpy as np
from PIL import Image
from modern_style_bible_proof import K, Cv, hero

class District:
    def __init__(self, kit, ncols, nrows, sky_rows=0):
        self.kit = kit; self.nc = ncols; self.nr = nrows
        self.surf = [[None] * ncols for _ in range(nrows)]       # 칸 이름(거리 칸) 또는 None
        self.walk = [['X'] * ncols for _ in range(nrows)]
        self.items = []        # (sort_key_row, 'bld'|'prop', ...)
        self.placed = []       # 소품 점유 (r0,r1,c0,c1,name)
        self.doors = []        # (row, col) 문 아랫줄 칸
        self.img = np.zeros((nrows * 16, ncols * 16, 4), np.uint8)
    # --- 바닥 ---
    def fill(self, r0, c0, r1, c1, name, walk='F'):
        for r in range(r0, r1):
            for c in range(c0, c1):
                self.surf[r][c] = name; self.walk[r][c] = walk
    def hline(self, r, c0, c1, name, walk='F'): self.fill(r, c0, r + 1, c1, name, walk)
    def from_plan(self, plan, legend):
        """plan: 줄 목록(문자열). legend: 문자 → (칸 이름 | None, walk)."""
        for r, line in enumerate(plan):
            for c, ch in enumerate(line):
                if ch in legend:
                    nm, w = legend[ch]; self.surf[r][c] = nm; self.walk[r][c] = w
    # --- 건물/소품 ---
    def building(self, spec, col, row_bottom, lrecipe=False):
        """row_bottom: 건물 1층 아랫줄이 놓이는 칸 행(이 행의 '아랫변'이 건물 바닥)."""
        kit = self.kit
        asm = kit.assemble_L(spec) if lrecipe else kit.assemble(spec)
        r0 = row_bottom + 1 - asm['rows']
        self.items.append((row_bottom, 0, 'bld', asm, col, r0))
        for r in range(asm['rows']):
            for c in range(asm['n']):
                rr, cc = r0 + r, col + c
                if 0 <= rr < self.nr and 0 <= cc < self.nc: self.walk[rr][cc] = asm['walk'][r][c]
        if lrecipe: self.doors += [(r0 + r, col + c) for r, c in asm['doors']]
        else: self.doors += [(row_bottom, col + dc) for dc in asm['door_cols']]
        return asm
    def prop(self, name, row_base, col, avoid_doors=True):
        P = self.kit.props[name]; w, h = P['w'], P['h']; r0 = row_base - h + 1
        def clash(c):
            if c < 0 or c + w > self.nc: return True
            for (dr, dc) in self.doors:
                if avoid_doors and c <= dc <= c + w - 1 and dr <= row_base <= dr + 3: return True
            for (a0, a1, b0, b1, nm) in self.placed:
                if not (b1 < c or b0 > c + w - 1) and not (a1 < r0 or a0 > row_base): return True
            return False
        for d in (0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6):
            if not clash(col + d): col += d; break
        else: return False
        self.items.append((row_base, 1, 'prop', name, col, r0)); self.placed.append((r0, row_base, col, col + w - 1, name))
        for rr in range(h):
            for cc in range(w):
                if P['walk'][rr][cc] == 'S': self.walk[r0 + rr][col + cc] = 'S'
        return True
    def put(self, name, col, row_base, dx=0, dy=0, solid=True):
        """충돌 검사 없이 소품을 놓는다(군중·장식). dx,dy 는 픽셀 오프셋. solid 면 밑동 막힘을 walk 에 반영."""
        if name.startswith('person.') and name not in self.kit.props: return    # 행인(Actor1)은 번들에서 제외 — 난수는 호출 쪽에서 이미 소비했으므로 나머지 배치는 원본과 같다
        P = self.kit.props[name]; w, h = P['w'], P['h']; r0 = row_base - h + 1
        self.items.append(((row_base * 16 + dy) / 16, 1, 'propx', name, col * 16 + dx, r0 * 16 + dy))
        if solid:
            for cc in range(w):
                if P['walk'][h - 1][cc] == 'S' and 0 <= row_base < self.nr and 0 <= col + cc < self.nc: self.walk[row_base][col + cc] = 'S'
    def set(self, r, c, name, walk='F'):
        if 0 <= r < self.nr and 0 <= c < self.nc: self.surf[r][c] = name; self.walk[r][c] = walk
    # --- 그리기 ---
    def render(self, sky=True):
        kit = self.kit; im = self.img; im[:] = 0
        if sky:
            for y in range(im.shape[0]):
                col = K('garasu', 5 - y // 70)
                from modern_style_bible_proof import rgb
                im[y, :, :3] = rgb(col); im[y, :, 3] = 255
        def blit_arr(a, y, x):
            if y >= im.shape[0] or x >= im.shape[1] or y + a.shape[0] <= 0: return
            ys, xs = max(y, 0), max(x, 0); ye, xe = min(y + a.shape[0], im.shape[0]), min(x + a.shape[1], im.shape[1])
            sub = im[ys:ye, xs:xe]; src = a[ys - y:ye - y, xs - x:xe - x]; m = src[..., 3] > 0; sub[m] = src[m]
        for r in range(self.nr):
            for c in range(self.nc):
                nm = self.surf[r][c]
                if nm: blit_arr(kit.cell(kit.street[nm] if nm in kit.street else nm), r * 16, c * 16)
        for key, z, kind, *rest in sorted(self.items, key=lambda t: (t[0], t[1])):
            if kind == 'bld':
                asm, col, r0 = rest; blit_arr(kit.render(asm), r0 * 16, col * 16)
            elif kind == 'propx':
                name, x, y = rest; blit_arr(kit.prop_image(name), y, x)
            else:
                name, col, r0 = rest; blit_arr(kit.prop_image(name), r0 * 16, col * 16)
        return im
    def lint(self):
        bad = []
        for (a0, a1, b0, b1, nm) in self.placed:
            for (dr, dc) in self.doors:
                if b0 <= dc <= b1 and dr <= a1 <= dr + 3: bad.append((nm, dc))
        return bad
