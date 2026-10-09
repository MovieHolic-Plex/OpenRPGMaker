# 아군 전투 스프라이트 확장 — 액터 2장 · 포즈 행 · 뒷모습 (구현 계획)

**Goal:** 아군 전투 표현의 세 구멍을 메운다. (A) 시트가 없는 액터 2명에게 전용 시트를 준다. (B) 24칸 중 3칸만 쓰던 시트를 확장해 `defend`/`dead` 에 전용 프레임을 준다. (C) 포켓몬 스킨에서 전 파티가 공유하던 뒷모습 1장을 액터별로 나눈다.

**Architecture:** 기존 자산 파이프라인(`scripts/asset-gen/` → `processSprite` 크로마키 → 48px 축소 → 시트 합성)을 재사용한다. 런타임은 `applyBattlerPose` 의 열 계산을 (열, 행) 테이블 조회로 바꾸는 것 하나만 건드린다. 리소스 등록은 기존 방식대로 `BUILTIN_GENERATED_RESOURCE_URLS` 정적 표에 넣는다.

**Tech Stack:** Vanilla TS, vitest (`npx vitest run test/<파일>`), Playwright (`test/e2e`), Jimp (자산 스크립트), Node ESM `.mjs` 스크립트.

---

## 조사로 확정한 사실 (설계 근거)

이 계획의 모든 결정은 아래 실측에 기댄다. 착수 전 line 번호는 `8eb39340` 기준이므로 앵커 텍스트로 찾을 것.

- **포즈 어휘는 정확히 5개다.** `src/battle/battlePose.ts:4` — `"idle" | "attack" | "hit" | "defend" | "dead"`. cast/victory/item/skill 포즈는 레포에 없다(command kind 로만 존재). 그래서 **8행을 다 채울 이유가 없다** — 5포즈면 2행으로 끝난다.
- **지금 5포즈가 3칸을 공유한다.** `src/player/battleFieldDom.ts:335` — `attack`→열1, `hit`+`dead`→열2, `idle`+`defend`→열0. **Y 는 하드코딩 `0`.** 즉 `defend` 는 idle 그림, `dead` 는 hit 그림이다. B가 메울 구멍은 이 두 개다.
- **RM2003 의 행 의미는 레포에 없다.** 열 기반 의미는 이 프로젝트의 자체 발명이고, `gen-hero-battle-grok.mjs:15-20` 이 "실측" 이라고 명시한다. 외부 정본은 EasyRPG Player 의 `AnimationState` enum(Idle/RightHand/LeftHand/SkillUse/Dead/Damage/BadStatus/Defending/WalkingLeft/WalkingRight/Victory/Item)이고, liblcf `BattlerAnimationPose` 는 `{battler_name, battler_index, animation_type, battle_animation_id}` — **포즈가 행이 아니라 프레임 인덱스를 가리킨다.** 따라서 "행=포즈" 는 스펙 준수가 아니라 우리 선택이며, 포즈→(열,행) 테이블로 두면 나중에 인덱스 authoring 으로 확장할 여지가 남는다.
- **계약 테스트는 행 1~7 을 검사하지 않는다.** `test/heroBattleSheetContract.test.ts:53` 의 `BLEED_GUARD_HEIGHT = 8` 은 행 0 바로 아래 8px 띠만 본다(`:82`). `openwiki/runtime-battle.md:112` 는 "1~7행이 투명한지 검사한다" 고 **틀리게** 적혀 있다. 그리고 이 8px 띠는 행 1 의 상단 8px 과 같은 픽셀이므로 **B와 정면충돌한다** — Task 2-3 에서 교체한다.
- **포켓몬 스킨은 저작 시트를 절대 못 쓴다.** `src/player/battleFieldDom.ts:567` 이 `partyFacing === "front"` 로 게이트한다. 폴백은 `skinPartySpriteUrl`(`:75-81`)의 고정 id `bskin-ally-creature-back` 이고 index 를 무시한다. `partyMax: 1`(`:40`)이라 선두 1명만 그려진다.
- **`battleCharset` 슬라이싱 선언이 미완이다.** `src/assets/resourceSlicing.ts:54-59` 는 셀 크기만 있고 `columns`/`rows`/`count`/`sheetWidth`/`sheetHeight` 가 빠졌다. 이웃 `battleWeapon`(`:60-70`)은 `columns: 3, rows: 8, count: 24` 를 선언한다. 행에 의미가 생기면 이 선언이 정본이어야 한다.
- **적 배틀러 1건이 오배선이다.** `enemy_mine_skel_archer` 의 `monsterResourceId` 가 `generated-enemy-skeleton-01-enemy_extra_105` — 레지스트리에 없는 id 라 정규식 폴백(`generatedAssetResourceResolver.ts:298-307`)에 걸려 legacy **64×64** 로 떨어진다. 나머지 105마리는 384×384. 올바른 대상 `generated-enemy-skeleton-archer` 는 이미 존재한다.

## 백엔드 결정 — grok 확정 (2026-08-29 갱신)

**백엔드는 `grok` 하나다. kaykai 도 DuckCoding 도 쓰지 않는다.** 최초 초안은 "grok 은 인증이 없다(`Not signed in`)" 를 근거로 kaykai 를 밀었는데, **그 진단이 틀렸다**. 토큰은 멀쩡했고 경로만 어긋나 있었다:

- 에이전트 셸의 `HOME` 이 샌드박스 홈(`/home/main/.claude3-home`)으로 바뀌어 있었고, 실제 자격증명은 `/home/main/.grok/auth.json` 에 있었다.
- `os.homedir()` 는 `HOME` 을 따라가고, `os.userInfo().homedir` 는 passwd 항목을 읽는다. 전자를 믿어서 빈 디렉터리를 봤다.
- `gen-hero-battle-grok.mjs` 의 `resolveGrokHome()` 이 `.grok/auth.json` 이 **실제로 있는** 후보를 골라 자식 프로세스의 `HOME` 으로 넘기고, PONG 사전 점검이 미인증이면 프레임 생성 전에 즉시 멈춘다.

**B·C 에 참조 이미지가 필요하다는 판단은 옳았다. 다만 kaykai 의 `reference_b64` 가 아니어도 된다** — grok 은 에이전트라 **파일 읽기 툴로 로컬 이미지를 실제로 본다**(실측: 48px idle 셀을 384px 로 확대한 파일에서 "pointed purple hood … dark purple robe with gold hem trim" 을 정확히 읽었다). 그래서 세션 cwd 에 `reference.png` 를 깔고 그걸 보게 한다.

**참조 유무 실측 (hero-03, 같은 hit 포즈, 48px 결과 기준)**

| | 캐릭터 일치(팔레트) | 포즈 구분(실루엣) |
|---|---|---|
| 출하된 원본 | 80.7% | 49.3% |
| 참조 없음 | 74.7% | — (후드 소실·체형 변형) |
| 참조 + 포즈 무시 지시 | **95.2%** | **58.0%** |

참조만 물리면 캐릭터는 잡히지만 **포즈까지 베낀다**(pose-diff 24.1% — idle 과 거의 동일). 그래서 `REFERENCE` 프롬프트에 "reference.png 의 자세·팔다리·표정은 완전히 무시하고 외형·의상·팔레트만 가져와라" 를 명시했다. 그 문구가 들어가자 포즈 구분이 24.1% → 58.0% 로 올라가면서 캐릭터 일치는 유지됐다. **지금 파이프라인은 출하된 아트를 만든 경로보다 두 지표 모두 낫다.**

일관성은 순서로도 받친다. 인물별로 **anchor(idle)를 먼저** 끝내고 나머지 포즈가 그 원본(1024px)을 참조한다. 인물끼리는 완전 병렬이라 벽시계는 장당 약 1분 × 2단계다(실측: 1프레임 55초, 2프레임 동시 101초).

참조 우선순위: `--reference=<경로>` → 이번 실행의 anchor 원본 → 출하된 시트의 idle 셀(48px 니어리스트 확대). 셋 다 없으면 참조 없이 돈다.

**리스크.**
- 생성 모델은 프레임 일관성을 보장하지 않는다. 참조를 물려도 드리프트가 난다. 그래서 모든 프레임은 **개별 재생성 가능**하게(`--only`/`--poses`/`--tag`) 유지하고, 사람이 눈으로 검수한 뒤 시트에 합성한다.
- 시트는 **세 프레임이 전부 있을 때만** 덮어쓴다(한 열만 새 그림이면 화풍이 섞인다). 실측으로 확인됨 — `--poses=hit` 단독 실행은 `skip sheet` 를 내고 출하된 시트를 건드리지 않았다.
- grok 세션 저장소(`~/.grok/sessions`)가 프레임마다 원본 이미지를 쌓는다(현재 1.4G). 레포 밖이라 커밋에는 영향이 없지만 주기적으로 비워야 한다.
- kaykai 를 쓰지 않으므로 **스프라이트가 사설망 서버로 전송되지 않는다** — 초안의 평문 HTTP·무인증 리스크는 해소됐다. (참고로 그 엔드포인트의 primary engine 은 현재 401 `token_invalidated` 다.)

## Global Constraints

- 단위 테스트: `npx vitest run test/<파일>`. 전체 `npm test`. 타입 `npm run typecheck`.
- **행 0 을 재생성하지 않는다.** 이미 승인된 그림이다. 생성기는 기존 PNG 를 읽어 새 셀만 합성해야 한다(Task 2-1).
- 시트 PNG 는 **항상 144×384** 를 유지한다. `backgroundSize` 산식의 전제다.
- 리소스 id 를 레지스트리에서 **지우지 않는다.** `generatedAssetResourceResolver.ts:42-47` 참조 — 등록을 지우면 그 id 를 쓰는 프로젝트가 역직렬화 자체에서 throw 한다.
- 시트 픽셀이 바뀌면 `oprnGeneratedAssetPlan.json` 의 `sha256` 도 바뀐다. **행 0 을 안 건드려도 행 1 을 추가하면 파일 해시가 바뀐다** — Task 2-5 에서 4장 전부 갱신.
- 중간 산출물은 `.omo/asset-gen-tmp/` (gitignore).

---

## Phase 0 — 이미지 생성 없이 지금 되는 것

생성 백엔드 승인과 무관하게 독립적으로 머지 가능하다.

### Task 0-1: 광산 해골 궁수 배틀러 오배선 수정

**Files:**
- Modify: `src/project/defaults/generatedEnemyRecords.ts` (또는 `enemy_mine_skel_archer` 가 실제로 선언된 곳 — 착수 시 grep 으로 확정)
- Test: `test/generatedEnemyBattlers.test.ts`

`monsterResourceId` 를 `"generated-enemy-skeleton-01-enemy_extra_105"` → `"generated-enemy-skeleton-archer"` 로 바꾼다.

**주의:** 이 파일과 `test/generatedEnemyBattlers.test.ts` 는 **현재 워크트리에 커밋 안 된 수정이 있다**(`git diff --stat` 확인). 착수 전 그 변경의 의도를 먼저 확인하고, 충돌하면 사용자에게 물을 것.

**Verify:** 모든 적 레코드의 `monsterResourceId` 가 legacy `enemy_extra_*` 정규식 폴백에 걸리지 않음을 단정하는 테스트를 추가한다 — 이 부류 회귀를 구조적으로 막는다.

### Task 0-2: `battleCharset` 슬라이싱 선언 완성

**Files:**
- Modify: `src/assets/resourceSlicing.ts:54-59`
- Test: 기존 슬라이싱 테스트가 있으면 그곳, 없으면 `test/resourceSlicing.test.ts` 신규

`battleWeapon` 과 같은 형태로 `columns: 3, rows: 8, count: 24, sheetWidth: 144, sheetHeight: 384` 를 추가한다. 행에 의미가 생기기 전에 규격을 정본화해 둔다.

### Task 0-3: 위키의 잘못된 계약 서술 정정

**Files:**
- Modify: `openwiki/runtime-battle.md:112`

"1~7행이 투명한지를 검사한다" 는 사실과 다르다. 실제로는 행 0 아래 8px 띠만 검사한다. 문장을 실제 검사 범위로 고친다. (Phase 2 에서 이 문단을 다시 쓰지만, Phase 0 만 머지되는 경우에도 문서가 거짓말하지 않게 한다.)

---

## Phase 1 (A) — 성직자·궁수 전용 시트

`actor_cleric` 은 수호자 시트를, `actor_ranger` 은 주인공 시트를 그대로 쓴다. 각각 hero-05 / hero-06 을 만든다. **런타임 코드 변경 0.**

### Task 1-1: 프롬프트 자산 공유 모듈 추출 ~~kaykai 백엔드 생성기 추가~~

**Files:**
- Create: `scripts/asset-gen/battlerPrompt.mjs`
- Modify: `scripts/asset-gen/gen-hero-battle-grok.mjs`

두 번째 백엔드는 만들지 않는다(위 백엔드 결정). 대신 `gen-hero-battle-grok.mjs` 안에 있는 프롬프트 자산을 **공유 모듈로 추출**해, 포즈 행 확장(B)·뒷모습(C) 생성기가 같은 화풍 계약을 재사용하게 한다. 추출 대상:

- `STYLE` / `COMPOSITION` / `BACKGROUND` / `NEGATIVE` / `REFERENCE` — 화풍·배경·금지 사항·참조 규약.
- `HEROES` — 6인 서술(Task 1-2 에서 2인 추가).
- `POSES` — 포즈 서술 + 열/행 좌표(Task 2-1 에서 행 추가).

`gen-hero-battle-grok.mjs` 는 이 모듈을 import 하고, 이미 검증된 자기 로직은 그대로 둔다: `resolveGrokHome()`, PONG 사전 점검, `writeReference()` 우선순위, anchor 우선 2단계 스케줄링, `processSprite(raw, out, 48, Jimp.RESIZE_BEZIER)`(48px 는 20배 이상 축소라 베지어 필수), 프레임 캐시 건너뛰기, 전체 프레임이 찰 때만 시트 합성.

**주의:** 추출은 순수 이동이어야 한다. 문구를 손보면 이미 승인된 4장과 화풍이 어긋난다. 추출 직후 `--only=hero-01 --poses=idle --tag=extract-check` 로 한 장 뽑아 기존과 비교한다.

### Task 1-2: hero-05 / hero-06 캐릭터 정의와 프레임 생성

**Files:**
- Modify: 추출된 공유 `HEROES` 표 (Task 1-1)
- Create: `public/assets/generated/starter/hero-05-battle.png`, `hero-06-battle.png`

성직자·궁수의 `who` 서술을 기존 4인 톤에 맞춰 쓴다(직업이 실루엣·무기로 읽혀야 한다). 성직자는 수호자와, 궁수는 정찰병과 구분되어야 한다 — 각각 판금/가죽이 겹치므로 실루엣 차별화를 프롬프트에 못 박는다. 12프레임이 아니라 **6프레임**(2장 × idle/attack/hit)이다.

신규 캐릭터라 출하된 참조가 없다. 그래서 생성기의 anchor 순서가 그대로 참조 공급원이 된다 — `idle` 이 먼저 나오고, `attack`/`hit` 이 그 1024px 원본을 `reference.png` 로 본다. 즉 `--only=hero-05,hero-06` 를 **한 번에** 돌려야 한다(포즈를 따로 돌리면 anchor 원본이 없어 참조 없이 뽑히고, 실측대로 다른 사람이 나온다).

**검수 게이트:** 시트 합성 전에 6프레임을 사람이 본다. 화풍이 기존 4장과 튀면 프레임 단위로 재생성한다.

### Task 1-3: 리소스 등록

**Files:**
- Modify: `src/assets/generatedAssetResourceResolver.ts` (`:49` 인근)
- Modify: `src/assets/oprnGeneratedAssetPlan.json` (`:180-201` 패턴)

`generated-actor-hero-05-battle` / `-06-battle` → 파일 경로. 플랜에는 `target: "actorBattleCharset"`, `resourceKind: "battleCharset"`, `expectedDimensions {144,384}`, `status: "promoted"`, `sha256`(실제 파일 해시), `provenance.promptVersion` 을 넣는다.

### Task 1-4: 액터 레코드 재배선

**Files:**
- Modify: `src/project/defaults/defaultDatabasePartyRecords.ts:116-133, 137, 157`

`actor_cleric` → hero-05, `actor_ranger` → hero-06. **`battleCharacterResourceId` 는 액터당 두 곳에 있다** — `createActorRecord` 호출 인자(`:118` 패턴)와 외부 리터럴(`:126` 패턴). 둘 다 고친다.

### Task 1-5: 테스트 갱신

**Files:**
- Modify: `test/heroBattleSheetContract.test.ts:55` — `SHEETS` 에 `hero-05`, `hero-06` 추가
- Modify: `test/generatedAssetManifest.test.ts:13` — `actorBattleCharset` 하드 카운트 4 → 6
- Modify: `test/generatedAssetManifest.test.ts:77-82` — `bundled-charset-extract-v1` id 정렬 배열
- Modify: `test/e2e/oprn-generated-battle-assets.spec.ts:15-18` — `BATTLE_ASSETS`
- Modify: `test/defaultDatabase.test.ts:79-99` — 스타터 4인 단정은 그대로(스타터는 안 바뀐다). cleric/ranger 의 새 시트 id 를 단정하는 케이스를 추가한다.

`test/e2e/oprn-battle-asset-equivalence.spec.ts:22-25` 와 `test/e2e/battleReferenceProject.ts:22-35` 는 **스타터 파티를 안 바꾸므로 손대지 않는다.**

---

## Phase 2 (B) — `defend` / `dead` 전용 프레임

5포즈가 3칸을 공유하는 걸 5칸으로 푼다. 행 1 을 쓴다.

### 확정할 프레임 표

```
(행 0, 열 0) idle      (행 0, 열 1) attack    (행 0, 열 2) hit
(행 1, 열 0) defend    (행 1, 열 1) dead      (행 1, 열 2) 예약(victory)
행 2~7                 투명 유지
```

행 0 을 그대로 두는 게 핵심이다 — 기존 4장의 승인된 그림이 유효하고, 액터당 **2프레임만** 새로 만든다.

### Task 2-1: 생성기가 기존 시트에 병합하게 만든다

**Files:**
- Modify: `scripts/asset-gen/genBattlerKaykai.mjs` (Task 1-1 산출물)

현재 `composeSheet` 는 항상 빈 시트를 새로 만들고 `sheet.composite(frame, col * CELL, 0)` — Y 하드코딩 0. 두 가지를 고친다:

- 출력 PNG 가 이미 있으면 **읽어서 그 위에 합성한다**(없으면 빈 시트). `--fresh` 로 전체 재생성 강제.
- 포즈 정의에 `row` 를 추가하고 `composite(frame, col * CELL, row * CELL)`.

### Task 2-2: defend / dead 프레임 12장 생성

**Files:**
- Modify: 공유 `POSES` 표 — `defend`(행1 열0), `dead`(행1 열1) 추가
- Modify: `public/assets/generated/starter/hero-0{1..6}-battle.png` (행 1 만)

포즈 서술:
- `defend` — 왼쪽을 향한 채 몸을 낮추고 방패/무기를 앞으로 세워 막는 자세. idle 과 실루엣이 명확히 달라야 한다(계약 테스트가 열 간 차이를 재므로).
- `dead` — 쓰러진/무릎 꿇은 전투불능. hit(비틀거림)과 구분되어야 한다.

**참조 이미지:** 생성기의 `writeReference()` 가 자동으로 처리한다 — 출하된 시트의 **idle 셀(48×48)을 니어리스트로 384px 로 확대**해 세션 cwd 의 `reference.png` 로 깐다. 해상도는 낮지만 grok 이 그 파일에서 후드·의상·팔레트를 정확히 읽어냈고(실측), 목표도 48px 이라 손실이 실질적으로 없다. 원본 1024px 은 `.omo`(gitignore)라 트리에 없으므로 시트가 유일한 정본이다.

defend/dead 는 새 행이라 이번 실행에 anchor 가 없다 → 우선순위 3번(출하 시트 idle 셀)이 자동으로 걸린다. 이게 정확히 원하는 동작이다: **이미 승인된 row 0 의 디자인**에 새 프레임을 맞춰야 한다.

**검수 게이트:** 12프레임 사람 검수. 같은 캐릭터로 안 보이면 해당 프레임만 재생성.

### Task 2-3: 계약 테스트 재작성 — 8px 띠 가드 교체

**Files:**
- Modify: `test/heroBattleSheetContract.test.ts`

현행 `BLEED_GUARD_HEIGHT = 8` 가드(`:53`, `:82`)는 행 1 상단 8px 을 투명하라고 요구하므로 **행 1 을 쓰면 반드시 깨진다.** 그 가드는 Y 가 항상 0이라는 전제의 구조적 방어선이었다. 대체물은 더 강하게 만든다:

- 행 1 의 열 0/1 이 각각 `MIN_OPAQUE_PIXELS` 이상 (defend/dead 가 비면 방어·전투불능이 화면에서 사라진다)
- 행 1 열 0/1 이 서로, 그리고 각자의 행 0 대응 칸과 `MIN_POSE_DIFF_RATIO` 이상 다르다 (defend≠idle, dead≠hit — 이게 이 Phase 의 존재 이유다)
- **행 2~7 전체가 완전히 투명** (지금은 아예 검사되지 않는 범위다 — 순증)
- 기존 5개 단정(144×384, 행 0 3칸 채움, 열 간 차이, 최대 실루엣 ≥90%)은 유지

### Task 2-4: 렌더러를 (열, 행) 테이블로 바꾼다

**Files:**
- Modify: `src/player/battleFieldDom.ts:322-338` (`applyBattlerPose`)
- Modify: `src/battle/battlePose.ts` — 프레임 표를 여기 두고 런타임·테스트·생성기가 한 정의를 보게 한다
- Test: `test/battlerPoseFrame.test.ts` (신규)

`const col = pose === "attack" ? 1 : ...` 를 `POSE_FRAME: Record<BattleBattlerPose, {col: number; row: number}>` 조회로 교체하고 `backgroundPosition = -${col*frameW}px -${row*frameH}px`. `frameH` 는 `frameW` 와 같은 방식으로 인라인 커스텀 프로퍼티에서 읽는다.

신규 단위 테스트가 5포즈 각각의 `backgroundPosition` 문자열을 정확히 단정한다 — 8px 띠 가드가 지켰던 오슬라이스 회귀를 픽셀이 아니라 산식에서 막는다.

**순서 주의:** Task 2-2(그림)가 먼저 들어가야 한다. 렌더러를 먼저 뒤집으면 행 1 이 투명한 기존 시트에서 **방어·전투불능 시 아군이 사라진다.**

### Task 2-5: 플랜 해시와 문서 갱신

**Files:**
- Modify: `src/assets/oprnGeneratedAssetPlan.json` — hero-01~06 전부 `sha256` 재계산 (행 1 추가로 파일이 바뀐다)
- Modify: `openwiki/runtime-battle.md:109-113` — 프레임 표, Y 가 이제 움직인다는 사실, 새 계약 테스트 범위
- Modify: `scripts/asset-gen/gen-hero-battle-grok.mjs:15-20` 헤더 주석 — 행 규약이 바뀌었음을 반영 (스크립트를 남겨두므로 주석이 거짓말하면 안 된다)

---

## Phase 3 (C) — 액터별 뒷모습

포켓몬 스킨이 전 파티에 `ally-creature-back.png`(보라색 생물) 한 장을 쓴다. 액터별로 나눈다.

### Task 3-1: 뒷모습 6장 생성

**Files:**
- Create: ~~`public/assets/generated/starter/hero-0{1..6}-back.png`~~ → **실제 경로 `public/assets/generated/battle-skins/sprites/hero-0{1..6}-back.png`** (712×712, 기존 `ally-creature-back.png` 규격에 맞춤)

**경로 변경 이유(구현 중 결정):** 대체 대상인 `ally-creature-back.png` 와 나머지 `bskin-*` 스프라이트가 전부 `battle-skins/sprites/` 에 있다. `starter/` 는 3×8 전투 시트·아이콘·얼굴이 사는 곳이라 규격이 다른 통짜 이미지를 섞으면 디렉터리가 규격을 말해주지 못한다. Task 3-2 가 리졸버의 `bskin-*` 블록 바로 아래에 등록하는 것과도 맞는다.

각 액터의 **idle 셀을 확대한 `reference.png`** 를 물리고(위와 같은 `writeReference()` 경로), "같은 캐릭터를 뒤에서 본 모습" 으로 다시 그린다. `gen-ally-back-34-mdc.mjs` 가 검증한 프롬프트 구조(참조 서술 + 회전 지시 + 팔레트 동일성 강제 + 마젠타 배경)를 그대로 따른다.

**주의:** `REFERENCE` 의 "자세를 무시하라" 문구는 뒷모습에는 과하다 — 여기서 바꿀 건 **시점**이고 자세는 idle 그대로 유지하는 게 맞다. C 전용 참조 문구를 따로 둔다(자세 유지 + 시점만 180° 회전). 포켓몬 스킨은 `scaleX(-1)` 로 뒤집혀 렌더되므로(`18-pokemon-layout-redesign.css:46-53`) 좌우 방향 기준을 프롬프트에 명시한다.

### Task 3-2: 리소스 등록 (플랜 없이 리졸버만)

**Files:**
- Modify: `src/assets/generatedAssetResourceResolver.ts` (`:224-228` 인근)

`generated-actor-hero-0N-back` → 파일 경로 6건. **`oprnGeneratedAssetPlan.json` 에는 넣지 않는다** — 기존 `bskin-*` 스프라이트가 전부 리졸버 전용이고(플랜에 없다), 이건 3×8 `battleCharset` 이 아니라 통짜 이미지다. 덕분에 `generatedAssetManifest.test.ts` 카운트도 안 건드린다.

### Task 3-3: 뒷모습 선택 로직

**Files:**
- Modify: `src/player/battleFieldDom.ts:75-81` (`skinPartySpriteUrl`), `:530-604` (`actorNode`)
- Test: `test/battleFieldAllySprite.test.ts` (신규 또는 기존 해당 테스트)

우선순위를 이렇게 만든다:

1. `actor.speciesId` 몬스터 그래픽 — **기존 그대로 최우선** (변경 없음)
2. `partyFacing === "front"` → 저작 시트 (기존 그대로)
3. **신규:** `partyFacing === "back"` 이고 `generated-actor-<slug>-back` 가 해석되면 그것
4. 기존 `bskin-*` 공유 폴백 (해석 실패 시 — 사용자 저작 액터는 뒷모습이 없으므로 이 경로가 계속 필요하다)

`skinPartySpriteUrl(index, facing)` 이 액터를 못 보므로 시그니처를 액터를 받게 바꾼다. `battleCharacterResourceId` 에서 slug 를 파생할지, 별도 id 규약을 둘지는 구현 시 결정 — **파생을 우선**한다(스키마 변경 0, 에디터 UI 변경 0, 픽스처 변경 0).

**범위 밖(별도 결정):** 포켓몬 스킨 `partyMax: 1`(`battleFieldDom.ts:40`). 액터별 뒷모습이 생겨도 선두 1명만 보인다. 이걸 올리는 건 스킨 레이아웃·HUD 재설계라 이 계획에 넣지 않는다. 올릴지 여부는 3장이 들어간 뒤 눈으로 보고 판단하자.

---

## Verification

- `npm run typecheck`
- `npx vitest run test/heroBattleSheetContract.test.ts test/generatedAssetManifest.test.ts test/defaultDatabase.test.ts test/battlerPoseFrame.test.ts`
- `npm test` (전체)
- E2E: `test/e2e/oprn-generated-battle-assets.spec.ts`, `oprn-battle-asset-equivalence.spec.ts`
- **육안 증거:** `node scripts/runtime-qa.mjs --scenario battle` 로 before/after 스크린샷. Phase 2 는 방어·전투불능 상태를 실제로 찍어야 의미가 있다 — 시나리오가 그 상태를 안 만들면 `scripts/qa/runtime/battle.scenario.mjs` 에 추가한다.
- Phase 3 은 포켓몬 스킨으로 전환한 스크린샷이 필요하다(`system.battleUiStyle`).

## 열린 결정

1. ~~**백엔드**~~ — **해결됐다(2026-08-29).** grok 단독으로 A·B·C 전부 가능하다. 인증은 `HOME` 문제였고 고쳤으며, 참조 이미지는 grok 의 파일 읽기 툴로 대체된다. 실측 지표는 위 백엔드 절의 표에 있다.
2. **행 1 열 2** — `victory` 로 예약해 두되 이번엔 비운다. 포즈 union 에 `victory` 를 추가하는 건 전투 종료 연출까지 손대는 별개 작업이다.
3. **Phase 순서** — 0 → 1 → 2 → 3 을 권한다. 0은 독립, 1은 런타임 무변경, 2는 렌더러 변경, 3은 선택 로직 변경으로 위험이 단조 증가한다. 각 Phase 를 개별 커밋/PR 로 끊는 게 롤백에 유리하다.
