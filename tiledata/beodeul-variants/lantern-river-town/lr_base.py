# 등불 수향 마을(lantern-river-town) 공용 바탕 — 무협 장르(genres/wuxia.md).
# 동양풍 성(eastern-castle)의 톤 캔버스·7단 램프·기와 지붕 함수를 이 폴더의 복사본(src-eastern-castle/)으로 그대로 쓰고
# (원본은 읽기만), 이 장소에 처음 나오는 재질만 같은 7단 램프 규칙(0 = 색 윤곽, 1~6 = 밝기, 그늘은 보랏빛으로 식고 빛은 데운다)으로 더한다:
#   ai     쪽빛 물들인 천(염색 천·포목·차양)        qing  회청 벽돌(마당 바닥·담 아래)
#   yana   버드나무 잎(누런 연두, 버들항 잎보다 밝다)  hasu  연잎(푸른 녹색)        momo  연꽃·복사꽃 분홍
#   cha    찻빛 천(차양·천막의 누런 갈색)            jade  옥빛 유약(술독·찻잔)
# 지붕 = KAWARA 회청 기와, 기둥·난간 = SHU 주칠, 벽 = 버들항 회벽(plaster), 돌 = 버들항 돌(stone), 먹빛 = INK, 나무 = wood, 대 = take.
# 결정적(같은 입력 = 같은 그림). 생성 이미지·트레이싱 없음. 3/4(윗면 + 앞면, 옆면 없음), 빛 왼쪽 위, 1칸 = 16px.
import os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'src-eastern-castle'))
sys.path.insert(0, HERE)
import numpy as np
from PIL import Image
from ek_base import *                       # noqa  (TC·hash2·clamp·jroof·plaster_wall·board_wall·ishigaki_k·leaf_tex·RAMP …)
from ek_base import _hash, VAR, ROOT
import fr_mat
import ek_wave5                               # noqa  (mizu·doro·soil·koke·aki 재질 등록)
HERE = os.path.dirname(os.path.abspath(__file__))     # ek_base 의 HERE 를 이 폴더로 되돌린다


def _r(*cs): return [hx(c) for c in cs]
AI   = _r('#0a0c1e', '#141a3a', '#1e2a5a', '#2c3e7c', '#40589c', '#6480bc', '#a0b8dc')   # 쪽빛 천
QING = _r('#101216', '#20242c', '#30363e', '#444a54', '#5a626c', '#767e86', '#9ca2a8')   # 회청 벽돌
YANA = _r('#0c180a', '#182e10', '#264818', '#36621e', '#4c7e26', '#6e9c34', '#a6c45e')   # 버드나무 잎
HASU = _r('#06140e', '#0e2618', '#183c24', '#225432', '#2e6e40', '#468c52', '#7cb26e')   # 연잎
MOMO = _r('#2a0e18', '#5a1e30', '#8a3248', '#b44c64', '#d6708a', '#eca0b4', '#fad6e0')   # 연꽃 분홍
CHA  = _r('#1c1208', '#3a2610', '#5a3c18', '#7a5422', '#9a6e30', '#ba8c46', '#d8b46e')   # 찻빛 천
GRAN = [(28, 38, 38), (43, 57, 52), (58, 68, 68), (88, 98, 98), (114, 118, 120), (146, 148, 145), (196, 198, 195)]   # 화강암 판석(버들항 돌 램프 + 버들항 길 포석 톤)
JADE = _r('#06140e', '#10281e', '#1c4030', '#2a5a46', '#3e7860', '#5e9a80', '#98c4ac')   # 옥빛 유약
NEWL = {'gran': GRAN, 'ai': AI, 'qing': QING, 'yana': YANA, 'hasu': HASU, 'momo': MOMO, 'cha': CHA, 'jade': JADE}
for n in NEWL:
    if n not in fr_mat.MID:
        fr_mat.MATS.append(n); fr_mat.MID[n] = len(fr_mat.MATS) - 1
_lut = np.zeros((len(fr_mat.MATS), 7, 3), np.uint8)
_lut[:fr_mat.LUT.shape[0]] = fr_mat.LUT
for n, r in NEWL.items():
    for k in range(7): _lut[fr_mat.MID[n], k] = r[k]
fr_mat.LUT = _lut
RAMP.update(NEWL)
STa = np.array(ST, int); WDa = np.array(WD, int); PLa = np.array(PL, int); QINGa = np.array(QING, int); GRANa = np.array(GRAN, int)
KAWa = np.array(KAWARA, int); SHUa = np.array(SHU, int); INKa = np.array(INK, int)
X16, Y16 = np.meshgrid(np.arange(16), np.arange(16))


def red_lantern(tc, cx, ytop, h=10, w=8, lit=True, tassel=True, mat='redl'):
    """붉은 종이 등(둥근 통, 위아래 검은 테, 가로 살 줄, 왼쪽 빛, 아래 금 술). cx = 가운데, ytop = 위 테 줄."""
    for y in range(ytop + 1, ytop + h):
        f = (y - ytop) / float(h)
        hw = (w / 2.0) * math.sin(f * math.pi) ** .55 + .4
        for x in range(int(round(cx - hw)), int(round(cx + hw))):
            u = (x + .5 - (cx - hw)) / (2 * hw)
            k = 6 if u < .28 else (5 if u < .62 else 4)
            if not lit: k -= 2
            if (y - ytop) % 3 == 0: k -= 1
            tc.px(x, y, mat, clamp(k, 1, 6))
    for x in range(int(cx - w * .3), int(cx + w * .3) + 1):
        tc.px(x, ytop, 'kuro', 4); tc.px(x, ytop + h, 'kuro', 3)
    if tassel:
        for j in range(1, 4): tc.px(int(cx), ytop + h + j, 'gold', 5 - j // 2)
        tc.px(int(cx) - 1, ytop + h + 3, 'gold', 3); tc.px(int(cx) + 1, ytop + h + 3, 'gold', 3)


def plaque(tc, x0, y0, w, h):
    """편액(글자 없음): 먹빛 판 + 금 테 + 가운데 옅은 무늬 두 점(획이 아니라 장식 점)."""
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            edge = x in (x0, x0 + w - 1) or y in (y0, y0 + h - 1)
            if edge: tc.px(x, y, 'gold', 5 if (x == x0 or y == y0) else 3)
            else: tc.px(x, y, 'ink', 2 if y < y0 + h - 2 else 1)
    cy = y0 + h // 2
    for x in (x0 + w // 3, x0 + w - 1 - w // 3): tc.px(x, cy, 'gold', 4)


def red_post(tc, x, y0, y1, w=3, cap=True):
    """주칠 둥근 기둥(폭 w px): 왼쪽 빛·오른쪽 그늘, 위 끝 톤 5 빛 테(wuxia 규격 1)."""
    ks = {2: (5, 2), 3: (5, 4, 2), 4: (6, 5, 3, 2), 5: (6, 5, 4, 3, 2)}[w]
    for y in range(int(y0), int(y1)):
        for i in range(w): tc.px(x + i, y, 'shu', ks[i])
    if cap:
        for i in range(w): tc.px(x + i, y0, 'shu', 6)
    for i in range(w): tc.px(x + i, y1 - 1, 'stone', 3 if i < w - 1 else 2)        # 돌 주춧돌 줄


def soft(im, cx, cy, rx, ry, a=55): return shadow_under(im, cx, cy, rx, ry, a)
