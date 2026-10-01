# 가구 사전 — 정육점 (7종)

cells = [dx, dy, 칸, 층] (발밑 왼쪽 위 기준). kind: floor 바닥 가구(막힘) · wall 북쪽 벽 앞(막힘) · hang 벽면 윗줄 걸이(★) · flat 밟는 바닥 무늬(2층).

- `hang:sausage` 소시지 걸이 — 소시지 걸이 — 줄에 매단 걸이, 담긴 상품만 다른 변형. 정육점·식료품 방의 벽면 윗줄, 작업대·카운터 위에 1~2개. 벽면 두 줄 중 윗줄(y=벽면 첫 줄)에 건다. 바닥 칸은 차지하지 않는다 · 쓰는 방: 정육점·손질터(생선·고기)·식료품 방 · 짝: hang:fish, sack:grain
- `hang:ham` 햄 걸이 — 햄 걸이 — 줄에 매단 걸이, 담긴 상품만 다른 변형. 정육점·식료품 방의 벽면 윗줄, 작업대·카운터 위에 1~2개. 벽면 두 줄 중 윗줄(y=벽면 첫 줄)에 건다. 바닥 칸은 차지하지 않는다 · 쓰는 방: 정육점·손질터(생선·고기)·찬 창고·식료품 방 · 짝: hang:fish, barrel:apple, sack:grain
- `table:steak+ham` 고기·햄 탁자 — 고기·햄 탁자 — 천 덮은 2칸 진열 탁자, 담긴 상품만 다른 변형. 정육점·식료품 방의 가게 가운데 바닥에 1개. 출입문 칸과 문으로 이어지는 통로를 막지 않는다 · 쓰는 방: 정육점
- `chopping block` 도마 통나무 — 칼이 꽂힌 통나무 도마. 정육점·생선 손질터 작업대 옆 바닥에 둔다. 출입문 칸과 문으로 이어지는 통로를 막지 않는다 · 쓰는 방: 정육점·손질터(생선·고기) · 짝: drain grate, work 3x1, water jar
- `meat hooks` 고기 걸이대 — 고기를 매단 걸이대(2칸). 정육점 북쪽 벽 앞에 세운다. 발밑 줄이 북쪽 벽면 바로 아래 첫 바닥 줄이어야 한다 / 그림이 발밑 칸 위로 16px 솟는다 → 위 1칸은 플레이어 위에 그리는 겹침층 / 출입문 칸과 문으로 이어지는 통로를 막지 않는다 · 쓰는 방: 정육점·찬 창고 · 짝: ice chest:ham+steak+ham, hang:ham, barrel
- `ice chest:steak+ham+sausage` 고기·햄·소시지 얼음 진열함 — 고기·햄·소시지 얼음 진열함 — 얼음 깐 2칸 진열함, 담긴 상품만 다른 변형. 정육점·식료품 방의 카운터 줄 옆에 1~2개. 출입문 칸과 문으로 이어지는 통로를 막지 않는다 · 쓰는 방: 정육점·정육점 가게 · 짝: crate:onion, cabinet:cheese, basket:egg
- `ice chest:ham+steak+ham` 햄·고기 얼음 진열함 — 햄·고기 얼음 진열함 — 얼음 깐 2칸 진열함, 담긴 상품만 다른 변형. 정육점·식료품 방의 카운터 줄 옆에 1~2개. 출입문 칸과 문으로 이어지는 통로를 막지 않는다 · 쓰는 방: 정육점·찬 창고 · 짝: meat hooks, hang:ham, barrel

```json
[{"id":"hang:sausage","ko":"소시지 걸이","kind":"hang","w":1,"h":0,"overhangPx":0,"cells":[[0,0,3401,3]]},{"id":"hang:ham","ko":"햄 걸이","kind":"hang","w":1,"h":0,"overhangPx":0,"cells":[[0,0,3402,3]]},{"id":"table:steak+ham","ko":"고기·햄 탁자","kind":"floor","w":2,"h":1,"overhangPx":0,"cells":[[0,0,3421,3],[1,0,3422,3]]},{"id":"chopping block","ko":"도마 통나무","kind":"floor","w":1,"h":1,"overhangPx":0,"cells":[[0,0,3512,3]]},{"id":"meat hooks","ko":"고기 걸이대","kind":"wall","w":2,"h":1,"overhangPx":16,"cells":[[0,-1,3513,3],[1,-1,3514,3],[0,0,3515,3],[1,0,3516,3]]},{"id":"ice chest:steak+ham+sausage","ko":"고기·햄·소시지 얼음 진열함","kind":"floor","w":2,"h":1,"overhangPx":0,"cells":[[0,0,4009,3],[1,0,4010,3]]},{"id":"ice chest:ham+steak+ham","ko":"햄·고기 얼음 진열함","kind":"floor","w":2,"h":1,"overhangPx":0,"cells":[[0,0,4011,3],[1,0,4012,3]]}]
```
