"""묶음 p5 전투 도트 — People5-3 ~ People5-7 (무녀·사막 전사·메이드·은자·노병).

    python3 scripts/asset-gen/charset-battler/art5/p5.py [people5-3 ...] [--no-save]
    python3 scripts/asset-gen/charset-battler/build.py people5-3 ...        (--manifest 없이)
    python3 scripts/asset-gen/charset-battler/build_cast.py people5-3 ...

공용 장치는 rig45.py(p4 와 같다). 여기는 캐릭터마다의 색·무기·자세 각도·손보기(over)만 적는다.
People 칩은 cb_lib.ALL_IDS(Actor 전용)에 없으므로 repaint_weapons.py 를 인자 없이 돌려도 이 칩들은 건드리지 않는다.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from rig45 import *  # noqa: F401,F403

# 노병: 뒷손에 둥근 방패를 늘 든다(대기·걷기·공격·방어). 시전 칸은 rig 가 뒷손을 쓰므로 제외.
_SHIELD_POSES = ['idle', 'walk_a', 'walk_b', 'walk_c', 'attack_windup', 'attack_strike', 'attack', 'attack_follow',
                 'hit', 'defend', 'guard_hit', 'skill', 'weak', 'evade', 'revive']
_OLD_OVER = {pid: dict(bh=(3, 2), bwk=('shield', 0)) for pid in _SHIELD_POSES}
_OLD_OVER['defend'] = dict(bh=(-6, 0), bwk=('shield', 0), fh=(-4, -4))
_OLD_OVER['guard_hit'] = dict(bh=(-5, 0), bwk=('shield', 0), fh=(-3, -4))
# 호리병은 얼굴을 가리지 않게 앞으로 내밀어 든다(1차 검토: 사막 전사·은자 item 칸에서 얼굴이 가려짐).
_GOURD_OVER = {'item': dict(fh=(-10, -2))}

CHARS = {
    'people5-3': dict(label='무녀', skin='#fcc29b', sleeve='#7983f4', sleeve_d='#515897', sleeve_l='#b4baff',
                      main='gohei', item='ofuda', guard_angle=90, skill_angle=60,
                      angles=dict(idle=75, windup=135, strike=90, attack=20, follow=315), fx_color=(255, 120, 150, 255)),
    'people5-4': dict(label='사막 전사', skin='#f09f69', sleeve='#0f5b8e', sleeve_d='#152e48', sleeve_l='#1792dd',
                      main='scimitar', item='gourd', cast_keeps=False, over=_GOURD_OVER, guard_angle=45, skill_angle=20,
                      angles=dict(idle=60, windup=135, strike=90, attack=0, follow=315), fx_color=(255, 206, 71, 255)),
    'people5-5': dict(label='메이드', skin='#fcc29b', sleeve='#524abd', sleeve_d='#2a2670', sleeve_l='#8a84ec',
                      main='broom', item='cup', guard_angle=60, skill_angle=30,
                      angles=dict(idle=75, windup=140, strike=90, attack=0, follow=315), fx_color=(190, 226, 255, 255)),
    'people5-6': dict(label='은자', skin='#fdc39c', sleeve='#897558', sleeve_d='#60523e', sleeve_l='#ad9470',
                      main='hermit_staff', item='gourd', over=_GOURD_OVER, guard_angle=90, skill_angle=90,
                      angles=dict(idle=85, windup=135, strike=90, attack=20, follow=315), fx_color=(147, 234, 98, 255)),
    'people5-7': dict(label='노병', skin='#f9c19d', sleeve='#187a03', sleeve_d='#125503', sleeve_l='#64a30e',
                      main='spear', item='flask_brown', guard_angle=90, skill_angle=0,
                      angles=dict(idle=90, windup=135, strike=90, attack=0, follow=315), fx_color=(255, 214, 96, 255),
                      over=_OLD_OVER),
}
REVIEW_POSES = ['idle', 'walk_a', 'attack_windup', 'attack_strike', 'attack', 'attack_follow', 'skill', 'hit', 'defend',
                'cast_charge', 'cast_raise', 'cast_release', 'victory', 'item', 'weak', 'dead']


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    ids = args or list(CHARS)
    for cid in ids:
        _, issues = make_char(cid, CHARS[cid], save='--no-save' not in sys.argv)
        print(cid, CHARS[cid]['label'], 'issues:' if issues else 'ok', issues or '')
    review_board([(c, CHARS[c]['label']) for c in ids], REVIEW_POSES, EVIDENCE / 'p5' / 'battle-review.png')


if __name__ == '__main__':
    main()

