"""묶음 p2 — People 8명 전투 도트(방랑 점술사·검무사·도박사·천사·요정·국왕·상인·귀족).

    python3 scripts/asset-gen/charset-battler/art5/p2.py [people2-3 ...] [--dry]

기준은 걷기 칩(People2~3, 24×32) 원본이고 팔·장비·시전 빛만 리그(rig.py·poses.py)로 찍는다. 이미지 생성 없음.
출력: tiledata/charset-battlers/<chip>/<pose>.png(원본) → public/assets/generated/charset-battlers/<chip>.png, cast/<chip>.png.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from poses import *  # noqa

SPECS = [
    ('people2-3', '방랑 점술사', dict(weapon='cards', arch='small'), {}),
    ('people2-4', '검무사', dict(weapon='scimitar', arch='melee', off='scimitar'), {}),
    ('people2-5', '도박사', dict(weapon='dice', arch='small'), {}),
    ('people2-6', '천사', dict(weapon='staff', wargs=dict(ln=16, head='orb', col='gd'), arch='pole'), dict(skirt=True)),
    ('people2-7', '요정', dict(weapon='wand', wargs=dict(col='gr'), arch='small'), {}),
    ('people3-0', '국왕', dict(weapon='scepter', arch='small'), dict(skirt=True)),
    ('people3-1', '상인', dict(weapon='bag', arch='small'), {}),
    ('people3-2', '귀족', dict(weapon='rapier', arch='melee'), {}),
]

if __name__ == '__main__':
    run_batch('p2', SPECS, sys.argv[1:])
