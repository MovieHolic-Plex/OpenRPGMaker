## 공통 규칙 (반드시 — 일본 실내 3묶음 「학교·체육관·역·사무실·우체국」)

너는 OPRN Studio 저장소의 **격리 워크트리**(현재 디렉터리)에서 일하는 도트 작업자다. 감독(Claude)이 네 커밋을 받아 jp_city 번들에 굽고, 조수 도구(build_hand_interior_room, tileset jp_city)가 네 가구로 방을 짓고, 장소로 게시하고, 거리 건물 문과 잇는다.
2묶음(가게 19곳) 때 감독이 예제를 13번 고쳐서야 적대적 관문을 통과했다. 그때 배운 규칙이 아래 「배치 규칙」이다. **이번에는 네가 검사기까지 직접 돌려 경고 0 을 만들고 넘긴다.**

### 먼저 읽을 것 (순서대로, 큰 파일은 필요한 절만)
1. `tiledata/jp-city/refs/interior-rules.md` 전부(26KB) — 도구 인자·평면 규칙·가구 종류·계단·문·「가게·공공 실내」 절. 이 문서가 조수가 보는 규칙이다.
2. `scripts/content/jp-city/interior/ikit.py` 맨 위 설명 + `Registry.obj/floor/wall/table/good` 인자 — **이 틀이 칸 자르기·그림자·통행·사양을 다 한다. 너는 그림 함수만 쓴다.**
3. 블록 파일 모양: `scripts/content/jp-city/blocks/interior_shell.py`(바닥·벽면·문·창), `interior_public.py`(공공 가구 — 의원 접수·파출소 책상, 도우미 함수 `bev`·`outline`·`kc`), `interior_konbini.py`(진열대·카운터).
4. 예제 모양: `tiledata/jp-city/interior/examples/house-1f.json` + `house-2f.json`(**층 여럿 + 계단 links** 의 정본), `clinic.json`(공공), `konbini.json`(narrow), 표 `examples/places2.json` 한두 항목.
5. `tiledata/atlas-pick/modern-style-bible.md` §1·§2(팔레트·램프 단), §10(3/4 시점), **§11(실내 3/4)**, **§12-3(실내 실제 크기 표, 1칸 = 16px = 1m)**.
6. 실내 짜임 원칙: `/home/main/.claude/skills/interior-chipset-authoring/SKILL.md` §0, §0b, §0d, §0e.
7. 이미 있는 가구 목록: `src/assets/jpInteriorSpec.json` 의 `objects`(키 = id, w·h·up·kind·desc). **있는 것은 새로 그리지 말고 가져다 쓴다**(문 `door-western`·`door-side-sliding`·`door-open-western`, 창 `window-sash`, 시계 `wall-clock`, 에어컨, 화장실 `toilet`·`toilet-handwash`, 의자, 화분 `houseplant`, 자판기·벤치는 `pb-`·`cv-` 것 등).

### 그림 규칙
- **스크립트 손 도트**(Python + numpy + PIL). 생성 이미지·외부 그림 금지. **사람·얼굴·해골·인체 모형 그리지 않는다.** 글자·숫자·상표·로고 금지(칠판·게시판·시간표·간판도 색 덩이·선으로만).
- 색은 **modern3 램프 `K(램프, 단)` 만**(`yoru hodo conc tairu ita garasu kawara renga tekko ki mado kinari shiro aka daidai kii midori sora pinku soil yuka kokuban lino murasaki kon neonP neonC sumi`). 반투명 금지. 윤곽 `OL` 또는 재질 어두운 단. **빛 왼쪽 위**.
- **3/4 시점**: 수평 면(상판·좌판·뚜껑)이 위에서 보이고 + 남쪽 앞면. 벽 붙은 키 큰 가구는 윗면 T 4~6px + 앞 가장자리 하이라이트 1행 + 처마 그림자 2px + 들어간 앞면. 옆을 보는 의자의 남쪽 면은 옆모습(L자).
- 가구 윗면은 바닥보다 밝고 대비가 크다(바닥은 조용하게 4~5톤, 가구는 또렷하게). 윗면 가장자리 1px 밝은 테.
- 크기: §12-3 표(1칸 = 1m). 표에 없으면 같은 공식으로 계산해 docstring 에 적는다.
- 칸 종류(`kind`): `floor`(바닥에 놓음) · `wall`(북쪽 벽면 바로 아래 첫 바닥 줄에만 — 키 큰 가구·벽 붙이) · `hang`(벽면 윗줄에 거는 것: 칠판·게시판·창·시계) · `flat`(밟는 바닥 무늬: 매트·코트 선·점자 블록, 2층). `up`=발밑 위로 솟는 px. `walk`/`solid`=발밑 칸 통행.
- 메타(조수가 읽는다 — 한국어): `desc`(무엇 + 어느 방의 어디에·무엇 옆에·몇 개), `tags`(방·건물 이름 — 교실·교무실·보건실·체육관·역·사무실·우체국 …; **낱말 「계단」은 계단 가구 외에는 태그에 쓰지 않는다**), `place`, `pair`, `use`(sit·sleep·open·read·counter·walk·block …), `facing`(의자·소파는 4방향 따로 id `-s -n -e -w` — 쓰는 방향만 그려도 된다), `surface=True`(위에 탁상 물건을 올리는 가구).
- id 는 영어 소문자-하이픈, **네 블록의 id 머리**를 모든 가구·바닥·벽면·탁자·탁상 id 앞에 붙인다.
- 바닥·벽면은 `R.floor(...)`·`R.wall(...)` 로 등록(모양은 `interior_shell.py` — 벽면은 2줄, 위·아래 줄 명암 다름, 맨 아래 걸레받이).

### 예제 JSON (`tiledata/jp-city/interior/examples/<파일>.json`) — 도구 인자 그대로
키: `name` · `plan`(문자열 줄 배열, `#` 벽·천장, `.` 바닥 — 구조는 도구가 자동) · `floor` · `wall` · `zones`(방마다 바닥·벽면) · `objects`([{id,x,y}]) · `tables`([{style,x,y,w,h}]) · `goods`([{id,x,y}] 탁상 물건 — 그 칸 4층이 비어 있어야 한다) · `rooms`([{room,x0,y0,x1,y1}] — **모든 가구 좌표가 어느 방 사각형 안에 있어야 한다**, room 은 아래 roomKinds 키 또는 이미 있는 방 종류) · `start`([x,y] 걸음 칸) · `links`(층 이동: [{x,y,toMapId:"jp-city-<파일>",toX,toY,direction}]) · `exitWidth`(맨 아래 줄 출구 틈 폭, 기본 1) · `narrow`([{x0,y0,x1,y1,why}] 1칸이 맞는 곳) · `open`([{x0,y0,x1,y1,why}] 일부러 트인 바닥 — 체육관 코트·콘코스·옥상만) · `inner`(true = 위층·승강장·차내처럼 거리 문과 잇지 않는 맵: 맨 아래 줄을 전부 `#` 으로 막는다).
- **층이 여럿**이면 맵 하나 = 층 하나. 계단 x 를 위아래 층에서 맞추고, 올라가는 계단 발칸 → 위층 계단통 아랫줄 옆, 위층 계단통 아랫줄 → 아래층 계단 앞(house-1f/2f 그대로). 엘리베이터도 같은 방식(문 앞 칸에 links).
- 장소 표 `tiledata/jp-city/interior/examples/places3-<블록>.json`(목록):
  `{"file":"<주 맵 파일>","maps":["<1층>","<2층>",…],"placeId":"jp-city-<주 맵 파일>-<W>x<H>","name":"…","kind":"<건물 종류 id>","kindKo":"…","alias":["日本語","한국어","english"],"building":"jp_<건물>","roomKinds":{"<방 id>":["한국어 이름",["別名","별칭"]]},"rules":["배치 규칙 문장 여러 개 — 조수가 읽는다. 장소 id 를 쓰면 placeId 와 같아야 한다"]}`
  W×H 는 주 맵(첫 맵) 크기.

### 배치 규칙 (2묶음 관문 13회에서 배운 것 — 검사기가 대부분 잡는다)
1. **출입구** = 거리와 잇는 맵의 맨 아래 줄에 이어진 틈 **한 덩이**(나머지 맨 아래 칸은 막는다). 손님이 드나드는 건물(학교 현관·역·사무실 로비·우체국)은 2~4칸(`exitWidth` 같게), 사무 뒷문·작은 집은 1칸.
2. **주 동선은 2칸 폭** — 입구 → 창구·카운터 앞, 입구 → 계단·안쪽 방 문, 복도. 1칸 목은 직원 길·좌석 뒤 같은 곳만, `narrow` 에 이유와 함께 밝힌다.
3. 진열·책상 줄 사이 1칸 통로는 ① 2칸 동선에 붙고 ② 바로 남쪽 가구 윗부분(up≥16)이 덮지 않고 ③ 막다른 길 3칸 이하일 때만.
4. **창구·카운터·접수 앞 손님 자리 2줄**(바로 앞 한 줄 + 그 뒤 한 줄, 맨 아래 벽에 붙은 한 줄이면 안 된다).
5. **3×3 빈 바닥 없게**(검사기 `e3` = 0) — 공간이 남으면 맵이 큰 것이니 줄인다. 체육관 코트·콘코스·옥상처럼 원래 트인 곳만 `open` 으로 밝힌다.
6. 의자는 탁자·책상을 본다(서쪽 의자는 `-e`, 동쪽 의자는 `-w`, 책상 남쪽 의자는 `-n`). 교실 책상은 칠판(북쪽)을 본다.
7. 키 큰 가구는 윗줄을 덮는다 — 그 칸에 탁상 물건(goods)을 놓으면 「4층이 이미 찼다」로 실패. 키 큰 가구 바로 북쪽에 1줄 통로를 두지 않는다.
8. `wall` 종류는 바로 위가 북쪽 벽면이어야 한다. 세로 칸막이 틈은 3줄(셋째 줄에 옆문 `door-side-*`), 가로 칸막이 1칸 틈 = 문.
9. 방마다 목적이 보이게(실제 일본 학교·역·사무실의 가구·크기·배치). 같은 맵 안 방들이 같은 틀 반복이 아니게.

### 확인 순서 (매번 — 넘기기 전 경고 0)
1. `python3 scripts/content/jp-city/blocks/<블록>.py` → selftest 실패 0 + `tiledata/jp-city/blocks/<블록>/_all-x3.png`.
2. `scripts/content/jp-city/interior/categories.py` 의 **네 블록 칸**(`# [<블록> <머리>]` 줄과 `# (… 끝)` 줄 사이)에만 분류 줄 `('<분류 id>', '<한국어>', [<가구 id 전부>])` 를 넣는다. 가구 하나는 정확히 한 분류(바닥·벽면·탁자·탁상은 넣지 않는다 — 기존 줄 참고).
3. `python3 scripts/content/jp-city/bake_jp.py > /tmp/jpi-<블록>/bake.log 2>&1; tail -3 /tmp/jpi-<블록>/bake.log` — 번들(사양·시트)에 네 가구를 굽는다(수 분). 실패하면 로그의 assert 를 읽는다.
4. 검사기: `npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/jp-city/qa/check-interior-examples.mts --places tiledata/jp-city/interior/examples/places3-<블록>.json [--grid <파일>] 2>&1 | grep -v "public directory\|Instead of"` → 맵마다 **OK** 여야 한다(WARN·FAIL·SAME 0). `--grid <파일>` 은 칸 그림(. 걸음 # 막힘 x 병목 ^ 가려짐 ~ 윗부분이 덮는 칸).
5. 실제 지은 그림: `node scripts/content/jp-city/maps/interior.mjs --only <파일1>,<파일2>,… > /tmp/jpi-<블록>/int.log 2>&1` (층을 잇는 맵은 함께) → `verify-shots/jp-city/interior-<파일>-x2.png`. **이 그림이 감독·관문이 보는 그림이다.** 로그의 `"ok":true` 와 links `reached:true` 확인.
6. **PNG 읽기 규칙: 가로·세로 1000px 넘는 PNG 를 Read 하지 마라.** 600×400 이하로 잘라 `/tmp/jpi-<블록>/crop-*.png` 로 저장해 그 크롭만 Read 한다. 전체 Read 는 15번 이하. 긴 로그는 파일로 받고 tail·grep 만.
7. 기존 승인 그림(`verify-shots/jp-city/interior-clinic-x2.png`·`interior-konbini-x2.png` 크롭)과 같은 배율로 나란히 보고 윤곽·명암·크기·시점·빈 바닥을 비교한다. 최소 3회 고친다. 보고에 「잘 됐다」 대신 남은 약점을 정직하게.

### 금지·마무리
- 커밋하는 파일은 이것뿐: `scripts/content/jp-city/blocks/<블록>.py`, `tiledata/jp-city/blocks/<블록>/*.png`, `tiledata/jp-city/interior/examples/<네 예제>.json`, `tiledata/jp-city/interior/examples/places3-<블록>.json`, `scripts/content/jp-city/interior/categories.py`(네 칸만). **굽기가 만든 파일(src/**, public/**, pins.json, tiledata/jp-city/bake*, refs, verify-shots …)은 커밋하지 않는다** — 감독이 다시 굽는다.
- `ikit.py`·`preview.py`·검사기·다른 블록·`bake_jp.py` 코드는 고치지 않는다(틀에 버그·모자람이 있으면 최종 답에 적는다). `npm`·vitest·gates·typecheck·`git stash`·`git push`·`git reset --hard` 금지.
- 커밋: `git add <위 파일만>` → `git commit -m "feat(jp-city): …"` (끝 줄 `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`). 중간 커밋도 좋다.
- 최종 답(짧게): 만든 id 수와 분류, 예제 파일·크기, 검사기 출력 줄(맵마다 OK 줄 그대로), x2 그림 경로, 남은 약점.
