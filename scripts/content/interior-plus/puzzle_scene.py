"""퍼즐 방 조각 조립 그림 — 심연 관문 그림(47 마스크를 화소 그대로 모두 품는다), 모의 장면, 판자 GIF, 비교판.

  python3 scripts/content/interior-plus/puzzle_scene.py <out_dir>   → pit-*.png · scene.png · plank.gif · board.png
관문(gate_rooms.pit_pictures)도 여기 pit_picture 를 쓴다 — 심연 칸을 한 화소라도 다시 그리면 그림 해시가 바뀌어 덮임이 풀린다.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import iplib
from PIL import Image

SPEC = os.path.join(iplib.ROOT, 'src/assets/handInteriorSpec.json')
D8 = [(0, -1), (1, -1), (1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1)]

# 관문 그림: 동굴 바닥 속 들쭉날쭉한 심연(47 마스크 모두) + 북→남 판자 길(멀쩡·금 감·떨어짐 1·2 가 한 번씩).
# '#' 구멍 · '.' 바닥 · 'p' 판자(멀쩡) · 'c' 금 감 · '1' '2' 떨어지는 중 (판자 글자 칸도 구멍이다)
PIT_GRIDS = {
    # 판자 다리가 걸린 큰 심연(섬 둘) — 먼 벽·입술·옆벽·안모서리 18 마스크
    'abyss-b': ['..............',
                '.....######...',
                '..##########..',
                '.####pp#####..',
                '.####cp######.',
                '.##..1p###.##.',
                '.###.2p##..##.',
                '..###pp###.#..',
                '...##pp####...',
                '..............'],
    # 무너져 내린 바닥 — 2×2 덩이·한 칸 폭 갈래·외딴 구멍·안모서리가 맞물린 자리(나머지 29 마스크 전부)
    'abyss-c': ['..............',
                '.#.#######.##.',
                '.####..######.',
                '.#.#####.#.#..',
                '.####..######.',
                '.###..####.#..',
                '.##.###.#.#.#.',
                '..##.#.######.',
                '.#.####.#####.',
                '..............'],
}
PLANK = {'p': 'plank bridge', 'c': 'plank bridge cracked', '1': 'plank bridge falling 1', '2': 'plank bridge falling 2'}


def _sheet():
    global _SH
    try: return _SH
    except NameError:
        _SH = Image.open(os.path.join(iplib.ROOT, 'public/assets/atlas-interior/interior-chipset.png')).convert('RGBA'); return _SH


def sheet_tile(n):
    return _sheet().crop(((n % 48) * 16, (n // 48) * 16, (n % 48) * 16 + 16, (n // 48) * 16 + 16))


def floor_of(spec, fid, x, y, sh=0):
    f = spec['floors'][fid]
    return sheet_tile(f['tiles'][((y % f['rows']) * f['cols'] + x % f['cols']) * 4 + sh])


def grid_masks(g, is_pit):
    H, W = len(g), len(g[0]); out = {}
    for y in range(H):
        for x in range(W):
            if not is_pit(g[y][x]): continue
            m = 0
            for i, (dx, dy) in enumerate(D8):
                X, Y = x + dx, y + dy
                if 0 <= X < W and 0 <= Y < H and is_pit(g[Y][X]): m |= 1 << i
            out[(x, y)] = iplib.pit_reduce(m)
    return out


PITCH = set('#pc12')


def pit_picture(reg, g, floor='cave', pit='abyss', extra=None):
    """격자 → 그림(팔레트 v6). 구멍 칸은 구운 칸과 같은 화소(iplib.pit_render)."""
    spec = json.load(open(SPEC)); pd = reg.pits[pit]
    H, W = len(g), len(g[0])
    im = Image.new('RGBA', (W * 16, H * 16), (0, 0, 0, 255))
    ms = grid_masks(g, lambda ch: ch in PITCH)
    for y in range(H):
        for x in range(W):
            ch = g[y][x]
            if (x, y) in ms:
                im.paste(iplib.pit_render(pd, ms[(x, y)]), (x * 16, y * 16))
            else:
                im.paste(floor_of(spec, floor, x, y), (x * 16, y * 16))
            if ch in PLANK:
                t = iplib.render(reg.pieces[PLANK[ch]]); im.alpha_composite(t, (x * 16, y * 16))
            if extra: extra(im, x, y, ch)
    return iplib.snap(im), set(ms.values())


def pit_pictures(reg):
    out = []
    for name, g in PIT_GRIDS.items():
        img, ms = pit_picture(reg, g)
        out.append(dict(label=f'atlas_biome_interior/plus/{name}', kind='terrain', img=img, masks=ms,
                        name={'abyss-b': '동굴 바닥 속 깊은 심연과 그 위 썩은 판자 다리(위에서 본 3/4 지형 — 먼 벽 바위 낯·가까운 바닥 입술·옆벽 띠)',
                              'abyss-c': '무너져 내려 구멍이 숭숭 뚫린 동굴 바닥(위에서 본 3/4 지형 — 먼 벽 바위 낯·가까운 바닥 입술·옆벽 띠)'}[name],
                        covers=[('pit', 'abyss')]))
    return out


# ───────── 모의 장면(20×10) ─────────
SCENE = ['....................',
         '.iiiiii.............',
         '.iiiiii...######....',
         '.iiiiii..#pp######..',
         '.iiiiii.##pp#######.',
         '.........##cp####...',
         '..A.B.C..##1p##.....',
         '..........#2p#......',
         '..D.E.F....pp.......',
         '....................']
WEIGHTS = {'A': 'weight stand', 'B': 'weight stand 1', 'C': 'weight stand 2', 'D': 'weight stand 3', 'E': 'weight stand 4', 'F': 'weight stand 5'}


def scene(reg):
    spec = json.load(open(SPEC))

    def extra(im, x, y, ch):
        if ch == 'i':
            fd = reg.floors['ice']
            import bake
            im.paste(bake.floor_tile(fd, (x - 1) % fd['cols'], (y - 1) % fd['rows'], 0), (x * 16, y * 16))
    img, _ = pit_picture(reg, SCENE, extra=extra)
    for y, row in enumerate(SCENE):
        for x, ch in enumerate(row):
            if ch in WEIGHTS:
                t = iplib.render(reg.pieces[WEIGHTS[ch]]); img.alpha_composite(t, (x * 16, (y + 1) * 16 - t.height))
    return img


def main(out):
    import loader
    reg = loader.load(); os.makedirs(out, exist_ok=True)
    allm = set()
    for p in pit_pictures(reg):
        p['img'].save(os.path.join(out, p['label'].split('/')[-1] + '.png')); allm |= p['masks']
    print('masks covered', len(allm), '/', len(iplib.PIT_MASKS))
    sc = scene(reg); sc.save(os.path.join(out, 'scene.png'))
    sc.resize((sc.width * 3, sc.height * 3), Image.NEAREST).save(os.path.join(out, 'scene3.png'))
    # 판자 GIF(동굴 심연 위, 8배)
    frames = []
    base, _ = pit_picture(reg, ['...', '.#.', '.#.', '...'])
    for pid in ['plank bridge', 'plank bridge cracked', 'plank bridge falling 1', 'plank bridge falling 2', None]:
        f = base.copy()
        if pid:
            t = iplib.render(reg.pieces[pid]); f.alpha_composite(t, (16, 16)); f.alpha_composite(iplib.render(reg.pieces['plank bridge']), (16, 32))
        else: f.alpha_composite(iplib.render(reg.pieces['plank bridge']), (16, 32))
        frames.append(f.resize((f.width * 8, f.height * 8), Image.NEAREST).convert('RGB'))
    frames[0].save(os.path.join(out, 'plank.gif'), save_all=True, append_images=frames[1:], duration=[600, 260, 180, 180, 700], loop=0)
    # 47 칸 표
    t = Image.new('RGBA', (12 * 18, 4 * 18), (90, 70, 50, 255))
    for i, m in enumerate(iplib.PIT_MASKS):
        t.paste(iplib.pit_render(reg.pits['abyss'], m), ((i % 12) * 18 + 1, (i // 12) * 18 + 1))
    t.resize((t.width * 4, t.height * 4), Image.NEAREST).save(os.path.join(out, 'pit47.png'))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '/tmp/pz')
