from w34_gen import *
cv = Cv()
skids(cv, 2, 45)
n = 9
order = sorted(range(n), key=lambda i: -abs(i - 4))
for j, i in enumerate(order):
    d = i - 4
    log(cv, (24 + d * 3.4, 27), (24 + d * 5.4, 9 + abs(d) * 1.6), r=2.3, caps=('b',), seed=i,
        bark=('Q', 'I', 'G') if abs(d) >= 3 else ('E', 'Q', 'I'))
save(cv, 'G', '바닥 한 점에서 부채꼴로 벌려 기대 세운 통나무 더미: 가운데는 밝게 바깥은 어둡게, 위쪽 끝마다 나이테 마구리가 비스듬히 부채처럼 펼쳐짐')
