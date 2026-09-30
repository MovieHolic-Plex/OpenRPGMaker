from locker import *
W = ('vwhite', 6)
# A: v5 회청색 쇠 사물함, 체육복·가방 삐져나옴
def clothA(c):
    # 윗줄 2열 문 아랫틈에 체육복
    c.rect(11, 14, 3, 3, ('jersey', 4)); c.hl(11, 16, 3, ('jersey', 2)); c.px(11, 14, ('jersey', 5))
    # 아랫줄 3열 가방 끈
    c.rect(20, 26, 3, 3, ('uniform', 4)); c.hl(20, 28, 3, ('uniform', 2)); c.px(20, 26, ('uniform', 5))
c = frame('locker', 2, 4, 5, 3, 1, ('vbrass', 5), W, 6, 5, 1, cloth=clothA)
shade(c); c.save(out('locker_row', 'A'), 'v5 결: 회청색 쇠 사물함 2단 4열, 세로 통풍 줄, 놋쇠 손잡이 점·흰 번호표 점, 체육복 끝과 가방 끈이 삐져나옴, 좌우 이어 붙는 8px 단위')
# B: 센 명암 — 짙은 문, 밝은 윗띠와 통풍줄 어둠, 붉은 손잡이
def clothB(c):
    c.rect(3, 14, 3, 3, ('vred', 3)); c.hl(3, 16, 3, ('vred', 1)); c.px(3, 14, ('vred', 5))
    c.rect(27, 26, 3, 3, ('jersey', 4)); c.hl(27, 28, 3, ('jersey', 2))
c = frame('locker', 1, 2, 5, 0, 0, ('vred', 5), W, 4, 6, 0, cloth=clothB)
shade(c); c.save(out('locker_row', 'B'), '센 명암: 짙은 남회색 문에 왼쪽 밝은 모서리와 깊은 통풍 줄, 밝은 윗띠, 빨간 손잡이, 빨간 티·체육복 끝이 삐져나옴')
# C: 나무 사물함, 열린 문 하나 (실루엣 재해석)
def extraC(c):
    # 윗줄 2열(x=8..15) 열린 문: 안쪽 어둡게, 옷걸이·체육복
    c.rect(8, 5, 8, 11, ('vpine', 0)); c.vl(8, 5, 11, ('vdwood', 1)); c.vl(15, 5, 11, ('vdwood', 1)); c.hl(8, 5, 8, ('vdwood', 2))
    c.hl(9, 7, 6, ('viron', 5))                   # 봉
    c.rect(10, 8, 4, 6, ('jersey', 3)); c.vl(10, 8, 6, ('jersey', 5)); c.vl(13, 8, 6, ('jersey', 1))
    c.px(11, 7, ('viron', 6)); c.px(12, 7, ('viron', 6))
    # 열린 문짝(얇게 왼쪽에 겹침)
    c.rect(6, 5, 2, 11, ('vpine', 3)); c.vl(6, 5, 11, ('vpine', 5)); c.vl(7, 5, 11, ('vpine', 1))
def clothC(c):
    c.rect(20, 26, 3, 3, ('uniform', 4)); c.hl(20, 28, 3, ('uniform', 2)); c.px(20, 26, ('uniform', 5))
c = frame('vpine', 1, 3, 5, 2, 1, ('vbrass', 6), W, 4, 5, 1, cloth=clothC, extra=extraC)
shade(c); c.save(out('locker_row', 'C'), '실루엣 다르게: 소나무 나무 사물함, 윗줄 둘째 칸 문이 열려 안쪽 봉에 체육복이 걸림, 아랫줄 가방 끈이 삐져나옴')
