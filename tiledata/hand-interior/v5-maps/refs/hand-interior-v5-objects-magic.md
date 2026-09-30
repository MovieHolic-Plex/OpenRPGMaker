# 가구 사전 — 마법 (4종)

cells = [dx, dy, 칸, 층] (발밑 왼쪽 위 기준). kind: floor 바닥 가구(막힘) · wall 북쪽 벽 앞(막힘) · hang 벽면 윗줄 걸이(★) · flat 밟는 바닥 무늬(2층).

- `crystal ball` 수정구 — 받침 위 수정구. 점술가·마법사 방. 출입문 칸과 문으로 이어지는 통로를 막지 않는다 · 쓰는 방: 마법사 방·보물고
- `spellbook stand` 마법서 받침 — 펼친 마법서를 올린 키 큰 나무 받침. 마법사의 탑 서재 마법진 곁 바닥에 1개. 수정구·천체 모형과 같은 방. 출입문 칸과 문으로 이어지는 통로를 막지 않는다 · 쓰는 방: 마법사 방·보물고·서재 · 짝: owl perch, orrery, magic circle
- `magic circle` 마법진 — 바닥에 그린 마법진(2×2, 밟을 수 있음). 마법사 방·지하실 가운데. 밟을 수 있다. 다른 기물 밑에 먼저 깐다 · 쓰는 방: 마법사 방·보물고·서재 · 짝: spellbook stand, owl perch, orrery
- `treasure pile` 보물 더미 — 금화·보석 더미(2칸). 보물고·용의 둥지. 출입문 칸과 문으로 이어지는 통로를 막지 않는다 · 쓰는 방: 마법사 방·보물고·보물 창고 · 짝: shelf:gem+gemr, shelf:coins, royal chest

```json
[{"id":"crystal ball","ko":"수정구","kind":"floor","w":1,"h":1,"overhangPx":0,"cells":[[0,0,3679,3]]},{"id":"spellbook stand","ko":"마법서 받침","kind":"floor","w":1,"h":1,"overhangPx":0,"cells":[[0,0,3680,3]]},{"id":"magic circle","ko":"마법진","kind":"flat","w":2,"h":2,"overhangPx":0,"cells":[[0,0,3681,2],[1,0,3682,2],[0,1,3683,2],[1,1,3684,2]]},{"id":"treasure pile","ko":"보물 더미","kind":"floor","w":2,"h":1,"overhangPx":0,"cells":[[0,0,3685,3],[1,0,3686,3]]}]
```
