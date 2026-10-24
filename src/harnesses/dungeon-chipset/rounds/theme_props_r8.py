"""theme-props-r8 — 도깨비불 다시 그림(2026-10-24). r1 은 object-gate 3/4 「윗면 3행 < 4 · 기둥 머리가 타원 판이 아님」(기둥 종류).
  받침 = 이끼 낀 돌 화반(火盤): 위에서 보이는 타원 테두리(빛 윗단 · 안쪽 그늘 · 앞 테) 5행 + 둥근 앞면 + 짧은 목 + 넓은 발.
  불꽃은 화반 안쪽에서 솟아 테두리 앞단을 가리지 않는다(뒤쪽 안쪽만 가림). 장면 3 — 혀 모양·높이·불티가 바뀐다.
  불꽃 = 청록 다섯 단 + 흰 심(r1 과 같은 색), 혀 끝 짙은 단, 화반 안쪽에 불빛 반사.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import theme_climate_lib as lib  # noqa: E402
import theme_props_r1 as P1  # noqa: E402
from dot import Cv, stamp  # noqa: E402

WAVE = 'theme_props'
G = P1.G
T = 16
L = P1.L
# 돌: r s t u v (stone1~5) · 이끼 a~f · 불: m n o p q + W 심 · 반사 g h · 그늘 z
LW = L('a:moss0 b:moss1 c:moss2 d:moss3 e:moss4 f:moss5 r:stone0 s:stone1 t:stone2 u:stone3 v:stone4 '
       'm:glow0 n:glow1 o:glow2 p:glow4 q:glow5 W:ice4 g:glow0 h:glow1 z:void1 y:moss0')
LW2 = L('a:moss0 b:moss1 c:moss2 d:moss3 e:moss4 f:moss5 r:stone0 s:stone1 t:stone2 u:stone3 v:stone4 '
        'm:bog1 n:bog3 o:bog5 p:bog6 q:bog7 W:snow3 g:bog1 h:bog3 z:void1 y:moss0')
# 화반(16×18): 0~5 타원 윗면(뒤 테 빛 · 안쪽 그늘·불빛 반사 · 앞 테 빛 띠) · 6~10 둥근 앞면 · 11~12 목 · 13~16 발 · 17 그림자
BASIN = [
    '....tuvvvvut....',
    '..tuvuttttuvut..',
    '.tusrgghhggrsut.',
    '.tsrghhhhhhgrst.',
    '.tvsrgghhggrsvt.',
    '..vvvuvvvvuvvu..',
    '.rtuuffeeuuuttr.',
    '.rtuefdeettutsr.',
    '..rtteddtttssr..',
    '..rstttttssssr..',
    '...rrsssssrrr...',
    '.....rtttsr.....',
    '.....rttssr.....',
    '...rtuuvuutsr...',
    '..rtuefeuuttssr.',
    '..rsstdsssssrrz.',
    '...zzzzzzzzzzz..',
    '....yyyyyyyyy...',
]
# 불꽃(16×16 위 칸 + 화반 안쪽 2행까지). 혀 끝 m, 겉 n o, 안 p q, 심 W. 아랫단은 화반 안쪽 2~4행에 얹힌다.
FLAMES = [
    ['........m.......', '.......mn.......', '.......nnm......', '......mnon......', '......nopn......',
     '.....mnopnm.....', '.....noqpon.....', '....mnpqqpnm....', '....noqWWqon....', '....nopWWqpn....',
     '...mnoqWWqpnm...', '...noqqWWqqon...', '...nopqWWqpon...', '...mnopqqponm...', '....nnoppoonn...',
     '.....mnoonnm....', '......mnnm......', '.......mm.......'],
    ['.......m........', '.......nm.......', '......mnn.......', '......nonm......', '.....mnpon......',
     '.....nopqn......', '....mnoqpnm.....', '....noqqqpn.....', '....nopWWqnm....', '...mnoqWWqon....',
     '...nopqWWqpnm...', '...noqWWWqqon...', '...nopqWWqpon...', '...mnopqqponm...', '....nnoppoonn...',
     '.....mnoonnm....', '......mnnm......', '.......mm.......'],
    ['.........m......', '........mn......', '........nnm.....', '.......mnon.....', '.......nopnm....',
     '......mnpqon....', '......noqpon....', '.....mnpqqpnm...', '....mnoqWWqon...', '....nopWWqpnm...',
     '...mnoqWWqpon...', '...noqqWWqqon...', '...nopqWWqpon...', '...mnopqqponm...', '....nnoppoonn...',
     '.....mnoonnm....', '......mnnm......', '.......mm.......'],
]
SPARKS = [[(12, 3), (2, 7), (13, 10)], [(3, 2), (12, 6), (2, 11)], [(4, 1), (13, 4), (3, 9)]]
TOP = 13   # 화반 윗줄 y(32 칸 안). 불꽃 18행 = 0..17 → 안쪽 2~4행(y 15~17)에 아랫단이 닿는다.


def frames(n):
    lg = LW if n == 1 else LW2
    out = []
    for i, f in enumerate(FLAMES):
        cv = Cv(16, 32)
        stamp(cv, BASIN, lg, 0, TOP + 1)
        # 불꽃: 화반 안쪽(2~4행)까지만 내려오고 앞 테(5행) 위로는 안 넘는다
        y0 = TOP + 4 - len(f) + 1
        # 화반 위로 걸친 행(뒤 테~안쪽)은 가운데 폭만 남긴다 — 타원 테두리·안쪽 불빛이 불꽃 둘레로 보이게
        fl = []
        for k, r in enumerate(f):
            y = y0 + k
            half = {TOP + 1: 4, TOP + 2: 3, TOP + 3: 3, TOP + 4: 2}.get(y, 8) if y > TOP else 8
            fl.append(''.join(c if abs(x - 7.5) <= half else '.' for x, c in enumerate(r)))
        stamp(cv, fl, lg, 0, y0)
        for (x, y) in SPARKS[i]:
            stamp(cv, ['p'], lg, x, y)
        out.append(cv)
    return out


def c_wisp(n):
    def fn():
        fr = frames(n)
        img = lib.hcat(*fr)
        bg = lib.bd_kit('bd-pick-swamp-stilt-ground-mud')
        anim = []
        for f in fr:
            sc = lib.tile_fill(6, 4, bg)
            sc.a[:, :, :3] = (sc.a[:, :, :3] * 0.6).astype('uint8')
            sc.paste(f, 2 * T, 1 * T)
            lib.put_actor(sc, 4, 3)
            anim.append(sc)
        return img, {'kind': 'objects', 'parts': {f'장면{i + 1}': f for i, f in enumerate(fr)}, 'anim': anim, 'vignette': anim[0]}
    return fn


NOTES = {('prop.wisp', 'A1'): '이끼 낀 돌 화반(타원 윗면 5행·안쪽 불빛 반사·둥근 앞면·목·발) 안에서 솟는 청록 도깨비불 3장면',
         ('prop.wisp', 'A2'): '같은 화반 + 늪빛 연두 불꽃'}
FNS = {'prop.wisp': {'A1': c_wisp(1), 'A2': c_wisp(2)}}
CANDIDATES = {item: {k: P1._noted(fn, NOTES[(item, k)]) for k, fn in c.items()} for item, c in FNS.items()}
BOARD_REFS = {'prop.wisp': P1.BOARD_REFS['prop.wisp']}


def line_scenes():
    return {}
