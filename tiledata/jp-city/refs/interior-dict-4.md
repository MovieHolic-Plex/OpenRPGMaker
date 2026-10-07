# 일본 도시 — 일본 집 실내 가구 사전 4/4 (1종, 칸 번호 전체)

tilesetId `jp_city` · 그림 `public/assets/jp-city/jp-city-chipset.png`(텍스처 `tex_jp_city`, **10182칸**, 16px 칸, 시트 768×3408px, 한 줄 **48칸** — 번호 n 의 칸은 열 n%48, 행 n÷48(내림), 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 계열 `oprn-jp` — 버들항(`oprn-atlas`)·현대 도시(`modern_city`, `oprn-modern`)·조선·숲마을·EasyRPG 칩셋의 칸 번호와 섞지 않는다.

항목: `id`(도구 objects[].id 에 그대로) · `ko` · `category`·`categoryKo`(방 분류 — `list_hand_interior_parts` 의 category 인자, 정본 `interior/categories.py`) · `block`(그림 원본 blocks/<block>.py) · `kind`(floor 바닥 가구 · wall 북쪽 벽 앞 · hang 벽면 윗줄 걸이 · flat 밟는 무늬) · `w`×`h`(키트 칸 = 솟은 칸 포함 그림 크기 — 바닥 발자국은 `cells` 의 dy≥0 칸이고 `desc` 의 「N×M칸」 도 발자국이다) · `up`(위로 솟은 px) ·
`use`·`facing`·`surface`(윗면 → 탁상 물건)·`stairs`·`tags`(방)·`place`(놓는 곳)·`pair`(짝 가구)·`desc` · `cells`([dx, dy, 칸 번호, 층] — dy<0 은 발자국 위로 솟은 칸, 층 2 = 밟는 무늬·3 = 가구) ·
같은 그림의 키트 `kit`(`stamp_object` 용 — 실내는 도구로 짓고 키트는 낱개 확인용) · `upperTiles`(키트 칸 전체) · `codes`(엔진 판정 `X` 막힘 · `*` ★ · `.` 걸음 · `_` 빈 칸). 짓는 법은 `jp-interior-rules`, 그림 `jp-img-interior-dict-*`.

```json
[
{"id":"h2-old-tansu","ko":"층층 장롱(階段箪笥)","category":"oldhouse","categoryKo":"옛집(단층)","block":"interior_home2","kind":"wall","w":2,"h":2,"up":16,"use":["open","search"],"tags":["옛집","장롱","수납","階段箪笥"],"place":"옛집 다다미방 벽","desc":"높이가 다른 두 단의 옛 나무 장롱. 왼쪽이 낮다.","cells":[[0,-1,10033,3],[1,-1,10034,3],[0,0,10035,3],[1,0,10036,3]],"kit":"jp-in-h2-old-tansu","name":"층층 장롱(階段箪笥)","anchor":{"dx":0,"dy":1},"upperTiles":[[10033,10034],[10035,10036]],"codes":["**","XX"]}
]
```
