"""묶음 a3 전투 도트(Actor) — 광전사 actor4-2 · 총사 actor4-3 · 무희 actor4-4 · 연금술사 actor4-5 · 소환사 actor4-6 (2026-09-29, r2w2).

    python3 scripts/asset-gen/charset-battler/art5/a3_actor.py [actor4-2 ...] [--dry]
    python3 scripts/asset-gen/charset-battler/build.py actor4-2 actor4-3 actor4-4 actor4-5 actor4-6        (--manifest 없이)
    python3 scripts/asset-gen/charset-battler/build_cast.py actor4-2 actor4-3 actor4-4 actor4-5 actor4-6

엔진: lib_a3.py(r2w1 lib_a12 사본), 격자: weapons_a3.py. 몸은 기존 손도트 원본에서 옛 장비만 뺀 것.
repaint_weapons.py 는 이 다섯 칩을 건너뛴다(R2W2_A3).
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import lib_a3 as L
from lib_a3 import put, FX

FX.update({'rage': (220, 40, 40, 255), 'muzzle': (255, 220, 110, 255), 'fanpink': (255, 150, 200, 255),
           'acid': (130, 240, 120, 255), 'summon': (190, 140, 255, 255)})
ROLES = {}


def role(cid, key, kind, **extra):
    def deco(fn):
        ROLES[cid] = dict(key=key, kind=kind, design=fn, **extra)
        return fn
    return deco


def rage_marks(im, body, ctx):
    """광전사 분노: 머리 위 붉은 김 세 줄."""
    for x, y0 in ((20, 8), (25, 6), (30, 8)):
        for k in range(3):
            put(im, x + (k % 2), y0 - k, FX['rage'], over=False)


def muzzle(im, body, ctx):
    """총구 섬광: 총구(날끝 head) 바로 앞 별 모양."""
    head = ctx.get('head')
    if not head:
        return
    x, y = head[0] - 3, head[1]
    for dx, dy, k in ((0, 0, 'white'), (-1, 0, 'muzzle'), (-2, 0, 'muzzle'), (-3, 0, 'rage'), (0, -1, 'muzzle'), (0, 1, 'muzzle'),
                      (-1, -2, 'rage'), (-1, 2, 'rage')):
        put(im, x + dx, y + dy, FX[k], over=False)


def smoke(im, body, ctx):
    head = ctx.get('head')
    if head:
        for dx, dy in ((-2, -3), (-1, -5), (1, -6), (0, -8)):
            put(im, head[0] + dx, head[1] + dy, (187, 208, 217, 255), over=False)


def thrown_flask(im, body, ctx):
    """던진 약병: 몸 앞 위 공중에 초록 병 + 궤적 점."""
    L.outlined(im, (6, 16), ['.g.', 'ZzZ', 'zZz', '.z.'], {'g': (217, 169, 87, 255), 'Z': (150, 240, 170, 255), 'z': (40, 140, 90, 255)})
    for x, y in ((11, 21), (13, 24), (15, 27)):
        put(im, x, y, FX['acid'], over=False)


def rune_ring(im, body, ctx):
    """소환진: 발밑 타원 점선."""
    import math
    for i in range(28):
        a = i * 2 * math.pi / 28
        x, y = round(24 + 15 * math.cos(a)), round(43 + 2 * math.sin(a))
        if i % 3 != 2 and 0 < y <= 44:
            put(im, x, y, FX['summon'], over=False)


@role('actor4-2', 'berserker', 'war_axe')
def berserker(pid):
    d = {}
    if pid == 'attack':
        d['fx'] = [('streak', [(2, 36, 10), (4, 40, 8)])]
    elif pid in ('skill', 'victory', 'victory_b'):
        d['fx'] = [('call', rage_marks)]
        if pid == 'skill':
            d['fx'].append(('burst', (6, 34)))
    return d


@role('actor4-3', 'gunner', 'musket_a3')
def gunner(pid):
    d = {}
    if pid in ('attack', 'attack_strike', 'skill', 'attack_follow'):
        d['weapons'] = [('musket_a3', 0, None)]
    if pid == 'attack':
        d['fx'] = [('call', muzzle)]
    elif pid == 'skill':
        d['fx'] = [('call', muzzle), ('call', smoke)]
    elif pid == 'attack_follow':
        d['fx'] = [('call', smoke)]
    elif pid == 'attack_windup':
        d['weapons'] = [('musket_a3', 90, None)]
    return d


@role('actor4-4', 'dancer', 'fan_a3')
def dancer(pid):
    d = {}
    if pid in ('skill', 'victory', 'victory_b', 'cast_support_2', 'cast_support_3', 'cast_raise'):
        d['fx'] = [('motes', 'fanpink', [(6, 14), (38, 12), (4, 24), (41, 26), (12, 8)]), ('sparkle', (8, 20), 'fanpink')]
    elif pid == 'attack':
        d['fx'] = [('arc', (14, 30), 11, -30, 40)]
    return d


@role('actor4-5', 'alchemist', 'flask_rod', no_shield=True)
def alchemist(pid):
    d = {}
    if pid == 'skill':
        d['fx'] = [('call', thrown_flask)]
    elif pid in ('cast_raise', 'cast_arcane_2', 'victory'):
        d['fx'] = [('motes', 'acid', [(8, 12), (36, 14), (6, 22), (40, 22)])]
    return d


@role('actor4-6', 'summoner', 'summon_rod')
def summoner(pid):
    d = {}
    if pid in ('skill', 'cast_raise', 'cast_arcane_2', 'cast_arcane_3', 'cast_release', 'victory'):
        d['fx'] = [('call', rune_ring), ('motes', 'summon', [(8, 12), (38, 10), (5, 22), (41, 20), (22, 4)])]
    return d


if __name__ == '__main__':
    L.main(ROLES, 'a3', sys.argv[1:])

