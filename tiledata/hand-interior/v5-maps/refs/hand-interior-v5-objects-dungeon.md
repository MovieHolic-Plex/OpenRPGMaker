# 가구 사전 — 지하 (3종)

cells = [dx, dy, 칸, 층] (발밑 왼쪽 위 기준). kind: floor 바닥 가구(막힘) · wall 북쪽 벽 앞(막힘) · hang 벽면 윗줄 걸이(★) · flat 밟는 바닥 무늬(2층).

- `shackles` 족쇄 — 벽에 박은 쇠사슬 족쇄 한 쌍. 감방마다 벽면 윗줄에 1~2개. 짚 침대 위쪽. 벽면 두 줄 중 윗줄(y=벽면 첫 줄)에 건다. 바닥 칸은 차지하지 않는다 · 쓰는 방: 지하 감옥·감방 · 짝: slop bucket, drip puddle, straw bed
- `slop bucket` 오물통 — 쇠테 두른 작은 나무 오물통. 감방마다 구석 바닥에 1개. 뒷골목 선술집 구석. 출입문 칸과 문으로 이어지는 통로를 막지 않는다 · 쓰는 방: 지하 감옥·감방·선술집 홀·바 · 짝: drip puddle, shackles, straw bed
- `drip puddle` 물방울 웅덩이(움직임) — 물방울이 떨어져 동심원이 퍼지는 웅덩이(밟음, 움직임). 감방·지하·뒷골목 젖은 바닥에 방마다 1~2개. 밟을 수 있다. 다른 기물 밑에 먼저 깐다 · 쓰는 방: 지하 감옥·감방·선술집 홀·바 · 짝: slop bucket, shackles, straw bed

```json
[{"id":"shackles","ko":"족쇄","kind":"hang","w":1,"h":0,"overhangPx":0,"cells":[[0,0,4512,3]]},{"id":"slop bucket","ko":"오물통","kind":"floor","w":1,"h":1,"overhangPx":0,"cells":[[0,0,4513,3]]},{"id":"drip puddle","ko":"물방울 웅덩이(움직임)","kind":"flat","w":1,"h":1,"overhangPx":0,"animated":true,"cells":[[0,0,4524,2]]}]
```
