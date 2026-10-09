# 예시 장면 둘(던전 입구 방 · 마을 광장)과 카탈로그 시트. 바닥·벽·천장·집·나무는 기존 버들항 그림을 읽기만 해서 쓴다:
#  - 던전: _lib3/dlib 의 성채 판석 바닥(floor_tile 'castle'), 성채 벽 앞면(face_tile 'castle', 3줄), 천장 띠(ceiling).
#  - 마을: 버들항 집·여관·나무·가로등(bdv: tiledata/beodeul-city/render/objects), 풀밭(plains-highroad ground-meadow),
#          자갈 포장(empire-city ground-cobble).
# 이벤트 소품은 이 폴더 parts/ 의 그림(띠는 첫 프레임). 걷기 격자는 키트 메타(kind·brows)대로 막는다.
import os, math
import numpy as np
from PIL import Image, ImageDraw
from ev_base import *
from ev_base import _hash
sys.path.insert(0, os.path.join(VAR, '_lib3'))
import dlib                                          # noqa: E402  (읽기만)
sys.path.insert(0, VAR)
import bdv                                           # noqa: E402  (읽기만)


def frame0(name, im):
    return im.crop((0, 0, im.width // 4, im.height)) if name.endswith('-strip') else im


class Scene:
    def __init__(s, W, H):
        s.W, s.H = W, H
        s.ground = new(W * T, H * T)
        s.objs = []                                  # (정렬 키, 그림, px, py)
        s.walk = np.ones((H, W), bool)
        s.marks = {}

    def tile(s, img, x, y): s.ground.alpha_composite(img.convert('RGBA'), (x * T, y * T))

    def block(s, x0, y0, x1, y1):
        s.walk[max(0, y0):y1 + 1, max(0, x0):x1 + 1] = False

    def put(s, img, x, ybot, kind='object', brows=1, layer=1, dy=0, name=None):
        """img 의 왼쪽 아래 칸을 (x, ybot) 에. kind: object(아래 brows 줄 중 그림이 칠해진 칸 막힘) · decal/walk(걸음) · wall(이미 막힌 벽 위 덧그림)."""
        w = -(-img.width // T); h = -(-img.height // T)
        px = x * T; py = (ybot + 1) * T - img.height + dy
        s.objs.append(((0 if kind in ('decal', 'walk') else layer), ybot, len(s.objs), img, px, py))
        if kind == 'object':
            a = np.array(img)[..., 3]
            for r in range(brows):
                row = ybot - r
                for cx in range(w):
                    yy0 = img.height - (r + 1) * T; sl = a[max(0, yy0):yy0 + T, cx * T:(cx + 1) * T]
                    if sl.size and (sl > 0).sum() > 12 and 0 <= row < s.H and 0 <= x + cx < s.W: s.walk[row, x + cx] = False
        if name: s.marks[name] = (x, ybot)

    def render(s):
        im = s.ground.copy()
        for (_, _, _, img, px, py) in sorted(s.objs, key=lambda o: (o[0], o[1], o[2])):
            im.alpha_composite(img, (px, py))
        return im

    def reach(s, start):
        from collections import deque
        seen = np.zeros_like(s.walk); q = deque([start]); seen[start[1], start[0]] = True
        while q:
            x, y = q.popleft()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                X, Y = x + dx, y + dy
                if 0 <= X < s.W and 0 <= Y < s.H and s.walk[Y, X] and not seen[Y, X]: seen[Y, X] = True; q.append((X, Y))
        return seen


def _tiled_sample(path):
    return Image.open(os.path.join(VAR, path)).convert('RGBA')


def _sample_tile(sample, x, y):
    """48x48 바닥 표본(이음새 없음)에서 칸 (x,y) 자리 조각."""
    return sample.crop(((x % 3) * T, (y % 3) * T, (x % 3) * T + T, (y % 3) * T + T))


# ================================================================ 던전 입구 방 (16x12)
def dungeon(P, floor='cata'):
    W, H = 16, 12
    s = Scene(W, H)
    # 칸 종류: C 천장 · F 벽 앞면(3줄) · . 바닥. 남쪽 가운데 두 칸이 입구(바깥에서 내려오는 길).
    G = [['.'] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            if y == 0 or x == 0 or x == W - 1 or (y == H - 1 and x not in (7, 8)): G[y][x] = 'C'
            elif 1 <= y <= 3: G[y][x] = 'F'
    for y in (1, 2, 3, 4): G[y][1] = 'C'          # 왼쪽 위 한 칸 들어간 벽(상자 방이 되지 않게)
    G[10][14] = 'C'                               # 오른쪽 아래 모서리 깎기
    def is_open(x, y): return 0 <= x < W and 0 <= y < H and G[y][x] != 'C'
    for y in range(H):
        for x in range(W):
            if G[y][x] == '.':
                s.tile(dlib.floor_tile(floor, x, y), x, y)
            elif G[y][x] == 'F':
                n = y - 1
                capL = not (x - 1 >= 0 and G[y][x - 1] == 'F'); capR = not (x + 1 < W and G[y][x + 1] == 'F')
                s.tile(dlib.face_tile('castle', 'mid', n, x * 7 + 3, capL, capR, 48), x, y); s.walk[y, x] = False
            else:
                o8 = (is_open(x, y - 1), is_open(x + 1, y), is_open(x, y + 1), is_open(x - 1, y),
                      is_open(x + 1, y - 1), is_open(x + 1, y + 1), is_open(x - 1, y + 1), is_open(x - 1, y - 1))
                s.tile(dlib.ceiling(o8, seed=x + y), x, y); s.walk[y, x] = False
    I = lambda n: frame0(n, P[n])
    # 북쪽 벽: 가운데 봉인문 + 수호 석상 한 쌍 + 화로 한 쌍, 벽 횃불 둘. 오른쪽: 곁방 철문 + 레버.
    s.put(I('door_seal_closed-strip'), 7, 3, 'object', 1, name='seal_door')
    s.put(I('statue_guard'), 6, 4, 'object', 1); s.put(I('statue_guard'), 9, 4, 'object', 1)
    s.put(I('brazier-strip'), 5, 5, 'object', 1); s.put(I('brazier-strip'), 10, 5, 'object', 1)
    s.put(I('torch_wall-strip'), 3, 2, 'wall'); s.put(I('torch_wall-strip'), 10, 2, 'wall')
    s.put(I('door_iron_closed'), 12, 3, 'object', 1, name='iron_door'); s.put(I('lever_off'), 14, 4, 'object', 1, name='lever')
    # 왼쪽 쉼터: 저장 수정 + 회복 샘 + 상자
    s.put(I('save_crystal-strip'), 3, 5, 'object', 1, name='save')
    s.put(I('heal_spring-strip'), 1, 8, 'object', 2, name='heal')
    s.put(I('chest_iron'), 1, 10, 'object', 1); s.put(I('chest_wood_open'), 3, 10, 'object', 1)
    # 입구 옆: 이동 발판
    s.put(I('evfloor_warp_pad-strip'), 4, 9, 'decal', name='warp')
    # 오른쪽: 밀 돌덩이 퍼즐(바닥 스위치 둘 — 하나는 눌림) + 수정 스위치 + 금상자
    s.put(I('evfloor_plate_on'), 11, 7, 'decal'); s.put(I('evfloor_plate_off'), 13, 8, 'decal', name='plate')
    s.put(I('block_push'), 12, 7, 'object', 1); s.put(I('block_push'), 13, 6, 'object', 1, name='block')
    s.put(I('crystal_switch_blue'), 10, 9, 'object', 1)
    s.put(I('chest_gold'), 13, 10, 'object', 1, name='gold_chest')
    s.marks['entrance'] = (7, 11)
    return s


# ================================================================ 마을 광장 (24x16)
def town(P):
    W, H = 24, 16
    s = Scene(W, H)
    meadow = _tiled_sample('plains-highroad/parts/ground-meadow.png')
    cobble = _tiled_sample('empire-city/parts/ground-cobble.png')
    plaza = np.zeros((H, W), bool)
    plaza[8:14, 2:19] = True; plaza[7, 3:9] = True; plaza[7, 12:18] = True     # 집 앞 띠
    plaza[13:16, 10:12] = True                                                  # 남쪽 길
    plaza[8, 2] = plaza[13, 2] = plaza[13, 18] = False                          # 모서리 깎기
    for y in range(H):
        for x in range(W):
            s.tile(_sample_tile(cobble if plaza[y, x] else meadow, x, y), x, y)
    I = lambda n: frame0(n, P[n])
    # 북쪽 집 줄: 버들항 가게 집 + 여관
    for (name, x0, y0) in (('h101_0', 2, 2), ('inn', 12, 0)):
        hs = bdv.HOUSE[name]
        s.objs.append((1, y0 + max(c[1] for c in hs['cells']), len(s.objs), hs['im'], x0 * T + hs['dx'], y0 * T + hs['dy']))
        for (cx, cy) in hs['cells']:
            if (cx, cy) != hs['door']: s.walk[y0 + cy, x0 + cx] = False
        s.marks[name + '_door'] = (x0 + hs['door'][0], y0 + hs['door'][1])
    sx, sy = s.marks['h101_0_door']; ix, iy = s.marks['inn_door']
    s.put(I('shop_sign'), sx - 1, sy + 1, 'object', 1, name='shop_sign')
    s.put(I('inn_sign'), ix - 2, iy + 1, 'object', 1, name='inn_sign')
    # 광장: 가운데 회복 샘, 게시판, 표지판, 모닥불, 나무 상자, 버들항 가로등·벤치
    s.put(I('heal_spring-strip'), 9, 11, 'object', 2, name='heal')
    s.put(I('notice_board'), 6, 10, 'object', 1, name='notice')
    s.put(I('save_crystal-strip'), 14, 10, 'object', 1, name='save')
    s.put(bdv.sprite('lamp_double'), 4, 12, 'object', 1); s.put(bdv.sprite('lamp_double'), 15, 12, 'object', 1)
    s.put(bdv.sprite('bench_wood'), 12, 12, 'object', 1)
    s.put(I('chest_wood'), 17, 9, 'object', 1)
    s.put(I('sign_post'), 12, 14, 'object', 1, name='sign_post')
    # 동쪽 풀밭: 비행선 착륙장(둘레 트임) + 모닥불 야영
    s.put(I('landing_pad'), 20, 11, 'walk', name='landing_pad')
    s.put(I('campfire-strip'), 20, 14, 'object', 1)
    # 나무 덩이(버들항 나무, 일렬 금지)
    CAN = bdv.trees('canopy'); BUSH = bdv.trees('bush')
    for (im, x, yb) in ((CAN[0], 0, 15), (BUSH[1], 3, 15), (CAN[2], 20, 3), (BUSH[3], 22, 7), (BUSH[0], 13, 15), (CAN[1], 6, 16)):
        if yb >= H: yb = H - 1
        s.put(im, x, yb, 'object', 1)
    s.put(bdv.sprite('flowerbed'), 0, 7, 'object', 1)
    s.marks['entrance'] = (10, 15)
    return s


# ================================================================ 카탈로그 시트
def catalog(P, order, width=640):
    """키트를 한 장에: 칸마다 판(밝은 바닥 띠) 위에 그림, 띠는 4프레임을 나란히, 아래 번호. 번호 → 이름은 parts.md 순서."""
    pad = 6; lab = 10
    items = []
    for i, n in enumerate(order):
        im = P[n]
        items.append((i + 1, n, im))
    rows, cur, cw = [], [], 0
    for it in items:
        w = it[2].width + pad + (6 if it[1].endswith('-strip') else 0)
        if cw + w > width - pad and cur: rows.append(cur); cur, cw = [], 0
        cur.append(it); cw += w
    if cur: rows.append(cur)
    hts = [max(it[2].height for it in r) + lab + pad for r in rows]
    out = Image.new('RGBA', (width, sum(hts) + pad), (46, 44, 54, 255)); d = ImageDraw.Draw(out)
    y = pad
    for r, h in zip(rows, hts):
        x = pad
        for (k, n, im) in r:
            strip_ = n.endswith('-strip')
            bw = im.width + (6 if strip_ else 0)
            d.rectangle([x - 2, y - 2, x + bw + 1, y + h - lab - pad + 1], fill=(92, 98, 84, 255) if not n.startswith('evfloor_') else (78, 84, 92, 255))
            if strip_:
                fw = im.width // 4
                for f in range(4):
                    out.alpha_composite(im.crop((f * fw, 0, (f + 1) * fw, im.height)), (x + f * (fw + 2), y + (h - lab - pad) - im.height))
            else:
                out.alpha_composite(im, (x, y + (h - lab - pad) - im.height))
            d.text((x, y + h - lab - pad + 1), str(k), fill=(236, 230, 210, 255))
            x += bw + pad
        y += h
    return out
