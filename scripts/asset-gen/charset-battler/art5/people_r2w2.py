"""People 칩 전투 도트 — 묶음 a3(People1-0~2)·p1(People1-3~People2-2) (2026-09-29, r2w2).

    python3 scripts/asset-gen/charset-battler/art5/people_r2w2.py [a3|p1|people1-0 ...] [--no-save]
    python3 scripts/asset-gen/charset-battler/build.py people1-0 ...        (--manifest 없이)
    python3 scripts/asset-gen/charset-battler/build_cast.py people1-0 ...

공용 장치는 rig_r2w2.py(r2w4 rig45 사본), 소품 격자는 props_r2w2.py. 여기는 캐릭터마다 색·무기·자세 각도·손보기(over)만 적는다.
대기 높이 = 걷기 칩 높이(무릎 굽힘 없음). 이미지 생성·축소·트레이스 없음.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from rig_r2w2 import *  # noqa: F401,F403
import props_r2w2  # noqa: F401,E402  (소품 등록)

CHARS = {
    # ── a3
    'people1-0': dict(label='견습 기사', batch='a3', skin='#fcc29b', sleeve='#2a282d', sleeve_d='#151617', sleeve_l='#434146',
                      main='short_sword', item='potion_red', guard_angle=90, skill_angle=45,
                      angles=dict(idle=45, windup=135, strike=90, attack=0, follow=315), fx_color=(255, 226, 120, 255)),
    'people1-1': dict(label='꽃집 아가씨', batch='a3', skin='#fcc29b', sleeve='#c59daf', sleeve_d='#76415c', sleeve_l='#f2e3ea',
                      main='bouquet', item='basket', guard_angle=90, skill_angle=70,
                      angles=dict(idle=60, windup=120, strike=90, attack=10, follow=315), fx_color=(255, 150, 190, 255)),
    'people1-2': dict(label='검객', batch='a3', skin='#f1a06a', sleeve='#154b39', sleeve_d='#0a261f', sleeve_l='#257d5c',
                      main='slim_blade', item='potion_red', guard_angle=90, skill_angle=0,
                      angles=dict(idle=20, windup=135, strike=90, attack=0, follow=315), fx_color=(150, 210, 255, 255)),
    # ── p1
    'people1-3': dict(label='학자', batch='p1', skin='#e9c093', sleeve='#6e4b2d', sleeve_d='#3f2a18', sleeve_l='#a5795d',
                      main='book', item='potion_red', cast_keeps=True, guard_angle=90, skill_angle=60,
                      angles=dict(idle=60, windup=100, strike=80, attack=20, follow=330), fx_color=(120, 220, 255, 255)),
    'people1-4': dict(label='광부', batch='p1', skin='#d28666', sleeve='#6d3832', sleeve_d='#421a1f', sleeve_l='#894e47',
                      main='pickaxe', item='potion_red', cast_keeps=False, guard_angle=90, skill_angle=90,
                      angles=dict(idle=60, windup=135, strike=90, attack=0, follow=315), fx_color=(240, 190, 110, 255)),
    'people1-5': dict(label='농부', batch='p1', skin='#d19b85', sleeve='#573529', sleeve_d='#1a0c07', sleeve_l='#634a46',
                      main='pitchfork', item='herbs', cast_keeps=False, guard_angle=90, skill_angle=20,
                      angles=dict(idle=80, windup=150, strike=90, attack=0, follow=315), fx_color=(255, 214, 80, 255)),
    'people1-6': dict(label='촌장', batch='p1', skin='#fdc39c', sleeve='#3f501d', sleeve_d='#1e2a1b', sleeve_l='#71732e',
                      main='cane', item='potion_red', guard_angle=90, skill_angle=90,
                      angles=dict(idle=270, windup=120, strike=90, attack=10, follow=300), fx_color=(255, 240, 170, 255)),
    'people1-7': dict(label='할머니', batch='p1', skin='#ebd7c5', sleeve='#e66523', sleeve_d='#612712', sleeve_l='#ff8832',
                      main='ladle', item='herbs', guard_angle=90, skill_angle=70,
                      angles=dict(idle=60, windup=120, strike=90, attack=10, follow=315), fx_color=(147, 234, 98, 255)),
    'people2-0': dict(label='건슬링어', batch='p1', skin='#fcc29b', sleeve='#2a282d', sleeve_d='#151617', sleeve_l='#434146',
                      main='revolver', item='potion_red', cast_keeps=False, guard_angle=45, skill_angle=0,
                      angles=dict(idle=300, windup=90, strike=20, attack=0, follow=10), fx_color=(255, 220, 110, 255)),
    'people2-1': dict(label='집사', batch='p1', skin='#d28666', sleeve='#2a282d', sleeve_d='#151617', sleeve_l='#5a6060',
                      main='knife', item='tea_cup', cast_keeps=False, guard_angle=45, skill_angle=0,
                      angles=dict(idle=0, windup=135, strike=60, attack=0, follow=330), fx_color=(214, 222, 236, 255)),
    'people2-2': dict(label='승려', batch='p1', skin='#f9c19d', sleeve='#e66523', sleeve_d='#612712', sleeve_l='#ff8832',
                      main='prayer_staff', item='beads', guard_angle=90, skill_angle=90,
                      angles=dict(idle=90, windup=135, strike=90, attack=15, follow=315), fx_color=(255, 214, 96, 255)),
}
import rig_r2w2 as _R  # noqa: E402
_base_fx = _R.rig_fx


def _fx(rig, cell, pid, fx, P, S):
    """직업 도트: muzzle(총구 섬광, 손 앞 10칸) · pages(학자 책장 빛)."""
    hand = P.get('_hand')
    if fx == 'muzzle' and hand:
        x, y = round(hand[0]) - 14, round(hand[1]) - 1
        for dx, dy, c in ((0, 0, WHITE), (-1, 0, (255, 220, 110, 255)), (-2, 0, (255, 220, 110, 255)), (-3, 0, (230, 90, 40, 255)),
                          (0, -1, (255, 220, 110, 255)), (0, 1, (255, 220, 110, 255)), (-1, -2, (230, 90, 40, 255)), (-1, 2, (230, 90, 40, 255))):
            rig.put(cell, x + dx, y + dy, c, over=False)
    elif fx == 'pages' and hand:
        for dx, dy in ((-4, -8), (-7, -5), (-2, -11)):
            spark_fx(rig, cell, (round(hand[0]) + dx, round(hand[1]) + dy), (120, 220, 255, 255), 1)
    else:
        _base_fx(rig, cell, pid, fx, P, S)


_R.rig_fx = _fx
CHARS['people2-0']['over'] = {'attack': dict(fx=['muzzle']), 'skill': dict(fx=['muzzle', 'skillglow'])}
CHARS['people1-3']['over'] = {'skill': dict(fx=['pages'])}

REVIEW_A = ['idle', 'walk_a', 'attack_windup', 'attack_strike', 'attack', 'attack_follow', 'skill', 'hit', 'defend']
REVIEW_B = ['cast_charge', 'cast_raise', 'cast_release', 'cast_fire_3', 'cast_heal_2', 'victory', 'item', 'weak', 'dead']


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    ids = []
    for a in args or ['a3', 'p1']:
        ids += [c for c, v in CHARS.items() if v['batch'] == a] if a in ('a3', 'p1') else [a]
    for cid in ids:
        _, issues = make_char(cid, CHARS[cid], save='--no-save' not in sys.argv)
        print(cid, CHARS[cid]['label'], 'issues:' if issues else 'ok', issues or '')
    for batch in sorted({CHARS[c]['batch'] for c in ids}):
        chars = [(c, CHARS[c]['label']) for c in ids if CHARS[c]['batch'] == batch]
        for tag, poses in (('a', REVIEW_A), ('b', REVIEW_B)):
            print(review_board(chars, poses, EVIDENCE / batch / 'battler' / f'people_{tag}.png'))


if __name__ == '__main__':
    main()

