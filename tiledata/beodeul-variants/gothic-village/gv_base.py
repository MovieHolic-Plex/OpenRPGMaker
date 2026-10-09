# 안개 낀 고딕 마을(gothic-village) 공용 바탕 — 결정적.
# 버들항 파이프라인(city_v6)과 폐허 마을·비 내리는 폐허 도시 동결 사본(vendor/)의 그리기 함수로 먼저 「낮 재료」로 그리고,
# 고딕 등급 gloom() 으로 한 번에 채도를 덜고 청회색으로 옮긴다(채널별 단조 변환 → 7단 밝기 순위 유지).
# 그 다음 고딕 포인트(검붉은 문·커튼, 호박색 등불)만 등급 공간 램프로 덧칠한다. 장르 규격: tiledata/beodeul-kits/genres/gothic.md
import os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__))
for p in (os.path.join(HERE, '..', '_lib-5'), os.path.join(HERE, 'vendor'), HERE):
    if p not in sys.path: sys.path.insert(0, p)
from rr_base import *                      # noqa: F401,F403  bd5 + rv_base(CH·ASH·ROT·DK·LAWN·put·get·H·mix·mul) + rr 밤 도우미
from rr_base import _hash
import numpy as np
from PIL import Image
import pv, pj, ph2, roman, castle6, terrain, pz

# ---------------------------------------------------------------- 고딕 등급(흐린 낮, 안개)
GK = np.array((0.78, 0.83, 0.92)); GL = np.array((9.0, 11.0, 17.0)); GD = 0.72

def gloom_arr(a, d=GD, k=1.0):
    """RGB float -> 고딕 톤: 채도 덜기(d) → 청회로 살짝 곱(k 는 전체 밝기) → 바닥을 남회로 들어 올림(검정이 탁해진다)."""
    a = np.clip(a, 0, 255)
    l = (0.3 * a[..., 0] + 0.59 * a[..., 1] + 0.11 * a[..., 2])[..., None]
    a = a * (1 - d) + l * d
    return np.clip(a * GK * k + GL, 0, 255)

def gloom(im, d=GD, k=1.0):
    a = np.array(im.convert('RGBA')).astype(np.float64)
    a[..., :3] = gloom_arr(a[..., :3], d, k)
    return Image.fromarray(np.rint(a).astype(np.uint8), 'RGBA').copy()

def G_(c, d=GD):
    return tuple(int(round(v)) for v in gloom_arr(np.array([[c[:3]]], np.float64), d)[0, 0])

# ---------------------------------------------------------------- 고딕 램프 (0=윤곽, 1~6 밝아짐) — 등급 뒤 공간
BLOOD = [hx(c) for c in ('#1a0709', '#36100f', '#4e1719', '#5a1e24', '#742730', '#8e2f33', '#a8473f')]   # 검붉은 문·커튼·포인트
AMBER = [hx(c) for c in ('#2a1c0a', '#5a3c14', '#8a6026', '#b0823a', '#c8a050', '#dcbc72', '#ecd8a0')]   # 흐린 호박 등불
GIRON = [hx(c) for c in ('#0b0d12', '#171b23', '#232832', '#313845', '#434b59', '#5b6472', '#7c8592')]   # 녹슨 검은 쇠
RUST = [hx(c) for c in ('#160c08', '#2c1810', '#43241a', '#5a3224', '#704332', '#88583f', '#a07050')]    # 쇠 녹
GSLATE = [hx(c) for c in ('#14171d', '#20252e', '#2b3140', '#3a4252', '#4c5566', '#66707f', '#8a94a0')]  # 청회 슬레이트
BEAM = [hx(c) for c in ('#0c0907', '#18120e', '#241b15', '#30251d', '#3e3127', '#4f4033', '#625243')]   # 흑갈 목골 들보
PLAST = [hx(c) for c in ('#2a2c30', '#45484d', '#5c5f64', '#74777b', '#8b8e90', '#a2a4a4', '#babbb8')]   # 회색 회벽
GSTONE = [hx(c) for c in ('#15181c', '#262b31', '#363c43', '#474e55', '#5b636a', '#737b82', '#959ca2')]  # 청회 석재
GMOSS = [hx(c) for c in ('#10150f', '#1c2519', '#283523', '#36452e', '#4a5a48', '#62705a', '#7c8a6a')]   # 시든 회록 풀·이끼
MUD = [hx(c) for c in ('#0e0c0b', '#1d1916', '#2a2420', '#38302a', '#473d35', '#574b41', '#6a5d51')]     # 질척한 흑회 흙
LEAFR = [hx(c) for c in ('#1a110e', '#2f1f18', '#442d23', '#583b2e', '#6a4b3b', '#7c5e4c', '#907260')]   # 갈적 낙엽
LEAFG = [hx(c) for c in ('#191712', '#2b281f', '#3e392d', '#504a3b', '#625b4a', '#756e5c', '#8a8270')]   # 회갈 낙엽
FOG = [hx(c) for c in ('#6c7480', '#808893', '#949ca6', '#a6aeb7', '#b8c0c8', '#c8ced5', '#d8dde2')]     # 안개
BONE = [hx(c) for c in ('#2a2822', '#4a463c', '#6a6556', '#88826e', '#a29c86', '#bab49e', '#d2ccb6')]    # 바랜 뼈(작은 짐승 뼈·조약돌 결)

def ramp_fit(c, R):
    """색 하나를 램프 R 의 같은 밝기 단으로(밝기 순위 유지)."""
    l = lum3(c); best = 1; bd = 1e9
    for i in range(1, 7):
        d = abs(lum3(R[i]) - l)
        if d < bd: bd, best = d, i
    return R[best]

def recolor(im, pred, R, keep_out=True):
    """pred(r,g,b) 가 참인 화소를 램프 R 의 같은 밝기 단으로 옮긴다. 윤곽(아주 어두운 화소)은 R[0]."""
    px = im.load(); W, Hh = im.size
    for y in range(Hh):
        for x in range(W):
            p = px[x, y]
            if p[3] < 10 or not pred(p[0], p[1], p[2]): continue
            px[x, y] = (R[0] if (keep_out and lum3(p) < 18) else ramp_fit(p, R)) + (p[3],)
    return im

def mk(w, h):
    im = Image.new('RGBA', (w, h)); return im, im.load()

def flip(im): return im.transpose(Image.FLIP_LEFT_RIGHT)
