import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nightlib import *
NOTES = {
 'A': "A: v5 흙바닥 결의 밤 풀밭 — 짙은 푸른 녹 바탕(night 1~3)에 이끼빛 얼룩, 풀 V획(한 단 밝게)은 여섯 덩이로 몰리고 흙이 드러난 자리 둘. 32칸 모듈러 이음이라 사방으로 이어 붙는다.",
 'B': "B: 왼쪽 위 빛 — 풀 포기마다 왼 잎이 가장 밝고 오른쪽·아래에 짙은 그늘 한 단. 흙 자리는 윗줄이 밝다. 풀 몰림은 A 와 다른 자리. 32칸 모듈러 이음.",
 'C': "C: 풀이 모두 오른쪽으로 쏠려 누웠고, 드러난 흙 한 곳이 손바닥 자국(손가락 넷)처럼 보인다. 어긋난 곳은 손 모양 흙. 32칸 모듈러 이음.",
}
for k in 'ABC':
    c = Canvas('night_grass', 32, 32); g = grass(k)
    for y in range(N):
        for x in range(N): c.px(x, y, g[y][x])
    c.save(f'h1-{k}', NOTES[k])
