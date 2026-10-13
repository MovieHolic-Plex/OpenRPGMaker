"""정원·묘지의 작은 건물 — 문루·묘소·납골당 입구·종탑·마차고·헛간·온실·정자·폐탑·우물·분수."""
import os, sys, math, random
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from gmlib import REG, Cv, K, OL, OL2, run_module   # noqa: E402
from gmdraw import *
from _bld import range_roof                                  # noqa: E402,F403
from _bld import *                                    # noqa: E402,F403

MODULE = 'bld_misc'


@REG.piece('gm-bld-gatehouse', '문루(둥근 탑 둘·첨두 아치 통로)', 7, 7,
           ['SS...SS', 'SSSSSSS', 'SSCCCSS', 'SSCCCSS', 'SSCCCSS', 'SSCCCSS', 'SSC.CSS'],
           'architecture', 'grounds', role='building', kind='structure', tags=['문루', '정문', '성문', '아치'],
           desc='저택 영지 입구 문루: 원뿔 지붕 둥근 탑 둘 사이 총안 성벽과 첨두 아치 통로(가운데 3칸은 지나갈 수 있다 — 아치 윗부분이 사람 위에 그려진다), 아치 위 문장 방패.',
           rules='가운데 x 2~4 세 칸이 통로. 양옆에 철책·돌담을 잇는다. 통로 아래로 길을 낸다.')
def _gatehouse(c):
    yb = 111; cx = 56
    # 가운데 성벽: 두꺼운 벽 윗면(성벽 길, 밝음 10행) + 앞 가장자리 총안 + 앞면
    c.R(22, 18, 68, 12, K('stone', 5))
    for x in range(22, 90):
        for y in range(18, 30):
            if (x - 22) % 11 == 0 or (y - 18) % 6 == 0: c.P(x, y, K('stone', 4))
            elif hsh(x, y, 70) < .06: c.P(x, y, K('stone', 6))
    c.HL(22, 17, 68, K('stone', 1)); c.HL(22, 18, 68, K('stone', 3))         # 뒷변(어둠)
    masonry(c, 22, 36, 68, yb - 36, 'stone', 3, seed=71)
    c.R(22, 30, 68, 6, K('stone', 3)); c.HL(22, 30, 68, K('stone', 2))
    for x in range(23, 88, 9):              # 총안 머리돌: 윗면 4행 + 앞면 6행
        c.R(x, 24, 6, 4, K('stone', 6)); c.HL(x, 24, 6, K('stone', 5)); c.R(x, 28, 6, 8, K('stone', 4)); c.VL(x + 5, 28, 8, K('stone', 2)); c.VL(x, 24, 12, K('stone', 5))
    c.HL(22, 36, 68, K('stone', 5)); c.HL(22, 37, 68, K('stone', 1))
    prof, _ = arch_profile(40)
    for i in range(40):
        top = 54 + prof[i]
        c.P(36 + i, top - 1, K('stone', 6)); c.P(36 + i, top, K('stone', 4))
        for y in range(top + 1, yb + 1):
            if y < top + 22: c.P(36 + i, y, K('ink', 1 if y > top + 2 else 2))      # 아치 안 그늘(윗부분만)
            else: c.clear(36 + i, y)                                                   # 아래는 비워 길이 보이게
    for i in range(40):                       # 아치 안 천장 띠
        c.P(36 + i, 54 + prof[i] + 1, K('stone', 2))
    c.R(cx - 5, 40, 10, 11, K('stone', 5)); c.ellipse(cx, 45, 4, 5, K('velvet', 3)); c.VL(cx, 41, 9, K('gold', 4)); c.HL(cx - 3, 45, 7, K('gold', 4))
    # 탑 둘: 원통 몸 + 위 둥근 고리 윗면 + 원뿔 지붕
    for tx in (16, 96):
        round_wall(c, tx, 15, 34, yb, seed=72 + tx)
        lancet(c, tx - 3, 52, 6, 14, lit=(tx > 50)); lancet(c, tx - 3, 82, 6, 14)
        c.ellipse(tx, 32, 17, 6, K('stone', 5)); c.ellipse(tx, 32, 17, 6, K('stone', 2), fill=False)
        c.ellipse(tx, 31, 13, 4, K('stone', 6))
        spire_cone(c, tx, 32, 14, 30, seed=tx)
    keep = lambda x, y: c.opaque(x, y) and y < yb - 2
    ivy(c, 26, yb - 2, 40, spread=6, seed=7, keep=keep)
    finish(c)


@REG.piece('gm-bld-mausoleum', '묘소(박공 지붕·기둥 둘·쇠문)', 4, 5, 'auto:1', 'architecture', 'graveyard', role='building', kind='structure',
           tags=['묘소', '영묘', '가족묘', '무덤'], access=[(1, 5), (2, 5)],
           desc='회색 돌 작은 묘소. 두꺼운 돌판 박공 지붕(윗면 슬레이트 대신 돌 경사면), 앞 박공 삼각에 십자, 기둥 둘, 무쇠 쌍문, 3단 계단, 양옆 돌 항아리.',
           rules='문 x 1~2 맨 아래 줄. 묘지 안쪽·끝에 둔다. 앞에 묘비 줄을 세운다.')
def _mausoleum(c):
    yb = 79; cx = 32; ye = 46
    # 돌판 지붕: 동서 용마루 앞 경사면(위에서 넓게 보임) + 가운데 앞으로 나온 낮은 박공(삼각 페디먼트)
    range_roof(c, 6, 58, ye, 30, m='slate', seed=81, crest=False, moss=.06, ov=2)
    yf = cross_gable(c, cx, 16, ye + 1, rise=14, depth=12, m='stone', roof='stone', seed=82, finial=False)
    cross(c, cx, int(yf(cx)) - 9, 8)
    c.R(4, ye, 56, 3, K('stone', 5)); c.HL(4, ye, 56, K('stone', 6)); c.HL(4, ye + 3, 56, K('stone', 1))    # 처마 돌띠
    masonry(c, 8, ye + 4, 48, yb - ye - 10, 'stone', 3, seed=83, course=5, blen=(6, 12))
    for px in (13, 45):                       # 기둥(원통)
        cyl3(c, px + 3, ye + 3, 3.5, 1.5, yb - ye - 13, m='bone', tb=5, fb=4)
    prof, _ = arch_profile(16)                 # 쇠 쌍문
    for i in range(16):
        for y in range(ye + 8 + prof[i], yb - 6):
            t = 3 if i not in (7, 8) else 1
            if (y - ye - 8) % 6 == 0: t = 4
            if i in (0, 15): t = 2
            c.P(cx - 8 + i, y, K('iron', t))
        c.P(cx - 8 + i, ye + 7 + prof[i], K('stone', 6))
    c.P(cx - 2, ye + 18, K('gold', 5)); c.P(cx + 1, ye + 18, K('gold', 5))
    for k in range(3):                        # 계단
        ww = 40 + k * 6; y = yb - 9 + k * 3
        c.R(cx - ww // 2, y, ww, 2, K('stone', 5)); c.HL(cx - ww // 2, y, ww, K('stone', 6)); c.HL(cx - ww // 2, y + 2, ww, K('stone', 2))
    for ux in (5, 58):                        # 돌 항아리
        c.R(ux - 3, yb - 8, 7, 3, K('stone', 4)); c.HL(ux - 3, yb - 8, 7, K('stone', 5))
        c.ellipse(ux + .5, yb - 12, 3, 3, K('stone', 4)); c.ellipse(ux - .5, yb - 13, 1.5, 1.5, K('stone', 6))
        c.ellipse(ux + .5, yb - 15, 3, 1.2, K('stone', 2))
    ivy(c, 10, yb - 7, 22, spread=4, seed=81, keep=lambda x, y: c.opaque(x, y) and y < yb - 7, density=.7)
    finish(c)


@REG.piece('gm-bld-crypt', '지하 납골당 입구(내려가는 돌계단·아치)', 4, 4, 'auto:1', 'architecture', 'crypt', role='building', kind='structure',
           tags=['납골당', '지하묘지', '입구', '계단'], access=[(1, 4), (2, 4)],
           desc='땅으로 내려가는 납골당 입구: 윗면이 보이는 두꺼운 돌 테두리 안에 아래로 내려가는 계단, 안쪽 끝에 어두운 첨두 아치, 테두리 위에 해골 부조와 이끼.',
           rules='계단 아래(맨 아래 줄 x 1~2 앞 칸)에 들어가기 이벤트를 둔다. 지하 납골당 맵으로 잇는다.')
def _crypt(c):
    # 낮은 돌 집채: 동서 돌판 지붕(앞 경사면) + 입구 위로 앞으로 나온 낮은 박공(페디먼트·해골 판) + 앞으로 내려가는 계단
    range_roof(c, 8, 56, 30, 26, m='slate', seed=90, crest=False, moss=.08, ov=3)
    yf = cross_gable(c, 32, 13, 31, rise=11, depth=10, m='stone', roof='stone', seed=94, finial=False)
    ty = int(yf(32))
    c.R(29, ty + 4, 7, 5, K('bone', 5)); c.P(30, ty + 5, K('ink', 1)); c.P(33, ty + 5, K('ink', 1)); c.HL(30, ty + 8, 5, K('bone', 3))   # 박공 해골 판
    c.R(4, 31, 56, 3, K('stone', 5)); c.HL(4, 31, 56, K('stone', 6)); c.HL(4, 34, 56, K('stone', 1))
    masonry(c, 8, 35, 48, 5, 'stone', 3, seed=91, course=5)
    c.R(23, 35, 18, 5, K('ink', 1)); c.HL(23, 35, 18, K('stone', 2))
    block3(c, 4, 36, 10, 6, 22, m='stone', tb=6, fb=3, seed=92)
    block3(c, 50, 36, 10, 6, 22, m='stone', tb=6, fb=3, seed=93)
    for k in range(6):                        # 앞에서 안으로 내려가는 계단: 위 단이 밝고 아래로 갈수록 어둡다
        y = 60 - k * 4
        t = 5 - k * .6
        c.R(14, y - 2, 36, 2, K('stone', t)); c.HL(14, y - 2, 36, K('stone', t + 1)); c.R(14, y, 36, 2, K('stone', t - 2))
    for y in range(38, 62):
        c.P(14, y, K('ink', 1)); c.P(49, y, K('ink', 1))
    finish(c)


@REG.piece('gm-bld-belltower', '종탑(사각 탑·종 창·첨탑)', 3, 8, 'auto:1', 'architecture', 'chapel', role='building', kind='structure',
           tags=['종탑', '종루', '탑'], access=[(1, 8)],
           desc='홀로 선 석조 종탑: 높은 사각 몸(버트레스 모서리), 위층 종 창 둘(금빛 종), 돌림띠, 높은 사각뿔 슬레이트 첨탑과 쇠 십자가, 아래 작은 문.',
           rules='예배당 옆이나 묘지 모퉁이에 둔다. 문 x 1 맨 아래 줄.')
def _belltower(c):
    yb = 127; x0, x1 = 6, 42; cx = 24
    wall(c, x0, x1, 48, yb, 'stone', seed=101)
    for yy in (78, 100): string_course(c, x0, x1, yy)
    for bx in (12, 28):
        prof, _ = arch_profile(8)
        for i in range(8):
            for y in range(56 + prof[i], 74): c.P(bx + i, y, K('ink', 1))
            c.P(bx + i, 55 + prof[i], K('stone', 6))
        c.R(bx + 2, 63, 4, 5, K('gold', 3)); c.HL(bx + 2, 63, 4, K('gold', 5)); c.P(bx + 3, 68, K('gold', 2))
    lancet(c, cx - 3, 84, 6, 13)
    gothic_door(c, cx - 6, yb - 24, 12, 20, seed=11)
    c.R(x0 - 2, 45, x1 - x0 + 4, 3, K('stone', 5)); c.HL(x0 - 2, 45, x1 - x0 + 4, K('stone', 6)); c.HL(x0 - 2, 47, x1 - x0 + 4, K('stone', 1))
    spire_square(c, cx, 44, 20, 34, seed=102, finial=False)
    cross(c, cx, 0, 10)
    finish(c)


@REG.piece('gm-bld-carriage', '마차고(돌 아래층·목조 박공·큰 판자문)', 6, 6, 'auto:1', 'architecture', 'grounds', role='building', kind='structure',
           tags=['마차고', '마구간', '헛간', '창고'], access=[(2, 6), (3, 6)],
           desc='돌 아래층과 검은 목조 윗벽의 마차고. 동서 슬레이트 지붕, 가운데 앞 박공에 건초 문, 큰 판자 쌍문(쇠 띠), 박쥐 풍향계.',
           rules='판자문 x 2~3 맨 아래 줄. 저택 옆 마당(흙·포석)에 둔다.')
def _carriage(c):
    yb = 95; ye = 47; xl, xr = 6, 90; cx = 48
    range_roof(c, xl, xr, ye, 30, seed=111, moss=.04, crest=False)
    masonry(c, xl, ye + 1, xr - xl, yb - ye - 1, 'stone', 3, seed=112)
    planks_v(c, xl, ye + 1, xr - xl, 16, 'wood', 2, width=3, seed=1)
    c.HL(xl, ye + 17, xr - xl, K('wood', 4)); c.HL(xl, ye + 18, xr - xl, K('wood', 1))
    yf = cross_gable(c, cx, 18, ye + 2, rise=22, depth=16, m='wood', seed=113, finial=False)
    for x in range(cx - 18, cx + 18):
        for y in range(int(yf(x)) + 3, ye + 18):
            k = (x - cx + 18) // 3
            c.P(x, y, K('wood', 3 if (x - cx + 18) % 3 else 1) if True else 0)
    c.R(cx - 5, ye - 8, 10, 10, K('ink', 1)); c.R(cx - 4, ye - 7, 8, 9, K('wood', 2)); c.VL(cx, ye - 7, 9, K('wood', 1))
    # 큰 쌍문
    c.R(cx - 16, yb - 32, 32, 28, K('stone', 5))
    planks_v(c, cx - 14, yb - 30, 28, 26, 'wood', 3, width=4, seed=2)
    c.VL(cx, yb - 30, 26, K('wood', 1))
    for by in (yb - 26, yb - 12):
        c.HL(cx - 14, by, 28, K('iron', 3)); c.HL(cx - 14, by - 1, 28, K('iron', 5))
    c.line(cx - 14, yb - 26, cx - 1, yb - 12, K('wood', 5)); c.line(cx + 13, yb - 26, cx + 1, yb - 12, K('wood', 5))
    for wx in (14, 74): lancet(c, wx, ye + 24, 7, 14)
    # 박쥐 풍향계
    c.VL(cx, ye - 46, 10, K('iron', 3)); c.HL(cx - 4, ye - 42, 9, K('iron', 2))
    for dx, dy in ((-3, -1), (-2, -2), (-1, -1), (0, -1), (1, -1), (2, -2), (3, -1), (-1, 0), (1, 0), (0, 0)):
        c.P(cx + dx, ye - 47 + dy, K('ink', 1))
    finish(c)


@REG.piece('gm-bld-shed', '정원사 헛간(판자벽·외쪽 지붕·삽)', 3, 3, 'auto', 'architecture', 'grounds', role='building', kind='structure',
           tags=['헛간', '창고', '정원사'], access=[(1, 3)],
           desc='판자벽 작은 헛간. 앞으로 기운 외쪽 슬레이트 지붕(윗면이 넓게 보임), 판자문, 벽에 기댄 삽과 갈퀴, 작은 창.',
           rules='문 x 1 맨 아래 줄. 정원·묘지 구석에 둔다.')
def _shed(c):
    yb = 47
    slate_ew(c, 2, 46, 6, 20, m='slate', seed=121, moss=.05)
    c.HL(2, 5, 44, K('slate', 1)); c.HL(2, 20, 44, K('iron', 1))
    planks_v(c, 4, 21, 40, yb - 21, 'wood', 3, width=4, seed=3)
    c.R(18, 26, 12, yb - 26, K('wood', 1)); planks_v(c, 19, 27, 10, yb - 27, 'wood', 2, width=3, seed=4)
    c.P(27, 37, K('gold', 4))
    c.R(7, 26, 7, 6, K('wood', 1)); c.R(8, 27, 5, 4, K('glass', 2)); c.P(8, 27, K('glass', 5))
    c.VL(35, 24, 22, K('wood', 5)); c.R(34, 40, 3, 6, K('iron', 4)); c.HL(34, 40, 3, K('iron', 6))      # 삽
    c.VL(40, 25, 21, K('wood', 4)); c.HL(38, 25, 5, K('iron', 3)); c.P(38, 26, K('iron', 3)); c.P(40, 26, K('iron', 3)); c.P(42, 26, K('iron', 3))
    finish(c)


@REG.piece('gm-bld-greenhouse', '버려진 온실(쇠틀 첨두 아치·깨진 유리·마른 화분)', 6, 5, 'auto', 'architecture', 'grounds', role='building', kind='structure',
           tags=['온실', '유리온실', '정원'], access=[(2, 5), (3, 5)],
           desc='무쇠 틀 유리 온실. 앞으로 둥근 첨두 아치 지붕(유리 윗면이 넓게 보임), 깨진 유리칸 몇, 안에 마른 화분과 덩굴, 돌 밑단, 가운데 유리문.',
           rules='문 x 2~3 맨 아래 줄. 저택 뒤뜰·정원에.')
def _greenhouse(c):
    yb = 79; xl, xr = 4, 92; cx = 48
    # 유리 지붕: 동서 용마루 앞 경사(위에서 넓게) — 양 끝은 비스듬한 끝 경사(어두운 유리)라 사다리꼴
    yr, ye = 10, 42
    for y in range(yr, ye):
        f = (y - yr) / (ye - yr); inset = int((1 - f) * 12)
        for x in range(xl + inset, xr - inset):
            end = x < xl + 12 - int(f * 12) + 6 or x > xr - 12 + int(f * 12) - 7
            t = 5 if f < .3 else 4 if f < .65 else 3
            if end: t -= 1 if x < cx else 2
            col = K('glass', t)
            row_h = 4 + int(f * 4)                                       # 처마 쪽 칸이 더 크다(원근)
            if (x - xl) % 10 == 0 or int((y - yr) ** 1.15) % row_h == 0: col = K('iron', 2 if f > .4 else 4)
            if hsh((x - xl) // 10, (y - yr) // 6, 5) < .1 and (x - xl) % 10: col = K('ink', 1)   # 깨진 칸
            if not end and (x - y) % 23 in (0, 1) and f < .7: col = K('glass', 6)             # 비스듬한 빛 반사
            c.P(x, y, col)
    c.HL(xl + 12, yr - 1, xr - xl - 24, K('iron', 1)); c.HL(xl + 12, yr, xr - xl - 24, K('iron', 5))
    for x in range(xl + 14, xr - 12, 8): c.VL(x, yr - 3, 3, K('iron', 2)); c.P(x, yr - 4, K('iron', 5))
    c.HL(xl, ye, xr - xl, K('iron', 4)); c.HL(xl, ye + 1, xr - xl, K('iron', 1))
    # 유리 앞벽(낮게): 안이 보인다(마른 화분·덩굴)
    for y in range(ye + 2, yb - 8):
        for x in range(xl, xr):
            col = K('glass', 2 if y < 52 else 1)
            if (x - xl) % 11 == 0: col = K('iron', 3)
            c.P(x, y, col)
    for px in range(xl + 5, xr - 6, 13):
        c.R(px, yb - 15, 6, 6, K('brick', 4)); c.HL(px, yb - 15, 6, K('brick', 6)); c.HL(px + 1, yb - 14, 4, K('dirt', 2))
        for k in range(5): c.P(px + 1 + k, yb - 17 - (k * 3) % 5, K('bark', 3 + k % 2))
    ivy(c, 20, yb - 10, 18, spread=6, seed=13, keep=lambda x, y: c.opaque(x, y) and ye + 2 < y < yb - 9, density=.6)
    prof, _ = arch_profile(16)
    for i in range(16):
        for y in range(50 + prof[i], yb - 8): c.P(cx - 8 + i, y, K('glass', 3) if i not in (0, 7, 8, 15) else K('iron', 3))
        c.P(cx - 8 + i, 49 + prof[i], K('iron', 4))
    masonry(c, xl, yb - 8, xr - xl, 8, 'stone', 3, seed=131, course=4)
    c.HL(xl, yb - 8, xr - xl, K('stone', 5))
    finish(c)


@REG.piece('gm-bld-gazebo', '무쇠 정자(팔각 지붕·기둥·난간)', 4, 5, 'auto', 'architecture', 'grounds', role='building', kind='structure',
           tags=['정자', '가제보', '정원'], access=[(1, 5), (2, 5)],
           desc='무쇠 정자. 비늘 슬레이트 팔각 지붕(앞 세 면이 보임)과 쇠 첨탑 장식, 가는 기둥 넷(앞 둘·뒤 둘), 기둥 사이 낮은 난간, 윗면이 보이는 돌 바닥 단.',
           rules='정원 한가운데·연못가에. 앞 x 1~2 로 들어간다(장식 — 안은 걷지 않는다).')
def _gazebo(c):
    cx = 32
    block3(c, 4, 56, 56, 10, 6, m='stone', tb=5, fb=3)            # 바닥 단
    for px in (12, 50): c.R(px, 30, 3, 28, K('iron', 2)); c.VL(px, 30, 28, K('iron', 4))     # 뒤 기둥(어둡게)
    for px in (6, 56):  c.R(px, 30, 3, 32, K('iron', 3)); c.VL(px, 30, 32, K('iron', 5))      # 앞 기둥
    for y in (48, 52):
        c.HL(6, y, 53, K('iron', 3))
    for x in range(8, 56, 4): c.VL(x, 48, 5, K('iron', 2))
    # 팔각 지붕: 가운데 면(앞) + 양 비스듬 면
    for k in range(26):
        y = 32 - k
        hw = 30 * (1 - k / 26)
        for x in range(int(cx - hw), int(cx + hw) + 1):
            u = (x - (cx - hw)) / max(1, 2 * hw)
            base = 5 if u < .3 else 3 if u < .7 else 2
            row = k % 3
            t = base - (2 if row == 0 else 0)
            c.P(x, y, K('slate', t))
    for k in range(0, 26, 1):
        hw = 30 * (1 - k / 26); y = 32 - k
        c.P(int(cx - hw * .4), y, K('slate', 6)); c.P(int(cx + hw * .4), y, K('slate', 1))
    c.HL(cx - 31, 33, 63, K('iron', 1)); c.HL(cx - 30, 32, 61, K('slate', 1))
    for x in range(cx - 28, cx + 29, 4): c.P(x, 34, K('iron', 3))
    c.VL(cx, 0, 8, K('iron', 3)); c.P(cx, 0, K('iron', 5)); c.ellipse(cx, 6, 1.5, 1.5, K('gold', 4))
    finish(c)


@REG.piece('gm-bld-folly', '무너진 둥근 망루(폐탑)', 3, 6, 'auto', 'architecture', 'grounds', role='building', kind='structure',
           tags=['폐탑', '망루', '폐허', '탑'], access=[(1, 6)],
           desc='위가 무너진 둥근 돌 망루: 들쭉날쭉한 윗단(속이 보이는 두꺼운 벽 윗면), 좁은 화살창, 아래 어두운 출입구, 담쟁이와 떨어진 돌덩이.',
           rules='숲 가장자리·묘지 뒤 언덕에 풍경으로 둔다.')
def _folly(c):
    cx = 24; yb = 95
    round_wall(c, cx, 18, 14, yb, seed=141)
    rnd = random.Random(3)
    ry = 18 * .35
    for x in range(cx - 18, cx + 18):
        cut = 14 + int(10 * abs(math.sin(x * .23)) + rnd.randint(0, 3))
        for y in range(0, cut + 8):
            if y < cut: c.clear(x, y)
    # 무너진 윗면: 두꺼운 벽 고리의 윗면(밝음) + 안쪽 어둠
    for x in range(cx - 18, cx + 18):
        top = next((y for y in range(0, 60) if c.opaque(x, y)), None)
        if top is None: continue
        c.P(x, top, K('stone', 6)); c.P(x, top + 1, K('stone', 5)); c.P(x, top + 2, K('stone', 4))
    c.ellipse(cx, 30, 12, 4, K('ink', 1))
    lancet(c, cx - 2, 46, 5, 12); lancet(c, cx - 9, 62, 4, 10)
    prof, _ = arch_profile(10)
    for i in range(10):
        for y in range(yb - 18 + prof[i], yb - 1): c.P(cx - 5 + i, y, K('ink', 1))
    for (x, y) in ((4, yb - 2), (40, yb - 1)):
        c.R(x, y - 2, 5, 3, K('stone', 4)); c.HL(x, y - 2, 5, K('stone', 6)); c.HL(x, y + 1, 5, K('stone', 1))
    ivy(c, cx - 10, yb - 2, 60, spread=8, seed=141, keep=lambda x, y: c.opaque(x, y) and y < yb - 1, density=1.2)
    finish(c)


@REG.piece('gm-bld-well', '돌 우물(박공 지붕틀·도르래)', 2, 3, 'auto', 'architecture', 'grounds', role='prop', kind='container',
           tags=['우물'], access=[(0, 3)],
           desc='둥근 돌 우물: 위에서 보이는 검은 물 아가리(타원 안쪽 5행), 두꺼운 돌 테두리, 나무 박공 지붕틀과 도르래·두레박.',
           rules='마당·안뜰 가운데. 아래 칸 앞에서 조사 이벤트.')
def _well(c):
    cx = 16
    # 기둥·지붕(뒤)
    for px in (4, 26): c.R(px, 8, 3, 28, K('wood', 3)); c.VL(px, 8, 28, K('wood', 5)); c.VL(px + 2, 8, 28, K('wood', 1))
    for k in range(10):
        hw = 15 - k * 1.3
        c.HL(int(cx - hw), 10 - k, int(2 * hw) + 1, K('slate', 4 if k % 2 else 3))
    c.HL(1, 10, 31, K('slate', 1))
    c.HL(6, 16, 20, K('wood', 4)); c.VL(cx, 16, 8, K('paper', 3)); c.R(cx - 2, 23, 5, 4, K('wood', 3)); c.HL(cx - 2, 23, 5, K('wood', 5))
    c.ellipse(cx, 16, 2, 2, K('wood', 2))
    # 돌 테두리(윗면 고리) + 물 아가리
    c.ellipse(cx, 32, 14, 7, K('stone', 5))
    c.ellipse(cx, 32, 14, 7, K('stone', 6), fill=False)
    c.ellipse(cx, 32, 10, 4.5, K('water', 1))
    c.ellipse(cx, 33, 9, 3.5, K('water', 2))
    c.P(cx - 4, 31, K('water', 5)); c.P(cx - 3, 31, K('water', 4))
    for x in range(cx - 14, cx + 14):
        dx = (x + .5 - cx) / 14
        yb = int(32 + 7 * math.sqrt(max(0, 1 - dx * dx)))
        for y in range(yb - 1, yb + 8):
            u = (dx + 1) / 2
            t = 4 if u < .3 else 3 if u < .7 else 2
            if (y - yb) % 4 == 3: t -= 2
            c.P(x, y, K('stone', t))
    moss_top(c, 4, 33, 26, seed=2, amount=.3)
    finish(c)


@REG.piece('gm-bld-fountain', '마른 분수(천사상·석조 수반)', 3, 4, 'auto', 'architecture', 'grounds', role='prop', kind='container',
           tags=['분수', '천사상', '정원'], access=[(1, 4)],
           desc='팔각 석조 수반 안 검은 고인 물(위에서 보이는 아가리), 가운데 받침 위 날개 접은 천사상, 테두리 이끼.',
           rules='정원 가운데·길이 만나는 곳. 둘레를 걸을 수 있게 비워 둔다.')
def _fountain(c):
    cx = 24
    c.ellipse(cx, 44, 22, 11, K('stone', 5))
    c.ellipse(cx, 44, 22, 11, K('stone', 6), fill=False)
    c.ellipse(cx, 44, 18, 8, K('water', 2))
    c.ellipse(cx, 45, 17, 7, K('water', 1))
    for x in range(cx - 14, cx - 6): c.P(x, 41, K('water', 4))
    for x in range(cx - 22, cx + 22):
        dx = (x + .5 - cx) / 22
        yb = int(44 + 11 * math.sqrt(max(0, 1 - dx * dx)))
        for y in range(yb - 1, yb + 7):
            u = (dx + 1) / 2
            t = 4 if u < .3 else 3 if u < .7 else 2
            if y == yb + 6: t = 1
            c.P(x, y, K('stone', t))
    # 받침 + 천사상(날개를 등 뒤로 접고 고개 숙인 모습)
    cyl3(c, cx, 30, 4.5, 1.5, 12, m='stone', tb=5, fb=4)
    st = 'bone'
    for side in (-1, 1):                         # 날개: 어깨에서 머리 위로 솟았다가 허리까지 내려오는 깃털 덩이(몸보다 한 단 어둡게)
        for k in range(16):
            yy = 6 + k
            w = 3 if k < 3 else 5 if k < 10 else 4 - (k - 10) // 2
            x0 = cx + side * 3 if side > 0 else cx - 3 - w
            for x in range(x0, x0 + w):
                t = (4 if side < 0 else 2) + (1 if k < 4 else 0)
                if (yy + x) % 3 == 0 and k > 3: t -= 1
                c.P(x, yy, K(st, t))
        c.P(cx + side * 4 - (1 if side < 0 else 0), 5, K(st, 5 if side < 0 else 3))
    c.R(cx - 3, 16, 6, 14, K(st, 4)); c.VL(cx - 3, 16, 14, K(st, 5)); c.VL(cx + 2, 16, 14, K(st, 2))      # 옷자락
    for y in range(20, 30, 3): c.P(cx, y, K(st, 3)); c.P(cx - 1, y + 1, K(st, 3))
    c.HL(cx - 4, 29, 8, K(st, 3))
    c.ellipse(cx - .5, 13.5, 2.6, 2.8, K(st, 5)); c.P(cx - 2, 12, K(st, 6)); c.HL(cx - 1, 15, 2, K(st, 3))   # 숙인 머리
    c.R(cx - 2, 18, 4, 3, K(st, 5)); c.HL(cx - 2, 20, 4, K(st, 3))    # 모은 손
    moss_top(c, cx - 20, 37, 40, seed=4, amount=.25)
    finish(c)


if __name__ == '__main__':
    sys.exit(1 if run_module(MODULE) else 0)
