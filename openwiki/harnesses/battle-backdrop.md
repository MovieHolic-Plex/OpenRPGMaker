# battle-backdrop — 장소에 맞는 측면 전투 배경 (맵 캡처 → 생성형 → 도트화)

> 2026-10-29 사용자: 전투 배경이 장소와 자주 안 맞는다(밤 편의점 전투에 낮 풀밭). 전투가 벌어지는 맵을 이미지 생성기에 주고
> 도트 같은 전투 배경을 받아 건다. **생성형 그림은 전투 배경에 한해 허용** — 결과가 도트처럼 보이고 게임 그림과 맞아야 한다.
> 타일·기물·캐릭터는 여전히 손 도트 규칙을 따른다(이 예외를 넓히지 않는다).

## 무엇을 하나

| 단계 | 하는 일 | 산출 |
|---|---|---|
| `capture` | 프로젝트·맵(또는 트룹 → 그 트룹을 부르는 전투 명령이 있는 맵)·칸 둘레를 **이벤트 없이 타일만** 그린다(`scripts/qa-game/render.mts` 의 `renderMapPng`, 편집기와 같은 타일 그리기). 맵 기본 조명을 입힌다. 시간(전투 전까지의 대사 낱말·조명)·빛·실내/야외·장소 낱말·칩셋 팔레트 24색을 기록 | `capture.png` · `reference.png`(16:9 판, 정수배 확대) · `facts.json` · 원장 판 |
| `produce` | 캡처를 **참고 그림**으로 이미지 서버(god-tibo-imagen, `monster-collect-species/node/imageSource.ts` 그대로)에 측면 전투 배경을 N장(기본 4) 요청. 후보마다 구도 문구만 바꾼다. 끝나면 바로 `pixelize` | `raw-<글자>.png` · `prompt-<글자>.txt` |
| `pixelize` | 16:9 가운데 자르기 → 팔레트 = 맵 팔레트 24 + 원본에서 맵 색으로 표현 안 되는 색만 8 → 원본 양자화(OKLab 최근접, 디더링 없음) → 목표 화소 = 블록 가운데 70% 의 **최빈 팔레트 색**(평균 아님 → 중간색·흐림 없음) → 외톨이 점 청소 → 드문 색 제거 → 2배 최근접 저장 | `native-<글자>.png` 320×180 · `stored-<글자>.png` 640×360 |
| `check` | 기계: 크기·색 8~32·아래 띠 무늬 밀도·밝기(밤이면 위쪽 ≤0.42, 아니면 캡처와 ±0.25). 판정자: 인물·글자·시간·같은 장소·측면 시점·바닥 비었음·도트로 읽힘. 판정은 도트 화소 해시에 묶인다 | 원장 `machine` · `judge` |
| `sheet` | 캡처 옆에 후보 1배·3배·**전투 무대 미리보기**(640×480 cover + 배틀러 자리 상자 + 바닥 띠 점선)·검사표·팔레트(덧색 노란 테두리)·프롬프트·원본 | `~/claude-viz/battle-backdrop-<이름>.html` → `http://mdc-server:18301/…` |
| `review` | **Claude Opus 검수**(2026-11-04 오너 「이제 사람이 고르지 않아. AI 가 해야함」). 맵 캡처 + 기계 검사를 통과한 미검수 후보 + 숨긴 디코이 3장(위아래 뒤집은 후보·맵 캡처 그대로·다른 장소 번들 배경)을 무작위 두 자리 번호로만 보여 주고 번호마다 `pass/reject`·1~5점(0.5 단위)·이유를 받는다. 통과 = pass 이면서 3.5 이상. 묶음은 모든 번호에 답하고 디코이를 모두 떨어뜨렸을 때만 효력이 있다. 판정은 도트 화소 해시에 묶이고 같은 화소는 다시 묻지 않는다. 모델은 Opus 만(요청·응답 둘 다 확인) | 원장 `reviews[]` · 원본 응답 `harness-data/battle-backdrop/reviews/<묶음>.json` |
| `pick` | `--best`: 효력 있는 Opus 통과 후보 중 최고점(같으면 글자 순)을 현재 도트·저장본 화소 해시에 묶는다. `--by` 에 근거(오너 원문·날짜)를 적는다. 글자를 직접 주는 선택도 남아 있지만 오너 결정 뒤로는 `--best` 를 쓴다 | 원장 `pick` (+ score·batch) |
| `build` | 고른 그림이 해시와 같을 때만 `kind:"backdrop"` 자원(`battle_backdrop_<판>_<해시8>`)으로 넣고 트룹 `previewBackgroundResourceId` 또는 맵 `battleBackground` 에 건다. SQLite 프로젝트 폴더는 `openLocalProjectStore` 로 저장 → 다시 열어 확인. JSON 은 `--out` 새 파일(또는 `--in-place`) | 원장 `builds[]` |
| `build --emit <폴더>` | 프로젝트 없이 `<자원id>.json`(`{ resource, target, run, pixelSha256 }` — `resource` 는 그대로 `upsert_resource` 인자) + `<자원id>.png` 를 쓴다. 코드로 프로젝트를 짓는 빌더(플래그십 데모)가 커밋해 두고 `execTool("upsert_resource", { resource })` → 트룹 `previewBackgroundResourceId`/맵 `battleBackground` 에 id 를 건다. 필드 모드 끄기는 `set_project_settings { battle: { backdrop: "default" } }` | 원장 `builds[]`(into = json) |
| `build --bundle <키>` | **공용 번들의 장소 그림**으로 싣는다(아래 「장소 그림」). Opus 검수로 고른(`pick --best`) 판만, 그 판정이 지금 화소에도 효력이 있을 때만. `public/assets/generated/battle-scenery/<키>/preview.png`(팔레트 PNG) + `src/assets/battleSceneryStills.json` 한 줄 | 원장 `builds[]`(target = `bundle:<키>`) |
| `status` | 판별 후보·검사·선택·설치 | |

```bash
npm run harness -- battle-backdrop capture --project <project.json|프로젝트 폴더> --troop <트룹 id> [--map <id>] [--cell x,y] [--window WxH] [--assets-root <체크아웃>] --run <판>
npm run harness -- battle-backdrop produce <판> --n 4          # 1분 넘으면 flock /tmp/fs2/short.lock 안에서
npm run harness -- battle-backdrop check <판> [--judge claude:sonnet|agy:gemini-3.8-flash|none]
npm run harness -- battle-backdrop sheet <판> [<판>…] --name <이름>
npm run harness -- battle-backdrop review <판>                  # Opus 검수(숨긴 디코이). 효력 없는 묶음이면 종료 코드 1
npm run harness -- battle-backdrop pick <판> --best --by 'opus-review (owner: 이제 사람이 고르지 않아. AI 가 해야함, 2026-11-04)'
npm run harness -- battle-backdrop build <판> --project <폴더|json> [--target troop:<id>|map:<id>] [--out new.json]
npm run harness -- battle-backdrop build <판> --emit <폴더> [--target troop:<id>|map:<id>]   # 코드 빌더용 자원 파일
npm run harness -- battle-backdrop build <판> --bundle <키> --ko "<이름>" --en "<name>"       # 공용 번들 장소 그림 battle-scenery-<키>
```

- `capture --indoor|--outdoor` — 구성기 세계의 방(묘실·보일러실 …)은 야외 칩셋 한 장에 깔리고 기후 표시가 없어 하네스가 야외·낮으로 읽는다. 부르는 쪽이 알려 준다(근거 줄에 남는다).

- `--assets-root` — 번들 칩셋 그림(`public/assets/...`)을 읽을 체크아웃. 다른 브랜치 데모(예: `../rpg-zzu-maou`)는 그 브랜치 그림으로 그린다.
- 다른 브랜치 데모 JSON 은 이 체크아웃의 로더가 자원 id 를 거부한다 → 로더 전체 대신 `restoreBundledTilesetDiffs` 만 해서 그린다.
- 원장 `harness-data/battle-backdrop/ledger.json`(커밋), 실행물 `qa-runs/harnesses/battle-backdrop/<판>/`(커밋 안 함).

## 규격 근거 (2026-10-29~30 실측)

- 번들 측면 배경 `public/assets/generated/battle-scenery/<biome>/preview.png` 은 640×360 이고 **2×2 블록이 100% 같다** → 원래 격자 320×180, 2배 저장, 색 20~23.
- 런타임 선택 순서 `resolveBattleBackdropId`(`src/battle/battleBackdrop.ts`): 전투 이벤트 `changeBattleback` → **트룹 `previewBackgroundResourceId`**(기본 숲 id 면 건너뜀) → 지형 → **맵 `battleBackground`** → 기후 → 던전 → 장소 이름 → 실내 → 스킨 기본(retro2003 = plains).
  그래서 마왕 편의점의 밤 편의점 트룹(`troop_mk_manual`)은 `battle-scenery-plains`(낮 풀밭)를 그렸다.
- 바이옴 id 가 아닌 자원은 한 장 그림으로 `cover` 로 깔린다(640×480 무대 → 좌우가 잘린다). 한 장 그림에는 pixelated 표시가 없어서 2배로 미리 키워 저장한다.
- 배틀러 발: retro2003 무대 640×480 에서 위 56px(스킨 inset) 아래 424px 영역에 저작 좌표 320×160 의 y 가 **발**로 놓인다(`battleFieldDom.positionBattleNode`, `_retro2003.css`) → 발이 높이 약 57~90%, 몸(약 144px)이 그 위. 그래서 아래 45%(`BACKDROP_GROUND_TOP` 0.55) 를 비운다. 시트의 무대 미리보기 상자가 이 자리다.
- `system.battleBackdrop === "field"` / `battlePresentation === "onField"` 면(또는 고른 배경이 `battle-scenery-field` 면 — 아래 「그 맵 그대로」) 필드 스크린숏이 그려져 이 그림이 안 보인다. 스크린숏이 없으면 트룹 배경으로 떨어진다 — **마왕 편의점 데모가 이 상태다**(`battleBackdrop: "field"` → 밤 편의점에서 트룹의 낮 풀밭). `build` 는 경고하고, `--leave-field-mode` 를 줄 때만 끈다(프로젝트 전체 전투 표시가 바뀐다). 조수 도구도 요약에서 경고한다.
- 바닥 띠 기준: 번들 8장 아래 무늬 밀도 0.02~0.18 → `≤0.22` 그리고 `≤ 위쪽×1.3+0.03`(8장 모두 통과).

## 장소 그림 (번들 한 장 그림, 2026-11-11)

겹 배경은 숲·평원·동굴·눈·사막 다섯뿐이라, 조수 v2 의 테마 세계(사막 묘실 · 증기 도시 보일러실 …)는 대역을 깔고 «없는 그림» 줄을 남겼다
(`src/ai/v2/place/placeTheme.ts`, 눈가림 플레이: 피라미드 보스전이 숲에서 벌어졌다). 그 빈칸을 이 하네스로 그려 **프로젝트가 아니라 번들에** 싣는다.

- **자리·id**: 겹 배경과 같은 폴더·같은 id 틀 — `public/assets/generated/battle-scenery/<키>/preview.png`, id `battle-scenery-<키>`.
  목록은 `src/assets/battleSceneryStills.json`(`build --bundle` 이 쓴다, 손으로 고치지 않는다) → `BATTLE_SCENERY_STILLS`(`src/assets/battleSceneryCatalog.ts`).
- **규격**: 겹 배경 미리보기와 같다 — 640×360 = 320×180 격자 2배(2×2 블록이 같다), 불투명, 32색 이하. 팔레트(색인) PNG 로 써서 한 장 약 10KB
  (RGBA 로 쓰면 38KB — `encodeIndexedPng`, 쓴 뒤 다시 읽어 화소 해시를 견준다).
- **푸는 법**: `resolveSceneryBiome` 은 장소 그림 id 에 undefined 를 돌려준다 → 도트 측면 전투가 겹 배경으로 바꾸지 않고 그 한 장을 `cover` 로 깐다(업로드 그림과 같은 길).
  `generatedAssetResourceResolver` 의 내장 표에 실려 있어 프로젝트에 자원을 넣지 않아도 **새 프로젝트·기존 프로젝트 모두** 주소가 풀리고,
  자원 참조 검증 · 편집기 그림 고르기(「전투 배경 · <이름> <장소 그림>」) · 조수 자원 목록이 알아보며, 내보내기는 프로젝트가 쓴 id 의 그림만 싣는다.
  `unknownSceneryIdMessage` 는 이 id 를 받아들이고(지어낸 `battle-scenery-…` 는 여전히 거절), 도구 설명(`BATTLE_BACKDROP_ID_HINT`)에 목록이 붙는다.
  몬스터 대치(포켓몬식)는 다른 `battle-scenery-*` 와 같이 줄무늬 바닥으로 푼다.
- **출구 조건**: 번들에는 `pick --best`(Opus 검수 통과 최고점)로 고른 판만 실린다. 디코이를 통과시킨 묶음·3.5 미만·사람이 글자로 고른 판은 거절한다.
  `test/battleSceneryStills.test.ts` 가 실린 그림의 화소 해시 = 원장의 선택 = 효력 있는 Opus 묶음의 pass 임을 CI 에서 본다.
- **참고 장소**: `bun scripts/qa/assistant-v2/themeBackdropPlaces.mts <폴더> [키,…]` 가 테마 표가 바라는 배경마다 그 세계·종류의 맵을 구성기로 한 장 깔아
  프로젝트 JSON 을 남긴다(모델 없음) → `capture --project <폴더>/<키>.project.json --map <맵 id> --run theme-<키> [--indoor] --note "<한 줄>"`.
- **증명**: `bun scripts/qa/assistant-v2/themeBackdropProof.mts <폴더> [키,…]`(구성기 장소 + 실제 빌더 채우기 → 맵에 저장된 전투 배경 id · 런타임이 고르는 배경) →
  `THEME_BACKDROP_PROOF=<폴더>/proof.json THEME_BACKDROP_KEY=<키> npm run qa:runtime -- --scenario theme-backdrop --project <폴더>/<키>.proof.project.json` (출하 플레이어 전투 화면).
- 실린 뒤에는 `placeTheme.ts` 표에서 그 줄에 `still: "<키>"` 를 적는다. 통과 못 한 배경은 `battle-scenery-field`(그 맵 그대로 — 아래) + 없는 그림 줄 그대로 둔다(점수 완화·디코이 빼기·손 기록 금지). 다른 지형 그림을 대역으로 깔지 않는다(2026-11-12).

실린 장소 그림과 검수 점수는 `battleSceneryStills.json` 과 원장이 정본이다(`npm run harness -- battle-backdrop status`).

### 실린 열둘 (2026-11-12)

| 키 | 장소(세계) | 판 | Opus 점수 |
|---|---|---|---|
| `tomb` | 묘실(desert_east) | `theme-tomb` | 4.5 |
| `boiler-room` | 보일러실·기관실(steampunk_city) | `theme-boiler-room` | 4.5 |
| `brick-street` | 벽돌 거리(steampunk_city 바깥) | `theme-brick-street-flat` | 4.0 |
| `ice-cave` | 얼음 동굴(snow_north) | `theme-ice-cave` | 4.5 |
| `beach` | 열대 해변(pirate_isles 바깥) | `theme-beach` | 4.0 |
| `shipwreck` | 난파선(pirate_isles) | `theme-shipwreck` | 4.5 |
| `cloud-sea` | 구름 바다(sky_island 바깥) | `theme-cloud-sea` | 4.5 |
| `sky-shrine` | 하늘 신전(sky_island) | `theme-sky-shrine` | 4.5 |
| `swamp` | 원시 늪(prehistoric) | `theme-swamp` | 4.5 |
| `volcano` | 화산(prehistoric) | `theme-volcano` | 4.0 |
| `edo-town` | 성하마을(sengoku_edo 바깥) | `theme-edo-town` | 4.5 |
| `station` | 정거장 복도(sf_station) | `theme-station` | 4.5 |

- 벽돌 거리 첫 판(`theme-brick-street`, 후보 8)은 자갈 무늬 때문에 기계 검사 `groundClear` 에서 전부 떨어져 검수에 가지 못했다. «바닥은 무늬 없는 평평한 띠» 를 적은 새 판에서 넷이 검수를 통과했다.
- 검수 비용: 묶음 열둘 $0.53(묶음마다 원장 `reviews[].costUsd`).

### 검수 경로 — 로컬 Claude (`BATTLE_BACKDROP_OPUS_VIA=claude-cli`)

`review` 는 기본으로 중계기(`klb/claude-opus-5.5`)에 묻는다. 2026-11-11~12 그 중계기가 503 이라 로컬 Claude 경로를 더했다:
`BATTLE_BACKDROP_OPUS_VIA=claude-cli npm run harness -- battle-backdrop review <판>` → `claude -p --model claude-opus-5-5 --effort medium`(도구·MCP·설정 없이, stream-json 으로 그림을 넣는다).
지시문·디코이·통과 규칙은 같다. 응답의 `modelUsage` 가 Opus 가 아니면 실패한다(다른 모델로 떨어진 묶음은 효력이 없다). 묶음마다 `costUsd` 를 원장에 적는다.

### 그 맵 그대로 — `battle-scenery-field`

그림이 없는 장소에서 다른 지형 그림을 까는 대신 **필드 화면 위에서 싸운다.** 맵 `battleBackground`(또는 무리 배경)에 `battle-scenery-field` 를 적으면
`resolveBattleBackdropId` 가 그 id 를 그대로 돌려주고, `playSceneBattle` 이 프로젝트 전체 설정(`system.battleBackdrop === "field"`)과 같은 길로 필드 스냅숏을 배경으로 쓴다
(겹 배경을 깔지 않고 필드 스프라이트를 숨긴다 — `battleScenery.syncBattleScenery` · `isFieldBattleBackdrop`). 파일이 없는 내장 id 라 내보내기는 싣지 않고, 자원 검증·`unknownSceneryIdMessage`·도구 설명이 알아본다.
조수 v2 는 세계·종류 표에 그림이 없는 종류와, 표 밖에서 같은 종류라고 말할 수 없는 맵(실내 칩셋·도시 거리)에 이것을 적고 없는 그림 줄을 남긴다 — `openwiki/assistant-v2.md` 「전투가 장소·파티에 맞는다」.

## 시간·빛

`inferTimeAndLight`(`src/editor/battleBackdropCore.ts`): 맵 기본 조명(`defaultLighting.ambient·color`, 런타임과 같은 곱하기)으로 빛 bright/dim/dark,
전투 명령 전까지 그 페이지 대사(선택지 가지 안까지)와 맵 이름의 낱말(밤·새벽·자정·보름달 / 저녁·노을 / 아침·낮)로 시간을 정한다.
**창 없는 실내에 낱말이 없으면 `timeCertain:false`** — 프롬프트가 시간을 강요하지 않고 판정자도 시간을 비교하지 않는다(옥좌의 방).

## 조수 도구 `generate_battle_backdrop`

같은 핵심(`src/editor/battleBackdropCore.ts`)을 편집기가 쓴다. 도구(`src/editor/tools/battleBackdropTools.ts`)는 `ui-required` 를 돌려주고,
`assistantSession` 분기가 `src/editor/battleBackdropGeneration.ts` 로 맵 그리기(`renderMapCoverCanvas`, 이벤트 뺌·조명 적용) → `generateAiImage`(참고 그림 1장, 용도 `backdrop`) →
도트화 → `upsert_resource`(kind backdrop) → `upsert_troop`(previewBackgroundResourceId) 또는 `set_map_properties`(battleBackground) 로 연결한다.
조수 경로는 한 장을 만들어 바로 건다(사용자의 프로젝트, 편집기에서 보고 바꾼다). 기계 검사 경고는 요약에 붙여 사용자에게 묻게 한다.
하네스 경로(여러 후보·사람 선택·해시)와 다르다 — 공용 번들·스토어에 올릴 그림은 하네스 경로만 쓴다.

## 판정자

기본 `claude:sonnet`(`claude -p` 가 Read 로 두 그림을 연다). `BATTLE_BACKDROP_JUDGE=agy:gemini-3.8-flash` 도 된다.
2026-10-29 agy 개인 할당량 소진(약 71시간)으로 기본을 claude 로 뒀다. 판정은 참고용이다 — 판정 통과 ≠ 합격.

## 알려진 한계

- 생성기가 참고 그림을 얼마나 따르는지는 판마다 다르다. 시트에서 캡처와 나란히 보고 판단한다(시범 판 결과는 아래).
- 이벤트로 놓인 가구(캐릭터 칩 그래픽)는 캡처에서 빠진다(인물을 빼려고 이벤트를 통째로 뺀다).
- 3/4 관문(object-gate)은 기물·타일용이라 전투 배경에는 걸지 않는다(스토어 출구 `scripts/store/agentStore.mts` 의 `GATED_KINDS` 도 chipset·tileset 만). 대신 Opus 검수(`review`)를 통과해야 한다. 2026-11-04 전에는 사람 선택이 필수였다.

## 시범 판 (마왕 편의점, 2026-10-30)

| 판 | 장소·근거 | 결과 |
|---|---|---|
| `maou-konbini-night` | `troop_mk_manual`, 해피 마트 22×23 통째. 시간 night(「새벽 2시」) · 빛 bright · 실내 | 4장 모두 기계·판정 통과. 생성기가 참고 그림의 진열대·빨간 간판·시계·ATM·계산대 배치를 따라 그렸다. 반짝이는 바닥 반사가 양자화되며 얼룩졌다 |
| `maou-konbini-night-matte` | 같은 캡처 + 「무광 바닥, 반사 없음」 문구 | 바닥 얼룩이 사라졌다. C 는 빨간 간판의 금색 문양을 판정자가 로고로 봤다(맵에도 있는 간판) |
| `maou-throne` | `troop_mk_castle`, 옥좌의 방 칸 23,6 둘레 18×12. 빛 dim(ambient 0.5 #2a0618) · 시간 판정 안 함 | 옥좌·스테인드글라스·깃발·갑옷 석상·화로·벤치가 그대로 나왔다. 돌바닥 결이 남아 바닥 띠 무늬 밀도 0.27~0.33 으로 4장 모두 기계 실패. 판정자는 갑옷 석상을 사람으로 읽을 수 있다고 3장을 지적 |

- 생성 시간은 한 장 40~55초(동시 4). CLI 시작이 렌더러를 읽는 capture/build 만 약 1~2분.
- **데모는 `system.battleBackdrop: "field"`** 라 설치해도 필드 화면이 있으면 안 보인다 — 설치할 때 `--leave-field-mode` 여부를 감독이 정한다.
- 시트 `http://mdc-server:18301/battle-backdrop-maou-pilot.html`. 데모에는 설치하지 않았다(선택은 감독·사람).
