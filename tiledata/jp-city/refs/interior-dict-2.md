# 일본 도시 — 일본 집 실내 가구 사전 2/2 (6종, 칸 번호 전체)

tilesetId `jp_city` · 그림 `public/assets/jp-city/jp-city-chipset.png`(텍스처 `tex_jp_city`, **9017칸**, 16px 칸, 시트 768×3008px, 한 줄 **48칸** — 번호 n 의 칸은 열 n%48, 행 n÷48(내림), 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 계열 `oprn-jp` — 버들항(`oprn-atlas`)·현대 도시(`modern_city`, `oprn-modern`)·조선·숲마을·EasyRPG 칩셋의 칸 번호와 섞지 않는다.

항목: `id`(도구 objects[].id 에 그대로) · `ko` · `block`(그림 원본 blocks/<block>.py) · `kind`(floor 바닥 가구 · wall 북쪽 벽 앞 · hang 벽면 윗줄 걸이 · flat 밟는 무늬) · `w`×`h`(발자국 칸) · `up`(위로 솟은 px) ·
`use`·`facing`·`surface`(윗면 → 탁상 물건)·`stairs`·`tags`(방)·`place`(놓는 곳)·`pair`(짝 가구)·`desc` · `cells`([dx, dy, 칸 번호, 층] — dy<0 은 발자국 위로 솟은 칸, 층 2 = 밟는 무늬·3 = 가구) ·
같은 그림의 키트 `kit`(`stamp_object` 용 — 실내는 도구로 짓고 키트는 낱개 확인용) · `upperTiles`(키트 칸 전체) · `codes`(엔진 판정 `X` 막힘 · `*` ★ · `.` 걸음 · `_` 빈 칸). 짓는 법은 `jp-interior-rules`, 그림 `jp-img-interior-dict-*`.

```json
[
{"id":"laundry-rack","ko":"빨래 건조대","block":"interior_bed","kind":"floor","w":2,"h":2,"up":8,"use":["block"],"tags":["침실","베란다","탈의실"],"place":"창가·베란다 쪽 바닥","pair":["washing-machine"],"desc":"접이식 빨래 건조대(2×1칸) — 가로 봉에 셔츠·수건이 널려 있다.","cells":[[0,-1,8998,3],[1,-1,8999,3],[0,0,9000,3],[1,0,9001,3]],"kit":"jp-in-laundry-rack","name":"빨래 건조대","anchor":{"dx":0,"dy":1},"upperTiles":[[8998,8999],[9000,9001]],"codes":["**","XX"]},
{"id":"door-open-western","ko":"양실 문(열림)","block":"interior_doors","kind":"door","w":1,"h":3,"up":0,"use":["travel"],"tags":["문","방","양실","복도"],"place":"가로 칸막이 1칸 틈 칸","desc":"밝은 나무 문틀 + 안쪽으로 젖혀져 가장자리만 보이는 갈색 판문(경첩 2개), 통로는 투명.","cells":[[0,0,9007,3],[0,1,9008,3],[0,2,9009,2]],"kit":"jp-in-door-open-western","name":"양실 문(열림)","anchor":{"dx":0,"dy":2},"upperTiles":[[9007],[9008],[9009]],"codes":["*","*","."]},
{"id":"door-open-toilet","ko":"화장실 문(열림)","block":"interior_doors","kind":"door","w":1,"h":3,"up":0,"use":["travel"],"tags":["문","화장실","탈의실"],"place":"가로 칸막이 1칸 틈 칸","desc":"크림색 문틀 + 젖혀진 크림색 문짝 가장자리(서리유리 조각·환기 살·레버), 통로는 투명.","cells":[[0,0,9007,3],[0,1,9010,3],[0,2,9011,2]],"kit":"jp-in-door-open-toilet","name":"화장실 문(열림)","anchor":{"dx":0,"dy":2},"upperTiles":[[9007],[9010],[9011]],"codes":["*","*","."]},
{"id":"fusuma-open","ko":"후스마(열림)","block":"interior_doors","kind":"door","w":1,"h":3,"up":0,"use":["travel"],"tags":["문","화실","襖"],"place":"가로 칸막이 1칸 틈 칸","desc":"어두운 나무 기둥·가모이·시키이 두 줄 레일, 한쪽으로 밀려 끝만 보이는 후스마 한 짝, 통로는 투명.","cells":[[0,0,9007,3],[0,1,9012,3],[0,2,9013,2]],"kit":"jp-in-fusuma-open","name":"후스마(열림)","anchor":{"dx":0,"dy":2},"upperTiles":[[9007],[9012],[9013]],"codes":["*","*","."]},
{"id":"shoji-open","ko":"쇼지 문(열림)","block":"interior_doors","kind":"door","w":1,"h":3,"up":0,"use":["travel"],"tags":["문","화실","障子"],"place":"가로 칸막이 1칸 틈 칸","desc":"어두운 나무 기둥·가모이·시키이 두 줄 레일, 한쪽으로 밀려 끝만 보이는 쇼지 한 짝(격자·종이), 통로는 투명.","cells":[[0,0,9007,3],[0,1,9014,3],[0,2,9015,2]],"kit":"jp-in-shoji-open","name":"쇼지 문(열림)","anchor":{"dx":0,"dy":2},"upperTiles":[[9007],[9014],[9015]],"codes":["*","*","."]},
{"id":"genkan-door","ko":"현관문 문턱","block":"interior_doors","kind":"flat","w":1,"h":1,"up":0,"use":["travel","walk"],"tags":["현관","문"],"place":"맨 아래 출입구 틈 칸","desc":"위에서 본 현관 미닫이문 문턱 — 알루미늄 레일 2줄, 좌우 문틀, 한쪽으로 밀린 유리문 끝.","cells":[[0,0,9016,2]],"kit":"jp-in-genkan-door","name":"현관문 문턱","anchor":{"dx":0,"dy":0},"upperTiles":[[9016]],"codes":["."]}
]
```
