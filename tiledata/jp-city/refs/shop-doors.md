# 일본 도시 — 문 사전 (9종, 칸 번호 전체)

tilesetId `jp_city` · 그림 `public/assets/jp-city/jp-city-chipset.png`(텍스처 `tex_jp_city`, **3728칸**, 16px 칸, 시트 768×1248px, 한 줄 **48칸** — 번호 n 의 칸은 열 n%48, 행 n÷48(내림), 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 계열 `oprn-jp` — 버들항(`oprn-atlas`)·현대 도시(`modern_city`, `oprn-modern`)·조선·숲마을·EasyRPG 칩셋의 칸 번호와 섞지 않는다.

문 키트(`jp-door-*`)는 건물 지면 층(1층 띠 3줄) **위에 겹쳐** 찍는 2×3(마치야 3×3) 부착물이다. 맨 아래 두 줄은 막힘(문 칸), 윗줄은 ★. 문 앞 접근칸 = 키트 바깥 한 줄 아래(`access`).
건물 조립 도구에서는 `door.type` 으로 고른다(`lattice·auto·lobby·steel·cafe·noren·rollup·machiya·house`). 항목 필드는 「상가 레시피 사전」과 같다. 그림 `jp-img-shop-doors`.

```json
[
{"kit":"jp-door-lattice","name":"문 · 격자문","w":2,"h":3,"access":[{"dx":0,"dy":3},{"dx":1,"dy":3}],"parts":[{"kind":"entrance","dx":0,"dy":2,"w":2,"h":1}],"upperTiles":[[2352,2353],[2354,2355],[2356,2357]],"codes":["**","XX","XX"]},
{"kit":"jp-door-auto","name":"문 · 자동문","w":2,"h":3,"access":[{"dx":0,"dy":3},{"dx":1,"dy":3}],"parts":[{"kind":"entrance","dx":0,"dy":2,"w":2,"h":1}],"upperTiles":[[656,657],[658,659],[660,661]],"codes":["**","XX","XX"]},
{"kit":"jp-door-lobby","name":"문 · 로비 유리문","w":2,"h":3,"access":[{"dx":0,"dy":3},{"dx":1,"dy":3}],"parts":[{"kind":"entrance","dx":0,"dy":2,"w":2,"h":1}],"upperTiles":[[662,663],[664,2358],[666,2359]],"codes":["**","XX","XX"]},
{"kit":"jp-door-steel","name":"문 · 철문","w":2,"h":3,"access":[{"dx":0,"dy":3},{"dx":1,"dy":3}],"parts":[{"kind":"entrance","dx":0,"dy":2,"w":2,"h":1}],"upperTiles":[[2333,2334],[2335,2336],[2337,2338]],"codes":["**","XX","XX"]},
{"kit":"jp-door-cafe","name":"문 · 카페 문","w":2,"h":3,"access":[{"dx":0,"dy":3},{"dx":1,"dy":3}],"parts":[{"kind":"entrance","dx":0,"dy":2,"w":2,"h":1}],"upperTiles":[[2346,2347],[2348,2349],[2350,2351]],"codes":["**","XX","XX"]},
{"kit":"jp-door-noren","name":"문 · 노렌(포렴) 문","w":2,"h":3,"access":[{"dx":0,"dy":3},{"dx":1,"dy":3}],"parts":[{"kind":"entrance","dx":0,"dy":2,"w":2,"h":1}],"upperTiles":[[680,681],[682,683],[684,685]],"codes":["**","XX","XX"]},
{"kit":"jp-door-rollup","name":"문 · 롤업 셔터문","w":2,"h":3,"access":[{"dx":0,"dy":3},{"dx":1,"dy":3}],"parts":[{"kind":"entrance","dx":0,"dy":2,"w":2,"h":1}],"upperTiles":[[686,687],[2339,2340],[2341,2342]],"codes":["**","XX","XX"]},
{"kit":"jp-door-machiya","name":"문 · 마치야 격자 현관","w":3,"h":3,"access":[{"dx":0,"dy":3},{"dx":1,"dy":3},{"dx":2,"dy":3}],"parts":[{"kind":"entrance","dx":0,"dy":2,"w":3,"h":1}],"upperTiles":[[692,693,694],[695,696,697],[698,699,700]],"codes":["***","XXX","XXX"]},
{"kit":"jp-door-house","name":"문 · 주택 현관문","w":2,"h":3,"access":[{"dx":0,"dy":3},{"dx":1,"dy":3}],"parts":[{"kind":"entrance","dx":0,"dy":2,"w":2,"h":1}],"upperTiles":[[2343,2344],[703,2345],[705,706]],"codes":["**","XX","XX"]}
]
```
