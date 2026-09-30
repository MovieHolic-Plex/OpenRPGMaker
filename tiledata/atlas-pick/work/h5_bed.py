from h5_lib import *
L = {str(i): ('mahog', i) for i in range(7)}
for i, ch in enumerate('abcdef'): L[ch] = ('velv', i)
for i, ch in enumerate('pqrstuv'): L[ch] = ('sheet', i)
L.update({'d': ('dust', 3), 'D': ('dust', 4), 'W': ('dust', 5), 'v': ('void', 1), 'V': ('void', 0),
          't': ('tarn', 3), 'T': ('tarn', 2), 'b': ('bisque', 4), 'B': ('bisque', 3), 'k': ('bisque', 5),
          'r': ('blood', 3)})
L['s'] = ('sheet', 4); L['u'] = ('sheet', 5); L['q'] = ('sheet', 2)
L['h'] = ('void', 2)

def frame(c, light):
    # 기둥 (x0-2, x29-31), 머릿널, 발치널
    lo, mid, hi = ('1', '4', '6') if light else ('1', '3', '5')
    for x0, tn in ((0, (lo, hi, mid)), (29, (mid, mid, lo))):
        c.vl(x0, 0, 48, tn[0]); c.vl(x0 + 1, 0, 48, tn[1]); c.vl(x0 + 2, 0, 48, tn[2])
    c.px(0, 0, '.'); c.px(31, 0, '.')
    # 머릿널
    c.rect(3, 10, 26, 10, '3'); c.hl(3, 10, 26, '5' if light else '4'); c.hl(3, 19, 26, '1')
    c.rect(5, 12, 22, 6, '2'); c.hl(5, 12, 22, '1'); c.vl(5, 12, 6, '1'); c.hl(5, 17, 22, '4'); c.vl(26, 13, 5, '4')
    # 발치널
    c.rect(3, 44, 26, 4, '3'); c.hl(3, 44, 26, '5' if light else '4'); c.hl(3, 47, 26, '0'); c.hl(3, 46, 26, '1')

def canopy(c, light, torn):
    c.rect(3, 0, 26, 10, 'c'); c.hl(3, 0, 26, 'e' if light else 'd'); c.hl(3, 1, 26, 'd')
    for x in range(4, 28, 4): c.vl(x, 2, 7, 'b'); c.vl(x + 1, 2, 7, 'd' if light else 'c')   # 주름
    # 밑단 물결
    for x in range(3, 29):
        c.px(x, 9, 'a' if (x // 2) % 2 == 0 else 'b')
    c.hl(3, 8, 26, 'b')
    if False:
        # 오른쪽이 찢겨 늘어짐: 너덜한 가닥
        for i, (x, ln) in enumerate(((21, 5), (23, 9), (24, 4), (26, 7), (27, 3))):
            c.vl(x, 10, ln, 'b' if i % 2 else 'c'); c.px(x, 10 + ln - 1, 'a')
        c.rect(22, 3, 2, 3, '.'); c.px(23, 6, '.')  # 구멍
        c.px(22, 3, '.')

def bedding(c, light, dent=True):
    # 베개
    c.rect(6, 20, 20, 7, 's'); c.hl(6, 20, 20, 'u'); c.hl(6, 26, 20, 'q'); c.vl(6, 20, 7, 'u'); c.vl(25, 21, 6, 'q')
    c.hl(8, 22, 14, 'p' if False else 'u'); c.hl(12, 24, 8, 'q')
    # 이불
    c.rect(4, 27, 24, 17, 's'); c.hl(4, 27, 24, 'u'); c.hl(4, 28, 24, 'u')   # 접힌 시트
    c.hl(4, 29, 24, 'q')
    c.vl(4, 27, 17, 'u'); c.vl(27, 29, 15, 'q')
    if dent:
        c.rect(9, 33, 14, 7, 'q'); c.rect(11, 35, 10, 4, 'p'); c.hl(9, 32, 14, 'r' if False else 'q')
        c.hl(11, 34, 10, 'q')
    # 누런 얼룩
    c.rect(6, 31, 3, 2, 't'); c.rect(21, 40, 4, 2, 't'); c.px(7, 32, 'T')
    c.hl(4, 43, 24, 'q')

def post(c, light=False):
    # 너덜한 찢김: 머릿널 앞으로 늘어진 가닥
    for i, (x, ln) in enumerate(((20, 4), (22, 8), (23, 3), (25, 6), (26, 2))):
        c.vl(x, 8, ln + 2, 'c' if i % 2 else 'b'); c.px(x, 8 + ln + 1, 'a')
    c.rect(21, 3, 2, 3, '.'); c.px(23, 5, '.')
    # 거미줄: 왼쪽 위 귀퉁이
    c.hl(3, 0, 8, 'D'); c.vl(3, 0, 8, 'D')
    for k in range(1, 6): c.px(3 + k, k, 'W')
    c.px(6, 1, 'W'); c.px(4, 4, 'W'); c.px(5, 5, 'D'); c.px(7, 2, 'D'); c.px(4, 3, 'D')

# ---------- A : v5 낡은 판
c = C(32, 48); canopy(c, False, True); frame(c, False); bedding(c, False)
post(c)
# 떨어진 베개: 발치 밖 오른쪽은 폭이 없어 침대 위 모서리에 삐죽 (선택 생략)
save('canopy_bed_rot', 'h5-A', c, L, 'v5 닫집 침대 낡은 판: 오른쪽 닫집 천이 찢겨 너덜한 가닥으로 늘어지고 침구는 누렇게 바랜 뒤 가운데 움푹. 왼쪽 위 거미줄')

# ---------- B : 달빛 대비
c = C(32, 48); canopy(c, True, True); frame(c, True); bedding(c, True)
post(c)
# 오른쪽 아래로 갈수록 어둡게 - 덮개 대신 색으로
c.rect(19, 12, 8, 6, '1'); c.hl(19, 12, 8, '0'); c.vl(19, 13, 5, '0')
c.rect(22, 20, 4, 6, 'q'); c.rect(15, 36, 9, 5, 'p')
c.hl(4, 27, 24, 'v' if False else 'u'); c.hl(6, 20, 20, 'u'); c.hl(6, 21, 8, 'u')
c.hl(3, 47, 26, '~'); c.hl(0, 47, 3, '~'); c.hl(29, 47, 3, '~')
c.hl(3, 46, 26, '0')
save('canopy_bed_rot', 'h5-B', c, L, '같은 판에 왼쪽 위 달빛: 왼 기둥·머릿널 위·시트 접힘이 밝고 머릿널 오른쪽 절반·이불 움푹이 한 단씩 어두움, 발치에 반투명 접지 그림자')

# ---------- C : 실루엣 — 이불 밑에 누운 사람 모양, 늘어진 손
c = C(32, 48); canopy(c, False, True); frame(c, False)
# 베개 + 머리 볼록(이불 뒤집어쓴 머리)
c.rect(6, 20, 20, 7, 's'); c.hl(6, 20, 20, 'u'); c.vl(6, 20, 7, 'u')
c.rect(11, 21, 9, 6, 'q'); c.rect(12, 21, 7, 3, 's'); c.hl(12, 21, 7, 'u')      # 머리 볼록
c.px(11, 22, 'q'); c.hl(11, 26, 9, 'p')
# 이불: 몸 윤곽 볼록, 발끝 두 봉우리
c.rect(4, 27, 24, 17, 's'); c.hl(4, 27, 24, 'u'); c.vl(4, 27, 17, 'u'); c.vl(27, 29, 15, 'q')
c.rect(9, 27, 11, 2, 'u'); c.rect(9, 29, 11, 15, 's')
c.vl(9, 29, 15, 'u'); c.vl(19, 29, 15, 'q'); c.hl(9, 43, 11, 'q')
c.rect(10, 39, 4, 3, 'u'); c.rect(15, 39, 4, 3, 'u'); c.hl(10, 42, 4, 'q'); c.hl(15, 42, 4, 'q')  # 발끝
c.rect(4, 32, 5, 12, 'q'); c.rect(20, 32, 7, 12, 'q')        # 몸 양옆은 눌려 어두움
c.hl(4, 43, 24, 'p')
# 검은 머리카락이 베개 밖으로
c.vl(11, 26, 3, 'v'); c.vl(13, 26, 4, 'V'); c.vl(16, 26, 3, 'v'); c.vl(18, 26, 5, 'V')
# 늘어진 손 (오른쪽 기둥 안쪽)
c.rect(23, 30, 3, 6, 'b'); c.vl(23, 30, 6, 'B'); c.vl(25, 31, 5, 'k'); c.px(24, 36, 'B'); c.px(23, 37, 'B'); c.px(25, 37, 'B'); c.px(24, 37, 'k')
c.rect(24, 28, 2, 2, 'q')
post(c)
save('canopy_bed_rot', 'h5-C', c, L, '실루엣: 이불 밑에 사람이 누운 볼록한 윤곽(머리·발끝 두 봉우리), 베개 밖으로 검은 머리채, 오른쪽으로 창백한 손이 늘어짐')
