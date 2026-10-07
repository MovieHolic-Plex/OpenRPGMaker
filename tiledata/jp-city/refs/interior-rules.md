# 일본 도시 — 일본 집 실내 짓는 법 (build_hand_interior_room · tileset "jp_city")

tilesetId `jp_city` · 그림 `public/assets/jp-city/jp-city-chipset.png`(텍스처 `tex_jp_city`, **9007칸**, 16px 칸, 시트 768×3008px, 한 줄 **48칸** — 번호 n 의 칸은 열 n%48, 행 n÷48(내림), 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 계열 `oprn-jp` — 버들항(`oprn-atlas`)·현대 도시(`modern_city`, `oprn-modern`)·조선·숲마을·EasyRPG 칩셋의 칸 번호와 섞지 않는다.

**무엇인가.** 일본 거리(`jp_city`)와 같은 칩셋·같은 손 도트 화풍의 **일본 현대 집 실내** 재료다. 구조(바닥 7·벽면 5·천장 띠)와 가구 94종·탁자 2종·탁상 물건 20종.
판타지 손 도트 실내(`atlas_biome_interior`)와 **같은 조립기**(`src/editor/handInterior/builder.ts`)가 사양만 바꿔(`src/assets/jpInteriorSpec.json`) 짓는다 — 규칙은 같고, id·칸 번호는 다르다(섞지 않는다).
정본: 그림 `scripts/content/jp-city/blocks/interior_*.py`(+ 틀 `interior/ikit.py`) → `bake_jp.py` → 사양 `bake_interior_spec.py`. 예제 `tiledata/jp-city/interior/examples/*.json`, 짓는 스크립트 `scripts/content/jp-city/maps/interior.mjs`.

## 읽는 순서 · 실행 순서
1. 이 문서(규칙) → 가까운 예제 하나(`jp-interior-ex-house-1f` 단독주택 1층 · `jp-interior-ex-house-2f` 2층 · `jp-interior-ex-apartment-1k` 원룸)와 그 그림 `jp-img-interior-*`.
2. `list_hand_interior_parts({tileset:"jp_city", room:"화실"})` — 방 종류(현관·복도·화실·LDK·부엌·욕실·탈의실·화장실·침실·아이방·원룸·유닛 배스) 또는 건물(`jp_house`·`jp_apartment`)의 예제 가구. 낱말은 `query`. 행마다 desc·놓는 곳·짝 소품·use·facing 이 있다. 칸 번호까지 보려면 사전 `jp-interior-dict-*`.
3. 평면(plan)을 정한다 → `build_hand_interior_room({tileset:"jp_city", mapId, name, plan, floor, wall, zones, objects, tables, goods, start, links})` **한 번**. 오류가 있으면 맵을 만들지 않고 코드·좌표로 거부한다 — 고쳐서 다시 부른다. 경고(닿지 못한 바닥·쓸 수 없는 가구)도 0 이 될 때까지 고친다.
4. 층이 여럿이면 층마다 한 맵(계단 x 를 위아래 층에서 맞춘다), 계단 칸에 `links`. **짓는 순서**: 아직 없는 맵을 가리키는 links 는 거부된다(`link-target-missing`) — ① 1층을 links 없이 짓고 ② 2층을 1층으로 가는 links 와 함께 짓고 ③ 1층을 같은 mapId·`replace:true` 로 2층 links 를 넣어 다시 짓는다. 도착 칸(toX,toY)은 그 맵의 걸을 수 있는 바닥(계단 발칸·계단통 아랫줄 바로 옆)이어야 한다. 거리 맵의 집 문에 들어가는 실내면 현관 아래 틈 칸에 거리로 나가는 `links` 를 단다.
5. `show_map_region`·`check_reachability` 로 확인. 낱칸 번호로 칠하지 않는다(`paint_tiles` 로 가구 칸을 찍으면 통행·그림 순서가 어긋난다).

## 평면(plan) — 구조는 전부 자동
- 한 줄 = 문자열, 모든 줄 같은 길이. `#` = 막힌 칸(외벽·칸막이·건물 밖), 그 밖(`.`) = 실내.
- **막힌 칸 바로 아래 두 줄 = 벽면**(못 걷는다, 위 줄 = 윗줄 · 아래 줄 = 아랫줄), 나머지 실내 = 바닥. 막힌 칸 중 실내에 8방으로 닿는 칸 = 천장 띠(어두운 띠 + 실내 쪽 밝은 테두리), 닿지 않는 칸 = 공허(검정).
- 서쪽이 막힌 바닥·벽면에는 그림자 변형, 벽면 바로 아래 바닥 줄에는 접촉 그림자가 자동으로 깔린다.
- **가로 칸막이**(`#` 한 줄)의 틈 1칸 = 문 통로(틈 아래 칸은 벽면이 아니라 바닥이 된다). 예: 1층 6행 `########.##.####....##` 의 틈 x 8, 11, 16, 17, 18, 19 = 탈의실 문·화장실 문·부엌↔LDK 트인 곳, 2층 6행 `####.######.####.#####` = 침실·화장실·아이방 문(복도에서 한 칸씩). **방을 닫는 문은 가로 칸막이 틈이 가장 깔끔하다.**
- **세로 칸막이**(`#` 한 열)의 틈은 **3줄**이어야 지나간다 — 틈의 위 두 줄은 북쪽이 막혀 벽면이 되고 셋째 줄이 통로다. 1~2줄 틈은 벽면으로 막힌다. 예: 1층 x 6·12 열의 y 9~11 틈 → 통로 y 11(화실·LDK 입구). 틈 앞 칸(통로 줄 양옆)에는 가구를 두지 않는다.
- 출입구 = 맨 아래 줄의 `.` 틈(또는 `start`). 현관은 맨 아래, 그 위 마루 끝 줄에 `agarikamachi`(현관 단) 를 한 줄로 깐다.
- 바닥·벽면은 `floor`·`wall` 기본값 + `zones`(x0,y0,x1,y1 사각형마다 floor·wall). 일본 집 짝: 현관 `tataki` · 복도·LDK·양실 `flooring`(+`cloth`) · 화실 `tatami` + `juraku` · 부엌 `cushion` + `kitchen-panel` · 욕실 `bathtile` + `bathwall` · 탈의실·화장실 `cushion` + `cloth` · 침실 `flooring`/`carpet` + `cloth-beige`. 벽면 zone 은 벽면 칸(막힌 칸 아래 두 줄)을 덮어야 바뀐다.

## 가구 종류(kind)
| kind | 놓는 곳(조립기 검사) | 통행 | 그리는 순서 |
|---|---|---|---|
| `floor` | 발자국 칸 전부가 바닥(벽면 아님) | 발자국 막힘(walk 칸만 밟음) · 위로 솟은 칸 ★ | (y+h)·16 — 남쪽 것이 앞 |
| `wall` | 발자국 바로 북쪽 칸이 벽면 아랫줄(= 북쪽 벽 바로 아래 첫 바닥 줄) | 발자국 막힘 · 벽면을 덮는 윗부분 ★ | (y+h)·16 |
| `hang` | 벽면 **윗줄**(막힌 칸 바로 아래 줄) y 에 건다 — 그림이 벽면 두 줄을 덮는다 | ★(벽면이라 원래 못 걷는다) | y·16 — 벽 가구보다 먼저(뒤) |
| `flat` | 바닥 위 무늬(방석·깔개·매트·현관 단·슬리퍼) | 걸음(2층) | 맨 먼저(가구 밑) |
- 좌표 x,y = **발자국 왼쪽 위 칸**(그림이 위로 솟은 부분 `up` px 는 그 위 칸에 그려진다). 한 칸에 위층 조각은 둘까지(3·4층) — 셋이면 앞(남쪽) 둘만 남는다.
- 계단: 올라가는 계단 `stairs-up-wood`(1칸)·`stairs-up-wood-wide`(2칸)는 **wall 종류** — 북쪽 벽 앞 첫 바닥 줄에 세우면 벽면 두 줄을 덮고 벽 속으로 오른다. 발칸은 걸을 수 있다 → 그 칸에 위층으로 가는 `links`. 내려가는 계단통 `stairwell-down-wood`(2×2): 윗줄 난간은 막히고 아랫줄 두 칸은 밟는다 → 그 두 칸에 아래층 `links`.
- 문·창(`door-western`·`fusuma`·`shoji-door`·`oshiire`·`toilet-door`·`closet-doors`·창 4종)은 **벽면 윗줄에 거는 닫힌 그림**(걸이)이다. 칸막이 틈 칸에는 벽면이 없어 문 그림을 걸 수 없다 — 실제 통로는 평면의 틈이고, 문 그림은 **들어가지 않는 문**(벽장 `oshiire`·`closet-doors`, 광·다른 방으로 이어지는 닫힌 문)을 북쪽 벽면에 보여 줄 때, 또는 이벤트(조사·이동)를 붙일 자리로 쓴다. 예제: 1층 화실 `oshiire`(4,7), 2층 아이방 `closet-doors`(18,1).
- 탁자 자동 타일 `tables:[{style, x, y, w, h}]` — `dining`(식탁, 아무 크기) · `kcounter`(대면 부엌 카운터, 한 줄). 윗면이 있어 탁상 물건을 올린다.
- 탁상 물건 `goods:[{id, x, y}]` — 윗면 있는 가구(`surface`)나 탁자 칸 위에만, 그 칸 4층이 비어 있어야 한다(위로 솟은 이웃 가구가 4층을 쓰면 거부). 물건: `desk-lamp`, `alarm-clock`, `books-stack`, `stuffed-toy`, `randoseru`, `rice-cooker`, `kettle`, `microwave`, `plates`, `fruit-bowl`, `remote`, `newspaper`, `laptop`, `mug`, `tea-set`, `mikan-basket`, `senbei-plate`, `ashtray`, `toothbrush-cup`, `soap`.
- 의자·소파·좌의자는 바라보는 쪽별 id(`-s` 남향 · `-n` 북향 · `-e` · `-w`) — 탁자·TV 를 보게 놓는다(탁자 북쪽 의자 = `-s`).

## 일본 집 방 구성 (예제가 따르는 규칙)
- 현관: 맨 아래 출입구 틈 → 타타키(2~3줄, `tataki`) → 마루 끝 줄 `agarikamachi` → 복도. 신발장 `getabako`(옆벽 곁, floor 종류라 북쪽 벽이 없어도 선다)·우산꽂이·신발·현관 매트·슬리퍼.
- 복도 북쪽 벽에 계단(위층과 x 를 맞춘다). 화장실은 복도에서 바로(가로 칸막이 틈 1칸), 욕실은 탈의실을 지나서(욕실↔탈의실 세로 칸막이 3줄 틈).
- 화실: 북쪽 벽에 도코노마(`tokonoma` 2칸)·불단(`butsudan`)·벽장(`oshiire` 걸이 — 그 앞 바닥은 비워 둔다), 가운데 좌탁(`chabudai`) + 방석 4장(`zabuton`, 밟는 무늬), 다기·귤 바구니는 좌탁 위. 지가이다나·장롱(`chigaidana`·`tansu`)은 벽이 남을 때.
- LDK: 부엌은 북쪽 벽에 냉장고·조리대·싱크·가스대(후드)·레인지 선반을 한 줄로, 그 앞 한 줄 띄워 대면 카운터(`kcounter`) — 카운터 양 끝 중 한 곳은 통로로 남긴다. 식탁은 부엌 앞, 의자는 탁자를 본다. 거실은 TV 받침(벽 가구, 2칸) — 좌탁(2칸) — 소파(TV 를 보는 `sofa-n`, 2칸)를 **같은 x 에** 남쪽으로 늘어놓고, **좌탁과 소파 사이 한 줄 띄움**(붙이면 소파 등받이가 좌탁 칸 4층을 차지해 탁상 물건이 안 올라간다). 3칸 깔개 `rug` 는 2칸 가구와 가운데가 안 맞으니 아이방·원룸 바닥에 따로 깐다. TV 받침은 벽 가구라 그 x 두 칸 바로 북쪽이 벽면이어야 한다 — 부엌과 트인 곳(가로 칸막이 틈) 아래에는 놓을 수 없다.
- 2층: 남쪽 복도(2줄, 끝에 계단통) + 북쪽 방들(가로 칸막이 틈 1칸 = 방문) — 부부 침실(더블 침대·협탁·화장대·옷장)·화장실·아이방(침대 하나 — 이층침대 또는 싱글, 공부 책상 + `desk-chair-n`, 벽장 `closet-doors`). 원룸(1K): 현관 → 부엌(싱크 — 조리대 — 가스대 순, 냉장고는 끝, 세탁기는 현관 곁) → 방(침대·TV·좌탁), 유닛 배스(욕조+변기 한 방, 바닥 두 줄).
- 방은 쓸 만큼만 — 빈 바닥이 넓게 남으면 방을 줄인다(가구로 메우지 않는다).

## 통행·층 (엔진 판정 — 예제 1층의 막힘 지도)
가구 발자국 = 막힘(3층, `solid`), 위로 솟은 칸·걸이 = ★(3층, 지나감 — 캐릭터 위에 그려짐), 밟는 무늬 = 2층(걸음), 바닥 = 1층 걸음, 벽면·천장·공허 = 1층 막힘(`solidfloor`). 탁상 물건 = 4층.
`X` 막힘 · `.` 걸음 (house-1f, 22×15):
```
XXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXX
XXX..XX..XX.XXXXXXX.XX
X..X.X...XX..XX.....XX
X.........X..X..XXX.XX
XXXXXXXX.XX.XXXX....XX
XXXXXXXX.XX.XXXXX.X.XX
XXXXXXXX.XX.XXXXXXX.XX
XXX..XX.....X.XXX.X.XX
X.....X.....X.......XX
X.XX..........XX.....X
X.....XX..XXX........X
XX....X.....X.XXX...XX
XXXXXXXXX.XXXXXXXXXXXX
```

## 정상/오류 — 자동 좌표 검증 (정상 = 예제 1층 그대로, 오류 = 한 가지만 바꿈. 엔진 조립기 실측)
| 변조 | 코드 | 검출 칸(맵 좌표 x,y) | 도구 결과 | 고치는 법 | 그림 |
|---|---|---|---|---|---|
| 벽 가구(싱크대)를 거실 한가운데 (18,12) 로 | `wall-piece-needs-face` | (18,12) | 도구 거부 · 맵 불변 | wall 종류는 북쪽 벽면 바로 아래 첫 바닥 줄에만 — 부엌 북쪽 벽 줄(y=3)로 되돌린다 | `jp-img-in-err-walloffface` |
| 걸이(벽시계)를 벽면 아랫줄 (7,8) 에 | `hang-not-on-face` | (7,8) | 도구 거부 · 맵 불변 | hang 은 벽면 두 줄 중 윗줄(막힌 칸 바로 아래 줄) y=7 에 건다 | `jp-img-in-err-hanglowrow` |
| 탁상 물건(다기)을 다다미 바닥 (3,13) 에 | `goods-needs-surface` | (3,13) | 도구 거부 · 맵 불변 | 탁상 물건은 윗면 있는 가구(좌탁·식탁·카운터) 칸 위에만 — 좌탁 (2,11) 로 | `jp-img-in-err-goodsonfloor` |
| 올라가는 계단을 복도 가운데 (10,10) 로 | `stairs-not-at-wall` | (10,10) | 도구 거부 · 맵 불변 | 계단은 북쪽 벽 앞 첫 바닥 줄에 세운다(벽면 두 줄을 덮고 벽 속으로 오른다) | `jp-img-in-err-stairsmidfloor` |
| 거실 출입 칸 (13,11) 에 좌탁을 놓아 복도→LDK 통로를 막음 | `unreachable-piece`, `unreached-floor` | 막은 칸 (13,11) → 닿지 못한 바닥 44칸: (19,3) (15,4) (16,4) (17,4) (18,4) (19,4) (14,5) (15,5) | 짓되 경고 | 칸막이 틈 앞 칸은 비운다 — 가구를 한 칸 옆으로 | `jp-img-in-err-doorblocked` |
| 우산꽂이를 신발장 칸 (11,12) 에 겹침 | `overlap` | (11,12) | 도구 거부 · 맵 불변 | 발자국이 겹치지 않게 다른 칸으로 | `jp-img-in-err-overlap` |
| 소파를 좌탁 바로 남쪽 (14,12) 으로 붙여 좌탁 칸 4층에 소파 등받이가 걸린 뒤 리모컨(15,11) | `goods-no-layer` | (15,11) | 도구 거부 · 맵 불변 | 좌탁과 소파 사이에 한 줄 띄운다(소파 등받이 overhang 이 좌탁 칸의 3·4층을 차지한다) | `jp-img-in-err-goodsnolayer` |
| 없는 가구 id "sofa" | `unknown-object` | (17,11) | 도구 거부 · 맵 불변 | list_hand_interior_parts({tileset:"jp_city"}) 의 id 를 그대로 쓴다(방향 있는 가구는 -s/-n/-e/-w) | `jp-img-in-err-unknownobject` |
- 오류(`error`)면 도구는 **맵을 만들거나 바꾸지 않는다**(부분 배치 없음). 경고(`warning`: 닿지 못한 바닥·쓸 수 없는 가구·조각 셋 겹침)는 짓되 요약에 남는다 — 0 이 될 때까지 고친다.
- **레이어 정정 조건**: 가구 조각은 3층(앞뒤 둘이면 4층까지), 밟는 무늬는 2층, 탁상 물건은 4층. 4층이 이미 찼다는 `goods-no-layer` 는 물건이 아니라 이웃 가구 자리를 옮겨 고친다(위 표). `paint_tiles` 로 가구 칸을 1층에 칠하면 바닥이 사라지고 통행이 바뀐다 — 지우고 도구로 다시 짓는다.
- **검사 범위**: 칸 번호·층·발자국 겹침·놓는 곳(벽·벽면·윗면)·출입구에서의 도달(BFS, 엔진 `passabilityOf`)만. 이벤트 실행(문·계단 이동이 실제로 일어나는지)과 「집처럼 보이는가」(미감)는 보지 않는다 — 미감은 적대적 검증 관문(`python3 scripts/content/jp-city/gate/adversarial_gate.py check --stage interior`, 판정 파일 `tiledata/jp-city/gates/interior.json` — 그림·문서 해시에 묶임), 이동은 런타임 QA 가 본다.

## 없는 것
현관문(바깥 문) 그림 없음 — 출입구는 맨 아래 틈. 세로 벽(동·서 벽면)에 거는 문·창 없음(걸이는 북쪽 벽면만). 베란다·발코니 없음. 사람(가족 NPC)은 Actor1 캐릭터를 이벤트로 놓는다. 가게·학교·사무실 실내는 아직 없다(이 용도는 집).
