# 증기 도시 지도 장면: ec_scene.Scene(배치·통행·BFS·빈 바닥 창)을 그대로 쓰고, 바닥 합성과 오토타일만 이 장소 것으로 바꾼다.
# 칠하는 순서(조수가 따라 할 순서): 맨 바탕 표본(자갈·보도·광장·철판·재) → 땅 덩이 오토타일(기름·증기 물·석탄 가루)
# → 땅 장식 → 그림자 → 물체·건물(밑변 순, 무쇠 난간 오토타일 칸 포함) → 맨 위(김).
import numpy as np
from PIL import Image
from ec_scene import Scene as _Scene
from ec_base import cell_of
import sc_ground as SG
import sc_auto as SA


class Scene(_Scene):
    def __init__(s, W, H, seed=1):
        super().__init__(W, H, seed)
        z = lambda: np.zeros((H, W), bool)
        s.m = {k: z() for k in SG.LAYERS}
        s.blobs = {k: set() for k in ('autotile-oil-slick', 'autotile-steam-puddle', 'autotile-coal-dust')}
        s.auto = []

    def blob(s, name, cells, block=None):
        """땅 덩이 오토타일 칸을 더한다. 막힘 재질(증기 고인 물)은 통행도 막는다."""
        cells = {(x, y) for (x, y) in cells if 0 <= x < s.W and 0 <= y < s.H}
        s.blobs[name] |= cells
        if block if block is not None else not SA.PASSABLE[name]:
            for (x, y) in cells: s.block[y, x] = True

    def render(s):
        img = SG.compose(s.W, s.H, s.m, seed=s.seed)
        s.sheets = {n: SA.SHEETS[n]() for n in SA.SHEETS}
        for n in ('autotile-coal-dust', 'autotile-oil-slick', 'autotile-steam-puddle'):
            cells = s.blobs[n]; sh = s.sheets[n]
            for (x, y) in cells: img.alpha_composite(cell_of(sh, s._nb(cells, x, y)), (x * 16, y * 16))
        for (x, y, im) in s.decals:
            x0, y0 = max(0, x), max(0, y)
            img.alpha_composite(im.crop((x0 - x, y0 - y, im.width, im.height)), (x0, y0))
        objs = list(s.objs)
        fsh = s.sheets['autotile-iron-railing']
        for (x, y) in s.fence:
            objs.append(((y + 1) * 16, x * 16, y * 16, cell_of(fsh, s._nb(s.fence, x, y)), False))
        mask = Image.new('L', img.size, 0)
        for sy, x, y, im, sh in objs:
            if sh: mask.paste(255, (x + 6, y + 3), im.split()[3].point(lambda v: 255 if v > 128 else 0))
        SHM = np.array(mask) > 0
        A_ = np.array(img).astype(np.float64); A_[SHM, :3] = np.floor(A_[SHM, :3] * np.array((0.6, 0.6, 0.7)))
        img = Image.fromarray(A_.astype(np.uint8), 'RGBA').copy()
        for sy, x, y, im, sh in sorted(objs, key=lambda o: (o[0], o[1])):
            x0, y0 = max(0, x), max(0, y)
            img.alpha_composite(im.crop((x0 - x, y0 - y, im.width, im.height)), (x0, y0))
        for (x, y, im) in s.top:
            x0, y0 = max(0, x), max(0, y)
            img.alpha_composite(im.crop((x0 - x, y0 - y, im.width, im.height)), (x0, y0))
        s.img = img
        return img

    def empty(s, thresh=0.12):
        """빈 바닥 = 물체·장식·덩이가 덮지 않은 칸 중 '맨 차도 자갈'(포장 보도·광장·철판·재는 채움으로 센다)."""
        cov = s.coverage()
        e = cov < thresh
        filled = s.m['walk'] | s.m['plaza'] | s.m['plate'] | s.m['cinder']
        for c in s.fence | set().union(*s.blobs.values()): filled[c[1], c[0]] = True
        return e & ~filled

    def bare(s, thresh=0.12):
        """더 엄격한 척도: 포장 종류와 관계없이 아무것도 안 놓인 칸."""
        cov = s.coverage()
        e = cov < thresh
        for c in s.fence | set().union(*s.blobs.values()): e[c[1], c[0]] = False
        return e
