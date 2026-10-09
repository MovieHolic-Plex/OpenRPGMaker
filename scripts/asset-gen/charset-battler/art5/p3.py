"""묶음 p3 — People 8명 전투 도트(공주·대마법사·중갑병·용병·용기사·마을 청년·부족 전사·점성술사).

    python3 scripts/asset-gen/charset-battler/art5/p3.py [people3-3 ...] [--dry]

기준은 걷기 칩(People3~4, 24×32) 원본이고 팔·장비·시전 빛만 리그(rig.py·poses.py)로 찍는다. 이미지 생성 없음.
출력: tiledata/charset-battlers/<chip>/<pose>.png(원본) → public/assets/generated/charset-battlers/<chip>.png, cast/<chip>.png.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from poses import *  # noqa

SPECS = [
    ('people3-3', '공주', dict(weapon='wand', wargs=dict(ln=8, col='gd'), arch='small'), dict(skirt=True)),
    ('people3-4', '대마법사', dict(weapon='staff', wargs=dict(ln=18, head='crystal', col='bl'), arch='pole'), dict(skirt=True)),
    ('people3-5', '중갑병', dict(weapon='mace', arch='melee', off='shield'), {}),
    ('people3-6', '용병', dict(weapon='axe', arch='melee'), {}),
    ('people3-7', '용기사', dict(weapon='spear', arch='pole'), {}),
    ('people4-0', '마을 청년', dict(weapon='club', wargs=dict(ln=9), arch='melee'), {}),
    ('people4-1', '부족 전사', dict(weapon='boomerang', arch='small'), {}),
    ('people4-2', '점성술사', dict(weapon='staff', wargs=dict(ln=16, head='star'), arch='pole'), dict(skirt=True)),
]

if __name__ == '__main__':
    run_batch('p3', SPECS, sys.argv[1:])
