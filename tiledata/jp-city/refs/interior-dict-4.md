# 일본 도시 — 일본 집 실내 가구 사전 4/4 (6종, 칸 번호 전체)

tilesetId `jp_city` · 그림 `public/assets/jp-city/jp-city-chipset.png`(텍스처 `tex_jp_city`, **10217칸**, 16px 칸, 시트 768×3408px, 한 줄 **48칸** — 번호 n 의 칸은 열 n%48, 행 n÷48(내림), 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 계열 `oprn-jp` — 버들항(`oprn-atlas`)·현대 도시(`modern_city`, `oprn-modern`)·조선·숲마을·EasyRPG 칩셋의 칸 번호와 섞지 않는다.

항목: `id`(도구 objects[].id 에 그대로) · `ko` · `category`·`categoryKo`(방 분류 — `list_hand_interior_parts` 의 category 인자, 정본 `interior/categories.py`) · `block`(그림 원본 blocks/<block>.py) · `kind`(floor 바닥 가구 · wall 북쪽 벽 앞 · hang 벽면 윗줄 걸이 · flat 밟는 무늬) · `w`×`h`(키트 칸 = 솟은 칸 포함 그림 크기 — 바닥 발자국은 `cells` 의 dy≥0 칸이고 `desc` 의 「N×M칸」 도 발자국이다) · `up`(위로 솟은 px) ·
`use`·`facing`·`surface`(윗면 → 탁상 물건)·`stairs`·`tags`(방)·`place`(놓는 곳)·`pair`(짝 가구)·`desc` · `cells`([dx, dy, 칸 번호, 층] — dy<0 은 발자국 위로 솟은 칸, 층 2 = 밟는 무늬·3 = 가구) ·
같은 그림의 키트 `kit`(`stamp_object` 용 — 실내는 도구로 짓고 키트는 낱개 확인용) · `upperTiles`(키트 칸 전체) · `codes`(엔진 판정 `X` 막힘 · `*` ★ · `.` 걸음 · `_` 빈 칸). 짓는 법은 `jp-interior-rules`, 그림 `jp-img-interior-dict-*`.

```json
[
{"id":"h2-futon-dry","ko":"창가에 넌 이불","category":"apartment","categoryKo":"맨션·목조 아파트","block":"interior_home2","kind":"hang","w":2,"h":2,"up":0,"tags":["목조아파트","이불","창"],"place":"창 아래 벽면(목조 아파트)","desc":"베란다 봉에 널어 말리는 이불. 창 앞 벽면에 건다.","cells":[[0,0,10201,3],[1,0,10202,3],[0,1,10203,3],[1,1,10204,3]],"kit":"jp-in-h2-futon-dry","name":"창가에 넌 이불","anchor":{"dx":0,"dy":1},"upperTiles":[[10201,10202],[10203,10204]],"codes":["**","**"]},
{"id":"h2-garden-step","ko":"디딤돌","category":"oldhouse","categoryKo":"옛집(단층)","block":"interior_home2","kind":"flat","w":1,"h":1,"up":0,"tags":["옛집","정원","디딤돌"],"place":"툇마루 앞","pair":["h2-engawa"],"desc":"툇마루 앞 둥근 디딤돌. 밟고 지나간다.","cells":[[0,0,10205,2]],"kit":"jp-in-h2-garden-step","name":"디딤돌","anchor":{"dx":0,"dy":0},"upperTiles":[[10205]],"codes":["."]},
{"id":"h2-shoji-door","ko":"장지문 문턱","category":"oldhouse","categoryKo":"옛집(단층)","block":"interior_home2","kind":"flat","w":1,"h":1,"up":0,"use":["open"],"tags":["옛집","장지","문턱"],"place":"다다미 방 사이 칸막이 틈","desc":"장지문 열린 틈의 나무 문턱(가모이). 홈 두 줄. 칸막이 틈 한 칸에 깐다.","cells":[[0,0,10206,2]],"kit":"jp-in-h2-shoji-door","name":"장지문 문턱","anchor":{"dx":0,"dy":0},"upperTiles":[[10206]],"codes":["."]},
{"id":"h2-irori","ko":"이로리(화덕)","category":"oldhouse","categoryKo":"옛집(단층)","block":"interior_home2","kind":"floor","w":1,"h":1,"up":0,"use":["light"],"tags":["옛집","화덕","불"],"place":"옛집 마루방 한가운데","desc":"나무 틀 안에 재와 숯불, 쇠 주전자가 걸린 화덕. 불빛이 보인다.","cells":[[0,0,10207,3]],"kit":"jp-in-h2-irori","name":"이로리(화덕)","anchor":{"dx":0,"dy":0},"upperTiles":[[10207]],"codes":["X"]},
{"id":"h2-hibachi","ko":"화로(히바치)","category":"oldhouse","categoryKo":"옛집(단층)","block":"interior_home2","kind":"floor","w":1,"h":1,"up":0,"use":["block"],"tags":["옛집","화로","도기"],"place":"옛집 다다미방","desc":"푸른 무늬 도기 화로. 재와 불씨가 담겼다.","cells":[[0,0,10208,3]],"kit":"jp-in-h2-hibachi","name":"화로(히바치)","anchor":{"dx":0,"dy":0},"upperTiles":[[10208]],"codes":["X"]},
{"id":"h2-old-tansu","ko":"층층 장롱(階段箪笥)","category":"oldhouse","categoryKo":"옛집(단층)","block":"interior_home2","kind":"wall","w":2,"h":2,"up":16,"use":["open","search"],"tags":["옛집","장롱","수납","階段箪笥"],"place":"옛집 다다미방 벽","desc":"높이가 다른 두 단의 옛 나무 장롱. 왼쪽이 낮다.","cells":[[0,-1,10209,3],[1,-1,10210,3],[0,0,10211,3],[1,0,10212,3]],"kit":"jp-in-h2-old-tansu","name":"층층 장롱(階段箪笥)","anchor":{"dx":0,"dy":1},"upperTiles":[[10209,10210],[10211,10212]],"codes":["**","XX"]}
]
```
