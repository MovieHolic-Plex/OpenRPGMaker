# 가구 사전 — 재단사 (5종)

cells = [dx, dy, 칸, 층] (발밑 왼쪽 위 기준). kind: floor 바닥 가구(막힘) · wall 북쪽 벽 앞(막힘) · hang 벽면 윗줄 걸이(★) · flat 밟는 바닥 무늬(2층).

- `mannequin` 마네킹 — 옷을 입힌 마네킹(키가 크다). 재단사 가게·작업실. 그림이 발밑 칸 위로 16px 솟는다 → 위 1칸은 플레이어 위에 그리는 겹침층 / 출입문 칸과 문으로 이어지는 통로를 막지 않는다 · 쓰는 방: 재단사·옷가게·탈의실·창고 · 짝: tailor mirror, fabric bolt rack, crate
- `spinning wheel` 물레 — 나무 물레 바퀴와 붉은 실뭉치가 달린 받침. 재단 작업실 베틀 옆 바닥에 1개. 양모 바구니와 같은 방. 출입문 칸과 문으로 이어지는 통로를 막지 않는다 · 쓰는 방: 재단사·옷가게·재단 작업실 · 짝: shelf:yarn+yarnb+yarny, loom, basket:yarn+yarnb+yarny
- `loom` 베틀 — 베틀(2칸). 재단사 작업실 북쪽 벽. 그림이 발밑 칸 위로 8px 솟는다 → 위 1칸은 플레이어 위에 그리는 겹침층 / 출입문 칸과 문으로 이어지는 통로를 막지 않는다 · 쓰는 방: 재단사·옷가게·재단 작업실 · 짝: spinning wheel, basket:wool, shelf:yarn+yarnb+yarny
- `fabric bolt rack` 옷감 선반 — 색색 옷감을 꽂은 선반. 재단사 벽. 발밑 줄이 북쪽 벽면 바로 아래 첫 바닥 줄이어야 한다 / 그림이 발밑 칸 위로 16px 솟는다 → 위 1칸은 플레이어 위에 그리는 겹침층 / 출입문 칸과 문으로 이어지는 통로를 막지 않는다 · 쓰는 방: 재단사·옷가게·재단 작업실·창고 · 짝: mannequin, window
- `tailor mirror` 전신 거울 — 금테 두른 키 큰 전신 거울(16px 솟음). 탈의실·재단사 가게 벽 곁에 1개. 마네킹 옆, 앞 칸은 비운다. 그림이 발밑 칸 위로 16px 솟는다 → 위 1칸은 플레이어 위에 그리는 겹침층 / 출입문 칸과 문으로 이어지는 통로를 막지 않는다 · 쓰는 방: 재단사·옷가게·탈의실 · 짝: mannequin, coat rack, bench 2

```json
[{"id":"mannequin","ko":"마네킹","kind":"floor","w":1,"h":1,"overhangPx":16,"cells":[[0,-1,3747,3],[0,0,3748,3]]},{"id":"spinning wheel","ko":"물레","kind":"floor","w":1,"h":1,"overhangPx":0,"cells":[[0,0,3749,3]]},{"id":"loom","ko":"베틀","kind":"floor","w":2,"h":1,"overhangPx":8,"cells":[[0,-1,3750,3],[1,-1,3751,3],[0,0,3752,3],[1,0,3753,3]]},{"id":"fabric bolt rack","ko":"옷감 선반","kind":"wall","w":1,"h":1,"overhangPx":16,"cells":[[0,-1,3754,3],[0,0,3755,3]]},{"id":"tailor mirror","ko":"전신 거울","kind":"floor","w":1,"h":1,"overhangPx":16,"cells":[[0,-1,3756,3],[0,0,3757,3]]}]
```
