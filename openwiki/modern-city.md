# 현대 도시 · 도쿄풍 번들 타일셋 (modern_city)

modern-chipset 하네스가 합성한 도시(건물·도로·소품·차량)를 16px 칸으로 자른 번들 칩셋. 새 프로젝트가 처음부터 갖고, 기존 프로젝트는 로드할 때 심긴다.

## 식별자

| 항목 | 값 |
|---|---|
| 타일셋 id | `modern_city` |
| 텍스처 키 | `tex_modern_city` (id 는 `bundledEasyRpgTilesetId` 규칙 = 접두 `tex_` 제거와 같아 `bundledTilesetIdForAsset` 에 분기 없음) |
| 계열 | `oprn-modern` (라벨 "현대 도시(도트)", `src/project/tilesetFamily.ts`) |
| 이름 | 현대 도시 · 도쿄풍 (도트) |
| 조립 부품·참고문서 id 머리 | `mc-` (번들 소유) |

## 파일

- 정의 모듈 `src/project/defaults/modernCity.ts` — `createModernCityTileset`, `ensureModernCityTileset`, `ensureModernCityReferences`, `isModernCityTileset`.
- 시트 그림 `public/assets/modern-city/modern-city-chipset.png`, 시트 메타 `src/assets/modernCitySheet.json`(`count`, `tilesPerRow`), 정의 `src/assets/modernCityTileset.json` — 굽기 스크립트(`src/harnesses/modern-chipset/bake_tileset.py`)가 만든다.
- 참고문서 `src/assets/modernCityReferences.json` (`TilesetReferenceCategory[]`, 이미지 바이트 없음).
- 배선: `src/assets/bundled.ts`(항목·`bundledChipsetFrameCount`), `src/assets/bundledChipsetGeometry.ts`(열 수), `src/project/defaults/defaultAssets.ts`(`ensureBundledTilesets` 기존 사본 블록·`bundledEasyRpgTilesetBase`), `src/project/tilesetHarness/combinedTown.ts`(RM2k3 투명 칩 보정 제외), `test/bundledTilesetIdParity.test.ts`.

## 기존 프로젝트 갱신 규칙

칸 번호는 덧붙이기 전용이다(다시 구워도 앞 번호 불변, 새 칸은 끝). `ensureModernCityTileset`:

- 열 수가 같고 칸 수 <= 번들: 같은 시트의 옛 굽기 — 번들 소유 칸 표(`count`·`passability`·`priority`·`terrain`·`tileMeta`·`tileGroups`·`autotileGroups`·`animationStrips`)와 `mc-` 부품을 새 굽기로 바꾼다. 저자 부품(`mc-` 아님)·맵·저작 참고문서는 건드리지 않는다.
- 칸 수 > 번들(더 새 번들에서 저장): 줄이지 않는다.
- 열 수가 다름: 다른 시트로 보고 칸 표를 통째로 바꾼다.
- 변경 감지는 층·통행 요약과 표 길이로만 한다(키트 본문이 같은 개수로 바뀐 경우는 못 잡는다).

## 조수 정책 (2026-10-14, `src/ai/modernCityPolicy.ts`)

옛 PAW 전용 게이트(`modernTilesetPolicy.ts`)는 2026-10-07 저작권 정리로 지워졌다. 지금 길:

- **첫 승자 사슬 자리:** `plainTurn.ts` 의 시대 테마(전국→스팀펑크→SF→선사) → jp_city → 고딕 → 해적 → 하늘섬 → 캠퍼스 → **modern_city** → 버들항. 앞이 잡으면 보지 않는다. `routingAudit` 꼬리 「→ 도쿄풍 도시 맵 / 실내」, 노트는 `executionRoute.ts` 의 같은 순서 사슬(`formatModernCityNote`), 노출 도구 `MODERN_CITY_EXPOSED_TOOLS`.
- **잡는 경우는 셋뿐:** ① 대상(보는) 맵이 modern_city ② 칩셋 이름(`modern_city`·`oprn-modern`·「도쿄풍 도시 칩셋」) ③ 실내 요청이고 프로젝트가 modern_city 맵을 쓰면서 jp_city 맵은 안 쓸 때. 번들이라 모든 프로젝트에 있으므로 「현대 도시·번화가·편의점」 거리 낱말만으로는 잡지 않는다(jp_city 몫 — `jpCityPolicy` 는 보는 맵이 modern_city 면 거리 요청을 놓아 준다). 학교 낱말은 캠퍼스에 양보(`describesCampus`), SF·고딕 등은 사슬 앞에서 이긴다.
- 시스템 프롬프트 줄(`modernCityPromptLines`)은 범위에 modern_city 맵이 있을 때만 붙는다.
- 연기 시험: `npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/modern-city-int/qa/routing.mts`(사슬을 그대로 따라 11건).

## 거리 구성기 `compose_modern_city_street` (2026-10-14)

- 구성기 `src/project/modernCityStreetComposer.ts`(순수 함수), 도구 `src/editor/tools/modernCityTools.ts`. 맵 40×30~120×100, 권장 60×48.
- 계획: 가로 도로 1~3줄(높이/22)·세로 도로 1~2줄(폭 84 이상이면 2), 모두 12줄 단면 키트(`mc-street-ew-section`·`-ns-section`), 교차로 `mc-intersection-12x12`. 띠 높이 8~13을 씨앗으로 나누고, 마지막 도로 아래 남는 줄은 10~13이면 남향 건물 띠, 4~7이면 길가 녹지 띠(`roadsideVerge`: 9~14칸 필지마다 정원·카페 테라스·놀이터를 이웃끼리 다르게), 0(빈 보도가 맵 바닥)은 다른 나눔이 없을 때만.
- 건물: 가로 도로 첫 보도 줄을 «문 앞 접근칸 줄»로 삼아 키트(`mc-bld-*`)를 남향으로, 접근칸은 키트 `ai.access`. 이웃 같은 종류 금지·종류당 2채, 랜드마크(병원·백화점·호텔·경찰서·소방서·우체국·타워·학교)는 맵당 1채. 꼭 넣을 종류(편의점·사무·병원·카페·은행·아파트·로비형) 먼저, 손님이 고른 가게 순서는 씨앗으로 섞고, 띠 높이에 가까운 건물을 더 자주. 문 접근칸 ±1·아래 한 줄은 소품 금지(`keep`). 건물 뒤 빈 띠는 잔디 + 관목·침엽수.
- 공원(블록 셋 이상일 때 모든 띠의 넉넉한 블록 중 씨앗으로 하나): 잔디·벽돌 길·분수·벤치·공원 등·나무. 소품: 남쪽 보도 가로수·가로등 번갈아, 버스 정류장 하나, 북쪽 보도 둘째 줄 소화전·볼라드·화분, 세로 도로 보도 가로등·가로수, 교차로 남쪽 모서리 신호등, 지하철 입구 하나. 차: 가로 도로 차선마다 0~2대(교차로 2칸 안 금지, 북쪽 차선 동향).
- 도구는 시작 칸 → 모든 문 접근칸 도달·문 칸 막힘을 엔진 통행으로 다시 재고, 실패하면 맵을 안 바꾼다. 건물 이름표(`locations`, 태그 `modern-city-building`)에 문·접근칸·맞는 실내 방 구성(program)을 적는다.
- QA: `qa/compose-street.mts OUT.json [W H seed …]` → `qa/render_map.py OUT.json DIR`.
- **업무 지구 옵션 `district` (2026-10-24):** `landmark`(예: `tower10` — 가장 넓은 블록 왼쪽에 먼저 세움·공원 제외), `subwayExits`(1~4, 블록마다 5칸 틈을 비워 지하철 입구 키트 + 출구 번호 표지 `mc-prop-kr-exit-N`, 다른 블록 먼저), `korean:true`(점자 블록 줄 `mc-in-mci-tactile`·가로수 보호판·버스 쉘터·자전거 거치대·종류별 세로 간판 `mc-prop-kr-sign-*`). 결과 `subwayExits[{n,at,stair,step}]`·`propList`. 출구 번호 표지·세로 간판·보호판 그림은 `art_kr.py`/`bake_kr.py`(덧붙이기, 핀 `kr:<키트>:<x>,<y>`) — **3/4 관문 통과 전에는 굽지 않는다**(굽지 않은 키트는 구성기가 건너뛴다).
- **행인 `add_street_walkers` (2026-10-24, `src/editor/tools/streetWalkersTool.ts`):** 사람마다 `stops`(2~8칸, `waitSec`·`face`·`vanish`)를 주면 지형 BFS 로 반복 custom 경로를 짠다. `vanish` 칸(문·계단 그림, 막힌 칸)은 마지막 걸음 전에 통과를 켜고 들어가 투명해졌다가 돌아 나온다. 그림은 charset `selectionId`/query(사람 생성 없음). 이벤트 id 머리 `ev_walker_`, `replace` 는 같은 이름만 지운다. 걷는 사람 앞에서 차가 서고(`playSceneTransit` playerBlocksCell 에 보이는 자율 NPC 칸), NPC 는 차 몸 칸으로 안 들어간다(`canNpcMove` → `transitBlocksCell`).


## 거리 녹지 — 버들항 화풍 맞추기 (2026-10-14 quality-b, `scripts/content/modern-city-street/`)

- 코드 손 도트 `art_green.py`: 큰 가로수 키트 `mc-prop-keyaki-a`·`-b`(느티나무 3×4)·`mc-prop-ginkgo-big-a`(은행나무 가을 3×4)·`mc-prop-park-tree-a`(공원 큰 나무 4×5)·`mc-prop-azalea-a`·`-b`(철쭉 덤불 2×2), 잔디 그룹 `mc:lawn`(바탕 4·짙은 풀 덩이 2·토끼풀·민들레). 수관은 잎 덩이 합집합 + 흩뿌린 2~3화소 잎(좌상 빛, 명암 7단) + 덩이 사이 짙은 골 + 짙은 녹색 선택 윤곽(남색 잉크 아님) + 땅 그림자. 맨 아랫줄은 줄기 칸 막힘·그림자만 있는 칸 flat(통행, 사람 밑), 윗줄 ★.
- 팔레트 `palette.py` 에 램프 6개를 **끝에** 덧붙였다(lawn 7·canopy 7·grove 3·ginkgo 5·bark 5·azalea 5, 글자는 그리스 문자 — 앞 글자·색 불변). 녹색 계열은 같고 채도만 덜 눌렀다(SAT 0.55 → 0.72~0.8).
- 굽기 `bake_green.py`(덧붙이기 전용, 10743→10812칸, 소유 `tiledata/modern-city/street-green/baked.json`) — `bake_tileset.py` 가 실내 다음에 다시 부른다. 관문 `bake_green.py gate` → `object-gate review --batch tiledata/modern-city/street-green/_gate/items.jsonl`: 14/14 임시 통과(provisional, 프로필 미보정).
- 옛 칸을 제자리에서 다시 그리지 않은 이유: 나무·잔디·옥상은 사람이 고른 하네스 합격 PNG 를 자른 칸이고 576 키트 화소 재조립 대조가 그 PNG 를 기준으로 한다. 옥상은 건물 키트 259개(칸 7,313)에 박혀 있어 다시 그리면 대조가 깨지거나 칸이 수천 개 늘고, 오버레이로 덮으려 해도 지붕 바탕 칸이 난간과 칸 정렬이 안 맞아 얼룩 사각형만 생긴다 → 옥상은 남은 일.
- 거리 구성기: 잔디는 `mc:lawn` 을 칸 해시로 섞어 칠하고(옛 정의면 `mc:green`), 남쪽 보도·세로 도로 보도 가로수는 큰 가로수(줄기 = 맨 아래 보도 줄, 수관은 연석·차도 위), 건물 뒤 녹지는 열마다 큰 나무·철쭉 둘까지, 공원은 큰 나무 하나 + 잎 덩이 나무 + 철쭉. 키트가 없으면 옛 키트로 돌아간다.
- 지표(60×48 seed 17 장면): 칸당 고유색 중앙값 3→5·p90 9→11, 채도 0.38→0.41. 새 칸만: 중앙값 9·p90 11·채도 0.61(옛 나무·잔디 칸 5·7·0.45).

## 실내 (2026-10-14, `scripts/content/modern-city-int/`)

- 가구 64종·바닥 9·벽면 8·탁자 3·탁상 물건 7 — 코드 손 도트(`pieces.py`, `art_*.py`), object-gate 영수증(문 4종은 조립 방 `assembled.py`). 네 번 다시 그려도 못 넘은 14종은 `pieces.DROPPED`.
- 굽기 `bake_interior.py`(덧붙이기 전용, 시트 10179→10743칸, 칸 키 `tiledata/modern-city/pins.json`·소유 `interior/baked.json`) — `bake_tileset.py` 가 거리 굽기 끝에서 다시 부른다. 방 짓기 사양 `src/assets/modernCityRoomSpec.json`(`HAND_INTERIOR_SPECS.modern_city`), 방 구성 9개는 `extract.mts` 가 `interiorRoomTemplates.json` 에 넣는다(방 종류 14).
- 예제 9장 `examples.py --render` → `tiledata/modern-city/interior/examples/*.json`. 실내 60칸 넘는 한 방은 기둥·알코브로 꺾었다(ㅁ자 경고 0). `layout.ts` 의 `DOOR_OF` 에 병동·대기 복도(병원 문)·뒷방(철문)·회의실(유리문) 한 줄.
- 엔진 검사 `qa/check-rooms.mts`(평면·program 두 경로 18장, 엔진 BFS) · 변조 `qa/tamper.mts`(6종 코드+좌표) · 참고문서 `refs_interior.py` → 용도 `mc-interior`(문서 10·그림 20, `public/assets/modern-city-interior-references/`). `bake_refs.py` 가 끝에서 저장본(`tiledata/modern-city/interior/refs/category.json`)을 다시 붙인다.
- 문 이음 `link_modern_city_interior`(거리 문 ↔ 실내 출입구 틈 왕복, 막힌 문 칸에는 이벤트 없음).
- **나무 바닥 A안 (2026-10-20, 사용자 「나무 바닥이 좀 아쉽다」):** `art_shell.floor_wood_oak`·`floor_wood_dark` 색 규칙만 바꿨다(판 끝 자리·헤링본 짜임·`cols/rows/lay` 그대로 → `floorLayX`·`test/roomKit.test.ts` 값 불변).
  참나무: 판 사이 틈은 그 판보다 한 단만(예전엔 모든 4px 띠 밑줄이 가장 어두운 단 → 화소 31% 가 틈, 골덴 줄무늬), 판 끝 이음만 가장 어두운 단, 판 톤 8갈래 + 꿀색 판·끊긴 윗 빛·결·옹이·결 점. 짙은 마루: 붉은 rose 판 대신 갈색 호두(rose 1·wood 0·rose 2, 틈 rose 0) — 벽돌 벽과 갈린다.
  굽기는 **제자리** `rebake_wood_seat.py`(사양에 적힌 10240..10271 32칸에 그대로 붙이고 `pins.json`·`interior/baked.json` 의 옛 내용 해시 키를 새 키로 바꿔 적는다). `bake_interior.py` 로 구우면 내용 해시가 달라 끝에 덧붙고(옛 맵은 옛 그림) 시트가 이미 4608px 라 `assert rows*16 <= 4096` 에서 멈춘다.
  저장된 맵은 칸 번호가 같으므로 새 그림을 그대로 받는다(의도한 그림 교체). 관문: `tiledata/modern-city/interior/_gate_r15/` 바닥 주기 그림 2장 kind terrain — **object-gate PASS 3/4+style on profile `ee216f0de5822996` which is REJECTED (uncalibrated) — provisional, not a valid pass**(`object-gate check --context bundle` 은 거절). 굽기는 `bake_interior.gate` 와 같은 규칙으로 «미보정 임시통과»를 세고 굽는다.
  1회차(판 안 명암 3단·칸 정보량 낮음)는 화풍 불합격이라 결 점·옹이·끊긴 빛을 더해 2회차에 넘었다. 지금 그대로의 예전 바닥도 같은 프로필에서 화풍 불합격이었다.
- **앉는 기물 다시 그림(굽지 않음):** `art_seat.py` 가 나무·사무·카페 의자 네 방향과 금속 벤치를 같은 칸 크기로 다시 그렸다(호두 틀 + 세이지 방석으로 나무 바닥·탁자와 다른 단, 등받이 윗면, 판 밑 그늘). 관문 2회차 11장 통과 0·보류 2 — 옆·뒤를 보는 의자는 규칙상 자동 통과가 없다(`rules.ts HUMAN_DEFINED_SEAT_FACINGS`). 사람 승인 경로가 생기면 `rebake_wood_seat.py --seats`. 안락의자·3인 소파는 다시 그려도 나무 바닥 대비가 떨어져(47→27) 뺐다.
- **앉는 기물 3/4·품질 2차(2026-10-20, `seats34.py` · 굽기 `rebake_seats34.py`):** 19종(영화관·강당 3연석, 휠체어, 노래방 ㄱ자 소파, 판사석, 목욕 의자, 안락의자 4방향, 나무 의자 4방향, 카페·사무 의자 동서, 3인 소파 북향)을 기존 색·칸 그대로 다시 그렸다 — 큰 부분마다 윗면 띠(뒤 모서리 · 판 · 앞 모서리 빛) + 앞면 3행, 바깥 윤곽만 재질의 가장 어두운 단, 서향은 위치만 뒤집고 빛은 늘 왼쪽 위(`Side`). `art_seat.py` 의 같은 id 그림은 이것으로 대체된다. 관문: `mci-armchair`·`mci-bar-stool` 은 통과했지만, origin/main 에서 판정 프로필 ee216f0de5822996 가 다시 rejected(미보정)로 바뀌어 `rebake_seats34.py` 가 거절한다 — 아직 아무것도 굽지 않았다. 보정이 끝나면 `rebake_seats34.py <id>` 로 제자리에 굽는다(사양 칸 번호 불변). 동·서·북향 11종은 규칙상 보류(사람 승인 대기), 남향·무방향 7종은 화풍/3/4 불합격이라 굽지 않았다(그림 코드는 남아 있다). 목욕 의자를 굽게 되면 `r10/home.py bath_stool` 이 이 그림을 돌려주게 바꿔야 `rebake_inplace.py` 가 되돌리지 않는다.
- **앉는 기물 연구 2 — 사람 합격(2026-10-20, http://mdc-server:18301/seat-study-2.html):** 앉는 기물 89종(jp_city 57 · modern_city 25 · 손 도트 v5 7)을 두 기준작(손 도트 v5 `chair_S`, jp `hs-bench-row-s`)에 맞춰 RTP 규칙으로 다시 그렸고 사용자가 전부 합격(「의자들은 다 괜찮네 합격」, 그린 크기 그대로)시켰다. 정본 그림 `tiledata/seats34/study2/art/`, 사람 판정(화소 해시) `human-verdicts.json`, 그림 코드 `scripts/content/{jp-city/interior,modern-city-int,hand-interior}/seats_study2/`. modern_city 는 `seats34.py` 끝에서 이 그림이 `DRAW` 를 대체하고 `PENDING` 에서 빠진다(사람이 동·서·북향도 합격). jp_city 는 블록마다 `seat34.apply_study2(R)` 가 관문 pass 영수증이 있는 id 만 굽는 그림을 바꾼다. **사람 합격은 3/4 관문 영수증을 대신하지 않는다** — 프로필 1db03a95223e5b0b 가 rejected(미보정)라 영수증 0장, 아무것도 굽지 않았다. 목록·굽는 길 `tiledata/seats34/study2/needs-receipt.json`. 손 도트 v5 7종은 `candidates/*/w135-A` · `arena.py curule_seat_s2`(등록 안 함)로 남아 고르기(18302)+`build_tileset.py` 를 따로 거쳐야 한다.

- **3/4 다시 그림 r16 (2026-10-20, `scripts/content/modern-city-int/r16/`):** 감사(`~/claude-viz/interior-props-34-audit-1`)의 의자 밖 FAIL 234종을 4배로 다시 판정해
  진짜 121 · 거짓 113(`tiledata/modern-city/interior/r16/rejudge.json`, 항목마다 한 줄 근거)으로 나누고 진짜만 고쳤다.
  원본은 기물마다 행 문자열 격자 `interior/r16/grids/<id>.json`(`grid.py extract|check|show|colors`, 색은 램프+원래 실내 그림 색만).
  고친 방식: 윗면 4~6행(먼 가장자리 어둡게 → 앞 가장자리 밝게) + 처마 그늘 1행, 자리는 위쪽 빈 행이나 앞면의 반복 행 1~2개에서 얻는다 — 크기·칸·통행 불변.
  굽기는 **제자리** `r16/rebake.py [--check] [--only ids.json]`(사양 칸 번호에 붙이고 `pins.json`·`interior/baked.json` 키를 새 내용 해시로). 다른 기물과 같이 쓰는 칸을 혼자 바꾸면 멈춘다.
  `r10/rebake_inplace.py` 가 끝에서 r16 굽기를 다시 불러 코드 그림이 격자를 되돌리지 않게 한다.
  런타임 확인: `r16/qa_project.mts`(실조수 modern_city 저장본 + 예제 9장) → `npm run qa:runtime -- --scenario modern-interior-props --project …`(크로미움 백지면 `unshare -rn` 안에서).
  화풍 다시 그림 21종(`interior/r16/quality.json`): 3/4 합격·오판 319종을 루브릭(`~/claude-viz/interior-props-quality-rubric-1.json`)으로 훑어 「안 읽히는」 것만(바코드 옷걸이·십자 족자·무덤 같은 증인석 등) 같은 칸 안에서 새로 그렸다. 독립 Argon 재검수 30/30 통과.
  object-gate: `r16/gate_items.py` 로 내보내 `object-gate review --batch` — 프로필이 미보정(rejected)이라 영수증은 임시일 뿐 통과가 아니다.
  **관문 없이 머지된 뒤 재검수(2026-10-20):** #3080·#3083·#3086 은 유효 영수증 없이 머지됐다(`interior/r16/needs-receipt.json`, 관문 재보정 뒤 이 목록으로 다시 받는다).
  142종 전부를 독립 적대 판정자(Argon, 그린 이와 다름)가 3/4+루브릭 Q1~Q6 으로 다시 봤고 1차에 92종 FAIL(대부분 화풍: 큰 면 단색·부속마다 근흑 상자 윤곽·떠 있는 부품).
  FAIL 은 고쳐 다시 판정하기를 최대 9차까지 반복해 142/142 PASS(`interior/r16/rejudge2.json`, 기물마다 차수별 판정·근거). 작업자 절차 `interior/r16/WORKER2.md`.
  교훈: 「최소 수정(윗면만)」은 3/4 는 고쳐도 화풍 루브릭을 못 넘는다 — 처음부터 Q2/Q3/Q5(3단 명암·재료색 윤곽·재질 결)를 같이 고쳐야 한다.

## 공간 규모 규격 · 학생/직장인 하루 18곳 (2026-10-18, `src/editor/handInterior/venueScale.ts`·`dailyVenues.ts`)

- 사용자 「대형마트는 시발 너무 작다… 50x50 정도로」 → `VENUE_SCALE_CONTRACT` 가 program 마다 벽 포함 맵 크기를 정한다. XL 48~52×38~48(대형마트 50×46·백화점 48×38·체육관 46×34) · L 40~46×26~34(교사동 46×34·지하철역 46×32·오피스 46×32·강의동 42×30·센토 40×30·게임센터 40×28) · M 30~38×20~28(레스토랑 38×28·이자카야/학생회실 36×26·옥상 36×24·가정집 34×26·오피스텔/베이커리 32×24·32×22·편의점 30×22) · S 엘리베이터 24×16.
- `layout.ts` 는 규격이 있는 program(건물 id 또는 그 맵 key)의 배치 후보 중 규격 크기에 맞는 것을 고른다(작으면 칸당 3점, 크면 0.75점). 견본 방 크기는 위·아래 줄 너비 합 + 칸막이 + 바깥벽 = 규격이 되게 짰다. 백화점 청사진(`composeDepartmentStore`)도 48×38 바탕. 도구 설명(`build_hand_interior_room`)에 `venueScaleBrief()` 가 실린다.
- 의자 방향: 탁자 둘레 의자는 탁자를 본다 — 북쪽 `-s`·남쪽 `-n`·서쪽 `-e`·동쪽 `-w`(`mci-chair-office-*`·`mci-chair-wood-*`·`mci-armchair-*`·`mci-sofa-*`). `builder.ts faceSeatsToTables` 가 견본·조수·청사진 어느 길로 온 남향 좌석이든 붙은 탁자 쪽 그림으로 바꾼다. 체육관 골대는 동서 양 끝 `gym-hoop-e`·`gym-hoop-w` 한 쌍.
- 주차장 차는 새로 그리지 않고 거리 차량 `mc-veh-car-front-a-*`·`mc-veh-car-back-a-*` 칸을 그대로 쓴다(`park-car-*`). 통학 전동차는 modern_city 로 따로 짓지 않는다 — jp_city 손 도트 견본(`build_hand_interior_room({tileset:"jp_city", layout:{program:"train-car"}})`, 21×8 롱시트·우선석·출입문 둘·손잡이·봉)을 그대로 쓴다(2026-10-19 사용자 「전철은 기존에 만들던 게 있는데 그걸 그대로 쓰면 되는데」).

## 막힌 이웃 `variation.sealed` · 남녀 센토 · 옥상 (2026-10-25, 시타마치 VQA)

- `ModernProgramVariation.sealed: [[a,b],…]` — `layout.ts` 는 연결을 입구에서 인접 간선 BFS 로 짓는데, 이웃이라고 다 이어지면 안 되는 방이 있다(남탕↔여탕, 로비↔탕). `sealed` 쌍의 간선은 BFS 전에 빠진다. 문·트인 칸막이 어느 쪽도 그 사이에 생기지 않는다.
- `mc_sento` = 번대 로비(가운데 아래) → 남/여 탈의실(양옆, 옆문) → 남탕/여탕(각자) → 사우나(남)·노천탕(여). 로비↔탕·남↔여 쌍은 sealed. 앞 판은 탕 하나에 남녀가 섞여 검수자 둘이 짚었다.
- `mc_rooftop` = 콘크리트 데크 + 물탱크 기계실 + 사방 난간(남쪽은 출입구 틈). 데크 밖 «건물 밖» 칸(`modernCityRoomSpec.void`)은 저작자가 -1 로 비우고 `map.background.fromMap`(아래 거리 맵을 반 배율·안개)로 채우면 난간 너머로 동네가 보인다(시타마치 `buildRooftop`). 옥상 정원(마루)은 뺐다 — 옥상이 안뜰로 읽혔다.
- `mc_sento_machi`(2026-10-25 VQA r1) = `mc_sento` 에서 위 줄(사우나·노천탕)을 뺀 골목 목욕탕(번대 로비·남녀 탈의실·남녀 탕 홀, 40×20). `dailyVenues.ts machiSento()` 가 원본에서 파생한다(줄·above·left·sealed·hubs 에서 두 방을 뺀다) — 원본 센토 견본을 고치면 같이 바뀐다. 시타마치 VQA 에서 사우나(금속 벤치 줄)·실내 노천탕이 «이상한 욕조 방·빈 마루방»으로 읽혀 뺐다.
- `mc_rooftop` 데크는 가운데를 비운다 — 카페 탁자·의자 줄이 «옥상 카페·광장»으로 읽혀(VQA r1 둘 다) 벤치·화분만 난간 곁에 둔다.
- `variation.plainDoorways`(2026-10-25): 연결 칸에 문짝이 없는(`DOOR_OF` 에 문 종류가 없는) 방 사이는 문틀 없이 트인 통로로 낸다. 가정집·베이커리·센토가 켠다 — 트인 입구 옆에 문짝이 따로 붙어 보였다(VQA r1).
- 작은 사무소는 `mc_realty`(부동산 견본: 상담실·업무실·카운터 로비)를 쓴다. `mc_office`(대형 오피스 층, 엘리베이터·보안 게이트)는 상점가 진흥회 같은 동네 사무소로 쓰면 «회사 로비»로 읽혔다.
- 사무소는 `mc_office`(밴드 연습실이 붙는 `mc_council_room` 시드 4 대신).

## 실조수 시험에서 나온 결함 (2026-10-14, gpt-6.1-sol — gemini-3.8-flash 는 할당량 429)

- **거리를 로비로 덮음:** 배치 품질 권고(`src/ai/piAgent/layoutQuality.ts`)가 도로·교차로를 «빈 바닥 66%·빈 정사각형 12»로 세고, 칩셋에 방 사양이 있어 그 맵을 «실내»로 보고 `build_hand_interior_room replace:true` 를 시켰다 → 60×48 거리가 10×8 로비가 됐다.
  고침: 구성기 건물 이름표에 `composed-layout` 태그(권고에서 빠진다, `qa/compose-street.mts` 가 확인), 실내 권고 문장에 «거리·야외 맵이면 부르지 마라».
- **이은 실내를 다시 지으면 커밋 거부:** 문 맞춤(`fitDoorsToPlan`)이 v5 판타지 시트에서만 돌아, 거리와 이은 병동을 작게 다시 지으면 «transfer 목적지가 맵 경계 밖/벽»으로 두 번 거부 → 조수가 연결 이벤트를 지우다 멈췄다. 이제 모든 방 사양 칩셋에서 돈다(`qa/rebuild-linked.mts`).
- **빈 기본값 경고:** 스키마 빈 값(`plan:[]`·`exit:{room:""}`)만 보낸 호출에 «layout 이 plan·rooms 를 버렸다» 경고가 떠서 조수가 편의점을 다시 지으려 했다 — 빈 값은 알리지 않는다.
- 그 밖: 회의실 의자를 탁자 양옆에도, `mci-desk-pc` 의 짝이 빠진 `mci-chair-office-n` 을 가리키던 것 제거, 같은 종류 건물 이름에 번호(«편의점 2»).
- 남은 것: program 9개 중 6개가 배치 품질 기준(빈 바닥 ≤30%·대칭 ≤2.2)을 넘는다(병동 41%·편의점 41%·아파트 43%…) — 권고가 한 번 «방을 줄여라»를 시킨다. 예제 방을 더 촘촘히(또는 작게) 다시 짜는 일이 다음 순서.

## 예제 도시 맵 (60×60, 시드 1)

- 굽기: `python3 src/harnesses/modern-chipset/bake_map.py [--seed 1] [--publish]`. `compose_town.build()`의 합성 결과(건물 23·소품 257·차량)를 **키트 id + 원점**으로 바꿔 4층에 찍는다(땅 1층 · 도로 표시와 접지 그림자 2층 · 키트 3층 · 겹침 4층). compose_town·`town_lib.py` 는 고치지 않고, 굽는 동안 런타임 후킹(`ExactBuildings`)으로 시트에 구워진 벽/지붕 조합만 쓰게 한다(안 하면 건물 약 19/23 이 이름이 가까운 다른 키트로 대체된다 — 시트에 벽×지붕 조합이 없다).
- 산출: `tiledata/modern-city/map/modern-city-<seed>{,-plan,-report,-reach}.json`, `verify-shots/modern-city/{map,map-x2,ref,diff,reach}-<seed>.png`. `-plan.json` = 시작 위치·도로 격자·문 접근 칸·배치 목록(키트 id·원점·찍은 순서). 건물은 키트 그림과 화소 일치 23/23.
- 그림 비교(맵을 시트 칸만으로 다시 그림 vs 원본 합성, 사람·전선 뺌): 전체 화소 16.0% 다름 — 건물 칸 0.23% · 안 놓인 칸 2.3% · 소품 칸 42% · 차량 칸 54%. 소품·차량은 16px 칸에 앉히며 최대 8px 이동했고(건물은 처음부터 칸 정렬) 차 색 일부는 시트에 구워진 색으로 바뀌었다. 연석 주차 표시(ㄴ자 틱)는 칸이 없어 뺐다.
- 도달성: 시작 (20,12)에서 문 앞 접근 칸 54곳(중복 1칸 포함 55) 전부 닿는다 — python BFS(`collision.ts` 규칙 이식)와 `npx vite-node tiledata/modern-city/map/check-reach.mts 1`(저장소 `canMove`)이 같은 답(걸을 수 있는 1800칸 중 1760칸 도달, 나머지 40칸은 좌상단 공사 펜스 안쪽). 접근 칸을 막은 소품 5개는 한 칸 옮기고 2개는 뺐다.

## 참고문서 (번들 소유, AI-REFERENCE-CONTRACT 8항)

- 굽기: `python3 src/harnesses/modern-chipset/bake_refs.py` (bake_tileset → bake_map 다음). 출력 `src/assets/modernCityReferences.json`(6분류·49문서·33그림, 이미지 바이트 없음 — 경로만), `public/assets/modern-city-references/*.png`(긴 변 ≤820px·128색), `tiledata/modern-city/refs/*.md`(문서 사본)·`check-evidence.json`.
- 분류: `mc-start`(읽는 순서·층과 통행·실행 순서, 땅/표시/그림자 칸 사전) · `mc-assemble`(도로·건물·소품 조립 정답) · `mc-buildings`(건물 키트 32계열 문서) · `mc-props`(소품·차량 키트 사전) · `mc-example`(예제 도시 입력·배치 목록·네 층 전체 배열·그림) · `mc-errors`(자동 검사 범위·오류 코드·변조 7종·층 표기 전후).
- 문서의 키트 id·칸 번호·좌표는 전부 정의 JSON·키트 색인·예제 맵에서 읽은 값이다. 쓰기 전에 문서를 다시 파싱해 정의에 없는 키트 id·범위 밖 번호·키트 배열 불일치·층 배열과 맵의 불일치가 있으면 실패한다.
- 층 대조: `npx vite-node tiledata/modern-city/refs/layer-audit.mts` — tileMeta 의 passage/defaultLayer 와 엔진(`tileLayerPolicy`·`passabilityOf`·`mapUpperTileDepth`)을 9997칸 대조, 어긋남 0. 홈 레이어(위층 슬롯)·통행·그림 순서·투명 여부는 별개다(도로 표시·그림자는 홈 `upper`·통행 가능·캐릭터 아래, 예제는 2층에 둔다).
- 번들 소유 확인: `npx vite-node tiledata/modern-city/refs/verify-bundle.mts`(타일셋 정의가 문서를 들고 태어남·`ensureModernCityReferences` 가 빈 프로젝트를 채움·장소 스냅샷 4층이 예제 맵과 같음·그림 파일 존재).
- 알려진 한계: 시트에 벽×지붕 조합·T자/곡선/4차선 도로·연석 주차 틱 칸이 없다. 보도·연석 오토타일(`mc-sidewalk-curb`)은 공원·생울타리·횡단보도 이웃도 도로로 보고 연석을 세운다(공원 둘레는 낱칸). `readRegionReference` 는 1·3층만 돌려주므로 2·4층은 문서 `mc-example-layer*` 로 본다.

## 자동 검사 (구조·통행만)

- `python3 src/harnesses/modern-chipset/bake_map.py --check <맵.json>`(옆의 `-plan.json` 필요). 코드 12종: tile-out-of-range · layer-mismatch · building-in-lower-layer · overlay-in-base-layer · ground-in-object-layer · door-access-blocked · door-not-on-sidewalk · building-on-nonwalk · back-over-front · marking-in-intersection · tall-prop-on-road · curb-mismatch. 굽기는 같은 검사에서 오류가 하나라도 있으면 파일을 아무것도 쓰지 않는다.
- 보지 않는 것: 이벤트 실행·움직이는 차·행인·미적 품질·낮은 모델의 성공률. 변조 7종(실제 변조해 코드와 좌표를 검출)은 `tiledata/modern-city/refs/check-evidence.json`.

## 번들 장소

- 장소 id `modern-city-60x60`, 맵 id `modern-city-example`. `bake_map.py --publish`가 `public/assets/region-references/modern-city.{oprn.json,png}`, `src/project/regionReferences/modern-city.json`(스냅샷), `src/project/modernCityPlaceReferences.ts` 를 쓴다. 등록은 TS 두 군데: `regionReferences.ts`(import·`PLACE_REFERENCES` 펼침)·`regionReferenceSnapshots.ts`(`SNAPSHOT_FILES` 한 줄). 내려받기 `.oprn.json` 은 약 6.3MB(타일셋 메타 포함, 이미지 바이트 없음).

## 승인된 작은 지하 주차장 (2026-10-05)

`mc-parking-two-bays`는 14×7칸 고정 구역이다. 아래층 환경과 위층 차량을 함께 찍어야 한다.
`mc-parking` 참고문서에 전체 두 층 배열·칸 좌표·정상/오류 비교를 동봉했다.
등록 입구는 `modern-chipset publish-parking`, 정본 생성은 `save-parking-project`다.
6회차 선택 그림의 7필수조건/9축 PASS를 보존하며, 공용 칸은 9,998→10,037로 39개만 덧붙였다.
기존 칸 번호·화소 변경 0, 576키트 재조립 불일치 0. 기존 프로젝트에도 `ensureModernCityTileset`과
`ensureModernCityReferences`로 키트/학습 자료가 들어간다. 전체 시설은 이 고정 구역을 반복해서 만들지 않는다.

그룹의 lower/upper/mixed 설명 정정도 같은 칸 수의 기존 프로젝트에 전달되도록
번들 갱신 서명에 그룹 id·defaultLayer·layerHome을 포함한다. 주차장 정본에서 실제로
lower→mixed 갱신을 저장·재로드했다. 개별 칸의 통행/우선순위와 맵 배열은 바뀌지 않는다.

### 12면 확장 실험

같은 승인 칩으로 416×288px(두 면 표본의 4.78배), 두 차로/연결로/12면/차량6대를 조립했다.
공용 `mc-parking`에 전체 배열·조립 규칙·실험 이미지·누락 소재를 추가했다. 독립 시각 판정은
조립 PASS, 시설 INCOMPLETE다. 새 기둥·천장 조명·벽/출입부 키트가 갖춰지기 전에는 이 그림을 완성 시설의 근거로 쓰지 않는다.

## 실시간 주행·교차로 90° 회전 차량 및 AI 조수 자동 배선 (2026-10-17)

- `compose_modern_city_street`(`src/project/modernCityStreetComposer.ts`, `src/editor/tools/modernCityTools.ts`)는 도로 한가운데에 정지 차량 타일을 박는 대신, 가로·세로 아스팔트 차도(6칸 폭)를 따라 달리는 직진 노선·교차로 90° 좌/우회전 노선·남쪽 보도 버스 정류장(`mc-prop-busstop-a`) 정차 시내버스 노선을 `map.transit`으로 자동 생성한다.
- `src/project/mapTransit.ts`는 `MODERN_CITY_TRANSIT_VEHICLES`(`mc-veh-police-a`, `mc-veh-taxi-b`, `mc-veh-car2-c-red`, `mc-veh-sedan-a-navy`, `mc-veh-bus-a`, `mc-veh-van-a`, `mc-veh-truck-a`, `mc-veh-ambulance-a`, `mc-veh-firetruck-b` 등 14종)와 교차로 90° 직교 코너 방향지시등(`transitCornerBlinker`: 회전 5칸 전부터 `blinker` 점멸 + 코너에서 `right`/`left` ↔ `up`/`down` 직교 전환)을 제공한다.
- 차량 그림은 `scripts/content/modern-city/vehicles/`의 도트 생성기 하나가 네 방향(동 `right`·서 `left`·북 `up`·남 `down`)을 같은 색 램프·같은 1px 외곽선·같은 차체 구획(트렁크·뒷유리·지붕·앞유리·보닛·얼굴)으로 **1:1 원본 해상도**로 그려 `public/assets/modern-city/vehicles/<id>.png`에 굽는다(늘이거나 줄이지 않는다). 크기는 동서 `L·16×32` ↔ 남북 `32×L·16`(승용·밴 L=3, 트럭·구급차·소방차 L=4, 버스 L=5)이라 90° 회전해도 크기가 그대로다. 시트 열은 기본·바퀴 `_0.._3`·브레이크등 `_brake`·방향지시등 `_sigL`/`_sigR`·버스 문 열림 `_open`이고, `src/player/playSceneTransit.ts`가 `blinker`(0.4초 점멸)·정지(브레이크)·주행 바퀴 단계에 따라 고른다.
- AI 조수와 「바로 깔기」(`stampPlanner.ts`, `stampEffect.ts`)는 `set_street_traffic({ mapId, density, includeTurns: true, includeBus: true })`(`src/editor/tools/transitTools.ts`) 한 번으로 `modern_city`·`jp_city` 맵의 차도와 교차로를 자동 감지해 주행·회전 차량을 배치한다.
