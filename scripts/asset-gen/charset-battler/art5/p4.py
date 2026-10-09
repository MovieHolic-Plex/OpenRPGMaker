"""묶음 p4 전투 도트 — People4-3 ~ People5-2 (뱃사람·노승·귀부인·유목민·수녀·광대·꼬마 발명가·낭인).

    python3 scripts/asset-gen/charset-battler/art5/p4.py [people4-3 ...] [--no-save]
    python3 scripts/asset-gen/charset-battler/build.py people4-3 ...        (--manifest 없이)
    python3 scripts/asset-gen/charset-battler/build_cast.py people4-3 ...

공용 장치는 rig45.py. 여기는 캐릭터마다의 색·무기·자세 각도·손보기(over)만 적는다.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from rig45 import *  # noqa: F401,F403

CHARS = {
    'people4-3': dict(label='뱃사람', skin='#d28666', sleeve='#e66523', sleeve_d='#963c19', sleeve_l='#ff9646',
                      main='anchor', item='bottle_rum', cast_keeps=False, guard_angle=90, skill_angle=90,
                      angles=dict(idle=70, windup=140, strike=90, attack=0, follow=315), fx_color=(120, 200, 255, 255)),
    'people4-4': dict(label='노승', skin='#d28666', sleeve='#257d5c', sleeve_d='#154b39', sleeve_l='#6b8e6e',
                      main='shakujo', item='beads', guard_angle=90, skill_angle=90,
                      angles=dict(idle=90, windup=135, strike=90, attack=25, follow=315), fx_color=(255, 226, 130, 255)),
    'people4-5': dict(label='귀부인', skin='#d19b85', sleeve='#c98d14', sleeve_d='#aa7100', sleeve_l='#ffde5a',
                      main='fan', item='bottle_pink', guard_angle=30, skill_angle=20,
                      angles=dict(idle=50, windup=110, strike=60, attack=0, follow=300), fx_color=(255, 160, 190, 255)),
    'people4-6': dict(label='유목민', skin='#d28666', sleeve='#a6421e', sleeve_d='#612712', sleeve_l='#e66523',
                      main='javelin', item='pouch', cast_keeps=False, guard_angle=90, skill_angle=20,
                      angles=dict(idle=80, windup=150, strike=90, attack=0, follow=315), fx_color=(240, 210, 130, 255)),
    'people4-7': dict(label='수녀', skin='#d28666', sleeve='#6d4463', sleeve_d='#422536', sleeve_l='#93658c',
                      main='cross_staff', item='vial_blue', guard_angle=90, skill_angle=90,
                      angles=dict(idle=90, windup=135, strike=90, attack=10, follow=315), fx_color=(190, 226, 255, 255)),
    'people5-0': dict(label='광대', skin='#fcc29b', sleeve='#2939c5', sleeve_d='#10186a', sleeve_l='#2073ee',
                      main='marotte', item='ball', guard_angle=60, skill_angle=60,
                      angles=dict(idle=60, windup=130, strike=90, attack=0, follow=315), fx_color=(255, 214, 64, 255)),
    'people5-1': dict(label='꼬마 발명가', skin='#fcc29b', sleeve='#883858', sleeve_d='#421c2b', sleeve_l='#c05078',
                      main='wrench', item='gear', guard_angle=60, skill_angle=60,
                      angles=dict(idle=60, windup=135, strike=90, attack=0, follow=315), fx_color=(255, 200, 90, 255)),
    'people5-2': dict(label='낭인', skin='#fcc29b', sleeve='#701527', sleeve_d='#3f131c', sleeve_l='#a82c2a',
                      main='katana', item='flask_brown', guard_angle=45, skill_angle=0,
                      angles=dict(idle=315, windup=135, strike=90, attack=0, follow=315), fx_color=(255, 110, 100, 255)),
}
REVIEW_POSES = ['idle', 'walk_a', 'attack_windup', 'attack_strike', 'attack', 'attack_follow', 'skill', 'hit', 'defend',
                'cast_charge', 'cast_raise', 'cast_release', 'victory', 'item', 'weak', 'dead']


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    ids = args or list(CHARS)
    for cid in ids:
        _, issues = make_char(cid, CHARS[cid], save='--no-save' not in sys.argv)
        print(cid, CHARS[cid]['label'], 'issues:' if issues else 'ok', issues or '')
    review_board([(c, CHARS[c]['label']) for c in ids], REVIEW_POSES, EVIDENCE / 'p4' / 'battle-review.png')


if __name__ == '__main__':
    main()
