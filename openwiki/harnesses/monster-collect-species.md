# 몬스터 수집 종 스프라이트 하네스 (`monster-collect-species`)

동일 생성 시트의 걷기 프레임을 추출할 때는 `pixelize(source, maxColors, { block: n })`의 검토된
정수 블록(2~40)을 고정할 수 있다. 자동 탐색이 프레임마다 7~15로 달라져 같은 캐릭터의
크기를 바꾸는 오류를 피한다. 기본 자동 탐색과 사람의 후보 선택 계약은 그대로다.

배경 마스크는 마젠타뿐 아니라 alpha<128도 배경으로 처리한다. 생성 PNG의 투명 영역에
남아 있던 RGB·희미한 광륜을 도트 잉크로 바꾸면 배경 덩어리와 잘못된 몸집이 생긴다.
모서리 표본의 과반이 alpha<128이면 alpha·마젠타 마스크가 배경의 근거이며, 모서리 RGB
중앙값의 연결 영역을 추측해 지우지 않는다. 투명 픽셀의 숨은 RGB가 흰색·검정·갈색 등
몸체나 윤곽과 비슷하면 그 RGB flood가 실제 불투명 전경까지 지울 수 있기 때문이다.
과반 투명 모서리가 없는 입력에서는 기존 모서리 색 flood를 유지한다(불투명 단색·흰색
배경 및 내부에 투명 구멍 한 개만 있는 RGBA 입력).
마젠타 정리와 alpha128 문턱은 그대로다.

`import --block N`은 검토한 2~40 정수 격자를 정적 그림과 `--action` 줄 모두에 전달한다.
범위 밖·소수·NaN·누락값은 후보 폴더를 만들기 전에 거부한다. `run.json`의 `fixedBlock`은
명시된 값이고 각 `candidates[].block`은 실제 사용된 값이다. 플래그가 없으면 `fixedBlock`
필드는 생기지 않으며 기존 자동 탐색을 쓴다. 일반 front/back/action 생성 호출은 그대로다.
고정 격자는 크기 오탐지를 막는 별도 제어이며, 배경 마스크 수정만으로 후보 품질이나
앞뒤 몸집 일치를 보장하지 않는다. 후보 선택은 계속 사람이 한다.

몬스터 수집(포켓몬류) 장르 **전용**. 도감 시드의 종마다 상대 앞모습·내 몬스터 뒷모습 전투 스프라이트와
대기·공격·피격 애니메이션 스트립을 만든다.
JRPG 일반 적 그림은 여기서 만들지 않는다(`src/editor/aiDatabaseGeneration.ts` 의 자료집 그림 생성 경로).
구조 규칙은 [README](README.md), 목록은 `src/harnesses/INDEX.md`.

## 빠른 시작

```bash
npm run harness -- monster-collect-species status                       # 시드의 종별 진행
npm run harness -- monster-collect-species front --species sparkit --n 6 # 앞모습 후보 6장 → sheet.html
npm run harness -- monster-collect-species pick --species sparkit --side front --run <run> --candidate 2
npm run harness -- monster-collect-species back --species sparkit --n 3  # 고른 앞모습으로 뒷모습 후보
npm run harness -- monster-collect-species pick --species sparkit --side back --run <run> --candidate 1
npm run harness -- monster-collect-species build                        # 번들 굽기(스프라이트 + 대기 스트립) + 검사
npm run harness -- monster-collect-species action --species sparkit --side front --action attack --n 2  # 큰 동작 한 줄 후보
npm run harness -- monster-collect-species pick --species sparkit --side front --action attack --run <run> --candidate 1
npm run harness -- monster-collect-species build                        # 동작 스트립 + anim.json
npm run harness -- monster-collect-species preview                      # 대기·동작 재생 HTML
npm run harness -- monster-collect-species import --species sparkit --side front --raw <PNG> --block 8 # 검토한 격자 고정
```

- 후보 비교 시트는 `qa-runs/harnesses/monster-collect-species/<종>/<front|back>/<run>/sheet.html`(64px 실루엣 마스크 포함). 2026-10-16 이후 고르는 건 **감독**이다(아래 「디자인 규칙」) — 시트를 사용자에게 보여 주고 번호를 받는 단계는 두지 않는다. 작업 에이전트는 기준으로 골라 근거를 적는다.
- 새 종은 `harness-data/monster-collect-species/seed.json` 에 먼저 적는다. 진화형은 `evolvesFrom` 을 적으면 앞 단계 앞모습을 참고로 그린다(앞 단계를 먼저 골라야 한다).
- **시험 실행은 모래상자에서**: `MONSTER_HARNESS_SANDBOX=<폴더>` 를 주면 시드(`<폴더>/data/seed.json`)·기록·격자·번들·산출물이 전부 그 폴더 아래로 간다. 커밋된 `seed.json`·`ledger.json`·번들을 건드리지 않는다. 에이전트가 시험 삼아 고르는 건 여기서만 한다.
- 이미지 서버: god-tibo-imagen `POST /v1/generate/json`, 주소 `OPRN_HARNESS_IMAGE_URL`(기본 `http://mdc-server:8091`). 502 `MISSING_IMAGE_GENERATION_OUTPUT` 이 흔해 한 번 재시도한다.

### Alpha/고정 격자 집중 확인 (2026-10-04)

Vitest·전체 게이트 없이 실행하는 fixture:
`node_modules/.bin/vite-node --script src/harnesses/monster-collect-species/node/verifyAlphaGrid.ts -- <개인 출력 폴더> [실제 PNG] [옛 grid.ts]`.
alpha0 RGB흰색과 이어진 불투명 흰색 보존, 숨은 RGB 불변성, alpha127/128 문턱,
불투명 단색·마젠타·흰색 배경 및 내부 alpha0 구멍의 정리, import2/8/40·잘못된 값 거부·provenance·기본 자동
import를 확인한다. seed만 개인 sandbox에 복사하고 후보 import만 하며, 생성·pick·build·
정본 쓰기는 없다. 선택 사항인 옛 TS baseline은 Node24의 타입 제거로 읽는다.
실제 PNG 비교는 원본과, alpha<128 RGB만 흰색으로 바꾼 변형(보이는 전경은 동일),
그 배경만 불투명 마젠타로 바꾼 변형의 수정 후 결과가 같음을 확인한다. 옛 처리기의
실제 원본 손실 수와 흰색 RGB 변형 손실 수는 별도로 기록하며, 실제 손실을 가정하지 않는다.
흰색 연결 fixture의 회귀 근거와 실제 원본 측정은 서로 구분한다.

## 캠페인·전투 배선 (2026-10-15) — 「번들에 종이 있으면 그 그림」

사용자 결정(2026-10-15): 인게임 전투 몬스터는 생성형(이 하네스) 그림이다. 번들(`public/assets/harnesses/monster-collect-species/<종>/`)은 이제 `build_monster_game` 캠페인(60종)·전투 화면에 실제로 쓰인다.

**일반 규칙(종마다 하드코딩 없음):**

1. 시드 종에 `campaignSpeciesId`(예: `mx_species_coalbit`)를 적는다 — 캠페인 종 하나에 하네스 종 하나. **이 값이 대응 표의 정본이다.**
   현재 대응: `sparkit`→`mx_species_coalbit`(불꽃), `aqualing`→`mx_species_rivulet`(물), `leafling`→`mx_species_spriglet`(풀). 사람이 고른 스타터 세 종이 캠페인 스타터 3계통 1단계에 붙는다.
   2026-10-15 추가 12종(감독 위임으로 앞·뒤 선택): `gustchick`→`mx_species_gustchick`, `pipbug`→`pipbug`, `wickworm`→`wickworm`, `rootpig`→`rootpig`, `frondhare`→`frondhare`, `kilnclaw`→`kilnclaw`, `brookraft`→`brookraft`, `coralpin`→`coralpin`, `curlfin`→`curlfin`, `zaptoe`→`zaptoe`, `pebblekid`→`pebblekid`, `gritnose`→`gritnose`(하네스 종 id 와 캠페인 종 id 가 `mx_species_` 접두만 다르다. 정본은 시드).
   (이름·도감 설명은 캠페인 쪽 그대로라 스파킷=도롱뇽 그림이 「숯비늘」로 보인다 — 맞추려면 캠페인 종 이름·설명을 바꾸거나 `campaignSpeciesId` 를 지운다.)
2. `build`(끝에 자동) 또는 `manifest` 단계가 번들 폴더를 읽어 `src/assets/harnessMonsterBundle.json` 을 쓴다(종 → `campaignSpeciesId`·면·대기 칸 수, **이미지 바이트 없음**). 모래상자는 `<샌드박스>/bundle/manifest.json`.
3. 런타임 입구는 `src/assets/harnessMonsterArt.ts`:
   - 리소스 id `harness-monster-<하네스종>-<front|back>` → 리졸버(`generatedAssetResourceResolver.ts`)가 `/assets/harnesses/monster-collect-species/<종>/<면>.png` 로 풀고, 참조 검증(`resourceReferenceValidation.ts` `collectResourceIds`)과 몬스터 자원 목록(`monsterResourceCatalog.ts`)에 올라간다. 내보내기는 기존 경로(`collectWebExportAssets`)가 그림 파일과 대기 스트립을 함께 싣는다(확인함).
   - 대기 스트립(112×N)은 `battlerIdleAnimation()` 이 같은 모듈에서 image-strip 으로 돌려준다(카탈로그 배열에는 안 넣는다 — 목록이 정본).
   - `harnessArtForCampaignSpecies(id)` 가 캠페인 종 id → 번들 그림을 준다.
4. `roster.ts`(`configureExpeditionRoster`)가 종마다 **앞·뒤가 둘 다 번들에 있으면** `graphic.monsterResourceId/backResourceId` 를 번들 그림으로, 아니면 기존 `mx_art_*`(64×64 업로드 그림)로 둔다. 번들 그림으로 바뀐 종의 `mx_art_<slug>_*` 는 프로젝트에 복사하지 않는다. 기본 적 레코드·야생·트레이너 팀은 `species.graphic` 을 읽으므로 따라온다. → **번들에 없는 종은 지금처럼 기존 그림으로 폴백한다.**
5. 전투: 내 몬스터는 `backResourceId`(`.battle-monster-authored-back`), 상대는 `monsterResourceId` 를 쓴다. 상대 적 그림에도 대기 스트립을 적용하도록 `battleFieldDom.ts` `enemyButton` 에 `applyIdleAnimationToImage` 를 더했고(도트 시트 적은 제외), 포켓몬 스킨 CSS(`20-pokemon-skin.css` 의 `.battle-enemy-image{background:none}`)가 스트립 배경을 지워 적이 투명해지던 것을 `battle-skins/_battlers.css` 한 규칙(특정도 보강, 죽은 적·감속·고대비는 제외)으로 막았다. `applyIdleAnimationToImage` 끝의 가드는 스킨이 배경을 지워도 표시를 걷어 정적 `src` 로 돌아가게 한다.
6. 폴백 확인: 번들에 면이 하나뿐이거나 종이 없으면 기존 그림, 스트립이 없으면 정적 그림.

**남은 한계:** 아이콘(`_icon` 32×32)은 번들 종에 없어 메뉴·도감이 앞모습(112)으로 폴백한다 · 전투 표시 크기가 에메랄드 스킨 128px 고정이라 112 캔버스는 1.14배(비정수) — 하네스 배치 시안(`qa/battle-layout.css`)은 내 몬스터 3배·상대 2배 정수 배율 · 진화형·다른 종은 사람이 고른 뒤 `build` 하면 같은 규칙으로 자동 반영(시드에 `campaignSpeciesId`) · 이미 만든 저장 프로젝트는 옛 `mx_art_*` id 를 그대로 가진다(새 캠페인부터 반영).

## 파일

| 경로 | 무엇 |
|---|---|
| `src/harnesses/monster-collect-species/harness.ts` | 매니페스트 (범위 `monster-collect`) |
| `src/harnesses/monster-collect-species/pixel/grid.ts` | 생성 그림 속 픽셀 격자 찾기 → 칸 최빈 색 |
| `src/harnesses/monster-collect-species/pixel/tidy.ts` | 마젠타 번짐·작은 섬 제거, 20색 합치기, 외톨이 점 흡수 |
| `src/harnesses/monster-collect-species/pixel/downscale.ts` · `src/harnesses/monster-collect-species/pixel/fit.ts` | 정수/비정수 최빈 축소(선 우선) → 64 캔버스 바닥 정렬 |
| `src/harnesses/monster-collect-species/pixel/pipeline.ts` | `pixelize` · `toSprite` · `cleanReference` (브라우저·노드 공용 입구) |
| `src/harnesses/monster-collect-species/prompts/prompts.ts` | 앞모습·뒷모습·진화형 프롬프트 |
| `src/harnesses/monster-collect-species/checks/checks.ts` | 자동 검사 |
| `src/harnesses/monster-collect-species/qa/battle-layout.css` | 전투 배치 시안 (엔진 미반영) |
| `src/harnesses/monster-collect-species/node/cli.ts` | CLI 단계 |
| `src/harnesses/monster-collect-species/anim/idle.ts` | 대기: 고른 스프라이트를 정수 픽셀로 움직이는 4프레임 (생성 없음) |
| `src/harnesses/monster-collect-species/anim/row.ts` | 큰 동작: 한 줄 참고 그림, 줄 → 프레임 나누기, 같은 배율·발 맞춤, 스트립 |
| `harness-data/monster-collect-species/seed.json` | 사람이 쓰는 도감 기획 + 화풍 계약 + 애니메이션 계약(`animation`) |
| `src/assets/harnessMonsterBundle.json` · `src/assets/harnessMonsterArt.ts` | 런타임 번들 목록(바이트 없음, `build`/`manifest` 가 씀) · 런타임 입구(리소스 id·URL·대기 스트립·캠페인 종 대응) |
| `harness-data/monster-collect-species/ledger.json` | 하네스가 쓰는 선택 기록 (원본 sha256·프롬프트·블록 크기) |
| `harness-data/monster-collect-species/grids/<종>-<면>.png` | 고른 후보의 격자 도트(칸 하나 = 픽셀 하나). `build` 의 입력 |
| `public/assets/harnesses/monster-collect-species/<종>/<front\|back>.png` | 번들 스프라이트 (64×64, 2026-10-16 전엔 112) |
| `harness-data/monster-collect-species/grids/<종>-<면>-<동작>.png` | 고른 동작 줄의 격자 도트 (N 프레임이 한 장). `build` 의 입력 |
| `public/assets/harnesses/monster-collect-species/<종>/anim/<면>-<상태>.png` · `anim.json` | 가로 스트립(64×N, `src/assets/battlerIdleAnimations.ts` image-strip 과 같은 모양) + 프레임 수·간격·반복·출처 |

## 디자인 규칙 (2026-10-16 — 외부 시험자 지적 이후)

지적 원문: 「디자인이 별로다. 귀여운 게 포인트인 것 같은데 귀엽지 않고, 강력해 보이는 건 좋은데 특징이 없다. 포켓몬은 어딘가 특출나게 강조된 곳이 있다
(피카츄의 번개 꼬리, 글라이온의 꼬리 끝 독침, 조로아크의 이족보행 늑대인간 느낌과 큰 갈기). 캐릭터 디자인을 더 고민해야 한다.」
원인: 이전 프롬프트가 「NOT chibi, NOT kawaii, believable creature anatomy, eyes small and sharp」 라고 못 박아 **실사적 비례의 평평하게 균형 잡힌 동물**만 나왔고
(시드 design 에도 시그니처 요구가 없었다), 선택 기준은 「귀엽다」 한 문장 + 기계 경고(윤곽 약함·외톨이 점)뿐이라 「한 가지 과장」과 「귀여움의 비례」를 아무도 검증하지 않았다.
점검표: `~/claude-viz/monster-design-audit-1.html` (15종 시그니처 ○3 △9 ×3, 귀여움·위압감 ○3 △7 ×5, 실루엣 ○5 △7 ×3; frondhare 는 leafling 의 알파 100% 복제).

| # | 규칙 | 어디서 강제되나 |
|---|---|---|
| ① | **시그니처**: 종마다 몸에 비해 한 부위만 크게 과장(꼬리 모양·침·갈기·귀·등껍질·뿔 …). 원작 특징 베끼기 금지 | 시드 `signature`(필수, `validateSeed`) → `frontPrompt` 「SIGNATURE FEATURE」, 뒷모습·동작 프롬프트도 유지 문장 |
| ② | **1단계는 chibi 비례**: 머리 40~50%·큰 눈(하이라이트 2칸)·짧고 통통한 몸·둥근 실루엣. 귀여움은 비례와 눈에서, 홍조·하트·스티커·반짝이는 장식은 금지 | `proportionClause(stage 1)` |
| ③ | **진화마다 시그니처가 커지거나 형태가 바뀜**. 최종형은 위압감(머리 25~35%·이족·갈기·무기 같은 장식), 같은 윤곽에 색만 바꾼 복제 금지 | `proportionClause(stage ≥2)` + `evolutionPrompt` |
| ④ | **실루엣 테스트**: 검정 마스크 64px 에서 종이 구별. 후보 시트가 64px·112px 마스크를 같이 보여 주고, `check` 가 겹침(IoU) 0.75 이상 짝을 경고 | `sheetHtml`, `checks.ts similarSilhouettes` |
| ⑤ | **색**: 몸 색 3~4개(+명암 2~3톤) + **포인트 색 1개**(시그니처에만) | 시드 `accent`·`palette` → `colorClause` |

- 시드 `design` 은 체형·몸 무늬·자세, `signature` 는 한 문장 영어, `accent` 는 포인트 색. 진화형 design 은 앞 단계와 **자세·비례가 다르게** 적는다(예: 네발 → 이족).
- 프롬프트 판본은 `DESIGN_RULES_VERSION`(prompts.ts, 현재 4 = 귀여움 우선·흰 하이라이트 필수·하이라이트 보존 도트화). 규칙을 바꾸면 올린다.
- 후보 선택은 2026-10-16 이후 **감독이** 한다(사용자에게 고르게 하지 않는다). 위 다섯 기준으로 1장을 골라 `pick --note` 와 `harness-data/monster-collect-species/design-v2-picks.json` 에 근거 한 줄을 남긴다. 새 후보가 분명히 더 낫지 않으면 기존 그림을 유지하고 `keep` 으로 적는다.
- 후보 시트·점검표 생성기: `src/harnesses/monster-collect-species/qa/design_sheets.py` (`audit` · `pick`).
- 조수가 새 종·계통을 지을 때의 같은 규칙: `src/ai/piAgent/monsterGameRequest.ts` `MONSTER_GAME_PRODUCTION_PROMPT` 끝의 「종 디자인 규칙」 문단.
- 아래 「왜 이렇게 만드는가」의 「마스코트·치비·볼터치 금지」는 2026-10-01 시안의 이력이다. 지금은 **볼터치·스티커 금지만** 남고 치비 비례(1단계)는 요구한다.

### 눈 규칙 (판본 3, 2026-10-16 — 사용자 지적 「몬스터에 문제가 많다, 눈이라던가」)

판본 2 번들 30장을 원본 64px·6배·얼굴 10배로 열어 보니 눈 결함이 컸다: 눈이 갈색 털 속 한 덩어리로 뭉개짐(rootpig), 얼굴이 갈기에 묻혀 눈이 안 보임(frondhare),
눈동자가 윤곽선에 붙음(kilnclaw), 줄기눈에 동공이 없음(coralpin), 한쪽 눈이 윙크 곡선(aqualing), 하이라이트가 윤곽색에 묻힘(gustchick), 뒷모습이 꽃으로 읽힘(aqualing).
진화형 프롬프트의 「narrow sharp/fierce eyes」가 64px 에서 눈을 3화소 아래로 줄이는 주범이었다. 점검표: `~/claude-viz/monster-eye-audit-1.html`.

| 규칙 | 어디서 강제되나 |
|---|---|
| 앞모습 눈 둘(3/4 시점, 가까운 눈이 더 큼) · 눈동자 3×3 화소 이상(프롬프트는 4×4) · 흰 하이라이트(프롬프트는 2×2) · 밝은 얼굴 위에서 윤곽선과 한 칸 이상 떨어짐 · 털·잎·불꽃에 가리지 않음 | `prompts.ts eyeClause`(DESIGN_RULES_VERSION 3), 시드 `eyes`(줄기눈 등 종별 덮어쓰기), 진화형 design 의 「narrow eyes」 삭제 |
| 뒷모습에는 눈을 그리지 않는다 | `backPrompt` |
| 주 눈 탐지(면적 ≥ 9, 하이라이트 ≥ 1, 눈동자 둘레 고리의 절반 이상이 밝은 살갗) 실패 = **눈 규칙 탈락**, 후보 시트에 표시하고 판정 대상에서 뺀다 | `checks/eyes.ts` `checkEyes` → `checkSprite(…, side)`, 후보 `run.json` 의 `eye: {pass, pair}` |
| 둘째 눈 확인·두 눈 크기비·뒷모습의 큰 눈 모양은 **경고**(3/4 시점에서 먼 눈은 정당하게 가려질 수 있고, 어두운 바위·줄무늬를 눈으로 오인한다) | 같은 파일 |

- 기계 검사는 필요조건이다(탈락 후보를 거르고 번들 통과율을 센다). 눈이 자연스럽고 생기 있는지는 **판정 모델**이 후보 시트를 보고 정한다 — 번들 갱신은 사람이 아니라 Opus 5.5 판정자(독립 서브에이전트)의 1등을 쓴다.
- 실측: 판본 2 번들 앞모습 주 눈 규칙 통과 12/15 → 판본 3 번들 15/15(뒷모습 눈 비침 없음 14/15 → 15/15). 생성 후보는 앞 68/78 통과.
- 한계: 64px 로 줄이면 하이라이트 화소가 자주 사라진다(생성은 넣어도 격자 최빈색에 먹힌다). 판정자가 「하이라이트 없음」으로 본 종(pipbug 등)은 판정 기록에 `eye_ok:false` 로 남았다.
- 시트·판정 생성기: `qa/eye_sheets.py`(`audit` 점검표 · `blind` 번호만 보이는 눈가림 시트). 판정자에게는 생성 순서·점수·눈 규칙 결과를 숨기고 번호만 준다.

### 판본 4 — 귀여움 우선·흰 하이라이트 필수 (2026-10-16, 사용자 「눈이 안 비치니까 징그럽다, 귀여운 거 위주로」)

판본 3 은 눈의 크기·하이라이트 유무만 봤고 「어두운 구슬눈」도 통과했다. 판본 4 는 기준 순서를 바꾼다.

- **판정 순서**: ① 귀엽다(큰 눈·둥근 머리와 몸·1단계 머리 40~50%·호감 가는 표정; 「친구로 데려가고 싶은가」) ② 눈에 흰 하이라이트가 있어 반짝인다(없는 어두운 구슬눈은 감점이 아니라 **탈락**) ③ 시그니처 한눈에 ④ 64px 실루엣 ⑤ 앞뒤 일관 ⑥ 뭉개짐 없음. 징그러운 느낌(어두운 눈, 사나운 표정, 곤충·파충류 질감, 눈 하나만 점)은 탈락 사유로 판정자에게 명시한다. 시그니처·치비·64px 계약은 그대로.
- **눈 규칙 v4(`checks/eyes.ts`)**: 앞모습은 흰 하이라이트 필수 — 눈동자 안(눈동자 상자 안, 어두운 이웃 2개 이상)에 L≥0.85·채도≤0.055·눈동자보다 0.5 이상 밝은 화소. 크림 살갗(채도 0.06~0.09)은 하이라이트가 아니다. 1~2단계 주 눈 면적 ≥12(3단계 9). 없으면 `눈 규칙 탈락`(후보에서 뺀다).
- **하이라이트 보존 도트화(`pixel/downscale.ts`)**: 최빈색 축소가 어두운 동공 속 흰 점 1~2칸을 먹어 눈이 구슬로 죽었다(pipbug 후보 12장 전멸의 원인). `findHighlights` 가 격자에서 「어두운 이웃에 70% 이상 둘러싸인 밝은 덩어리(면적 ≤9)」를 찾고, `preserveHighlights` 가 축소 뒤 그 자리 새 칸(겹침 ≥1/3, 없으면 최대 겹침 한 칸)을 하이라이트 색으로 되살린다. 손으로 도트를 찍지 않는다 — 파이프라인 규칙이다. 격자에 하이라이트가 아예 없으면(생성기가 안 그림) 되살릴 것이 없다 → 탈락.
- **프롬프트**: 눈동자 6×6 이상·흰 2×2 하이라이트(+우하 1화소)·「어두운 구슬눈 금지」·징그러움 금지 문장, 진화형도 「친근하고 용감한 얼굴」(사나운 표정 금지).

### 판본 5 — 종별 눈 표와 눈 자리 검사 (2026-10-20, 사용자 「몬스터 눈알 교정」)

R11~R13 은 눈을 `upgrade_all_60_eyes.py` 의 손으로 친 절대 좌표로 찍었다. 좌표가 머리를 모르고(`HEAD_CENTERS` 는 읽히지 않는 표였다), 찍는 함수가 알파를 255 로 덮어 **실루엣 밖 허공에** 눈이 생겼고, 옛 눈을 지우지 않아 **잔상**이 남았다. 판본 4 검사는 「좋은 눈 하나가 어딘가 있나」만 봐서 60/60 통과였고, 번들 시험은 `checkSprite` 에 면을 넘기지 않아 눈 규칙이 번들에 아예 돌지 않았다. 점검표: `~/claude-viz/monster-eye-fix-plan-1.html`.

- **정답표 `harness-data/monster-collect-species/eyes.json`**: 종마다 `anatomy`(`threequarter` 왼쪽 3/4 두 눈 · `profile` 옆얼굴 한 눈 · `frontal` 정면 두 눈 · `stalk` 눈자루), `style`(`round` 둥근 BW 틀 · `hand` 스타터 손 도트 · `square` 사각 5×5 = 폐지 · `reference` 동결 기준종), 64 캔버스 상자 `near`·`far`(없으면 `null`)·`second`, `frozen`(앞·뒤 RGBA 화소 sha256), `pending`(사람 선택 대기), `accept`(지금 실패하는 검사와 이유).
- **검사(`checks/eyeTable.ts`)**: V0 상자에 실제 눈(어두운 칸 + 흰 하이라이트) · V1 상자와 둘레 한 칸이 몸 안(허공 금지) · V2 둘레 한 칸 어두운 칸 ≤30%(윤곽선에 붙은 먼 눈) · V3 살갗−눈동자 밝기 ≥0.3 · V4 3/4 배치(먼 눈은 왼쪽·같거나 작게·높이차 ≤2·간격 1~8, 정면은 같은 크기·높이) · V5 눈동자에서 상자 밖으로 이어진 어두운 칸 ≤3(옛 눈 잔상) · V6 뒷모습 눈 없음(`checkEyes(back)`) · V7 사각 틀 금지·한 진화 계통 안 양식 하나 · V8 동결 종 해시. 눈자루(stalk)는 몸 밖으로 나가는 게 정상이라 V1·V2·V4 를 보지 않는다.
- **동결**: #6 wickworm · #7 rootpig · #8 frondhare · #10 brookraft(사용자가 좋다고 한 R13 기준종)는 그림이 곧 기준이다 — V0~V7 을 보지 않고 V8 해시만 본다. 바뀌면 시험 실패.
- **accept 는 정확히 같아야 한다**: 시험(`test/harnesses/monsterCollectSpecies.test.ts`)과 `check` 단계가 종마다 실제 실패 목록 = `accept` 키를 요구한다. 새로 깨지면 실패, 고쳤는데 `accept` 를 안 지워도 실패 — 실패 목록이 장부에 남아 「고쳤다」를 기계로 증명한다.
- **번들 시험은 눈 규칙을 실제로 돈다**: `checkSprite(front|back, maxColors, side, stage)`.
- **고치는 법(`scripts/content/monsters/upgrade_all_60_eyes.py`, 표 주도)**: 종 항목에 `repair`(`from` 지금 authored 파일 sha256 · `erase` 옛 눈 상자 · `clear` 허공에 찍혔던 칸 · `paint` 눈 색)를 적고 돌린다. ① 파일 해시가 `from` 이 아니면 거부(손 수정 보호), `to` 와 같으면 건너뜀 ② `clear` 칸을 투명으로, 옛 눈 상자와 거기 이어진 잔상 칸을 주변 살갗·윤곽에서 다시 채움 ③ `near`/`second`/`far` 에 둥근 BW 틀(`redraw_starters.draw_bw_eye`·`draw_far_eye`)을 그리되 투명 칸에는 안 그리고 윤곽 칸을 밝히지 않음 ④ authored 저장, 장부 `authoredSha256`·`previousAuthoredSha256`, 표 `repair.to` 기록. `--out-dir` 은 미리보기(저장소 무변경). 그다음 `npm run harness -- monster-collect-species build`, 바뀐 종만 `field_chip.py derive → pick → bake`.
- **먼 눈 규칙(사용자 결정 2026-10-20)**: 먼 눈이 윤곽에 붙으면 얼굴 안쪽으로 1~2칸 밀고, 그래도 몸 밖이면 생략(한 눈 3/4). 몸 안이면 윤곽 옆이라도 유지 — 그 종은 `accept.V2` 로 남긴다.
- **R13 → 판본 5 적용 결과(2026-10-20)**: 앞모습 49종 눈 재배치(걷기 칩 49종 다시 derive, 칩 그림이 실제로 바뀐 것 42종). 손대지 않은 앞모습 11종(동결 4 · 게 3 · 스타터 sparkit·aqualing·leafling · winterquill)과 뒷모습 60장은 화소 그대로. 남은 실패 6종: 게 3종(사용자 선택 대기), ribbonwing·hushdoll(먼 눈 몸 안·윤곽 옆, Q1 유지), aqualing(R12 스타터 손 도트 먼 눈).

### 격자 계약 (2026-10-16 — 외부 시험자 「픽셀 그리드부터 맞게」)

- **한 문장**: 논리 화소 1 = 화면 2px(화면 480×320 = GBA 240×160 의 2배). 몬스터 그림 한 도트 = 논리 화소 하나, 전투 표시 **64 캔버스 → 128px(정확히 2배)**.
- 캔버스 **64×64**(옛 112: 정수배가 1배뿐이라 D12 비정수 128 이 났다), 몸 내용 **긴 변 56 이내**(`MAX_INK_SIDE`), 바닥 정렬, idle 스트립 64×N. 몸집 목표 `BODY_SIZE` front 46 · back 50(진화 단계 ×1.08·1.15).
- 생성기가 그린 도트(블록 7~15px → 60~130칸)는 `fitSprite` 가 64 캔버스에 맞게 줄인다(정수배에 0.15 안이면 정수, 아니면 비정수). 종마다 원본 블록이 달라도 **최종 스프라이트는 전 종이 같은 64 격자**다. `grid` 단계가 종별 원본 칸 수→줄인 배율을 보여 준다(실측: 앞 14·뒤 14 중 줄임 1.5~2배).
- 거칠어지는 건 GBA 격자와 같아 의도한 것이다 — 그래서 시그니처와 실루엣이 64px 에서도 읽히는지가 더 중요하다(디자인 규칙 ④).
- 규격이 바뀌었을 때 이미 만든 후보를 다시 맞추려면 `refit [--species]`(생성 없음).
- 런타임의 정수배 표시(그림 크기에서 배율 계산)는 별도 작업이다(D12). 매니페스트 `canvas` 가 64 이므로 `harnessMonsterArt.ts` 는 스트립 셀 폭을 64 로 읽는다.

## 왜 이렇게 만드는가 (2026-10-01 실험, `qa-runs/hand-monster/` 시안)

- **손 도트(64·48px)와 「생성 → BOX 축소」(v9) 는 사용자에게 거절됐다**(「허접」, 「못 봐주겠다」). v9 의 잘게 갈라진 색 조각은 그림 탓이 아니라 축소 탓이었다: 생성기는 도트풍을 8~27px 가짜 픽셀 블록으로 그리는데, BOX 축소가 블록 경계와 어긋나 이웃 색을 섞는다. 격자를 찾아 칸마다 최빈 색을 고르면 생성기가 고른 도트가 그대로 남는다.
- **블록 크기 추정**: 색 경계 봉우리 간격이 크기 p 의 정수배에 가까운지 센다(배수 k 가중 1/k). 반올림한 몫에 투표하면 13·14px 간격이 반 크기 7 에 몰려 칸을 둘로 쪼갠다.
- **프롬프트**: 예전 자료집 프롬프트(「front view facing the viewer, white background」)가 정면 마스코트를 만들었다. 포켓몬 BW 상대 스프라이트풍, 왼쪽 3/4, 마스코트·치비·볼터치 금지, 생물 해부, 마젠타 단색 캔버스를 참고 이미지로. 검정 배경·불꽃 후광이 붙으면 배경 제거가 안 된다.
- **뒷모습**: 생성 원본이 아니라 깨끗한 도트를 정수배로 키워 마젠타에 놓은 것을 참고로 넣는다. 원본을 넣으면 어두운 후광이 따라왔다. 네 발 종은 뒷모습도 네 발이어야 한다(두 발로 선 후보가 섞여 나온다 — 사람이 거른다).
- **공식 몬스터 닮은꼴**: 이상해씨·파이리를 그대로 닮은 후보가 나왔다. 프롬프트 `avoid` 로 줄이고, 최종 판정은 사람.
- **크기**: 몸집 = 잉크 상자 넓이의 제곱근. 앞 80·뒤 88 목표 × 진화 단계 배율(1·1.12·1.25), 긴 변 108 이하, 정수배에 0.15 안이면 정수 축소. 긴 변으로만 맞추면 납작한 도롱뇽이 작아 보였다. 단계 배율이 없으면 진화형이 1단계와 같은 크기로 나왔다(2026-10-01 시험). 큰 원본은 긴 변 상한에 먼저 걸려 2·3단계 크기가 같아질 수 있다 — 캔버스를 키우기 전엔 남는 한계.

## 애니메이션 — 대기는 움직이고, 큰 동작은 한 줄로 생성한다 (2026-10-01 비교 시험)

대기 4프레임을 네 방식으로 만들어 비교했다(`qa-runs/anim-lab/`, 연속 프레임 사이 바뀐 칸 비율):
고른 도트를 정수 픽셀만 움직임 **14%** · 프레임마다 따로 생성 98% · 2×2 한 장 생성 89% ·
[sprite-gen](https://github.com/aldegad/sprite-gen)(Apache-2.0) 방식 가로 한 줄 생성 58%. 사용자가 「대기는 A, 큰 동작은 sprite-gen 방식」으로 정했다.

- **대기(`anim/idle.ts`)**: 생성하지 않는다. 윗몸(잉크 높이 위 58%)을 1px 내렸다 올리고, 꼬리 띠(앞모습 오른쪽·뒷모습 왼쪽 28%)를 1px 흔들고,
  `motion.flicker: "flame"` 종은 따뜻하고 밝은 색 덩어리 상자 절반을 번갈아 1px 들어 올린다. 0번 = 원본, 발 줄 고정. 대기를 생성하면 1px 숨쉬기보다 그림 흔들림이 크다.
- **큰 동작(`anim/row.ts`)**: 시드 `animation.actions` 의 동작마다 N 프레임을 **한 장에 가로로** 생성한다. 따로 생성하면 매번 다른 생물이 된다.
  - god-tibo 는 참고 그림을 한 장만 받는다 → 칸 안내 첫 칸에 기준 스프라이트를 넣은 한 장으로 합친다. sprite-gen 기본 화풍 문구(치비·마스코트 친화)는 쓰지 않는다.
  - 참고 그림은 **2172×724(3:1)**. 1536×1024 에 네 칸이면 기준을 3배로밖에 못 넣어 생성 블록이 3px 가 되고 격자 추출이 무너졌다(흰 줄·윤곽 소실).
  - 블록 크기는 짐작해서 고른다: 첫 포즈 폭(px) ÷ 기준 잉크 폭(칸), ±30%(`rowBlockHint`). 짐작 없이 고르면 12장 중 5장이 2배 블록을 골라 몸집이 반이 됐다.
  - 줄 전체를 한 번에 도트화(격자·팔레트 공유) → 큰 성분 N 개를 씨앗으로 묶기 → 0번 잉크 폭을 기준 스프라이트 폭에 맞춘 배율을 N 장에 똑같이 → 발 위치를 0번에 맞춰 바닥 정렬.
  - 포즈가 겹친 후보는 「큰 덩어리가 N 개가 아니다」로 떨어진다. 후보 시트는 CSS 로 스트립을 재생한다. 고르는 건 사람.
- 공격·피격 동작 스트립의 엔진 배선은 아직 없다(대기 스트립은 2026-10-15 에 배선됨, 위 「캠페인·전투 배선」). 공격 모션(돌진·넉백·히트스톱)은 엔진이 이미 하므로, 붙일 땐 그 위에 프레임만 바꾼다.

### 공격 방향 계약 (`animation.direction`)

| 면 | 화면 자리 | 공격 방향 (x 오른쪽+, y 아래+) | 피격 밀림 |
|---|---|---|---|
| back (내 몬스터) | 왼쪽 아래 | (+1, −1) 오른쪽 위 | 왼쪽 아래 |
| front (상대) | 오른쪽 위 | (−1, +1) 왼쪽 아래 | 오른쪽 위 |

- 프롬프트가 이 값으로 「상대는 그림의 오른쪽 위에 있다, 그쪽으로만 기운다」 문장을 만든다. 그림은 제자리에서 **기울기만** 하고, 실제 이동은 엔진이 같은 방향으로 한다.
- 엔진: `src/styles/runtime/battle/05-poses-motion.css` 포켓몬 스킨 돌진·넉백을 이 방향으로 고쳤다. 예전엔 옆 구도 부호(내 쪽 −x, 상대 +x)를 그대로 써서 돌진이 상대에게서 **멀어졌다**(2026-10-01 녹화 실측: 공격 순간 내 몬스터 x 257→156).
- 방향 검사(`checkDirection`): 공격 자세는 어느 프레임이든 윗몸 가로 무게중심이 0번보다 공격 방향으로 2칸 이상, 피격은 반대로 2칸 이상 옮겨 가야 한다(경고). 발은 0번에 맞춰 두므로 기울기는 윗몸에서 드러난다.

### 엔진 비트 → 프레임 (`actions.*.keys`)

스트립을 제 시계(frameMs)로 돌리면 덤비는 칸이 착탄보다 먼저 지나간다(120ms 간격이면 3번째 칸이 240ms, 착탄은 접근 비트 끝 ~400ms).
엔진은 비트에 맞춰 칸을 붙든다: `anticipation` = 적 windup·내 접근 비트 앞부분(전진 시작 전, 비트−240ms), `contact` = 전진 시작부터
착탄·정지 끝까지, `recover` = 돌아가기 비트, 맞은 쪽은 `hurt.contact`(넉백 동안) → `hurt.recover`. `anim.json` 각 동작에 `keys` 가 실린다.
2026-10-02 실제 전투 녹화는 이 규칙을 주입 스크립트(`qa-runs/battle-anim3/anim.js`)로 시연했다 — 엔진 배선 전까지 정본은 이 표다.

### 입·손 자리 (`anim.json` 의 `emit`)

발사체가 나가는 자리. `build` 가 면마다 0번 칸에서 `spriteEmitPoint`(`src/battle/pokemonMoveMotion.ts`, 엔진과 같은 함수)로 구해
`emit: { front: {x,y}, back: {x,y} }` 로 적는다 — 내 몬스터(back)는 오른쪽 위, 상대(front)는 왼쪽 아래 방향. 자동 판정이 잎 끝·꼬리 끝을
고르면 시드 `emit`(같은 모양, `SPRITE_CANVAS` 안)이 이긴다. 선례: 리프링(leafling) 뒷모습은 잎 끝이 잡혀 `{x:86,y:61}`(입)로 고쳤다.
`check` 는 emit 3칸 안에 몸이 없으면 잡는다 — 시드 값이면 오류, 자동 값이면 경고.

### 스킬별 공격 = 자세 몇 가지 × 스킬 매핑 (`anim/poses.ts`)

스킬마다 그림을 만들지 않는다. 속성 그림(불꽃·물줄기·잎)은 스킬의 전투 효과 애니메이션(`animationId`)이 그리고, 몬스터 그림은 몸의 자세만 맡는다.

| 자세 (`animation.actions`) | kind | 쓰는 스킬 (`poseForSkill` 기본 규칙) |
|---|---|---|
| `tackle` 웅크렸다 덤빔 | attack | 속성 없는 맞닿는 공격 (공격·몸통박치기·물기) |
| `special` 버티고 입을 벌려 내뿜는 자세 (효과 없이) | attack | 속성이 붙은 공격 (화염·물대포·잎날) |
| `buff` 부풀리고 울부짖음 | self | 자기·아군 대상 |
| `hurt` 움찔 밀림 | hurt | 맞을 때 (스킬 무관) |

스킬에 `battlePose` 가 있으면 규칙보다 우선한다(스킬 스키마에는 아직 없다 — 엔진 배선 때 추가). 종 고유기는 시드에 그 종 전용 자세를 더하는 식으로 늘린다(아직 없음).

## 검사 (`build` · `check`)

| 항목 | 기준 | 수준 |
|---|---|---|
| 캔버스 | 64×64, 바닥 정렬 | 오류 |
| 몸 크기 | 긴 변 56 이내(격자 계약) | 오류 |
| 실루엣 겹침 | 앞모습 둘의 64px 마스크 IoU 0.75 이상 | 경고(`check`) |
| 색 수 | `style.maxColors`(20) 이하 | 오류 |
| 마젠타 기운 점 | 0 | 오류 |
| 윤곽 | 실루엣 가장자리 칸의 85% 이상이 어두운 선 | 경고 |
| 외톨이 점 | 12% 이하 | 경고 |
| 몸집 | √(w·h) ≥ 55 | 경고 |
| 앞·뒤 색 일치 | 뒷모습 색의 앞 팔레트 평균 최근접 거리 ≤ 0.06 | 경고 |
| 대기 프레임 | 0번 = 스프라이트, 발(잉크 맨 아래 줄) 고정, 색 수·마젠타 | 오류 |
| 동작 프레임 | 캔버스·색 수·마젠타 | 오류 |
| 동작 크기·색 | 0번 몸집 ≥ 기준의 85%, 프레임마다 기준 팔레트 거리 ≤ 0.06, 캔버스 밖 잘림 0 | 경고 |

닮은꼴·자세·앞뒤가 같은 생물로 보이는지는 **사람 눈**이다. 실제 전투 화면 캡처로 본다.

## 전투 배치 (`src/harnesses/monster-collect-species/qa/battle-layout.css`, 엔진 미반영)

(옛 112 캔버스 시절 시안) 포켓몬 스킨에서 112 캔버스를 내 몬스터 3배(화면 336)·상대 2배(화면 224) 정수 배율로 그리고, 발판을 같은 배율로 줄이고, 발을 발판 중심에 두고,
상대 숨쉬기 찌그러짐(`battler-breathe`)을 끈다. 2026-10-01 실제 플레이어 화면에 주입해 확인했다(명령 선택 화면만 — 공격·피격·기절·포획 모션은 미확인).
엔진 반영 대상은 `src/styles/runtime/battle/20-pokemon-skin.css`. 주입 캡처는 시안 녹화기(qa-runs/monster-viz/record.mjs, gitignore — `INJECT_CSS`·`OVERRIDES` 환경 변수)로 했다 — 하네스 `qa/` 로 옮기는 건 다음 작업.

## 시험

- 단위 시험: `test/harnesses/monsterCollectSpecies.test.ts` — 가짜 생성 그림(격자 흔들림·경계 번짐·잡음, 마젠타/검정 배경)에서 원래 도트 복원, 실제 실패 그림의 경계 간격 고정 자료(`test/fixtures/harnesses/leafling-back-block-gaps.json`, 예전 반올림 투표는 같은 자료에서 반 크기를 고른다는 것까지 단언), 색 합치기·마젠타 정리·선 우선 축소·몸집·단계 배율·112 캔버스, 검사, 시드 검증, 장르 범위, INDEX 일치, 커밋된 번들 검사, 모래상자 CLI(import→pick→build→check, 커밋 기록 불변).
- 애니메이션 시험(같은 파일 「애니메이션」 묶음): 대기 0번=원본·발 고정·변화량, 대기 검사가 0번 변경·발 이동을 잡는지, 한 줄 참고 그림 크기·첫 칸, 생성 그림 흉내 줄 → 4프레임·같은 폭·바닥 정렬·기준 폭 맞춤, 시드 `animation` 검증, 모래상자 CLI 의 `import --action` → `pick --action` → `build`(anim.json) → `check` → `preview`.
- 노드 쪽 타입: `npx tsc -p src/harnesses/tsconfig.node.json`.
- 2026-10-01 실제 생성 시험(모래상자): 2단계 진화형 「스파키론」(`evolvesFrom: sparkit`)을 시드에 넣고 `front --n 4`(약 3분) → pick → `back --n 3`(약 2분) → pick → `build` → 실제 전투 화면 주입 캡처. 진화형이 같은 계통으로 그려졌고 검사 오류 0. 이 시험에서 단계 배율 누락을 찾아 고쳤다.

- 2026-10-01 애니메이션 시험(모래상자 `qa-runs/harness-anim`): 세 스타터 × 앞·뒤 공격 줄 `--n 2`(12장, 약 3분). 처음 1536×1024 참고 그림에서는 12장 중 5장이 몸집 반, 3장이 흰 줄로 갈라졌다 → 3:1 참고 그림·블록 짐작·좁은 칸 표본 수정 뒤 12장 모두 프레임 나누기 통과, 잘림 0. 남은 경고는 색 거리(어둡게 칠한 후보)와 몸집 85% 미만 1장 — 사람이 거른다.

## 아직 없는 것

- 에디터 화면(도감에서 「새 종 만들기」 후보 카드), 조수 도구 — `entrypoints.editorUi/assistantTool = false`. 조수 장르 안내문(`MONSTER_COLLECT_AUTHORING_GUIDE`)에는 도구가 생긴 뒤에 힌트를 넣는다.
- (배선됨, 2026-10-15) 번들 스프라이트 → 캠페인 종 기록은 위 「캠페인·전투 배선」. 남은 것: 에디터에서 종 그림을 번들로 고르는 화면, `build_monster_game` 이외 프리셋.
- 파티 아이콘·필드 동행 그림.
- 동작 스트립(공격·피격) 의 엔진 배선(전투 명령 단계별 프레임 전환). 대기 스트립은 배선됨.

## 따라다니기 걷기 칩 (2026-10-15)

파티 몬스터를 필드에서 따라다니게 하는 엔진은 이미 있다(`src/project/followers.ts` · `src/player/playSceneFollowers.ts`). 에메랄드 스타일은 종에 `graphic.fieldGraphic.sprite.id` 또는 `graphic.fieldCharsetId` 가 없으면 따라다니기를 건너뛰므로, 하네스가 **걷기 칩**을 대 주는 것이 이 절이다. 전투 앞·뒤 그림과 같은 일반 규칙(종 하드코딩 없음)이다.

- 그림: `src/harnesses/monster-collect-species/field_chip.py`. 고른 앞·뒤 그림을 참고로 보여 주고 Argon(`gemini-4-argon-medium`, `agy`)이 24×32 격자 문자열 9장(down/up/right × 프레임 0·1·2, 왼쪽은 right 거울)을 손으로 적는다. 이미지 생성·합성 코드 없음. 하네스가 규격(발 줄·덩어리·색 16·프레임 간 변경 셀 수)을 검사하고 어기면 이유를 붙여 최대 3번 다시 시킨다. `--base <run>/cand-k` 로 고른 후보의 몸은 두고 걷기만 보강할 수 있다.
- 단계: `draw` → `sheet`(걷기 GIF 8배·1배 실제 크기) → 사람이 `pick`(그림 해시에 묶임, `harness-data/monster-collect-species/field-picks.json` + `field-chips/<종>.png`) → `bake`.
- `bake` 는 칩 8명씩 288×256 시트(`public/assets/harnesses/monster-collect-species/field/chips-<n>.png`, 한 캐릭터 72×128 = 3패턴 × 4방향 위·오른·아래·왼)로 묶고 `field/index.json`(종 → 시트·칸)을 쓴다. **칸 번호는 덧붙이기 전용**이다 — 저장된 프로젝트의 참조가 흔들리지 않게 한 번 준 칸은 바꾸지 않는다. 끝에 `manifest` 를 돌려 `harnessMonsterBundle.json` 에 `fieldSheets` 와 종별 `field {sheet,index}` 를 싣는다.
- 런타임: `harnessMonsterArt.ts` 가 시트를 캐릭터셋 카탈로그(`charsetCatalog.ts`, id `oprn-charset-harness-monster<n>` / 텍스처 `tex_oprn_charset_harness_monster<n>`)에 올리고, 로스터(`roster.ts` `fieldArt`)가 `campaignSpeciesId` 로 이어진 종에 `graphic.fieldGraphic` 을 단다. 칩이 없는 종은 기존대로 기본 몬스터 칩. 해석기·참조 검증·내보내기는 charset 의 일반 경로를 따른다.
- 3/4 관문(object-gate) 영수증 없음 — 몬스터 하네스 경로(생성형 참고 + 격자 손 저작). 사람이 고른 것만 굽는다.
- 15종 전부 칩이 있다(시트 2장, 2026-10-15). 실화면 확인: `scripts/qa/runtime/follower-chip-train.capture.mjs`(출하 플레이어, `buildMonsterFixture.ts` 캠페인 사용) — 종을 6마리씩 열차로 세워 네 방향으로 걷고 맵 이동·비행선 탑승(동료 스프라이트 0)·하차(복귀)를 찍는다. 열차는 세션 followers 를 직접 쓴 디버그 쓰기, 소형선은 육지 이동이 막혀 걸음 뒤 동기화가 안 돌아 비행선으로 시험한다.

## 종 다섯 면 단일 정본 계약 (2026-10-18 — 사용자 「몬스터 하나에 서로 다른 이미지들이 혼재되어 있다. 몬스터 장르 전용 하네싱」)

종 하나는 다섯 면에 나온다: 초상(스타터 카드·도감·파티 상세), 전투 앞모습, 전투 뒷모습, 따라다니기 걷기 칩, 파티 아이콘. 예전에는 면마다 다른 도구가 그림을 정해 한 진화 계통 안에서 1·2단은 하네스 도트, 3단은 `mx_art_*` 다각형(`scripts/content/monster-expedition-art.py`)이었고, 칩이 없는 종은 다른 생물 칩으로 대체됐다.

- **원본 하나:** 앞·뒤는 이 하네스가 고른 그림(ledger), 초상·아이콘은 앞모습 그대로, 칩은 `field_chip.py derive --species <id>` 가 고른 앞(아래·옆)·뒤(위) 그림을 줄이고 앞모습 가장 어두운 색으로 1px 윤곽을 다시 두른 것(모델 없음, 결정적). 앞·뒤를 다시 고르면 칩도 derive → pick → bake 를 다시 한다.
- **캠페인 60종 전부 하네스 종이다.** 시드에 `campaignSpeciesId` 로 이어진다(전설 6종은 `evolvesFrom` 없이 `stage: 3` — 몸집 목표만 3단). `mx_art_*` 는 하네스 종이 없는 다른 캠페인 판본에만 남는다.
- **진화 몸집:** fit 은 단계별 몸집 목표를 앞모습 잉크의 외곽 상자로 맞춘다(`STAGE_SCALE`). 옆으로 넓은 종은 긴 변 상한 56칸에 먼저 걸려 단계마다 같은 크기가 되므로, 다음 단계 디자인 문장에 「더 크고 키가 크다」를 적고 외곽 상자가 앞 단계보다 큰 후보를 고른다.
- **게이트:** `src/project/monsterSpeciesCoherence.ts` `auditMonsterSpeciesCoherence(project, load)` — 면마다 런타임과 같은 해석으로 원본 묶음(`harness:<id>` / `mx_art:<slug>` / `asset:<id>`)을 정하고 막는다: 다섯 면 묶음이 섞임(`monster-surface-mixed`), 기본 칩 대체(`monster-surface-fallback`), 읽을 수 없는 면(`monster-surface-unreadable`), 뒤·칩·아이콘 색이 앞모습 팔레트 밖(`monster-surface-palette`, Lab ΔE), 칩 12칸 잘림·배경 띠·빈 칸(`monster-chip-clipped/background/empty`), 앞·뒤 외톨이 도트·반투명 잔점(`monster-sprite-noise`), 전투 적 그림이 종 앞모습과 다름(`monster-enemy-art`), 계통 안 생성기 혼합(`monster-line-mixed`)·칩 유무 혼합(`monster-line-field`)·외곽 상자 넓이가 늘지 않음(`monster-line-size`)·팔레트 단절(`monster-line-palette`). 칩이 없는 종은 경고(`monster-surface-missing`).
- **배선:** `qa-game check` 가 `scripts/qa-game/lib/monsterCoherence.ts`(pngjs 로더)로 부른다. `--no-visual` 로 끈다. 몬스터 수집 게임(`isDeclaredMonsterGame`)이 아니면 아무것도 하지 않는다.
