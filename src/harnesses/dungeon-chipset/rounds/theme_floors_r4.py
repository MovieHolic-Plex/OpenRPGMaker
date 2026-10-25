"""theme-floors-r4 — 마계 바닥 other.ground 넷째 판(묶음 theme_arcane, 2026-10-25). 방법을 바꿈: 허용된 바닥의 뼈대를 다시 칠한다.

r1~r3 손으로 짠 판석이 화풍 관문(평면 채움·질감 없음)·블라인드 검수를 넘지 못했다. 그래서 이미 허용된 바닥의 화소 짜임
(돌 모양·이음·값 띠)을 그대로 뼈대로 쓴다.
  출처 = 판 theme-arcane-r1 · 항목 arcane.tower_floor · 후보 A1
         (ledger.json picks: sha256 7105c12c839fbc612b8d83c893478dfaeec28e45767af4f96a6aa3d41ad5c537, 2026-10-23 위임 허용;
          object-gate 영수증 e9b258241e8f… = PASS 3/4:ok 화풍:ok, 96×96 그림).
  뼈대 = theme_arcane_r1.FA1 몸통 셋 + floor_rows(아랫켜는 몸통 0 공유, 4줄 내려 깔아 이음 3·11행) + FLOOR_FRAME_A1/INNER_A1.
값 띠 한 대 한 다시 칠하기(원본 밝기 순 → 새 밝기 순):
  J 이음 cata0 → ostone0 · K 가장자리 그늘 cata1 → ostone1 · s 어두운 반점 cata2 → ostone2 · b 몸 cata3 → vrock1
  c 몸 cata4 → vrock2 · h 윗줄 빛(b 켜) cata6 → arcane1 · H 윗줄·왼열 빛(c 켜) stone4 → vrock3
  t 밝은 반점 stone3 → ostone3(탁한 보랏빛 점 — 밝은 외톨이 점을 피하려고 밝기 순에서 일부러 내림)
  arcane1 은 h(b 켜의 윗줄 빛 띠)에만 쓴다.
  A1 = 원본 짜임 그대로 다시 칠함.
  A2 = 같은 칠 + 몸통마다 좌우 거울(이음 J 와 그 오른쪽 빛 열의 순서는 다시 맞춤: 빛은 언제나 이음 오른쪽) + 윗켜 몸통 순서 바꿈.
       아랫켜는 모든 변형이 같은 (거울한) 몸통 0 아랫켜라 칸 경계 화소가 변형끼리 맞는다.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dot  # noqa: E402
import theme_arcane_r1 as R1  # noqa: E402
from cave_r1 import autotile_cv, variants_sheet  # noqa: E402
from dot import Cv, grid  # noqa: E402
from theme_arcane_r1 import L, put_actor  # noqa: E402

WAVE = 'theme_arcane'
SOURCE = {'round': 'theme-arcane-r1', 'item': 'arcane.tower_floor', 'letter': 'A1',
          'sha256': '7105c12c839fbc612b8d83c893478dfaeec28e45767af4f96a6aa3d41ad5c537'}

LOTHER = L('J:ostone0 K:ostone1 s:ostone2 b:vrock1 c:vrock2 h:arcane1 H:vrock3 t:ostone3')
LIGHTS = 'hH'


def _stone(row, x):
    """x 열이 속한 돌의 켜 바탕(b/c): 이음을 넘지 않고 좌우로 가장 가까운 b·c."""
    for d in range(16):
        for xx in (x + d, x - d):
            if 0 <= xx < 16 and row[xx] in 'bc':
                if all(row[k] != 'J' for k in range(min(x, xx), max(x, xx) + 1)):
                    return row[xx]
    return 'b'


def mirror_body(rows):
    """좌우 거울 후 빛을 다시 앉힌다: 몸 줄에서 (빛, 이음) 쌍은 (이음, 빛)으로 — 빛은 늘 이음 오른쪽(왼쪽 위 광원),
    빛 글자는 그 오른쪽 돌의 켜(b → h · c → H). 켜 윗줄(빛 띠)은 바로 밑 몸 줄의 이음 자리·돌 켜에 맞춰 다시 쓴다."""
    m = [list(r[::-1]) for r in rows]
    body_rows = [y for y, r in enumerate(rows) if set(r) != {'J'} and not set(r) <= set('JhH')]
    for y in body_rows:
        r = m[y]
        for x in range(15):
            if r[x] in LIGHTS and r[x + 1] == 'J':
                r[x], r[x + 1] = 'J', r[x]
        for x in range(1, 16):
            if r[x] in LIGHTS:
                r[x] = 'h' if _stone(r, x + 1 if x + 1 < 16 else x) == 'b' else 'H'
    for y, r in enumerate(rows):
        if set(r) <= set('JhH') and set(r) != {'J'}:
            below = m[y + 1]
            m[y] = ['J' if below[x] == 'J' else ('h' if _stone(below, x) == 'b' else 'H') for x in range(16)]
    return [''.join(r) for r in m]


def bodies(key):
    fa = R1.FA1
    if key == 'A2':
        fa = [mirror_body(b) for b in fa]
        fa = [fa[0], fa[2], fa[1]]                   # 몸통 0 은 아랫켜 공유라 자리 고정, 나머지 순서만 바꿈
    out = []
    for b in R1.floor_rows(fa):                      # 칸 경계 열(0·15)의 반점은 켜 바탕으로 — 변형끼리 경계 화소가 똑같다
        rr = []
        for r in b:
            r = list(r)
            for x in (0, 15):
                if r[x] in 'st':
                    r[x] = _stone(r, x)
            rr.append(''.join(r))
        out.append(rr)
    return out


def ground_at(key):
    bs = [grid(b, LOTHER) for b in bodies(key)]
    return autotile_cv(bs[0], grid(R1.FLOOR_FRAME_A1, LOTHER, 32, 32), grid(R1.FLOOR_INNER_A1, LOTHER, 16, 16), bs[1:])


def _h(*v):
    x = 0x9E3779B1
    for n in v:
        x = ((x ^ (n & 0xffffffff)) * 0x85EBCA6B) & 0xffffffff
        x ^= x >> 13
    return x


def random_scene(at, n=4, seed=7):
    out = Cv(n * 16, n * 16)
    for j in range(n):
        for i in range(n):
            out.a[j * 16:(j + 1) * 16, i * 16:(i + 1) * 16] = at.bodies[_h(seed, i, j) % len(at.bodies)].a
    return out


def c_ground(key):
    def fn():
        at = ground_at(key)
        v = dot.render_cave(R1.TOWER_ROOM, R1.CR.part('C', 1, 'ceil'), R1.SR.brick_face(), at)
        put_actor(v, 4, 5)
        img = Cv(64, 16)
        for i in range(4):
            img.paste(at.bodies[i % len(at.bodies)], i * 16, 0)
        return img, {'kind': 'autotile', 'autotiles': {'ground': at}, 'vignette': v,
                     'extras': [('몸통 4×4 아무 변형', random_scene(at), 4), ('몸통 8×8(변형 섞음, 2배)', dot.mosaic(at, 8, 8), 2),
                                ('47 변형(벽·문턱 쪽 가장자리)', variants_sheet(at), 2)]}
    return fn


ITEM_FNS = {'other.ground': c_ground}
NOTES = {
    ('other.ground', 'A1'): '출처 theme-arcane-r1 arcane.tower_floor A1 짜임 그대로, 값 띠를 ostone·vrock 으로 한 대 한 다시 칠함(윗줄 빛 띠만 arcane1)',
    ('other.ground', 'A2'): '같은 출처·칠 + 몸통 좌우 거울(빛은 이음 오른쪽 유지)·윗켜 순서 바꿈',
}


def _noted(fn, note):
    def g_():
        cv, meta = fn()
        meta['note'] = note
        return cv, meta
    return g_


CANDIDATES = {item: {k: _noted(mk(k), NOTES[(item, k)]) for k in ('A1', 'A2')} for item, mk in ITEM_FNS.items()}


def line_scenes():
    return {}
