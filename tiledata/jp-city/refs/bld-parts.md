# 일본 도시 — 건물 부품 사전 (id 전체 목록)

tilesetId `jp_city` · 그림 `public/assets/jp-city/jp-city-chipset.png`(텍스처 `tex_jp_city`, **8075칸**, 16px 칸, 시트 768×2704px, 한 줄 **48칸** — 번호 n 의 칸은 열 n%48, 행 n÷48(내림), 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 계열 `oprn-jp` — 버들항(`oprn-atlas`)·현대 도시(`modern_city`, `oprn-modern`)·조선·숲마을·EasyRPG 칩셋의 칸 번호와 섞지 않는다.

`build_jp_city_building` 이 받는 id 의 **전체** 목록이다. 칸 배열(어느 칸 번호가 어느 자리인지)은 이어지는 「띠 사전」·「부착물 사전」 문서에 있다. id 를 지어내면 `UNKNOWN_PART`.
제한: 폭 최소 3칸 · 한 층 = 2줄 · 한 칸 위층 최대 2장(띠 + 부착물 하나).

## 벽 재질 (`wall`)
| id | 뜻 |
|---|---|
| kinari | 아이보리 |
| shiro | 흰색 |
| conc | 콘크리트 회색 |
| hodo | 청회색 |

## 층 띠 종류 (`floorKind` / `floorPlan[].kind`) — 띠 id = `fl.<kind>.<wall>`
| kind | 이름 | 모듈 폭 modw | 벽 | 몸통 변형 번호(variants) |
|---|---|---|---|---|
| slide | 미닫이창 | 1 | kinari shiro conc hodo | 0 1 2 3 4 5 6 7 |
| veranda | 베란다 | 2 | kinari shiro conc hodo | 0 1 2 3 4 5 6 7 |
| koushi | 격자창 | 1 | kinari shiro conc hodo | 0 1 2 3 |
| pairs | 쌍창 | 1 | kinari shiro conc hodo | 0 1 2 3 |
| ribbon | 띠창 | 1 | kinari shiro conc hodo | 0 1 |
| curtain | 유리 커튼월 | 1 | kinari | 0 1 |
| balcony | 발코니 | 2 | kinari shiro conc hodo | 0 1 3 7 11 15 |
| tile | 타일벽 | 2 | kinari | 0 1 |
| blank | 민벽 | 1 | kinari shiro conc hodo | 0 |
- `curtain`·`tile` 은 `kinari` 벽 한 가지뿐(건물 `wall` 이 shiro 여도 kinari). `variants` 는 몸통 모듈마다 돌려 쓰는 변형 번호 목록이며 목록에 없는 번호는 `UNKNOWN_PART`.

## 1층 종류 (`ground`) — 띠 id = `gr.*`
| id | 이름 | 기본 문 | 모듈 폭 | 몸통 변형(groundVariants) |
|---|---|---|---|---|
| gr.izakaya | 이자카야 1층 | noren | 2 | 0 |
| gr.konbini.0 | 편의점 1층 (A) | auto | 2 | 0 |
| gr.konbini.1 | 편의점 1층 (B) | auto | 2 | 0 |
| gr.garage | 차고·셔터 1층 | rollup | 2 | 0 |
| gr.shutter.aka | 셔터 점포 1층 (빨강 차양) | steel | 2 | 0 |
| gr.shutter.sora | 셔터 점포 1층 (하늘색 차양) | steel | 2 | 0 |
| gr.shutter.kii | 셔터 점포 1층 (노랑 차양) | steel | 2 | 0 |
| gr.glass.aka | 유리 점포 1층 (빨강 차양) | cafe | 2 | 0 |
| gr.glass.sora | 유리 점포 1층 (하늘색 차양) | cafe | 2 | 0 |
| gr.glass.kii | 유리 점포 1층 (노랑 차양) | cafe | 2 | 0 |
| gr.machiya | 마치야(전통 상가) 1층 | machiya | 1 | 0 1 2 3 4 5 |

## 지붕·옥상 간판·처마
| 구분 | id | 이름 | 비고 |
|---|---|---|---|
| 지붕 `roof` | roof.plain.plain | 옥상 띠 · 평지붕, 기물 없음 | 평지붕 |
| 지붕 `roof` | roof.plain.tank | 옥상 띠 · 평지붕, 물탱크 | 평지붕 |
| 지붕 `roof` | roof.plain.cyl | 옥상 띠 · 평지붕, 원통 탱크 | 평지붕 |
| 지붕 `roof` | roof.ac.plain | 옥상 띠 · 실외기 옥상, 기물 없음 | 평지붕 |
| 지붕 `roof` | roof.ac.tank | 옥상 띠 · 실외기 옥상, 물탱크 | 평지붕 |
| 지붕 `roof` | roof.ac.cyl | 옥상 띠 · 실외기 옥상, 원통 탱크 | 평지붕 |
| 지붕 `roof` | roof.stair.plain | 옥상 띠 · 계단탑 옥상, 기물 없음 | 평지붕 |
| 지붕 `roof` | roof.stair.tank | 옥상 띠 · 계단탑 옥상, 물탱크 | 평지붕 |
| 지붕 `roof` | roof.stair.cyl | 옥상 띠 · 계단탑 옥상, 원통 탱크 | 평지붕 |
| 지붕 `roof` | roof.tile | 기와 지붕 띠 | 경사 지붕 |
| 지붕 `roof` | roof.slate | 슬레이트 지붕 띠 | 경사 지붕 |
| 지붕 `roof` | roof.hip | 기와 모임지붕 띠 | 경사 지붕 |
| 지붕 `roof` | roof.hip.slate | 슬레이트 모임지붕 띠 | 경사 지붕 |
| 옥상 간판 `head`(지붕 자리를 대신) | roofsign.aka | 옥상 간판 (빨강) |  |
| 옥상 간판 `head`(지붕 자리를 대신) | roofsign.sora | 옥상 간판 (하늘색) |  |
| 옥상 간판 `head`(지붕 자리를 대신) | roofsign.kii | 옥상 간판 (노랑) |  |
| 처마 `eave`(1층 바로 위) | eave | 처마 띠 |  |
| 처마 `eave`(1층 바로 위) | eave.slate | 슬레이트 처마 띠 |  |
- 지붕 id 는 `roof.` 를 생략할 수 있다(예: `plain.tank`). 건물 맨 위는 지붕 띠 또는 옥상 간판이어야 한다(`ROOF_ORDER`).

## 문 (`door.type`) — 부착물 `door.<type>`
| type | 이름 | 폭×높이(칸) | 1층 기본 문으로 쓰는 1층 |
|---|---|---|---|
| lattice | 격자문 | 2×3 | - |
| auto | 자동문 | 2×3 | gr.konbini.0, gr.konbini.1 |
| lobby | 로비 유리문 | 2×3 | - |
| steel | 철문 | 2×3 | gr.shutter.aka, gr.shutter.sora, gr.shutter.kii |
| cafe | 카페 문 | 2×3 | gr.glass.aka, gr.glass.sora, gr.glass.kii |
| noren | 노렌(포렴) 문 | 2×3 | gr.izakaya |
| rollup | 롤업 셔터문 | 2×3 | gr.garage |
| machiya | 마치야 격자 현관 | 3×3 | gr.machiya |
| house | 주택 현관문 | 2×3 | - |
- 문 칸 = 맨 아래 두 줄(막힘) + 윗줄(★). 접근칸 = 문 바로 아래 한 줄.

## 부착물 분류 (73종, `decos[].deco`)
| 분류(group) | 이름 | 개수 | 크기(칸) | 창 위 금지 | id |
|---|---|---|---|---|---|
| fe | 비상계단 | 1 | 2×2 | 아니오 | fe |
| fe_end | 비상계단 | 1 | 2×2 | 아니오 | fe_end |
| sign_h | 가로 간판 | 3 | 2×2 | 예 | sign_h.aka, sign_h.sora, sign_h.kii |
| vstack | 세로 간판 적층 | 4 | 1×2 | 아니오 | vstack.kii, vstack.aka, vstack.sora, vstack.midori |
| wallad | 벽 광고 | 2 | 4×2 | 예 | wallad.aka, wallad.sora |
| vsign | 세로 간판 | 11 | 1×3 | 아니오 | vsign.izakaya, vsign.yakkyoku, vsign.sushi, vsign.yakiniku, vsign.kissa, vsign.sento, vsign.ramen, vsign.mark.aka, vsign.mark.sora, vsign.mark.kii, vsign.mark.midori |
| plate | 간판판 | 11 | 2×1 | 예 | plate.yakkyoku, plate.sushi, plate.kissa, plate.yakiniku, plate.sento, plate.bento, plate.shika, plate.mark.aka, plate.mark.sora, plate.mark.kii, plate.mark.midori |
| board | 입간판판 | 7 | 3×1 | 아니오 | board.izakaya, board.ramen, board.kissaten, board.sakaya, board.shokudo, board.sushi, board.tempura |
| ac | 에어컨 실외기 | 2 | 1×2 | 예 | ac.0, ac.1 |
| pipe | 배관 | 1 | 1×2 | 아니오 | pipe |
| laundry | 빨래 | 1 | 2×2 | 예 | laundry |
| sunshade | 차양 | 3 | 2×1 | 예 | sunshade.sora, sunshade.aka, sunshade.kii |
| inuyarai | 개 막이 울타리 | 1 | 1×1 | 아니오 | inuyarai |
| mushiko | 무시코 창(격자 덧창) | 1 | 1×1 | 예 | mushiko |
| rtext | 옥상 글자 간판 | 4 | 4×3 | 아니오 | rtext.ramen, rtext.izakaya, rtext.karaoke, rtext.pachinko |
| door | 문 | 9 | 2×3 | 아니오 | door.lattice, door.auto, door.lobby, door.steel, door.cafe, door.noren, door.rollup, door.machiya, door.house |
| vision | 대형 영상 화면 | 4 | 6×4 | 아니오 | vision.0, vision.1, vision.2, vision.3 |
| mural | 외벽 벽화 | 4 | 6×4 | 아니오 | mural.0, mural.1, mural.2, mural.3 |
| facade_ad | 외벽 광고 | 3 | 8×3 | 아니오 | facade_ad.0, facade_ad.1, facade_ad.2 |
- 「창 위 금지」= 창이 있는 띠 위에 얹으면 `DECO_CLASH`(간판·차양·실외기·빨래·광고·무시코). 민벽(`blank`)이나 창 없는 칸에 얹는다.
- `vstack.{c}` 는 색 목록 `cols`(`kii aka sora midori`)와 정수 `floor` 가 필요하다. `fe`(비상계단)는 맨 아래 층에서 `fe_end` 로 바뀐다.

## 마당 · 거리 칸 (`wing.yard`) — 46종
`sw`, `sw_tactile`, `sw_shade`, `road_n`, `road_c`, `road_dash`, `road_s`, `cw_n`, `cw_m`, `cw_s`, `lane_n`, `lane_c`, `lane_s`, `lane_stop`, `lot`, `lot_line`, `lot_stop`, `lot_num`, `gravel`, `stop_c`, `stop_n`, `stop_s`, `zeb_n`, `zeb_c`, `zeb_s`, `tactile_dot`, `tactile_bar`, `manhole`, `zeb_d-3`, `zeb_d-2`, `zeb_d-1`, `zeb_d0`, `zeb_d1`, `zeb_d2`, `zeb_d3`, `pave_a`, `pave_b`, `lawn`, `sando`, `sando_b`, `plant_strip`, `vz_n`, `vz_c`, `vz_s`, `rail`, `quay` — 번호는 `jp-sheet-map` 의 거리 칸 사전.

## 조립 결과를 맵에 적는 칸 목록(사전 속 번호의 집합)
- 아래층(1층) 칸: 42종 · 막힘 칸: 88종 · 불투명 칸(위 칸이 이것이면 밑 칸이 가려진다): 751종 — 전체 목록은 `src/assets/jpCityBuildingSpec.json` 의 `lower`·`solid`·`opaque`.
