"""묶음 a2 전투 도트 — 해적·마녀술사·엘프 궁사·사냥꾼·권투가·무술가·장군·왕자 기사 (2026-09-29).

    python3 scripts/asset-gen/charset-battler/art5/a2.py [actor2-4 ...] [--dry]
    python3 scripts/asset-gen/charset-battler/build.py actor2-4 actor2-5 ...        (--manifest 없이)
    python3 scripts/asset-gen/charset-battler/build_cast.py actor2-4 actor2-5 ...

엔진: lib_a12.py. 권투가는 두 주먹에 붉은 글러브, 무술가는 맨몸(앞차기·기공).
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import lib_a12 as L

ROLES = {}


def role(cid, key, kind, **extra):
    def deco(fn):
        ROLES[cid] = dict(key=key, kind=kind, design=fn, **extra)
        return fn
    return deco


@role('actor2-4', 'pirate', 'cutlass')
def pirate(pid):
    d = {}
    if pid == 'attack':
        d['fx'] = [('streak', [(3, 34, 9)])]
    if pid in ('skill', 'victory'):
        d['fx'] = [('gunsmoke', [(6, 26), (9, 22), (5, 19), (12, 17)]), ('sparkle', (4, 30), 'ember')]
    return d


@role('actor2-5', 'sorceress', 'skull_staff')
def sorceress(pid):
    d = {}
    if pid in ('skill', 'cast_dark_3', 'cast_dark_2', 'cast_raise', 'victory'):
        d['fx'] = [('motes', 'violet', [(7, 14), (37, 12), (4, 22), (40, 24), (10, 8)])]
    return d


@role('actor2-6', 'elf_archer', 'elf_bow')
def elf(pid):
    d = {}
    if pid in ('skill', 'victory', 'cast_release'):
        d['fx'] = [('motes', 'green', [(6, 16), (36, 12), (40, 22), (8, 28)]), ('sparkle', (4, 20), 'green')]
    return d


@role('actor2-7', 'hunter', 'crossbow')
def hunter(pid):
    d = {}
    if pid in ('idle', 'walk_a', 'walk_b', 'walk_c', 'defend', 'guard_hit', 'weak', 'attack_strike', 'attack', 'skill', 'attack_follow'):
        d['weapons'] = [('crossbow', 0, None)]
    if pid == 'attack':
        d['fx'] = [('streak', [(1, 33, 6)])]
    return d


@role('actor3-1', 'brawler', None, hands_from_arms=True)
def brawler(pid):
    d = dict(weapons=[])
    d['fx'] = [('gloves',)]
    if pid == 'attack':
        d['fx'] += [('burst', (6, 33))]
    elif pid == 'attack_strike':
        d['fx'] += [('streak', [(20, 27, 5), (21, 31, 4)])]
    elif pid == 'attack_follow':
        d['fx'] += [('burst', (8, 30))]
    elif pid == 'skill':
        d['fx'] += [('burst', (7, 29))]
    return d


@role('actor3-3', 'martial_artist', None)
def martial(pid):
    d = dict(weapons=[])
    if pid == 'attack':
        d['fx'] = [('burst', (8, 32))]
    elif pid == 'attack_strike':
        d['fx'] = [('streak', [(20, 27, 5), (21, 31, 4)])]
    elif pid == 'attack_follow':
        d['legs'] = {'front': ((16, 39), (7, 40))}
        d['fx'] = [('burst', (5, 39))]
    elif pid == 'skill':
        d['fx'] = [('chi', (7, 28))]
    return d


@role('actor3-7', 'general', 'greatsword')
def general(pid):
    d = {}
    if pid in ('skill', 'victory', 'victory_b'):
        d['fx'] = [('streak', [(2, 20, 6), (0, 26, 7), (2, 32, 6)])]
    return d


@role('actor4-1', 'prince', 'royal_rapier')
def prince(pid):
    d = {}
    if pid in ('skill', 'victory', 'cast_heal_3', 'cast_arcane_3'):
        d['fx'] = [('sparkle', (7, 14), 'holy'), ('sparkle', (38, 20), 'holy')]
    if pid == 'attack':
        d['fx'] = [('streak', [(2, 32, 9)])]
    return d


if __name__ == '__main__':
    L.main(ROLES, 'a2', sys.argv[1:])
