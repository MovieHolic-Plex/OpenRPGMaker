# 가구 사전 — 마구간 (6종)

cells = [dx, dy, 칸, 층] (발밑 왼쪽 위 기준). kind: floor 바닥 가구(막힘) · wall 북쪽 벽 앞(막힘) · hang 벽면 윗줄 걸이(★) · flat 밟는 바닥 무늬(2층).

- `chocobo` 초코보(움직임) — 초코보(고개를 끄덕이고 눈을 깜박인다). 우리 안. 그림이 발밑 칸 위로 16px 솟는다 → 위 1칸은 플레이어 위에 그리는 겹침층 / 출입문 칸과 문으로 이어지는 통로를 막지 않는다 · 쓰는 방: 마구간·마구간 우리 · 짝: fence, feed trough, hay bale
- `hay bale` 건초 더미 — 끈 두 줄로 묶은 네모 건초 더미. 마구간 우리마다 구석에 1개. 먹이통 곁. 출입문 칸과 문으로 이어지는 통로를 막지 않는다 · 쓰는 방: 마구간·마구간 우리 · 짝: water trough, pitchfork, feed trough
- `feed trough` 먹이통(2칸) — 초록 풀이 담긴 2칸 나무 먹이통. 마구간 우리 벽 쪽에 1개씩. 물통과 짝. 출입문 칸과 문으로 이어지는 통로를 막지 않는다 · 쓰는 방: 마구간·마구간 우리 · 짝: water trough, pitchfork, hay bale
- `water trough` 물통(2칸) — 파란 물이 담긴 2칸 나무 물통. 마구간 우리 벽 쪽에 1개씩. 먹이통 옆. 출입문 칸과 문으로 이어지는 통로를 막지 않는다 · 쓰는 방: 마구간·마구간 우리 · 짝: pitchfork, hay bale, feed trough
- `saddle rack` 안장걸이 — 붉은 안장을 걸친 나무 받침(8px 솟음). 마구 방에 2개, 마구간 통로 끝에 1개. 그림이 발밑 칸 위로 8px 솟는다 → 위 1칸은 플레이어 위에 그리는 겹침층 / 출입문 칸과 문으로 이어지는 통로를 막지 않는다 · 쓰는 방: 마구간·마구간 우리·마구 방
- `pitchfork` 쇠스랑 — 벽에 기대 건 쇠스랑. 마구간 벽면 윗줄에 1~2개. 건초 더미 위. 벽면 두 줄 중 윗줄(y=벽면 첫 줄)에 건다. 바닥 칸은 차지하지 않는다 · 쓰는 방: 마구간·마구간 우리 · 짝: water trough, hay bale, feed trough

```json
[{"id":"chocobo","ko":"초코보(움직임)","kind":"floor","w":1,"h":1,"overhangPx":16,"animated":true,"cells":[[0,-1,4944,3],[0,0,4956,3]]},{"id":"hay bale","ko":"건초 더미","kind":"floor","w":1,"h":1,"overhangPx":0,"cells":[[0,0,4968,3]]},{"id":"feed trough","ko":"먹이통(2칸)","kind":"floor","w":2,"h":1,"overhangPx":0,"cells":[[0,0,4969,3],[1,0,4970,3]]},{"id":"water trough","ko":"물통(2칸)","kind":"floor","w":2,"h":1,"overhangPx":0,"cells":[[0,0,4971,3],[1,0,4972,3]]},{"id":"saddle rack","ko":"안장걸이","kind":"floor","w":1,"h":1,"overhangPx":8,"cells":[[0,-1,4973,3],[0,0,4974,3]]},{"id":"pitchfork","ko":"쇠스랑","kind":"hang","w":1,"h":0,"overhangPx":0,"cells":[[0,0,4975,3],[0,1,4976,3]]}]
```
