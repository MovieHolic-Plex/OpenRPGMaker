"""야외 셋째 묶음 — 안개 이끼 땅·진흙·낙엽 바닥, 이끼 오토타일, 바닥 덧그림(뿌리·금·의식 원·화환·핏자국),
고사목 둘(까마귀·그네), 쓰러진 통나무·가시덤불·돌무더기·마른 갈대·호박 등불, 무덤가 촛불, 유령·까마귀·검은 고양이, 손수레·삽, 작은 묘비."""
import os, sys, math, random
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from gmlib import REG, Cv, K, run_module   # noqa: E402
from gmdraw import *                         # noqa: E402,F403
from gy_props import dead_tree, branch, plinth, headstone   # noqa: E402
from terrain import grass_px, _patch, h16   # noqa: E402

MODULE = 'yard3'
SP = 'grounds'
GY = 'graveyard'


# ───────────────────────── 바닥(16 주기) ─────────────────────────
def moss_px(x, y, v=0):
    """안개 낀 이끼 땅: 짙은 이끼 바탕 2~3, 둥근 이끼 덩이(밝은 윗면), 이슬 맺힌 창백한 점."""
    lx, ly = x % 16, y % 16
    t = 2 if h16(lx // 2, ly // 2, 81 + v) < .45 else 3
    for (cx, cy) in (((3, 4), (11, 3), (7, 10), (14, 12)) if v == 0 else ((5, 2), (12, 8), (2, 12), (9, 14))):
        d = (lx - cx) ** 2 + (ly - cy) ** 2 * 1.6
        if d < 5: return K('ivy', 4 if ly < cy else 3)
        if d < 8 and ly > cy: return K('ivy', 1)
    if h16(lx, ly, 83 + v) < .05: return K('fog', 3)
    return K('ivy', t)


def mud_px(x, y):
    """젖은 진흙: 어두운 흙 1~2 바탕에 번들거리는 물기(하늘빛 반사)와 발자국 패임."""
    lx, ly = x % 16, y % 16
    v = h16(lx // 3, ly // 2, 91)
    t = 1 if v < .35 else 2 if v < .8 else 3
    if (lx, ly) in ((4, 5), (5, 5), (11, 10), (12, 10)): return K('water', 4)
    if (lx, ly) in ((3, 5), (10, 10)): return K('water', 3)
    if ly in (13, 14) and lx in (6, 7, 8): return K('dirt', 0)
    return K('dirt', t)


def leaves_px(x, y):
    """낙엽 깔린 땅: 검붉은·누런·갈색 잎 조각이 바닥을 덮는다."""
    lx, ly = x % 16, y % 16
    h = h16(lx // 2, ly // 2, 95)
    m = 'velvet' if h < .3 else 'gold' if h < .5 else 'bark'
    t = 3 if (lx + ly) % 3 else 4
    if h16(lx, ly, 96) < .18: return K('bark', 1)
    if h16(lx, ly, 97) < .08: return K(m, 5)
    return K(m, t if m != 'gold' else t - 1)


def _floor(id, name, desc, tags, px, space=SP):
    REG.piece(id, name, 1, 1, ['F'], 'surfaces', space, role='terrain', kind='terrain', repeat=True, tags=tags, desc=desc,
              rules='바탕 땅으로 넓게, 또는 풀밭 사이에 덩이로. 16 주기라 이음새가 없다.')(lambda c: [c.P(x, y, px(x, y)) for y in range(16) for x in range(16)])


_floor('gm-ground-moss-a', '안개 이끼 땅 A', '짙은 이끼가 융단처럼 덮인 축축한 땅(둥근 이끼 덩이·이슬).', ['이끼', '땅', '안개'], lambda x, y: moss_px(x, y, 0), GY)
_floor('gm-ground-moss-b', '안개 이끼 땅 B', '이끼 땅 변형(덩이 자리가 다르다).', ['이끼', '땅', '안개'], lambda x, y: moss_px(x, y, 1), GY)
_floor('gm-ground-mud', '젖은 진흙 땅', '번들거리는 물기와 발자국 패임이 있는 검은 진흙.', ['진흙', '땅'], mud_px)
_floor('gm-ground-leaves', '낙엽 덮인 땅', '검붉은·누런 낙엽이 빈틈없이 깔린 땅.', ['낙엽', '땅', '가을'], leaves_px)


@REG.autotile('gm-fogmoss', '안개 이끼 덩이(풀밭 가장자리)', 'surfaces', GY, desc='짙은 이끼 융단이 마른 풀밭을 먹어 들어간 땅. 경계에 창백한 안개 이슬 테.',
              rules='묘지·고사목 숲·연못가 그늘에 넓은 덩이로. fill_region·붓이 이웃에 맞춰 고른다.', tags=['이끼', '안개', '땅'])
def _fogmoss():
    return _patch(lambda x, y: moss_px(x, y, 0), lambda x, y: grass_px(x, y, 0),
                  rim_in=lambda x, y: K('fog', 2 if h16(x, y, 7) < .5 else 1), rim_out=lambda x, y: K('ivy', 1), wob=1.6, seed=5.2)


# ───────────────────────── 바닥 덧그림 ─────────────────────────
@REG.piece('gm-ov-cracks', '갈라진 땅·포석 금(덧그림)', 1, 1, ['f'], 'surfaces', SP, role='terrain', kind='flat', tags=['금', '덧그림', '폐허'],
           desc='땅·포석에 번개처럼 갈라진 검은 금과 부스러기.', rules='폐허·오래된 광장·무덤 앞에.')
def _cracks(c):
    for (x, y, dx, dy, n) in ((2, 3, 1, 1, 6), (7, 8, 1, -1, 4), (7, 8, 1, 1, 6), (12, 13, 1, 0, 3)):
        for k in range(n):
            c.P(x, y, K('ink', 1)); c.P(x + 1, y, K('stone', 1))
            x += dx; y += dy if k % 2 == 0 else 0
    for (x, y) in ((4, 9), (11, 4), (13, 10)): c.P(x, y, K('stone', 4))


@REG.piece('gm-ov-ritual', '바닥 의식 원(백묵·핏빛 문양·녹은 초)', 2, 2, ['ff', 'ff'], 'surfaces', SP, role='terrain', kind='flat', tags=['의식', '마법진', '공포', '덧그림'],
           desc='바닥에 그린 백묵 이중 원과 핏빛 별 문양, 원 둘레의 녹아 내린 초 동강 다섯(위에서 보이는 촛농 웅덩이).', rules='지하실·폐허·숲속 공터 바닥 가운데. 사건 장소.')
def _ritual(c):
    for r, t in ((13.5, 5), (11.5, 4)):
        for k in range(160):
            a = k * 2 * math.pi / 160
            c.P(int(16 + math.cos(a) * r), int(16 + math.sin(a) * r * .8), K('bone', t))
    pts = [(16 + math.cos(-math.pi / 2 + k * 4 * math.pi / 5) * 10, 16 + math.sin(-math.pi / 2 + k * 4 * math.pi / 5) * 8) for k in range(6)]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]): c.line(int(x0), int(y0), int(x1), int(y1), K('velvet', 3))
    for k in range(5):
        a = -math.pi / 2 + k * 2 * math.pi / 5; x = int(16 + math.cos(a) * 13.5); y = int(16 + math.sin(a) * 10.8)
        c.ellipse(x, y + 1, 2, 1, K('paper', 5)); c.P(x, y, K('paper', 6)); c.P(x, y - 1, K('glow', 5))


@REG.piece('gm-ov-blood', '핏자국(끌린 자국·방울)', 1, 1, ['f'], 'surfaces', 'shared', role='terrain', kind='flat', tags=['피', '공포', '단서', '덧그림'],
           desc='바닥에 끌린 검붉은 핏자국과 떨어진 방울.', rules='공포 단서. 문 앞·계단·지하실 쪽으로 이어지게 두세 칸.')
def _blood(c):
    for y in range(2, 14):
        x = 7 + int(math.sin(y * .5) * 1.5)
        c.P(x, y, K('velvet', 2)); c.P(x + 1, y, K('velvet', 1 if y % 3 else 2))
    for (x, y) in ((3, 4), (12, 6), (11, 13), (4, 12)): c.P(x, y, K('velvet', 2)); c.P(x, y + 1, K('velvet', 1))


# ───────────────────────── 나무·덤불·돌 ─────────────────────────
@REG.piece('gm-dead-tree-crows', '까마귀 앉은 고사목', 3, 4, 'auto', 'nature', GY, role='prop', kind='organic',
           tags=['고사목', '나무', '까마귀'], desc='넓게 뻗은 뒤틀린 고사목 가지에 까마귀 셋이 앉아 있다.', rules='묘지 입구·예배당 옆에 한 그루.')
def _tree_crows(c):
    dead_tree(c, 22, 61, 58, 1.15, seed=17, th=8, depth=3)
    for (x, y) in ((9, 14), (33, 10), (24, 6)):
        c.ellipse(x, y, 2.6, 1.8, K('ink', 1)); c.P(x - 2, y - 2, K('ink', 2)); c.P(x - 3, y - 2, K('gold', 4)); c.P(x - 2, y - 3, K('ink', 2))
        c.P(x + 2, y + 1, K('ink', 0)); c.P(x - 1, y - 1, K('iron', 3))
    finish(c, tex=True, soft=True)


@REG.piece('gm-dead-tree-swing', '그네 매달린 고목', 3, 4, 'auto', 'nature', SP, role='prop', kind='organic',
           tags=['고사목', '그네', '공포'], desc='굵은 가로 가지에 낡은 밧줄 그네가 매달린 고목(판자 윗면이 보이는 그네).', rules='버려진 정원·고아원 마당에 한 그루.')
def _tree_swing(c):
    dead_tree(c, 12, 61, 52, .8, seed=33, th=8, depth=2)
    for k in range(34):                                    # 오른쪽으로 뻗은 굵은 가로 가지
        y = 18 - int(math.sin(k / 34 * math.pi) * 3)
        for d in range(4 - k // 12): c.P(12 + k, y + d, K('bark', 4 if d == 0 else 2))
    for x in (31, 39):
        c.VL(x, 20, 26, K('paper', 3)); c.VL(x + 1, 22, 23, K('paper', 2))
    c.R(29, 45, 13, 3, K('wood', 5)); c.HL(29, 45, 13, K('wood', 6)); c.R(29, 48, 13, 2, K('wood', 2))
    finish(c, tex=True, soft=True)


@REG.piece('gm-fallen-log', '쓰러진 고목 통나무(버섯)', 3, 1, 'auto', 'nature', SP, role='prop', kind='organic',
           tags=['통나무', '나무', '버섯'], desc='이끼 낀 쓰러진 통나무: 둥근 등이 위에서 보이고, 잘린 끝 나이테, 선반 버섯.', rules='숲 가장자리·묘지 뒤편에 가로로.')
def _log(c):
    for x in range(3, 44):
        for y in range(4, 14):
            u = (y - 4) / 9
            c.P(x, y, K('bark', 5 if u < .25 else 4 if u < .5 else 2 if u < .8 else 1))
        if x % 7 == 0: c.VL(x, 5, 6, K('bark', 2))
    c.ellipse(43, 9, 3, 5, K('wood', 4)); c.ellipse(43, 9, 1.6, 3, K('wood', 3), fill=False); c.P(43, 9, K('wood', 2))
    moss_top(c, 6, 4, 30, seed=3, amount=.5)
    for (x, y) in ((14, 12), (27, 11), (34, 12)): c.HL(x - 1, y, 3, K('paper', 4)); c.P(x - 1, y - 1, K('paper', 5))
    finish(c, tex=True)


@REG.piece('gm-thornbush', '가시나무 덤불', 1, 1, ['S'], 'nature', SP, role='prop', kind='organic', tags=['가시', '덤불'],
           desc='검은 가시 줄기가 엉킨 둥근 덤불(위가 밝고 속이 어둡다).', rules='담 밑·무덤 사이에 덩이로.')
def _thorn(c):
    rnd = random.Random(44)
    c.ellipse(8, 10, 6.5, 4.5, K('bark', 1))
    for k in range(14):
        branch(c, 8 + rnd.uniform(-3, 3), 14, -math.pi / 2 + rnd.uniform(-1.2, 1.2), rnd.uniform(4, 8), 1.4, 1, rnd)
    for (x, y) in ((4, 6), (11, 4), (13, 8), (6, 3)): c.P(x, y, K('bark', 5)); c.P(x + 1, y - 1, K('bone', 4))
    finish(c, tex=True)


@REG.piece('gm-rocks-small', '돌무더기', 1, 1, ['S'], 'nature', SP, role='prop', kind='organic', tags=['돌', '바위'],
           desc='모난 돌 셋이 모인 작은 돌무더기(윗면 밝음).', rules='길가·무너진 담 곁에.')
def _rocks(c):
    for (x, y, r) in ((5, 10, 3.6), (11, 11, 3), (8, 6, 2.6)):
        c.ellipse(x, y + 1, r, r * .7, K('stone', 2)); c.ellipse(x, y, r, r * .7, K('stone', 4)); c.ellipse(x - .8, y - .8, r * .55, r * .35, K('stone', 6))
    finish(c, tex=True)


@REG.piece('gm-reeds-dead', '마른 갈대', 1, 1, ['S'], 'nature', SP, role='prop', kind='organic', tags=['갈대', '물가'],
           desc='연못가 마른 갈대 다발(누런 이삭).', rules='연못(gm-pond) 테 바로 바깥에 줄지어.')
def _reeds(c):
    rnd = random.Random(52)
    for k in range(11):
        x = 2 + k * 1.15 + rnd.uniform(-.3, .3); a = -math.pi / 2 + rnd.uniform(-.4, .4); L = rnd.randint(7, 13)
        for s in range(L):
            c.P(int(round(x + math.cos(a) * s)), int(15 + math.sin(a) * s), K('grass', 4 if s < 3 else 5 if s % 3 else 3))
        tx, ty = int(round(x + math.cos(a) * L)), int(15 + math.sin(a) * L)
        if k % 2 == 0: c.P(tx, ty, K('gold', 4)); c.P(tx, ty - 1, K('gold', 5)); c.P(tx, ty + 1, K('gold', 3))
    for x in range(2, 15): c.P(x, 15, K('grass', 1))


@REG.piece('gm-pumpkin-lantern', '호박 등불(깜빡임 3프레임)', 1, 1, ['S'], 'nature', SP, role='prop', kind='organic', frames=3, fps=4,
           tags=['호박', '등불', '애니메이션'], desc='눈·입을 파낸 큰 호박 속에서 촛불이 깜빡인다(꼭지 윗면).', rules='현관 계단·길가·밭에 하나둘.')
def _pumpkin(c, f):
    for y in range(5, 15):
        for x in range(2, 14):
            if ((x - 8) / 6.2) ** 2 + ((y - 10) / 5) ** 2 > 1: continue
            rib = (x - 2) % 4
            c.P(x, y, K('glow', 3 if rib in (1, 2) else 2) if y > 6 else K('glow', 4))
    for x in (4, 8, 12): c.VL(x, 6, 8, K('glow', 1))
    g = (5, 6, 5)[f]
    for (x, y) in ((5, 8), (6, 8), (10, 8), (11, 8)): c.P(x, y, K('glow', g))
    for x in range(5, 12): c.P(x, 12 if x in (5, 11) else 11 + (x % 2), K('glow', g))
    c.R(7, 3, 2, 3, K('ivy', 3)); c.P(7, 3, K('ivy', 5))
    finish(c)


@REG.piece('gm-wheelbarrow', '묘지기 손수레(흙·삽)', 2, 1, ['SS'], 'nature', GY, role='prop', kind='container',
           tags=['손수레', '묘지기', '흙'], desc='나무 손수레: 위에서 들여다보이는 통 안 흙 더미(아가리 6행), 앞 쇠바퀴, 뒤 손잡이 둘, 기대 놓은 삽.',
           rules='파헤친 무덤(gm-grave-open)·묘지기 오두막 곁에.')
def _barrow(c):
    c.poly([(3, 2), (22, 2), (26, 11), (6, 12)], K('wood', 4))
    c.poly([(5, 3), (21, 3), (24, 10), (7, 10)], K('dirt', 2)); c.ellipse(14, 6, 6, 2.2, K('dirt', 4)); c.ellipse(13, 5, 3, 1, K('dirt', 5))
    c.line(3, 2, 22, 2, K('wood', 6)); c.line(6, 12, 26, 11, K('wood', 2))
    c.ellipse(28, 11, 3, 3.6, K('iron', 2)); c.ellipse(28, 11, 1.4, 1.8, K('iron', 4))
    c.line(3, 3, 0, 13, K('wood', 3)); c.line(8, 11, 6, 14, K('wood', 2))
    c.line(17, 1, 25, 6, K('wood', 5)); c.R(25, 5, 4, 3, K('iron', 4))
    finish(c, tex=True)


@REG.piece('gm-shovel-mound', '흙더미에 꽂힌 삽', 1, 1, ['S'], 'nature', GY, role='prop', kind='debris',
           tags=['삽', '흙', '묘지기'], desc='파낸 흙 더미(위가 밝은 둥근 덩이)에 꽂아 둔 묘지기 삽.', rules='파헤친 무덤 곁에.')
def _shovel(c):
    c.ellipse(8, 12, 6.5, 3.2, K('dirt', 2)); c.ellipse(8, 11, 6, 2.8, K('dirt', 4)); c.ellipse(7, 10, 3, 1.3, K('dirt', 5))
    c.line(10, 1, 9, 9, K('wood', 4)); c.line(11, 1, 10, 9, K('wood', 2)); c.HL(9, 1, 4, K('wood', 5))
    c.R(7, 8, 5, 3, K('iron', 4)); c.HL(7, 8, 5, K('iron', 6))
    finish(c, tex=True)


if __name__ == '__main__':
    sys.exit(1 if run_module(MODULE) else 0)
