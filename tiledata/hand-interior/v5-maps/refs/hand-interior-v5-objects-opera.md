# 가구 사전 — 극장 (7종)

cells = [dx, dy, 칸, 층] (발밑 왼쪽 위 기준). kind: floor 바닥 가구(막힘) · wall 북쪽 벽 앞(막힘) · hang 벽면 윗줄 걸이(★) · flat 밟는 바닥 무늬(2층).

- `theater seat` 극장 좌석 — 극장 좌석(뒤에서 본 것). 줄마다 앞뒤 한쪽은 통로에 닿게 두 줄씩 묶는다. 출입문 칸과 문으로 이어지는 통로를 막지 않는다 · 쓰는 방: 극장·극장 무대·객석 · 짝: stage curtain, scenery flat, footlights
- `stage curtain` 무대 막(2줄) — 무대 막(tall 걸이). 무대 양끝. 벽면 두 줄 중 윗줄(y=벽면 첫 줄)에 건다. 바닥 칸은 차지하지 않는다 · 쓰는 방: 극장·극장 무대·객석 · 짝: theater seat, scenery flat, footlights
- `curtain wing` 무대 날개 막 — 비스듬히 드리운 붉은 무대 날개 막(바닥, 24px 솟음). 극장 무대 앞 양끝 바닥에 1개씩(좌우 짝). 그림이 발밑 칸 위로 24px 솟는다 → 위 2칸은 플레이어 위에 그리는 겹침층 / 출입문 칸과 문으로 이어지는 통로를 막지 않는다 · 쓰는 방: 극장·극장 무대·객석 · 짝: theater seat, stage curtain, scenery flat
- `footlights` 각광(움직임, 바닥) — 무대 앞 가장자리 각광(밟을 수 있음, 깜박임). 한 줄로 잇는다. 밟을 수 있다. 다른 기물 밑에 먼저 깐다 · 쓰는 방: 극장·극장 무대·객석 · 짝: theater seat, stage curtain, scenery flat
- `music stand` 보면대 — 흰 악보를 올린 검은 쇠 보면대. 극장 오케스트라 석에 5개 안팎 반원으로. 지휘대를 향해. 그림이 발밑 칸 위로 8px 솟는다 → 위 1칸은 플레이어 위에 그리는 겹침층 / 출입문 칸과 문으로 이어지는 통로를 막지 않는다 · 쓰는 방: 극장·큰 홀·연회장·극장 무대·객석 · 짝: potted sapling, elven harp
- `scenery flat` 무대 배경판(3칸) — 성과 들판을 그린 무대 배경판(3칸, 북쪽 벽 앞). 극장 무대 뒤 북쪽 벽에 1~2개. 무대 막 사이. 발밑 줄이 북쪽 벽면 바로 아래 첫 바닥 줄이어야 한다 / 그림이 발밑 칸 위로 16px 솟는다 → 위 1칸은 플레이어 위에 그리는 겹침층 / 출입문 칸과 문으로 이어지는 통로를 막지 않는다 · 쓰는 방: 극장·극장 무대·객석 · 짝: theater seat, stage curtain, footlights
- `conductor podium` 지휘대 — 지휘봉을 얹은 작은 나무 지휘대. 오케스트라 석 가운데 1개. 보면대들이 둘러싼다. 출입문 칸과 문으로 이어지는 통로를 막지 않는다 · 쓰는 방: 극장·극장 무대·객석 · 짝: theater seat, stage curtain, scenery flat

```json
[{"id":"theater seat","ko":"극장 좌석","kind":"floor","w":1,"h":1,"overhangPx":0,"cells":[[0,0,4757,3]]},{"id":"stage curtain","ko":"무대 막(2줄)","kind":"hang","w":1,"h":0,"overhangPx":0,"cells":[[0,0,4758,3],[0,1,4759,3]]},{"id":"curtain wing","ko":"무대 날개 막","kind":"floor","w":1,"h":1,"overhangPx":24,"cells":[[0,-2,4760,3],[0,-1,4761,3],[0,0,4762,3]]},{"id":"footlights","ko":"각광(움직임, 바닥)","kind":"flat","w":1,"h":1,"overhangPx":0,"animated":true,"cells":[[0,0,4764,2]]},{"id":"music stand","ko":"보면대","kind":"floor","w":1,"h":1,"overhangPx":8,"cells":[[0,-1,4776,3],[0,0,4777,3]]},{"id":"scenery flat","ko":"무대 배경판(3칸)","kind":"wall","w":3,"h":1,"overhangPx":16,"cells":[[0,-1,4778,3],[1,-1,4779,3],[2,-1,4780,3],[0,0,4781,3],[1,0,4782,3],[2,0,4783,3]]},{"id":"conductor podium","ko":"지휘대","kind":"floor","w":1,"h":1,"overhangPx":0,"cells":[[0,0,4784,3]]}]
```
