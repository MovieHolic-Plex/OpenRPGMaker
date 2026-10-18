# 천장 띠 안쪽 모서리 조각 굽기(append-only) — 2026-10-18 사용자 "천장 오토타일이 이상함".
#
# 천장 띠 한 칸은 동서남북 이웃(실내 바닥이면 그 쪽에 몰딩)만 보고 32 조각 중 하나를 골랐다. 칸막이가 바깥 벽 띠와
# T 자로 만나는 칸·ㄱ자로 꺾이는 칸은 네 이웃이 모두 막혔으니 몰딩 없는 민짜가 되고, 옆 칸에서 오던 남쪽 몰딩과
# 칸막이 양옆 몰딩이 그 칸 모서리에서 3~4px 끊겨 보였다. 대각선 이웃이 바닥이고 그 대각선을 낀 두 이웃이 막힌
# 모서리(안쪽 모서리)에 몰딩을 이어 그린 조각을 굽고, 사양에 ceilingCorners["default"]["<기본 비트>:<모서리 비트>"] 로 단다.
# 모서리 비트: 1 남서 · 2 남동 · 4 북서 · 8 북동. 빌더(handInteriorStructure)가 모서리 비트가 있으면 이 표를 먼저 본다.
#
# 다시 구우면 이미 있는 표를 그대로 두고 끝낸다. 실행: python3 scripts/content/modern-city-int/bake_ceiling_corners.py
import json, sys
from PIL import Image

REPO = __file__.rsplit('/scripts/', 1)[0]
PNG = f'{REPO}/public/assets/modern-city/modern-city-chipset.png'
TS = f'{REPO}/src/assets/modernCityTileset.json'
RS = f'{REPO}/src/assets/modernCityRoomSpec.json'
SH = f'{REPO}/src/assets/modernCitySheet.json'


def main():
    sheet = Image.open(PNG).convert('RGBA')
    ts = json.load(open(TS)); rs = json.load(open(RS))
    cols = ts['tilesPerRow']
    if rs.get('ceilingCorners'):
        sys.exit('already baked')
    base = rs['ceilings']['default']
    tile = lambda t: sheet.crop(((t % cols) * 16, (t // cols) * 16, (t % cols) * 16 + 16, (t // cols) * 16 + 16))
    S, N, W, E = tile(base[1]), tile(base[2]), tile(base[4]), tile(base[8])
    H = [S.getpixel((8, y)) for y in range(12, 16)]        # 남쪽 몰딩 4줄(위->아래, 마지막이 바닥 쪽 테)
    NV = [N.getpixel((8, y)) for y in range(0, 2)]         # 북쪽 테 2줄(바닥 쪽 테가 먼저)
    VW = [W.getpixel((x, 8)) for x in range(0, 3)]         # 서쪽 몰딩 3열(바닥 쪽 테가 먼저)
    VE = [E.getpixel((x, 8)) for x in range(13, 16)]       # 동쪽 몰딩 3열(마지막이 바닥 쪽 테)

    def corner(im, d):
        px = im.load()
        if d & 1:   # 남서: 서쪽 몰딩이 남쪽 몰딩으로 꺾인다
            for y in range(12, 16):
                for x in range(0, 3): px[x, y] = VW[x] if x <= 15 - y else H[y - 12]
        if d & 2:   # 남동
            for y in range(12, 16):
                for x in range(13, 16): px[x, y] = VE[x - 13] if 15 - x <= 15 - y else H[y - 12]
        if d & 4:   # 북서
            for y in range(0, 2):
                for x in range(0, 3): px[x, y] = VW[x] if x <= y else NV[y]
        if d & 8:   # 북동
            for y in range(0, 2):
                for x in range(13, 16): px[x, y] = VE[x - 13] if 15 - x <= y else NV[y]
        return im

    new, table = [], {}
    for b in range(32):
        s, n, w, e = b & 1, b & 2, b & 4, b & 8
        valid = (0 if s or w else 1) | (0 if s or e else 2) | (0 if n or w else 4) | (0 if n or e else 8)
        for d in range(1, 16):
            if d & ~valid: continue
            table[f'{b}:{d}'] = ts['count'] + len(new)
            new.append(corner(tile(base[b]).copy(), d))
    n0 = ts['count']; n = n0 + len(new)
    rows = (n + cols - 1) // cols
    out = Image.new('RGBA', (cols * 16, max(sheet.height, rows * 16)), (0, 0, 0, 0)); out.paste(sheet, (0, 0))
    for i, im in enumerate(new):
        t = n0 + i; out.paste(im, ((t % cols) * 16, (t // cols) * 16))
    out.save(PNG, optimize=True)
    src = base[0]
    for i in range(len(new)):
        ts['passability'].append(dict(ts['passability'][src])); ts['priority'].append(ts['priority'][src]); ts['terrain'].append(ts['terrain'][src])
        m = dict(ts['tileMeta'][src]); m['label'] = f"기본 천장 띠 안쪽 모서리 {list(table)[i]}"; ts['tileMeta'].append(m)
    ts['count'] = n
    rs['ceilingCorners'] = {'default': table}
    dump = lambda o, ea=False: json.dumps(o, ensure_ascii=ea, separators=(',', ':'))
    open(TS, 'w').write(dump(ts) + '\n'); open(RS, 'w').write(dump(rs, True) + '\n')
    open(SH, 'w').write('{"count": %d,"tilesPerRow": %d}\n' % (n, cols))
    print('baked', len(new), 'ceiling corner tiles', n0, '->', n)


if __name__ == '__main__':
    main()
