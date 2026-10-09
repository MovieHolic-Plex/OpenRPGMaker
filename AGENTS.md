# OPRN Studio Agent Entry Point

> **AI 기록 조회:** 현재 프로젝트 폴더의 `project.sqlite`에 있는 `ai_conversations`와
> 브라우저 IndexedDB `oprn-ai-records`를 먼저 확인한다. `entries_json`의 `kind: user`에서 원문을 찾는다.
> 과거 LegacyDb 기록을 이관·복구할 때만 `Accept-Profile: rpg_zzu`로 조회한다.
> 2026-09-04에는 다른 project id 아래에 원문이 있었으므로, 과거 기록 검색은 project id로 먼저 제한하지 않는다.

This repository uses a project-local OpenWiki layer so coding agents can understand the editor before changing it.

## 처음 온 에이전트는 이 두 쪽만 먼저 읽어라

1. **`openwiki/quickstart.md`** — 환경 보정(워크트리 `node_modules`/`.env.local`), **어떤 명령이 진짜 게이트인지와
   그 기준선 실측값**, 기능→진입 파일 표. 3분이면 읽는다. 이걸 건너뛰면 가짜 오류를 디버깅하게 된다.
2. **`openwiki/INDEX.md`** — 위키 절 좌표(생성 파일, `npm run openwiki:index`). 위키는 41쪽 약 1MB(약 27만 토큰)이고
   7쪽은 읽기 도구 상한 50KB 를 넘어 **통째로 읽으면 조용히 잘린다**. 필요한 절만 줄 번호로 잘라 읽어라.

## 하네스 (hard rule)

- **에디터 조수의 자연어 명령 수행·기존 콘텐츠 보존·플레이·시각·SQLite 재로드를 기능별로 점검할 때**
  → `assistant-capability` · 시드 `harness-data/assistant-capability/seed.json`
  → `npm run harness -- assistant-capability <단계>` · 문서 `openwiki/harnesses/assistant-capability.md`
  → 실제 입력창의 Pi 경로를 쓴다. 필수 검수 누락은 미검증이며, 조수의 완료 선언이나 캡처만으로 합격시키지 않는다.

- **버들항 새 건물 후보를 사람이 하나씩 허용/거절할 때** → `beodeul-building-review` · 시드 `harness-data/beodeul-building-review/seed.json` · `npm run harness -- beodeul-building-review produce|build|validate|gate|publish|serve|status|export` · 문서 `openwiki/harnesses/beodeul-building-review.md`. 사용자가 새 지붕·창문·벽 질감 저작을 명시 허용한 후보 경로다. 원본 도트 질감을 보존하고, 독립적인 질감·구조 Visual QA와 숨긴 반려 표본 검사를 모두 통과한 후보만 공개한다. build는 비공개 초안이다. 검사 생략·강제 PASS·점수 완화 금지. 사람이 현재 그림 해시에 대해 허용하기 전에는 번들·지도에 설치하지 않는다. 이전 form-wing/inn/smithy/warehouse는 사용자 반려이며 기준작으로 쓰지 않는다. 기존 원본 보존 보정은 아래 beodeul-architecture 경로를 따른다.

**버들항 건물 보정:** 기존 지붕·윤곽·도트 질감을 보존한다. 3/4 탑뷰는 원본 지붕 윗면으로 충분하며 측면은 필수 조건이 아니다. 창문·중복 문·벽색·기초만 국소 보정한다. 다른 칩셋과 월드맵 아이콘은 각 전용 시점 계약을 따른다.

- **버들항 민가·교회 그림/창문·문·벽 재질·기초를 저작할 때** → `beodeul-architecture` · 시드 `harness-data/beodeul-architecture/seed.json` · `npm run harness -- beodeul-architecture build|validate|review` · 문서 `openwiki/harnesses/beodeul-architecture.md`. 원본과 보정본의 지붕·투명 윤곽·수정 영역을 대조하고 검수 그림을 연다. 기계 통과를 시각 합격으로 대신하지 않는다.

아래 작업은 손으로 하지 말고 해당 하네스를 실행한다. 목록·단계는 `src/harnesses/INDEX.md`(생성 파일),
구조 규칙은 `openwiki/harnesses/README.md`.

- **이미 선택한 실내 기물의 방향·상태·모션·크기 파생을 만들거나 유지보수할 때**
  → 슈퍼하네싱의 `interior-props` 서버 하네스, 화면 `/harness` → 「기물·파생」.
  → 먼저 `openwiki/harnesses/interior-prop-derivations.md`와 `interior-prop-derivations-operations.md`를 읽는다.
  → 제안 후 사람이 주문·선택한다. 확정 후 공용 SQLite에 자동 게시한다. 에디터 공방 IndexedDB와 혼동하지 않는다.
  → 서버 정본은 DB뿐 아니라 실제 체크아웃의 items/sets/후보·모션 파일과 판본 baseline을 함께 보존한다.
    기존 공간 슈퍼하네스와의 자동 재료 수신은 별도 통합 단계다.

- **에디터용 RM2000 캐릭터를 변형·대량 저작·검사·패킹할 때**
  → `charset-actor` · 시드 `harness-data/charset-actor/briefs.json`
  → `npm run harness -- charset-actor <단계>` · 문서 `openwiki/harnesses/charset-actor.md`
  → GPT 6.1 sol high가 자유롭게 픽셀 저작 → 결손 검사 → GIF. 사람이 남기기/폐기를 결정하며 남긴 칩만 팩으로 만든다. `produce --count 100`으로 시작하고 설치는 별도다.

- **몬스터 수집(포켓몬류) 게임의 종·스타터·진화 계통 전투 스프라이트(앞모습·뒷모습)를 만들 때**
  → `monster-collect-species` · 시드 `harness-data/monster-collect-species/seed.json`
  → `npm run harness -- monster-collect-species <단계>` · 문서 `openwiki/harnesses/monster-collect-species.md`
  → 후보는 사람이 고른다. JRPG 일반 적 그림에는 쓰지 않는다.
- **몬스터 수집 게임의 주인공·NPC 걷기 도트 또는 오프닝 클립을 생성·교체할 때** → `pokemon-character-motion` · 시드 `harness-data/pokemon-character-motion/seed.json` · `npm run harness -- pokemon-character-motion <단계>` · 문서 `openwiki/harnesses/pokemon-character-motion.md`. 구조 관문과 해시에 묶인 재생 검수 후에만 build 한다.
- **포켓몬류 NPC 후보를 만들고 사용자가 Allow/Deny하도록 할 때** → `pokemon-character-casting` · `npm run harness -- pokemon-character-casting prepare|serve|status|build` · 문서 `openwiki/harnesses/pokemon-character-casting.md`. 현재 패키지의 사용자 Allow가 필수이며 조수·감독자가 대신 승인하지 않는다. 신규·변경된 걷기 후보는 공용 등록에서도 같은 현재 판정을 확인한다.
  - **공개 저장소에는 없다** — 닌텐도 원작 걷기 그림을 판형으로 쓰므로 `scripts/oss/publicSet.mjs` 가 빼고 `.gitignore` 로 막았다(2026-10-09). 내부 체크아웃의 로컬 사본에서만 쓴다.
  - **에디터 독립 재사용:** `harness/pokemon-like-characters/`의 README.md와 AGENTS.md를 읽고 `node cli.mjs`로 실행한다. 이 폴더만 복사해 사용할 수 있으며 기본 export는 native PNG/GIF/sprite.json이다. 기존 에디터 후보/판정 저장소와 분리한다.
- **modern3 현대 거리 칩셋의 기물 도트(현재 탈것: 자동차·버스·트럭·열차)를 그릴 때** (3/4 시점: 윗면이 면으로 보여야 한다)
  → `modern-chipset` · 시드 `harness-data/modern-chipset/seed.json`
  → `npm run harness -- modern-chipset <단계>` · 문서 `openwiki/harnesses/modern-chipset.md`
  → 기준 = 프로젝트의 modern-city-atlas 경찰차. 후보는 Sonnet 5명이 pxgrid 로 찍고 사람이 고른다. 직접 그리지 말 것.
- **jp_city 번들(일본 도시, modern3)의 주택가·역·공원·신사 그림(건물 외형·소품·바닥 타일·키트)을 그릴 때** (3/4 시점, 사람·글자·상표 금지)
  → `jp-city` · 시드 `harness-data/jp-city/seed.json`(항목 40, wave houses/station/park/shrine)
  → `npm run harness -- jp-city <단계>` · 문서 `openwiki/harnesses/jp-city.md`
  → 후보는 Sonnet 5명이 pxgrid 로 찍고 **사람이 고른다**(시트 `~/claude-viz/jp-<판>.html`). 직접 그리거나 감독이 고르지 말 것. 웨이브 구동 `src/harnesses/jp-city/waves.py`.
- **던전·동굴 공용 칩셋 beodeul_dungeon(버들항과 같은 oprn-atlas 계열)의 불규칙 벽·바닥 오토타일·물/용암/얼음 가장자리·계단·문·함정·상자·횃불 조각을 그릴 때**
  → `dungeon-chipset` · 시드 `harness-data/dungeon-chipset/seed.json` · `npm run harness -- dungeon-chipset palette|validate|list|draw|gate|sheet|pick|reject|status` · 문서 `openwiki/harnesses/dungeon-chipset.md`
  → 코드 손 도트(행 문자열), 버들항 실제 색 잠금 팔레트. 후보는 사람이 시트(`~/claude-viz/dungeon-<판>.html`)에서 고르고 pick 은 그림 해시에 묶인다. 관문 통과는 합격이 아니며 번들 굽기는 별도.
- **조선(바람의나라풍) 칩셋 joseon_baram 의 조각·지도를 만지거나 번들을 재생성할 때** (팔레트 잠금·게이트 P/E/T/L/S/A/K/TR/V·판정·지도 관문·16구역 적대 검수)
  → `joseon-baram` · 시드 `harness-data/joseon-baram/seed.json`(지도 15장·관문·쓰지 말 것)
  → `npm run harness -- joseon-baram <단계>` (palette·validate·list·gate·verdict·build·map·review·status) · 문서 `openwiki/harnesses/joseon-baram.md`
  → 기존 `scripts/content/lib/joseon/` 도구를 한 입구로 묶은 것이다. 그림은 코드 도트만(생성 이미지·생성 캐릭터 금지, Actor1 사용), 바람의나라 스크린샷 커밋 금지, 판정은 해시에 묶이니 손으로 고치지 말 것.
- **무림(중국 무협) 칩셋 murim_wuxia 의 바닥·벽·지붕·객잔 가구·도장 기물·산문 같은 조각 후보를 그리거나 사람에게 고르게 할 때** → `murim-chipset` · 시드 `harness-data/murim-chipset/seed.json`(묶음 style·frame·inn·dojo·outdoor, 잠긴 팔레트 `palette.json`) · `npm run harness -- murim-chipset validate|palette|list|draw|gate|sheet|pick|reject|status` · 문서 `openwiki/harnesses/murim-chipset.md`. 행 문자열 격자 코드 손 도트만(생성 이미지·사람 그리기 금지, 비교는 Actor1). 화풍은 **컨셉 줄**(A 밝은 문파 주 줄 · B 강남 무관)마다 따로 간다 — style-r1 뒤 판은 줄마다 후보(A1 A2 B1 B2)를 그 줄 style-r1 조각과 같은 색·결·윤곽으로 그린다. 관문 통과는 합격이 아니다. **감독·에이전트는 고르지 않는다** — 시트 `~/claude-viz/murim-<판>.html` 에서 사람이 고른 후보만 그림 해시에 묶어 (항목, 줄)마다 기록하고, 번들에는 굽지 않는다.

- **지금 맵 칩셋에 없는 물건을 공방에서 그려 그 칩셋에 넣을 때(조수 「없는 타일」 카드의 「직접 그려 줘」, 손 도트 실내 밖 16px 맵)**
  → `map-objects` · 문서 `openwiki/harnesses/map-objects.md` · 에디터 왼쪽 막대 「공방」 → 「맵 기물」.
  → 팔레트는 그 칩셋에서 뽑아 정의에 넣고, 사람이 고른 것만 굽는다. 번들 칩셋의 공방 칸은 `ensureBundledTilesets` 가 떼었다 다시 붙인다.

- **조수가 특정 공간 낱말(미궁·감옥·하수도…)을 잘못 깔 때 / 개념 카드(`src/assets/conceptCards.json`)를 고칠 때**
  → `super-harness` · 시드 `harness-data/super-harness/seed.json` · 문서 `openwiki/harnesses/super-harness.md`
  → 자동으로 도는 데몬이다(화면 http://mdc-server:18315/). 카드를 손으로 쓰지 말고 화면에서 교정 지시·폐기.

- **월드맵 아이콘을 검수·교정·선택 시트로 굽거나 공용 스탬프에 넣을 때**
  → `worldmap-icons` · 시드 `harness-data/worldmap-icons/seed.json` · 문서 `openwiki/harnesses/worldmap-icons.md`
  → `npm run harness -- worldmap-icons <단계>` (intake·review·draw·serve·status·export·build·check·preview).
  → 사람이 선택한 현재 해시만 굽는다. 선택 정본은 `WMI_HARNESS_DATA/harness.sqlite`, 칸 번호는 덧붙이기 전용이다.

- **조수가 만든 방·실내·현대 실내·무림 장소의 시각 품질을 카테고리·모델별로 잴 때**
  → `space-craft` · 시드 `harness-data/space-craft/seed.json` · `npm run harness -- space-craft list|prepare|run|measure|sheet|status` · 문서 `openwiki/harnesses/space-craft.md`
  → 실제 입력창 경로(assistant-capability 실행기 재사용). 기계 지표 통과는 시각 합격이 아니다 — 그림은 판정자·사람이 본다.

- **단일 관계·연애 / 대화 중심 / 한 관계 / 첫 만남 한 장면을 제작할 때**
  → `romance-scene` · 시드 `harness-data/romance-scene/seed.json` · 문서 `openwiki/harnesses/romance-scene.md`
  → `author_romance_scene`으로 원자적으로 저작하고 `inspect_romance_scene`으로 양쪽 선택·재대화·취소·종료를 검사한다.
  → 임시 초안·조수의 완료 선언은 합격이 아니다. 실제 이미지 검수와 정본 저장·재로드를 따로 확인한다.

- **새 게임 피드의 공식 컨셉 카드(제목·훅·기획 5칸·도트 썸네일)를 만들거나 늘릴 때**
  → `game-concepts` · 시드 `harness-data/game-concepts/seed.json`
  → `npm run harness -- game-concepts produce|draw|check|serve|status|publish|bundle` · 문서 `openwiki/harnesses/game-concepts.md`
  → 사람이 http://mdc-server:18321/ 에서 받은 것만 스토어에 게시한다. 감독이 대신 고르지 않는다. 운영 게시는 `--target prod --yes-prod`.

새 하네스를 만들면 `src/harnesses/<id>/` 폴더 하나에 두고, `src/harnesses/_core/registry.ts` 에 등록하고,
`npm run harness -- list` 로 INDEX 를 다시 쓰고, 이 목록에 한 줄을 더한다.

그다음에 아래 순서로 간다.

1. `openwiki/PROJECT_WIKI.md` - the current project-specific AI map.
2. The focused OpenWiki page for the area you will edit (크기는 INDEX 에서 먼저 확인):
   - Editor pre-edit routing & cautions: `openwiki/editor-pre-edit-routing.md` (read first for any editor change)
   - Editor observability — mutation 계측 초크포인트, 편집 감사 로그, 오류 트랩, 디버깅 레시피: `openwiki/editor-observability.md` (read before adding an editing feature or debugging "방금 뭘 했더니 이렇게 됐다")
   - Editor event authoring: `openwiki/editor-event-authoring.md` + `openwiki/editor-event-commands.md` + `openwiki/editor-event-command-fixes.md`
   - Editor database: `openwiki/editor-database.md`
   - 세계 생성 규칙 (AI 마을 생성의 물·숲·길 수치와 낱말 판정을 DB 「세계 → 생성 규칙」 탭으로 저작): `openwiki/world-generation-rules.md`
   - 버들항 v6 · 로마풍 항구 도시 (Python 손 도트 100×100 을 칸으로 자른 공용 타일셋 beodeul_city 23,936칸·animationStrips 1,699·구역/건물/소품 키트 120, 참고문서 4용도·정본 저장·조수 시험, 다음 판 참고 그림): `openwiki/beodeul-city.md`
   - 조선(바람의나라풍) 칩셋 joseon_baram · 손 도트 조각 291종+실내·사냥터·동굴 키트·오토타일 19종을 공용 번들 타일셋으로 (변환기 `build-joseon-tileset.py`, 시트 여러 장 합치기, 칸 통행 X/C/F·꼬리 복사본, 참고문서 6용도, 지도 15장 저장·장소 카드, 재실행 한 줄 `rebuild-joseon.sh`): `openwiki/joseon-baram.md`
   - 마법 학교(해리포터풍) 번들 wizarding_world · 성채 공용 벽·바닥·문과 12공간 기물·학생/교수/생물 걷기 칩(Wizarding 시트)·마법 효과를 코드 손 도트 조각 모듈로 그려 **독립 검수 PASS·해시 일치분만** 굽는다 (계약 `scripts/content/wizarding/CONTRACT.md`, 굽기 4단계, 얇은 재검수 `recheck_sheet.py`, 장소 예제): `openwiki/wizarding-world.md`
   - Editor AI panel & tools: `openwiki/editor-ai-panel.md` + `openwiki/editor-ai-tools.md`
   - Editor misc workflows: `openwiki/editor-workflows-misc.md`
   - 에디터 「공방」 (하네스를 에디터 안에서 사용자 계정 모델로 돌리기 — 왼쪽 막대, 실행기·저장·표면): `openwiki/editor-workshop.md`
   - 에셋 스토어 (편집기 안 공용 장터 — 팩 형식 `oprn-store-pack/1`, 프로젝트에 넣기·출처·크레딧, Electron 중계, `store-server/`, 스테이징 http://mdc-server:18320, Rasak·REFMAP·MV·PAW 제외): `openwiki/asset-store.md`
   - Editor validation: `openwiki/editor-validation.md`
   - **타일을 저작하는 모든 에이전트:** 먼저 현재 프로젝트의 `타일 → 참고문서 → 해당 용도`를 읽어라. `list_tileset_references`로 용도/자료 목록을 조회하고 `read_tileset_reference`로 MD 전 페이지와 실제 이미지를 확인한 뒤 배치한다. 코딩 에이전트는 정본(SQLite 호스트) 프로젝트를 읽어 `scripts/content/export-tileset-references.mjs`로 추출하고 이미지를 직접 연다. 이전 대화나 저장소의 옛 학습 문서만으로 대체하지 않는다. 구현·도구 계약은 `openwiki/tileset-reference-documents.md`.
   - **새 타일·타일 학습은 공용에 넣는다 (hard rule):** 특정 프로젝트에만 추가하고 끝내지 마라. 타일 그림은 `src/assets/bundled.ts` 번들로, 학습 자료는 `tiledata/<칩셋>/` 에 출처를 커밋하고 `scripts/content/prepare-*-references.mjs` 로 `src/assets/*References.json` 번들을 만들어 타일셋 정의와 `ensureBundledTilesets` 에 배선한다. 아래 「새 타일·타일 학습은 공용에 추가한다」 절을 따른다.
   - **조수에게 타일셋 까는 법 가르치기** (조수가 실제로 보는 것·업로드 타일셋에서 비는 것·참고문서/이름표/조립법 순서·재배포 금지 팩): `openwiki/teaching-assistant-tilesets.md`
   - 타일 레이어·배경 정책 (투명 여부와 홈 레이어·받침·다중 조각 제약의 분리, 커스텀 칩셋 검토 흐름): `openwiki/tile-layer-policy.md`
   - 공통 지연 툴팁 (아이콘 컨트롤 툴팁 동작 계약·명시 롤아웃 목록·문구 규칙): `openwiki/delayed-tooltip.md`
   - 편집기 다국어 (ko/en/ja/zh 언어 결정 순서·DOM 번역 계층·화면 글자 역참조 금지 계약·카탈로그 추가 절차): `openwiki/i18n.md`
   - Interior room harness: `openwiki/editor-interior-room-harness.md`
   - **월드맵 아이콘은 하네스를 거친다:** `src/harnesses/worldmap-icons/README.md` — 검수자(시점 계약: 윗면+정면 벽, 옆면 금지)가 판정하고 사용자가 http://mdc-server:18313/ 에서 받기/버리기. 결정 `harness-data/worldmap-icons/decisions.json`. 감독이 대신 고르거나 바로 번들·지도에 넣지 않는다.
   - **캐릭터 칩(RM2000 CharSet)은 하네스로 만든다:** `src/harnesses/charset-actor/README.md` — GPT 6.1 sol high가 원본 격자를 직접 자유 저작 → 결손 검사 → GIF 대기열. 사용자가 http://mdc-server:18314/ 에서 남기기/폐기만 결정한다. `npm run harness -- charset-actor produce --count 100` 또는 화면에서 시작한다. 사람 선택은 현재 그림 해시에 묶으며 실제 남긴 캐릭터만 다운로드한다. 데이터는 저장소 밖 `CHR_HARNESS_DATA`에 보존하고 프로젝트 설치는 별도다.
   - **실내는 손 도트 v5 하나 (hard rule, 2026-09-29):** 공용 실내 `atlas_biome_interior` = 손 도트 실내 v5 전용 시트(옛 Tibo·EasyRPG 실내·LPC 가구 칩셋은 폐기, 조수에게 안 보이고 거부된다). 던전·동굴은 등록 장소를 `import_region_reference` 로 가져온다 — `atlas_biome_dungeon` 을 포함한 EasyRPG 계열로 조수가 새 맵을 만드는 것은 막혀 있다(2026-10-06, `openwiki/editor-ai-tools.md` 「EasyRPG 계열 칩셋 차단」). 도구 `build_hand_interior_room`, 스킬 원본 `assistant-skills/interior-room-authoring/SKILL.md`, 편집기 「새 맵 → 실내」 기본도 이 칩셋: `openwiki/atlas-biome-interior.md`
   - `openwiki/editor-workflows.md` is now a slim index linking to the above topic pages.
   - Runtime pre-edit routing & cautions: `openwiki/runtime-pre-edit-routing.md` (read first for any runtime change)
   - 타이틀 오프닝 효과 (WebGL 빛내림·칼날 반사·물결·안개, AI 키아트 + 비전 좌표 맞춤): `openwiki/title-opening-effects.md`
   - 세계 지도 지형 편집 (조수가 대륙·해협·섬·산맥·강·숲·바닥을 ops 로 다시 그림, 월드맵 키트 빌드 경로·저장 형태): `openwiki/worldmap-terrain-editing.md`
   - Runtime battle: `openwiki/runtime-battle.md`
   - 픽셀을 직접 찍는 자산·전투 효과 저작: `openwiki/pixel-dot-authoring.md` → `assistant-skills/pixel-dot-authoring/SKILL.md` · `assistant-skills/pixel-fx-animation/SKILL.md` (전용 하네스가 있으면 그 경로 우선, 반려된 도형 시안을 기준작으로 쓰지 않는다).
   - 배틀러 idle 애니메이션을 **새로 추가하는 절차**(표시 상자 실측 → 클립 → 창 탐색 → 패킹 → 검증, 네 계약과 함정): `openwiki/battler-idle-playbook.md`
   - Runtime action combat: `openwiki/runtime-action-combat.md`
   - Runtime sessions & state: `openwiki/runtime-sessions.md`
   - Runtime project schema & persistence: `openwiki/runtime-project-schema.md`
   - Runtime M2 flow controls: `openwiki/runtime-m2-flow-controls.md`
   - State system (authored definition, ontology, runtime application, editor surface): `openwiki/state-system.md`
   - 높이 지형 relief (단·경사로·벽면 장식 — 편집기 붓·절벽 띠·들린 타일, 게임 걷기·들림·depth, 성능 계약, 알려진 한계): `openwiki/relief-terrain.md`
   - `openwiki/runtime-and-data.md` is now a slim index linking to the above topic pages.
   - `openwiki/architecture.md` for boot flow and ownership boundaries.
   - `openwiki/testing.md` for validation expectations.
   - 릴리스·버전 (네 축 구분, 빌드 라벨, `npm run release` 절차): `openwiki/release-and-version.md`
   - 라이선스 (에디터 SUL · 런타임 MIT · 게임 산출물 자유 · 기본 에셋 OPRN 게임 사용 · CLA, 런타임에 에디터 코드 끌어들이지 않기): `openwiki/licensing.md`
   - Parallel agent isolation & verification gates: `openwiki/agent-worktrees.md` (read before running more than one coding agent).


## Agent Configuration Map

This repo has multiple agent tooling directories. Here is what each is and whether it is tracked:

| Directory / File | Purpose | Tracked? | Canonical? |
|---|---|---|---|
| `AGENTS.md` | **Canonical agent entry point** — read this first. All agents start here. | Yes | **Yes — source of truth** |
| `CLAUDE.md` | Claude Code 자동 로드 진입점. `@AGENTS.md` 한 줄로 이 문서를 가져온다(Claude Code 는 `AGENTS.md` 를 스스로 읽지 않는다). 내용을 여기에 쓰지 말 것. | Yes | No — `AGENTS.md` 를 가리킨다 |
| `.mcp.json` | MCP server config (oprn-assistant bridge). Currently gitignored (session-local). | No (gitignored) | Yes for MCP config |
| `.kiro/` | Kiro CLI workspace config. `agents/` holds tracked custom agent profiles; `settings/cli.json` holds tracked model defaults. Invoke with an explicit model/effort when the task requires a fixed profile. | Yes | Kiro-specific |
| `openwiki/` | Project-local AI wiki (focused pages agents read before editing). | Yes | **Yes — source of truth for codebase knowledge** |
| `.agents/` | Senpi agent skills (project-local skill overrides). | No (gitignored) | Skills only |
| `.claude/` | Claude Code agent config. | No (gitignored) | Claude-specific |
| `.codex/` | Codex agent config + event logs. | No (gitignored) | Codex-specific |
| `.gjc/` | GJC agent state. | No (gitignored) | GJC-specific |
| `.qoder/` | Qoder auto-generated repowiki. **Not tracked — it duplicates `openwiki/` and went stale** (10 files still described the repo as a pnpm monorepo after the npm switch). Use `openwiki/` instead. | No (gitignored) | **No — use `openwiki/`** |
| `.qwen/` | Qwen agent config. | No (gitignored) | Qwen-specific |
| `.senpi/` | Senpi agent session state. | No (gitignored) | Senpi-specific |
| `.superpowers/` | Superpowers agent config + `sdd/qa-shots/` QA screenshots. The QA screenshots **are** tracked as authored evidence; the rest is session-local. | Partial (`sdd/qa-shots/`) | Superpowers-specific |
| `.omo/` | ULW-loop state, evidence, and rules. Partially tracked (`.omo/evidence/` and `.omo/rules/`). | Partial | State + evidence |

이 표는 실측과 일치해야 한다. 실측: 2026-07-31 정리에서 `.qoder/` 75건과 `.codex/` 5건이
"No (gitignored)" 라고 적혀 있었는데도 **tracked** 였다. `.codex/` 는 `.gitignore` 규칙이
있었지만 규칙보다 먼저 커밋돼 규칙이 무력화된 상태였다. 표를 고치는 것만으로는 부족하므로
index 에서 제거하고 `.gitignore` 에 `.qoder/` `.qwen/` `.senpi/` `.agents/` 를 추가했다.
표를 수정할 때는 `git ls-files <dir> | wc -l` 과 `git check-ignore -q <dir>` 로 검증하라.

**For any agent entering this repo:**
1. Read `AGENTS.md` (this file) — it is the canonical entry point.
2. Read `openwiki/quickstart.md` (환경·게이트 기준선·기능→파일) and `openwiki/INDEX.md` (위키 절 좌표).
3. Read `openwiki/PROJECT_WIKI.md` — it is the canonical project-specific AI map.
4. Use `.mcp.json` for MCP server config (oprn-assistant bridge on localhost).
5. Your own agent config dir (`.claude/`, `.codex/`, `.senpi/`, etc.) is session-local and gitignored — do not commit it.
6. `.omo/ulw-loop/` holds durable goal state and evidence; `.omo/evidence/` and `.omo/rules/` are tracked.

**Do not create a new agent config dir.** If your agent isn't listed, add it to this table with its purpose.

## 편집기 QA 와 런타임 QA 는 다른 도구를 쓴다 (hard rule)

**게임(런타임)을 브라우저로 QA 할 때 편집기 셸을 통과하지 마라. 전용 하네스가 있다.**

```bash
npm run qa:runtime          # 반복 작업 (--project <path> --scenario <name> --headed)
npm run qa:runtime:gate     # 게이트: 두 시나리오
```

결과는 `verify-shots/runtime-qa/<시나리오>/SUMMARY.md` 를 **먼저** 읽고, 거기서
"즉시 확인" 으로 표시된 PNG 만 열어라. 전량 열람은 컨텍스트 낭비다. 새 시나리오는
`scripts/qa/runtime/<name>.scenario.mjs`. 설계·근거는
`docs/superpowers/specs/2026-08-28-runtime-vision-qa-design.md`, 함정 목록은
`openwiki/testing.md`.

왜 편집기 경로로 하면 안 되는가 (실측):
- `src/app/mode.ts` 의 `enterMode` 는 play 모드에서도 `renderTopbar()` 를 호출한다 —
  톱바가 모든 스크린샷에 남고 편집기 번들·DB 연결·welcome 게이트를 전부 태운다.
- 편집기 play 모드는 실제 `@/project/store`, 출하되는 내보내기 플레이어는
  `exportProjectStoreShim` 을 쓴다. 즉 **편집기 경로로 하는 런타임 QA 는 출하물을
  검증하지 않는다.** 하네스는 `player.html` 을 띄워 shim 경로를 그대로 통과한다.

편집기 자체의 시각 QA(패널·모달·레일)는 기존 `test/e2e/` + `scripts/capture-*` 경로를
그대로 쓴다. 이 하네스는 게임 화면 전용이다.

## 편집기 AI 조수의 맵 소유권 (hard rule)

**동일 프로젝트의 맵 하나에는 실행 중인 조수가 최대 한 명이다.** 조회·시공·검수 모두 포함한다.
실행기가 모델 호출·사본 생성 전에 소유권을 확보해야 하며, 프롬프트에만 적고 끝내지 않는다.
맵 묶음 병합으로 실내/하위 맵도 수정하는 배정은 그 묶음 전체를 예약한다. 서로 겹치지 않는 맵 묶음만 병렬 실행한다.
맵 범위가 없는 프로젝트 작업은 전체 맵을 예약한다. 같은 맵의 후속 작업은 앞 실행 완료 뒤 최신 결과에서 시작한다.
중단 버튼이나 연결 단절만으로 예약을 풀지 않는다. 워커 종료·오류와 체크포인트 처리가 끝난 뒤 해제한다.
정본 구현·증거와 단일 companion 범위는 `openwiki/editor-ai-panel.md` 「맵 하나에 조수 한 명」 절을 따른다.

## Parallel coding agents (hard rule)

**두 개 이상의 에이전트가 코드를 동시에 편집하지 않는다.** 하나의 워킹트리를 공유하면 서로의
미완성 편집을 덮어쓰고, 검증이 움직이는 표적을 쫓게 된다.

1. 병렬이 필요하면 `npm run wt create <name>` 로 **에이전트마다 격리 워크트리**를 만든다.
   절차·함정은 `openwiki/agent-worktrees.md` 참조. 다른 도구가 만든 워크트리(`.herdr/`, `.claude/worktrees/`)는
   `node_modules`·`.env.local` 이 없으므로 `npm run wt -- adopt <이름> --path <경로>` 로 먼저 보정한다(dev 포트는 `npm run dev:worktree` 가 스스로 고정 배정한다; `npm run dev` 는 워크트리에서 거절된다) —
   보정 없이 실행하면 전역 tsc 가 잡혀 **저장소 설정이 깨진 것처럼 보이는 가짜 오류**가 난다 (`openwiki/quickstart.md` 1절).
   **dev 서버는 `npm run dev:worktree` / `npm run dev -- --port N` 으로만 띄운다 — `node_modules/vite/bin/vite.js`·`npx vite` 직접 호출 금지.**
   워크트리의 `node_modules` 는 메인으로의 심링크라 vite 캐시(`node_modules/.vite`)까지 공유되고, vite 는 캐시 해시에 root 를 넣으므로
   다른 체크아웃의 서버끼리 서로의 캐시를 재최적화해 덮는다(동시에 떠 있으면 상대 페이지 강제 리로드·서버 사망). 런처(`scripts/dev-server.mjs`)는
   공유 `node_modules` 를 보면 `<체크아웃>/.vite-cache/dev` 로 스스로 뗀다. 직접 부를 수밖에 없으면(`/tmp` 기준선 사본 등) `VITE_CACHE_DIR=<그 사본 안 경로>` 를 반드시 준다.
2. **저작 콘텐츠(맵·이벤트·데모) 작업은 워크트리로 병렬화하지 않는다.** 프로젝트 정본이
   워크트리 밖에서 공유되어 git 이 충돌을 못 본다 — 직렬화하거나 별도의 프로젝트 폴더/호스트 프로젝트로 분리한다.
3. 검증은 **감독자가 직접** `npm run gates` 로 한다. 에이전트는 아래 hard rule 을 따른다.
   에이전트의 "테스트 통과했습니다"와 파이프를 거친 종료 코드는 근거로 쓰지 않는다 (실측: 백그라운드 실행기가 exit 0 을 보고했으나 실제로는
   typecheck exit 2 / vitest exit 1 이었다).
4. 기준선이 빨간불이므로 게이트는 **기준선 대비 새 실패**만 회귀로 본다.

## 워크트리·세션 에이전트는 gates / vitest / stash 금지 (hard rule)

**사용자가 이 세션에서 테스트나 게이트를 돌리라고 명시하지 않으면 실행하지 마라.**
검증 습관, `openwiki/testing.md` 표, "완료하려면 테스트" 같은 기본 지시보다 **이 규칙이 이긴다.**

금지 (격리 워크트리·공유 트리 세션 모두. 감독자 역할이 아닌 한):
- `npm run gates`, `gates:*`, `npm test`, `npx vitest`, `node scripts/run-vitest.mjs`, 전체 스위트, 전체 `typecheck`
- dirty 를 치우려고 하는 `git stash` / `stash push` / `stash pop` / `stash apply`
- "검증하려고 잠깐", "게이트 한 축만", "changed 만" 도 사용자가 시키지 않았으면 금지

이유 (실측):
- stash 스택은 저장소에 하나뿐이라 모든 워크트리가 공유한다. pop 이 남의 WIP 를 꺼낸다 — `openwiki/agent-worktrees.md`.
- 여러 세션이 vitest/gates 를 겹치면 부하로 결과가 뒤집히고 공유 `node_modules` 워커가 머신 전체를 먹는다.
- 게이트는 감독자가 직접 돌린다. 에이전트 테스트 통과 보고는 근거가 아니다.

허용:
- 사용자가 **이번 메시지에서** 테스트/게이트를 하라고 적은 경우, 그 명령만.
- dirty 는 `wip:` 커밋 또는 파일 사본. stash 아님.

## 새 타일·타일 학습은 공용에 추가한다 (hard rule)

**타일셋을 새로 넣거나 그 타일을 학습한 결과(참고문서 MD, 아틀라스, 조립 지침, 표본 이미지)를 만들면
한 프로젝트 행 안에만 넣고 끝내지 않는다.** 같은 작업을 하는 다음 프로젝트·다음 에이전트가 그대로 쓸 수 있게
공용 계층에 함께 등록한다. "이 프로젝트에서 보인다"는 완료 조건이 아니다.

공용은 두 갈래이고, 대상이 다르다.

### 1. 타일 그림·타일셋 정의 → 공용 번들

- 그림 파일은 `assets/` 아래에 두고 `src/assets/bundled.ts` 의 `BUNDLED_EASYRPG_CHIPSET_ASSETS` 에 항목을 추가한다.
- 칸 수·시트 높이·열 수는 `bundledChipsetFrameCount` / `bundledChipsetSheetHeight` / `bundledChipsetTilesPerRow` 에 맞춘다.
- 타일셋 정의는 `src/project/defaults/defaultAssets.ts` 에 배선해 **모든 새 프로젝트가 처음부터 그 타일셋을 갖게** 한다.
- 한 프로젝트의 `project.tilesets[...]` 에 업로드만 하고 끝내면 다른 프로젝트는 그 타일을 영원히 못 본다.
- 라이선스·출처 표기(예: `ATTRIBUTION.md`, `CC BY 4.0`)를 같은 변경에 남긴다.

### 2. 타일 학습 결과 → 번들이 소유하는 참고문서

공용 AI 문서는 `tiledata/AI-REFERENCE-CONTRACT.md`의 상세 사전·실행 순서·전체 배열·정상/오류 그림·자동 좌표 검증·레이어 정정 조건을 모두 만족해야 한다. 추상적 조언만으로 완료하지 않는다.

**학습 결과는 프로젝트 행이 아니라 번들이 소유한다.** 그래야 그 타일셋이 있는 모든 프로젝트가 같은 지침을 처음부터 갖는다.
프로젝트 행을 직접 패치하는 등록 스크립트는 **배포가 아니다** — 스크립트가 지나간 행만 갖고, 나머지는 빈 화면이 된다.

1. **출처 사본을 저장소에 커밋한다.** 선례: `tiledata/castle-tiles-rpgs/`, `tiledata/forest-villages/`.
2. **배포용 번들 JSON을 만든다.** 선례: `src/assets/sharedCastleReferences.json`(용도 4 · MD 41 · 이미지 20).
   그림은 `public/assets/castle-references/` 의 축소 사본을 쓴다. 학습·비교용 그림은 게임 소재로 잘라 쓰지 않으므로
   긴 변 820px · 128색 수준으로 줄인다 — 실측: 원본 그대로면 14.25MB, 축소하면 3.08MB다.
   생성·축소는 `scripts/content/prepare-castle-references.mjs`(`--dry` 로 대상만 확인).
   **번들 JSON 에는 이미지 바이트를 넣지 않는다.** 생성 스크립트가 dataURL 을 넣었으면 이어서
   `node scripts/content/externalize-reference-images.mjs` 를 돌려 `/assets/...` 경로로 바꾼다
   (`test/bundledReferenceImages.test.ts` 가 막는다). 실측(2026-09-25): 번들 JSON 25.9MB → 6.3MB.
3. **타일셋 정의가 그 자료를 들고 태어나게 한다.** 선례: `castleTileset.ts` 의 `referenceDocuments: createSharedCastleReferences()`.
4. **이미 있는 프로젝트에도 심는다.** 선례: `defaultAssets.ts` 의 `ensureBundledTilesets` 안 `ensureSharedCastleReferences(...)` —
   빠진 용도만 덧붙이고, 저자가 직접 쓴 문서나 공유 포인터는 건드리지 않는다.
5. **파생 타일셋은 원본을 공유한다**(`referenceSourceTilesetId`). 선례: `castle_courtyard_harbor` → `opengameart_castle`.
6. 검증은 새 프로젝트와 기존 프로젝트 **양쪽**에서 한다. 새 프로젝트만 보면 4번 누락을 못 잡는다. 화면 증거를 `verify-shots/<주제>/` 에 남긴다.

같은 형태의 선례가 더 있다: `src/assets/sharedVillageObjects.json` + `ensureSharedVillageObjectReferences`,
`forestHarmony` + `ensureForestHarmonyReferences`.
이미 배포된 공용 맵 다운로드(`public/assets/region-references/*.oprn.json`)나 원격 행에만 자료를 밀어 넣어야 할 때는
`scripts/content/register-*.mjs` 를 쓴다 — 그 경로는 배포가 아니라 **소급 적용**이다.
원격에 쓰는 스크립트는 명시적 스위치(`--remote` 등)가 있을 때만 원격을 건드린다.
다른 프로젝트·외부 에이전트에 자료를 넘길 때는 `scripts/content/export-tileset-references.mjs` 로 추출한다.

### 3. 왜 강제인가

- 참고문서는 `project.tilesets[id].referenceDocuments` 라는 **프로젝트 행 안의 필드**다. 번들에 없으면 새 프로젝트는 아무것도 못 본다.
- 실측 1: Slates 32px 자료(4용도 / 14 MD / 109 이미지)를 `rpg-zzu-slates32-38e6` 한 행에만 넣어 두었고, 다른 프로젝트에서는 빈 화면이었다.
- 실측 2(2026-09-22): 성채 학습을 `register-castle-references.mjs` 로 프로젝트 행 몇 개에만 심어서,
  성 타일셋을 가진 프로젝트 8개 중 6개가 참고문서 0개였고 새 프로젝트는 항상 0개였다.
  번들 소유(`ensureSharedCastleReferences`)로 옮긴 뒤 새 프로젝트와 기존 프로젝트 모두 4용도를 갖는다.
- 학습을 프로젝트마다 다시 하는 비용은 이미지 수십 장을 매번 다시 읽는 비용이다.

## 프로젝트 정본 저장은 필수 (hard rule)

**에이전트는 게임/맵/이벤트 콘텐츠를 실제 프로젝트 저장소에 저장하고 다시 읽기 전에는 완료로 보고하지 않는다.**
현재 정본은 Electron 또는 팀 프로젝트 호스트가 관리하는 `project.sqlite` + `assets/`다.
LegacyDb는 과거 데이터 이관·복구 경로이며 새 콘텐츠 작업의 필수 연결이 아니다.
실행·백업 계약은 `openwiki/team-project-host.md`, 제거 현황은 `openwiki/storage-retirement.md`를 따른다.

1. 콘텐츠 작업 전에 **프로젝트 폴더 또는 호스트 주소와 project id**를 확인한다.
   저장 대상에 접근할 수 없으면 대상 연결 정보를 요청한다. 임시 메모리 세션으로 대체하지 않는다.
2. 편집기는 실제 저장 브리지가 연결된 상태에서 store flush, 헤드리스 도구는 같은 SQLite
   저장소 API를 사용한다. 원격 호스트 프로젝트는 해당 호스트의 저장 서비스를 사용한다.
   실행 중인 호스트의 DB를 별도 프로세스에서 직접 수정하지 않는다.
3. 저장 후 같은 대상을 다시 load하여 변경을 확인하고 **project id, 저장 대상, 재로드 근거**를 보고한다.
   SQLite 폴더에 실제 저장한 결과는 완료 근거다. JSON export만으로 이를 대체하지 않는다.
4. `?blankProject=1` / `?freshProject=1` / `dev-showcase`, 브리지 없는 정적 preview,
   메모리 어댑터 또는 저장이 비활성화된 세션에서 저장 버튼을 누른 결과는 정본 저장 증거가 아니다.
5. 순수 엔진/에디터 코드 변경과 단위 테스트용 최소 fixture는 콘텐츠 저장 의무가 없다.
   사용자가 명시적으로 “DB 없이 fixture만 / 코드만”을 요청한 경우도 예외다.
   스키마·저장 계약 검증과 테스트 실행 제한은 기존 규칙을 따른다.
6. 기존 LegacyDb 데이터의 삭제·서비스 종료는 데이터 이관 완료와 별도 작업이다.
   원본 프로젝트·기록·에셋이 보존되고 대상에서 재로드되는지 확인하기 전에는 폐기하지 않는다.

7. **LegacyDb·Supabase에 임의로 쓰지 않는다.** 읽기·조회는 무해하지만, 사용자가 이번 작업에서
   명시적으로 시키지 않으면 원격에 쓰지 않는다. 정본이 아닌 곳에 사본을 만들면 어느 쪽이 진짜인지
   아무도 모르게 된다 — 실측: Slates 32px 참고문서 이관에서 옛 강제 규칙을 따라 Supabase에도 썼고,
   사용자가 지적했다. 옛 문서의 "정본은 Supabase 행" 문장은 SQLite 호스트 도입(2026-09-18) 이전 것이다.

## Agent rules

- Treat `openwiki` as working context, not product UI.
- If you change architecture, editor workflows, runtime data shape, persistence, or test strategy, update the matching `openwiki/*.md` page in the same change.
- Keep project-specific knowledge inside this repo's `openwiki` directory. Other projects should have their own `openwiki/PROJECT_WIKI.md` and focused pages.
- Do not store API keys or live credentials in wiki files, scripts, evidence, or commits.
- Prefer focused validation. For UI changes, include browser evidence. For schema/runtime changes, include tests that prove load, migrate, save, and play behavior as relevant.
- **버전을 손으로 올리지 마라.** 릴리스는 `npm run release` 하나로 자르고, 매 머지에 끌려 올리는 것이 아니다.
  커밋 메시지가 릴리스 노트의 원본이다 — `feat:`/`fix:`/`refactor:` 규약을 지켜라. 네 버전 축(앱 · 문서 스키마 · 로컬 스토어 · 발행 게임)의
  구분과 절차는 `openwiki/release-and-version.md`.
- For **authored game content**, validation is incomplete until **canonical project store load after save** succeeds (see hard rule above).
