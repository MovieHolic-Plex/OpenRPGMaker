"""oni_warrior_charge: 귀신 돌진. 붉은 잔상 세 겹이 오른쪽에서 파고들고, 세로 초승달 일격과 불똥으로 끝난다."""
from lib_r2w8 import *

KEY, SIZE, FRAMES, ANCHOR = 'oni_warrior_charge', 64, 8, 'target'
PAL = pal(ONI, pick(BLADE, 'k3'), pick(GOLD, 'y3'))


def draw(c, f):
    cy = 34
    if f <= 4:
        head = lerp(64, 20, ease(min(1.0, (f + 1) / 4)))
        for i, y in enumerate((22, 27, 32, 37, 42)):
            L = 12 + (i * 7 + f * 3) % 9
            c.line([(head + 6 + i % 2 * 3, y), (min(63, head + 20 + L), y)], 'o1' if i % 2 else 'o2', 2 if i == 2 else 1)
        for j in range(3):                      # 몸 잔상: 앞이 밝고 뒤로 갈수록 성기다
            x = head + 6 + j * 9
            if j == 0:
                c.oval(x, cy, 4, 12, 'o3')
                c.poly([(x - 3, cy - 11), (x - 5, cy - 17), (x - 1, cy - 12)], 'o3')   # 뿔
                c.poly([(x + 2, cy - 11), (x + 3, cy - 17), (x + 4, cy - 11)], 'o3')
            else:
                c.ddisc(x, cy, 5 - j, 'o2' if j == 1 else 'o1', parity=f % 2, squash=2.4)
    if 3 <= f <= 6:
        a = f - 3
        c.blade((40, 6), (22, 60), 10, [7, 8, 5, 3][a], ['o1', 'o2', 'o3', 'k3'] if a < 2 else ['o1', 'o2'], 0.6 if a == 0 else 1.0)
    if f == 4:
        c.spark(30, 32, 12, 'y3', 'o3', diag=True)
    if f >= 4:
        spark_burst(c, 30, 32, (f - 3) / 4.5, 14, 3, ['y3', 'o3', 'o2', 'o1'], spd=(8, 26))


if __name__ == '__main__':
    run(globals())

