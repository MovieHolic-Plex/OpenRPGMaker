# 가구 사전 — 지하 (6종)

cells = [dx, dy, 칸, 층] (발밑 왼쪽 위 기준). kind: floor 바닥 가구(막힘) · wall 북쪽 벽 앞(막힘) · hang 벽면 윗줄 걸이(★) · flat 밟는 바닥 무늬(2층).

- `shackles` 족쇄 — 벽에 박은 쇠사슬 족쇄 한 쌍. 감방마다 벽면 윗줄에 1~2개. 짚 침대 위쪽. 벽면 두 줄 중 윗줄(y=벽면 첫 줄)에 건다. 바닥 칸은 차지하지 않는다 · 쓰는 방: 지하 감옥·감방 · 짝: slop bucket, drip puddle, straw bed
- `slop bucket` 오물통 — 쇠테 두른 작은 나무 오물통. 감방마다 구석 바닥에 1개. 뒷골목 선술집 구석. 출입문 칸과 문으로 이어지는 통로를 막지 않는다 · 쓰는 방: 지하 감옥·감방·선술집 홀·바 · 짝: drip puddle, shackles, straw bed
- `drip puddle` 물방울 웅덩이(움직임) — 물방울이 떨어져 동심원이 퍼지는 웅덩이(밟음, 움직임). 감방·지하·뒷골목 젖은 바닥에 방마다 1~2개. 밟을 수 있다. 다른 기물 밑에 먼저 깐다 · 쓰는 방: 지하 감옥·감방·선술집 홀·바 · 짝: slop bucket, shackles, straw bed
- `key ring hook` 열쇠 꾸러미 걸이 — 벽면 윗줄 못에 걸린 큰 쇠 열쇠 꾸러미. 간수실.  · 예제 방 없음(새 기물 — 위 칸 번호 사전과 설명으로 놓는다)  · 쓰는 방: 감옥·간수실
- `prison cot` 감방 침상 — 감방 벽에 붙인 판자 침상(얇은 짚 매트, 쇠사슬 고정). 1×2.  · 예제 방 없음(새 기물 — 위 칸 번호 사전과 설명으로 놓는다)  · 쓰는 방: 감옥·감방
- `straw pile` 짚 더미(바닥) — 바닥에 흩어진 짚(밟을 수 있음). 감방·마구간 구석.  · 예제 방 없음(새 기물 — 위 칸 번호 사전과 설명으로 놓는다)  · 쓰는 방: 감옥·마구간

```json
[{"id":"shackles","ko":"족쇄","kind":"hang","w":1,"h":0,"overhangPx":0,"cells":[[0,0,4560,3]]},{"id":"slop bucket","ko":"오물통","kind":"floor","w":1,"h":1,"overhangPx":0,"cells":[[0,0,4561,3]]},{"id":"drip puddle","ko":"물방울 웅덩이(움직임)","kind":"flat","w":1,"h":1,"overhangPx":0,"animated":true,"cells":[[0,0,4572,2]]},{"id":"key ring hook","ko":"열쇠 꾸러미 걸이","kind":"hang","w":1,"h":0,"overhangPx":0,"cells":[[0,0,5143,3],[0,1,5144,3]]},{"id":"prison cot","ko":"감방 침상","kind":"wall","w":1,"h":2,"overhangPx":16,"cells":[[0,-1,5155,3],[0,0,5156,3],[0,1,5157,3]]},{"id":"straw pile","ko":"짚 더미(바닥)","kind":"flat","w":1,"h":1,"overhangPx":0,"cells":[[0,0,5179,2]]}]
```
