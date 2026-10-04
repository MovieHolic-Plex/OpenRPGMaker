"""묶음 a1 전투 도트 — 발키리·성기사·적마도사·암흑기사·마도사·시공술사·도적·야수조련사 (2026-09-29).

    python3 scripts/asset-gen/charset-battler/art5/a1.py [actor1-1 ...] [--dry]
    python3 scripts/asset-gen/charset-battler/build.py actor1-1 actor1-2 ...        (--manifest 없이)
    python3 scripts/asset-gen/charset-battler/build_cast.py actor1-1 actor1-2 ...

기존 손도트 몸에 직업 장비만 다시 얹는다(엔진: lib_a12.py). 마도사(actor1-5)는 기본 지팡이 그대로라 손대지 않는다.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import lib_a12 as L
from lib_a12 import FX

ROLES = {}


def role(cid, key, kind, **extra):
    def deco(fn):
        ROLES[cid] = dict(key=key, kind=kind, design=fn, **extra)
        return fn
    return deco


@role('actor1-1', 'valkyrie', 'spear')
def valkyrie(pid):
    d = {}
    if pid in ('skill', 'victory', 'victory_b', 'cast_raise', 'cast_wind_2'):
        d['fx'] = [('feathers', [(6, 14), (10, 9), (37, 12)])]
    if pid in ('attack_strike', 'attack'):
        d['fx'] = [('streak', [(2, 30, 10)])] if pid == 'attack' else []
    return d


@role('actor1-2', 'paladin', 'sword')
def paladin(pid):
    d = {}
    if pid == 'dead':
        d['fx'] = [('shield', (35, 41), True)]
    elif pid in ('front', 'dying', 'revive', 'item'):
        d['fx'] = []
    else:
        c = (19, 36) if pid in ('defend', 'guard_hit') else (30, 36)
        d['fx'] = [('shield', c)]
    if pid in ('skill', 'victory', 'cast_heal_2', 'cast_heal_3'):
        d['fx'] = d.get('fx', []) + [('sparkle', (8, 16), 'holy'), ('sparkle', (38, 12), 'holy')]
    return d


@role('actor1-3', 'red_mage', 'rapier')
def red_mage(pid):
    d = {}
    if pid in ('skill', 'cast_fire_3', 'cast_ice_3', 'cast_thunder_3'):
        d['fx'] = [('sparkle', (6, 24), 'red'), ('sparkle', (36, 14), 'time')]
    if pid in ('attack',):
        d['fx'] = [('streak', [(2, 32, 9)])]
    return d


@role('actor1-4', 'dark_knight', 'dark_blade')
def dark_knight(pid):
    d = {}
    if pid in ('attack', 'attack_strike', 'skill'):
        d['fx'] = [('motes', 'violet', [(5, 26), (9, 20), (3, 32), (14, 17)])]
    if pid in ('cast_dark_2', 'cast_dark_3', 'victory'):
        d['fx'] = [('motes', 'violet', [(8, 12), (36, 14), (5, 22), (40, 26)])]
    return d


@role('actor1-6', 'chronomancer', 'chrono_staff')
def chrono(pid):
    d = {}
    if pid in ('skill', 'cast_arcane_3', 'cast_support_3', 'cast_charge'):
        d['fx'] = [('clock', (9, 22), 5)]
    if pid in ('cast_raise', 'cast_arcane_2', 'cast_support_2', 'victory'):
        d['fx'] = [('clock', (24, 8), 5)]
    return d


@role('actor2-1', 'thief', 'dagger')
def thief(pid):
    d = {}
    if pid == 'attack':
        d['fx'] = [('streak', [(4, 33, 8)])]
    if pid == 'skill':
        d['fx'] = [('sparkle', (6, 30), 'steel')]
    return d


@role('actor2-2', 'beast_tamer', 'tamer_rod')
def tamer(pid):
    d = {}
    if pid in ('skill', 'cast_support_3', 'victory'):
        d['fx'] = [('motes', 'sand', [(8, 41), (12, 39), (16, 41), (11, 43)])]
    return d


if __name__ == '__main__':
    L.main(ROLES, 'a1', sys.argv[1:])
