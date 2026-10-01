from w34_gen import *
cv = Cv()
skids(cv, 2, 45)
# 계단식 더미: 아래 단이 길고 위로 갈수록 짧아져 오른쪽 끝 마구리가 층층이 드러남
for ti in range(4):
    y = 26 - ti * 5
    ln = 15 - ti * 1
    x = 4 + ti * 2
    xs = []
    xx = x
    while xx + ln < 46:
        xs.append(xx); xx += ln - 3
    # 위 단일수록 왼쪽으로 몰아 오른쪽 계단이 생기게
    lim = 44 - ti * 8
    for k, xx in enumerate(xs):
        if xx + ln > lim + 4: continue
        log(cv, (xx, y), (xx + ln, y - 6), r=2.5, caps=('b',), seed=k + ti * 2,
            bark=('Q', 'I', 'G') if ti == 3 else ('E', 'Q', 'I'))
# 왼쪽 기댄 기둥
cv.rect(1, 6, 2, 29, 'Q'); cv.rect(1, 6, 1, 29, 'E'); cv.rect(2, 6, 2, 29, 'I')
save(cv, 'F', '완만한 대각선으로 눕힌 통나무를 계단식으로 쌓아 오른쪽이 층층이 낮아지는 더미: 단마다 나이테 마구리가 비스듬히 드러남, 왼쪽 기둥에 기댐')
