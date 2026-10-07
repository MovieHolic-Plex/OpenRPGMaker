# 일본 도시 — 일본 집 실내 가구 사전 2/2 (1종, 칸 번호 전체)

tilesetId `jp_city` · 그림 `public/assets/jp-city/jp-city-chipset.png`(텍스처 `tex_jp_city`, **9007칸**, 16px 칸, 시트 768×3008px, 한 줄 **48칸** — 번호 n 의 칸은 열 n%48, 행 n÷48(내림), 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 계열 `oprn-jp` — 버들항(`oprn-atlas`)·현대 도시(`modern_city`, `oprn-modern`)·조선·숲마을·EasyRPG 칩셋의 칸 번호와 섞지 않는다.

항목: `id`(도구 objects[].id 에 그대로) · `ko` · `block`(그림 원본 blocks/<block>.py) · `kind`(floor 바닥 가구 · wall 북쪽 벽 앞 · hang 벽면 윗줄 걸이 · flat 밟는 무늬) · `w`×`h`(발자국 칸) · `up`(위로 솟은 px) ·
`use`·`facing`·`surface`(윗면 → 탁상 물건)·`stairs`·`tags`(방)·`place`(놓는 곳)·`pair`(짝 가구)·`desc` · `cells`([dx, dy, 칸 번호, 층] — dy<0 은 발자국 위로 솟은 칸, 층 2 = 밟는 무늬·3 = 가구) ·
같은 그림의 키트 `kit`(`stamp_object` 용 — 실내는 도구로 짓고 키트는 낱개 확인용) · `upperTiles`(키트 칸 전체) · `codes`(엔진 판정 `X` 막힘 · `*` ★ · `.` 걸음 · `_` 빈 칸). 짓는 법은 `jp-interior-rules`, 그림 `jp-img-interior-dict-*`.

```json
[
{"id":"laundry-rack","ko":"빨래 건조대","block":"interior_bed","kind":"floor","w":2,"h":2,"up":8,"use":["block"],"tags":["침실","베란다","탈의실"],"place":"창가·베란다 쪽 바닥","pair":["washing-machine"],"desc":"접이식 빨래 건조대(2×1칸) — 가로 봉에 셔츠·수건이 널려 있다.","cells":[[0,-1,8998,3],[1,-1,8999,3],[0,0,9000,3],[1,0,9001,3]],"kit":"jp-in-laundry-rack","name":"빨래 건조대","anchor":{"dx":0,"dy":1},"upperTiles":[[8998,8999],[9000,9001]],"codes":["**","XX"]}
]
```
