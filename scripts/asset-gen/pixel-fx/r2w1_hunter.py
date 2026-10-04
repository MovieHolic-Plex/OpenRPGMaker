"""사냥꾼(class_hunter, 칩 actor2-7): 초록 모자 사냥꾼, 덫·석궁. 새 시트: 곰덫(착탄)."""
import math

from lib_r2w1 import *

SKILLS = Skills('hunter', 'class_hunter', 'actor2-7')
SKILLS.add('bolt', '석궁 사격', 1, 'shoot', '짧고 무거운 석궁 볼트를 쏜다', 'ninja_needle', 'ninja_shuriken_hit') \
    .add('bear_trap', '곰덫', 3, 'cast', '적 발밑에 곰덫을 던져 물어 붙잡는다', 'hunter_bear_trap') \
    .add('poison_bolt', '독 볼트', 5, 'shoot', '독을 바른 볼트로 적을 중독시킨다', 'ranger_arrow', 'scout_venom') \
    .add('hawk_eye', '매의 눈', 7, 'buff', '숨을 고르고 급소를 노려 명중과 치명률을 올린다', 'samurai_mind_eye') \
    .add('net', '그물 투척', 10, 'cast', '질긴 그물을 던져 적을 묶는다', 'mon_web_net') \
    .add('trap_field', '덫 지대', 12, 'cast', '모든 적 발밑에 곰덫을 깔아 한꺼번에 문다', ('hunter_bear_trap', 'allTargets')) \
    .add('skinning', '사냥칼 마무리', 16, 'dash-strike', '붙잡힌 사냥감에 파고들어 사냥칼로 가른다', 'druid_claw') \
    .add('grand_hunt', '대사냥', 22, 'finisher', '몰이꾼 함성과 함께 모든 적을 한 번에 사냥하는 필살기', 'mon_rampage_screen', ('ranger_power_hit', 'allTargets'))

TRAP = pal(pick(STEEL, 's0', 's1', 's2', 's3'), pick(BROWN, 't1', 't2', 't3'), pick(CRIM, 'r2', 'r3'), pick(GOLD, 'y2', 'y3'), WHITE)
CX, FEET = 32, 56


def jaws(c, close, y0=FEET):
    """곰덫(옆에서 본 모양). 두 턱은 힌지(CX, y0)를 중심으로 한 사분원이다.
    close 0 = 바닥에 납작하게 벌어짐(세로 눌림 0.22), 1 = 세워져 위에서 맞물린 반원. 턱 안쪽으로 톱니."""
    R = 15
    sq = lerp(0.22, 1.0, close)
    for side in (-1, 1):
        a0, a1 = (math.pi, math.pi * 1.5) if side < 0 else (math.pi * 1.5, math.tau)
        pts = [(CX + math.cos(lerp(a0, a1, i / 12)) * R, y0 + math.sin(lerp(a0, a1, i / 12)) * R * sq) for i in range(13)]
        # 톱니: 턱을 따라 안쪽(힌지 쪽)으로 뾰족하게
        for i in range(1, 12, 2):
            a = lerp(a0, a1, i / 12)
            bx, by = CX + math.cos(a) * R, y0 + math.sin(a) * R * sq
            tx, ty = CX + math.cos(a) * (R - 5), y0 + math.sin(a) * (R - 5) * sq
            c.poly([pol(bx, by, 1.6, a + math.pi / 2), pol(bx, by, 1.6, a - math.pi / 2), (tx, ty)], 's2')
            c.px(tx, ty, 's3')
        c.line(pts, 's0', 4)
        c.line(pts, 's1', 2)
        c.line(pts[: 7], 's3', 1)
    # 받침판·스프링
    c.rect(CX - R - 2, y0, CX + R + 2, y0 + 2, 's0')
    c.rect(CX - R - 1, y0, CX + R + 1, y0 + 1, 's1')
    c.oval(CX, y0, 4, 2, 's0')
    c.oval(CX, y0, 3, 1, 'y2')


@effect('hunter_bear_trap', 64, 8, 'target', TRAP)
def _(c, f):
    # 0 날아와 떨어짐 → 1 벌린 채 착지 → 2~3 턱이 솟음 → 4 맞물림(섬광) → 5~7 사슬 흔들림·먼지
    if f == 0:
        c.line([(60, 10), (40, 30)], 's1')
        c.dring(CX + 6, 34, 6, 's2')
        jaws(c, 0.3, 40)
        return
    close = {1: 0.0, 2: 0.35, 3: 0.7}.get(f, 1.0)
    shake = [0, 0, 0, 0, -1, 1, -1, 0][f]
    for i in range(6):
        x = CX + 10 + i * 3
        c.px(x, FEET - (i % 2) + shake * (i % 2), 't2' if i % 2 else 's1')
    c.line([(CX + 28, FEET - 3), (CX + 30, FEET + 2)], 't1', 2)
    jaws(c, close, FEET + (1 if f == 1 else 0))
    if f == 1:
        c.shockring(CX, FEET, 16, 't2', 't3', 0.3, 1)
    if f == 4:
        c.spark(CX, FEET - 13, 7, 'w', 'y2', diag=True)
        c.burst(CX, FEET - 13, 5, ['r2', 'y2', 'y3', 'w'], rays=8, long=1.8)
    if f >= 5:
        u = f - 5
        c.fan_lines(CX, FEET - 13, 5, 10 + u * 3, 14 + u * 4, 200, 340, 'y3' if u < 2 else 's2')
        for side in (-1, 1):
            c.puff(CX + side * (14 + u * 4), FEET - 2, 3 + u, ['t1', 't2', 't3'], seed=f + side)
        c.drops(CX, FEET - 20, 4 - u, 8, 10, f, 'r3', 'r2')

