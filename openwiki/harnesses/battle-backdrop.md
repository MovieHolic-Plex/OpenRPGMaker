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
| `pick` | **사람이** 고른 후보를 현재 도트·저장본 화소 해시에 묶는다. `--by` 필수. 감독·에이전트는 고르지 않는다 | 원장 `pick` |
| `build` | 고른 그림이 해시와 같을 때만 `kind:"backdrop"` 자원(`battle_backdrop_<판>_<해시8>`)으로 넣고 트룹 `previewBackgroundResourceId` 또는 맵 `battleBackground` 에 건다. SQLite 프로젝트 폴더는 `openLocalProjectStore` 로 저장 → 다시 열어 확인. JSON 은 `--out` 새 파일(또는 `--in-place`) | 원장 `builds[]` |
| `status` | 판별 후보·검사·선택·설치 | |

```bash
npm run harness -- battle-backdrop capture --project <project.json|프로젝트 폴더> --troop <트룹 id> [--map <id>] [--cell x,y] [--window WxH] [--assets-root <체크아웃>] --run <판>
npm run harness -- battle-backdrop produce <판> --n 4          # 1분 넘으면 flock /tmp/fs2/short.lock 안에서
npm run harness -- battle-backdrop check <판> [--judge claude:sonnet|agy:gemini-3.8-flash|none]
npm run harness -- battle-backdrop sheet <판> [<판>…] --name <이름>
npm run harness -- battle-backdrop pick <판> <글자> --by <사람>
npm run harness -- battle-backdrop build <판> --project <폴더|json> [--target troop:<id>|map:<id>] [--out new.json]
```

- `--assets-root` — 번들 칩셋 그림(`public/assets/...`)을 읽을 체크아웃. 다른 브랜치 데모(예: `../rpg-zzu-maou`)는 그 브랜치 그림으로 그린다.
- 다른 브랜치 데모 JSON 은 이 체크아웃의 로더가 자원 id 를 거부한다 → 로더 전체 대신 `restoreBundledTilesetDiffs` 만 해서 그린다.
- 원장 `harness-data/battle-backdrop/ledger.json`(커밋), 실행물 `qa-runs/harnesses/battle-backdrop/<판>/`(커밋 안 함).

## 규격 근거 (2026-10-29~30 실측)

- 번들 측면 배경 `public/assets/generated/battle-scenery/<biome>/preview.png` 은 640×360 이고 **2×2 블록이 100% 같다** → 원래 격자 320×180, 2배 저장, 색 20~23.
- 런타임 선택 순서 `resolveBattleBackdropId`(`src/battle/battleBackdrop.ts`): 전투 이벤트 `changeBattleback` → **트룹 `previewBackgroundResourceId`**(기본 숲 id 면 건너뜀) → 지형 → **맵 `battleBackground`** → 기후 → 던전 → 장소 이름 → 실내 → 스킨 기본(retro2003 = plains).
  그래서 마왕 편의점의 밤 편의점 트룹(`troop_mk_manual`)은 `battle-scenery-plains`(낮 풀밭)를 그렸다.
- 바이옴 id 가 아닌 자원은 한 장 그림으로 `cover` 로 깔린다(640×480 무대 → 좌우가 잘린다). 한 장 그림에는 pixelated 표시가 없어서 2배로 미리 키워 저장한다.
- 배틀러는 320×240 논리 공간 y 82~160 → 그림 세로 약 0.45~0.9. 그래서 아래 45%(`BACKDROP_GROUND_TOP` 0.55) 를 비운다.
- `system.battleBackdrop === "field"` / `battlePresentation === "onField"` 면 필드 스크린숏이 그려져 이 그림이 안 보인다(`build` 가 경고).
- 바닥 띠 기준: 번들 8장 아래 무늬 밀도 0.02~0.18 → `≤0.22` 그리고 `≤ 위쪽×1.3+0.03`(8장 모두 통과).

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
- 3/4 관문(object-gate)은 기물·타일용이라 전투 배경에는 걸지 않는다. 대신 사람 선택이 필수다.

## 시범 판 (마왕 편의점, 2026-10-30)

- `maou-konbini-night` — `troop_mk_manual`, 해피 마트 사쿠라자카점 22×23 통째. 시간 night(「새벽 2시」) · 빛 bright · 실내.
- `maou-throne` — `troop_mk_castle`, 마왕성 옥좌의 방 칸 23,6 둘레 18×12. 빛 dim(ambient 0.5 #2a0618) · 시간 판정 안 함.
- 시트 `http://mdc-server:18301/battle-backdrop-maou-pilot.html`. 데모에는 설치하지 않았다(선택은 감독·사람).
