"""사냥터 지형·조각 검수용 미리보기 (저장소 도구: 눈으로 확인하는 그림을 만든다)."""
import sys
from PIL import Image
from tk import *
import fld_ground as FG
import water_blob as WB
import ground as G
from fld_ground import N, E, S, W

SCENE = [
    "..........................",
    "..tttttt....RRRRRR..bbbb..",
    "......t.....RRRRRR.bbbbbb.",
    "..gggg.t....RRRRRR.bbbbbb.",
    "..gggg.t....RRRRRR..bbbb..",
    "..gggg.tttttt.............",
    "......t.....ffffffff......",
    "......t.....ffffffff......",
    "..tttttt....ffffffff......",
    "..........................",
]


def build_scene(rows, cave=False):
    t = FG.terrain()
    H, Wd = len(rows), len(rows[0])
    g = {(x, y): rows[y][x] for y in range(H) for x in range(Wd)}
    face = set()
    for (x, y), k in list(g.items()):
        if k == 'R' and g.get((x, y + 1)) != 'R':
            face.add((x, y + 1)); face.add((x, y + 2))
    im = Image.new('RGBA', (Wd * T, (H + 3) * T))
    def mk(kind, x, y, extra=()):
        m = 0
        for bit, (dx, dy) in ((N, (0, -1)), (E, (1, 0)), (S, (0, 1)), (W, (-1, 0))):
            kk = g.get((x + dx, y + dy), '.')
            if kk in ((kind,) + tuple(extra)) or (kk == '#' and False): m |= bit
        return m
    for y in range(H + 3):
        for x in range(Wd):
            k = g.get((x, y), '.')
            if (x, y) in face and k != 'R':
                row = 0 if (x, y - 1) not in face else 1
                m = (1 if (x - 1, y) in face else 0) | (2 if (x + 1, y) in face else 0)
                c = t['fld_face32'][row * 4 + m]
            elif k == 'R':
                m = mk('R', x, y)
                if (x, y + 1) in face: m |= S
                c = t['fld_rock32'][m]
            elif k == 't': c = t['fld_trail32'][mk('t', x, y)]
            elif k == 'g': c = t['fld_tall32'][mk('g', x, y) + (16 if (x * 7 + y) % 5 == 0 else 0)]
            elif k == 'f': c = t['fld_forest32'][mk('f', x, y)]
            elif k == 'b':
                mm = 0
                for bit, (dx, dy) in ((WB.N, (0, -1)), (WB.E, (1, 0)), (WB.S, (0, 1)), (WB.W, (-1, 0)), (WB.NE, (1, -1)), (WB.SE, (1, 1)), (WB.SW, (-1, 1)), (WB.NW, (-1, -1))):
                    if g.get((x + dx, y + dy)) == 'b': mm |= bit
                c = t['fld_bog94'][WB.index47(mm) + 47 * ((x + y) % 2)]
            else: c = G.grass(hsh(x, y, 3) % 4)
            im.alpha_composite(c.img(), (x * T, y * T))
    return im


if __name__ == '__main__':
    im = build_scene(SCENE)
    im.resize((im.width * 3, im.height * 3), Image.NEAREST).convert('RGB').save(sys.argv[1] if len(sys.argv) > 1 else '/tmp/fld/scene.png')
