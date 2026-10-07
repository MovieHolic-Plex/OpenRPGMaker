# 일본 도시 — 일본 집 실내 가구 사전 2/2 (4종, 칸 번호 전체)

tilesetId `jp_city` · 그림 `public/assets/jp-city/jp-city-chipset.png`(텍스처 `tex_jp_city`, **9023칸**, 16px 칸, 시트 768×3008px, 한 줄 **48칸** — 번호 n 의 칸은 열 n%48, 행 n÷48(내림), 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 계열 `oprn-jp` — 버들항(`oprn-atlas`)·현대 도시(`modern_city`, `oprn-modern`)·조선·숲마을·EasyRPG 칩셋의 칸 번호와 섞지 않는다.

항목: `id`(도구 objects[].id 에 그대로) · `ko` · `block`(그림 원본 blocks/<block>.py) · `kind`(floor 바닥 가구 · wall 북쪽 벽 앞 · hang 벽면 윗줄 걸이 · flat 밟는 무늬) · `w`×`h`(발자국 칸) · `up`(위로 솟은 px) ·
`use`·`facing`·`surface`(윗면 → 탁상 물건)·`stairs`·`tags`(방)·`place`(놓는 곳)·`pair`(짝 가구)·`desc` · `cells`([dx, dy, 칸 번호, 층] — dy<0 은 발자국 위로 솟은 칸, 층 2 = 밟는 무늬·3 = 가구) ·
같은 그림의 키트 `kit`(`stamp_object` 용 — 실내는 도구로 짓고 키트는 낱개 확인용) · `upperTiles`(키트 칸 전체) · `codes`(엔진 판정 `X` 막힘 · `*` ★ · `.` 걸음 · `_` 빈 칸). 짓는 법은 `jp-interior-rules`, 그림 `jp-img-interior-dict-*`.

```json
[
{"id":"fusuma-open","ko":"후스마(열림)","block":"interior_doors","kind":"door","w":1,"h":3,"up":0,"use":["travel"],"tags":["문","화실","襖"],"place":"가로 칸막이 1칸 틈 칸","desc":"어두운 나무 기둥·가모이·시키이 두 줄 레일, 한쪽으로 밀려 7px 폭 종이 면이 보이는 후스마 한 짝(검은 테·손잡이 홈).","cells":[[0,0,9007,3],[0,1,9012,3],[0,2,9013,2]],"kit":"jp-in-fusuma-open","name":"후스마(열림)","anchor":{"dx":0,"dy":2},"upperTiles":[[9007],[9012],[9013]],"codes":["*","*","."]},
{"id":"genkan-door","ko":"현관문 문턱","block":"interior_doors","kind":"flat","w":1,"h":1,"up":0,"use":["travel","walk"],"tags":["현관","문"],"place":"맨 아래 출입구 틈 칸","desc":"위에서 본 현관 미닫이문 문턱 — 알루미늄 레일 2줄, 좌우 문틀, 한쪽으로 밀린 유리문 끝.","cells":[[0,0,9016,2]],"kit":"jp-in-genkan-door","name":"현관문 문턱","anchor":{"dx":0,"dy":0},"upperTiles":[[9016]],"codes":["."]},
{"id":"door-side-western","ko":"옆문(열림)","block":"interior_doors","kind":"sidedoor","w":1,"h":3,"up":0,"use":["travel"],"tags":["문","방","복도","탈의실","거실"],"place":"세로 칸막이 3줄 틈의 통로 칸(셋째 줄)","desc":"세로 벽 끝 양쪽 밝은 나무 문틀 기둥 + 상인방, 안쪽으로 젖혀진 9px 폭 갈색 판문 문짝(판넬 2칸·경첩 점·손잡이), 통로 바닥에 남북 문턱 레일 1줄, 가운데는 투명.","cells":[[0,-2,9017,3],[0,-1,9018,3],[0,0,9019,2]],"kit":"jp-in-door-side-western","name":"옆문(열림)","anchor":{"dx":0,"dy":2},"upperTiles":[[9017],[9018],[9019]],"codes":["*","*","."]},
{"id":"door-side-sliding","ko":"미닫이 옆문(열림)","block":"interior_doors","kind":"sidedoor","w":1,"h":3,"up":0,"use":["travel"],"tags":["문","욕실","탈의실","화실","미닫이"],"place":"세로 칸막이 3줄 틈의 통로 칸(셋째 줄)","desc":"세로 벽 끝 양쪽 나무 문틀 기둥 + 상인방, 벽 속으로 반쯤 밀려 9px 폭 면과 손잡이 홈이 보이는 크림색 미닫이, 통로 바닥에 남북 문턱 레일 2줄, 가운데는 투명.","cells":[[0,-2,9017,3],[0,-1,9021,3],[0,0,9022,2]],"kit":"jp-in-door-side-sliding","name":"미닫이 옆문(열림)","anchor":{"dx":0,"dy":2},"upperTiles":[[9017],[9021],[9022]],"codes":["*","*","."]}
]
```
