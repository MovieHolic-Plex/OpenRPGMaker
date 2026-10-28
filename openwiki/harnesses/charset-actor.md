# RM2000 캐릭터 GIF 공방

GPT 6.1 sol high가 정지 4장·걷기 8장, 24×32 캐릭터의 12프레임 전부를 직접 찍는다. 사용자는 걷는 GIF를 보고 남기기/폐기만 결정한다.
머리/몸체 결손·색 키·프레임 구조와 명백한 걷기 결함을 자동 차단하며 별도 모델의 미감 점수를 선택 관문으로 사용하지 않는다.

```bash
npm run harness -- charset-actor produce --count 100 --reference /absolute/reference.png
npm run harness -- charset-actor produce --creatures --count 100 --par 2 --max-review-pending 12
npm run harness -- charset-actor produce --all-sources --distinct-sources --count 100 --par 2 --max-review-pending 12
npm run harness -- charset-actor recipe --source-run RUN
npm run harness -- charset-actor produce --seed-run RUN --count 100 --par 2 --max-review-pending 12
npm run harness -- charset-actor serve --port 18314
npm run harness -- charset-actor export RUN
python3 src/harnesses/charset-actor/harness.py publish-shared
npm run harness -- charset-actor audit --run RUN --refresh-previews
npm run harness -- charset-actor walk-qa --run RUN --out /absolute/evidence-outside-repo
```

`produce`는 작업을 터미널과 독립적으로 시작한다. 화면에서도 개수·선택적인 전체 방향·참고 그림을 넣어 시작할 수 있다.
검토 대기로 대량 주문이 멈추면 `python3 src/harnesses/charset-actor/continuous.py --run RUN --out /absolute/new-folder --par 2`로 미완성 행만 연속 제작한다. 기존 작업자를 마친 후 같은 봉인 기준의 최대 40종 묶음으로 배분하며 각 묶음은 검토 없이 끝까지 제작한다. 원래 픽셀/선택/manifest를 보존하고 연속 제작의 기본 예약은 2명이며 `--par 6`까지 지정할 수 있다. 원래 URL에서도 여러 번 이어 만든 후보까지 보이며 주문 수를 중복 합산하지 않는다. 순서 대기 묶음은 자동 제작 예정으로 표시하며 사용자가 정지하면 자동 시작하지 않는다. `--cohort-size 10`처럼 묶음을 줄여 여러 작업자에게 고루 배정할 수 있다. 첫 화면의 완성/전체/미완성/검토/남김은 후속 묶음까지 합산한다. 검토가 비어도 아직 만드는 그림이 있으면 제작 상태와 남긴 그림 보기 버튼을 표시한다. 상세 배분/중단 계약은 실행 지침의 「검토를 기다리지 않는 연속 제작」이다.
「에디터 전체 원본으로 다양하게」/`--all-sources`는 실제 `charsetCatalog.ts` 공급자 목록을 읽어 Actor/People/Monster1~6/Scarloxy/농장 동물/Template 원본을 고루 섞는다.
100종은 일반 92종+Animal 전용 8종의 같은 공방 제작 묶음이다. Animal의 몸통/앞·뒷발 정책을 유지한다. 전체 21시트·호환 원본 141칸을 봉인하고 빈 칸/정지 기물/팔레트 상한 초과는 원본 입고에서 제외한다.
`catalog_sources.py`는 원본 배경 처리만 명시적으로 정규화한다. 크기/불투명 RGB/팔레트는 바꾸지 않고 재읽는다. 원본·카탈로그 사본·라이선스·작업자 지시·입고 제외 사유·도구 해시는 기준과 선택 팩에 보존된다.
화면의 전체 원본 제작은 `distinctSources: true`로 같은 원본 픽셀을 반복 배정하지 않으며 CLI는 `--distinct-sources`를 지정한다. 원본 수를 넘으면 자동 순환하지 않고 가능한 수를 알린다. 카탈로그는 원본의 12프레임 alpha 겹침이 낮은 순서로 배정하고 실제 seed/픽셀 해시를 manifest.diversityPlan에 남긴다. 원본 배정 검사이며 산출물의 비슷한 정도를 자동 폐기하는 미감 관문은 아니다.
「남긴 그림으로 변주」는 현재 남긴 실제 12프레임을 원본으로 고정하고 각 기준의 `grid`/좌표 저작 방식을 보존한다.
제작 지시·선택 binding·원본·도구 해시를 `recipes/ID`와 실행의 `recipe/`에 보존한다. 한 작업자는 1명만 저작한다.
납품 시 12장 저작 기록/좌표 재적용·투명·PNG/RGBA·네 배경 GIF·설명·정확한 중복을 검사해 `delivery.json`에 묶는다.
새 제작의 `motionPolicy: 1`은 몸통 중앙의 정지↔각 걸음 변화, 두 걸음의 다리/발 교대, 정지 전체의 이동 복사를 추가 검사한다.
`motion.py`는 실제 RGBA와 alpha/색 경계의 위치를 비교한다. 색 치환·한 픽셀 깜빡임은 동작으로 인정하지 않는다.
원본 정지 발끝에 고정한 사람형 영역의 최소 검사이며 자연스러운 걷기를 증명하지는 않는다. 두 걸음의 상체가 같은 bob 위상인 경우는 허용한다.
`views/motion.json/png/gif`에 영역·방향·변화 좌표·느린 GIF를 남기고 현재 그림/원본/검사 구현 해시와 납품에 묶는다. 화면의 원본 비교에서도 본다.
이전 실행은 당시 계약/픽셀/선택을 보존한다. 현재 정책으로 만들려면 같은 실제 남김에서 새 기준을 만든다.
「동물 기반 몬스터」/`produce --creatures`는 번들 Animal 8종을 참고 원본으로 봉인한다. 사람의 남김으로 기록하지 않는다.
`animalPolicy: 1`은 고정한 동물 몸통 영역과 보이는 발의 교대를 검사한다. 사족보행 옆모습은 앞발/뒷발을 각각 보고,
정면/뒷면은 겹친 네 발을 추정하지 않는다. 닭은 조류용 영역이다. 사람형 정책과 증거를 보존한다.
100종·동시 2종·검토 대기 12종이 기본이며 숲/화염/서리/독/그림자/갑피 등 실제 형태를 직접 변주한다.
기술 오류만 최대 2회 같은 모델이 직접 고친다. 각 프롬프트·실패·수정 전 파일은 `attempts/`에 남기며 미감 선별은 사람에게 맡긴다.
검토 대기와 진행 중 예약의 합이 한도에 이르면 `waiting-review`, 선택이 저장되면 이어 만든다. 정지/재개는 동시 작업 수와 공개된 픽셀을 보존한다.
`produce --recipe ID`로 보존한 기준을 재사용한다. 도구가 바뀌면 다른 조건으로 자동 재개하지 않고 새 기준을 요구한다.
선택 ZIP은 제작 기준과 원본 계보·RTP 라이선스도 보존한다. 새 변주의 품질 향상은 자동 검사로 판정하지 않는다.
한 화면에 한 캐릭터의 네 방향 걷기와 게임 속 이동 GIF를 상시 보여준다. 남기기/폐기하면 즉시 다음 후보로 넘어가고 뒤에서 저장한다.
기본 화면은 검토에 집중한다. 작업 이력/정지/재개는 「제작 관리」, 검색/종류/작업 선택은 「필터」에서 펼친다. 작업 이름과 날짜를 표시하고 새 작업은 기본 12종이다.
사람과 몬스터를 독립 실행 폴더에서 함께 만든다. 기본 작업당 동시 2명, 전체 예약 최대 6명이며 정지/재개에도 같은 제한을 적용한다.
이전/다음·A/R·직전 선택 되돌리기, 일시 정지/재개, 실제 남긴 캐릭터만 ZIP 다운로드한다.
현재 serve는 봉인된 도트 도구와 분리된 `review_server.py`다. journal fsync 뒤 바로 응답하고 공용 등록/사본 복구는 뒤에서 처리한다.
목록 검사는 변경 시 공유하며 선택·생산 상태는 매번 재읽는다. 숨은 탭은 주기 조회를 쉬고 GIF 로드/공용 등록 상태를 구분한다.
새 브라우저의 걷기는 검정이 기본이며 흰색·체커·잔디로 바로 전환한다. 기존 배경 선택은 유지한다. `audit`는 12프레임과 세 배경의 원본 비교·결손 좌표·출하 PNG/GIF 대조를 저장소 밖에 남긴다.
새 옷/장식 안에 가둔 원본 배경도 투명 구멍이다. alpha 검사 정책 갱신은 같은 픽셀의 사용자 선택 binding을 유지한다.
새 제작은 `animationMode: model-12`이며 모델이 납품한 걷기를 그대로 렌더한다. `model-frames.json`에 12장 각각의 실제 픽셀 해시와 변경 수·모델을 기록한다.
`bulk` 기본은 원본 ASCII 격자를 바탕으로 12장을 직접 변형하는 방식이다. 초기 PNG 첨부·남김/폐기 참고·추가 조형 지시는 기본 제작에 넣지 않는다(2026-10-04 사용자 피드백). manifest에 `visualReferences`를 명시한 실험만 원본 시트와 참고를 첫 입력에 첨부한다. `visual-inputs.json`/meta는 기본 `[]`, 실험은 첨부 파일 순서·SHA256을 기록한다.
`audit`가 저작 기록/현재 그림 binding과 PNG/GIF를 다시 읽는다. `walk-qa`는 이전 전파 실행의 비교용이다.
좌표 부분 수정 비교는 캐릭터 행에 `authoringMode: "pixel-patches-v1"`을 지정하고 `bulk --batch-size 1`로 실행한다.
기본은 기존 `grid` 저작이다. `pixel_ops.py`가 명시한 좌표·색만 적용하고 원본부터 명령을 다시 적용해 최종 격자와 12장 직접 수정 기록을 검증한다.
명령 기록은 `pixel-edits.json`, 게시 binding은 `model-frames.json.pixelEdits`에 보존한다. 걷기 합성·미감 선별은 추가하지 않는다.
현재 그림의 해시가 바뀌면 사람의 선택도 다시 확인한다. 사용자 선택·산출·원본은 `CHR_HARNESS_DATA` 아래 보존한다.
사람이 남긴 그림과 설명은 사용자 공용 SQLite의 `charset-actor-kept`에 자동 등록한다. 에디터를 새로고침하면 새/기존 프로젝트와 AI NPC 검색에서 쓴다.
폐기/되돌리기는 공용 목록에서 제외하고 기존 프로젝트 그림을 보존한다. 과거 모델 검수 모드는 이전 실행 재현용으로 유지한다.

명시적으로 새 몸 구조를 주문한 `noveltyPolicy` 실행은 `novelty.py`의 팔레트 독립 구조 비교와
`body_diversity.py`의 네 방향 정지 외곽 비교를 통과한 그림만 공개한다. 비교 기준/그림 해시와 입고 영수증을 보존하고
사람의 선택 기록을 대신 만들지 않는다. `original_monsters.py`는 전체 최대 6명의 native 작업자로 같은 slot의 실패를
최대 두 번 재저작하며 실제 납품한 고유 slot만 완료로 센다. 재배분은 `novelty-transfers.json`에 남겨 주문 수 중복을 막는다.
2026-10-06 사용자의 폐기 지시로 실패한 변주 100종을 공방·공용 SQLite에서 제거하고 서로 다른 몸/이동 지시 100개로 다시 시작했다.
원본 Monster 그림은 46개이고 입력 개수가 100개인 것은 아니다. 기존 URL에서 후속 새 후보를 확인한다.

상세 계약은 [캐릭터 하네스](../charset-actor-harness.md), 명령과 저장 구조는
[실행 지침](../../src/harnesses/charset-actor/README.md). 화면 http://mdc-server:18314/.

## 검증된 걷기 인물의 행동 포즈 (2026-10-06)

`npm run harness -- charset-actor actions produce REQUEST --out DIR`는 같은 하네스의
현재 `human_ready` 걷기 원본에 행동을 추가한다. 저장소는 `CHR_HARNESS_DATA`로 격리한다.
REQUEST는 source(path/sha256), palette, canvas, origin과 poses(id/direction/frames/durationMs/description)를 가진다.
원본 24×32의 접지는 (12,31)이며 출력 origin에 정렬한다. 머리와 발을 보존하고 팔/도구를 직접 저작한다.
원본 걷기·사람의 선택·기존 게시를 변경하지 않는다. 넓어진 행동 캔버스를 걷기 CharSet으로 설치하지 않는다.

`actions.px.json`은 공통 pixelgrid의 명시 행 문자열이다. 모델 종료 후 `actions check`가
팔레트·원점·시간·모든 행동 프레임·머리/발 화소 보존·행동 변경·잘림을 검사하고 PNG/GIF를 굽는다.
최대 두 번의 기술 수정은 이전 격자/검사/프롬프트/프로세스 결과와 함께 보존한다.
형식 통과는 동작 미감·몸의 해부학·실제 가구와 손의 접촉을 증명하지 않는다.
그림은 공간의 독립 검수와 Allow/Deny를 거쳐야 하며 새로운 픽셀을 자동 보간하지 않는다.

슈퍼하네스 `theme_actors.py`는 native 프로세스에서 현재 걷기 binding과 행동 receipt를 확인한다.
두 납품이 모두 있고 전용 테마·팔레트·원본/출력/도구 해시가 맞을 때만 전용 재료 coverage에 연결한다.
행동이 없는 걷기만으로 전체 인물 요구사항을 완료 처리하지 않는다.

기존 실행의 manifest는 JSON 내용이 같아도 재직렬화하지 않는다. 상위 주문은 파일 SHA에
묶이므로 끝 개행 하나를 덧붙이는 것도 행동 제작 연결을 끊는다. bulk는 기존 내용이 다르면
거절하고, 같으면 원래 바이트를 유지하며 새 snapshot일 때만 기록한다.

## CT·FF6풍 직업 인물 칩 Heroes1 — pick-6 채택 8종의 공용 번들 설치 (2026-10-16)

`argon_part.py`(RTP Actor/People 베이스 칩의 머리·옷·장비만 마스크 안에서 고치는 Argon high 편집)로 만든 후보 중 pick-6 에서
**사용자가 「니 추천대로」 라고 위임**해 감독이 채택한 8종(양서 기사·원시 전사 소녀·마법사 소녀·고철 로봇·도적 정찰병·연보라 마법사·노장군·무대 가수)을
**마법 학교 Wizarding 시트와 같은 경로**로 번들에 설치했다. 사람이 고른 캐릭터 칩이라 3/4 관문(object-gate) 대상이 아니다.
채택 안 한 것: `tt-scrap-robot-b`, `iw-steam-armor-a`(재작업 대기), `iw-legion-soldier-a`·`tt-hero-boy-a`(무기 수정 중), 현대 연애 후보(→ 아래 Modern1~3 절).

- 입력(재생성 금지): `harness-data/charset-actor/ct-ff6-pick6/<key>/{chip.chr.txt,edit.json,meta.json}` — 하네스 최종 격자. 명단·순서(칸 번호, **덧붙이기 전용**)·이름·설명·태그: `harness-data/charset-actor/ct-ff6-install.json`.
- 굽기: `python3 src/harnesses/charset-actor/install_ct_ff6.py` → `public/assets/generated/charsets/Heroes1.png`(288×256 RGBA, 8명) + `src/assets/heroesCharsets.json`(칸별 RGBA SHA-256·격자 SHA-256·베이스 칩 계보).
  `--check` 는 번들이 입력과 화소 동일한지만 확인한다. 이미 설치된 id 의 칸 번호·화소가 바뀌면 `--force` 없이는 거절한다(사용자가 본 그림 = 설치되는 그림).
- 화소 동일성 증거: pick-6 시트 HTML 에 박힌 GIF(2×·8×)가 현재 격자를 다시 렌더한 GIF 와 바이트 단위로 일치하고, 시트 칸 == 하네스 `chip.png`.
- 배선(`WIZARDING_*` 와 같은 5곳): `src/assets/heroesCharsets.ts`(자산·해석기·조수 검색 라벨) → `charsetCatalog.ts` · `charsetSemantics.ts` · `generatedAssetResourceResolver.ts` · `project/io/resourceReferenceValidation.ts`.
  칩 카탈로그는 전역이라 새 프로젝트·기존 프로젝트가 같은 칩을 이주 없이 본다(`ensureBundled…` 불필요). id `oprn-charset-heroes1` · textureKey `tex_oprn_charset_heroes1` · 그룹 `Heroes`.
- 태그에 원작 상표(Chrono Trigger·FF6)를 쓰지 않는다. 조수는 「양서 기사」「노장군」「무대 가수」「robot」 같은 말로 찾는다. 「도적」 단독은 기존 몬스터 별칭이 먼저 가로챈다(`도적 정찰병`·`rogue`·`thief` 는 Heroes 를 찾는다).
- 베이스 칩이 RTP(CC BY 4.0)라 `public/assets/ATTRIBUTION.md` 「Heroes1」 절에 출처·크레딧·선택 기록(`by: user-delegated-to-supervisor`)을 둔다.
- `catalog_sources.py` 는 새 공급자 `HEROES_CHARSET_ASSETS` 를 알고 있으며 봉인된 20시트 걷기 원본에는 넣지 않는다(공방 산출물이라 순환 입력 금지).
- 검증 스크립트: `scripts/qa/runtime/heroes-chips-fixture.mts` + `heroes-chips.scenario.mjs`(출하 플레이어에서 8칸 줄 세우기 + 배회 2명; `npm run qa:runtime` 경로, 픽스처는 압축 직렬화 — 들여쓴 114MB 는 Playwright 파이프 100MB 상한을 넘어 브라우저가 죽는다) ·
  `heroes-chips-persist.mts`(임시 SQLite 폴더에 새/옛 프로젝트를 저장하고 다른 핸들로 재로드). 이 세션에서 vitest/gates/전체 typecheck 는 실행하지 않았다.
  `test/fixtures/eventEditorPortalSurface.baseline.json` 의 NPC 모습 목록에 `Heroes# (Heroes)` 한 항목을 손으로 덧붙였다(포털 표면 게이트는 미실행).

## 현대 연애물 인물 칩 Modern1~3 — 24종의 공용 번들 설치 (2026-10-16)

`argon_part.py` 와 같은 부분 편집 규칙(RTP Actor/People 베이스 칩의 **상의·하의·신발·머리**만 마스크 안에서 고침, 얼굴·피부·손 고정, 소품 없음, Argon high)으로
현대 연애물 인물을 만들었다. 사용자가 「고르지 않는다, 기준으로 직접 거르라」 고 위임해 제작자가 36 후보 중 24종을 걸러 설치했다
(기준: 칩셋 결 일치·몸통 읽힘·옷이 얼굴/손에 잘리지 않음·12프레임 동일성; 시트 `~/claude-viz/chips-modern-romance-2.html`).
교복 남·여 9 · 캐주얼 남·여 7 · 정장 3 · 카페 점원 3 · 선생·교수 2. 사람 캐릭터 칩이라 3/4 관문(object-gate) 대상이 아니다.

- 드라이버(공유 파일 수정 없이 argon_part 를 감쌈): `romance_draw.py`(현대 의복 프롬프트·소품 없음) · `romance_specs.py`(새 베이스 분할 SPECS: Actor4:0·People1:1/5·People5:1/5·Actor4:1·Actor2:0/1·Actor4:3/6·Actor3:3 — 얼굴 상자를 좁게 잡아야 뺨에 옛 머리색이 안 남는다) ·
  `romance_apply.py`·`romance_reapply.py`(모델 호출 없이 edit.json 을 다시 적용·검증) · `romance_colorvar.py`(모델 호출 없는 **색 변형**: 모델이 새로 정한 팔레트 글자만 부위별 HSV 변환 → 같은 하네스 검증) · `romance_sheet.py`·`romance_base_sheet.py`·`romance_batch_review.py`(시트·비교).
- 입력(재생성 금지): `harness-data/charset-actor/romance-pick1/<key>/{chip.chr.txt,edit.json,meta.json}`. 명단·순서(칸 번호, **덧붙이기 전용**): `harness-data/charset-actor/romance-install.json`. 눈 판정 기록: `romance-notes.json`·`romance-notes-final.json`.
- 굽기: `python3 src/harnesses/charset-actor/install_modern_romance.py` → `public/assets/generated/charsets/Modern{1,2,3}.png`(288×256 RGBA, 시트당 8명) + `src/assets/modernCharsets.json`. `--check` 는 화소 동일 확인, 바뀐 칸·번호는 `--force` 없이는 거절.
- 배선(Heroes 와 같은 5곳 + 계열): `src/assets/modernCharsets.ts` → `charsetCatalog.ts` · `charsetSemantics.ts` · `generatedAssetResourceResolver.ts` · `project/io/resourceReferenceValidation.ts`, 그리고 `project/charsetFamily.ts`(새 계열 `modern`)·`genreLockCharsets.ts`(사람 계열)·`catalog_sources.py`(공방 순환 입력 제외).
  id `oprn-charset-modern<n>` · textureKey `tex_oprn_charset_modern<n>` · 그룹 `Modern`. 조수는 「남학생·여학생·세일러·후드티·정장·앞치마·카페 점원·교수」 같은 말로 찾는다.
- **Argon 계정 쿼터(429, 약 127시간 뒤 재설정)** 로 마지막 라운드 후보 7종(캐주얼 여 e·정장 여 a~c·앞치마 a~c)은 모델로 못 만들었다. 대신 앞치마 2·정장 여 1은 스크립트 색 변형(`source.model` 이 `script-colorvar(...)`)이다. 쿼터가 풀리면 `romance-modern-2.json` 의 해당 후보를 `romance_draw.py` 로 다시 돌려 시트 4(Modern4)부터 덧붙인다.
- 베이스 칩이 RTP(CC BY 4.0)라 `public/assets/ATTRIBUTION.md` 「Modern1-3」 절에 출처·크레딧·선택 기록을 둔다.
- `test/fixtures/eventEditorPortalSurface.baseline.json` 의 NPC 모습 목록에 `Modern# (Modern)` 3항목을 손으로 덧붙였다(포털 표면 게이트는 미실행).

## 몬스터 세계 사람 칩 ScarloxyPeople1~4 — 기존 Scarloxy People 칩 변형 25종 (2026-10-16)

몬스터 수집 장르 잠금은 RTP 사람 칩을 막고 Scarloxy 계열(`scarloxy-people`)만 허용한다. 뼈대는 `public/assets/scarloxy/scarloxy-charset-people1.png`(8명)·`people2.png`(2명) **10명뿐**이라(16 아님)
직군이 모자랐다. 앞서 RTP 기반 트레이너 칩(PR #2709)은 장르 잠금에 어긋나 닫았다. 새 칩은 그 10명에서 의복·머리·모자만 바꾼 변형이다. 사람 칩이라 3/4 관문(object-gate)은 해당 없음.

- 변형 두 길. (1) 모델 없는 스크립트 `scarloxy_compose.py`: 한 인물의 머리 윗부분을 다른 인물 몸에 프레임별로 이식 + 부위 색 바꾸기(레시피 `harness-data/charset-actor/scarloxy-people/recipes.json`, 21종). `roundtrip` 이 뼈대 복원 화소 동일을 확인한다.
  (2) 실제 Argon 부분 편집: `argon_part` 가 쓰던 Agy 를 8318 CLIProxy 스트리밍(`argon_http.py`, `stream:true` 만 동작·비스트림은 빈 응답, 키는 환경변수 `OPRN_LIVE_KEY` 에서만, 모델 `gemini-4-argon-*` 만)으로 바꿔 끼운 드라이버 `scarloxy_draw.py`
  (뼈대 10명 마스크 `scarloxy_specs.py`, 주문서 `harness-data/charset-actor/scarloxy-people-spec.json`). 4종(박사·남학생·요리사·레인저) 채택. 12 후보 중 7은 하네스가 3회 안에 거절(대표 사유: 몸 안쪽 구멍·장비가 앵커에 안 닿음·마스크 밖 변경).
  `scarloxy_repair.py` 는 Argon edit.json 은 그대로 두고 몸 안쪽 1~4px 구멍만 이웃 색으로 메운 뒤 같은 검증을 다시 건다(meta.repaired 에 기록).
- 거름 기준: 뼈대(10)·설치분 어느 것과도 실루엣 화소 색이 일정 비율 이상 달라야 한다(`scarloxy_distinct.py`, 스크립트 27%·Argon 45%). 사람은 `~/claude-viz/monster-people-chips-1.html`(시트 `scarloxy_sheet.py`)에서 **버릴 번호만** 고른다.
- 굽기: `python3 src/harnesses/charset-actor/install_scarloxy_people.py` → `public/assets/generated/charsets/ScarloxyPeople{1..4}.png`(288×256 RGBA, 시트당 8칸) + `src/assets/scarloxyPeopleCharsets.json`. 입력은 `scarloxy-people-chips/<key>/{chip.chr.txt,meta.json}`, 명단 `scarloxy-people-install.json`(칸 번호 **덧붙이기 전용**, 바뀐 칸은 `--force` 없이 거절). `--check` 는 화소·명단 동일 확인.
- 배선: `src/assets/scarloxyPeopleCharsets.ts` → `charsetCatalog.ts`·`charsetSemantics.ts`·`generatedAssetResourceResolver.ts`·`project/io/resourceReferenceValidation.ts`·`charsetQuery.ts`, `project/charsetFamily.ts`(`oprn-charset-scarloxy-people<n>` 도 `scarloxy-people`), `genreLock.ts`, `catalog_sources.py`(공방 순환 입력 제외).
  id `oprn-charset-scarloxy-people<n>` · textureKey `tex_oprn_charset_scarloxy_people<n>` · 그룹 `ScarloxyPeople`.
- 검증(출하 경로): `scripts/qa/runtime/scarloxy-people-chips-fixture.mts` + `.scenario.mjs`(`node scripts/runtime-qa.mjs --scenario scarloxy-people-chips --project tmp/scarloxy-people-chips.json`, 픽스처는 압축 직렬화) ·
  `scarloxy-people-chips-persist.mts`(몬스터 잠금 프로젝트에서 place_npc 허용·RTP 칩 거절·임시 SQLite 저장/재로드). `test/genreLockCharsets.test.ts` 에 계열·허용·거절 테스트를 썼으나 **이 세션에서 vitest/gates 는 실행하지 않았다**.
- 알려진 한계: 얼굴(faceset)을 새 칩에 연결하지 않았다. 체형은 뼈대 한 가지(머리 큰 2.5등신)라 실루엣은 모자·머리·가운 깃으로만 바뀐다. 낚싯대·잠자리채 같은 손 소품은 뼈대에 손 칸 정의가 없어 쓰지 않는다. 빈 직군: 상점 점원·수영 선수·뱃사람·노인·땅/불/물 도장 보스.
- **재실행 한 줄**(Argon 가 되면 다음 라운드. 8318 은 지금도 되며, Agy 쿼터가 풀리는 2026-10-21 이후는 `CHR_ARGON_BACKEND=agy` 도 가능):
  `OPRN_LIVE_KEY="$(cat ~/.config/oprn/live-key)" CTFF6_PART_OUT=$HOME/spc-runs python3 src/harnesses/charset-actor/scarloxy_draw.py draw --spec harness-data/charset-actor/scarloxy-people-spec.json --model gemini-4-argon-high --run sp-r3 --label sp-merchant-a --label sp-swimmer-a`
  → 통과분을 `scarloxy-people-chips/<key>/` 로 복사하고 `scarloxy-people-install.json` 에 덧붙인 뒤 `install_scarloxy_people.py`.
- 출처: Scarloxy MPWSP01(CC BY 4.0) — `public/assets/ATTRIBUTION.md` 「ScarloxyPeople1-4」. `test/fixtures/eventEditorPortalSurface.baseline.json` 에 `ScarloxyPeople# (ScarloxyPeople)` 4항목을 손으로 덧붙였다(포털 표면 게이트 미실행).

## 몬스터 세계 사람 칩 2차 — ScarloxyPeople5~10, Argon 부분 편집 확대 43종 (2026-10-16)

사용자가 1차 25종(ScarloxyPeople1~4)을 「다 괜찮다, 늘려도 된다」로 승인해 같은 방식·화풍으로 45종을 덧붙였고 사용자 검토에서 2종(ScarloxyPeople8#3 남학생·검은 학생복 학생모, ScarloxyPeople5#6 선장·흰 선장 모자)이 빠져 **43종**이 남았다(총 68칸 + 원본 10 = 78명 허용). 1차는 스크립트 21 + Argon 4 였고, 이번은 **Argon 34 + 스크립트 9**.
사람 칩이라 3/4 관문(object-gate)은 해당 없음. 기존 25종은 시트 PNG·명단 항목이 바이트 동일(`install_scarloxy_people.py --check`), 칸 번호는 시트 5부터(4번 시트의 빈 7칸은 두었다).

- 1차에서 Argon 이 3회 안에 못 통과한 원인과 대응 — 드라이버 `scarloxy_argon2.py`(주문서 `harness-data/charset-actor/scarloxy-people-spec-2.json`, 직군별 후보 a/b = 다른 뼈대):
  (1) 몸 칸을 '.' 로 비움·마스크 밖 칠함(오류 126개까지) → `sanitize()` 가 paint 줄을 부위 마스크에 맞춰 자른다(되돌린 칸 수는 meta.repairs.sanitized, 다음 시도 되먹임에 포함, recolor 와 같은 색을 또 paint 한 칸은 정리해 행 교체 55% 한도를 아낀다).
  (2) 삐죽 점·몸 안쪽 구멍 → `scarloxy_repair.drop_strays/fill_holes` 를 평가 단계에 넣고 같은 `partedit.verify` 를 다시 건다(edit.json 은 그대로).
  (3) 뼈대와 61% 같음 → 주문서에 베이스 부위별 글자표(글자=색(칸 수))와 「모든 글자 recolor」 명시, 결과가 가장 가까운 칩(뼈대·설치분·같은 런 채택분)과 45% 미만이면 안 바뀐 글자 목록으로 거절.
  (4) 장비가 앵커에 안 닿음 → 1차 어댑터는 anchors.txt 를 모델에 안 보냈다. 이번에는 gear 를 쓰지 않고 h·t 구역 paint + recolor 로만 실루엣(모자·가운·앞치마·망토 끝)을 바꾼다. 손 소품(낚싯대·잠자리채·지팡이)은 뼈대에 손 칸이 없어 여전히 못 한다.
  (5) 시도 3→5회, `argon_http.py` 는 429·5xx·연결 오류·JSON 파싱 실패를 60→120→240초 백오프로 재호출, 동시 호출 2개 이하(`--par`). 키는 `OPRN_LIVE_KEY` 환경변수로만, 모델 `gemini-4-argon-*` 만, 스트리밍만.
  결과: 주문 48건 중 43건 통과(90%, 1차 33%), 3회 안 40건, 429 0회. 같은 직군에서 a 가 5회 안에 못 통과하면 다른 뼈대 b 로 바꿨고 5직군 모두 b 로 통과했다.
- 스크립트 칩(`scarloxy_compose.py`, 레시피 `scarloxy-people/recipes-2.json`)은 `lock: true` 로 **얼굴·눈·피부·손 고정 칸을 recolor 에서 제외**하고(`face_fixed`) 12프레임 화소 동일을 빌드 때 검사한다. 1차 레시피(lock 없음)는 그대로 다시 구우면 화소 동일(`build` 확인)이라 건드리지 않았다.
- 설치 관문: `scarloxy_lock.py` — 최종 격자만 보고 12프레임의 얼굴·피부·손 고정 칸(Argon 은 뼈대 분할의 F 칸 전부, 스크립트는 `face_fixed`+몸 주인 맨살)을 원본과 화소 대조. `install_scarloxy_people.py` 는 시트 5~ 에 이것을 건다. 신규 45종 33,639칸 모두 일치.
  **알림:** 같은 검사를 1차 설치 25종에 돌리면 스크립트 칩 12종(도장 보스 얼음·전기·바위·에스퍼, 단원 남·여, 경찰관, 연구원, 탐험가(여), 여학생, 어린이, 신관)에서 24~142화소(눈썹·손 그림자 색)가 부위 색 바꾸기에 같이 칠해져 있다. 승인된 불변분이라 건드리지 않았다. → 3차(아래 절)에서 11종을 재제작했다(단원 남 1종만 기존 칩 유지).
- 칩을 뺄 때: 칸 번호는 덧붙이기 전용이라 시트를 당기지 않는다. 설치 명단(`scarloxy-people-install.json`)의 그 행을 `{"vacant": true, key, id, name, reason}` 로 바꾸고 `install_scarloxy_people.py` 를 다시 돌리면 그 칸은 투명으로 남고 `scarloxyPeopleCharsets.json`·카탈로그·의미표·조수 검색에서 빠진다(다른 칸 화소 불변, `--check` 가 확인). `scarloxy_collect.py` 는 vacant 의 key 를 이미 쓴 것으로 보아 다시 채택하지 않는다.
- 거름: `scarloxy_collect.py` 가 채택 매니페스트(`scarloxy-people/round2.json`)를 받아 ① chips 폴더로 복사 ② 고정 검사 ③ 가장 가까운 칩과 다른 화소 30% 미만 거절(`round2-distinct.json`) ④ 명단에 덧붙임(5번 시트부터 8칸씩). 사람은 `~/claude-viz/monster-people-chips-2.html`(`scarloxy_sheet2.py`)에서 **버릴 번호만** 말한다.
- 굽기·재실행: `python3 src/harnesses/charset-actor/install_scarloxy_people.py` (`--check` 화소·명단 동일). Argon 재주문 한 줄:
  `OPRN_LIVE_KEY="$(cat ~/.config/oprn/live-key)" CTFF6_PART_OUT=$HOME/spc-runs python3 src/harnesses/charset-actor/scarloxy_argon2.py draw --spec harness-data/charset-actor/scarloxy-people-spec-2.json --run sp2-r5 --label sp2-clerk-m-a --par 2`
- 배선: 시트 수는 명단의 `sheets` 에서 나오므로 카탈로그·의미표·리졸버·참조 검증·`charsetFamily`·`catalog_sources.py` 는 코드 변경 없이 10시트를 읽는다. 바뀐 것: `genreLock.ts` 안내 문장(1~10, 직군 목록), `test/genreLockCharsets.test.ts`(새 시트 칩 허용·RTP 거절 테스트 추가), 포털 표면 기준선(`ScarloxyPeople# (ScarloxyPeople)` 10항목).
- 검증(출하 경로): `scarloxy-people-chips-fixture.mts --part 0|1` + `scarloxy-people-chips.scenario.mjs`(`node scripts/runtime-qa.mjs --scenario scarloxy-people-chips --project tmp/scarloxy-people-chips[-2].json --out verify-shots/runtime-qa/<이름>`, 판마다 35칸 5줄×7열)로 70칸 전수 렌더, `scarloxy-people-chips-persist.mts`(몬스터 잠금 프로젝트 새·옛 두 판: 새 직군 칩 place_npc 허용 · RTP 칩 거절 · 임시 SQLite 저장·재로드). vitest/gates 는 실행하지 않았다.
- 출처: Scarloxy MPWSP01(CC BY 4.0) — `public/assets/ATTRIBUTION.md` 「ScarloxyPeople1-13」.

## 몬스터 세계 사람 칩 3차 — 1차 스크립트 칩 12종 재제작 (2026-10-16)

2차 시트가 「1차 스크립트 칩 12종은 새 12프레임 고정 검사를 통과하지 못한다」(눈썹·눈 둘레·손 그림자까지 부위 색 바꾸기에 같이 칠해짐, 24~142칸)고 알렸고, 사용자가 새 방식으로 다시 만들라고 했다.
12종 = 얼음·전기·바위·에스퍼 도장 보스, 단원 남·여, 경찰관, 연구원, 탐험가(여), 여학생, 신관, 어린이(여). **같은 id·같은 칸 번호(ScarloxyPeople1~3)** 에서 그림만 바꾸고 직군·이름·태그·성별·나이는 그대로다. 설명(`desc`)만 새 그림에 맞게 고쳤다.

- 결과: **11종 교체, 1종(단원 남) 유지.** 교체분은 얼굴·피부·손 12프레임 고정 검사(`scarloxy_lock.py`) 어긋남 0, 독립 판정(tile-artist, 8점 이상만 PASS) 통과. 단원(남)은 후보 8건 모두 8점 미만(최고 7: 방향마다 붉은 무늬가 다르고 옆모습 모자 모양이 바뀜)이라 기존 칩을 남겼다 — 억지로 교체하지 않는다.
  ScarloxyPeople4~10 시트와 교체하지 않은 칸은 화소까지 같다(설치 도구의 칸 화소 해시 + 시트 대조로 확인).
- 도구: 주문서 `harness-data/charset-actor/scarloxy-people-spec-3.json`(직군당 뼈대 후보 a~e, 옛 칩과 같은 색 방향), 드라이버는 2차의 `scarloxy_argon2.py` 를 이어 쓴다. 이번에 고친 것:
  (1) **걷기 프레임에만 나오는 베이스 글자**(붉은 신발·바지 점)가 서 있는 그림 글자 표에 없어 recolor 되지 않고 걸을 때만 깜박였다 → 글자 표를 12프레임 전체로 만들고, 빠진 글자는 같은 부위에서 색이 가장 가까운 recolor 글자의 새 색으로 자동 따라 바꾼다(`complete_recolor`, 되돌림 기록은 meta.repairs.sanitized). 첫 독립 판정에서 7칩 공통 결함이었고 고친 뒤 사라졌다.
  (2) `scarloxy_distinct.py` 는 환경변수 `SPC_EXCLUDE`(쉼표 목록, 예 `ScarloxyPeople1#0`)에 든 칸을 비교에서 뺀다 — 곧 교체될 옛 칸과 「너무 비슷하다」로 거절되지 않게.
  (3) `scarloxy_redo.py stage <manifest>` 가 채택분(`scarloxy-people/redo.json`)을 `scarloxy-people-chips/<key>/` 로 덮고(옛 격자·meta 는 `chip.v1.chr.txt`·`meta.v1.json` 으로 보존) 고정 검사를 걸고 설치 명단 항목에 `redo` 표시를 단다. `compare` 는 옛/새 8배 대조 PNG 를 만든다.
  (4) `install_scarloxy_people.py` 는 명단 항목에 `redo` 가 있는 칸만 같은 id·칸에서 화소가 바뀌는 것을 허용하고(나머지는 여전히 거절) 그 칸에 고정 검사를 건다. `--check` 로 시트·명단 일치 확인.
- 판정 운용 주의: 독립 판정 에이전트가 표 대신 「끝났다」 한 줄만 돌려주는 일이 잦아 표를 메시지 본문에 쓰라고 다시 요구해야 했다. 판정 입력은 `전/후 8배 4방향 PNG + 12프레임 6배 PNG`(`scarloxy_redo.py compare` 와 `scarloxy_sheet2.frames1x`).
- 재실행: `SPC_EXCLUDE=<옛 칸들> CTFF6_PART_OUT=$HOME/spc-runs/redo SPC_ACCEPT_DIR=$HOME/spc-runs/redo/accepted-<판> SPC_DISTINCT_MIN=0.40 OPRN_LIVE_KEY="$(cat ~/.config/oprn/live-key)" python3 src/harnesses/charset-actor/scarloxy_argon2.py draw --spec harness-data/charset-actor/scarloxy-people-spec-3.json --run <이름> --label sp3-<직군>-<a~e> --par 1`
  (`SPC_ACCEPT_DIR` 를 판마다 새로 줘야 같은 직군의 다른 후보끼리 「방금 채택된 칩과 비슷하다」로 거절되지 않는다.)
- 증거 시트: `~/claude-viz/monster-people-chips-3.html`(`scarloxy_sheet3.py`).
- 저작권·출처 변동 없음(Scarloxy MPWSP01 CC BY 4.0 변형, 칸 번호·id 동일). vitest/gates 는 실행하지 않았다.

## 몬스터 세계 사람 칩 4차 — char-gen 갤러리 4 합성 22종, ScarloxyPeople11~13 (2026-10-17)

사용자가 char-gen 갤러리 4(`~/claude-viz/chargen-gallery-4.html`)를 보고 「22종은 넣어야할듯」이라고 결정해, 갤러리에 올라간 22종을 **그림 그대로** 새 시트 11(8)·12(8)·13(6)에 덧붙였다. 기존 시트 1~10(빈 칸 4#1~7·10#5~7 포함)은 한 칸·한 화소도 안 바뀐다(`--check` 일치).

- 출처: char-gen 저장소(`~/char-gen-public`, 79fe270)의 스크립트 합성 — 머리 이식 + 부위 마스크 안 색조 이동, 모델 호출 없음, 새로 찍은 픽셀 없음. 눈가림 독립 판정자 3명 다수결(8점 이상·0점 없음)과 세트 중복 검사를 통과한 것이다. 레시피 원본은 `harness-data/charset-actor/scarloxy-people/gallery4-recipes.json`, 이름·설명·직군·판정 점수·**그림 화소 해시**는 `gallery4.json`.
- 도구: `scarloxy_gallery4.py`(갤러리 격자 → `scarloxy-people-chips/sc3-mix-NN/` 로 모으고 해시가 갤러리 그림과 같은지 확인한 뒤 설치 명단에 11번 시트부터 덧붙임) → `install_scarloxy_people.py`.
- **고정 검사 예외(알려진 한계):** char-gen 합성기는 눈·눈썹도 머리색을 따라 옮겨, 이 저장소 `scarloxy_lock.py` 의 「얼굴·피부·손 원본 고정」 검사를 22종 모두 통과하지 못한다(칩당 94~334 / 493~894칸 어긋남 — 2차 문서가 1차 스크립트 칩 12종에서 지적한 것과 같은 종류). 사용자가 갤러리 그림 그대로를 선택했으므로 명단 행에 `lockExempt: "gallery4"` 와 `expectSlotRgbaSha256` 를 달아, 고정 검사 대신 **갤러리 그림 화소 해시 일치**를 설치 관문으로 건다. 눈이 머리색과 같은 칩은 게임 배율에서 얼굴이 옅게 보인다(금발·흰 머리·황갈 머리 등) — 나중에 다시 만들면 3차처럼 같은 id·칸 번호에서 `redo` 로 그림만 바꾼다.
- 가장 가까운 기존 칩과 다른 화소 비율: 최소 0.41(= 거름 기준 0.30 이상), 새 22종끼리도 0.41 이상.
- 배선: 시트 수는 명단 `sheets` 에서 나오므로 카탈로그·의미표·리졸버·참조 검증·`charsetFamily` 는 코드 변경 없음. 바뀐 것: `genreLock.ts` 안내 문장(1~13), `test/genreLockCharsets.test.ts`(의미표 90칸), 새 `test/scarloxyPeopleGallery4.test.ts`, 이벤트 편집기 표면 기준선 3개(people11~13 노드), QA 픽스처 `--part mix`(새 22종 + 기존 13종 섞은 35칸).
- 검증(출하 경로): `scarloxy-people-chips-fixture.mts --part mix` + `scarloxy-people-chips.scenario.mjs`. 출처 크레딧은 `public/assets/ATTRIBUTION.md` 「ScarloxyPeople1-13」(새 시트는 기존 칩의 부위 조합과 색 변형임을 명시).

## REFMAP 변형 인물 칩 RefmapDoll1~ — char-gen `refmap` 종이 인형 2,793종 (2026-10-28)

사용자 결정(2026-10-28): REFMAP 제외의 예외로 「금지 풀고 넣기」, 설치는 「번들, 검수 위임」(사람 대신 Kiro Opus 눈 검사 통과분 전부).
칩은 비공개 char-gen 의 `cli.py refmap` 이 만든다 — REFMAP 인물 242명 각자의 목 줄과 팔레트 색 종류(머리카락·모자·얼굴·수염·피부·옷·윤곽)를
Claude 가 읽어 두고, 머리 덩어리(색 종류로 자른다, 선이 아님)를 다른 인물의 몸 목 위치·얼굴 가운데에 맞춰 얹고 턱 선을 다시 그린다.
- 관문: 짝 58,322 → 크기(아이·어른·구부정)·성별·남자 머리+치마·피부 밝기·뒷머리 덮개 → 합성 후 만들어 넣은 칸(방향별 12칸 이하)·목 길이(피부 줄)·조각 결함·깜빡임 → 4,798 →
  Kiro Opus(`ocx-claude-klb--claude-opus-5.5`, dolleye 프롬프트 + 「색 바꾸기 없음」) 눈 검사 → 2,793. 같은 칩을 다시 물으면 92% 같은 답(경계 칩은 흔들린다).
- 이름·외형 문장·역할·태그·성별·나이: Kiro Opus 가 칩 8개씩(앞·옆) 보고 적었다(원본 인물 꼬리표를 힌트로). 조수는 `list_npc_graphics` 로 이 말들을 찾는다.
- 순서: 성별 → 체격 → 몸의 옷 종류 → 머리 인물 순으로 8개씩 시트에 담는다(비슷한 사람이 한 시트에 모인다).
- 굽기: char-gen `python3 cli.py refmap --export <폴더>` → `python3 src/harnesses/charset-actor/install_refmap_dolls.py --from <폴더>`(`--check` 는 같은지만).
  시트를 다시 그리지 않고 칸 화소 해시를 맞춘다. 칸 번호는 덧붙이기 전용.
- 배선: `src/assets/refmapDollCharsets.ts`(시트 목록·리소스 id·URL — 명단 JSON 을 읽지 않아 플레이어에 이름·문장이 실리지 않는다) +
  `refmapDollSemantics.ts`(에디터 라벨, `charsetSemantics.ts` 에 합침) → `charsetCatalog.ts` · `generatedAssetResourceResolver.ts` · `resourceReferenceValidation.ts` ·
  `charsetFamily.ts`(새 계열 `refmap-doll`) · `genreLockCharsets.ts`(사람 계열) · `catalog_sources.py`(공방 순환 입력 제외).
- 라이선스: OPRN 게임 사용 라이선스가 아니라 REFMAP 조건(`public/assets/ATTRIBUTION.md` 「RefmapDoll」). 스토어는 이름으로 계속 거절한다.
- 조수 검색 확인: `npx vite-node --script scripts/qa/runtime/refmap-dolls-search.mts`(모델 없이 `list_npc_graphics` 가 무엇을 내놓는지).
