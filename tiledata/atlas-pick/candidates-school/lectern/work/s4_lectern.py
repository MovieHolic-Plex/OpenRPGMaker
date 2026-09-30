import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'school_gate', 'work'))
from s4_lib import C, write_item

def shadow(c, x0, x1, y):
    for x in range(x0, x1): c.px(x, y, '~'); c.px(x, y + 1, '-') if y + 1 < c.H else None

def A():
    c = C(32, 32)
    # 상자형 교탁: 윗면 띠 + 앞면. v5 탁자와 같은 3톤 + 어두운 윤곽
    c.rect(4, 11, 24, 8, 'vwood', 7)          # 윗면
    c.hl(4, 11, 24, 'vwood', 8)               # 빛 쪽 윗줄
    c.rect(4, 19, 24, 10, 'vwood', 5)         # 앞면
    c.hl(4, 19, 24, 'vwood', 3)               # 윗면 아래 턱 그늘
    c.vl(15, 20, 9, 'vwood', 3); c.vl(16, 20, 9, 'vwood', 6)   # 가운데 세로 이음
    c.vl(4, 20, 9, 'vwood', 6); c.vl(27, 20, 9, 'vwood', 4)
    c.hl(5, 27, 22, 'vwood', 4)               # 밑 걸레받이 단
    # 윤곽
    c.hl(4, 10, 24, 'vdwood', 1); c.hl(4, 29, 24, 'vdwood', 1)
    c.vl(3, 11, 18, 'vdwood', 1); c.vl(28, 11, 18, 'vdwood', 0)
    c.hl(5, 29, 23, 'vdwood', 0)
    # 출석부, 분필
    c.rect(8, 13, 7, 4, 'washi', 4); c.hl(8, 16, 7, 'washi', 2); c.hl(9, 14, 5, 'washi', 3)
    c.rect(19, 14, 3, 1, 'vwhite', 6); c.px(22, 14, 'vwhite', 4)
    shadow(c, 5, 30, 30)
    return c

def B():
    c = C(32, 32)
    c.rect(4, 11, 24, 8, 'vwood', 7)
    c.hl(4, 11, 24, 'vwood', 8); c.vl(4, 12, 7, 'vwood', 8); c.vl(5, 12, 7, 'vwood', 8)
    c.vl(26, 12, 7, 'vwood', 6); c.vl(27, 12, 7, 'vwood', 5)
    c.hl(4, 18, 24, 'vwood', 6)
    c.rect(4, 19, 24, 10, 'vwood', 4)
    c.rect(4, 19, 24, 2, 'vwood', 2)          # 윗판 밑 짙은 그늘
    c.vl(4, 21, 8, 'vwood', 5); c.vl(5, 21, 8, 'vwood', 5)
    c.vl(26, 21, 8, 'vwood', 3); c.vl(27, 21, 8, 'vwood', 2)
    c.vl(15, 21, 8, 'vwood', 2); c.vl(16, 21, 8, 'vwood', 5)
    c.rect(6, 27, 20, 2, 'vwood', 3)
    c.hl(4, 10, 24, 'vdwood', 1); c.hl(4, 29, 24, 'vdwood', 0)
    c.vl(3, 11, 18, 'vdwood', 1); c.vl(28, 11, 19, 'vdwood', 0)
    c.rect(8, 13, 7, 4, 'washi', 4); c.hl(8, 16, 7, 'washi', 2); c.hl(9, 14, 5, 'washi', 3); c.hl(9, 15, 4, 'washi', 2)
    c.rect(19, 14, 3, 1, 'vwhite', 6); c.px(22, 14, 'vwhite', 4); c.hl(19, 15, 4, 'vdwood', 2)
    for x in range(5, 31): c.px(x, 30, '~')
    for x in range(6, 31): c.px(x, 31, '~')
    c.px(29, 30, '-'); c.px(30, 30, '-')
    for x in range(29, 32): c.px(x, 29, '-')
    return c

def Cc():
    c = C(32, 32)
    # 경사 독서대 상판이 앞으로 튀어 나온 연단형 교탁
    # 상판(경사): 뒤가 높고 앞이 낮음 - 윗면 넓게, 앞 턱 두껍게
    c.rect(3, 8, 26, 9, 'vwood', 7); c.hl(3, 8, 26, 'vwood', 8)
    c.hl(4, 9, 24, 'vwood', 8)
    c.rect(3, 15, 26, 2, 'vwood', 6)
    c.rect(2, 17, 28, 3, 'vwood', 3)           # 앞 턱(튀어나옴)
    c.hl(2, 17, 28, 'vwood', 5)
    c.hl(2, 19, 28, 'vwood', 1)
    # 몸통은 좁게
    c.rect(6, 20, 20, 8, 'vwood', 4)
    c.vl(6, 20, 8, 'vwood', 5); c.vl(7, 20, 8, 'vwood', 5)
    c.vl(24, 20, 8, 'vwood', 2); c.vl(25, 20, 8, 'vwood', 2)
    c.rect(11, 21, 10, 6, 'vwood', 3); c.box(11, 21, 10, 6, 'vwood', 2)   # 앞 판 액자 패널
    c.hl(12, 22, 8, 'vwood', 4)
    c.rect(5, 28, 22, 1, 'vdwood', 2)          # 받침 
    c.hl(2, 7, 27, 'vdwood', 1); c.vl(2, 8, 12, 'vdwood', 1); c.vl(29, 8, 12, 'vdwood', 0); c.vl(5, 20, 9, 'vdwood', 1); c.vl(26, 20, 9, 'vdwood', 0)
    c.hl(5, 29, 22, 'vdwood', 0)
    c.rect(7, 10, 6, 4, 'washi', 4); c.hl(7, 13, 6, 'washi', 2)
    c.rect(22, 11, 3, 1, 'vwhite', 6)
    for x in range(4, 30): c.px(x, 30, '~')
    for x in range(6, 31): c.px(x, 31, '-')
    return c

if __name__ == '__main__':
    write_item(A(), 'lectern', 'A', '상자형 교탁: 윗면 띠(밝음 7~8)와 앞면(5)을 두 단 벌려 나누고, 앞면 가운데 세로 이음, 출석부·분필 한 점, 발치 그림자 2줄. v5 탁자 3톤 방식')
    write_item(B(), 'lectern', 'B', '같은 상자에 빛을 세게: 왼쪽 위 모서리 8단, 오른쪽 면 2~3단, 윗판 밑 짙은 그늘 2줄, 접지 그림자 2줄 진하게')
    write_item(Cc(), 'lectern', 'C', '재해석: 앞으로 튀어나온 두툼한 상판(경사 독서대)이 좁은 몸통 위에 얹힌 연단형 교탁, 앞 패널 액자 테두리')
