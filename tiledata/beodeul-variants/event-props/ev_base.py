# 이벤트 소품 키트(event-props) 공용 바탕 — 버들항 파이프라인(scripts/content/lib/city_v6)의 볼륨 페인터(px2.C),
# 칩셋 램프(palette.apply), 안쪽 윤곽(pz.fin)을 그대로 쓴다. 이 폴더에서 처음 쓰는 빛 재질(푸른 빛·보라 빛·불꽃·신호등·
# 회복 물)과 기계 재질(future-ruins plan.md 「기계 재질 규약」의 강철·경고 도장)만 같은 7단 램프(0 = 색 윤곽, 1~6 = 밝기,
# 그림자는 남보라로 식고 빛은 노랗게 데운다)로 px2.PAL 에 더한다. 결정적(같은 입력 = 같은 그림). 생성 이미지·트레이싱 없음.
# 3/4 시점(윗면 + 앞면, 옆면 없음), 빛 왼쪽 위, 1칸 = 16px.
import os, sys, json, math
HERE = os.path.dirname(os.path.abspath(__file__))
VAR = os.path.abspath(os.path.join(HERE, '..'))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
CITY = os.path.join(ROOT, 'scripts', 'content', 'lib', 'city_v6')
sys.path.insert(0, CITY)
import palette; palette.apply()
import px2, pz                                  # noqa: E402
from px2 import C, PAL, GRAIN, hx, _hash, vnoise  # noqa: E402
from PIL import Image                           # noqa: E402

T = 16

# ================================================================ 빛·기계 재질 (7단: 0 윤곽 · 1 가장 어두움 … 6 빛)
PAL.update({
    # 저장 수정·수정 스위치(파랑) — 버들항 원래 px2 'cryst' 램프(칩셋 적용 전 값)
    'azure':  ['#0a1430', '#142e66', '#1e52a4', '#3282d6', '#62b6f0', '#a8e2fc', '#f0fcff'],
    # 꺼진 수정(빛 빠진 회청)
    'dimcry': ['#10141e', '#1e2432', '#2e3648', '#44506a', '#5e6c88', '#808ea8', '#a6b2c6'],
    # 차원문·봉인문 보라 빛
    'violet': ['#160a2a', '#30145a', '#50288c', '#7444bc', '#a072e0', '#ccaaf6', '#f4eaff'],
    # 불꽃(버들항 원래 px2 'fire' 램프)
    'flame':  ['#3a0a04', '#7a1c06', '#c03c0c', '#ec6c14', '#fca42c', '#ffd860', '#fffac8'],
    # 숯·재
    'char':   ['#0a0608', '#1a1214', '#2c2022', '#40302e', '#58443e', '#72604f', '#8e7c66'],
    # 회복 샘 물(버들항 원래 px2 'teal')
    'heal':   ['#061c22', '#0c3c44', '#12666a', '#1c9a94', '#34ccbc', '#86f0de', '#e2fff8'],
    # 신호등 빨강·초록 (future-ruins SIGNAL red 와 같은 결)
    'sigred': ['#2a0608', '#560c10', '#8c1418', '#c4241e', '#ee5030', '#ff9262', '#ffd6b8'],
    'siggrn': ['#06200e', '#0c4418', '#147226', '#26a83a', '#5ad85a', '#a8f69a', '#f0ffe8'],
    'amber':  ['#2a1404', '#5a2a06', '#94480a', '#cc7410', '#f0a428', '#ffd060', '#fff2b0'],
    # 기계 재질 규약(future-ruins plan.md) 강철·경고 도장
    'steel':  ['#0c0e18', '#1a1f2e', '#2c3346', '#454e64', '#64708a', '#8c98b0', '#c2cad8'],
    'warn':   ['#22160a', '#4e3610', '#7e5a16', '#a8801e', '#c8a032', '#dcbe56', '#eedc94'],
    # 금 장식(버들항 원래 px2 'gold' — 칩셋 적용 뒤 gold 는 짚 램프라 금상자 빛이 약하다)
    'gilt':   ['#2e1a06', '#5e380c', '#94601a', '#c89028', '#ecc04a', '#fce27a', '#fff8c8'],
    # 바랜 붉은 천(여관 간판 이불)
    'rug':    ['#2c0c1c', '#5a1426', '#8e2030', '#c43a36', '#e8684c', '#f8a07a', '#fcd0b0'],
})
GRAIN.update({'azure': (0.0, 2), 'dimcry': (0.03, 2), 'violet': (0.0, 2), 'flame': (0.0, 2), 'char': (0.14, 1.4),
              'heal': (0.02, 2), 'sigred': (0.0, 2), 'siggrn': (0.0, 2), 'amber': (0.0, 2), 'steel': (0.05, 2),
              'warn': (0.06, 2), 'gilt': (0.05, 2), 'rug': (0.06, 1.8)})


def rgb(mat, t): return hx(PAL[mat][max(0, min(6, int(t)))]) + (255,)


def F(c, k=0.62):
    """버들항 소품 마감: 색 윤곽 + 안쪽 윤곽(pz.fin)."""
    return pz.fin(c, k)


def new(w, h): return Image.new('RGBA', (w, h), (0, 0, 0, 0))


def put(px, W, H, x, y, col):
    if 0 <= x < W and 0 <= y < H and col is not None: px[x, y] = tuple(col[:3]) + (255,)


def over(base, im, x=0, y=0):
    base.alpha_composite(im, (int(x), int(y))); return base


def strip(frames):
    """가로 4프레임 한 줄(폭 = 4 × 프레임 폭)."""
    w, h = frames[0].size
    o = new(w * len(frames), h)
    for i, f in enumerate(frames): o.alpha_composite(f, (i * w, 0))
    return o


def pad16(im, w=None, h=None):
    """칸 배수로 채운다(왼쪽 아래 정렬 — bake_picks.pad 와 같은 규칙)."""
    w = w or -(-im.width // T) * T; h = h or -(-im.height // T) * T
    o = new(w, h); o.alpha_composite(im, (0, h - im.height)); return o


def frame_diff(frames):
    """프레임끼리 다른 화소 수(가장 작은 쌍) — 정지 이미지처럼 보이는지 검사."""
    import numpy as np
    A = [np.array(f) for f in frames]; best = 10 ** 9
    for i in range(len(A)):
        for j in range(i + 1, len(A)):
            best = min(best, int((A[i] != A[j]).any(-1).sum()))
    return best


# ================================================================ 빛 그리기 도우미 (번짐 없는 손 도트)
def flame_rows(frame, size=1, seed=0):
    """불꽃 모양(문자열, 숫자 = 불꽃 톤). 4프레임: 혀가 좌우로 흔들리고 키가 달라진다.
    size 0 = 횃불(폭 5) · 1 = 화로(폭 7) · 2 = 모닥불(폭 9)."""
    F0 = {
        0: [["..6..", ".565.", ".566.", "45654", "34543", ".343."],
            [".6...", ".56..", ".5665", "45654", "34543", ".343."],
            ["...6.", "..65.", ".565.", "45664", "34543", ".343."],
            ["..6..", "..6..", ".565.", "45654", "34553", ".343."]],
        1: [["...6...", "...56..", "..5665.", ".456654", ".456654", "3456543", ".34543."],
            ["..6....", "..65...", ".5665..", ".456654", "4566554", "3456543", ".34543."],
            [".....6.", "....65.", "..5665.", ".456654", "4556654", "3456543", ".34543."],
            ["...6...", "..656..", "..566..", ".456654", "4566654", "3455543", ".34543."]],
        2: [["....6....", "...565...", "...566.6.", "..45665..", ".4566654.", "345666543", "345565543", ".3445443."],
            ["...6.....", "..56...6.", "..5665.5.", ".456654..", ".4566654.", "345666543", "345555543", ".3444443."],
            [".....6...", ".6..65...", ".5.5665..", "..456654.", ".4566654.", "345666543", "345655543", ".3445443."],
            ["....6....", "....56...", ".6.5665..", "..456654.", ".4566654.", "345666543", "345565543", ".3444443."]],
    }
    return F0[size][frame % 4]


def draw_rows(px, W, H, rows, x0, y0, mat, add=0):
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch.isdigit(): put(px, W, H, x0 + i, y0 + j, rgb(mat, max(1, min(6, int(ch) + add))))


def sparks(px, W, H, pts, mat, tone=6):
    for (x, y) in pts: put(px, W, H, x, y, rgb(mat, tone))


def lit_ground(px, W, H, cx, cy, rx, ry, mat, tone, dens=0.55, seed=0, only_opaque=True):
    """불·빛이 받침 윗면에 비친 자리 — 반투명 번짐 대신 디더 점으로(손 도트)."""
    for y in range(int(cy - ry), int(cy + ry) + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            if not (0 <= x < W and 0 <= y < H): continue
            d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
            if d > 1: continue
            if only_opaque and px[x, y][3] < 255: continue
            if _hash(x, y, seed + 31) < dens * (1 - d) + .12 * ((x + y) % 2 == 0) * (1 - d):
                r, g, b, a = px[x, y]; L = hx(PAL[mat][tone])
                px[x, y] = (int(r * .45 + L[0] * .55), int(g * .45 + L[1] * .55), int(b * .45 + L[2] * .55), 255)


# ================================================================ 조각 저장소 (앞 웨이브와 같은 partmeta/parts.md 형식)
class Parts:
    def __init__(s, outdir):
        s.out = outdir; s.dir = os.path.join(outdir, 'parts'); os.makedirs(s.dir, exist_ok=True)
        for f in os.listdir(s.dir):
            if f.endswith('.png'): os.remove(os.path.join(s.dir, f))
        s.meta = {}; s.imgs = {}; s.order = []

    def add(s, name, im, kind, ko, desc, rules, brows=None, role='prop', cells=None):
        im = im.convert('RGBA')
        if cells:
            fw = cells[0] * T * (4 if name.endswith('-strip') else 1); fh = cells[1] * T
            assert im.size == (fw, fh), (name, im.size, (fw, fh))
        assert im.width % 16 == 0 and im.height % 16 == 0, name
        if name.endswith('-strip'): assert '4프레임' in desc, name
        s.imgs[name] = im; s.order.append(name)
        m = {'kind': kind, 'ko': ko, 'desc': desc, 'rules': rules}
        if brows is not None: m['brows'] = brows
        if role: m['role'] = role
        s.meta[name] = m
        im.save(os.path.join(s.dir, name + '.png'))

    def finish(s, title):
        json.dump(s.meta, open(os.path.join(s.out, 'partmeta.json'), 'w'), ensure_ascii=False, indent=1)
        lines = ['# 새로 찍은 조각 — %s\n' % title,
                 '손 도트(버들항 px2 볼륨 페인터 + 칩셋 7단 램프 + 빛·기계 재질 램프, pz.fin 윤곽). 칸 = 16px. '
                 '`-strip` = 가로 4프레임 한 줄(프레임 폭 = 전체 폭 / 4). `evfloor_` = 걸을 수 있는 납작 바닥 소품.\n']
        for n in s.order:
            im = s.imgs[n]; m = s.meta[n]
            fw = im.width // 4 if n.endswith('-strip') else im.width
            lines.append('- `parts/%s.png` (%dx%d px) — %s: %s / %dx%d칸%s' % (
                n, im.width, im.height, m['ko'], m['desc'], fw // 16, im.height // 16, ' · 4프레임' if n.endswith('-strip') else ''))
        lines.append('\n합계: %d 키트 (그중 4프레임 띠 %d)' % (len(s.order), sum(n.endswith('-strip') for n in s.order)))
        open(os.path.join(s.out, 'parts.md'), 'w').write('\n'.join(lines) + '\n')
        return len(s.order)
