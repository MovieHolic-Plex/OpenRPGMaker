"""동굴 벽 오토타일 미리보기: 바닥 위 알약형 고원 몇 개를 큰 배율로 그린다. 사용: python3 cave_preview.py <out.png> [scale]"""
import json
import sys
from pathlib import Path

B = Path(__file__).resolve().parents[4]
sys.path[:0] = [str(B / "src/harnesses/tileset-authoring/lib"), str(B / "src/harnesses/tileset-authoring/recipes")]
import px  # noqa: E402
from px import N, E, S, W, NE, SE, SW, NW  # noqa: E402
from PIL import Image  # noqa: E402

s = json.load(open(B / "harness-data/tileset-authoring/monster-overworld/seed.json"))
import monster_overworld as mo  # noqa: E402
import cave  # noqa: E402

P = mo.palette(s); mo.build(s); cave.init_floor(P)
W_, H_ = 18, 9
islands = [(1, 1, 5, 3), (7, 1, 9, 6), (11, 1, 16, 4), (1, 5, 4, 7)]
lay = [[any(a <= x <= c and b <= y <= d for a, b, c, d in islands) for x in range(W_)] for y in range(H_)]
im = Image.new("RGBA", (W_ * 16, H_ * 16))
for y in range(H_):
    for x in range(W_):
        if lay[y][x]:
            m = 0
            for bit, dx, dy in ((N, 0, -1), (E, 1, 0), (S, 0, 1), (W, -1, 0), (NE, 1, -1), (SE, 1, 1), (SW, -1, 1), (NW, -1, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < W_ and 0 <= ny < H_ and lay[ny][nx]:
                    m |= bit
            t = cave.wall_cell(P, px.canon(m))
        else:
            t = cave.floor_shadow(P) if y > 0 and lay[y - 1][x] else cave.floor_tex(P, (x + y) % 2)
        im.paste(t, (x * 16, y * 16))
k = int(sys.argv[2]) if len(sys.argv) > 2 else 6
im.resize((im.width * k, im.height * k), 0).save(sys.argv[1])
