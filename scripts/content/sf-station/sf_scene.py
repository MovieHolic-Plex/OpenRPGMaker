"""sf_station 장면 조립기 — 조각으로 원본 해상도 장면을 만든다(적대 시각 QA·참고문서 예제 그림 공용).

    s = Scene(30, 20, ground=('sidewalk', 0))
    s.fill('road', x, y, w, h)            # 낱칸 바닥(변형 묶음 id, 변형 번호는 위치 해시)
    s.auto('at-road', x, y, w, h)         # 4방향 오토타일(마스크 = N1 E2 S4 W8)
    s.put('street-tower-s', x, y)         # 조각(왼쪽 위 칸 좌표). 그리는 순서 = 아래 끝 행 순
    s.render() -> PIL RGBA (W*16 × H*16)
"""
import sf_all  # noqa: F401  (조각 등록)
import sf_core as C
from PIL import Image

_cache = {}


def img(pid):
    if pid not in _cache: _cache[pid] = Image.fromarray(C.render(C.PIECES[pid]), 'RGBA')
    return _cache[pid]


def cell(pid, cx, cy):
    return img(pid).crop((cx * 16, cy * 16, cx * 16 + 16, cy * 16 + 16))


class Scene:
    def __init__(s, W, H, ground=('deck-plate', None), bg=(0, 0, 0, 255)):
        s.W, s.H = W, H; s.bg = bg
        s.ground = [[ground for _ in range(W)] for _ in range(H)]
        s.autos = {}          # gid -> set((x,y))
        s.order = []          # auto 그리는 순서
        s.objs = []           # (pid, x, y)

    def fill(s, pid, x, y, w, h, v=None):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                if 0 <= xx < s.W and 0 <= yy < s.H: s.ground[yy][xx] = (pid, v)

    def auto(s, gid, x, y, w, h):
        st = s.autos.setdefault(gid, set())
        if gid not in s.order: s.order.append(gid)
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                if 0 <= xx < s.W and 0 <= yy < s.H: st.add((xx, yy))

    def unauto(s, gid, x, y, w, h):
        st = s.autos.get(gid, set())
        for yy in range(y, y + h):
            for xx in range(x, x + w): st.discard((xx, yy))

    def over(s, pid, x, y, w, h, v=None):
        """오토타일 위에 다시 까는 아래층 바닥(횡단보도처럼 도로 오토타일 안의 칸). 오토타일 이웃 판정에는 그대로 도로로 센다."""
        s.overs = getattr(s, 'overs', []) + [(pid, x, y, w, h, v)]

    def put(s, pid, x, y):
        assert pid in C.PIECES, pid
        s.objs.append((pid, x, y))

    def ground_cell(s, x, y):
        pid, v = s.ground[y][x]
        p = C.PIECES[pid]; n = p['w'] * p['h']
        if v is None:
            v = C.hsh(x, y, 5) % (p['w']) if n > 1 else 0
            if v != 0 and C.hsh(x, y, 9) % 3: v = 0                 # 변형은 드물게(같은 판이 주)
        return cell(pid, v % p['w'], v // p['w'])

    def render(s):
        out = Image.new('RGBA', (s.W * 16, s.H * 16), s.bg)
        for y in range(s.H):
            for x in range(s.W):
                if s.ground[y][x][0]: out.alpha_composite(s.ground_cell(x, y), (x * 16, y * 16))
        for gid in s.order:
            st = s.autos[gid]
            for (x, y) in st:
                m = (1 if (x, y - 1) in st or y == 0 else 0) | (2 if (x + 1, y) in st or x == s.W - 1 else 0) | (4 if (x, y + 1) in st or y == s.H - 1 else 0) | (8 if (x - 1, y) in st or x == 0 else 0)
                out.alpha_composite(cell(gid, m % 4, m // 4), (x * 16, y * 16))
        for pid, x0, y0, w, h, v in getattr(s, 'overs', []):
            p = C.PIECES[pid]
            for y in range(y0, y0 + h):
                for x in range(x0, x0 + w):
                    vv = v if v is not None else 0
                    out.alpha_composite(cell(pid, vv % p['w'], vv // p['w']), (x * 16, y * 16))
        for pid, x, y in sorted(s.objs, key=lambda o: (o[2] + C.PIECES[o[0]]['h'], C.PIECES[o[0]]['kind'] not in ('flat',), o[1])):
            p = C.PIECES[pid]
            if p['kind'] == 'flat': pass
            out.alpha_composite(img(pid), (x * 16, y * 16))
        return out

    def occupancy(s):
        """조각 칸 겹침 검사: [(pid_a, pid_b, (x,y))] — 불투명 칸이 둘 이상 조각에 속하면 겹침."""
        own = {}; bad = []
        for pid, x, y in s.objs:
            p = C.PIECES[pid]
            if p['kind'] in ('flat', 'wall_mounted'): continue
            a = C.render(p)
            for cy in range(p['h']):
                for cx in range(p['w']):
                    if a[cy * 16:(cy + 1) * 16, cx * 16:(cx + 1) * 16, 3].max() == 0: continue
                    k = (x + cx, y + cy)
                    if k in own: bad.append((own[k], pid, k))
                    else: own[k] = pid
        return bad


def save(im, path, z=3):
    im.save(path)
    if z > 1: im.resize((im.width * z, im.height * z), Image.NEAREST).save(path.replace('.png', '@%dx.png' % z))
