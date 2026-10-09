# 작업: jp_city 일본 실내 — 현관·계단·문·창·벽걸이 `interior_entry`
새 파일: `scripts/content/jp-city/blocks/interior_entry.py` (모양은 `interior_shell.py` 와 같게: `R = Registry('interior_entry', '현관·계단·창')`, `build()`, `selftest()`, `__main__` 에서 `run_block`).
**도구 호출 12번 안에 첫 그림을 쓰고** 블록을 돌린다.

## 그릴 것 (id — 종류·크기는 §12 로 계산해 정한다)
현관(玄関): `agarikamachi`(上がり框 — 타타키와 마루 사이 단 끝 나무 테, flat 1×1 가로로 이어 까는 띠: 마루 쪽 맨 아래 줄에 놓아 단 차이가 읽히게) · `getabako`(신발장, wall, 1~2칸 폭, 위에 물건 올림 surface) · `genkan-mat`(현관 매트, flat 2×1) · `slippers`(슬리퍼 한 켤레, flat 1×1) · `umbrella-stand`(우산꽂이 floor 1×1) · `shoes-pair`(벗어 놓은 신발, flat 1×1 — 타타키 위)
계단: `stairs-up-wood`(일본 집 나무 계단, **kind wall, 북쪽 벽 앞**, 폭 1 또는 2칸(일본 집 계단 폭 ~0.8m → 1칸이 맞다, 2칸 변형도), up=32(벽면 두 줄을 덮고 벽 속으로 오른다), 발밑 줄은 walk, 디딤판 밝음·챌판 그늘, 옆 벽/난간) · `stairwell-down-wood`(2층 바닥의 내려가는 계단통, flat 1×2 또는 2×2, 난간)
문·칸막이(벽면 윗줄에 거는 hang, hrows=2 — 벽면 두 줄을 덮는 그림): `door-western`(양실 문, 나무 판문 + 손잡이, 1칸) · `fusuma`(후스마 두 짝, 2칸, 은은한 무늬) · `shoji-door`(쇼지 문 2칸, 격자 + 흰 종이) · `oshiire`(오시이레 붙박이장 앞 후스마 2칸 — 위아래 칸 경계 보이게) · `toilet-door`(좁은 문 1칸)
창(hang, hrows=1 또는 2): `window-sash`(알루미늄 새시 창 + 레이스 커튼, 2칸) · `window-sash-small`(1칸, 욕실·화장실 간유리) · `shoji-window`(쇼지 창 2칸) · `curtain-window`(두꺼운 커튼 달린 창 2칸)
벽걸이(hang): `ac-unit`(벽걸이 에어컨, 2칸 폭, 벽면 윗줄) · `wall-clock` · `calendar` · `intercom`(인터폰 모니터) · `light-switch`(작은 스위치 — 너무 작으면 빼라) · `kamidana`(神棚 작은 신단 선반, 화실·거실 높은 곳)
조명: `pendant-light`? — 천장 조명은 3/4 에서 그리기 어렵다. 넣지 말고 이유를 적어라.

## 주의
- 문은 실제 통로가 아니다(통로는 평면의 칸막이 틈). 문 그림은 **벽면에 붙은 닫힌 문**(방 안에서 다른 방·벽장으로 가는 문을 보여 주는 장식, 이벤트를 붙일 자리 — use open/travel). 틈이 있는 칸막이에는 걸지 않는다 — desc 에 적어라.
- 계단은 손 도트 실내 규칙: **북쪽 벽 앞 첫 바닥 줄, 벽면 두 줄을 덮고 벽 속으로 오른다** — 방 가운데·옆벽 금지. 내려가는 계단은 바닥의 구멍(flat).

## 방 예제
- `tiledata/jp-city/interior/demo/interior_entry-genkan.json`: 현관 + 복도 + 계단(현관에서 마루로 올라가는 단: 타타키 영역 zones, 마루 맨 아래 줄에 agarikamachi 띠, 신발장·우산꽂이·신발·매트, 복도 북쪽 벽 앞 계단, 벽에 문 2~3개·창).
- `tiledata/jp-city/interior/demo/interior_entry-upstairs.json`: 2층 복도(계단통 + 문 + 창).

## 산출물
`scripts/content/jp-city/blocks/interior_entry.py`, `tiledata/jp-city/blocks/interior_entry/*.png`, `tiledata/jp-city/interior/demo/interior_entry-*.json`.
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
