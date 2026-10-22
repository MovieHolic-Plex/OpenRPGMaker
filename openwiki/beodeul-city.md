# 버들항 v6·v7 — 로마풍 항구 도시를 편집기 맵·공용 타일셋으로 (beodeul_city)

## 출처 정정 (2026-10-22) — RTP 파생 칸은 크레딧, 나무는 다시 그렸다

버들항 v6 는 「손 도트 원본」만으로 이루어진 시트가 아니다. 파이프라인(`scripts/content/lib/city_v6/` 의 city6·terrain·pz·pn·pj·pk)이
`assets/jungle-chipset-v6.png`(옛 숲마을 시트를 다시 칠한 것)에서 벽돌·기와·판자·포석길·광장·흙·나무를 잘라 썼다.
- **EasyRPG RTP retro_Exterior(CC BY 4.0) 파생**은 `beodeul_city` 779칸(옛 784칸 중 jungle 땅 칸 5칸은 새 땅 그림으로 바뀌었다), architecture 94, forms 86, reviewed 54칸이다. 길 오토타일 16변형, 광장, 벽돌, 기와, 판자가 여기에 든다.
  크레딧은 `public/assets/ATTRIBUTION.md` 의 `rtp-derived-sheets` 목록에 있다. 굽기 스크립트는 `scripts/content/rtp-attribution/rtp_check.py` 의 `require_credit` 를 부른다.
  목록에 없는 시트에 RTP 화소가 들어가면 굽기가 멈춘다. 새 버들항 시트를 만들면 목록에 한 줄을 더한다.
- **RTP 가 아니고 출처가 불명확한 것**은 활엽수 다섯(oakA·oakB·bushC·bushD·bushE → `bd-tree-*`), 수관·밑동, `beodeul_ground` 나무 칸, `beodeul_warm_trees`, `beodeul_nature` 활엽 수관 윤곽,
  jungle 땅 칸 7·129·160·302·363·365·393·394·423(`lawn16.png` 포함)이다. 숲마을의 Tibo 편집 식생에서 나왔다. 2026-10-22 에 새 손 도트로 칸 번호를 지키며 제자리 교체했다.
  자세한 감사 결과는 `openwiki/copyright-purge.md` 「정정 (2026-10-22)」에 있다.
- **다시 그린 그림의 원본**은 `scripts/content/beodeul-redraw/` 이다. `draw_trees_a.py`(oakA 64×80·oakB 48×64), `draw_trees_b.py`(bushC·bushE 32×32, bushD 48×48),
  `draw_ground_c.py`(땅 363·365·393·394·423, RTP 풀·흙 칸 2502·23169 를 결로 쓴다)가 `art/` 에 쓴다. 시트에 옮긴 자리는 `placements/city.json`(칸·디자인·틴트·뒤집기·어긋남)이다.
  옮기기는 옛 나무를 정확 화소 대조로 찾아 같은 자리·틴트(orig·tint2·tint3·warm-*)·뒤집기의 새 그림으로 바꾼다. **키트 단위로 조립해서**(아래·위 층 겹쳐) 찾아야 한다 —
  시트의 칸은 키트 안에서 이웃이 아니라서 칸 하나씩 찾으면 이웃 칸과 다른 나무로 맞춰져 수관이 칸 경계에서 잘린다(2026-10-22 실측: river-town 윗줄 나무 왼쪽이 세로로 잘림).
- 이 옮기기 도구는 옛 그림과 대조해야 해서 저장소에 없다(옛 그림을 다시 들이지 않는다). 새 그림을 고치면 `beodeul-redraw/*.py` 를 다시 돌리고, 시트는 지금 그림에서 그 자리만 다시 칠한다.
- `append-beodeul-forest-canopy.py` 는 수관 카탈로그(forestCanopy)가 있으면 **제자리 굽기**가 기본이다. 새 수관 타일을 옛 칸 번호에 헝가리안 배정으로 다시 앉히고,
  칸이 모자라면 가장 비슷한 타일끼리 합친다(2026-10-22: 1961종 → 1942칸, 저장된 맵 자리 12902/13407 이 같은 그림). `beodeul_nature` 는 `ensureBundledTilesets` 가
  기존 프로젝트의 칸 수를 늘리지 않으므로 시트를 늘리지 않는다. 번호를 처음부터 다시 매기려면 `--renumber`(저장된 맵의 숲 칸이 바뀐다).
- **여러 그루가 겹친 묶음은 옮기지 말고 다시 조립한다.** `beodeul_ground` 숲 깊이 4종(woodland north·north-open·west·east)은 나무 본체 세 장
  (`tiledata/beodeul-ground/tree-studies/current-<id>-body.png`)을 카탈로그 `anchors` 자리(`pixelX-8, pixelY`)에 발 순서로 겹친 것이다(HEAD 에서 화소 일치 확인).
  화소 옮기기로 바꾸면 가려진 옛 줄기가 기둥으로 남고 수관이 떠서(2026-10-22 VQA r5 반려) 다음 순서로 다시 만든다:
  `node scripts/content/beodeul-tree-studies.mjs`(새 도시 키트 → 본체·연구 그림) → `node scripts/content/beodeul-tree-palette-studies.mjs` →
  `python3 scripts/content/beodeul-redraw/rebuild_woodland.py`(woodland PNG + ground 시트 칸) → `python3 scripts/content/build-beodeul-warm-trees.py`.
  두 mjs 는 `verify-shots/beodeul-tree-variants`·`beodeul-tree-palette` 폴더가 있어야 끝까지 돈다.
- 따뜻한 황록(warm)은 사용자가 옛 나무에서 고른 **모습**이다. 새 색에 옛 공식(R+24·G−5·B−13)을 그대로 쓰면 겨자색이 되어서,
  `tree-palette-studies/warm-redrawn-lookup.json`(값 구간별 색조·채도·명도 목표를 옛 승인 치환표에서 잰 것)을 palette 스크립트가 먼저 쓴다.
  `build-beodeul-warm-trees.py` 는 기존 카탈로그의 칸 번호를 지킨다(빈 칸이 된 자리는 빈 칸으로 두고, 새로 그림이 생긴 칸만 뒤에 붙인다).
- 나무·덤불 키트의 그림자(`beodeul_nature` shadows)는 키트 알파에서 잰다. 나무 모양이 바뀌면 옛 그림자가 수관 옆 초승달로 남는다(tool-village 40곳, VQA r6 반려).
  `python3 scripts/content/beodeul-redraw/reshadow_trees.py` 가 `build-beodeul-nature.py` 의 `shadow_for()` 로 새 그림자를 같은 칸에 다시 칠한다(여러 키트가 쓰는 칸은 교집합, 나무 아닌 키트와 나눠 쓰는 5칸은 그대로).
- **숲 색 (2026-10-22 후속, 「숲이 바닥 풀과 안 갈린다」)**: 잎 색 단의 정본은 `beodeul-redraw/palette.json` 의 `leaf_ramps` 하나다
  (`append-beodeul-forest-canopy.py` 의 `RAMP` 와 `draw_trees_b.py` 가 이 파일을 읽는다). 옛 oak 단의 넷째 단 (110,160,58) 이 잔디 737 (110,153,67) 과 같은 색이라
  나무가 풀에 묻혔다. oak·elm·lime 을 L* 9~48 의 짙은 몸통(그늘은 청록, 빛 쪽은 황록으로 색조를 돌림) + 밝은 햇빛 단(L*≈66~72)으로 다시 잡았다.
  첫 판(색조를 덜 돌린 차가운 단)은 object-gate 화풍 판정자가 원본 그림(art/)을 「평면 채움·단 대비 약함」으로 봐서 단 사이 색조·밝기 간격을 넓혔다.
  Opus 적대 VQA r1·r2 PASS(`harness-data/object-gate/vqa/beodeul-forest-colour/`), 3/4 관문 7/7, 화풍은 조언 FAIL·REFER 를 위임 허용으로 기록(프로필 미보정). 모양·칸 번호는 그대로다.
  색 단을 바꾸면 `bash scripts/content/beodeul-redraw/rebuild_colours.sh` 하나로 다시 칠한다 — 순서: restyle(자기 칸) → `recolour_city_trees.py`(restyle 밖에 놓인 나무 칸 873개,
  orig·tint2·tint3 를 단별 Lab 차로 따라 옮김, 지금 칠한 단은 `art/city_tree_palettes.json`) → 수관 → 나무 연구 → `warm_lookup.py`(따뜻한 황록은 승인 당시 단별 Lab 색조를 지킨다) →
  팔레트 연구 → woodland → warm. 대비는 `measure_forest_contrast.py`(잔디와 ΔE<12 인 잎 화소 비율: #3223 11~18% → 0~7%),
  옛 계보 재유입은 `old_lineage_check.py`(옛 그림은 git 이력에서만 읽는다, 0 이어야 한다). 비교 그림 http://mdc-server:18301/beodeul-forest-colour.html.
  참고문서 그림(`*-native.png`·농장 장면·variants render)은 다시 굽지 않았다 — 옛 #3223 색으로 남아 있다.
- `build-beodeul-ground.py` 는 낡았다 — 돌리면 ground 시트를 112칸으로 다시 만들고 manifest 5천 줄을 지운다. 나중 덧붙이기 스크립트들이 늘린 시트를 되살리지 못하니 돌리지 마라.
- `tiledata/beodeul-variants/` 의 만들기 스크립트(`_lib-5/bd5.py`)는 옛 워크트리 경로를 박아 두었고, 고쳐 돌려도 지금 코드로는 부품·바닥이 달라진다(구멍).
  그래서 `deep-forest-path`·`wheat-roman-road` 의 `render-1x.png` 는 화소 옮기기 뒤 남은 8×8 대조 칸 19곳을 바로 위 8px 로 덮었다. 참고 그림일 뿐 맵 데이터가 아니다.

## 2026-10-05 건물 반려와 사람의 허용/거절 대기열

사용자는 아래 `beodeul_forms`의 ㄱ자집·여관·대장간·창고 4종을 반려했다. 검사 통과를 미적 승인으로 쓰지 않는다. `beodeulForms.ts`는 새/기존 공용 선택 목록에서 이 4종의 본체·그림자·기초 키트를 제거하며, 기존 저장 지도의 칸·그림·통행은 보존한다. 관련 공용 참고문서는 반려를 명시한 과거 기록이다. 긴 민가와 좁은 이층집의 키트만 남긴다.

사용자가 새 지붕·창문·벽 질감으로 10종 저작과 개별 허용/거절을 요청했다. [beodeul-building-review](harnesses/beodeul-building-review.md) 하네스는 원본 도트 부품과 명시한 좌표로 비공개 후보를 만들고, 독립적인 질감·구조 Visual QA 및 숨긴 반려 표본 검사에 모두 통과한 그림만 공개한다. `http://mdc-server:18317/`에서 갤러리·고정 메모/결정 패널로 검수하고 확대/격자/잔디·기존 집/나무와 비교한다. 새 형태 필터 `?ui=3&new=1`도 제공한다. round 3은 타 게임의 시설 표식·실루엣 원리를 조사해 용도별 간판과 지붕 색·높이·몸체가 다른 10종을 추가하며, 기존 10종과 인간 선택은 보존한다. 결정/메모는 저장소 밖 SQLite에 PNG 해시와 함께 저장한다. 미선택·거절은 다운로드 팩에서 제외한다. 새 후보는 사람 선택 전까지 공용 기본값이나 정본 마을에 넣지 않는다. 원본 시트 보정 계약은 기존 beodeul-architecture 경로를 따른다.

2026-09-28. Python 손 도트 합성 그림이던 버들항 v6(100×100, 16px, 세 단)을 **그림 그대로** 편집 가능한 맵과 공용 번들 타일셋으로 옮겼다.
조수(에디터 AI)가 이 타일셋의 참고문서만 보고 「버들항 비슷한 도시」를 깔 수 있는지도 실제 모델로 시험했다(아래 「조수 시험」).
2026-09-29 라운드 2(v7): 오토타일·새 키트·원본과 다른 예시 배치 둘·배치 자를 더하고 조수를 「원본 복제 금지」 과제로 다시 시험했다(아래 「라운드 2」).
같은 날 라운드 3(v8): 「만들다 만」 결과를 고치려고 블록 키트 41종·길 위계·작업 순서·빈 바닥 자를 더했다(아래 「라운드 3」).

2026-10-04 집 출입 실모델 시험: 실제 편집기 조수가 `stamp_object`의 문 좌표 → `build_hand_interior_room`의 별도 실내 → `create_transfer_pair`의 양방향 출입을 저작했다. SQLite 저장·닫기·재로드 후 전용 `player.html`에서 시작점부터 걸어 입장·실내 이동·퇴장과 착지 후 40프레임 유지까지 5비트 전부 통과했다. 참고 이미지 조회에서 선택 필드 `offset:0`을 거부하던 도구 오류를 수정한 뒤 재실행한 결과다. 한 채에 대한 시험이며 모든 키트의 출입을 보증하지 않는다. 정본 id·폴더·해시·실제 스크린샷은 `verify-shots/assistant-house-entry/README.md`, 조수 호출 원문은 `verify-shots/assistant-beodeul-village/door-entry-fixed/e7d2-house-entry/`.

같은 날 사용자가 직접 도트로 문 열림을 그려 GIF로 보여 달라고 요청했다. `scripts/content/build-beodeul-door.py`가 살림집 원본 문(5743/2333)과 같은 문틀에 왼쪽 경첩·안쪽 열림 16×32 8단계를 찍는다. 공용 `beodeul_door`/`tex_beodeul_door` 시트(8열·16칸), 기본 프로젝트 배선과 기존 프로젝트 참고문서 보충은 `defaults/beodeulDoor.ts`/`defaultAssets.ts`; 참고문서 원본 `tiledata/beodeul-door/README.md` → `prepare-beodeul-door-references.mjs` → `beodeulDoorReferences.json`. GIF는 자산 시안이며 기존 출입 이벤트 재생을 연결하지 않았다. 시안 `public/assets/beodeul-door/house-door.gif`, 확대 `door-detail.gif`. 저장·재로드 및 새/기존 프로젝트 등록 근거 `verify-shots/beodeul-door/storage-proof.json`.

후속 공용 적용(2026-10-04): `apply_beodeul_door_animation({mapId,eventId,frameMs?})`을 조수 레지스트리와 안내에 등록했다.
같은 살림집 문 전용이며 시트 16칸을 현 칩셋에 이식한다. 열기 뒤 원래 transfer, 실내 조건부 auto 이벤트가 야외 문을 복원하고 귀환 뒤 야외 auto 이벤트가 닫기 6→0을 맡는다.
일반 맵 이벤트는 transfer에서 끝나므로 뒤에 명령을 붙이는 초안을 수정했다. SQLite revision 4 저장·재로드, 반복 적용 불변, 실제 게임 렌더 0→7→0과 출입 5비트 확인은 `verify-shots/beodeul-door/applied/README.md`.
밝은 잔디 737 원본을 유지하는 접지·꾸밈 공용팩 `beodeul_ground`(48칸, 15레시피)을 추가했다.
`dress_beodeul_ground({mapId,style:"living"|"natural",seed?})`가 2층 그림자·낙엽·흙, 4층 기초·밑동·풀/꽃·살림 소품을 덧그린다.
집 h101 기초의 벽 줄은 ★로 원래 벽 통행을 따르고 문 열은 완전 투명이다. 수관 3×3 나무 두 종류는 밑동, 기존 줄기 3×4 나무는 아래층 그림자를 보강한다.
다른 집에는 전용 기초를 강제하지 않고 집 곁 소품만 배치한다. 정확한 범위/전체 배열/정상·오류 그림은 `tiledata/beodeul-ground/README.md`와 `CATALOG.md`.
공용 그림·정의·용도 `beodeul-ground-dressing`은 새/기존 프로젝트 양쪽에 등록한다. 채팅/Pi 공통 정책은 `promptPolicies.ts`.
`author_beodeul_town`은 river/coast/city 완성 뒤 같은 도구로 마감하고, desert/snow/swamp는 건너뛴다. 재시공 때 이전 이 팩의 덧그림만 제거하고 다시 마감한다.
기존 맵 꾸미기에는 재시공하지 않는다. 실제 조수가 MD 전 페이지와 이미지 2장을 읽고 적용한 후 SQLite revision 5로 저장·재로드했고 키트 출처·반복 메타데이터 보충 후 revision 6을 재로드했다(맵/문 동일).
기초/뿌리 범위와 통행 보존, 실제 플레이 근거: `verify-shots/beodeul-ground/README.md`.

### 나무 연결 보정과 집 5채 작은 마을 (2026-10-04 후속)

첫 접지 판은 3×3 수관 마지막 줄의 투명 여백과 다음 줄 밑동 사이가 끊겨 보였다.
`bdg-tree-neck`을 source 41에 추가해 수관 마지막 행 가운데에 좁은 줄기와 잎을 겹친다.
기존 source 0~40은 유지하며 현재 팩은 48칸 슬롯·42개 그림·16레시피다. 연결 칸은 ★로 원래 수관 통행을 따른다.
`dress_beodeul_ground`는 이미 꾸민 맵에서도 빠진 밑동·연결만 보충하고 다른 꾸밈을 중복하지 않는다.

### 마을마다 다르게 (2026-10-22)

사용자 지적 「마을 만들어 달라 하면 다 비슷하게 만들어 버리는 게 충격」. 원인 셋(조수 능력 루프 1 의 마을 15장 중 10장이 같은 그림):
1. `houseCount` 모드(`beodeulSmallVillage.ts`)가 **고정 배치**였다 — 집 좌표·길·우물이 상수라 seed 를 바꿔도 같은 세 집. 경로 메모와
   `BEODEUL_GROUND_POLICY_LINE` 이 「작은 마을 = houseCount 40×30」을 시켜 「작은 마을」 요청이 전부 여기로 갔다.
2. 모델이 매번 `seed: 7` 을 보냈다(도구 설명이 「생략하면 7」, 메모가 seed 를 인자 예시에 넣음). 같은 선택 + 같은 seed = 같은 마을.
3. 의도 선언 「새 맵이면 이 크기를 그대로 써라」가 작은 마을을 모두 44×28 로 묶었다. 집은 강가·포구 모두 붉은 기와(CITY_HOUSES)뿐.

고친 것(실험 H7 — AI 는 이름 붙은 선택지, 함수가 조화):
- `houseCount` 는 이제 theme 마을(`buildBeodeulVillage`)의 **살림집 상한**이다. 크기를 생략하면 40×32~44×36. 옛 고정 배치는
  `church:true`(예제 마을+교회, 공동마당 예제의 시작점)에만 남는다.
- `roofs`(river·coast): `red` 붉은 기와 · `slate` 청회색 · `moss` 이끼 초가·너와 · `log` 통나무. 사람이 허용한 건물(`bd-house-rv-*`)에서
  살림집만 골라 주색 80%·둘째(돌벽 작은 집) 20%, 앵커(여관 등)는 강조색으로 남는다. 허용 건물은 그림자(2층)·기초(4층)를 같은 원점에
  모든 키트를 찍은 뒤 빈 칸에만 놓는다. 문은 두 칸 높이라 아랫칸 기준으로 맞춘다. 팔레트 집은 키가 커 좁은 띠에 안 들어가면
  같은 자리에서 더 낮은 집을 한 번 더 본다(붉은 기와 기본 마을의 난수열은 그대로).
- `water`(river 만): `river` 강과 다리 · `none` 강 없는 숲 빈터·언덕·성벽 안 마을(큰길이 가로지르고 일터는 타작마당). 생략하면 seed 로 셋에 하나꼴 none,
  riverbank 형태는 늘 river(생략 시 none 확률 0.45). 루프 1 의 숲속·산골·장터·성벽 마을이 모두 「세로 강 + 가운데 다리」 같은 뼈대였다.
- `terrain: "highland"`(river, 요청할 때만): 큰길을 맵 아래쪽(H×0.66)으로 내리고 7칸 간격 등고선 세 단. 세 단째는 오를 길 없이 산 숲(`summit`)으로 덮는다.
  새 맵 높이는 46 이상. 독립 검수 「산골 마을인데 산이 없다」(terraces 두 단은 숲속 마을과 같은 뼈대였다).
- `woods: "dense"`: 숲 덩이 목표 50%·씨앗 길에서 3칸·덩이 반지름 7~14, 밭 둘까지 — 숲속 빈터 마을. 「숲속 마을이 트인 풀밭」 지적.
- 단의 동서 끝(남향 절벽 면만 그리므로 1px 선)은 그 위 두 줄에 숲을 둘러 덮고, 160칸 미만 대지 조각은 아랫단으로 내린다.
- 포구 길가 마을의 작은 부두는 잔교 몸통(`jetty-stem`)을 쓴다 — `jetty-west` 맨 윗줄 뒤가 물빛이라 길 아래 풀 위에서 검은 네모로 보였다.
- 성벽 마을: `walls:true`(또는 이름에 성벽·성곽·성문·요새) — 아래 「마을 성벽」 절. 예전의 「성벽 그림이 없다」 안내는 지웠다.
- seed 를 생략하면 `defaultTownSeed`(시스템 설정의 무작위 오프닝 id·맵 목록·이름의 해시) — 같은 프로젝트 상태면 같은 값, 프로젝트나 맵이
  다르면 다른 값. form·terrain·roofs 를 생략하면 그 seed 로 고른다. 결과 `data.seed`·`data.roofs` 로 재현한다.
- 경로 메모(`beodeulTownRoute.ts`)는 「마을의 정체 한 줄 → theme·form·terrain·roofs·forestType·크기」, 요청이 말하지 않은 선택과 seed 는 보내지 않기.
- 작은 포구에서 생선 시장 좌판이 발(막힌 줄)을 물에 둬 매번 「찍기 실패」하던 것을 자리 고르기에서 거른다(`feetOnWater`).
프로브: `bun scripts/qa/beodeul-village-forms-probe.mts --cases river:scatter:flat:5:42x32:moss:4` (6·7·8·9번째 칸 = roofs·houseCount·water·woods).
결과·전후 비교: http://mdc-server:18301/village-diversity-1.html

공용 참고문서에 `SMALL-VILLAGE.md`의 집 전체 배열과 `small-village-example.json`의 네 층 전체 배열,
실제 표본 그림을 추가했다. 생성은 기본 ground 스크립트 뒤 `bun scripts/content/prepare-beodeul-small-village-references.mts`;
기본 참고문서 재생성도 이미 있는 작은 마을 자료를 보존한다. 용도는 현재 MD 4개·이미지 3개이며 새/기존 프로젝트 공통이다.
실제 편집기 조수가 기존 두 나무를 보정하고 ‘버들쉼터’ 집 5채를 만든 뒤 화면을 보며 녹지를 보강했다.
SQLite revision 7 저장·재로드와 전용 플레이어 8비트(모든 집 문 앞 도보 이동·우물 복귀)의 근거는
`verify-shots/beodeul-small-village/README.md`. 기존 문 이벤트·실내·통행은 보존됐다.

## 마을 성벽 bd-wall (2026-10-22, 3판) — 3/4 성벽 길·성문루·망루·계단·쪽문, 눈·사막 변형, 칸 28,544~29,567

1판(#3250, 88조각, 앞면 두 줄)은 사용자 반려(「너무 허접하다, 3/4 가 적용 안 된 것 같다」, 「애들 장난감 같다」). 3판은 처음부터 다시 그렸다.

- **그림**: `scripts/content/beodeul-wall/wall_art.py` — 규칙 함수가 점을 찍는 코드 손 도트(생성 이미지 없음). 기본 296조각 + 눈 덮인 판 `snow:*` + 사막 사암 판 `desert:*`
  (같은 그림을 색 규칙으로 옮긴다: 사막 = 사암 램프·마른 풀, 눈 = 윗면 판석·톱니 윗면·내민 턱에 눈·고드름, 이끼는 눈 덩이). 색은 모두 버들항 시트 앞 칸에 있는 값 —
  `bake_wall.py` 가 조각마다 시트 팔레트 밖 색이 있으면 굽지 않는다(r8 에 넣은 잠금 검사). 빛은 왼쪽 위.
- **기하(한 칸 16px)**: 가로 성벽(북·남) = 윗면 두 줄(판석 통로 + 흉벽) + 앞면 **네 줄(64px — 단층 집보다 높다)**. 세로 성벽(서·동) = 두 칸 폭 윗면만.
  모서리 2×2. 성문루 4×8 = (왼쪽 위, yw−1)부터 윗면 플랫폼 세 줄 + 앞면 다섯 줄. **망루 3×9** = (왼쪽 위, yw−2)부터 플랫폼 세 줄 + 앞면 여섯 줄 —
  한 줄 앞으로 내미니 높이가 두 줄 더 높아야 윗면이 성벽 흉벽 위로 보인다(r7 판정 「망루가 성벽보다 안 솟는다」). 성문 아치 안은 정확히 통로 두 칸(x 16~47).
  플랫폼 윗면 소품(위에서 본 들창·물레·쇠창살 구덩이·돌 탄환·통·상자·화로)으로 윗면이 바닥으로 읽힌다(관문 「정면 입면」 판정 수리).
  그늘: 망루·성문루·계단 오른쪽 성벽 앞면·통로에 짙은 그늘(9열 네 단, 잡색 돌도 가까운 램프로 붙여 어둡게 — 한두 단은 1배에서 묻혔다, r13), 땅 그림자 12행(r14).
  변형: 망루 셋(tower·tower1·tower2 — 윗면 소품 깃대·화로·탄환과 상자, 앞면 구멍 배치·창이 다르다, r11 「모든 망루가 같은 도장」), 성문루 둘(gate1 = 다른 소품 + 깃발 대신 방패), 목록 순서로 돌려 써서 이웃이 같지 않다. 앞면 변형 여덟(a b c e f g h + 드문 d 물빼기 구멍,
  넓은 물때·금·담쟁이·삭은 켜·갈아 끼운 돌) — 넷이면 긴 앞면이 4칸 주기로 보였다(r8). 칸 경계를 넘는 돌은 모든 변형이 같은 모양.
- **쪽문 문루(r11~r15)**: 세로 성벽을 길이 지나는 곳은 성벽 위로 솟은 네모 문루 — 윗면(사방 흉벽·살인구멍 쇠창살, 톱니 사이로 성벽 통로가 보인다)은 길 위 성벽 두 줄,
  앞면은 **늘 두 줄 이상**(r19 부터 아치 없이 화살 구멍·방패 — 길은 동서로 문루 밑을 지나므로 남쪽 아치는 「성벽 통로로 열린 문, 길은 옆 벽에 막힘」으로 읽혔다)이라 길 한 줄이면 앞면 윗줄이 길 바로 위 성벽 줄에 선다(`*_pgw_*_f2u`). 길 두 줄 = f2u·f2l, 세 줄 이상 = fu·fm…·fl.
  덮개돌만 이은 판(r8)은 「길이 성벽에 박혔다」, 한 줄 앞면(r13)은 「하수구 구멍」, 48px 판을 건너뛴 두 줄(r14)은 「납작한 검은 네모」로 반려됐다. 양옆 땅 길 줄에 터널 입 `mo_w`·`mo_e`(성벽 쪽 문설주 돌 두 열 + 거의 검은 네 열에서 열 열에 걸쳐 옅어짐). 문루는 모서리 망루와 한 줄 이상 띄운다(길 끝 줄 ≤ y1−4). 눈 그늘은 시트 눈밭 그늘 세 푸른 색(b0bcd2·a6bcdc·96aacc), 조립 그림 길은 기후와 상관없이 자갈길.
  열린 성문루 뒤 길 두 칸에 `mo_n`. 옛 끝 마감 `*_endS_*`·`*_endN_*` 는 칸 번호만 지킨다(쓰지 않음, 관문 덮개에서도 뺀다).
- **굽기**: `bake_wall.py` — 시트 꼬리 여덟 행(28,544~29,567). 앞 조각 번호를 지키려고 새 조각은 목록 끝에 덧붙인다(기후 변형은 기본 조각 전부 뒤에 같은 순서).
  `--gate-export DIR` = 관문에 낼 조립 그림 18장(기본·눈·사막 × 둘레·작은 둘레·열린/닫힌 성문루·세로 성벽 토막(좁은 둘레 안 — 따로 내면 「앞면 0행」 3/4 FAIL)·망루; 기후 둘레는 투명 바탕 — 한 색 땅이 「평면 채움」으로 잡혔다),
  `--no-gate` = 관문 영수증 없이 굽기(개발용). 조각 이름 → 칸 번호는 `src/assets/beodeulTownWallPieces.json`.
- **둘레 규칙**: `src/editor/tools/beodeulTownWall.ts` `planTownWallRing` = `bake_wall.py` `plan_ring`(해시 `hsh` 도 같은 값 — 곱셈 뒤 섞기).
  `townWallLayout(W,H,seed)`: x0=1, y0=2, x1=W−2, y1=H−8, 망루 수·간격은 seed 로 고른 틀(남 2·4·2, 북 2·3·2)에 ±2칸. 남쪽 망루 윗면 줄(y1−2)도 집 자리에서 뺀다.
  `stampTownWall(map, plan, biome)` 은 위 조각 3층, 성문 터널·땅 그림자·터널 입 그늘 2층(빈 땅에만). 설원 마을은 snow:, 사막 마을은 desert: 판. 계단은 seed 로 둘(0.1~0.44 · 0.56~0.9) 또는 하나, 자리가 다 막히면 가운데부터 훑어 하나는 둔다.
- **조수**: `author_beodeul_town` `walls:true`(이름에 성벽·성곽·성문·요새면 자동). 평지로, river 테마는 강 없이, 크기 +4×+11(3판 성벽 띠).
  `beodeulVillage.ts` 12d 단계가 둘레 띠를 집·나무 자리에서 빼고, 남·북 성벽을 지나는 길이 없으면 남쪽 길을 하나 낸다(치울 수 있는 소품만 치움).
  결과 `data.walls = {gates, gaps, towers, stairs, blockedRoads, southGateRoad?}`. 경로 메모(`beodeulTownRoute.ts`)도 walls:true 를 가르친다.
- **성문 고르기(조수 시험 r1 뒤 수리)**: `wallGate` S(기본)·N·NS — 그 쪽마다 성문루 하나. 가운데에서 폭 12% 안에 지나는 길이 있으면 그 길,
  없으면 가운데 쪽으로 안쪽 길에서 맵 끝까지 새 길을 낸다. 그 밖에서 성벽을 지나던 길은 성벽 띠에서 끊고 안쪽 줄기를 갈림목까지 지운다.
  서·동 틈은 `wallSideGaps:true` 일 때만. 성문 길은 마을 길망까지 빈 땅 최단 경로로 잇고 길 재료로 칠한다. 입구(`data.entrance`)는 성문 바깥 끝.
  r1(수리 전): 「남쪽에 성문 하나」인데 서·동 틈 셋, 성문이 남동 모서리 곁. r5(수리 뒤): 남쪽 가운데 성문 하나, 옆 틈 0, 문 앞 4/4.
- **조수 시험**: 시드 `scene-lessons-seed.json` 의 `walled-beodeul-town`. 실행 `qa-runs/harnesses/assistant-capability/2026-10-22-beodeul-wall-r1..r5`
  (Claude Code Sonnet 5.5 high **조수 대용**, 실제 입력창 경로, SQLite 저장·재로드 일치). 성문 걷기 영상은 출하 player 에서 r5 저장본을 실제 방향키로
  (`r5/.../gatefilm/gatewalk.mp4`). r3·r4 의 집 수 부족(3~4채)은 위 「집 수·길 토막」에서 넓혀 다시 짓기로 고쳤다.
  3판 다시 그림 뒤 `2026-10-22-beodeul-wall3-r1`: 60×46·집 5·광장·망루 5·계단 2, 문 6곳 도달, 저장·재로드 해시 일치. 출하 player 성문 걷기 `.../attempt-1/gatewalk2/film.mp4`(막힌 걸음 0).
- **3판 검수(r11~r21)**: 새 Opus 적대 VQA 를 판마다 새로 띄워 0 major 까지(r17 PASS 뒤 r18~r20 배치 major 로 다시 FAIL, r21 PASS 8/10 —
  `harness-data/object-gate/vqa/beodeul-town-wall-3e-r21/` 공용 관문 자료). `object-gate review` 18장(gate18): 13 PASS · REFER 4 · FAIL 1(망루 화풍) —
  그 5장은 새 Argon 재검수 전부 PASS. 프로필이 미보정이라 18장 모두 「delegated by user to supervisor 2026-10-23」 위임 허용(근거 파일 경로)으로 기록하고,
  옛 판 허용 6장은 `supersede-holds` 로 물렸다. 굽기는 관문을 켠 채(`--no-gate` 없이) 통과한다. 정식 보정 프로필 영수증은 아니다.
- **참고문서**: 번들 `beodeulCityReferences.json` 용도 `beodeul-town-wall`(출처 `tiledata/beodeul-town-wall/`, 그림 `public/assets/beodeul-town-wall/`,
  생성 `wall_refs.py` — 예시 둘레·정상/오류 그림 4종·좌표 검사 `wrong-layer`·`face-missing`·`wall-gap`·`gate-blocked`).
- **기존 프로젝트 — 이식 칸 옮기기(2026-10-22)**: 예전에는 접목(tileGrafts)이 28,544 이후를 쓰는 프로젝트(대부분)가 성벽을 못 받았다.
  이제 `ensureBeodeulCityTileset(tileset, project)` 가 `localTailRelocation.ts` `relocateLocalTail` 로 사본의 로컬 꼬리
  [사본 번들 끝 B, count) 를 지금 번들 끝 뒤로 통째로 민다(한 줄 폭 배수). 칸 표·이식 목록·애니메이션 띠·킷·오토타일·칸 묶음·팔레트·재료 슬롯·
  카운터·턱·미끄럼, 그 칩셋 맵의 네 층·겹침 스택·두들 묶음·절벽 장식·지형 기록, 그 맵을 겨누는 changeTile(맵·공통 이벤트), 같은 칩셋 지형 도장까지 같은 변환.
  B 앞 칸은 그대로, 비운 [B, E) 를 번들 표가 채운다. 앞으로 번들이 또 자라도 같은 함수가 다시 민다(예약 구간 없음). project 없이 부르면 예전처럼 막는다.
  실제 프로젝트 사본 4개 증명(`scripts/qa/beodeul-graft-relocation-proof.mts`): 모든 맵 화소 동일(정규화 뒤·저장 재로드 뒤), 이식 그림 손실 0,
  성벽 마을 332칸·집 5채, 시프트 128~1024. 시험 `test/beodeulGraftRelocation.test.ts`.
- **집 수·길 토막(2026-10-22)**: 성벽 마을이 요청 집 수보다 적게 앉으면 같은 id 로 +8×+6 씩 두 번까지 넓혀 다시 짓고 가장 나은 크기를 남긴다.
  그래도 모자라면 요약 머리에 「집 N채를 요청했지만 M채만 앉았다」를 정직하게 적는다(성벽 없는 마을도). 형태를 생략해 riverbank 가 나오면
  성벽 마을은 street 로 바꾼다(강이 성벽을 뚫었다). 12d 가 성벽에 끊긴 길 토막을 `analyzeCityForm` 막다른 끝 기준으로 깎는다 —
  성문에서 각 집 문 앞까지 길 경로는 보호하고, 그 경로와 2×2 길 덩이를 이루는 옆 칸도 지킨다(길은 두 칸 폭으로 그려져 한 칸만 남기면 풀밭처럼 보였다 —
  Opus VQA r6). 6개 시험에서 남은 막다른 끝은 집 문 앞에서 끝나는 길과 설원 바위 앞 2칸뿐. 증명 사본의 성벽 마을 그림(seed 7)은 riverbank→street 규칙 전이라 강이 성벽을 지났다 — 지금 코드는 street·강 없음.
  Opus VQA r7(`harness-data/object-gate/vqa/beodeul-town-wall-layout-r7/receipt.json`): 넓혀 다시 짓기·강 없음 통과, 성벽 앞 토막 없음. 남은 것: 갈래길은 원래 한 칸 폭(성벽 없는 마을과 같음),
  남문 새 길(southGateRoad)을 칠할 때 옆 열에 길 가장자리 오토타일이 번져 그 위에 들꽃이 놓인다(seed 7 (23,31)), 사막 성벽 마을 아래쪽 빈 모래 띠.
  설원 오두막(snowfield-hut)에서 문 그림 바로 아래 칸에 장작이 놓이고 문 앞 길이 한 칸 옆에서 시작했다(VQA r6).
- **r7 남은 것 수리(3판 작업)**: ① 성문 길 칠하기(`paveCells`)가 `fill_region` 의 「벽과 1칸 틈 메우기」로 옆 길 아닌 칸까지 길 가장자리를 칠했다 —
  내부 전용 인자 `_exactCells`(스키마에 없음)로 정확한 칸만 칠한다. 걷어 낸 소품이 길 밖으로 걸친 칸은 찍기 전 1층(지운 옛 길 가장자리일 수 있다)
  대신 바닥 재료로 다시 칠한다. ② 모래·눈 성벽 마을은 성벽 안쪽 발치 두세 줄(발치 한 줄은 비움)에 4~8칸마다 작은 덩이를 둔다(빈 덩이 채우기가
  성벽 앞에 거의 닿지 않았다). 빈 화면 몫 계산에서 성벽 띠 칸은 뺀다. ③ 설원 오두막 문은 그림 판정이 2열을 골랐지만 문짝은 1열(x 22~32) —
  `find_pick_doors.py` `DOOR_OVERRIDE` 와 `pick-doors.json`·번들 키트 parts 를 1열로(성벽과 무관, 성벽 없는 마을에도 적용).
- **검수**: 새 Opus 적대 VQA 5판(`harness-data/object-gate/vqa/beodeul-town-wall-r1..r5/receipt.json` — r1 FAIL 회색·매끈·끝 마감, r3 FAIL T자 이음,
  r4·r5 PASS). object-gate 그림 6장은 프로필 미보정이라 AI 판정은 참고(둘레·망루·동쪽 틈 FAIL 화풍/정면 인상, 부품·열린 성문 REFER, 닫힌 성문 PASS)이고,
  Opus VQA 뒤 「delegated by user to supervisor 2026-10-21」 허용을 18323 API 로 기록했다. 3/4 관문 정식 통과(보정 프로필 영수증)는 아니다.
- 화면: http://mdc-server:18301/beodeul-town-wall-1.html

## 민가·성당 외장: 원본 보존 보정 (2026-10-04 사용자 정정)

사용자 조건은 모든 집의 기초, 창문 다양화, 문 하나, 집별 벽 콘셉트 하나와 교회다.
측면은 필수가 아니다. 원래 버들항 지붕 면·집 윤곽을 유지한다. 후속 사용자 정정에 따라 기와 변경을 철회하고 원본 픽셀로 복원했다. 지적 대상은 stone 지붕 아래 박공 벽이다.
이전 투영 면 전체 재저작(revision 8)은 사용자가 과도한 변경으로 거부했다.
공용 `beodeul_architecture`는 원본 h101_0/h104_0/h112_0/h109_1/h107_0/cathedral을 조립한 뒤
중복 문 제거, 원본 창틀 안의 창문, 돌벽 색조와 stone 박공 벽/중앙 원형창을 허용 영역에서 고친다. 원본 알파 윤곽과 지붕 면 배치는 유지한다.
성당은 원본 푸른 첨탑·지붕을 쓰고 위층 중복 문만 원본 창문으로 바꾼다.
하네스 `beodeul-architecture build → validate → review`는 원본/보정본/변경 픽셀과 시트 배열을 대조한다.
기계 통과는 시각 합격이 아니며 측면 폭·면적을 합격 조건으로 삼지 않는다.

source는 16px/16열/336칸이며 기존 칸 배정을 유지하고 필요한 원본 조각만 추가한다.
`ensureBeodeulArchitectureTileset`는 기존 source count/통행/우선순위를 갱신한다.
`installBeodeulArchitecture`는 현재 source의 통행·우선순위를 기존 graft에도 반영한다.
`author_beodeul_town({houseCount:5})`는 원본 보존 5종, `church:true`는 폭 54칸으로 성당 마당을 연결한다.
`refine_beodeul_village`는 원본 또는 이전 공용 키트의 정확한 전체 배열만 같은 자리에서 바꾼다.
기존 키트 정의를 설치 전에 보관해 이전 시안을 알아보고, 이벤트 집과 점유된 칸은 보호한다.
길·나무·꾸밈·기존 출입 시험/실내를 보존한다.

공용 ground는 기존 48슬롯을 유지한 112칸/21레시피다. 보정 집도 sourceKit별 원본 기초 레시피를 적용한다.
문 열은 투명하고, ★ 기초는 벽 통행을 유지하며 바쁜 꾸밈 칸을 건너뛴다.
공용 참고문서는 5 MD/5 이미지에 원본 보존 사전·정상/지붕 재칠 오류·5채 표본·전체 네 층/사용 graft를 담는다.
사용 graft만 기록해 문서 120,000자 상한을 지킨다.
저장·재로드·화면 근거는 `verify-shots/beodeul-native-restoration/README.md`.
이전 거부 시안 기록은 `verify-shots/beodeul-building-refinement/README.md`에 보존한다.

## 원본 유지 일광·길 경계·잔디 보정 (2026-10-04)

광원/접지 조사 후 사용자가 적용을 지시했다. 원본 건물·나무·기초/소품 도트와 원점, 두 출입 시험 맵은 보존한다.
공용 source beodeul_ground는 앞의 112칸을 그대로 두고 304칸으로 확장한다. 추가 44레시피는 집 6종/수관 3종의 짧은 일광·접촉 그림자, 4×3 저대비 잔디/흙 변화 3종, 원본 길 오토타일 16종의 연석 대비를 낮춘 변형 2개씩이다.
`harmonize_beodeul_daylight({mapId})`는 기존 맵만 보정한다. 그림자/잔디는 2층 빈칸에 넣고 기존 2층 그림과 높이를 보존한다. 길 보정은 원본 형태와 통행을 유지한 1층 graft이며 원래 길 오토타일 connectTileIds에 연결한다. memberTileIds는 바꾸지 않는다. 반복 적용은 중복하지 않는다.
작은 마을 houseCount 시공은 마지막에 자동 적용하고 큰 기후 마을에는 강제하지 않는다. 공통 조수 프롬프트와 참고문서 읽기 계약에 등록한다. 하네스 build/validate/review, 공용 신규/기존 source 등록과 실제 마을 전후·그림자만 비교·정본 저장·재로드·통행 근거는 verify-shots/beodeul-light-ground. 전체 게이트는 실행하지 않는다.

## 기본 타일셋 (2026-09-30)

버들항이 **새 프로젝트의 기본 타일셋**이다. `DEFAULT_TILESET_ID = "beodeul_city"`(`src/project/defaults/constants.ts`, 문자열 리터럴 —
7MB `beodeulCityTileset.json` 을 constants 가 import 하지 않게 하려는 것이라 `DEFAULT_TILESET_NAME` 은 `bundled.ts` 항목 이름과 같아야 한다).

- 새 프로젝트: `createBlankProject` 의 시작 맵 `createBlankMap(..., DEFAULT_TILESET_ID)`, 타일셋 목록 맨 앞이 버들항(`defaultTilesets`, `defaultResourceProfiles` 도 기본 프로필을 앞으로).
- 빈 맵 채움: `createBlankMap`/`blankFillTileFor`는 타일셋 메타데이터 또는 번들별 바닥 번호를 고른다. 버들항의 민무늬 잔디는 737(`BEODEUL_PLAIN_GRASS_TILE`)이다. **`TILE.*` 상수는 합본 마을 칸 번호라 타일셋 간 기본값으로 쓰지 않는다.** 버들항에서 240은 벽이다.
- 합본 마을은 번들에 그대로 남는다. 합본 마을 칸 번호에 의존하는 코드·테스트(`createStarterMap`, `createLogCabinShowcaseMap`, `createFarmingDemoProject`, `scripts/natural-village/build.ts`, 테스트 약 540곳)는 `COMBINED_TOWN_TILESET_ID/NAME/TEXTURE_KEY`(같은 파일)와 `combinedTownTileset()` 를 명시한다. "기본"을 뜻하는 곳만 `DEFAULT_TILESET_*`.
- 기존 프로젝트는 이관하지 않는다. 합본 마을 맵은 그대로 합본 마을 팔레트로 그려진다(`verify-shots/beodeul-default/bd-existing-combined-town.png`).
- 조수(2026-10-01 변경): `defaultOutdoorTilesetId`(`forestHarmony.ts`)는 **프로젝트에 버들항이 있고 모든 맵이 버들항이면(= 새 프로젝트) 버들항**, 그 밖(합본 마을·숲마을 맵이 섞인 기존 프로젝트)은 예전처럼 `forest_harmony` 가 있으면 그것이다. 보는 맵의 계열은 `toolRunner.ts` 60~100행의 계열 규칙이 지킨다. 「마을 만들어 줘」는 버들항 프로젝트에서 `author_beodeul_town` 으로 간다 — 아래 「조수 마을 경로」.
- 계열(2026-10-01): 버들항의 `family` 는 **`"oprn-atlas"`(생성 칩셋)** 이다. 시트 JSON 은 `"easyrpg"` 라 숲마을과 같은 계열로 묶였고, 계열 검사(`toolRunner.rejectTilesetFamilyChange`)가 버들항 맵에서 숲마을 새 맵으로 가는 것을 막지 못했다. `createBeodeulCityTileset` 이 덮어쓰고 `ensureBeodeulCityTileset` 이 옛 사본을 고친다.
- `create_map`(2026-10-01): 타일셋의 정본 메타데이터를 우선해 바닥을 채우고, 버들항은 잔디 737을 쓴다(`plainGrassTileFor`, `defaultMaps.ts`). 예전엔 모든 칩셋에 합본 마을 번호 240을 넣어 다른 타일셋에서 벽·장식처럼 보였다.
- 시작 마을(2026-10-01): 「예제로 시작」(`projectStartSeed.ts`)과 첫 실행 안내 「작은 마을 추가하기」(`firstRunGuide.ts`)는 `createBeodeulStarterMap`(`src/editor/content/beodeulStarterMap.ts`) — `author_beodeul_town` 40×30 seed 7(주택가·시장 둘·저택) 뒤 오른쪽 남는 띠를 비우고 첫 띠 아래 길(2줄)을 동쪽 끝까지 잇는다. 첫 구간 뼈대가 (가로-1, 시작 y)에 다음 맵 문을 달기 때문이다. 시작 칸 (3, 13). 첫 실행 안내는 시작 맵이 버들항일 때만 쓰고, 옛 칩셋으로 시작한 프로젝트는 합본 마을 `createStarterMap` 그대로(계열을 섞지 않게). `createStarterMap` 자체와 샘플 모험(`createDefaultProject`)은 합본 마을 칸 번호로 꾸민 것이라 그대로다.
- 몬스터 수집 도로(2026-10-01): `author_wild_route` 가 버들항 맵도 깐다(`wildRouteBeodeul.ts`) — 합본 마을 경로와 같은 길 계획(`planRouteCorridor`)을 포석·짙은 잎 풀(11628)·버들항 나무 키트로. **버들항엔 키큰 풀이 없어 풀숲은 짙은 잎 풀 대용이다** — 손 도트 키큰 풀을 시트에 더하는 일은 남았다. 이것이 없던 동안(#1789~) 새 프로젝트의 몬스터 수집 첫 구간 뼈대(AI 인터뷰 시작·예제로 시작)는 이 도구에서 멈췄다.
  - 2026-10-06 다시 손봄(「1번 도로가 엉망진창」): 시내 포석 → **`버들항 모랫길`** 오토타일, 잡음 경로의 계단 대각선 → **꺾임 비용 경로**(`routePathStraight`, 방향을 상태에 넣은 다익스트라) + 경유점까지 갔다 되돌아온 막다른 가지 잘라 내기(`pruneLoops`),
    풀숲에 잘려 남은 4칸 이하 모랫길 토막은 풀밭으로. 숲은 2칸 격자 흩뿌림(덤불 점박이) → **숲 벽**(`plantBeodeulForestWall`): 크기로 나눈 나무(3×3 수관·3×4 줄기 나무·2×2 덤불)를
    위에서 아래로 벽돌처럼 엇갈려 붙이고, 아래가 트인 앞줄엔 줄기 나무, 맵 하나에 수관·줄기 한 종씩. 길섶엔 깊은 숲길 세트 1칸 소품(`dressBeodeulVerge`).
    도구가 맵에 `mapRole: "field"` 를 붙이고, `stamp_object` 는 필드 맵에 마을·항구·농장 소품(bd-house·block·harbour·garden…, bd-pick-fishing-port·riverside-mill·vineyard·walled-market·wheat-roman 등)을 `settlement-prop-on-route` 로 거부한다(`routePropPolicy.ts` — 조수가 1번 도로에 통발·건조대·밀단을 찍었다).
    남은 것: 수관 사이 풀밭 이음매(키트끼리 겹칠 수 없다), 키큰 풀 그림. 계약 `test/wildRouteBeodeul.test.ts`.
- 계열 규칙(`isCombinedTownCompatibleTileset`)은 합본 마을 계열 기준 그대로다.

### 빠른 집·도로 도구 (2026-10-03)

높이 도구의 「집」은 버들항에서 반목조 집 3종(붉은 꽃/초록 창틀/불 켠 창)과 통나무 집 3종(초록/파랑/붉은 문)을 기본 카드로 보여 준다.
`src/editor/beodeulQuickHouse.ts`가 공용 `bd-mpart-*` / `bd-out-*` 부품의 실제 윗층 배열로 조립한다.
근거는 타일 참고문서 「저택·외곽」의 `bd-manor-kits.md` / `bd-outskirts-kits.md`와 부품 그림이다.
드래그 너비는 반목조 최소 7칸/통나무 최소 5칸, 최대 24칸. 반목조 새 집은 `bd-mpart-gable` 원본 5×4 박공을 중앙에 올린 4행 지붕이 기본이다. 「지붕 형태」에서 3행 모임 지붕도 고른다. 통나무 집은 원래 3행 지붕을 쓴다. 층은 2행짜리 띠를 온전히 반복한다(최대 9층).
「지붕만」 모드는 벽 너비/층수를 유지하며 지붕 너비와 반목조 집의 형태를 바꾼다. 기존 생성 집은 지붕에서 끌어 벽·창·문 월드 좌표를 유지한 채 조절한다. 기본 「기존 형태 유지」는 너비만 바꾸며, 명시한 형태 변경은 지붕 높이에 맞춰 스탬프 원점을 옮긴다. 너비는 벽 이상~24칸이다. 옛 kit ID/그림은 유지하고 새 박공 ID에 `_joined_gable`을 붙여 구분한다. 직접 덧칠/다른 배치와 겹친 집은 보호한다.
박공의 양쪽 사선 C칸이 지붕 중앙 M칸과 겹칠 때는 `bd-manor-small` 원본 (3,2)/(7,2)의 합성된 upper 칸을 쓴다. 투명한 박공 C칸만 대입하면 셀 전체의 뒤 지붕을 지워 봉우리 양옆에 구멍이 난다. 좁은 집에서 C칸이 지붕 끝 L/R 안에 있으면 해당 합성 M칸을 끼워 넣지 않는다.
AI `place_terrain_house` / `resize_terrain_house_roof`의 `roofForm: "gable" | "hip"`도 같은 조립기를 쓴다. 지붕 수정 보호는 최종 배치를 재조립해 비교하므로 형태 변경을 허용해도 벽 수정 예외가 생기지 않는다. 근거: `scripts/qa/gabled-roof-audit.mts`, `verify-shots/gabled-roof/SUMMARY.md`.
초록 고스트와 확정은 같은 계획을 쓰며 문 앞까지 빈 평지를 검사한다. 저장된 기존 집은 원래 크기로 고를 수 있다.
아래층은 비워 두어 기존 잔디를 유지하고, 새 그림이나 타일 번호를 만들지 않는다. 숲마을 그림으로 대체하지 않는다.
「도로」는 버들항 길 포석 `beodeul_road_autotile`(몸통 3221)을 먼저 고른다. `TILE.DIRT`나 다른 칩셋의 길 번호를 쓰지 않는다.
실제 새 프로젝트 기본 선택, 3종 크기 드래그, 포석 교차로, 시야 ON/OFF, 출하 플레이어와 SQLite 재로드 증거는 `verify-shots/beodeul-building/`.
계약·조작은 [지형 도구 모음](terrain-design-suite.md#빠른-집과-도로).

### 팔레트 실측 (2026-09-30, 헤드리스 chromium, dev 서버, 1600×900)

| | 버들항(빈 새 프로젝트) | 합본 마을 |
|---|---|---|
| 팔레트 첫 타일 (페이지 부팅 포함, 콜드 dev) | 약 19~20초, 992칸으로 시작 | 약 18~22초, 195칸 |
| 팔레트 DOM `.chipset-tile` | 23,936 (패널 24,036 노드, #app 24,754) | 195 (패널 308, #app 약 1,020) |
| 필터(분류) 전환 | 0.74~2.3초 | 65~126ms |
| 타일 클릭 | 171~525ms | 약 72ms |
| 전체 채움 | 배치 128칸×`setTimeout(0)` 로 약 60초 | 즉시 |

**가상화 적용 후 (2026-10-01, 같은 조건, `perf/palette-virtual`).** `tilePaletteVirtual.ts` 가 보이는 창 + 위아래 18행·좌우 1열만 DOM 에 둔다(칸 수 512 초과인 커스텀 팔레트만; 이하는 예전 전체 렌더).

| | 이전 | 이후 |
|---|---|---|
| 팔레트 DOM `.chipset-tile` / 패널 노드 | 23,936 / 24,036 (측정 4,705~8,545 은 지연 채움 도중) | 969 / 970 |
| 필터(분류) 전환 | 1.1~1.5초 | 42~100ms (`refreshPaletteFilter`: 툴바·보조 패널 재빌드 생략, 목록만 교체) |
| 타일 클릭 | 약 295ms | 39~75ms(부하 잡음 큼) |
| 스크롤 프레임 p50 / p95 | 67ms / 495ms | 약 19ms / 64~80ms — **16ms 목표 미달** |
| 합본 마을 | (기준) | 같은 값(가상화 문턱 미만, 경로 불변) |

스크롤은 유휴 프레임 비용이 칸 수가 아니라 **격자 전체 높이**에 비례했다(헤드리스 소프트웨어 래스터 추정; contain·will-change·content-visibility 무효). 스크롤 중 추가 비용은 칸 추가·제거 시 스타일 재계산이며 행 버퍼를 늘릴수록 줄어든다(1행 360~520ms/s → 18행 약 80~160ms/s). 측정 스크립트·전후 JSON·스크린샷은 `verify-shots/palette-virtual/` (`bench.mjs`, `behavior.mjs`, `pdiff.py`). 기본 화면 픽셀 diff 는 두 타일셋 모두 0.

분류 보정(코드): `tileMeta` 에 role 이 없는 타일셋은 「지형」이 0칸이었다 → 태그(grass·road·plaza·sand·walk·cliff…)로 usage 추정(`tilePaletteFilter.ts inferTerrainUsage`), 버들항 지형 2,482칸. **「물」 10,719칸은 그대로다** — 무늬 없는 일반 물칸 10,591개가 `water` 태그를 다 갖는다(`beodeulCityTileset.json` 데이터). 고치려면 `python3 scripts/content/build-beodeul-city.py --no-render` 로 JSON 을 다시 만들 때 일반 물칸 태그를 `water-plain` 등으로 나눠야 한다(이번엔 재생성하지 않음). 잔디·광장·오토타일 앞쪽 고정 구역은 미구현.

앞쪽 배치: 잔디 737 은 5행, 광장 8~22행. 그러나 길·물·모래 **오토타일 본체는 맨 끝**(길 23015~, 물 23025~23152, 모래 23160~, 179~181행)이고, `지형` 필터는 0칸, `물` 필터는 10,719칸(과대 분류)이다. 구조물 키트 286종은 팔레트 칸이 아니라 `stamp_object`/구조 보조로 찍는다. 후속: 자주 쓰는 칸 고정 구역, 지형 분류 수정, 가상화.

## 무엇이 어디에 있나

| 무엇 | 위치 |
|---|---|
| 그리기 파이프라인 (Python) | `scripts/content/lib/city_v6/` — 입구 `city6.py`, 키트 `city6_kits.py`, 소품 `city6_props.py`, 렌더 `city6_render.py`, 움직임 `city6_anim.py`, 메타 `meta.json`, QA `qa-v6.json`. 출력 폴더는 `CITY6_OUT`(기본 `/tmp/j8city6`). 바탕 칩셋 사본 `assets/jungle-chipset-v6.png`(v6 를 그릴 때의 정글 시트, 뒤에 바뀐 번들 시트와 달라 고정), 잔디·물 견본 `assets/lawn16.png`·`water16.png` — **이제 `/tmp`·홈 폴더를 읽지 않는다**(옛 `addons2.py` 가 `/tmp/j8city` 를 경로 맨 앞에 넣어 모듈 13개가 거기서 읽혔다) |
| 편집기 쪽 추가 출력 | `city6_render.py` 가 같은 실행에서 `city6_ground.png`(물체 전 땅), `city6_grid.json`(점유·단·절벽·물·문·계단·다리·잔교), `city6_objects.json`+`objects/*.png`(물체마다 투명 그림), `city6_houses.json`, `city6_people.json`(주민) 을 더 쓴다. `CITY6_NO_PEOPLE=1` 이면 주민 그림만 빼고 그린다(주민은 이벤트가 된다) |
| 칸 자르기 | `python3 scripts/content/build-beodeul-city.py` (`--no-render` = 렌더 다시 안 함) → `public/assets/beodeul-city/beodeul-city-chipset.png`(v7: 2048×2992, 128열, 23,936칸), `src/assets/beodeulCityTileset.json`, `src/assets/beodeulCitySheet.json`, `tiledata/beodeul-city/map.json` |
| 원본 렌더 사본 | `tiledata/beodeul-city/render/`(주민 없음, 칸을 자른 원본) · `render-full/`(주민 포함 = `/tmp/j8city6/city6.png` 와 화소 0 차이) |
| 타일셋 정의 | `src/project/defaults/beodeulCity.ts` `createBeodeulCityTileset` / `ensureBeodeulCityTileset`(칸 수가 다른 옛 사본의 칸 표·키트·오토타일과 같은 id 번들 용도를 새것으로) / `ensureBeodeulCityReferences`(빠진 용도 추가) |
| 공용 배포 | `src/assets/bundled.ts` 한 줄(`tex_beodeul_city`) + `bundledChipsetGeometry.ts`(128열) → `defaultAssets.ts` `ensureBundledTilesets` 가 새 프로젝트·기존 프로젝트 모두에 만든다. `tilesetHarness/combinedTown.ts` 의 RM2k3 투명 칩 표에서 뺐다(칸 층은 렌더에서 잘랐다) |
| AI 참고문서 | `python3 scripts/content/prepare-beodeul-city-references.py` → `src/assets/beodeulCityReferences.json`(v7: 용도 6 · MD 24 · 그림 44 · JSON 218KB · 그림 3.4MB(128색 팔레트 PNG); v6 는 용도 4 · MD 17 · 그림 21, 그림은 `/assets/beodeul-city/references/*.png` 경로 — 바이트 없음) + MD 사본 `tiledata/beodeul-city/references/*.md` + 변조 검사 결과 `tiledata/beodeul-city/qa-tamper-checks.json` |
| 정본 저장 | `node scripts/content/save-beodeul-city.mjs` → v7 `.oprn-projects/beodeul-city-r2-20260929`(git 밖, 맵 `beodeul_v7`), 증거 `tiledata/beodeul-city/storage-proof-r2.json` (v6: `beodeul-city-20260928`, `storage-proof.json`) |
| 예시 배치·배치 자 | `bun scripts/content/author-beodeul-layouts.mts [--only hilltop\|estuary]`(배치 정의 `scripts/content/lib/beodeul-layout-specs.ts`, 자 `scripts/content/lib/beodeul-metrics.ts`) → `verify-shots/beodeul-layouts/<id>/`(render·recipe·metrics·map·변조 그림 `err-layout-*.png`·`tampers.json`). 배치 하나 약 3분 |
| v7 그림 추가분 | `scripts/content/lib/city_v6/terrain7.py`(오토타일 16변형) · `road_fix7.py`(두 번째 길 감사) · `kits7_common.py`/`kits7_manor.py`/`kits7_outskirts.py` → `tiledata/beodeul-city/kits7/*.json·up.png·lo.png`(저택 40·외곽 55 키트) |
| 재로드 렌더·화소 비교 | `bun scripts/content/render-beodeul-city.mts` → `verify-shots/beodeul-assistant/reloaded-render.png`, `pixel-diff.json`, `diff-*.png` |
| 조수 시험 | `bun scripts/qa/beodeul-assistant-run.mts --project <폴더> --label fresh|existing --map <id> --new 100x100` → `verify-shots/beodeul-assistant-r2/<label>/`(라운드 1 결과는 `verify-shots/beodeul-assistant/`). 빈 폴더면 편집기 「새 프로젝트」와 같은 빈 프로젝트에서 시작 |
| 증거 페이지 | 라운드 1 `~/claude-viz/beodeul-assistant-proof.html`, 라운드 2 `~/claude-viz/r2-beodeul.html`, 라운드 3 `~/claude-viz/r3-beodeul.html` (http://mdc-server:18301/r3-beodeul.html) |
| 블록 키트 (v8) | `build-beodeul-city.py` 의 v8 절(`_Canvas`·`block_*`·`BLOCKS`) → 번들 키트 `bd-block-*` 41종 + 표 `tiledata/beodeul-city/blocks-v8.json`(문 앞 칸·가장자리 출구) |
| 조수 스킬 | `assistant-skills/city-block-assembly/SKILL.md` — 이 브랜치에는 스킬 번들러(`bundle-assistant-skills.mjs`, agent/atlas-policy)가 없어 스킬 본문은 아직 못 읽는다. 대신 **참고문서 `bd-work-order`(번들 소유)와 `author_beodeul_town` 도구 결과·노트가 같은 절차를 조수에게 준다** |

## 칸 자르기 규칙

- 칸마다 **아래층 = 땅 렌더**(포석·판석·물면·절벽·다리 상판·바닥 키트), **윗층 = 최종 그림이 땅과 다른 화소**(집·성·나무·소품·처마·연기·날개·배)를 불투명으로.
- 원본 한 바퀴 24장면(물 8·풍차 8·연기 12·배/분수/깃발 4)을 칸마다 계산해 주기 p(1·2·3·4·6·8·12·24)로 줄이고, p>1 이면 p칸을 이어 붙여 `animationStrips {baseTile, frames:p, fps:8}` 한 줄. 1,699줄. 한 줄은 시트의 한 행 안에 둔다.
- 같은 그림(같은 장면열)·같은 층·같은 통행은 한 칸을 같이 쓴다. 통행은 칸마다 다를 수 있어 키에 넣었다.
- 통행은 Python 점유 격자에서: 길·광장·성벽길·성문·다리·계단·잔교·풀밭(절벽 가장자리 포함) = 걸음, 물·절벽면·담·건물·소품·나무 = 막힘.
  계단은 절벽면 위, 다리는 물 위에 있으므로 계단·다리·성문·성벽길은 먼저 걸음으로 판정한다(이걸 빠뜨려 처음엔 문 앞 72곳 중 다수가 끊겼다).
  윗층 칸은 그 칸이 걸음이면 ★(사람 위에 그려짐, 처마·굴뚝·나무 윗부분), 막힘이면 y 정렬되는 막힌 물체.
- 시트는 오토타일이 없다(원본 자리에서 잘린 칸). 그래서 조수용 재료는 **키트**다: 구역 8(왕성·저택·포룸·성당 언덕·풍차 들·강/다리·서쪽 항구·항구, 두 층 채움), 건물 70(이름 있는 건물 12 포함)·소품 34·나무 8 조각(물체의 투명 그림을 원래 칸 오프셋 그대로 잘라 새 칸으로, 아래층 -1).
  `stamp_object({objectId:'kit:beodeul_city/<id>'})` 로 찍힌다(`sharedDesignCatalog.ts` `kitObjects`). 땅 재료 네 가지(`버들항 풀밭`·`길 포석`·`광장 판석`·`물`)는 오토타일 아닌 면 채우기 그룹이다.
- tileMeta 는 칸 23,936개가 모든 프로젝트에 실리므로 짧게(이름표·한 줄 설명·층·통행) 했다. 번들 JSON 6.5MB.

## 정본 저장·재로드 (2026-09-28)

- project id `ad468208-0287-4f27-a50e-20d10536a0cd`, `.oprn-projects/beodeul-city-20260928`, revision 1. 맵 `beodeul_v6` 100×100, 주민 이벤트 122.
- 재로드 `isDeepStrictEqual` 프로젝트·맵·타일셋 모두 true. 편집기 통행(`isPassable`) 대 Python 점유 격자 10,000칸 중 불일치 0(걸음 2,907칸).
- 재로드 맵을 저장소 렌더러(`scripts/qa-game/render.mts` → `editor/mapTileDraw`, 각 띠 0번 장면)로 그려 비교:
  주민 없는 원본과 **0화소 차이**, 주민 포함 `city6.png` 와 29,508화소(1.15%) 차이 — **전부 주민 122명 그림 상자 안**(상자 밖 0). 주민은 타일이 아니라 NPC 이벤트로 옮겼기 때문이다.
- 기존 프로젝트: 저장된 `saltflat-fields-20260928` 를 읽어 `ensureBundledTilesets` 를 돌리면 `beodeul_city` 와 참고문서 4용도가 생기고, 참고문서를 지운 사본은 4용도가 다시 채워진다.

## 조수 시험 — 「버들항 비슷한 로마풍 항구 도시를 깔아줘」

`scripts/qa/beodeul-assistant-run.mts`: 정본 SQLite 프로젝트를 읽고(편집기 로드처럼 `ensureBundledTilesets`), 100×100 `beodeul_city` 맵을 만든 뒤
Pi 런타임(`runPiAgent`, 채팅 패널과 같은 도구·참고문서 읽기 게이트)을 실제 모델로 한 번 돌리고, 결과를 같은 저장소에 저장·재로드·렌더한다.

- 모델: `klb/claude-opus-5.5`(생각 high). klb 는 번들 모델 목록에 없어 `~/.omp/agent/models.yml` 의 공급자 정의로 모델 객체를 만든다 —
  `piAgentRuntime.ts` `RunPiAgentOptions.model` 을 더했다(없으면 예전처럼 목록에서 정확히 찾는다). 키는 증거에 남기지 않는다.
- 도구 노출: 채팅 패널은 의도 선언(LLM)으로 쓸 만한 도구를 고른 뒤 core + 발견 도구 + 그 도구를 보낸다(`plainTurn.ts` → `buildSessionRegistryTools`).
  헤드리스에서는 선언을 지도 시공용으로 고정했다(33개). 전체 275개(약 600KB)를 매 호출 싣지 않기 위해서다. `find_tools` 로 넓힐 수 있다.
- 결과·도구 호출·판정은 `verify-shots/beodeul-assistant/{fresh,existing}/summary.json`·`trace.json`·`render.png` 와 증거 페이지에 있다.

### 결과 (2026-09-28, 두 번)

| | 새 프로젝트 | 기존 프로젝트(소금 평원 필드 사본) |
|---|---|---|
| project id / 폴더 | `2b631748-…` `.oprn-projects/beodeul-assistant-fresh-20260928` | `dc69bd7c-…` `.oprn-projects/beodeul-assistant-existing-20260928` |
| 시간 · 턴 · 도구 호출(실패) | 24분 · 40 · 178(2) | 24분 · 43 · 171(2) |
| 참고문서 | list 5 · read 27, 4용도 모두(문서·그림 22종) | list 5 · read 23, 4용도 모두(20종) |
| 구역 키트 | 8/8, 모두 원본 원점 | 8/8, 모두 원본 원점 |
| 새로 찍은 건물 · 소품 · 나무 | 23 · 10 · 31 | 27 · 16 · 33 |
| 문 앞 도달(큰길 62,33 에서) | 23/23 | 27/27 |
| 원본과 같은 칸 | 65.1% | 64.8% |
| 구역 밖 물체 칸(원본 1,855) | 1,069 | 1,232 |
| 저장 후 재로드 동일 | true | true (로드 때 `beodeul_city` 가 새로 생김, 기존 맵 5장 그대로) |

판정: 조수는 도구로 참고문서를 읽고 **버들항과 비슷한 도시를 깔았다.** 그러나 절반 이상은 구역 키트를 원본 좌표에 찍은 복사이고,
스스로 설계한 가운데 마을은 원본보다 성기고(물체 칸 58~66%), 길은 오토타일이 없어 포석 대표 칸 사각형이다.
강 윗줄기(33~36열 0~23행, 74칸)는 어느 구역 키트에도 없어 두 결과 모두 빠졌고, 기존 프로젝트 결과는 가운데 운하 72칸을 덮었다.
실패 2회는 두 번 모두 첫 `fill_region` 이 `layer is not defined` 로 죽은 편집기 버그(`constructionTools.ts` 결과 data 의 없는 변수)였다 — 고쳤다.
다음에 고칠 것: 강 전체를 한 키트로, 길 포석·물가에 오토타일, 문서의 「원본 좌표 = 정답」을 「원본은 예시, 새 배치 규칙」으로.

## 라운드 2 (2026-09-29, v7) — 원본이 아닌 도시를 가르치기

라운드 1 조수는 구역 키트를 원본 좌표에 찍어 원본의 65%를 복사했다. 라운드 2 의 목표는 **같은 조각으로 다른 배치**를 깔게 하는 것.

### 무엇을 더했나
- **오토타일 셋**(`terrain7.py`, 16변형 N=1 E=2 S=4 W=8): `버들항 길 포석`(연석 2px) · `버들항 물`(돌 둑, 8장면) · `버들항 모랫길`(잔디 가장자리).
  `edgeConnects`+`outsideConnects` 둘 다 켰다 — `shapeAutotileGroupAround` 는 앞의 것, `fill_region` 이 쓰는 `resolveAutotile` 은 뒤의 것만 본다.
  맵 가장자리는 이어진 것으로 봐서 길·강이 맵 밖으로 나가는 모양이 된다.
- **강·폭포·다리·항구 키트 10**: 라운드 1 에서 어느 키트에도 없던 윗 강 74칸(`bd-river-upper`), 곧은 강·운하·굽이, 아치 다리, 폭포 둘, 호수 항구(83×15), 항구 광장.
- **귀족 저택 4 + 정원 2 + 부품 34**(`kits7_manor.py`), **성 밖 목조집·우물 광장·장작 + 부품 49**(`kits7_outskirts.py`). 부품 조립표는 `tiledata/beodeul-city/kits7/*.json` 의 `assembly`.
- **잔디 무늬 조각 6**(`bd-ground-lawn-*`): 원본엔 6×6 빈 풀밭이 없어서(빈 칸 738개가 전부 틈) 밝기가 같은 잔디 칸 10종을 고정 난수로 섞어 만든다.
- **구역 키트 가장자리 정리**: 이웃 집·지붕 꼭지를 잘라 내고(그림자 칸은 같은 종류의 그림자 없는 칸으로), 왕성 양 끝 성벽 기둥·저택 옆 강 한 줄 → 잔디, 해자 양 끝은 물 오토타일 막힌 끝.
- **v6 잔결함**: 나무 변형·색조, 빨랫줄 5줄, 밀 색(`wheat7`, 칩셋 색만), 두 번째 길 감사(`road_fix7.py`), 넷째 다리, 잔교를 땅으로.
- **그리기 파이프라인이 /tmp 를 읽던 마지막 구멍**: `pj_demo.py` 가 `sys.path` 맨 앞에 `/tmp/j8city` 를 넣어, 그 뒤 모듈(shapes·pi·pz·roman·sheet2)이 전부 /tmp 사본에서 왔다.
  v7 의 밀·빨래 색 수정이 렌더에 안 들어간 이유가 이것이었다. 고친 뒤 렌더 차이 7,055화소(밀·건초·빨래), 칸 번호는 그대로.
  확인법: `python3 -c "import sys;sys.path.insert(0,'.');import palette;palette.apply();import pv,shapes;print(shapes.__file__)"` (lib/city_v6 에서) → lib 경로여야 한다.

### 예시 배치 둘과 배치 자
`scripts/content/author-beodeul-layouts.mts` 가 편집기 도구만으로 「언덕 위 성읍」(`hilltop`)과 「강어귀 항구」(`estuary`)를 깔고,
`beodeul-metrics.ts` 로 잰다. 둘 다 원본과 같은 칸 0.45%·0.53%, 결함 0, 문 43·52곳 모두 포장 길망 도달.

배우며 찾은 도구 함정:
- `fill_region` 은 칠한 칸 옆 **한 칸 틈**(벽 사이 잔디)을 메운다(요약의 「벽 틈 메움 N칸」). 키트 둘레에 잔디 칸이 있는 포룸·풍차 옆에 거리를 나중에 칠하면
  짧은 길 토막이 생긴다 → 그 거리를 먼저 칠하고 키트를 찍은 뒤, 출구 칸만 다시 칠해 연석을 맞춘다.
- 칸별 이웃 수로 막다른 길을 재면 2칸 폭 거리의 끝(이웃 2)은 안 보인다 → `deadEndStreets`(끝 줄 2~3칸 검사).
- 잔디 무늬 조각은 땅 키트라 「키트가 소유한 칸」에서 뺀다(뺐더니 그 위에 깐 막다른 길이 보였다).
- 변조 4종(문 앞 궤짝 · 막다른 곁길 · 같은 집 셋 · 다리+둑길 빠짐)을 같은 자로 검출해 참고문서의 오류 그림으로 쓴다.

### 참고문서 (v7)
용도 6 · MD 24 · 그림 44. 「도시 한 장 조립」을 「원본은 예시」로 다시 썼고, 「배치 규칙」(구역 키트 17종 출구 칸 표·거리 끝 규칙·집 줄·다리 갑판 행·물),
예시 배치 둘(도구 순서·100×100 역할 격자·렌더), 「자동타일과 강·폭포·다리·항구」, 「귀족 저택과 성 밖 목조 마을」 용도를 더했다.
그림은 128색 팔레트 PNG 그대로 저장한다(RGB 로 되펴 저장하던 것을 바꿔 9.0MB → 3.4MB). 번들 JSON 220KB, 이미지 바이트 없음.
옛 시트(칸 수가 다른) 사본은 `ensureBeodeulCityTileset` 이 칸 표와 **같은 id 의 번들 용도**를 새것으로 바꾼다(칸 번호가 옛 시트 것이라). 저자 용도는 그대로.

### 정본 (v7)
project id `6f86ae29-f2a4-4c06-a396-511f972cea52`, `.oprn-projects/beodeul-city-r2-20260929`, 맵 `beodeul_v7`, revision 2.
재로드 deepEqual 프로젝트·맵·타일셋 true, 통행 불일치 0/10,000(걸음 2,943), 재로드 렌더 대 주민 없는 원본 0화소 차이.

### 조수 재시험 (klb/claude-opus-5.5, 「원본 좌표에 찍지 말고 새로 설계, 예시도 베끼지 말 것」)
`bun scripts/qa/beodeul-assistant-run.mts … --label fresh|existing --map beodeul_like --new 100x100`, 증거 `verify-shots/beodeul-assistant-r2/{fresh,existing}/`.

| | 새 프로젝트 | 기존 프로젝트(소금 평원 필드 사본) |
|---|---|---|
| project id / 폴더 | `ecb372c8-…` `.oprn-projects/beodeul-assistant-r2-fresh` | `dc69bd7c-…` `.oprn-projects/beodeul-assistant-r2-existing` |
| 시간 · 턴 · 도구 호출(실패) | 50분(Pi 실행 상한 3000초에서 멈춤) · 38 · 192(0) | 42분(스스로 끝냄) · 40 · 224(1 — 참고문서 선행 읽기 게이트) |
| 참고문서 | list 7 · read 41 | list 7 · read 29 |
| 원본과 같은 칸 | **0.45%** (라운드 1: 65.1%) | **0.43%** (라운드 1: 64.8%) |
| 예시 배치와 같은 칸(대부분 빈 잔디) | 언덕 위 10.2% · 강어귀 14.4% | 8.0% · 12.8% |
| 구역 키트(원본 원점에 찍음) | 성·저택·포룸·성당·풍차 5/5 + 호수 항구, 원점 일치 0 | 5/5 + 호수 항구, 원점 일치 0 |
| 새 키트 쓴 것 | 저택 1, 목조집 11, 다리 4, 항구 광장 | 저택 1 + 정원 2, 목조집 5, 다리 4, 잔디 무늬 23 |
| 집 · 나무 · 소품 | 40 · 26 · 7 | 53 · 36 · 6 |
| 문 → 육지 / 포장 길망 | 50/50 · 50/50 | 58/58 · 58/58 |
| 막다른 칸 / 막다른 넓은 거리 / 물에 끝남 / 막힌 문 앞 / 같은 조각 일렬 | 1 / 1 / 1 / 0 / 0 | 2 / 1 / 0 / 0 / 0 |
| 저장 후 재로드 | 맵 동일 true, 저장소 두 번 읽기 동일 | 맵 동일 true, 저장소 두 번 읽기 동일 |

「새 프로젝트」는 도중에 키트 가장자리 정리 전 번들(반쪽 이웃 집이 붙은 포룸 등)로 돌았다 — 실행 중에 번들을 고쳤다. 「기존 프로젝트」는 정리 후 번들이다.
프로젝트 전체 deepEqual 은 두 결과 모두 false 로 기록됐다: 실행 결과 객체 대 저장소 재로드의 차이는 기존 프로젝트에서 `database`(actors·classes…)·`system.titleScreen`,
즉 저장소가 옛 데이터를 읽으며 채우는 기본값이다. 맵은 칸까지 같고, 저장소를 두 번 읽은 결과끼리는 deepEqual true·sha 같음.
판정: 원본 복제는 사라졌고(같은 칸 0.4%), 구역 배치·강 흐름·다리·집 줄을 스스로 설계했다. 약점은 격자처럼 고른 거리망, 막다른 길 한두 곳, 강의 꺾임 한 번, 빈 잔디.

## 라운드 3 (2026-09-29, v8) — 블록 키트로 빈 풀밭 없애기

감독 실측: 라운드 2 두 결과 모두 맵의 31~33%가 빈 잔디, 20×15 화면 35개 중 11~16개가 40% 넘게 빔. 같은 폭 바둑판 거리, 블록마다 집 한 줄 + 뒤는 빈 잔디.
원인은 조립 단위가 **집 한 채**였던 것(찍기 96~136번, 시간 상한). 라운드 3 은 단위를 **블록 하나**로 바꿨다.

### 무엇을 더했나
- **블록 키트 41종** `bd-block-<종류>-<가로>x<세로>[-b|-c]`: 주택가·상가(13칸은 집 두 줄 + 6행 뒷골목, 8칸은 한 줄 + 뒷마당),
  시장, 정원 저택(a 작은·b 탑·c 담쟁이), 성 밖 목조, 항구 창고(b 야적장), 성당 앞. 크기 10/14/20 × 8/13/17.
  원본 좌표를 옮기지 않고 조각을 틀에 새로 조립한다(`_row`·`_scatter`·`_topup` — 뒷마당 빈 잔디 20% 이하까지 소품).
  문은 모두 블록 아래 변. 표: 문 앞 칸 x, 블록 안 문 앞(골목), 가장자리 포장 칸 N/S/W/E.
- **빈 바닥 자** `emptinessOf`(beodeul-metrics): `open` = 물건 없는 걷는 비포장 땅(감독 실측에 가장 가깝다), `lawn` = 물건 없는 기본 잔디.
  20×15 화면마다 비율, 40% 초과 수. 라운드 2 를 같은 자로 다시 재면 open 34.7%·11/35, 29.7%·10/35.
  옛 예시 배치도 비어 있었다: 언덕 위 50.0%·24/35, 강어귀 35.7%·16/35 — 조수가 예시에서 빈 도시를 배우고 있었다.
- **블록 반복 자** `blockRepeats`: 같은 줄·열에서 20칸 안의 같은 블록 id, 한 맵 3번 이상.
- **예시 배치 `blocks`**: 대로 4칸 2줄(가장자리 줄에 가로등·가로수) · 거리 2칸 · 골목 1칸 격자, 블록 34개(31종, 이웃 반복 0),
  공원 대각선 거리(3칸 가로 조각을 줄마다 비껴 칠함), 호수 항구 + 부두 길. 빈 바닥 10.8%·0/35, 문 120 모두 길망.
- **참고문서 용도 `beodeul-city-blocks`**(작업 순서·시간 예산, 길 위계·굽은 길, 블록 표, 그림 3). 작업 순서를 새 용도에 둔 이유:
  라운드 3 이전 프로젝트엔 이 용도가 통째로 없으니 `ensureBeodeulCityReferences` 가 빠진 용도로 심는다(있는 번들 용도는 다시 쓰지 않는다).
  같은 칸 수 사본에는 `ensureBeodeulCityTileset` 이 없는 배포 키트만 id 로 덧붙인다(기존 프로젝트 시험에서 블록 키트·용도가 로드 때 붙는 것 확인).
  7용도 · 28문서 · 48그림, JSON 248KB, 그림 4.1MB(이미지 바이트 없음).

### 배우며 찾은 것
- **블록을 찍은 뒤 거리 전체를 다시 칠하면 안 된다.** `fill_region` 의 벽 틈 메움이 블록 가장자리 한 칸 잔디를 모두 길로 만들어 블록에 톱니가 생긴다
  (첫 예시: 막다른 칸 47·넓은 거리 28). 뒷골목 끝 바깥 한 칸만 다시 칠한다.
- `lay_path` 는 한 칸 폭 8방향 선이라 두 줄을 나란히 그어도 계단 두 줄이다. 넓은 굽은 길은 행마다 가로 조각을 비껴 `fill_region`.
- **참고문서 무게가 곧 시간이다.** 첫 라운드 3 시험은 29번 읽고(선행 읽기 게이트가 용도의 그림을 전부 요구, 블록 용도 그림 10장) 턴당 입력 약 13만 토큰,
  22턴 50분 중 30분이 계획 → 블록 0개로 시간 상한(빈 바닥 45%). 블록 용도 그림 10 → 3, 블록 표 역할 배열 삭제, 블록 예시 문서의 100×100 격자 삭제 뒤 다시 돌렸다.
  증거 `verify-shots/beodeul-assistant-r3/fresh-try1/`.

### 조수 재시험 (klb/claude-opus-5.5, 라운드 2 과제 + 「블록 키트로」, 블록 25종 번들)
`bun scripts/qa/beodeul-assistant-run.mts --project … --label fresh|existing --map … --new 100x100`(기본 `--round r3`), 증거 `verify-shots/beodeul-assistant-r3/`, 표 `compare.json`.

| | r2 새 | r2 기존 | **r3 새** | **r3 기존** |
|---|---|---|---|---|
| 시간 | 50분(상한) | 42분 | **42분(스스로 끝냄)** | 50분(상한, 도시는 거의 다 깔림) |
| 도구 호출(찍기/칠하기) | 192(96/32) | 224(136/32) | 189(85/46) | 173(86/42) |
| 블록 키트 | 0 | 0 | 20 | 20 |
| 빈 바닥 open · 40% 넘는 화면 | 34.7% · 11/35 | 29.7% · 10/35 | **15.1% · 0/35** | **14.1% · 0/35** |
| 원본과 같은 칸 | 0.45% | 0.43% | 0.33% | 0.52% |
| 막다른 칸+넓은 거리 / 물에 끝남 | 2 / 1 | 3 / 0 | 0 / 3 | 12 / 0 |
| 같은 블록 가까이 반복 | — | — | 5 | 0 |
| 문 → 길망 | 50/50 | 58/58 | 73/73 | 72/72 |
| project id | `ecb372c8-…` | `dc69bd7c-…` | `0243f842-…` `.oprn-projects/beodeul-assistant-r3-fresh` | `dc69bd7c-…` `.oprn-projects/beodeul-assistant-r3-existing` |

저장 후 재로드 맵 동일(두 결과 모두). 적대적 시각 QA(새 서브에이전트): 빈 풀밭은 해소, 「만들다 만」 느낌이 일부 「복사해 붙인」 느낌으로 바뀜 —
새 프로젝트는 같은 블록이 한 열에 2~4번(시장·저택 교대, 목조 4연속), 기존 프로젝트는 동서 가로수 대로가 생겨 길 위계가 처음으로 보임.
공통으로 남은 것: 성 아래 절벽 조각·성 옆 잔디 테두리, 운하가 항구 앞 난간에서 끊김, 호수 항구 키트의 넓은 수면·짙은 녹색 사각형·막다른 길, 시장 3곳 과다.
QA 뒤 변형 16종·반복 자·반복 금지 규칙(이웃 금지·맵당 2번)·물길/잔디 테두리/나란한 길 규칙을 더했다 — **이 뒤로는 조수를 다시 돌리지 않았다.**

### 정본 (v8)
project id `ad9dadcc-3b40-40ed-93c2-64393550de06`, `.oprn-projects/beodeul-city-r3-20260929`(`BEODEUL_ROUND=r3` 기본), 맵 `beodeul_v7`(맵은 v7 그대로, 타일셋에 블록 키트·새 용도),
revision 1. 재로드 deepEqual 프로젝트·맵·타일셋 true, 통행 불일치 0/10,000, 재로드 렌더 대 주민 없는 원본 0화소 차이. 증명 `tiledata/beodeul-city/storage-proof-r3.json`.

## 다음 방향 (보류 — 이번에는 다시 그리지 않음)

사용자가 다음 판 참고로 준 그림 세 장. 저장소에 두었다.

1. `tiledata/city-refs/noble-manor-forest-house-rmxp.jpg` — **귀족 저택**: 반목조 흰 벽, 붉은 비늘 기와 지붕과 지붕창, 창가 꽃상자,
   좌우 대칭 정형 정원과 자갈 십자 길, 화분 속 사이프러스, 가로등.
2. `tiledata/city-refs/outskirts-wooden-houses.png` — **성 밖 외곽 나무집**: 통나무·널판 집, 가파른 나무 너와 지붕, 모랫길, 우물 있는 자갈 광장.
3. `tiledata/city-refs/itch-structure-ref.jpg` — **조립 구조 참고**(화풍이 아니라 짜임): 저택·빅토리아풍 집을 재사용 부품의 쌓음으로 본다.
   - 부품: 지붕(가파른 모임·망사드 + 평평한 머리, 너와 줄, 밝은 용마루·어두운 처마) / 박공·지붕창 / 층 띠(처마돌림 선반으로 나뉨) /
     모서리·칸 사이 붙임기둥 / 되풀이되는 아치 창 칸 / 기단(주춧돌 줄).
   - 변형은 같은 부품에서: 민짜 / 덩굴(이끼·담쟁이가 지붕 끝·기둥을 타고 흘러내림, 밑동 덤불) / 부서짐.
   - 옆 탑: 둥근·팔각 탑에 원뿔 지붕, 본채에 붙는다.
   - 입구는 따로: 기둥 박공 현관, 꼭지 장식 기둥 사이 앞으로 나온 계단(계단은 걸음, 기둥은 막힘).
   - 낱개 소품: 담쟁이 아치, 낮은 돌 난간·담, 산울타리 덩이, 돌 사당·묘비.
   - 1px 어두운 외곽선, 왼쪽 밝은 면·오른쪽 그늘 면, 지붕 처마·선반 그림자로 깊이.
   → **버들항의 저택·귀족 구역을 이 부품 조립(지붕/박공/층 띠/붙임기둥/창 칸/탑/현관/계단)으로 옮기고 부품마다 덩굴 변형을 둔다.**
   지금 저택은 한 장짜리 그림(`bd-house-manor` 13×11)이라 부품으로 나뉘어 있지 않다.

## 농장 beodeul_farm 2판·3판 (2026-10-14, 1판 2026-10-13 PR #2489 다시 그림) — 경작지 `farmland`·`farmland_watered` · 작물 · 울타리 · 헛간·닭장

농사 런타임(`playSceneFarming.ts`)은 맵 타일셋에서 오토타일 그룹 id `farmland`(또는 `builtin_farmland`)를 찾아 경작한 칸을 그 그림으로 그린다(`farmlandGroupForTileset`).
**물 준 칸은 2판부터 `farmland_watered` 그룹의 같은 마스크 칸으로 그리고 틴트를 얹지 않는다**(`wateredFarmlandGroupForTileset`; 그룹이 없는 타일셋은 예전처럼 마른 흙+틴트).
그룹이 없으면 단색 흙 사각형 폴백이다.

- **그림**: 코드 손 도트 행 문자열 `scripts/content/beodeul-farm/farm_art.py`(16px, 3/4 시점, 버들항에서 뽑은 팔레트 글자). 1판(Sonnet)이 「거칠다」고 반려돼 전부 다시 그렸다:
  흙은 4행 주기 이랑 몸통 + 둑 윤곽 + 남쪽 앞면 2단 + 잔디 그림자, 작물은 칸 밖으로 넘치지 않게 찍는다(`wrap=False`), 울타리는 공용 말뚝(머리 윗면 4행) 하나를 모든 조각이 쓴다.
  세로 줄 가로대는 말뚝 **옆면**에 붙인 위에서 본 띠다(앞면을 덮으면 판정자가 「윗면 0행 기둥」으로 읽었다) — 그래서 서쪽 둘레 `v` 와 동쪽 둘레 `vE` 가 따로 있다.
  문은 가로 울타리와 같은 비례의 **열린 틀**(위 띠장 윗면 2행+앞면 2행·사선 빗장·끝 세로대·아래 띠장, 틈은 투명) — 꽉 막힌 널판은 「정면 입면도」로 FAIL 했다.
  헛간 6×6(기와 지붕·건초 다락 박공·X 빗장 두 짝 문·돌 기초) · 닭장 3×3(널 지붕·문 하나·알 상자·경사판). 생성 이미지·사람·글자 없음.
- **굽기**: `python3 scripts/content/beodeul-farm/bake_farm.py [--gate-export DIR]` — 시트 **꼬리 덧붙이기**(앞 216행 그대로, 뒤 6행), 칸 표·오토타일·칸 묶음·키트 갱신, 멱등.
  **굽기 안에 3/4 관문이 걸려 있다**: 현재 그림 해시의 PASS 영수증이 없는 새 칸은 비워 두고, 이미 번들에 있던 칸(1판 번호)이 막히면 exit 2.
  `bake_picks.py` 가 시트를 다시 자르면 꼬리가 사라지므로 그 끝에서 이 스크립트를 자동으로 다시 부른다(`--dry` 제외).
- **칸 번호**(`BEODEUL_FARM_BASE = 27648`, 총 28,416칸, 1판 번호 그대로 + 덧붙이기):
  마른 흙 27648~27652 / 27776~27780 / 27904~27907 · 물 준 흙 +6열(27654~ … 27913) ·
  작물 28160~28168(밀 싹·자람·익음 / 배추 / 토마토) + **28169 씨 뿌린 이랑** ·
  울타리 28288 가로 · 28289 세로(서쪽 둘레) · 28290 NW · 28291 NE · 28292 SW · 28293 SE · 28294 문 · 28295 서끝 · 28296 동끝 · 28297 세로 북끝 · 28298 세로 남끝 · 28299 홀로 선 말뚝 · **28300 세로(동쪽 둘레 `vE`)** ·
  헛간 27664(6×6, 행 0~5 열 16~21) · 닭장 27672(3×3, 열 24~26). 건물 윗 줄(헛간 3·닭장 1)은 ★ 통과, 아랫줄은 막힘.
- **`farmland` 그룹**: neighborhood 8, 멤버 14칸(몸통·4변·4모서리·외딴 점·오목 모서리 4). 가장자리 바깥은 잔디 737 화소를 구워 넣어 어느 칸 위에도 얹힌다.
  `farmland_watered` 는 같은 윤곽의 팔레트 한 단 어두운 판. 오토타일 id 와 `beodeul:farm*` 칸 묶음(`farmland`·`farmland_watered`·`farm_crops`·`farm_fence`·`farm_buildings`)은 번들 소유.
- **키트**(`bd-farm-*`, 번들 소유): `plot-soil`·`plot-wheat`·`plot-mixed`(4×3) · `plot-cabbage`(5×4) · `plot-tomato`(4×3) · `plot-sowing`(5×4) · `fence-run-4` · `fence-v-3` ·
  **`fenced-plot`(7×6, 둘레 울타리 + 남쪽 문, parts gate)** · **`barn`** · **`coop`**(parts entrance). 흙은 아래층, 작물·울타리·건물은 윗층. `routePropPolicy` 는 필드 맵에 헛간·닭장을 거부한다.
- **기존 프로젝트**: `ensureBeodeulCityTileset` → `extendPickedParts`(꼬리 칸 표) + `mergeShippedFarm`(그룹·묶음) + `mergeShippedKits`(`bd-farm-`). **예외**: 꼬리가 생기기 전에 저장돼 27,648번 이후 칸에 `tileGrafts` 를 이미 쓰는 사본은 농장 칸을 받지 않는다.
- **장면·검사·참고문서**: `npx vite-node --script scripts/content/beodeul-farm/farm_scenes.mts [--out DIR] [--refs]` — 엔진 렌더러로 장면 5개(조각보 밭·농가 마당·과수원과 목장·마을 텃밭·파종)를 그리고
  `checkFarm`(작물이 흙 밖·흙 가장자리 모양 불일치·울타리 틈·문 막힘·문 앞 길 없음·건물이 흙 위·겹침)을 돈다. `--refs` 는 `farm_refs.mts` 로 `public/assets/beodeul-farm/`(아틀라스·장면·오류 그림 4)과
  `tiledata/beodeul-farm/`(사전·실행 순서·예제 배열·오류 예제)을 쓰고 `beodeulCityReferences.json` 의 용도 `beodeul-farm` 을 갱신한다(조작 4종 모두 검출 확인). 장면 증거 `verify-shots/beodeul-farm/`.
- **적대적 시각 QA(한 번, 2026-10-14)**: 장면 5개에서 결함 10건(1폭 길이 너덜함·씨 이랑 안 보임·문짝 너무 어두움·마당 소품 일렬·과수원이 덤불 덩이·닭장 길 없음 등) → 한 번 고쳐 다시 그림. 밀 익음이 밭 옆 가장자리로 2px 넘는 것은 받아들였다.
  `door-unreached` 검사는 이 QA 에서 검사기가 놓친 결함으로 더했다.
- **런타임 확인(LLM 없음)**: `farm_runtime_check.mts` + `farm_runtime_compose.py` — life-full 픽스처의 농장 맵을 버들항으로 바꿔 괭이질 23·심기 23·물 주기(반쪽→전부→반쪽)·하루씩 성장·수확(감자 11)을 실제 런타임 함수로 돌리고,
  스텁 씬에 `renderFarmOverlays` 를 불러 칸마다 기대 마스크의 마른/물 준 칸 번호와 틴트 없음을 대조한다 — 2026-10-14 실측 어긋남 0.
- **3/4 관문(object-gate, 2026-10-14)**: 27항목(흙·물 준 흙 terrain, 작물 10 organic, 울타리 13 frame, 헛간·닭장 structure) **PASS 27/27 — 프로필 `ca6aaa9c55194dc5` 미보정이라 「임시 통과」**.
  세로 울타리는 옆면 띠로 다시 그려 통과, 문은 두 번 FAIL(얇은 기둥 / 꽉 막힌 널판) 뒤 열린 틀로 통과. 실패 영수증도 지우지 않고 남겼다. 프로필이 보정되면 다시 받아야 한다.
- **3판 화풍 정렬(2026-10-14, 사용자 「농장 칩 분위기가 버들항과 너무 다르다」)**: 헛간·닭장을 버들항 민가 문법(테라코타 기와 행마다 한 단씩 내려가는 램프·용마루 막새·처마 밑 회벽 그늘 4단·3폭 목재 보·1단 돌 기초)으로, 울타리는 윤곽 #2a1a0f·말뚝 5폭으로(2폭·1행까지 줄인 판은 3/4 관문 전부 FAIL), 작물은 버들항 텃밭·밀밭 톤으로, 버들항에 없던 색 4개를 없앴다. 새 칸: 반듯한 흙길 오토타일 `beodeul_farm_lane`(27680+마스크, 재료 「버들항 농장 흙길」, 번들 소유 `BEODEUL_FARM_AUTOTILE_IDS`)·풀 무늬 6(27808~27813). 울타리는 낱개 영수증 + 조립 표본 `fence_assembled` 영수증(부품 예외)으로 덮인다. 장면 6 「마을 가장자리」 추가, 비교 `~/claude-viz/farm-style.html`.
- **작물 그림의 한계(남은 일)**: 런타임 작물은 여전히 스프라이트 시트(`FARMING_CROP_SPRITE_ASSETS`)에서 그린다(밀·배추는 그 시트에도 없다). 시트 작물 칸은 맵에 타일로 놓는 용도다.
- **조수**: `create_farm_plot`·`author_beodeul_town` 설명에 「밭 하나 4×3~8×5 직사각형마다 쓰임·울타리·2폭 길, 띠 전체를 흙으로 메우지 말 것, bd-farm 키트, 참고문서 beodeul-farm」을 넣었다. 실제 조수 실행 검증은 아직 없다(할당량) —
  나중 실조수 시험은 「농장 마을」 요청이 울타리 친 밭 여러 개+길+헛간을 내는지, 띠를 흙으로 메우지 않는지 볼 것. 마을 생성기(`authorBeodeulTown`)의 자체 밭은 아직 포도밭+숲 울타리를 쓴다.
  허수아비·우물은 새로 그리지 않았다 — 기존 `bd-pick-wheat-roman-road-scarecrow`·`bd-prop-well_roofed` 를 쓴다.

## 남은 것

- (v7 에서 해결) 땅 재료 오토타일 없음 → 길·물·모랫길 오토타일. v6 잔결함(막다른 길·물띠 줄무늬·일렬 반복·원색 밀밭) → 고침.
- 왕성 키트 아래 절벽 양 끝은 잘린 단면이다(끝 마감 그림 없음). 예시 배치는 나무 무리로 가린다.
- 원본 정본: 북쪽 절벽이 x≈55 에서 풀밭 한가운데서 끝난다(단 차가 동쪽으로 이어지지 않음, v7 적대적 QA 중대 1).
- 바닥 풀밭은 한 가지 칸이라 넓게 비우면 여전히 납작하다(잔디 무늬 조각은 옅다).
- 23,936칸 tileMeta 가 프로젝트마다 실린다(타일셋 JSON 약 7MB).
- (라운드 3) 호수 항구 키트 자체의 결함(짙은 녹색 사각형·안쪽 막다른 길·연꽃 넓은 수면)은 키트 안이라 조수가 고칠 수 없다. 구역 키트의 블록 맞춤판(성·포룸 가장자리를 판석으로 닫은 판)은 아직 없다.
- (라운드 3) 참고문서 선행 읽기 게이트가 용도의 그림·문서를 전부 요구해 물·구역 키트 용도(그림 13·8장)를 건드리면 턴당 입력이 커진다 — 판 하나로 묶는 것이 다음 일.


## 조수 마을 경로 (2026-10-01) — 「마을 만들어 줘」가 버들항으로 안 가던 원인과 수리

원인 세 가지(수리 전): ① 바깥 새 맵 기본이 숲마을(`forestHarmony.ts::defaultOutdoorTilesetId`) ② `author_village` 는 버들항을 `village-tileset-mismatch` 로 거절 ③ 의도 노트·도구 노출·마을 계약(`villageContract.ts`, `plainTurn.ts`)·`formatPiVillageNote`(`executionRoute.ts`)가 전부 `author_village` 한 방 숲 경로로만 몰았고 블록 키트·`check_city_form`·참고문서는 안내하지 않았다.

- 도구 `author_beodeul_town`(`src/editor/tools/authorBeodeulTown.ts`): **`theme:"city"` 일 때** 블록 키트 `bd-block-*`(+`bd-harbour-lake`)를 열·띠로 조립한다(2026-10-01 오후부터 기본 theme 은 마을 문법 `river` — 아래 「마을 문법」 절). `mapId`(기존 버들항 맵은 잔디로 지우고 통째 재조립)·`name`·`id`·`width`·`height`(기본 60×60)·`seed`·`harbour`(폭 83 이상). 원작 배치를 베끼지 않는다. 오프라인 검증 `scripts/qa/beodeul-town-offline.mts`: 빈 바닥 7.5~10.3%, 문 앞 전부 도달, 결함 0.
- `author_village` 는 대상이 버들항이면 `author_beodeul_town` 으로 **되돌려 보낸다**(`authorVillageToolDef.ts::rerouteToBeodeulTown`). 넘길 때 인자 글(이름·groundTheme)에서 theme 을 고른다: 도시·로마·블록 → city, 사막·오아시스 → desert, 설원·겨울 → snow, 늪·습지 → swamp, 항구·포구·바다 → coast, 그 밖 river. 「city」 낱말은 tilesetId `beodeul_city` 에도 있어 보지 않는다.
- 노트: `src/ai/piAgent/beodeulTownRoute.ts::beodeulTownTargetFor` 가 LLM 의도가 `author_village`/`author_beodeul_town` 를 고르고 대상 맵(없으면 프로젝트 바깥 기본)이 버들항일 때만 버들항 노트를 만든다. `executionRoute.ts` 는 이 노트를 `formatPiVillageNote` 보다 먼저 쓰고, `plainTurn.ts`·`villageContract.ts` 는 버들항 마을이면 **마을 계약을 건너뛴다**(12채·강변촌 굳히기 방지).
- 노출: `sessionToolExposure.ts::schemasForIntent` 가 두 마을 도구에 `check_city_form`·`check_reachability` 를 짝지어 노출한다. `TILESET_REFERENCE_WRITERS`(`tilesetReferenceTools.ts`)에 `author_beodeul_town` 포함 → 참고문서 용도를 먼저 읽어야 한다.
- 실모델 시험 `scripts/qa/beodeul-village-plain.mts`(증거 `verify-shots/assistant-beodeul-village/`): 새 프로젝트 「마을 만들어 줘」 → `author_beodeul_town` 1회 → `check_city_form`·`check_reachability` → 소품 `stamp_object`. 기존 합본 마을 프로젝트는 옛 경로 유지.
- 함정: `list_tileset_references` 에 없는 `categoryId` 를 주면 「용도를 찾을 수 없습니다」만 돌려줘 모델이 14번 반복했다 → 가능한 용도 id 를 함께 돌려주도록 수리(`unknownIdMessage`).

## 고른 장소 조각 (2026-10-01) — 변형 20곳에서 사용자가 고른 것을 공용 시트로

버들항 변형 20곳(마을·기후 마을·던전·특수 던전·필드 각 4곳, `tiledata/beodeul-variants/<장소>/`)은 데모 렌더였고 시트에 칸이 없었다.
사용자가 고르기 화면(`scripts/content/beodeul-pick/pick_server.py`, 정본 `~/.local/share/oprn/beodeul-pick/picks.sqlite`)에서 BEFORE/AFTER 를 고른 조각을 **공용 버들항 번들**에 구웠다.

| 단계 | 명령 | 결과 |
|---|---|---|
| 1. 고른 세트 설치 | `python3 scripts/content/beodeul-picks/install_picks.py [--dry]` | `tiledata/beodeul-variants/<장소>/parts/*.png`·`render-1x.png` 를 고른 판으로 바꾼다(옛 사본 지움). `picks.json`(스냅숏) + `MANIFEST.md`(항목별 판정) |
| 2. 굽기 | `python3 scripts/content/beodeul-picks/bake_picks.py [--dry]` | 시트 꼬리 칸 · 키트 `bd-pick-*` · 참고문서 용도 `beodeul-picks-*` · 그림 `public/assets/beodeul-city/references/picks/` |

판정 규칙(설치): `after` → 변형 워크트리(`~/.t3/worktrees/rpg-zzu/beodeul-var<n>`)의 현재 파일, `before` → `before/var<n>/` 사본, 안 고름 → AFTER, `redo`(둘 다 별로) → 뺀다.
`redo` 뒤 다시 그려져(파일 mtime > 고른 시각) 아직 안 고른 것도 뺀다. **var6 은 재작업 중이라 통째로 뺐다.** 2026-10-01 실측: 545항목 = after 338 · 안 고름 151 · before 45 · redo(다시 그림, 재선택 대기) 11.

### 칸·키트
- 칸: 도시 시트 0~23,935 는 그대로, **23,936~27,647**(행 187~215)이 고른 조각 칸. `BEODEUL_CITY_BASE_COUNT = 23936`(`beodeulCity.ts`) / `BASE`(`bake_picks.py`).
  514조각(같은 그림 합쳐 439종) → 3,708칸 사용, 시트 2048×3456. 같은 그림·같은 층·같은 통행 칸은 한 칸을 같이 쓴다.
- **덧붙이기 전용 등록부** `tiledata/beodeul-variants/pick-cells.json` + `pick-cells.png`: 칸마다 (그림 해시·층·우선·통행) 열쇠. 다시 돌려도 같은 열쇠는 같은 번호,
  새 조각은 뒤에 붙고 빠진 조각의 칸도 지우지 않는다 — 그 칸을 찍은 맵이 바뀌지 않게. `build-beodeul-city.py` 로 도시 시트를 다시 자르면 끝에서 `bake_picks.py` 를 자동으로 다시 돌린다
  (도시 칸 수가 23,936 이 아니면 돌리지 않는다 — 그때는 두 BASE 상수를 함께 고친다). `prepare-beodeul-city-references.py` 는 `beodeul-picks-*` 용도를 지우지 않고 보존한다.
- 조각 → 키트 `bd-pick-<장소>-<파일 이름>`(같은 그림이 여러 장소면 첫 장소 id 하나, themes·tags 에 모든 장소). 이름은 `parts.md` 설명의 앞부분(없으면 사전 대체).
  분류 `ai.themes` = village·coast·desert·mine·snow·swamp·dungeon·landmark·volcano·field·forest·mountain + 한글.
- 자리 맞춤: 물체는 **왼쪽 아래**(변형 스크립트 `img(X,Y)` = 왼쪽 아래 칸 규약), 바닥 표본은 왼쪽 위. 칸에 안 맞는 폭·높이는 투명으로 채운다.
- 층·통행(종류는 파일 이름으로 판정, `classify`):

| 종류 | 예 | 층 | 통행 |
|---|---|---|---|
| 물체 | 집·좌판·제단·등대 | 윗층(아래층 -1) | 아래 N줄 막힘(1~2칸 높이·폭 1·나무 = 1줄, 그 밖 = 높이의 절반 이상·최소 2), 위는 ★ |
| 나무 | 전나무·야자·올리브·맹그로브 | 윗층 | 밑동 1줄 막힘, 수관 ★ |
| 바닥 표본 | `ground-*`·`floor_*`·모자이크·깔개 | 불투명 = 아래층, 투명 낀 칸 = 윗층(우선 lower) | 걸음 |
| 물·용암 | `water_*`·`ground-water/hot/bog/tail`·용암 | 아래층 | 막힘. 용암 2종은 칸마다 4장면 띠(fps 4) |
| 벽·절벽·천장 | `face_*`·`ground-cliff/tcliff`·`ceiling*` | 아래층 | 막힘 |
| 걸음 구조물 | 잔교·널다리·다리·계단·나선 계단 | 불투명 = 아래층, 투명 낀 칸 = 윗층 우선 lower(사람 아래, 통행 표시 `o`) | 걸음 |
| 바닥 소품 | 헤더·고사리·들꽃·자갈·뼈·조개 | 윗층 우선 lower | 걸음 |

  우선 lower 윗층 칸은 `characterDepth.mapUpperTileDepth` 에서 `o` 로 하층 깊이에 그려진다(★ 는 사람 위). 당시 문 칸 위치는 키트에 없었다. 현재 입구가 있는 키트는 `entrances` 메타데이터를 갖고 `stamp_object`가 절대 좌표를 반환한다(2026-10-04 확인). 문 이벤트는 별도로 연결한다.

### 기존 프로젝트
`ensureBeodeulCityTileset` 은 칸 수가 23,936 이상인 도시 시트 사본(`beodeul_road_autotile` 있음)을 갈아엎지 않고 **꼬리만 덧붙인다**:
23,936번 뒤 칸 표(통행·우선·terrain·tileMeta)와 그 구간 애니메이션 띠를 번들 것으로, `bd-pick-*` 키트는 번들 것으로 바꾸거나 더하고(번들에서 빠진 것은 뺀다), 다른 키트·그룹·앞 칸은 그대로.
번들보다 꼬리가 긴(더 새 빌드가 저장한) 사본은 줄이지 않는다. 용도는 `ensureBeodeulCityReferences` 가 빠진 `beodeul-picks-*` 를 더한다(문서·그림 id 가 `bd-` 라 번들 소유).
회귀 계약 `test/beodeulPickedParts.test.ts`(이 브랜치에서는 실행하지 않았다).

### 참고문서 (조수)
용도 5 — `beodeul-picks-village`(포구·방앗간·포도원·장터) · `climate-village`(사막·광산·설원·늪) · `dungeon`(하수도·카타콤·바다 동굴·신전) · `special`(곶 등대·난파선·화산 동굴·마법사의 탑) · `field`(해안 절벽길·숲길·산길·밀밭).
각 용도: 안내 문서(작업 순서 7단계·층/통행 규칙·검사 범위·없는 소재) + 장소마다 문서(plan.md 앞부분·조각 표·키트별 역할 글자와 아래층/윗층 전체 배열) + 그림 `<장소>-map`(고른 맵 렌더 — **Python 데모 렌더, 엔진 출력 아님**, render 가 redo 면 뺀다) · `<장소>-parts`(시트 칸으로 그린 키트 판, 번호 = 표 번호).
마을 용도에만 오류 그림 `err-layer`(윗부분 칸을 아래층에 칠해 투명 부분이 검게 빈 것 / 정답). 25문서 · 41그림, 문서 17만 자, 그림 5.6MB(긴 변 ≤820px·128색, 번들 JSON 에는 경로만).
MD 사본 `tiledata/beodeul-city/references/bd-pick-doc-*.md`.
조수 안내: 시스템 프롬프트(`systemPrompt.ts` 버들항 줄)와 `author_beodeul_town` 설명에 「로마풍 도시가 아닌 장소는 `bd-pick-*` 키트를 `stamp_object` 로」를 더했다. 조수 실모델 시험은 이번에 하지 않았다.

### 화면 증거
`verify-shots/beodeul-picked-parts/`(`drive.mjs`, `report.json`): 새 프로젝트(`?blankProject=1`) — 칸 27,648 · 키트 725(고른 439) · 용도 5, 「내 구조물」 선반에서 키트 3개를 찍음.
기존 프로젝트 — 고른 조각 전 사본(23,936칸, 키트 287, 옛 키트로 그린 맵, 저자 키트 1)을 `store.loadFallbackProject`(로드 정규화)로 열면 27,648칸 · 키트 726 · 용도 5, 맵 칸과 앞 칸 통행은 그대로, 저자 키트 유지 → 키트 3개를 찍음.

### 남은 것
- var2·var4(재선택 대기 11항목)·var6(재작업 중)이 끝나면 `install_picks.py` → `bake_picks.py` 를 다시 돌린다(칸 번호는 등록부가 지킨다).
- 현재 입구 메타데이터는 `stamp_object` 결과의 `entrances`로 조회한다(2026-10-04 확인). 실내 연결은 별도 출입 이벤트가 필요하다. 큰 건물의 박공별 통행 세부와 막힘 줄 수는 크기 규칙으로 정했다(그림마다 손으로 맞춘 것이 아니다).
- 땅 표본은 오토타일이 아니다(이어 찍는 2×2·3×3 표본). 조수가 이 키트로 장소를 까는 실모델 시험은 아직 없다.

## 마을 문법 (2026-10-01 오후) — 「마을 만들어 줘」가 바둑판이 아니라 고른 변형 마을처럼

r1 시험(`verify-shots/assistant-beodeul-village/r1/fresh`)은 「마을」에 블록 격자 도시(60×59)를 깔았다. 사용자가 고른 변형 넷(포구·방앗간·포도원·장터)의 배치 문법을
`author_beodeul_town` 이 직접 짓게 했다 — `src/editor/tools/beodeulVillage.ts::buildBeodeulVillage`, `theme`: `river`(기본)·`coast`·`desert`·`snow`·`swamp`, `city` = 종전 블록 격자.

- 순서·수치 정본은 참고문서 `bd-pick-doc-village-grammar`(`tiledata/beodeul-city/references/bd-pick-doc-village-grammar.md`) — 물 앞섬 → 굽은 큰길(폭 2, 12~16칸마다 smoothstep 열쇠점, 이웃 높이 차 ≤ 거리/6, 다리 앞뒤 곧게 + `bd-bridge-arch`) → 뒷길·이음길 고리 → 큰길 남쪽 광장(판석 46칸 안팎)과 맞은편 앵커 → 길 북쪽 띠에 문이 길을 보는 집(물러앉음 0/1, 간격 1·2·마당) + 이음길 양옆 집 → 일터 덩이 → 집 옆 살림 → 밭·숲 덩이 → 큰 빈 덩이에만 덤불·풀꽃 → 한 칸 혹 정리(`analyzeCityForm` 같은 계산)·문 앞 BFS.
- 계획 격자(`occ`)와 실제 덮임(`cover`, 키트 투명 귀퉁이 제외)을 따로 든다. 길·물·광장을 모두 정한 뒤 칠하고(길 → 광장 → 물 순서 — `fill_region` 이 「벽」과 1칸 틈을 메우므로 물이 먼저면 물가에 혹이 생긴다), 그다음 찍는다.
- 집·앵커는 `appendStructurePlacement` 로 `map.structurePlacements` 에 남긴다 → `check_city_form` 이 키트 `parts.entrance` 로 문 앞을 알고 막다른 길로 세지 않는다. 고른 조각 건물 67종의 문 칸은 `scripts/content/beodeul-picks/find_pick_doors.py`(그림 맨 아래 띠에서 벽 색과 가장 다른 칸, 신호가 약한 통나무 벽은 가운데) → `tiledata/beodeul-variants/pick-doors.json` → 번들 키트 `parts`. `bake_picks.py` 가 다시 구울 때 붙인다.
- 고른 조각 바닥 표본 중 `ground-road/path` 는 태그 `road`, `ground-plaza/deck` 는 `plaza`(floor 유지) — 기후 마을의 길·광장을 도시 형태 자와 빈 바닥 지표(`beodeul-metrics.ts::emptinessOf`, 태그로도 「지은 칸」)가 읽는다.
- `cityForm.ts` 운하 판정: 축 길이 60% 미만만 걸치는 물(바닷가 띠·연못)은 운하로 보지 않는다(포구·사막에 「운하가 곧다」 거짓 경고가 났다).
- 시작 맵(`beodeulStarterMap.ts`)은 블록 격자의 columns/bands 를 쓰므로 `theme:"city"` 를 명시한다.
- 조수: 노트(`beodeulTownRoute.ts`)·시스템 프롬프트가 말에서 theme 을 고르게 하고, 36×30 보다 작은 빈 시작 맵(새 프로젝트 20×15)이면 mapId 대신 새 맵을 만들게 한다.
- 참고문서 `read_tileset_reference`·`list_tileset_references` 는 빈 문자열 id 를 없는 것으로 본다(엄격 스키마 모델이 `imageId:""` 를 채워 보내 12번 실패하고 멈췄다).

검증(LLM 없음): `bun scripts/qa/beodeul-village-offline.mts [--2x] [theme:seed[:WxH] …]` → `verify-shots/assistant-beodeul-village/offline-village/`.
5 theme × seed 3·11·29 + 88×56: 문 앞 도달 전부, `check_city_form` 경고 0, 20×15 화면 빈 바닥 최대 river 0.33·coast 0.33·swamp 0.37·desert 0.46·snow 0.60(얼음 못이 걸음 바닥으로 세어짐).
실모델(`scripts/qa/beodeul-village-plain.mts --round r2`, opencodex/gpt-6-astra, 「버들항 느낌으로 강가 마을 하나 만들어 줘」): `author_beodeul_town` theme river 88×56 1회 → `check_city_form` 이상 없음 → 도달 전부. 증거 `verify-shots/assistant-beodeul-village/r2/`(attempt1 = 빈 id 실패, attempt2 = 곧은 길 경고 2건 → 수리 전).

남은 약점:
- 집은 늘 길의 북쪽에만 선다(문이 남쪽). 큰 맵(88×56)은 남쪽 3분의 1이 밭·숲으로 남는다 — 뒷길을 한 줄 더 내는 일은 하지 않았다.
- 늪 집은 기둥 위가 아니라 진흙 섬에 선다. 설원은 얼음 못 화면이 빈 바닥 40% 를 넘는다. 바닥 표본은 오토타일이 아니라 경계가 칸 단위로 각지다.
- 조수는 문법 문서를 읽지 않고 도구를 바로 불렀다(도구가 문법을 지니므로 결과는 같다). 마을 이름·NPC·출입구 이벤트는 짓지 않는다.
- 버들항 던전·필드 문법 도구는 없다(던전은 참고문서 beodeul-picks-dungeon 을 읽고 키트를 찍는다, 필드 길은 `author_wild_route` 의 버들항 시공).

### 마을 형태 넷 + 이어진 밭 울타리 (2026-10-11)

위 문법은 늘 「굽은 큰길 → 큰길 위 광장 → 그 북쪽 앵커」 한 구도였다. 마을 실험(`~/exp-chunks`, 보고서 village-forms.html)에서 이것이
설정문·취향 문서·견본에서 온 고정관념으로 확인돼 `author_beodeul_town` 에 **`form`** 을 더했다(`beodeulVillage.ts` 머리 주석·`resolveVillageForm`).

| form | 뼈대 | 앵커(「모이는 곳」 `data.gathering`) |
|---|---|---|
| `plaza` | 위 문법 그대로 | 큰길 위 광장 |
| `street` | 큰길·뒷길 고리, 광장 단계 없음 | 다리 머리 / 포구 길 어귀 / 못으로 드는 어귀 / 마을 어귀 — 문 맞은편 판석 어귀(blob 2.6×1.4)+우물 |
| `riverbank`(river 만) | 강을 늘 서쪽(0.2W)에 두고 동쪽 둑에 남북 둑길(폭 2)·뒷길·위아래 이음길 고리, 가운데 들길이 동쪽 끝까지(입구) | 들길이 둑길과 만나는 어귀 |
| `scatter` | 오솔길 폭 1(풀밭 마을은 `버들항 모랫길`), 갈래길 2~3개, 집 간격 4~8, 뒷길 없음 | 오솔길 갈림길 |

- form 을 빼면 **본 시공과 따로 뽑은 난수**로 고른다(`DEFAULT_FORMS`). 2026-10-11 후속부터 기본 후보에 plaza 가 없다(river: street·riverbank·scatter, 나머지: street·scatter) — 「중심 광장을 기본으로 삼지 말 것」인데 늪 seed 7 이 광장으로 나왔다(조수 실입력창 검수). 장터는 form:"plaza" 로 명시한다. 그래서 form 을 뺀 예전 seed 는 형태가 바뀔 수 있다.
- riverbank 에서 강은 서쪽(0.2W)이다. 방앗간·물레방아는 서쪽 둑에 서고, 바퀴 곁 널다리와 들길 근처 나루(아래 절)로 건넌다.
- 흩어진 마을의 갈래길은 끝을 정하지 않고 길게 깐 뒤, 막다른 칸 깎기를 남은 것이 없을 때까지 돌려 마지막 집 문 앞에서 멈추게 한다(광장 마을은 예전처럼 6번).
- **밭 울타리**: 풀밭 마을(바닥이 재료인 river·coast)의 밭 둘레 1칸과 흩어진 마을 텃밭(4~5×3, 밭두렁 `bd-pick-wizard-tower-bed-*`·배추 상자)에
  공용 기초 칩셋 `beodeul_ground` 의 `bdg-woodland-fence-horizontal/vertical/corner` 를 `translateTiles` 로 옮겨 층 3에 잇는다(`beodeulVegetationTools.ts` 공동마당과 같은 방식, 통행·우선순위 복사).
  조각이 셋뿐이라 위 모서리는 가로 조각, 아래 모서리만 모서리 조각. 문 한 칸(밭은 길에 가장 가까운 변, 텃밭은 집 문에 가까운 변)은 비우고 계획 격자에서 PROP 로 막아 나무가 앉지 않게 한다. 울타리 두른 밭은 모서리를 깎지 않는다.
- 조수 쪽: 도구 설명이 「form 은 마을이 왜 여기 생겼나에서, 광장은 장터일 때만」을 말하고, 참고문서 `bd-pick-doc-village-grammar` 1절 「이 순서를 바꾸지 않는다」를 형태 표로 바꿨다(그림 `grammar-forms-river-7` = 같은 seed 네 형태).
- 프로브(LLM 없음): `bun scripts/qa/beodeul-village-forms-probe.mts [--seeds 3,7,11] [--themes …] [--forms …] [--out …]` — 48판 모두 문 앞 도달·막다른 칸 0·경고 0. 시트 http://mdc-server:18301/village-forms-editor.html.
- 남은 약점: ~~포구 street 는 광장만 빠진 plaza 와 비슷하다~~(아래 절에서 물가 큰길로 수리). 흩어진 포구는 물가 길·포구 길 고리가 남아 덜 흩어진다. 울타리 조각이 숲 계열 하나라 모래·눈·늪 마을엔 두르지 않는다. 형태를 고르는 판단은 조수 몫이다.

### 그림자·자연 물가·놓기 규칙·지형 (2026-10-11 사용자 8가지 지적 + 「지형 먼저」)

지적: 나무·수풀·선인장에 그림자가 없어 공간감이 없다 · 집 밑 접지면이 어색하다 · 물레방아 같은 건 「물 위에만」 같은 **규칙**을 AI 가 반드시 따라야 한다 ·
다리 아랫부분이 투명한 것처럼 보인다 · 물이 성 안 공사한 물길(돌 둑)이라 바다·강엔 흙 둑이어야 한다 · 오아시스 풀밭 가장자리가 네모 · 밀도가 너무 높다 · 높이가 바뀌는 곳이 없다.

- **자연 덧그림 팩 `beodeul_nature`**(공용 번들, `public/assets/beodeul-nature/chipset.png` 16열 · 목록 `src/assets/beodeulNatureCatalog.json` ·
  정의 `src/project/defaults/beodeulNature.ts` · 생성 `python3 scripts/content/build-beodeul-nature.py`). 모두 투명 2층 덧그림, 1층 바닥은 그대로.
  - 그림자 264종: 키트 그림을 합성해 알파로 모양을 잰다. 밑이 좁은 것(나무·야자·선인장)은 밑동 타원(속+바깥 두 단, 오른쪽 아래로),
    밑이 넓은 것(집·소품·바위)은 아래 65% 를 (3~4,2~3)·(6~7,4~6)px 비낀 그림자 + 밑변 접지 2px. 첫 판 2px 비낌은 물체 테두리에 묻혀 안 보였다.
    집(입구 부품이 있는 키트)은 밑동에 밟힌 흙 띠 2~3px 를 그림자와 미리 섞어 둔다(`soilTiles`).
  - 물가: 8이웃 비트(북서1 북2 북동4 서8 동16 남서32 남64 남동128) 256가지 → `bankGrass`(잔디 둑: 짙은 풀 1px·흙 3px·젖은 흙·물가 그늘·얕은 물빛),
    `bankLawn`(오아시스 못), `bankSnow`(얼음 못 눈 둑), `bankBog`(늪 물 이끼 둑), `bankMud`(이끼 늪 칸에 진흙 둑). `edgeLawn` = 모래 위 풀밭 가장자리(4±1.8px 굽이).
    모서리는 거리 장(`rounded_depth`)이라 둥글고, 굽이는 16px 주기라 이웃 칸과 이어진다.
- 마을 시공기 12b 단계(`beodeulVillage.ts`): 강·포구는 운하 오토타일을 몸통 물 23152 한 가지로 펴고(`flattenWater`) 물 칸에 둑 덧그림, 사막 못은 둘레를
  모래 그대로 두고 풀밭 덧그림(바깥 고리 blob wobble 0.22, 모래에 닿거나 물 이웃 ≤1 인 물 칸은 풀밭으로), 설원·늪도 위 표. 그다음 찍은 키트마다 그림자 —
  2층이 빈 칸만(길·광장 칸은 2층이 길 가장자리라 그림자가 없다).
  **팩의 칸은 모두 ★(통행 + 상위)** — 통행은 위층부터 ★·빈칸을 건너뛰고 처음 만난 타일이 정하므로, ○ 로 두면 2층 둑이 1층 물의 × 를 덮어 물 위를 걷는다
  (첫 판에서 그랬다. `editor-ai-tools.md` 「나무 밑 그림자」 와 같은 함정). 2층은 캐릭터 밑 묶음이라 상위여도 인물 아래에 그린다. 같은 칸 번호를 4층에 쓰면 인물 위에 그려지므로 4층엔 두지 않는다.
- **키트 놓기 규칙** `src/project/kitPlacementRules.ts` — `stamp_object` 가 찍기 전에 1층 칸 뜻(태그 water / 이름 「얼음」)으로 검사해 어기면
  `ToolError(code "kit-placement-rule")`. 조수·마을 시공기·사람이 모두 이 도구를 지나므로 프롬프트가 아니라 실행기가 지킨다.
  물레방아 = 바퀴 밑 줄에 물·뭍 둘 다 · 배·물새·수련 = 전부 물 · 엎은 배 = 뭍 · 얼음 배·구멍·낚시 줄 = 얼음 · 잔교 몸통 60%/머리 80% 물 · 말뚝 밑 줄 물 ·
  생선 시장 밑 줄에 물 하나 이상 · 다리 = 바닥 가운데 줄 절반 이상 물. 표에 없는 키트라도 입구가 있는 건물은 물 칸에 못 짓는다(기둥 집·생선 시장·물레방아·등대 예외).
  맵에 높이 단(relief)이 있으면 `checkReliefPlacement` 도 본다 — 두 단 걸침·경사로 칸·남쪽 높은 칸 가림 거절(`code "relief-placement-rule"`, 바닥 칠·그림자·다리 예외). `editor-ai-tools.md` 「stamp_object 높이 단 규칙」.
- 다리: 옛 `bd-bridge-arch` 는 아래 두 줄이 운하 돌 둑 그림이라 자연 물가 위에서 투명한 판처럼 보였다 → 흩어진 마을은 `riverside-mill-plank-footbridge`,
  그 밖은 `mountain-pass-stone-bridge`. 다리 키트는 5칸, 강은 4칸이라 오른쪽 한 칸이 풀밭에 떠 아치 밑이 풀이었다 →
  `widenForBridge` 가 다리 자리 앞뒤(난간 위 한 줄 ~ 아치 아래 한 줄, 6줄)를 5칸 폭 물로 넓혀 다리 양 끝이 양쪽 둑에 얹힌다(물가 둑 덧그림이 넓어진 모서리를 둥글게 만든다).
- **물레방아는 방앗간과 짝**(사용자 「옆에 짝이 맞는 건물이 필요」): 바퀴 그림은 왼쪽 위 굴대 들보가 왼쪽으로 뻗는다(원본 강가 방앗간도 들보가 왼쪽 뭍 기계에 닿는다).
  그래서 바퀴는 강 **서쪽** 둑에 걸치고(밑 줄 왼쪽 한 칸 뭍·오른쪽 물, `claimKeepingWater` 로 물을 덮어쓰지 않음) 방앗간 `bd-house-h109_0` 오른쪽 벽을 바퀴 왼쪽 열에 붙인다
  (방앗간 밑줄 = 바퀴 셋째 줄 → 들보가 벽 아래쪽에 닿는다). 방앗간 문 앞 길이 길망에 닿지 않으면 바퀴를 놓지 않고 동쪽 둑에 방앗간만 둔다 — 들보가 허공을 가리키는 바퀴는 없다.
  물가 띠 마을은 서쪽 둑이 나루로만 이어지므로 바퀴 곁에 널다리(5×4, 강 4칸 + 동쪽 둑 1칸)를 놓고 양 끝을 길에 잇는다(`data.millBridge`). 나루는 방앗간을 먼저 이을 수 있게 방앗간보다 먼저 내되, 널다리 줄과 10줄 이상 떨어진 줄을 고른다(붙어 있으면 나루가 쓸모없어 보인다). 물레방아·방앗간은 강 골(0단) 안 서쪽 8칸에 앉는다. 자연 물이면 바퀴 밑 줄 물보라 막대(운하용)를 지운다.
- 물가 띠 마을 **나루**: 들길 근처 줄에서 강 양쪽 둑으로 길을 내고 동쪽 둑에 나룻배·계류 말뚝(`data.ferry`). 서쪽 둑 들길은 길망에서 떨어져 있지만
  물에 닿는 길이라 `check_city_form` 의 떨어진 길(`isolated`)에서 뺀다(`cityForm.ts` `reachesWater`).
- 포구 street: 큰길이 물가를 따라 굽고 모이는 곳은 「잔교 앞 물가 큰길」. 그래도 「광장 마을에서 광장만 뺀 모양」이라는 지적이 남아 아래 후속 절에서 일하는 물가부터 정하게 바꿨다.
- 밀도: 숲 덩이 시도 40→30·크기 3~6→3~5, 화면(20×15)당 빈 바닥 상한 46%→58%(모래·눈 62%→74%), 덩이 풀꽃 2~4→1~2, `dress_beodeul_ground` 풀꽃 점 잔디 3.5%→1.6%·간격 5×3.
  그림자가 생겨 덜 채워도 땅이 평평해 보이지 않는다. 사막 나무는 야자 위주(「palm palm cactus」).
- **지형 먼저(terrain, 2026-10-11 사용자 「지형을 먼저 기획하고 그 위에 마을을 — 지금은 순서가 반대, 경사로도 어색」):** 옛 12c(다 지은 뒤 남은 가장자리를 올리고 2칸 계단을 떨굼)를 지웠다.
  0단계 `beodeulTerrain.ts planVillageTerrain` 이 물 자리 직후 단 높이를 정하고(선택지 `terrain` = terraces·hillside·basin·flat, 생략 시 seed), 뒷단계가 따른다:
  북쪽 뒷길은 등고선(`northSeam`)을 따라가되 절벽 끝과 풀밭 한 줄(`RIM_GAP`)을 띄우고(사용자 「절벽 위에 길이 바로 깔리면 어색」) 골(`coves`)을 건너지 않는다, 등고선에 걸린 다른 동서 길은 남쪽 한 줄을 길 높이로 올린다(프로브 `rim` = 절벽 끝 위 길 칸, 0) · 3b 에서 길이 단을 건너는 곳마다 낮은 쪽 2칸에 매끈한 경사로(ramps 1~4, 곧은 단면 4칸 = 층계참·경사로 2·층계참, 옆구리 길 금지, 굽은 곳이면 높은 쪽 길 칸을 깎아 최대 6칸 민다) ·
  `fits` 가 발자국 한 단·가림 규칙(남쪽 k줄 ≤ L+k−1)·문 앞 같은 단을 본다(광장·앵커·물레방아·밭·울타리·나무·소품 모두) · `linkToRoad` 는 `reliefAllowsStep` 로만 넓힌다 · 막다른 길을 깎아 아무 데도 안 오르는 경사로는 표시를 지운다.
  모양 규칙의 이유: 3/4 렌더는 **남쪽을 보는 절벽 면만** 그린다. 첫 판(강 골짜기 = 남북 등고선, 분지 = 오아시스 고리, 강 골 = 물굽이 따라 사선)은 단 가장자리가 가는 선·1칸 계단으로 보여 「지형과 길이 이상하게 이어진다」는 지적을 받았다 → 등고선은 동서·한 줄 꺾임, 골은 곧은 세로 기둥만.
  `m.relief` 는 찍기가 끝난 뒤(칠하기·찍기 도구가 높이를 모른다) 넣는다. `data.terrain`, `data.relief = {terrain, note, levels, ramps, cuts, fails, straddle, rampsOffRoad}`. 계단 코드(5~8)는 쓰지 않는다.
- **남은 점 정리 (같은 날):** 늪 `ridge`(마른 둔덕 — 늪 단계가 높은 단 칸을 물로 바꾸지 않는다) · 골 가장자리 덤불 띠(옆 절벽 면은 r3 사용자 결정으로 그리지 않으므로 선 양쪽에 덤불·나무) ·
  앵커: 자리 ±16칸(2026-10-11 ±10 → ±16, 물가 띠 계단식 88×56 seed 11 은 ±10 안이 다 단 경계)·1~2칸 물러앉힘(문 앞 토막 길), 낮은 맵(포구 큰길 y≈15)은 뒷길을 더 올려 큰길 북쪽 띠를 9줄로, 모이는 곳은 길이 곧은 자리로 · 폭 2 길이 한 줄씩 왔다 갔다 하면 겹친 줄이 곧게 이어지므로 등고선은 한 방향으로 꺾어 가다 끝에서 돌아서고(10~13칸), 포구 물가 큰길은 물가에서 3·4·5·4칸.
  프로브 128판(늪 ridge 포함): 경고 0, 미도달·막다른 길·걸침·계단·절벽 끝 길 0, 곧은 길은 평지 강가 88×56 의 45칸(한도)만.
- **울타리 마감**: 밭·텃밭 울타리는 `beodeul_nature.fence` 조각(공용 숲 울타리 643·644 화소로 `build-beodeul-nature.py` 가 만든 모서리 tl·tr·bl·br — 후속 절에서 둥근 모서리로 바꿈, 문 옆 끝 endW·endE·endN·endS)을 쓴다. 옛 셋(가로·세로·T)은 위 모서리 난간이 반 칸 삐져나가고 세로와 5px 끊겼다(사용자 「외곽 마감이 별로, 이어져 있다는 느낌이 안 든다」). 문은 모서리 옆 칸을 피한다. 저장된 프로젝트의 옛 팩이 짧으면 시공기가 팩을 새로 만든다(이식 원본일 뿐).
- 프로브: `bun scripts/qa/beodeul-village-forms-probe.mts [--terrains terraces,flat]` 가 theme × form × terrain × seed 로 짓고 `stairs`(0이어야)·`straddle`(두 단 걸친 키트, 0)·`offRoad`(길 아닌 경사로, 0)·`rfail`(못 놓은 건널목)·문 앞 도달을 찍는다. 2026-10-11: 기본 크기 87판 + 88×56 29판 모두 stairs·straddle·offRoad·rfail·미도달 0.

### 높은 단 오르막·고립 방지·포구 길가·둥근 울타리 (2026-10-11 후속)

- **실측부터:** 기본 크기(56×44 안팎)에서는 2단이 한 판도 생기지 않는다(2단은 `s2 = 첫 등고선 − 11 ≥ 4` 일 때만 — 큰길이 y≈27 넘어야). 88×56 seed 7 에서 포구 길가·사막 basin·설원 hillside 에 2단(4~12줄)이 생겼고 오를 길이 없어 거기 밭 울타리 문까지 못 갔다.
  더 큰 문제는 **1단 자체의 고립**이었다: scatter(모든 theme)·포구 plaza 는 북쪽 뒷길이 없어 경사로 0곳, 1단 전부가 입구에서 안 닿았다(문 앞 BFS 는 doorFronts 만 세서 경고 0). 강 마을은 골 너머 작은 대지가 고립됐다. 울타리 문은 평지에서도 문 바로 밖에 나무가 앉거나 이웃 밭 울타리 사이 골에 갇혀 판마다 1~5개가 못 닿았다.
- **3a 단 위로 오르는 길**(`beodeulVillage.ts` 「3a.」): 같은 단 4-이웃 덩이마다 길(갈래길 제외)이 하나도 없으면 바로 아랫단 동서 길에서 곧은 오르막(폭 1)을 북쪽으로 내고, 단 위에서는 절벽 끝과 풀밭 한 줄을 띄워 등고선을 따라 윗길(`hStreetFn`)을 **맵 가장자리까지** 낸다(마을 밖으로 이어지는 밭길·숲길·고갯길 — 막다른 길이 아니다). 양쪽 끝이 골이면 오르막 둘로 고리. 경사로는 3b 가 그대로 놓는다(곧은 단면 4칸, 옆구리 길 금지 — 오르막 양옆 열에 다른 길이 있는 자리는 고르지 않는다). 오르막 자리는 단 가장자리·아랫길이 앞뒤 2칸 곧은 열만. 풀밭 마을의 윗길·오르막은 모랫길(`trackCells`).
  **오를 길을 낼 수 없는 덩이는 아랫단으로 내린다**(좁은 조각·후보 없음) — 아직 길·물만 있을 때라 키트가 두 단에 걸칠 일이 없다. 내린 덩이가 다른 단과 합쳐질 수 있어 바뀐 것이 없을 때까지 다시 센다. `data.relief.lowered`·`climbs`, `data.upper[] = {level, lanes, path, to, use, lookout, reach}`.
- **단 위의 쓰임**(억지로 채우지 않는다): 풀밭 마을은 그 단 안에서 먼저 밭 두 번까지(`use: 밭`), 그 밖 theme 은 윗길 양옆 숲·덤불 덩이 셋까지(`숲길`/사막 `덤불 언덕`), 오르막 머리 절벽 끝에 전망 의자(풀밭 `bd-prop-bench_wood`, 설원 `snowfield-bench` — 없는 theme 은 두지 않는다).
- **울타리 문 = 걸어갈 수 있는 자리만**: `planFence` 가 길에 가까운 변부터, 문 바깥 칸에서 길까지 실제로(단은 경사로로만, 흩어진 마을 갈래길 끝 토막·그 경사로는 믿지 않음) 걸어갈 수 있는 자리를 고르고 그 걸음 자리를 `CLEAR`(바탕 그대로, 나무·소품·밭이 앉지 않음)로 비운다. 문을 못 잡는 밭은 두지 않는다(풀밭 마을). 포도밭 키트(`vineyard-vine-field`)는 제 울타리를 가진 작은 밭이라 울타리 밭 안에 넣으면 울타리가 겹치고 안이 ㄱ자로 비어 풀밭 마을에서는 쓰지 않는다.
- **갇힌 빈터 열기**(13 앞): 높은 단 위 걸을 수 있는 칸이 집 뒤·나무 사이·절벽 끝 띠에 갇히면, 닿는 칸에서 그 빈터까지 **걷어 낼 찍기(기록하지 않는 나무·덤불·풀꽃·소품)를 가장 적게 지나는 길**(0-1 BFS)을 찾아 그 찍기들을 되돌린다(찍기 전 네 층을 남겨 두었다가 복원, 그 그림자도 지움). 울타리 안 칸(밭·텃밭)은 문으로 드는 울타리 안이라 세지 않는다. `data.opened`. 집·울타리·앵커는 걷어 내지 않는다.
- **포구 길가(theme coast form street)** — 「광장 마을에서 광장만 뺀 모양」 지적. 출력을 다르게 강제하지 않고 입력(왜 여기)에서: 포구 길가 마을은 배를 댈 물가 때문에 생겼다. 해안선을 7칸 평균으로 보고 가운데 띠(0.38~0.62W)에서 물이 가장 깊이 파고든 만에 **큰 잔교·생선 시장·모이는 곳**, 거기서 양쪽으로 11~17칸마다 한 자리 — 그 구간에 만이 뚜렷하면 **작은 부두**(`jetty-west` + 거룻배·계류 말뚝), 아니면 가장 넓은 모래톱에 **그물 말림터**(시렁·그물대·엎은 배·통발을 물가 바로 위 한 줄로). 큰길 열쇠점은 그 자리들이다: 만·잔교는 물가에서 3칸(부두가 길에서 바로 뻗는다), 말림터는 6칸·이웃보다 2줄 이상 안쪽(큰길이 말림터를 돌아 안쪽으로 휜다). 폭 2 길의 한 줄이 40칸 넘게 곧으면 그 사이에 열쇠점을 넣어 안쪽으로 휜다(seed 42 64×40 의 64칸 곧은 길). 집은 큰길 북쪽 한 줄이 바다를 본다. 뒷길은 잔교 **한쪽**(넓은 쪽)에 짧은 고리 하나(폭 1, 양 끝 이음길) — 잔교·앵커를 감싸면 가운데를 두른 네모가 된다. 이음길은 부두·잔교 열에서 4칸 넘게 비켜 큰길을 건너는 십자 길을 만들지 않는다. 모이는 곳은 판석 어귀 대신 잔교 곁 물가 소품 두셋. 결과 `data.work`(말림터), 요약의 앵커에 생선 시장.
- **둥근 울타리 모서리**(사용자 「울타리는 네모보다 모서리가 둥근 사각형 느낌으로」): `build-beodeul-nature.py` `ROUND_CORNER` — 643·644 의 실제 화소 색(기둥 A·B·C, 가로 난간 D·E, 세로 난간 F·G, 판 H·I)으로 손으로 고른 행 문자열. 가로 조각과 만나는 쪽은 난간 두 줄(5~7·10~12줄), 세로 조각과 만나는 쪽은 6~8열. 3/4: 땅 위 반지름 7칸 남짓 사분원을 난간 높이(위 −7, 아래 −2)만큼 올린 곡선이라 위 모서리는 칸 아래쪽, 아래 모서리는 칸 위쪽으로 휜다. 빛은 누운 곳은 윗줄, 선 곳은 왼쪽 열. 칸 번호는 그대로(1529~1532)라 저장된 프로젝트도 새 그림을 쓴다. 울타리 밭은 네 귀퉁이 칸을 풀로 남긴다(둥근 곡선과 맞춤). 비교 그림 http://mdc-server:18301/village-terrain-next.html.
- **지형 도입으로 바뀐 것**: 같은 seed 라도 2026-10-11 지형 도입(과 이 후속의 기본 형태·포구 길가) 이후 예전과 다른 마을이 나온다. 이미 지은 마을 맵은 그대로다 — 지형을 넣으려면 다시 지어야 한다(맵 전체를 다시 깔아 손으로 고친 부분은 사라진다). **마을 집이 이미 선 맵에 같은 mapId 로 덮어 짓기는 완성된 집 보호(`houseProtection.ts`, 키트 집은 `structurePlacements` 로 보호된다)에 걸려 조수 경로(runTool)에서 거절된다** — 실측: 같은 mapId 재시공 → 「완성된 집의 보호 영역은 AI가 변경할 수 없습니다」, `remove_map` 뒤 같은 id 로 새로 짓기 → 성공. 그래서 안내는 「remove_map 으로 지우고 같은 id 로 새로 짓는다」(편집기에서는 맵 파괴 승인을 거친다, 그 맵의 이벤트도 사라진다). 도구 설명과 결과 요약에도 적었다. 시공 시작에 그 맵의 옛 `map.relief` 를 지운다(높이를 아는 `stamp_object`(#2420)가 옛 높이로 키트를 거절하지 않게, 새 relief 는 12c) — 프로브 `--rebuild` 가 집 보호 기록만 걷은 「relief 가 남은 맵」에 다시 지어 stampFailed 0 을 본다. 요청 지형이 theme 에 없으면(예: desert 에 terraces) 요약 **맨 앞**에 「요청한 지형 X 는 이 테마에서 못 쓴다 → Y 로 지었다(가능: …)」, `data.requestedTerrain`·`terrainSwapped` (경고에만 두었더니 모델이 「계단식 비탈을 구현했다」고 거짓 보고했다).
- 프로브 새 열: `upMiss`(높은 단 걸을 수 있는 칸 중 입구에서 못 닿는 칸, 울타리 안·집/앵커 키트 사각형 안 투명 귀퉁이 칸 제외 — 0, 못 닿는 칸 앞 8개는 `data.upperLost`·프로브 `lost`), `gateMiss`(못 닿는 울타리 문 — 0), `reach1`·`reach2`(%), `gate2`, `up2`(=data.upper), `--cases theme:form:terrain:seed[:WxH]`, `longest`(가장 긴 곧은 길).
- **곧은 길 45칸 미만(2026-10-11 후속)**: 폭 2 길은 한 줄만 어긋나면 윗줄·아랫줄이 이어져 곧은 줄로 남고, 열쇠점 높이 차는 `easeKeys` 가 가로 거리 1/6 로 묶는다. ① 포구 광장·흩어진 마을의 물가 길은 이웃 열쇠점이 같은 높이(물가가 한 칸 물러나 -3/-4 번갈이가 상쇄)면 한 칸 더 올린다(88×56 seed 11 곧은 물가 길 47~51 → 36 이하). ② 강가 큰길은 다리 앞뒤 곧은 끝 바로 옆 열쇠점을 12칸 거리·높이 차 amp(2)로 둔다(`wavy(..., tight)`, 88×56 seed 7 의 45칸 → 37). 집 키트 사각형 안 투명 귀퉁이(박공 지붕 위 모서리)는 지붕 그림에 속해 단 위 땅으로 세지 않는다(포구 길가 88×56 seed 11 — 오르막 바로 옆 지붕 귀퉁이 한 칸이 절벽·경사로 옆구리·지붕에 둘러싸였다).
- 프로브 288판(5 theme × 형태 × 지형 × seed 3·7·11 × 기본·88×56·64×40) + `--rebuild` seed 7 32판: unreached·dead·iso·fail·rfail·straddle·offRoad·rim·stairs·upMiss·gateMiss·warn 모두 0, 가장 긴 곧은 길 44. `cut`(길이 언덕을 깎은 칸, 오류 아님)은 25칸. 시트 http://mdc-server:18301/village-terrain-next.html.
  PROBE_RESULT_PLACEHOLDER
- 남은 것: 게임 화면 위쪽 검은 띠(`playSceneCamera.ts` `reliefTopOverhangPx`)·경사로 옆 1px 세로선·경사면 명암은 렌더러 쪽 일이다(다른 작업). 포구 길가의 등대는 큰길이 동쪽 곶까지 지나 자리가 없어 대개 빠진다. 윗길이 얇은 2단(4~5줄)에서는 맵 윗가장자리 바로 아래를 지나 단 위가 거의 길로만 보인다.

## 작은 마을 길·마당 구도 보정 (2026-10-04)

`naturalize_beodeul_hamlet({mapId})`는 공용 소규모 집 3~5채의 전체 배열/원점을 먼저 확인하고 원본 집·나무·출입을 보존한 채 큰길/광장과 흙 접근로/마당을 구분한다. 옛 순환 포석 샛길과 흩어진 작은 풀 장식은 정리한다. 텃밭·빨래 마당·식생 군락은 빈 칸과 문 앞 도달성을 확인하고 배치한다. 임의 배치 마을/높이 있는 맵에는 사용하지 않는다. 새 houseCount 시공은 이 구도 후 일광을 자동 적용한다. 공용 source beodeul_ground 368칸(기존304 불변), 문서 tiledata/beodeul-ground/HAMLET.md, 정상/오류 및 full 네 층 예제는 참고문서 beodeul-ground-dressing. SQLite와 플레이어 근거 verify-shots/beodeul-lived-village.


## 우물 공동마당으로 원본 마을 재배치 (2026-10-04)

`compose_beodeul_courtyard_village({mapId})`는 인식된 54×30 예제의 원본 민가 5채+교회를 그대로 옮겨 54×34 공동마당 마을로 만든다. 북쪽 세 집은 우물·빨래 마당을 공유하고 남쪽 두 집은 숲/텃밭 가장자리에 둔다. 교회 길과 외곽 숲 입구를 연결한다. 이벤트/높이/다른 맵의 전이 도착점이 없는 예제만 허용하며 기존 배치 변경을 명시적으로 요청했을 때 사용한다. 단순 꾸밈에는 사용하지 않는다. 원본 건물 전체 배열, 시작점(18,17), 다른 두 출입 시험 맵을 보존. 공유 참고문서 COURTYARD.md + courtyard-example.json 전체 네 층/graft 규칙 + 실제 PNG를 새/기존 city·ground 양쪽에 배포한다. 재생성은 scripts/content/prepare-beodeul-courtyard-references.mts, 근거 verify-shots/beodeul-shared-village. 이 도구는 출입 이벤트를 새로 만들지 않는다.


## 공동마당 식생·울타리/돌벽 보정 (2026-10-04)

refine_beodeul_courtyard_vegetation({mapId})는 인식된 54×34 예제의 건물/나무 전체 배열을 확인하고 집·길·마당·시작점을 유지하며 흩어진 나무/덤불을 수관이 앞뒤로 겹친 공용 숲 8덩어리로 교체한다. 높이 있는 풀은 숲 밑동에만 겹치고 줄기의 X를 상속하는 ★다. 짧은 문틈 울타리 두 조각을 제거하고 실제 텃밭 3변을 연속 레일/수직선/모서리로 연결한다. 북쪽은 큰길에서 들어오는 면이다. stone 박공은 정면 돌벽과 같은 원본 질감으로 통일한다. 원본 지붕/알파/창문/문 개수/집 위치를 유지한다. 이벤트/높이/다른 이벤트의 전이 도착점/수정된 나무·별도 지형/기물은 거부, 반복은 no-op. source WOODLAND.md, build 하네스가 이전368칸을 보존한다. 공용 문서/정확한 4층 예제/전체 graft 규칙은 새·기존 city/ground 모두 배포하며 각 MD 12만자 이하로 분리한다. 전용 player.html과 SQLite 재로드 근거 verify-shots/beodeul-depth-fix.


### 마을·붓 숲 = 이어진 수관 오토타일 (2026-10-22, 「숲 오토타일을 제대로 적용해야 함」)

- 사용자가 village-diversity-1 마을들을 보고 지적했다. 강가·해안 마을 숲(아래 woodland 보정의 composer)이 짙은 풀 위에 낱 나무로 서서,
  숲 덩이가 아니라 듬성듬성한 과수원·네모 짙은 풀 판으로 읽혔다. 단 경계에서 짙은 풀이 곧게 잘렸고, 산골 숲도 띄엄띄엄했다.
- `author_beodeul_town` 의 모든 숲(둘레 숲·`woods: dense`·`terrain: highland` 산마루)은 설원과 같은 **이어진 수관 오토타일**
  (`BEODEUL_NATURE.forestCanopy`, `append-beodeul-forest-canopy.py`)로 덮는다. 정본은 `src/editor/tools/beodeulForest.ts`:
  - `shapeBeodeulCanopyMask` 는 칸을 다듬는다. 이웃 셋 이상이 숲인 칸과 오목한 ㄱ자 홈(첫 바퀴만, 붓은 끔)을 메우고,
    2×2 덩이에 못 드는 칸, 마을 16칸(설원 12칸)·붓 9칸 미만 덩이, 평균 두께가 minExtent 미만인 띠(단 사이 산울타리)를 지운다.
    덩이 크기 기준은 동·서·남 맵 끝에 걸친 덩이만 절반으로 봐 준다(북쪽 끝 작은 덩이는 맵 위에 뜬 조각으로 읽힌다).
  - 산골(highland) 마을은 그 전에 3칸 격자 값 잡음으로 숲 가장자리를 0~2칸 깎는다(작은 숲 덩이·숲속 빈터에 쓰면 숲이 너무 줄었다). 4칸 이하 닫힌 구멍은 메운다.
    다듬기 뒤 5칸 이상 곧게 남은 변(한 칸 계단은 같은 변으로 이어 본다)에는 5~8칸마다 너비 2~3·깊이 1~2칸(7칸 이상 변은 2칸) 홈을 판다. 10칸 미만 변의 홈은 가운데 근처에 둔다. 깎은 칸·홈은 다듬기의 「이웃 셋 메우기」가 다시 메우지 못한다 —
    메우게 두면 길 간격 끝까지 도로 차서 곧은 빈터 벽으로 돌아갔다(VQA r6~r8).
  - 숲 남쪽 끝 줄(2층) 칸의 동·서 이웃이 다른 단이면 그 칸을 뺀다(최대 3번) — 2층은 단 동서 끝 1px 선보다 먼저 그려져 수관이 선에 썰렸다.
  - 48칸 미만 덩이에는 홈을 파지 않고, 100칸 미만 덩이 중 속 칸(8이웃이 모두 숲) 비율이 15% 미만인 뼈대 덩이는 지운다 — 2~3줄 가지가 얽힌 덩이는 수관이 끊긴 낱 나무 조각으로 읽혔다.
  - 수관은 같은 높이(relief `lv`) 칸끼리만 잇는다. 단 경계를 가로질러 이으면 단마다 들림이 달라 수관이 가로로 썰려 보인다.
    예전 「단 동서 끝 덮개」(단 끝 1px 선을 숲으로 가리기)는 이 썰림을 만들어 없앴다.
  - `planBeodeulCanopy` 는 이웃 비트·P×P 위상으로 수관 칸을 고른다. 숲 남쪽 바로 아래 칸에는 숲 그늘(이끼 치마)을 깐다.
  - `writeBeodeulCanopy` 는 nature 칸을 대상 칩셋으로 옮긴다.
- 맵 밖은 동·서·남으로만 숲이다. 북쪽 맵 밖을 숲으로 보면 맨 윗줄에 덩이 아래 반쪽(뒤집힌 듯한 꼭대기, 줄기만 남은 줄)이 그려졌다.
- 남쪽도 숲인 수관 칸은 **3층**, 숲 남쪽 끝 줄은 2층이다. 2층은 relief 의 동서 끝 1px 선(over 띠)보다 먼저 그려져 그 선이 숲을 세로로 갈랐다.
  남쪽이 숲인 칸 앞에는 인물이 설 수 없어 3층 상위여도 머리를 가리지 않는다.
- 숲은 길에서 2~4칸 띄운다. 거리는 값 잡음(숲속 빈터·산골 3칸 격자, 그 밖 4칸 격자)으로 물결친다. 늘 2칸이면 곧은 길 옆 숲이 자로 그은 벽이 된다.
- 침엽·혼효 마을은 숲 덩이 남·동·서 바로 바깥에 그 마을 나무(전나무·측백)를 띄엄띄엄 세운다. 낱 나무는 자기 칸과 좌우 한 칸이 모두 같은 높이일 때만 선다(단 선에 썰린 나무 방지). **남은 것:** 수관 오토타일은 leaf(활엽+전나무 약 30%)·snow 두 벌뿐이라
  `forestType: conifer` 숲 덩이 속은 여전히 활엽이 많다. 침엽 수관 한 벌을 굽는 일은 새 그림이라 3/4 관문(object-gate)을 거쳐야 한다.
- 붓 경로: `place_props` 를 버들항 맵에서 material 나무·숲·활엽수·침엽수, density dense·impassable 로 부르면 `plantBeodeulCanopyArea` 가 같은 수관으로 area 안 둥근 덩이를 깐다.
  dense 는 각도 물결 타원, impassable 은 더 꽉 찬 물결 타원이고(초타원은 area 상자에 잘려 상자로 읽혔다), 길·집·물·2~4층에 무엇이 있는 칸은 건너뛴다. 예전에는 「count 가 필요」로 실패했다.
- `author_wild_route` 도로 숲 벽·이야기 산책·공동마당은 아래 composer 그대로다(이번 변경 밖).
- 수관 그림 자체의 성질: 덩이 속 수관 사이 어두운 그늘과 가장자리 수관 사이 작은 검은 틈은 원본 수관 칸 그림이다(배치 결함 아님). 칸별 지표로 골라내려 했으나 구별이 안 됐다.
- 프로브: `bun scripts/qa/beodeul-village-forest-probe.mts --out <dir>` 는 village-diversity 8건 인자로 LLM 없이 다시 짓는다. 비교 그림 http://mdc-server:18301/village-forest-1.html

### woodland 보정 (2026-10-20)

- 붓으로 까는 버들항 숲은 나무 composer(`src/project/defaults/treeComposer.ts` `composeTreesInMask`, #3058 jp 숲 r4 와 같은 규칙)로 짠다:
  도로 숲 벽 `plantBeodeulForestWall`(author_wild_route·이야기 산책), 강가·해안 마을 숲 덩이(`buildBeodeulVillage` leaf). 원본 줄기 나무 4종만 쓰고(`src/assets/beodeulForestComposer.json`, 빌더 `scripts/content/build-beodeul-forest-composer.py`)
  칸마다 앞 나무부터 4·3·2층에 쌓는다. 예전 3칸 격자 3×3 수관(반복·풀밭 틈·떠 있는 수관)과 leaf 수관 오토타일(칸 경계로 곧게 잘린 숲 가장자리)을 대신한다. 설원 수관은 그대로.
- composer 는 hold 칸 밖을 쓰지 않는다 — 같은 bd-tree 칸 번호로 따로 찍은 낱 나무·덤불을 지우던 함정(그림자만 남음)을 막는다. 마을에서는 composer 나무도 nature 밑동 그림자를 받는다.
- `bdg-woodland-fence-*` 는 원본 밭 울타리 칸 화소 복사로 바뀌었고 남동·북서·북동 모서리와 동쪽 세로가 늘었다(643~649, `scripts/content/build-beodeul-woodland-fence.py`). 공동마당 보정은 남서/남동 모서리와 서/동변을 따로 쓴다.
- r2(같은 날): 접지 — #3058 r6 `TreeComposerGround` 를 버들항 원본 숲 그늘 색(α65/α115 두 단)으로 채운다(`scripts/content/build-beodeul-forest-ground.py`, 공용 기초 칩셋 `bdg-forest-ground-*` 192칸 → 런타임 이식). 숲 종류 `forestType`(broadleaf·conifer·mixed)을 `author_wild_route`·`author_beodeul_town` 에 더했다. 침엽은 원본 해안 절벽길 전나무·도시 숲 측백 칸 그대로(새 그림 없음). 입구 `src/editor/tools/beodeulForest.ts` `composeBeodeulForest`. treeComposer.ts 는 #3058 2c72aeed32 와 같고 `composeTreesInMask` 의 `write` 인자만 더했다(#3058 에 넘길 것). 감사 렌더 숲 종류는 `BW_TYPES=broadleaf,conifer,mixed`.
- r3(2026-10-21, 독립 검수 1차 FAIL 6 대응): 밑동을 composer 격자 대신 `planBeodeulForest`(`beodeulForest.ts`)가 해시 순으로 고르고 `composeTreesPlaced`(treeComposer.ts 에 덧붙인 입구 — 밑동 목록·그늘 덮개를 받는다, #3058 에 넘길 것)로 쌓는다. 맵 밖으로 보이는 칸이 나가는 나무·칸당 층 수를 넘는 겹침은 심지 않는다. 숲 속 바닥은 그늘 덩이. 그늘 칸은 단색 덩이+낱점으로 다시 그렸다. **그늘 칸 71장은 새 그림이라 18323 사람 허용 대기**(`beodeul-forest-ground-r3`), 빌더는 허용 전 `--draft` 로만 굽는다. 공동마당 숲도 composer, 침엽·혼효 마을은 낱 나무도 침엽 계열·숲 덩이 크게.
- r4(2026-10-21, 사용자 승인 B): 숲 덩이 한 톤 — 가장자리(깊이 ≤1)만 밝은 연두 나무, 속은 원본 짙은 초록 T3·덤불, 큰 4×5 와 작은 나무 섞기. 숲 장면(도로 숲 벽) 바닥 잔디만 채도 ×0.84(`bdg-woodland-grass`). 2차 검수 N2(윗줄 측백 같은 높이)·N4(전나무 꼭대기가 줄기에 꽂힘) 수정.
- r5(같은 날, 사용자 정정): **나무 밑 땅 = 원본 「짙은 풀」 오토타일.** 원본 도시는 나무 밑을 짙은 결(원본 칸 11628) 둥근 디더 덩이로 칠했는데 칩셋에 가장자리가 없어 도로 도구가 11628 을 네모 판으로 깔았다.
  `ensureBeodeulDarkGrass`(`beodeulForest.ts`)가 대상 칩셋에 오토타일 그룹 `beodeul_dark_grass`(_woodland)를 단다 — 속은 원본 칸, 가장자리 46모양×바탕 2벌은 원본 화소 조합(beodeul_ground 651~742).
  코드가 그린 숲 바닥 그늘·둘레 땅 그늘 칸(r2~r4)은 모두 지웠다. `author_wild_route` 의 조우 풀숲은 `isDeclaredMonsterGame` 일 때만 깐다(일반 RPG 는 맵 전체 조우). 자세한 규칙 `tiledata/beodeul-ground/WOODLAND.md`.
- r9(같은 날, 사용자 위임 허용): 독립 Opus 적대 VQA 가 한 칸 폭 띠·외딴 칸을 1~3판 내리 불합격시켰다(끊긴 점 사슬·구슬·풀포기). **짙은 풀은 2×2 덩이에서만 보이고** 외딴 칸·한 칸 폭 띠는 바탕 잔디, 덩이는 한 칸 폭 이음매에서 물러난다. 4판 93/93 통과 → 18323 묶음 `beodeul-dark-grass-r9` 허용(감독, 사용자 위임) → 실제 굽기. 잔디 결의 글자 같은 반복 무늬는 원본 737 의 것이고 650 은 그 복사본이다(이번 변경이 만든 것 아님).
- 감사 렌더: `bun scripts/qa/beodeul-woodlands-audit.mts <dir> <tag>`(도로 숲 벽·공동마당·강가 마을·닫힌 울타리를 실제 도구로 짓고 renderMapPng, 높이 맵 pad 띠는 잘라 낸다 — 게임 화면 밖이다. 끝에 잘림 검사 `clip-check`).
- 남은 것: 공동마당 밝은 잔디 사각 패치(마당 설계), 강가 마을 예제(river-town)의 남쪽 숲 조각 반복, 도로 풀숲(조우 칸)의 네모 판 — 풀숲 가장자리를 깎으면 조우 로케이션 사각형과 보이는 풀숲이 어긋나므로 가장자리 그림(새 그림·관문)이 필요하다. 풀 군락 fringe 는 PIL 도형 그림이라 원본 결이 아니다 — 새 그림은 하네스·3/4 관문을 거쳐야 한다.
## 기와 복원 · stone 박공 벽/중앙 창 (2026-10-04 사용자 정정)

revision 16 기와 변경은 사용자 지적을 오해한 것이며 철회했다. 민가 5종/성당의 기와를 원본 픽셀로 복원했다. stone 지붕 아래 삼각형 벽의 일부 회벽 색만 덮던 보정 때문에 기존 목재 기둥/사각창이 남아 새 창과 겹쳤다. gable.py는 전체 박공 벽과 계단형 가장자리만 같은 돌 질감으로 채우고 원형창 하나를 중앙 (31,53)에 둔다. 원래 지붕/문/하단 벽/위치/통행/맵은 유지한다. 원본 기와 픽셀 대조, revision 15 대비 stone 박공 밖 픽셀 불변, 공용 참고문서와 새/기존 프로젝트, 실제 저장·재로드/화면은 verify-shots/beodeul-gable-fix.


## 물굽이 조밀한 마을 표본 (2026-10-04)

사용자가 제공한 구도 그림을 큰길/골목/공유 마당/물길로 나뉜 구역 관계로 옮겼다. 새 맵 `map_beodeul_river_town`(버들 물굽이 마을, 76×70)에 민가/회관/주막/대장간/교회 41동과 원본 아치 다리 3개를 배치한다. `scripts/content/lib/beodeul-river-town.mts::buildBeodeulRiverTown`은 물 예약, 원본 전체 건물, 길과 접근로, named 물 오토타일, 전체 다리, 숲/기물, 공용 기초/접점 그림자 순서로 만든다. 원본 기와와 이전 stone 박공 보정을 사용한다. 기존 맵은 바꾸지 않는다. 출입 이벤트/실내/NPC는 이 외장 표본에 포함하지 않는다.

공용 학습 정본 `tiledata/beodeul-ground/RIVER-TOWN.md`, `river-town-example.json`, 전체 네 층 배열/사용 키트/전체 source graft 규칙/실제 정상·갑판 누락 오류 그림을 `prepare-beodeul-river-town-references.mts`가 번들 `beodeulGroundReferences.json`에 넣는다. 기본 ground 참고문서 생성기도 fragment를 보존한다. 새/기존 city·ground 모두 같은 지침을 받는다. 저장은 `scripts/qa/beodeul-river-town-proof.mts`가 기존 맵 불변·41개 실제 문앞/6개 다리 둑의 저작된 길만 사용하는 canMove를 확인한 뒤 SQLite 저장 후 별도 프로세스 `scripts/qa/beodeul-river-town-reload.mts`에서 재로드해 새·기존 맵 전체 층/이벤트와 공용 참고문서를 대조한다(저장 캐시와 재로드 snapshot을 동시에 보유하지 않는다). 전용 player.html은 세 다리를 지나 회관·교회·공방과 우물 복귀를 확인한다. 근거 `verify-shots/beodeul-river-town/`.

## 색 역할 정리 · 따뜻한 황록 확정 (2026-10-05)

사용자는 집 옆에서 형태/뿌리/그림자를 고정한 색상만의 비교 중 warm(따뜻한 황록)을 선택했다. `tiledata/beodeul-ground/PALETTE-STANDARD.md`, `palette-standard/standard.json`은 나뭇잎의 전체 RGBA 치환표와 기존 밝은 잔디737/기와·목재/건물별 벽 역할을 묶는다. 일부 대표색은 실제 픽셀 분포의 표본이며 모든 그림을 세 색으로 줄이는 제한이 아니다. 기존 기와·윤곽·3/4 시점은 원본 기준이다. 현재는 확정 색과 조수 지침 등록이며 게임 아틀라스 자체를 바꾸는 단계는 아니다.

`prepare-beodeul-palette-standard.mjs`가 공용 source 전체/색 사전/정상·palette-scope-leak 실제 변조를 `beodeulGroundReferences.json`으로 배포한다. 기본 참고문서 재생성도 fragment를 보존한다. 새 city/ground와 기존 프로젝트 두 타일셋을 확인하며 정본 저장/별도 재로드 근거는 `verify-shots/beodeul-palette-standard/`. 맵/출입/시작점/통행은 유지한다. 후속 그림 보정은 tree body 영역만 정확한 사전으로 치환하고 공용 아틀라스와 생성 코드·조립/통행 검수·정본 저장을 함께 수행해야 한다.

## 황록 마을 50×50 · 실제 선택 색 적용 (2026-10-05)

`buildBeodeulVillage50` (`scripts/content/lib/beodeul-village50.mts`)는 별도 맵 `map_beodeul_village50`에 민가·회관·주막·대장간·교회 18동, 두 아치 다리, 우물 마당과 공유 흙마당을 저작한다. 기존 기와·윤곽·stone 박공을 그대로 조립한다. 포석 길은 교회 앞에서 굽어 남쪽 다리로 이어지고, 좁은 접근로가 실제 문 앞을 연결한다. 나무 수관은 일부 길 위로 드리울 수 있지만 밑동의 blockingCells는 길·문 앞 여유를 막지 않는다. 전체 나무·그림자가 지도 안에 들어올 때만 배치한다.

선택한 warm 나무를 공용 `beodeul_warm_trees` / `tex_beodeul_warm_trees` (16px·8열·328칸)로 배포했다. `build-beodeul-warm-trees.py`는 색 비교 시안과 정확히 같은 3종 본체 및 기존 숲 4종의 RGBA 치환표를 패킹한다. 알파·줄기·뿌리·숲 겹침·그림자·원본 잔디/건물 시트는 보존한다. `bundled.ts`·공통 기하·`defaultAssets.ts`가 새/기존 프로젝트에 등록하며 참고문서 owner는 `beodeul_city`다.

학습 정본 `tiledata/beodeul-ground/VILLAGE50.md`, `village50-example.json`, `warm-trees-catalog.json`; `prepare-beodeul-village50-references.mts`가 전체 네 층·사용 키트·모든 graft 통행/우선순위·정상/갑판 누락 오류 그림을 공용 city/ground 참고문서에 넣는다. 기본 참고문서 재생성도 fragment를 보존한다. 저장 시 참고문서만 병합하며 일반 ground ensure의 우선순위 갱신을 별도로 호출하지 않는다. 모든 기존 맵을 대조하고 18개 문 앞·네 다리 둑까지 저작된 길만 쓰는 canMove 경로를 확인한다. SQLite 저장·별도 재로드, 전용 player.html 도보 검수, 실제 그림 근거는 `verify-shots/beodeul-village50/`. 이 맵은 외장/길 표본이며 새 실내·전이 이벤트는 포함하지 않는다.

### 포석길 끊김 정정 (2026-10-05)

남쪽 포석길의 스케치가 (15,41)의 민가와 겹쳐 지워졌다. 기존 검사는 교회에서 북쪽 다리를 돌아 남쪽 다리로 갈 수 있어 통과했으며 남쪽 포석길 자체의 단절을 놓쳤다. `repairBeodeulVillage50Roads`는 교회 앞 (9,44)→남쪽 다리 서쪽 (22,37)을 y≥37의 건물 전체 영역을 피하는 실제 자유 지면 경로로 잇고, **포석만 사용하는 canMove**로 다시 확인한다. 실제 기존 맵 보정은 1층 지면만 변경하고 건물·나무·소품·그림자·이벤트를 대조한다. 흙/포석/다리 갑판은 같은 road union으로 N/E/S/W 마스크를 계산해 재료 접점의 잔디 틈도 제거한다. 공용 예제/전체 배열/정확한 수정 좌표와 재로드·실제 도보 근거를 함께 갱신한다 (`verify-shots/beodeul-village50-road-fix/`).

## RPG 시설과 생활 역할 (2026-10-05)

`src/assets/beodeulFacilitiesPlans.ts`의 32개 시설 조립안을 `beodeulFacilities.ts`가 `bd-facility-*` 구조물 키트로 합성한다. 여관/주막/장비점/약초·연금/예배당/길드/치안/회관/은행/마구간/나루/창고/생산/학자·특별한 민가를 포함한다. 기존 승인 건물을 전체 배열로 복사하고 작업 마당 소품을 조립하며 기와·벽·윤곽 픽셀을 재저작하지 않는다. 같은 원본 건물을 사용하는 역할이 있다. `createBeodeulCityTileset`와 `ensureBundledTilesets`의 기존 city 경로에 배선하여 새/기존 프로젝트 모두 키트를 받는다. 건물 보정 시트는 `translateTiles`로 기존 graft를 재사용하며 source 통행·우선순위를 유지한다. 반복 적용은 no-op이다.

공용 참고문서 owner는 city의 `beodeul-facilities`. 정본 `tiledata/beodeul-facilities/`와 준비기 `scripts/content/prepare-beodeul-facilities-references.mts`, 번들 `src/assets/beodeulFacilitiesReferences.json`, 정적 그림 `public/assets/beodeul-facilities/`다. 문서 17쪽에 32개 완전한 source 키트/입구/실제 통행표·네 층 표본·전체 마을 네 층·source 이식표를 제공한다. 그림은 실제 엔진 조립 8개 도안 판/마을/blocked-facility-entrance 변조를 담는다. 원본 그림을 새로 그린 시설이나 판매/회복/은행/의뢰 시스템으로 설명하지 않는다. 실내와 시설 기능은 별도 저작이다.

`dressBeodeulVillageFacilities`는 저장된 50×50의 기존 18동을 유지하고 약초사 집(3,6), 발명가 집(42,7), 술집(28,20), 항구 창고(14,30), 나루터 사무소(28,39)를 기물과 작업 마당으로 구분한다. 나루터 널판 3×3은 (25,46)에 놓아 물가 경계칸까지 실제로 덮는다. (28,47) 육지→(27,47)→(26,47) 잔교가 canMove로 이어져야 한다. 건물·나무·기존 소품/그림자/이벤트, 이전 네 맵과 기존 칸 통행을 대조한다. 모든 18개 문 앞/다리 둑, 남쪽 포석만의 연결, 다섯 시설/잔교 실제 player.html 도보와 SQLite API 저장·별도 프로세스 재로드 근거는 `verify-shots/beodeul-facilities/`에 남긴다.

## 서로 다른 건축 구조의 강변 마을 (2026-10-05 초안 기록 · 4종 반려)

소품 교체 32종에서 실제 몸체/지붕 6계열로 확장했다. `beodeul_forms`(tex_beodeul_forms, 16px/16열/544칸)는 가로 긴 민가·좁은 2층·ㄱ자 별채·현관/다락창 여관·낮은 작업장/굴뚝 대장간·하역 차양 창고를 보유한다. 원본 city/기존 보정 건물은 보존한다. `beodeul-architecture build|validate|review`의 forms.py가 조립/검사/검수 판을 담당한다.

공용 배선은 bundled.ts/geometry/defaultAssets/createBeodeulCityTileset/ensureBundledTilesets와 `beodeulForms.ts`다. source 본체6/그림자6/기초6 도장을 city에 translateTiles로 이식하며 새·기존 프로젝트 양쪽에서 참고문서 `beodeul-forms`를 갖는다. 그림자2층→본체3층→기초4층을 같은 원점에 놓고 각각의 벽 접점을 따른다. 기초/그림자의 통행 ★가 벽 X를 덮지 않는다. 길1층은 별도로 연결한다. 조수는 같은 실루엣3개를 나란히 놓지 않고 폭/높이/용마루/별채가 다른 몸체를 조합한다.

새 지도 `map_beodeul_forms_village`는 50×50/16동/아치 다리2개다. 이전 다섯 지도와 기존 사용 칸의 통행을 보존한다. 전체16개 문앞과 다리 둑까지 실제 canMove 도로 경로를 확인한다. 여관 입구(35,13)를 anvil로 막은 실제 변조는 true→false로 검출한다. 50×50 재현 `scripts/content/lib/beodeul-forms-village.mts`, 자료 준비 `prepare-beodeul-forms-references.mts`, 정본 API 저장·별도 프로세스 재로드·전용 player.html 화면 `verify-shots/beodeul-forms/`. 외장 저작이며 실내/거래/문 전이 이벤트를 추가한 것은 아니다.

## 던전 층: 받침 규칙 + `author_beodeul_dungeon` (2026-10-14, 사용자 스크린샷 · field-enemy fe1)

**증상:** 「필드에 몬스터가 돌아다니는 던전 층을 만들어 줘」(Argon medium, 48×38)가 25분 시간 초과로 끝났을 때 맵에 횃불·화로·통·상자·기둥이 검은 허공에 뜨고, 벽·바닥 조각이 잘려 서 있고, 상자 이벤트가 천장 칸에 놓였다. trace: `stamp_object` 112번(호출당 ≈4초) + `paint_tiles` 67번(≈3초) ≈ 도구 시간 11분, `run_lint` 0건.

**원인(모델 탓이 아니다):**
1. 참고문서 `bd-pick-doc-dungeon-guide` 의 공식 절차가 「키트를 `stamp_object` 로 한 개씩 절대 좌표로」였다. 던전 시공기가 없었다 — 좌표 계산 전부가 모델 몫.
2. `checkKitPlacement` 는 겹침·경계만 봤고 「이 칸 밑이 바닥인가」를 보지 않았다. 찍기가 항상 성공하니 같은 일을 계속 시킬 이유가 생겼고, 거절 → 재시도 루프가 아니라 **성공한 호출이 200번**이었다(장식이 목표라 끝이 없다).
3. 허공을 `paint_tiles` 로 다시 칠하면 이미 찍은 물체가 허공에 남는다. 시작 위치 무결성 때문에 작은 허공 사각형도 많이 칠했다.
4. `projectLint`·`check_reachability` 는 「바닥 위 물체」·「천장 칸 이벤트」를 안 봐서 0건으로 통과.

**수리:**
- `src/project/groundSupport.ts` — 던전 테마 키트(`ai.themes` 에 dungeon)만 대상. 규칙: 천장(허공) 위 금지 · 서는 물체의 맨 아랫줄이 벽이면 금지 · 벽걸이(`torch-wall|banner|niche|chains|sconce`)는 벽 칸에만 · 문·아치 바로 남쪽은 바닥 · 벽 앞면 바로 남쪽이 천장/빈 칸이면 거절. 훅 둘: `kitPlacementRules.checkKitPlacement`(stamp_object 가 어기면 칸·이유·가까운 올바른 자리 3곳을 돌려주고 거절), `projectLint.checkGroundSupport`(코드 `ground-support`, 칸 단위 error + 허공 향한 벽 warning, 천장 칸 이벤트 error — 커밋 게이트가 기준선 대비 새 오류만 막으므로 paint_tiles 가 물체 밑을 지우는 길도 막힌다).
- `src/editor/dungeonKit/beodeul/compose.ts`(옛 `src/editor/beodeulDungeon/`) + `src/editor/tools/dungeonTools.ts`(옛 beodeulDungeonTools.ts, 현재 도구 이름 `author_dungeon`, 옛 이름은 별칭) — 도구 `author_beodeul_dungeon({rooms:[{kind,w,h,from,dir}]})`. 방 목록 → 배치(통로 4칸·바닥 3줄 폭) → 바닥 마스크 → 천장 → 벽 앞면(바닥 북쪽 변 위 3줄만) → 마스크에서 장식 유도(방 종류별). 끝나면 위 받침 규칙으로 자기 결과를 검사하고, 입구에서 모든 방이 걸어 닿는지 BFS 로 본 뒤에만 맵을 만든다(어기면 맵 안 만들고 거부). 결과 `data.rooms[].spots` 가 이벤트·적·상자를 둘 수 있는 빈 바닥 칸이고 `stairsUp.front`/`stairsDown` 이 이동 지점이다. 빈 시작 맵이면 방 배치 크기로 넓혀 그 자리에 짓고 시작 위치를 입구로 옮긴다.
- 안내: 참고문서 던전 절(md + `src/assets/beodeulCityReferences.json` 베이크본), `intentDeclaration`·`sessionToolExposure`·`toolCapabilityIndex`·도구 설명이 던전 층은 이 도구 하나로 가라고 한다.
- 시험 케이스: `harness-data/space-craft/seed.json` 의 `dungeon-fe1`(원 요청 그대로)·`dungeon-stone`·`dungeon-crypt`.

**한계:** 구조는 일렬 방+통로 그래프다(ㄱ자·갈림길 방·물 구역 없음). 방 안 장식은 종류별 규칙형이라 같은 종류 방은 비슷하다. 이벤트(적·상자·이동)는 조수가 spots 에 직접 둔다. 필드 적 시스템 쪽 도구는 건드리지 않았다.

**실조수 재시험(2026-10-14, Argon medium, 같은 요청 「필드에 몬스터가 돌아다니는 던전 층을 만들어 줘」, `space-craft` 케이스 `dungeon-fe1`):**
수리 전(origin/main) 15분 하네스 한도에서 미완결(stamp_object 65·paint_tiles 5·upsert_troop 8 …), 수리 후 3분 11초·도구 호출 28번(author_beodeul_dungeon 1번)·받침 없는 물체 0·전부 도달·lint error 0. 정본 저장·재로드 sha256 일치(테스트 프로젝트 0376c4e4-a5d7-4702-88cf-b8cae5523ff0). 중간 시행에서 두 가지를 더 고쳤다 — (1) 의도 노트가 `space=interior` 라서 조수가 손 도트 실내 도구를 찾으며 7분을 읽기만 함 → 던전 선언이면 전용 노트, (2) 배치 품질 권고(빈 바닥 ≤30%)가 던전 큰 홀을 「빈 방」으로 보고 조수가 `clear_map` 을 불렀음(응답 없이 15분 멈춤 — 승인 대기로 보이며 별도 조사 필요) → 방마다 `composed-layout` 이름표(`dungeon-room`)를 달아 권고에서 뺐다. 증거: `~/claude-viz/dungeon-place-fix.html`.

### 던전 시공기 2판 — 적대 시각 QA 뒤 한 번 고침 (2026-10-14 같은 날)

사용자: 「던전은 수리 후에도 문제가 있는듯」. 1판 출력(받침은 맞음)을 원 해상도 4분면으로 다시 본 결함과 원인:

| 결함 | 원인(코드) | 2판 |
|---|---|---|
| 바닥 가장자리가 검은 허공에 그대로 잘림(앞 턱·옆벽·벽 윗면 없음) — 방이 종이 오린 것처럼 보임 | 천장을 3×3 견본 키트 `bd-pick-aqueduct-sewer-ceiling` 의 가운데 칸(테두리 없는 허공) 하나로만 깔았다. 그 키트는 변형 렌더의 견본일 뿐 47 모양 오토타일이 아니다 | 천장 오토타일 `beodeul_dungeon_ceiling`(+결 2 `_b`) — 변형 던전 렌더와 **같은 함수**(`tiledata/beodeul-variants/_lib3/dlib.py::ceiling`, 벽 두께 띠 8px)로 자른 모양을 시트 꼬리 28,416~ 한 행에 굽고(`scripts/content/beodeul-dungeon/bake_dungeon_ceiling.py`, 실제로 나오는 22 모양 × 결 2 + 허공 결 2 = 46칸, 나머지 마스크는 가까운 모양으로 접음), 시공기가 방·통로 바깥 모든 칸을 이 그룹으로 깐다 |
| 방 사이 통로 위 벽 토막·높이 다른 벽이 이음 없이 만남 | 위와 같음(벽 윗면 띠가 없어 높이 차가 잘린 조각으로 보임) + 세로 통로 입구가 방 모서리 1칸 안쪽까지 허용돼 1칸 벽 토막이 섬 | 띠가 단차를 잇는다. 통로 입구 양옆에 벽 3칸(좁은 방 2칸) 이상, 세로 통로는 5칸 우선(앞면 3줄 위 천장 2줄), 벽 앞면 위에 천장이 한 줄도 없으면 내부 오류 `stranded-wall` |
| 가로 한 줄 사슬(99×28), 큰 홀 가운데가 빔, 같은 종류 방이 판박이 | 방향 후보가 N·W·E 뿐이고 들어온 문을 N 으로 잘못 기록(`opposite(N)=N`) — 허브 방에서 북쪽 갈래가 막혀 castle6 같은 목록은 `layout-failed`. 장식은 방 종류마다 고정 좌표 | N·S·W·E + 바운딩 상자가 4:3(또는 `width/height` 비)에 가까운 자리 점수, from 생략 시 직전 세 방 중에서 부모 고르기, 자리 없으면 다른 방에 붙이고 알림, 고리 통로 1~2개. 크기 ±1~2 흔들기·모서리 모따기·감방 칸막이(폭 3 감방) |
| 횃불 5칸 간격·기둥 쌍 대칭, 장식 드묾 | `(x - r.x) % 5 === 1` 같은 고정 간격, 문 앞 줄(lane)을 방 전체 띠로 비워 큰 홀 가운데가 빔 | 벽걸이는 최소 2·평균 gap 흔들기, 바닥 물건은 종류별 가중 무작위·구석 우선 모둠(같은 방 안만), 줄 비우기 대신 **물건을 놓을 때마다 입구·문 칸 BFS 로 길이 끊기면 되돌림**. 묘실은 뼈 낀 바닥, 감방 칸은 감방 바닥, 통로에 배수 창살 |
| 계단·아치가 벽 끝 마구리 칸·통로 바로 옆에 반쯤 걸림 | 계단 칸 고르기가 「벽 앞면이고 문 앞 줄이 아님」만 봤다 | 계단은 좌우 두 칸까지 같은 높이 벽(b=1·b=0)인 칸, 가운데 쪽. 벽걸이도 양옆이 같은 줄 벽인 칸만. 내려가는 계단은 여덟 이웃이 바닥인 안쪽 칸, 문에서 먼 칸 |
| 서사 앵커 없음 | — | `data.anchors`: boss(kind boss, 없으면 입구·보물 방 아닌 가장 깊은 방) · treasure(vault) · gate(보물 방(없으면 보스방)으로 드는 통로 가운데 칸 — 잠긴 문 이벤트 자리). `rooms` 생략 + `size`(small 4·medium 6·large 9) 또는 `width/height` 로 방 구성을 코드가 정한다 |

- 훑기(엔진 출력, 900판 크기만 + 400판 무작위 방 목록): 실패 0, 받침 없는 물체 0, 전부 도달(시공기 내부 검사). 쓰이는 천장 모양은 22개.
- 3/4 관문: 천장 칸은 그 칸을 화소 그대로 품은 **시공기 실제 출력 층 그림**(표본 `tiledata/beodeul-dungeon/gate-samples/*.json`, 결마다 한 장)으로 받는다. `object-gate review` 4/4 PASS — 판정 프로필 `ca6aaa9c55194dc5` 미보정이라 **임시 통과**. 표본 JSON 을 다시 만들면 영수증도 다시 받는다.
- 굽기 순서: `bake_picks.py` → `bake_farm.py` → (끝에서 자동) `bake_dungeon_ceiling.py`. 덧붙이기 전용, 앞 칸 그림·표는 그대로(검증: 옛 시트와 새 시트 앞 3552px 차이 없음).
- 기존 사본: `ensureBeodeulCityTileset` 이 꼬리를 28,544 까지 늘리고 두 오토타일과 칸 묶음 `beodeul:dungeon_ceiling` 을 더한다. 그 자리(28,416~)에 이식 칸(`tileGrafts`)이 있는 사본은 농장 끝까지만 받고, 시공기는 테두리 없는 허공으로 물러서며 경고를 낸다.
- 실조수(2026-10-14, Google gemini-4-argon medium, `space-craft` 케이스 `dungeon-fe1`): 3분 30초·호출 33·`author_beodeul_dungeon` 1번(방 6개, 55×42)·전부 도달·lint error 0, 조수가 놓은 이벤트 7개 모두 걷는 바닥·위층 빈 칸. 정본 저장·재로드 sha256 일치(테스트 프로젝트 eaf1557a-d401-4cfc-803f-c37dedbc908b, `afd73076…5b9414`). 새 케이스 `dungeon-plain`(「던전 하나 만들어줘」)은 Argon 요청 한도 초과(429)로 두 번 다 도구 호출 없이 끝나 **미검증**.
- 표본·렌더: `bun scripts/content/beodeul-dungeon-samples.mts <dir>` → `python3 scripts/content/render-beodeul-dungeon-samples.py <dir> [--marks] [--rim]`(--rim = 굽기 전 미리 보기).
- **남은 한계(정직):** 바닥은 여전히 2×2 무늬 한 종류(금·이끼 변형 칸이 없음 — 새 그림이 필요), 물·높이 차·계단식 구역 없음, 큰 홀 기둥은 반듯한 열주, 보스방 가운데는 싸울 자리로 비움, 칸막이 위 천장 띠는 가는 선으로 보임, 세로 통로가 4칸으로 밀리면 두 방 사이 벽이 한 줄 띠. 증거·전후 비교: `~/claude-viz/dungeon-qa.html`.



### 던전 시공기 3판 — 종류(`type`) 8가지 (2026-10-14, 사용자: 「던전 종류가 좀 다양해야 할 것 같다」)

2판까지는 지하묘지·성(`catacomb|castle`) 두 가지뿐이라 전부 회색 석벽 지하 묘지였다. 3판은 **배치 문법이 다른** 종류를 더했다 — 팔레트만 바꾼 것이 아니다. 도구 인자는 `type`(옛 `style` 은 별칭). 코드: `src/editor/beodeulDungeon/{profiles,grid,layouts,dress,errors}.ts` + `compose.ts`(조립), 도구 설명·낱말 표는 `beodeulDungeonTools.ts`·`intentDeclaration.ts`·`toolCapabilityIndex.ts`.

| type | 문법 | 한 줄 | 액체 |
|---|---|---|---|
| catacomb / castle | rooms | 방+통로 나무(옛 그대로, 출력 불변) | - |
| labyrinth | maze | 3칸 폭 통로 미로(깊이 우선+고리), 한가운데 3×2 보스 덩어리, 막다른 길 보물 | - |
| sewer | rooms | 수로 방(양옆 보행로+다리), 저수조(섬), 펌프실 | 물 |
| cave | blob | 타원 방+넓은 굽은 통로, 지하 호수·웅덩이, 석순·버섯·덩굴·보트, 맵을 내용 크기로 잘라냄 | 물 |
| temple | rooms | 현관→열주 신랑→제단 성소 + 곁방 좌우 대칭(shift 0), 무너진 구역·덩굴 | - |
| mine | rooms | 수평 주 갱도(판자 길) + 갈래 갱·채굴장(광석·광차·램프)·적재장, 갈색 흙 바닥 | - |
| volcano | blob | 용암 못·강, 재 바닥·흑요석 뾰족돌·열 구멍·대장간 방 | 용암 |

- **액체는 막힌 칸이다.** 마스크 `Grid.liquid` 는 열린 칸(천장 안 깔림)이지만 통행에서는 `water`(canMove 가 solid) · 용암(막힘 키트)이다. 길이 액체에 갈라지면 `bridgeComponents` 가 가장 짧은 액체 경로를 다리(1×1 통행 조각)로 바꿔 잇고, 못 잇는 조각은 `pruneUnreachable` 이 막는다. 벽 두께 규칙(`fixThickness`)과 연결이 서로를 깨뜨릴 수 있어 `settle` 이 고정점까지 돈다. 수로 방 양끝 두 칸은 보행로로 남긴다(물↔벽 `tileset-palette-boundary` 경고 방지).
- **받침 규칙(#2563) 유지·확장.** `groundSupport.ts`: 벽걸이 정규식에 `vines|hanging-chain`, 액체 위에 서도 되는 물체 `boat|dock|driftwood|fish-net|bridge|lily|raft` 만, 그 밖의 물체가 액체 칸 위에 있으면 `supportProblems`·`ground-support` lint 가 오류. 비던전 테마 키트(채굴 계곡)는 `put()` 이 자체 받침 검사.
- **방 종류가 늘었다**: channel cistern pump(하수도) · cavern lake grotto forge(동굴·화산) · nave(신전) · junction stope depot(광산·미궁). 그 종류에 없는 방 종류를 주면 경고하고 가까운 종류로 접는다. `rooms` 를 주지 않으면 종류별 계획기(`planSewer/planTemple/planMine`)가 구성한다. 미궁·동굴·화산은 방 목록을 무시하고(경고) 크기(`size`/`width×height`)만 쓴다.
- **종류 추정**: `inferDungeonType`(낱말: 광산·갱도→mine, 화산·용암→volcano, 하수도·수로→sewer, 미궁·미로→labyrinth, 신전·유적→temple, 동굴→cave, 성채→castle, 그 밖→catacomb). 「하수도 미로」는 sewer. 도구 설명·`intentDeclaration`·`toolCapabilityIndex` 에 같은 표. 얼음 요청은 cave 로 대신하고 `iceRequested` 로 알린다.
- **검증(엔진 출력)**: 8종 × 시드 3·7·12 = 24판 — 도구 ok, `check_reachability` 전부 도달(spots·계단·문 앞), `check_terrain_access`, `run_lint` error 0. 액체 칸을 목표로 주면 실제 `canMove` 가 0/6 거부(음성 시험). 종류 8 × 시드 40 × 크기 3 = 960판 훑기: 실패·가지치기 경고·계단/보스 누락 0, 방 목록 무작위 500판(rooms 문법) 전부 ok.
- **조수 대용 실경로(Claude Sonnet 5.5 high 역할극 — Argon 사용 불가)**: `scripts/oprn-tools.mjs` 로 find_tools → 도구 → place_field_enemy → check_reachability → run_lint 를 실제 실행기·저장·재로드까지. 「광산 던전 만들어 줘」→mine 76×43, 「화산 동굴」→volcano 82×61, 「하수도 미로」→sewer(조수가 고름) 62×67. 정본 저장·재로드: `scripts/oprn-store.mjs init/import-json/export-json` 로 SQLite 폴더에 저장 후 내보내 맵 JSON 일치 확인(A 프로젝트 a66a9f7b-ffed-4060-80b7-39353fe42021 sha256 0fca1e40…, B 14b909cd-b62b-443b-bc2c-6580e29cba29 7f49dc2c…, C ebbeaeec-c849-4e8c-ba76-8548466ac7ae 8c1413c5…). 실제 에디터 조수·Argon 경로는 **미검증**.
- **역할극에서 나온 마찰(미수정, 도구 쪽 별건)**: `place_field_enemy` 는 `required` 에 없는데 troopId 나 graphic 이 없으면 거절한다. 기본 부대(`troop_golem_guard`·박쥐 선두)는 필드용으로 거절돼 조수가 `upsert_troop` 으로 슬라임·오크 계열 부대를 만들어야 했다. 거절 메시지의 허용 목록이 잘린다. `run_lint` 상세는 `data.issues`.
- **없는 그림(MISSING, `profiles.ts`)** — 이번에 한 장도 새로 그리지 않았다(그래서 3/4 관문 해당 없음, 영수증 0). 목록: 광산 — 선로 타일(가로·세로·모서리·T), 갱목 지지대(벽 걸이 1×2·바닥 기둥 1×2), 광맥 벽 앞면 변형, 채굴장 벽 광석 장식. 화산 — 현무암·재 바닥 2×2 변형 3종, 현무암 벽 앞면 3h/2h, 용암 가장자리 식은 껍질 오토타일. 동굴 — 갈색 테두리 동굴 천장 오토타일(지금은 회색 석벽 띠), 종유석 천장 늘어짐. 얼음 동굴 — 전부(beodeul_city 에 없음). 선로·광차(`props.cart` RAIL/RAIL_END/CART)와 용암 가장자리(`edges.lava`)는 `dungeon-chipset` 하네스에 **후보만 있고 사람이 안 골랐다** — 고른 뒤 굽기는 별도 단계. 후속은 Opus tile-artist 몫.
- **남은 결함(정직)**: 광산은 석재 통로+주황 판자 길이라 선로·갱목이 없어 「광산」 느낌이 약하다. 화산은 용암이 가장자리 그림 없이 평평하고 벽은 성 벽돌, 바닥은 보랏빛 재색. 미궁은 바닥이 단조롭다. 동굴·화산에서 방 끝 코너에 천장 1칸 검은 점이 남는 곳이 있다(벽 앞면 양옆). 하수도 다리는 두꺼운 돌 띠로 보인다. 증거·점수: `~/claude-viz/dungeon-types.html`.


### 던전 시공기 4판 — 장르 × 칩셋 어댑터 (2026-10-15, 사용자: 「던전을 장르별로 — 포켓몬풍 / 일반 RPG / 그 밖」)

**구조(세 층, `src/editor/dungeonKit/`).**
1. **칩셋 몰라도 되는 층:** `types.ts`(종류·사양) · `grammar.ts`(종류별 배치 문법 표, `inferDungeonType`) · `mask.ts`(`buildMask` → 열린 칸·방 번호·액체·다리·문 앞 보호) · `layouts.ts`(`layoutRooms/layoutMaze(thin)/layoutBlob`). 어떤 그림을 쓰는지 모른다.
2. **어댑터(칩셋마다 하나):** `beodeul/`(compose·profiles·dress, 기존 그대로) · `monster/monsterAdapter.ts`(몬스터 키트: `monster_overworld`·`monster_dungeon` 의 기존 조각만 칠한다). 나머지 칩셋(고딕·조선·마법 학교·해적·선사·사막동양·그 밖)은 `capabilities.ts` 능력표에 **stub** 으로만 있고 **거절**한다.
3. **장르 프리셋(`genres.ts`):** `pokemon` = 짧은 던전(방 2~4, 야생 조우 구역 전체가 걸을 때 확률로 조우, 시선 3~4칸 트레이너 한두 명, 선택 보스, 깊은 방 구멍→입구 지름길, 보물 방·잠긴 문 없음) · `rpg` = 긴 던전(medium 이상, 방 여럿, 곁방 상자, 필드 적, 보물 방 앞 잠긴 문+열쇠 방, 보스). 프리셋은 배치 인자와 **채우기 계획**(`planPopulation` → `data.population`)을 정한다. 이벤트 자체는 조수가 기존 도구로 놓는다.

**라우팅(`route.ts`).** ① 기존 맵을 지으면 그 맵의 칩셋이 어댑터를 정한다 ② 새 맵이면 프로젝트 장르(`system.genre==="monster-collect"` → pokemon) 또는 이미 있는 맵들의 어댑터 다수결 ③ 요청의 `genre` 인자는 **배치 프리셋만** 바꾸고 그림체 계열은 바꾸지 않는다(칩셋 계열 지키기) ④ 어댑터가 그 종류를 못 지으면 `DungeonComposeError(type-unsupported-by-tileset)` + 가장 가까운 지원 종류를 권한다. 조용한 팔레트 바꿔치기는 없다.

| 어댑터 | 짓는 종류 | 못 짓는 종류(이유) |
|---|---|---|
| beodeul | catacomb castle labyrinth sewer cave temple mine volcano | ice(얼음 그림 없음) |
| monster | cave · cave:wet · volcano · ice · labyrinth · temple | catacomb castle sewer mine(지하묘지 벽·수로·선로 그림 없음) |
| stub 7곳 | 없음(거절) | 이미 있는 재료·모자란 그림을 거절 문구가 같이 알려 준다 |

**`build_monster_game` 은 이 길을 안 탄다.** 고정 템플릿·`markers.json` 앵커 맵이라 건드리면 autoplay 엔딩이 깨질 수 있다. 몬스터 어댑터는 자유 경로(`author_dungeon`)에서만 쓴다(`openwiki/monster-expedition.md` 「던전 어댑터」).

**4판의 고침(beodeul 만, 새 그림 0장).** 적대 시각 QA 결함 → 원인 → 수리:
- 동굴·광산·화산 바닥에서 2×2 무늬 반복이 격자로 보임 → `FloorSpec.mix`: 무늬 키트에서 칸마다 무작위 한 칸을 뽑는다(결·색은 그대로).
- 동굴 통로에 하수구 창살이 박힘(성 지하 규칙을 공유) → `dressCorridor` 가 동굴·화산 통로는 잔돌·불씨만.
- 광산에 선로·갱목이 없다 → 새 그림 없이 기존 조각으로: 판자 줄 위 광차(`cart-h`), 갱목 틀 대용 선반 조각(`rack`) 쌍, 램프, 세로 통로엔 통. **선로·갱목 그림은 여전히 없다.**
- 화산 바닥이 보랏빛 재색 한 장 + 모래색 얼룩 → 얼룩을 같은 계열 갈색(광산 땅 키트)으로, 용암 못 가장자리 계단식은 이웃 다수결 두 번으로 완화.
- 안 바뀐 것: 천장 회색 윤곽선(오토타일 그림), 벽 앞면(성 벽돌 / 회색 석재), 화산 벽. 그림이 필요하다.

**검증:** `bun scripts/content/dungeon-proof.mts <dir>` — 종류 × 어댑터 × 장르 × 시드를 `author_dungeon` 으로 실제 시공하고 `run_lint`·`check_reachability`·`check_terrain_access` 를 같이 돌려 PNG(원 해상도)와 `proof.json` 을 쓴다(2026-10-15: 42판, lint error 0, 전부 도달, check_terrain_access 전부 true). 기존 beodeul 24판 sha1 기준선: 안 건드린 5종은 전부 동일, 고친 동굴·광산·화산만 의도적으로 바뀜.

**조수 던전 시험 후 고친 것(2026-10-22, assistant-dungeons, 기준 시험 9건 Opus 적대 VQA 평균 4.5):**
- **죽은 계단** — 8맵 전부 계단이 장식뿐이었다. 이제 1층 바깥 계단은 `entrance` 를 줄 때만 그리고(`entryStair:"none"`), 마지막 층에는 내려가는 계단을 그리지 않는다(`exitStair:"none"`).
- **여러 층** — `floors`(1~5)·`direction`(down 지하 / up 탑). 층마다 맵을 짓고 계단 칸에 이동 이벤트(`ev_<map>_stair_next/back`, 걷는 계단 priority below, 문 same)를 직접 깐다. 도착은 상대 계단 앞 칸, 계단을 등진다(계단 계약 `stairContracts.json`). 탑은 1층 입구 = 나무 문, 위층 입구 = 바닥 내려가는 계단, 깊은 방 북벽 = 오르는 계단, 꼭대기 층 = 큰 홀 → 보스방 + 보물 방(`towerRooms`, 감방·묘실 없음). 조립기 `compose.ts` 의 `entryStair`/`exitStair`/`sideDoor`.
- **빈 방** — `populate`(rpg 기본 켜짐): 계획 자리의 순찰 적(≤4), 상자 2(보물 방 먼저 — 같은 그림 3개부터 린트 경고), 마지막 층 보스(도망 불가)·보스 앞 방 회복 세이브, 그 아래층 층 수문장. `troops:{field,midBoss,boss}` 로 요청한 적을 넘긴다. 도구가 그림을 스스로 고르므로 `choosesOwnGraphic`(없으면 Pi 의 그림 선택 검사가 세 번 거부했다). `expand_jrpg_campaign_volume`·`author_jrpg_chapter` 는 자기 채우기가 있어 `populate:false` 로 부른다.
- **물에 잠긴 신전** — `flooded:true`: 큰 방(입구·보물 방 제외) 바닥 대부분을 물로, 굽이치는 3칸 둑길(긴 축 + 큰 방은 가로 축)을 남긴다(`mask.ts carveFlood`). 조수가 `fill_region` 으로 네모 웅덩이를 칠하던 것을 대신한다.
- **레버 퍼즐** — `puzzle:"lever"`: 보물 방(없으면 보스방) 통로 칸에 쇠창살(object1#5), 먼 곁방에 레버(object2#0), 스위치 `sw_<map>_lever`. 손 도트 실내 퍼즐 방(다른 화풍)을 따로 잇던 것을 대신한다.
- **작은 동굴** — `size:"small"` 동굴은 56×44 상자·방 3개(옛 64×49·방 4), 입구 굴은 네모가 아니라 잡음 타원. 기본 시드는 7 고정이 아니라 맵 id·이름·맵 수에서 뽑는다(시드를 안 준 던전이 전부 같았다).
- **흐르는 용암** — 화산은 용암 못끼리(없으면 가장 가까운 일반 방까지) 바닥을 따라가는 BFS 최단 길 위에 폭 1~2 용암 줄기를 판다(보스·보물·입구 방 제외, 좁은 목은 settle 이 다리). 용암 가장자리 그림은 여전히 없다.
- **소굴** — `lair:true`(버들항 cave): 호수·웅덩이 없이 마른 굴, 큰 방엔 천막(desert-oasis-tent), 모닥불 둘레 자루·궤짝·가죽 걸이, 벽가 통·뼈 무더기, 이끼 수정 대신(`dress.ts lairCamp`). 「고블린 굴」이 수정 동굴로 읽히던 것.
- **2026-10-23 2·3차(같은 요청 다시, Opus 적대 VQA):**
  - 채운 뒤 `data.population` 의 계획 후보(적·상자 7자리)를 지우고 `data.placed` 에 실제 수만 남긴다. 요약 끝에 「실제로 놓인 수 … 이 수와 좌표만 말한다」를 붙인다. 조수가 계획 자리 수를 「상자 7개」로 답했고, `lockedGate` 문장을 「열쇠로 여는 잠긴 문」으로 지어냈다(레버 퍼즐이 아니면 그 문장도 뺀다).
  - 생성 몬스터 필드 심볼(`generated-enemy-*`)은 헤드리스 렌더(`scripts/qa-game/render.mts`)에서도 그린다. 게임에서는 보였지만 측정 그림에서는 투명했다.
  - 홀 벽의 장식 아치(열린·쇠창살 둘 다)를 뺐다. 「어디로도 안 가는 문」으로 읽혔다.
  - 큰 방 기본 크기를 한 단 줄였다: 홀 13×8, 보스 13×9, 묘실 11×7, 감방 10×6, 입구 10×6, 탑 층 13×9.
  - 홀 가운데 줄에 화로 한 쌍과 잔해 무더기를 두고, 보스방 가운데에 의식 원(`temple-ruins-mosaic-medallion-5x5`)을 깐다.
  - 물에 잠긴 방은 벽 앞 한 줄만 마른 턱으로 남긴다.
  - 레버 퍼즐의 쇠창살은 통로 폭 전체를 막는다. 3칸 통로 가운데 한 칸만 막으면 옆으로 지나갔다. 창살 칸들은 이름 「쇠창살」 하나라 린트의 「같은 그림 조사물」에 걸리지 않는다. 레버는 그 방 북쪽 벽 앞 칸으로 옮기고, 「한 칸 레버가 정상」이라고 알린다. 조수가 「레버가 안 보인다」며 던전을 세 번 다시 짓고 실내 칩셋 레버를 찍었다.
  - `rebuild:true`: 이 도구가 지은 던전 맵(`mapRole: dungeon`)을 같은 mapId 에서 다시 짓는다. 거절되자 조수가 새 맵을 또 만들어 같은 이름 던전 두 장이 남았다.
  - 동굴의 닫힌 작은 벽 덩어리(넓이 30 이하)는 바닥으로 메운다(`fillWallIslands`). 「벽돌 기둥 위 검은 구멍」으로 그려졌다.
  - 용암 줄기는 잡음 비용 최단 길로 굽이친다.
  - 「던전」이라고 부른 지하 묘지·카타콤은 `author_dungeon` 이다. 고딕 납골당 방 여러 장을 `create_transfer_pair` 로 잇던 경로를 막았다(`intentDeclaration`·`gothicPlaceTools`·`toolCapabilityIndex`).
  - 남은 가장 큰 감점은 방 사이·바깥의 검은 허공(맵의 40~60%)이다. 허공을 채울 동굴 천장 바위 결 그림이 없고, 용암·물 가장자리 전이, 탑 전용 조각, 버들항 화풍 문·레버도 없다. 모두 사람 선택이 필요한 그림이라 코드로 메우지 않았다.
- 증명: `bun scripts/qa/dungeons/proof.mts <dir>`(레지스트리 경로라 중첩 도구까지 돈다), 걷기 영상 경로 `scripts/qa/dungeons/walk-route.mts` + `scripts/qa/runtime/dungeon-walk.scenario.mjs`.

**없는 그림(다음 타일 작업자 몫, `capabilities.ts` `missingArt` 가 정본):**
- beodeul: 선로 타일(가로·세로·모서리·T) / 갱목 지지대(벽 걸이 1×2·바닥 기둥 1×2) / 광석 박힌 벽·바닥 / 현무암·재 바닥 변형 · 현무암 벽 앞면 3h/2h · 용암 식은 껍질 가장자리 / 갈색 테두리 동굴 천장 오토타일 / 얼음 동굴 일체.
- monster: catacomb·castle·sewer·mine 일체 / 마른 동굴 안 물·용암 조각 / 유적 신전 안쪽 칸막이 / 화산 제단·보스 연출 / 얼음 판 퍼즐 문.
- stub 칩셋: 고딕(지하 벽·석관·감방) · 조선(동굴 벽 앞면·천장·바닥) · 마법 학교(지하 감옥 오토타일) · 해적(동굴 천장·물웅덩이) · 선사(동굴 일체·용암) · 사막동양(지하 무덤 일체) · 그 밖(던전 조각 일체).

## 마당 바닥 오토타일 (2026-10-23, village-art)

- **오토타일 셋:** `beodeul_yard_cobble`(자갈) · `beodeul_yard_dirt`(다진 흙) · `beodeul_yard_flag`(판석).
  - 위치: 시트 줄 224, `BEODEUL_YARD_BASE` = 28672, 칸 28672~28742.
  - 한 면은 21칸이다: 몸 8, 변 4, 모서리 4, 외딴 1, 안쪽 모서리 4. 자갈·판석은 변 칸이 둘씩 있다.
- **굽기:** `scripts/content/beodeul-wall/bake_wall.py` 끝에서 `bake_yard.py` 를 잇는다(`--dev` 전달). 이 굽기로 버들항 시트가 2048×3600, 28800칸이 됐다.
- **이식 칸 이동:** 원래 28416 에 있던 자연 이식 칸은 28800 으로 옮겼다.
  - 증명: `scripts/qa/beodeul-graft-relocation-proof.mts`. 기존 프로젝트 사본으로 이동 후 모든 맵이 화소까지 같음을 보였다.
- **배선:** `src/project/defaults/beodeulCity.ts` 의 `mergeShippedFarm(…, withYard)` · `mergeShippedKits(…, withYard)`.
  - 타일 묶음은 `beodeul:yard_*`, 견본 킷은 `bd-yard-*-sample` 이다.
- **쓰는 곳:** `dress_village_quarter` 의 temple-ruins(판석) · mining · vineyard(다진 흙) 마당. 규칙은 `openwiki/editor-ai-tools.md` 「마을 종류 표」 절에 있다.
- **검수 증거:** `tiledata/beodeul-yard/_gate/`
