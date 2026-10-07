# 작업: jp_city 일본 실내 — 거실·다이닝·부엌(LDK) `interior_ldk`
새 파일: `scripts/content/jp-city/blocks/interior_ldk.py` (모양은 `interior_shell.py` 와 같게: `R = Registry('interior_ldk', 'LDK')`, `build()`, `selftest()`, `__main__` 에서 `run_block`).
**도구 호출 12번 안에 첫 그림을 쓰고** 블록을 돌린다.

## 그릴 것 (id — 종류·크기는 §12 로 계산)
부엌: `kitchen-sink`(시스템 키친 개수대 칸, wall 1×1, 수전·볼 윗면) · `kitchen-stove`(IH/가스 2구 레인지 칸, wall 1×1, 위 환기 후드는 벽면 쪽으로 솟게) · `kitchen-worktop`(조리대 칸, wall 1×1, surface) — 셋을 나란히 붙여 한 줄 시스템 키친이 이어져 보여야 한다(이음매 맞추기) · `fridge`(냉장고 wall 1×2, §12 fridge) · `microwave-rack`(전자레인지 선반 wall 1×2) · `cupboard`(食器棚 그릇장 wall 1×2 또는 2×2, 유리문 안 그릇) · `trash-bins`(분리수거 통 2~3개, floor 1×1)
다이닝: 탁자 자동 타일 `dining`(`R.table('dining', ...)` — draw(c, w, h): 어떤 w×h 도 그릴 수 있게, 상판 테·앞날·다리; 2×1 이 4인 식탁) · `chair-dining-s/-n/-e/-w`(식탁 의자 4방향 floor 1×1, use sit, facing)
거실: `sofa-s`(2~3인 소파 남향 2×1) · `sofa-n`(북향 — 등판이 보임) · `sofa-e`·`sofa-w`(옆향 1×2) · `low-table`(낮은 거실 탁자 floor 2×1, surface) · `tv-board`(TV 보드 + 평면 TV, wall 2×1, TV 는 벽면 쪽으로 솟음) · `rug`(거실 러그 flat 3×2) · `houseplant`(관엽식물 floor 1×1) · `bookshelf`(책장 wall 1×2) · `floor-lamp`(스탠드, floor 1×1, use light) · `cushion-floor`(바닥 쿠션 flat 1×1)
탁상 물건(goods 16×16): `rice-cooker` · `kettle` · `microwave`? (선반에 붙였으면 빼라) · `plates` · `fruit-bowl` · `remote` · `newspaper` · `laptop` · `mug`
탁자 자동 타일 `kcounter`(아일랜드 조리대, 1줄 one_row=True — 대면식 키친 카운터)도 그릴 수 있으면.

## 방 예제
- `tiledata/jp-city/interior/demo/interior_ldk-ldk.json`: 일본 집 LDK(약 10×8 실내, 바닥 flooring, 벽 cloth, 부엌 쪽 zones cushion/kitchen-panel) — 북쪽 벽에 시스템 키친 한 줄(sink·worktop·stove) + 냉장고 + 그릇장, 다이닝 식탁 4인 + 의자 4, 거실 소파 남향/북향 + 낮은 탁자 + TV 보드(소파가 TV 를 본다) + 러그. 탁상 물건 몇 개.
- `tiledata/jp-city/interior/demo/interior_ldk-1k.json`: 원룸/1K 맨션(약 6×8 실내): 현관 쪽 작은 부엌 한 줄 + 방.

## 산출물
`scripts/content/jp-city/blocks/interior_ldk.py`, `tiledata/jp-city/blocks/interior_ldk/*.png`, `tiledata/jp-city/interior/demo/interior_ldk-*.json`.
## 공통 규칙 (반드시 — 일본 실내 1묶음 「집」)

너는 OPRN Studio 저장소의 **격리 워크트리**(현재 디렉터리)에서 일하는 도트 작업자다. 감독(Claude)이 결과를 받아 jp_city 번들에 굽고, 조수 도구(build_hand_interior_room, tileset jp_city)가 네 가구로 방을 짓는다.

### 먼저 읽을 것 (순서대로, 큰 파일은 필요한 절만)
1. `scripts/content/jp-city/interior/ikit.py` 맨 위 설명 + `Registry.obj/floor/wall/table/good` 인자 — **이 틀이 칸 자르기·그림자·통행·사양을 다 한다. 너는 그림 함수만 쓴다.**
2. `scripts/content/jp-city/blocks/interior_shell.py` — 블록 파일 모양(여기 바닥·벽면 id 를 방 예제에서 쓴다).
3. `tiledata/atlas-pick/modern-style-bible.md` §1·§2(팔레트·램프 단), §10(3/4 시점), **§11(실내 3/4: 가구 T/F 표·유형별 짜는 법·11-4b 사용자 판정)**, **§12-3(실내 실제 크기 표, 1칸 = 16px = 1m)** — 크기는 이 표로 계산한다(`scripts/content/atlas-pick/size_calc.py` 참고).
4. 승인된 jp_city 화풍: `scripts/content/jp-city/houses/ref_house.py`(사용자 「훨씬 낫다」), `scripts/content/jp-city/blocks/transit_station.py`(modern3 실내 — 벽·매표기·자판기·벤치 짜는 법), `scripts/content/jp-city/blocks/street_hand.py`. 그림: `tiledata/jp-city/blocks/transit_station/_all-x2.png`, `tiledata/jp-city/blocks/street_hand/_all-x2.png` (크롭해서 본다).
5. 실내 짜임 원칙(판타지 실내지만 구조·가구 규칙은 같다): `/home/main/.claude/skills/interior-chipset-authoring/SKILL.md` §0, §0b, §0d, §0e.
6. 실제 일본 집 조사: `tiledata/jp-city/research/README.md` + 네 지식(일본 단독주택·맨션의 실제 가구·크기·배치).

### 그림 규칙
- **스크립트 손 도트**(Python + numpy + PIL). 생성 이미지·외부 그림 금지. **사람 그리지 않는다.** 글자·상표·로고 금지(간단한 숫자 픽셀도 피한다).
- 색은 **modern3 램프 `K(램프, 단)` 만**(`yoru hodo conc tairu ita garasu kawara renga tekko ki mado kinari shiro aka daidai kii midori sora pinku soil yuka kokuban lino murasaki kon neonP neonC sumi`). 반투명 금지. 윤곽 `OL`(=sumi 어두운 단) 또는 재질 어두운 단. **빛 왼쪽 위**.
- **3/4 시점**: 수평 면(상판·좌판·이불·뚜껑)이 위에서 보이고 + 남쪽(화면 아래) 앞면. 벽 붙은 키 큰 가구는 윗면 T 4~6px + 앞 가장자리 하이라이트 1행 + 처마 그림자 2px + 들어간 앞면. 옆을 보는 의자의 남쪽 면은 옆모습(L자)이 정상.
- 가구 윗면은 바닥보다 밝고 대비가 커야 한다(바닥은 조용하게, 가구는 또렷하게). 윗면 가장자리 1px 밝은 테.
- 크기: §12-3 표(1칸 = 1m). 표에 없으면 같은 공식으로 계산해 docstring 에 적는다.
- 칸 종류(`kind`): `floor`(바닥에 놓음, 발밑 막힘) · `wall`(북쪽 벽면 바로 아래 첫 바닥 줄에만 — 키 큰 가구·벽 붙이, 위로 벽면을 덮어 솟음) · `hang`(벽면 윗줄에 거는 것: 창·액자·에어컨·시계, 그림 높이 hrows 줄) · `flat`(밟는 바닥 무늬: 깔개·발매트·방석 등, 2층). `up`=발밑 위로 솟는 px. `walk`=발밑 중 밟는 칸, `solid`=발밑 중 막는 칸(기본 전부).
- 메타(조수가 읽는다 — 한국어): `desc`(무엇 + 어느 방의 어디에·무엇 옆에·몇 개), `tags`(방 이름: 현관·복도·계단·거실·다이닝·부엌·화실·침실·아이방·욕실·탈의실·화장실·원룸·베란다), `place`, `pair`(같이 놓는 가구 id), `use`(sit·sleep·open·search·read·counter·light·walk·block 등), `facing`(N/S/E/W — 의자·소파는 4방향 따로 id: `-s -n -e -w`), `surface=True`(위에 탁상 물건을 올리는 가구).
- id 는 영어 소문자-하이픈(예 `kotatsu`, `chair-dining-s`). 네 범위 밖 id 를 만들지 않는다(다른 작업자와 겹친다).

### 반복 검수 (가장 중요 — 사용자는 매우 까다롭다: 「윤곽 없음·뿌연 색·칩셋보다 큼」 「3/4 안 지킴」으로 여러 번 반려했다)
1. 그린 뒤 `python3 scripts/content/jp-city/blocks/<블록>.py` → selftest 실패 0 + `tiledata/jp-city/blocks/<블록>/_all-x3.png`.
2. **방 예제**를 `tiledata/jp-city/interior/demo/<블록>-<방>.json` 로 쓴다(도구 인자 모양: plan·floor·wall·zones·objects·tables·goods — `interior/preview.py` 설명). 렌더: `python3 scripts/content/jp-city/interior/preview.py <json> tiledata/jp-city/blocks/<블록>/demo-<방>.png --x 3` → 문제 0 이어야 한다. 실제 일본 집처럼 **목적 있는 배치**(사람이 어떻게 사는지: 의자는 탁자를 보고, 이불은 오시이레 앞, 신발장은 현관 옆). 빈 바닥이 넓으면 방을 줄인다.
3. **PNG 읽기 규칙: 가로·세로 1000px 넘는 PNG 를 Read 하지 마라.** 필요한 부분을 600×400 이하로 잘라 `/tmp/jpi-<블록>/crop-*.png` 로 저장해 그 크롭만 Read 한다. 전체 Read 는 15번 이하.
4. 기존 승인 그림(transit_station 의 자판기·벤치, ref_house)과 **같은 배율로 나란히** 놓고 윤곽·명암 단계·크기·시점을 비교한다. 최소 3회 고친다.
5. 보고에 「잘 됐다」고 쓰지 말고 남은 약점을 정직하게 적는다.

### 금지·마무리
- **네 파일만** 고친다(아래 「산출물」). `interior/ikit.py`·`preview.py`·다른 블록·`bake_jp.py`·`pins.json`·`src/**` 는 고치지 않는다(틀에 버그·모자람이 있으면 최종 답에 적는다). `bake_jp.py` 실행 금지. `npm`·vitest·gates·`git stash`·`git push` 금지.
- 끝나면 네 파일만 `git add` 하고 이 워크트리 브랜치에 커밋(메시지 `feat(jp-city): …`, 끝 줄 `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`).
- 최종 답: 만든 id 목록(종류·크기·up·use), 방 예제 json·png 경로, 눈 확인 크롭 경로, 남은 약점.
