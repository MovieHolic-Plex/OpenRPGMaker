> 저장소 전환 안내(2026-09-21): 아래 옛 원격 DB·설정·명령은 과거 기록이다. 현재 저장·이관 지침은 [프로젝트 저장 전환](storage-retirement.md)과 AGENTS를 따른다.

## 포켓몬 참고 스킨과 실제 뒷모습 (2026-09-20)

- `20-pokemon-skin.css`의 Reference 블록은 민트 줄무늬 필드, 타원 발판, 좌상 적/우하 아군 상태창, 2×2 색상 명령창을 소유한다. 몬스터 루트만 `.battle-pokemon-root`로 표시해 일반 액터 명령과 강제 교체의 스크롤 계약을 보존한다.
- 루트 명령 순서는 싸운다/가방/몬스터/도망간다이며 레벨·체력·기술 횟수와 질문을 한글로 표시한다. 타입 배지는 실제 종족과 원소 이름에서만 만든다. 풀·독·벌레는 코드 기반 픽셀 아이콘, 나머지는 원소 이름 첫 글자를 쓰며 한글 접근성 이름을 유지한다.
- 포켓몬 기본 배경은 스킨 배경으로 해석한다. 명시적 전투/부대/지형 배경의 우선순위는 유지한다.
- `MonsterSpeciesGraphic.backResourceId`가 있고 파티 방향이 back일 때 실제 뒷모습을 표시하며 반전하지 않는다. 없으면 기존 정면 리소스 fallback을 유지한다. 기본 스킨 배틀러 별칭은 에디터 카탈로그의 모슬링/라르베아를 사용한다. 후면 자산이 없는 아군은 기존 정면 그림의 방향을 유지하고, 후면처럼 보이려는 강제 1.85배 확대/반전을 하지 않는다. 저작된 종족 그래픽은 임의 교체하지 않는다.
- 출하 player 브라우저 관측은 `scripts/qa/runtime/pokemon-reference-fixture.mts`와 `pokemon-reference.probe.mjs`. 임시 계약 fixture이며 저장되는 데모 콘텐츠가 아니다. 증거/제약은 `docs/reviews/2026-09-20-pokemon-reference.md`.

# Runtime Battle Behavior

## 도트 측면 전투 스킨 retro2003 (2026-09-28)

13번째 스킨. 자료집 → 시스템 → 전투 UI 스타일 「레트로 2003 · 측면 도트 전투 (기본)」(드롭다운 첫 번째), AI `set_project_settings battle.uiStyle: "retro2003"`.
규칙 엔진은 건드리지 않는다 — 표현만이고 `battleFlow: "gauge"` 와 함께 쓰면 시간 게이지 전투가 된다. 기존 미설정 문서는 `resolveSkinId(undefined)` / `DEFAULT_BATTLE_SKIN_ID`의 rm2000 호환값을 유지한다. 새 프로젝트·템플릿의 `defaultSystem(true)`과 새 데모 생성은 retro2003을 명시하며 정규화에서도 생략하지 않는다. v1/v2 이관의 인자 없는 `defaultSystem()`은 스킨을 추가하지 않아 옛 화면을 보존한다
(모션 CSS는 retro2003 스코프, 확장 시트의 정수 배율 규칙은 그 시트를 쓰는 측면 스킨 공통).

- **레지스트리 필드 두 개**(`src/battle/skins/types.ts`): `motionStyle: "retro"` 가 연출을, `scenery: "layered"` 가 겹 배경을 켠다. 다른 스킨이 같은 연출을 원하면 이 값만 붙이면 된다(CSS 스코프는 스킨 id 라 그 CSS 도 넓혀야 한다).
- **창·HUD** `battle-skins/_retro2003.css`: 청색 세로 그라데이션 창 + 2px 각진 베벨, 도트 글꼴(`--runtime-pixel-font`), 얼굴 없이 이름·HP·MP·ATB 줄, 텍스트 명령 목록과 맥동 막대 커서, 위쪽 한 줄 메시지, 대상 선택은 ▼ 손가락 커서. HUD 128px, 무대 상단 inset 48px.
  재생 상태 칩은 메시지 창(최대 두 줄) 아래 `top: 84px` 에 둔다 — 52px 에서는 둘째 줄 위에 얹혔다(프레임 실측).
- **배치** `battlerPlacements.ts` `RETRO_SIDEVIEW`: 적은 오른쪽(x 192~288, 한 마리 240, 발 y 118~140), 아군은 왼쪽 `(124-30i, 82+20i)` 사선 계단. 확장 아군 시트는 48px 셀을 BATTLE_ASSET_PIXEL_SCALE(2)로 한 번 확대해 96px로 그린다. 스킨의 1.25·2/3 배율을 해제하고 오른쪽 보기 `scaleX(-1)`만 적용한다. 피격 방향은 아군 -x·적 +x, 전진은 아군 +x·적 -x다. 원본 드래곤은 왼쪽 보기, 슬라임은 정면이라 적 그림은 추가로 뒤집지 않는다.
  수동 트룹 좌표는 이 스킨에서만 접지 구간으로 접고(`resolveSkinEnemyPosition`), 접은 결과가 뭉치면 트룹 전체를 자동 진형으로 세운다. `battleEnemyFeetRatios.json` 의 retro2003 항목은 아직 rm2003 사본이다 — 감독 실측으로 갱신할 것.
- **걷기 칩 전투 카탈로그** `src/assets/charsetBattlers.ts`: Actor1~4 × characterIndex 0~7 = 32개 `charset-battler-actorN-k`. 그림은 `assets/generated/charset-battlers/actorN-k.png`(144×384), 피커 이름은 `charsetSemantics`의 「걷기 칩 전투 · 이름」이다.
  - `partyFacing: front`에서는 명시한 사용자 시트가 먼저다. 옛 `hero`/`generated-actor-hero-*` 또는 미설정 시트는 걷기 칩+index(미설정 0)로 유도한다. retro2003은 대응 칩이 없어도 옛 AI 영웅 시트를 표시하지 않는다. 다른 스킨은 대응 칩이 없을 때 기존 폴백을 유지한다.
  - 스냅샷의 `characterResourceId`·`characterIndex`는 표시 전용이다. 내보내기도 같은 선택기로 예비 액터까지 유도 시트와 `assets/easyrpg/AUTHORS.md`를 포함한다.
  - 통합 주의: 별도 저작 도구 시드 `src/editor/tools/emptyProject.ts`는 이 작업의 쓰기 범위 밖이라 인자 없는 호출을 유지한다. 이 새 생성 경로도 레트로 기본값을 쓰려면 감독자가 `defaultSystem(true)`로 연결해야 한다. `skyStairGame.ts`의 명시적 rm2000 데모 설정은 그대로다.
  - 기본 6명은 actor1-0, actor2-0, actor3-0, actor4-0, actor1-7(성직자), actor2-3(궁수). 성직자·궁수의 걷기 칩 index도 7·3으로 맞춘다.
  - `battlePose.ts`의 `EXTENDED_POSE_FRAME` 24개는 `scripts/asset-gen/charset-battler/cb_lib.py`의 POSES와 정확히 짝이다. 기존 POSE_FRAME·VICTORY_POSE_FRAME은 보존한다.
  - `data-battler-extended="true"`인 노드는 고해상도 짝·idle 스트립을 쓰지 않는다. pixelated + 정수 배율이며 대기는 CSS 1px 숨쉬기만 한다.
- **진입** 전환 `shatter-2003`(흰 번쩍임 두 번 → 가로 줄무늬가 번갈아 좌우로 미끄러지며 닫힘), `_transitions.css`.
- **겹 배경** `src/assets/battleSceneryCatalog.ts` + `src/player/battleScenery.ts` + `battle/26-battle-scenery.css`.
  그림: `public/assets/generated/battle-scenery/<plains|forest|cave|snow|desert>/{sky,far,mid,ground}.png`(640×360, sky 만 불투명, 도트 2배 nearest, ≤48색, 알파 0/255).
  재생성: `scripts/asset-gen/gen-battle-scenery.mjs`(원화 source.png·prompts 는 같은 폴더). 리소스 id `battle-scenery-<biome>` 은 배경 피커(`resourceOptions.matchesGeneratedKind` backdrop)에 뜬다.
  - 지형 결정 `resolveSceneryBiome`: 명시 `battle-scenery-*` → 알려진 배경 id 매핑(숲 레퍼런스→forest, 얼음→snow, 모래→desert, 하늘 파노라마·스킨 기본 배경→plains) → 지형 이름 낱말 → 기후 snow → 던전/동굴/실내 타일셋 → plains.
    **모르는 id(사용자가 올린 배경)는 undefined** 를 돌려 그 그림을 그대로 두고 앰비언트만 얹는다.
  - 네 장을 다 읽은 뒤에만 레이어를 붙인다(`data-layers="ready"`). 하나라도 실패하면 기존 단일 배경(`fallback`).
  - 움직임: 구름 120s 흐름, far/mid 시차 흔들림, 카메라 10s 숨쉬기, 지형별 입자 캔버스 한 장(rAF 루프 1개 — 숨김 탭·노드 제거·감속 모드에서 멈춤/해제), 숲·초원 빛줄기, 동굴 비네트, 인트로 시차 슬라이드, 타격 흔들림에 레이어별 시차.
  - 필드 스냅샷 배경(`system.battleBackdrop: "field"`)·onField 전투에서는 켜지 않는다.
  - 내보내기: 스킨이 layered 면 20장 전부(약 1.3MB)를 ZIP 에 싣는다(`webExportAssets.ts`).
- **연출** `src/player/battleRetroMotion.ts` + `battle/27-retro-motion.css`. 루트 `data-battle-motion="retro"`. 공용 `applyActionMotion` 은 이 스킨에서 즉시 돌아간다.
  - 바깥 배틀러 노드의 개별 `translate` 속성이 이동을, 안쪽 스프라이트가 피격 진동(`vibrateStruck`)을 갖는다 — 둘을 같은 요소에 걸면 서로 덮는다.
  - 확장 아군 통상 공격: approach 동안 +72px와 walk_a→walk_b→walk_c→walk_b(약 90ms), impact의 0/30/65%에서 attack_windup→attack_strike→attack, recover의 0/18/86%에서 attack_follow→evade→idle. 스킬은 cast_charge→cast_raise→cast_release, limitSkill 또는 power≥100은 착탄 때 skill. 아이템은 item, 방어는 defend 유지. 옛 시트는 기존 6포즈 분기를 유지한다.
  - 명령 입력 중 아군은 +16px에서 idle. 피격은 hit/방어 중 guard_hit, 빗나감은 evade, HP≤25% 대기는 weak. 쓰러짐은 dying→dead(160ms), 표시 원장의 부활은 revive→idle(260ms). 승리 확정(`onResultPending`) 뒤 victory↔victory_b를 260ms마다 교대한다. `data-battle-pose-frame`은 실제 셀 id, `data-battle-pose`는 CSS 의미 포즈다.
  - 적: windup 비트에 흰 실루엣 두 번 번쩍, impact 에 10px 튐. 격파는 붉게 물들며 가로줄로 지워지는 500ms 소멸이 기존 파편·분해를 대신한다. 피해 숫자는 도트 글꼴(회복 초록, 급소 노랑)로 튀었다 한 번 튕긴다.
  - 시퀀서의 onTimelineEntry가 소비 중인 엔트리를 모션에 넘긴다. 마지막 결과 스냅샷은 이미 다음 행동일 수 있다. 칸 타이머는 scheduleBattleTimer로 장면 수명을 따르며, 비트 세대로 오래된 콜백을 버리고 배속을 반영한 실제 비트 길이 안에서만 움직인다.
  - 감속 모드: 걷기·점프·번쩍임·승리 교대를 끄고 비트별 대표 칸만 남긴다.
- **검증 경로** `node scripts/runtime-qa.mjs --scenario retro2003`(진입·명령·공격·자동 전투 승리, 픽스처는 데모 v3 를 retro2003 + gauge 로 가공해 실행 때 만든다)
  와 `node scripts/qa/runtime/retro2003-frames.probe.mjs`(아군 공격·적 공격·승리 구간을 목표 100ms 간격 16장 + DOM 계측 JSON + 콘택트 시트, `verify-shots/runtime-qa/retro2003-frames/`).
  `pose-events.json`은 MutationObserver로 실제 칸 변화를 기록해 120ms 비트 안의 칸들이 PNG 사이에 빠지는 것을 보완한다.
  2026-09-28 cb-runtime 워크트리: 타입 검사 1회 exit 0, QA 1회 7비트·프레임 프로브 2회 각 12판정 통과, 런타임 오류 0. 기준선 그림으로 걷기 순서·공격 순서·승리 교대·아군 왼쪽·HUD 위 발 위치를 확인했다. 1024×768에서 셀 DOM 실측 144px = 논리96px×무대1.5, 그림은 pixelated·행렬 scaleX(-1)이다. 실제 PNG 간격은 부하에 따라 약 120~350ms였으며 정밀 순서는 pose-events를 함께 본다. 스킬 영창과 0 피해의 guard_hit→defend 복귀도 원장·프레임에 찍혔지만 아이템·빈사·KO·부활·감속 모드는 이 시나리오의 실플레이 범위 밖이다.
  프로브는 키보드로만 입력한다 — 명령 버튼은 포인터를 통과시켜 `click()` 이 30초 뒤 실패한다(실측).

## 타격감 층 (2026-09-25)

사용자 신고 「게임적인 느낌이 거의 안 든다, 타격감이 없다」. 출하 player 녹화로 원인을 쟀다:
히트스톱은 무대 1.2% 맥동뿐 아무것도 멈추지 않았고, 30% 미만 피해는 흔들림 0px, 필드 플래시는
34% 흰 막 320ms ease-out(안개), 피해 숫자는 크기 고정 0.9초 부유, 아군 전진은 130ms 에 도착해
340ms 서 있다가 맞혔다. 부품은 있었고 **수치와 시간 구조**가 문제였다.

- CSS 소유: `src/styles/runtime/battle/22-hit-feel.css`. `runtime/index.css` 에서 **스킨 시트 뒤**(`_windowskin.css` 다음)
  에 로드된다 — 같은 특정도의 스킨 규칙을 이긴다. 순서는 `test/playerRuntimeCss.test.ts` 가 고정한다.
- **2026-09-27 보정 (프레임 실측, `~/claude-viz/combat-hit-feel.html`):** 팝업이 히트스톱에 멈춰 opacity 0 인 채로 있어 숫자가
  착탄 234~333ms 뒤에야 떴다 → 팝업은 정지 대상에서 빼고 0% 프레임부터 불투명(1~9ms). 점멸은 visibility → opacity 0.38
  (적이 두 프레임 사라졌다). 필드 흰 막 34/50% → 16/30%. 플래시·흔들림·펀치는 다음 rAF 가 아니라 착탄 프레임에
  동기로 붙는다(리플로우로 재시작). 세기표 2/5/8/12px, 통상 리듬 50ms×3. `BATTLE_ACTING_MS` 470→400,
  `BATTLE_IMPACT_MS` 430→400. 아래 항목의 옛 수치는 이 줄이 이긴다.
- **진짜 히트스톱:** `.battle-hit-stop` 동안 배틀러·파티 행 애니메이션을 `animation-play-state: paused` 로 멈춘다.
  흔들림(`.battle-field` 애니메이션)과 필드 플래시는 계속 돈다. 맞은 쪽 이미지는 흰 실루엣(`!important` —
  분해·기절 키프레임과 스킨 filter transition 을 이겨야 한다). 파일 **맨 끝**에 둔다: 이 파일의 다른 `animation` 단축
  속성이 play-state 를 running 으로 되돌린다. 정지 길이는 기존 시퀀서 비트(110ms × weight) 그대로다.
- **점멸:** 정지가 풀리는 순간(`battleDom.onHitFeel(false)`) `blinkBattlerNode` 가 `battle-hit-blink-off` 를 55ms 간격 3회 토글.
  visibility 라 idle·숨쉬기 애니메이션 슬롯을 건드리지 않는다. 격파 대상·reduced-motion 은 건너뛴다.
- **흔들림은 자기 클래스:** `battleJuice.flashBattleField` 는 `battle-hit-shake` + `--battle-hit-shake-*` 를 쓴다.
  스킬 애니메이션 층(`battleAnimationDom.applyTimingEffects`)이 `battle-screen-shake`·`--battle-shake-*` 를 프레임마다
  다시 쓰고 지워서, 같은 이름이면 타격 흔들림이 착탄 직후 사라졌다(실측). 세기표 `HIT_INTENSITY_STYLE.shakePx` 는
  2/3/7/11(graze→crushing), 리듬 `SHAKE_RHYTHM` 은 60ms×2 … 80ms×4. 포켓몬은 흔들지 않는다.
- **하드 플래시:** `battle-flash-snap`(45% 유지 후 끊김, 130/190ms). 아군 피격은 `flashBattleField(..., { hurt: true })` →
  `battle-flash-hurt` 붉은 비네트. 포켓몬은 필드 플래시를 끈다(적 공격 때 회색 막의 원인).
- **숫자:** `battle-damage-bounce`(튀어 올라 떨어져 한 번 튕김). 크기는 `--pop-scale` = 노드의 `data-hit-intensity`
  (0.85/1/1.3/1.6, `showDamageFeedback`), 급소 ×1.2. 파티 카드 팝업·빗나감·회복·방어는 옛 연출.
- **명중 파편:** `spawnHitSparks(node, intensity)` 5~12개, 막타는 격파 조각이 대신한다. 포켓몬·reduced-motion 숨김.
- **예비동작:** `applyActionMotion` 이 사용자 노드에 `data-motion-phase`(= 비트 kind)와 `--motion-beat-ms` 를 심고,
  approach 의 lunge 는 `delay = 비트 − 240ms`, back-in 곡선으로 비트 끝에 도착한다. impact 의 lunge(적 내리찍기)는 60ms.
- **공격자 표시(정면):** 아군을 그리지 않는 스킨은 행동 아군의 파티 행에 `is-acting`(앞으로 나옴·강조).
- **HP 잔상(유리 창):** `.battle-stat-bar-hp::after` 가 같은 `--battle-stat` 폭으로 360ms 뒤 440ms 따라 빠진다. 채움은 90ms.
  포켓몬 HP 바는 `::after` 가 「체력」 라벨이라 잔상 대신 620ms 로 눈에 보이게 줄어든다.
- **포켓몬 기절:** 흐려지는 대신 `pkmn-battler-sink`(translate 100% + 아래쪽 clip)로 발판 아래로 꺼진다.
- **타격감 프리셋 (2026-09-27):** `system.battleHitFeel` = `impact`(묵직하게, 기본·JSON 생략) | `light`(가볍게 = 이 날 이전 연출) |
  `calm`(차분하게). 정본 `src/project/battleHitFeel.ts`, 자료집 시스템 → 시작 설정 → 전투 설정 `db-field-system-battle-hit-feel`,
  AI `set_project_settings battle.hitFeel`. 루트에 `data-battle-hit-feel-preset` 를 찍는다 — `data-battle-hit-feel` 은 히트스톱 중
  여부(true/false)로 QA 스펙이 이미 읽으므로 이름을 나눴다. impact 의 JS 층은 `battleHitFeelDom.ts`:
  아군 피격 흔들림 바닥 heavy(`hurtShakeIntensity`, 514 HP 중 2 피해도 1.2px → 7px), 히트스톱 중 맞은 스프라이트
  감쇠 진동(`vibrateStruck` — WAAPI 로 **`translate` 속성만**, 정지 CSS 의 paused animation · 넓백 transform 과 안 겹침),
  평타 착탄 `SWING_LEAD_MS`(160) 전 베기 궤적 `.battle-slash-trail` + 휘두름 소리(명령 확정 순간에서 옮김, 스킬은 그대로),
  타격음 아래 합성 저음 `battleSfx("thud")`. CSS(22-hit-feel.css 끝): 파티 행 9px 흔들림·틴트 85%·얼굴 움찔,
  아군 피해 숫자 28px(카드 `overflow` 를 피격 중에만 visible), 방향 있는 카메라 킥(`translate: 0 -9px`, 펀치와 같은 타이머).
  calm 은 무대 흔들림(타격·스킬 모두)·필드 번쩍임·펀치·파편·파티 행 흔들림을 끄고 숫자·HP·점멸은 둔다.
  근거·실측: `~/claude-viz/hit-feel-lab.html`, `output/combat-qa/hitfeel2-{impact,light,calm}/timeline2.json`.
  테스트 `test/battleHitFeelPreset.test.ts`.
- 함정: 헤드리스·고부하에서는 rAF 가 수백 ms 늦어 juice·플래시 클래스가 정지가 끝난 뒤 붙는다(실측 272ms).
  정지 중 상태를 잴 때는 스크린샷이 아니라 동기 `getComputedStyle`·MutationObserver 로 잰다. transition 이 걸린 속성은
  동기 계산값이 **시작값**으로 읽힌다.
- 남은 것: 소리 층(찰칵+쿵 시차·음높이 흔들기), 막타 슬로, 몬스터 대치 초반 피해량(Lv11→Lv3 가 2/25)은 따로 확인.
  회귀: `test/battleHitIntensity.test.ts`.

## 진입 · 결판 · 복귀 연출 (2026-09-25)

출하 플레이어 실시간 녹화(15fps 프레임)로 잰 결함과 고친 자리. CSS 는 `battle/23-entry-exit.css` 한 장이다.

- **진입**
  - 필드 캔버스가 커버 동안 확대·회전하며 빨려 든다. `createBattleTransition(host, schedule, field)` 의 세 번째 인자로
    `playSceneBattle` 이 `scene.game.canvas` 를 넘기고, `setFieldMotion` 이 `battle-encounter-swirl` 을 붙인다.
    키프레임은 **선형 + 앞당김**이다. 처음엔 ease-in 이라 확대 대부분이 닫히는 막대 뒤에서 일어나 보이지 않았다
    (rAF 실측: 400ms 에 scale 1.0, 980ms 에 1.47).
  - 흰 플래시는 두 번 친다. 막대는 가운데서 자라는 V 대신 홀짝이 좌우에서 엇갈려 닫힌다.
    `slide-pokemon`·`curtain-dq` 처럼 막대 방향을 스스로 정하는 스킨은 예외다.
  - 유리 뼈대 인트로는 커버가 걷히는 **동안** 시작한다. 예전엔 걷힌 뒤라 빈 배경만 330ms 보였다.
    적은 검은 실루엣으로 미끄러져 와서 멈출 때 번쩍이며 색을 입는다(120 + index×90ms 지연, 700ms).
- **결판**
  - 시퀀서 훅 `onResultPending(result)` 가 결과 홀드(`BATTLE_RESULT_HOLD_MS` 900) 직전에 한 번 불린다.
  - 결판 막타(뒤에 피해·회복·빗나감 엔트리가 없고 결과가 이미 정해진 격파)는 격파 대사와 **같은 순간**에 이 훅을 부르고,
    대사 체류를 `BATTLE_DECISIVE_KILL_LINE_MS`(240)로 줄인다. 예전엔 대사 660ms + 홀드 900ms 동안 빈 필드였다.
  - `battleDom.showFinaleStamp` 가 필드에 「승리!」/「전멸…」 도장(`.battle-finale-stamp`)을 찍고 루트에
    `data-battle-finale` 을 단다. 승리면 필드가 1.035배 다가오고, 전멸이면 필드가 흑백으로 가라앉는다.
    도주는 도장이 없다. 같은 결과로 두 번 불러도 한 번만 찍는다.
  - 결과 소리(`emitBattleJuice`)와 플래시는 도장과 함께 울린다. 결과 패널은 이미 울렸으면 다시 울리지 않는다.
    도장만 걷고 `data-battle-finale` 은 전투가 닫힐 때까지 둔다. 지우면 패널이 뜨는 순간 줌·흑백이 한 프레임에 튄다.
- **결과 패널**
  - 경험치·골드 수치는 공개될 때 0 에서 최종값까지 520ms 동안 센다(`battleDirectorDom.countUpRewardValue`).
    끝나면 원래 글자로 되돌리므로 최종 `textContent` 는 같다.
  - 확인키 건너뛰기(모두 공개), 감소 모션, rAF 가 없는 환경에서는 세지 않는다. 레벨 업 행은 튀어나오며 테가 퍼진다.
- **복귀**
  - 끝날 때 커버는 스킨 색이 아니라 항상 검정이다. 정면 스킨은 파랑 커버로 페이드해 필드가 파랗게 물든 채 돌아왔다.
  - `BATTLE_TRANSITION_EXIT_MS` 220 → 300. 복귀 열림은 `BATTLE_TRANSITION_RETURN_MS`(460)이고,
    진입 열림(`REVEAL_MS` 300, 인트로 CSS 의 `--battle-reveal-ms`)과 분리했다.
  - 필드 캔버스는 `battle-return-settle` 로 살짝 당겨졌다가 제자리로 내려앉는다.
- **남은 것:** 게이지 흐름에서 인트로 뒤 「행동 게이지가 차는 중」 대기가 약 1.5초다. 초기 ATB 는 규칙 쪽 값이라 이번엔 건드리지 않았다.
- **기본 스킨:** 편집기 기본은 이미 `rm2000`(정면)이다(`DEFAULT_BATTLE_SKIN_ID`, 드롭다운 첫 항목). 라벨에 「(기본)」을 붙였다.

## 전투 리뷰 후속: 상태 안내와 무대 채움 (2026-09-20)

- `battleDom`은 우상단에 `F 자동 꺼짐/켜짐 · Shift 1×/1.8×/3×` 상태를 표시한다.
  연출 빨리감기는 `넘기는 중`으로 구분한다. 버튼 바를 복원하지 않으며, 문구가 바뀔 때만
  `role=status` 내용을 갱신한다. 이벤트 대화/결과 표면에서는 숨긴다.
  스킵 중 Shift로 선택 배속을 바꿔도 효과 data 배속은 5.0을 유지하고 종료 때 선택값으로 복원한다.
- 게이지 충전 안내는 `BattleSnapshot.nextReadyBattlerId`를 읽는다. 런타임이 실제 tick과 같은
  `nextReadyBattler`에 양측 생존 배틀러·상태 민첩·스킨 가속을 넣어 계산한다.
  아군 raw gauge 정렬로 다음 차례를 추측하지 않는다. 예측이 없는 구버전 snapshot은 일반 문구를 쓴다.
- 상태 부여/해제/지속 피해/회복/행동 불가 메시지는 `targetId`로 대상 이름을 붙인다.
  동명 적은 기존 `disambiguatedBattlerName` 계약을 따른다.
- `calculateBattleStageScale`은 `min(hostWidth / 640, hostHeight / 480)`의 최대 contain 배율이다.
  0.5 단위 양자화·최소 0.5 제한을 없앴다. host는 조상 transform 이전의 논리 치수로 잰다.
  640×360에서 0.5→0.75(씬 480×360), 426×240에서는 0.5(320×240)다.
  4:3 UI 비율은 유지하며 남는 공간은 host 전체를 덮는 불투명 `.battle-stage`가 가린다.
  mount/destroy는 이 wrapper까지 소유한다. 필드 HUD 숨김 선택자는 `battle-scene`의 직계 여부에 의존하지 않는다.
- 100% 초과 적 이미지 fit은 저작 발 앵커 위/좌우 공간에 맞춰 축소한다. 큰 적 전원을 같은
  하단선으로 밀지 않는다. 경계 밖 앵커만 안전 영역으로 보정하고 실제 y로 depth를 다시 계산한다.
  이웃 이미지 충돌 회피는 별도 과제다. glass 메시지에는 긴 이름이 두 줄로 흘러갈 수 있다.
- `shapeCommandFields`의 중복 `m2Command` case를 제거했다. 공통 shape 경로는 main에 추가된
  카탈로그/필드 타입/선택값 검증을 호출한다. 얕은 객체 검사로 그 검증을 가리면 안 된다.

출하 `player.html`의 세 스킨 브라우저 관측 및 이미지:
`docs/reviews/2026-09-20-battle-review-feedback.md`. 회귀 테스트 코드는 추가/갱신했으나
세션 규칙에 따라 vitest/gates/typecheck는 실행하지 않았다.

## 전투 적대적 리뷰의 무결성 수정 (2026-09-20)

- `resolveOutcome`은 일반/Gen1 승리보다 파티 전멸을 먼저 판정한다. 마지막 적 처치와
  Struggle 반동 전멸이 겹치면 패배이며 보상과 `battleVictory` 자동저장으로 가지 않는다.
- M2 적 HP/MP/상태 변경은 `all`, 실제 배틀러 id, 적 recordId만 해석한다. 빈/삭제된
  대상은 `handled:false`와 기존 unsupported 로그로 남기며 첫 생존 적에게 대체하지 않는다.
  `fields`가 객체가 아닌 명령도 미지원으로 건너뛴다. 저작 도구와 공통 명령 shape 검증은
  `commandId`와 객체 `fields`를 요구한다.
- 전투 admission은 `members` 우선 로스터의 적 존재까지 검사한다. 숨은 적도 포함하며
  누락은 `BATTLE_ENEMY_MISSING`으로 설명한다. raw `Missing enemy` 예외까지 진행하지 않는다.
- 이벤트 `eventLogs`는 진단 자료다. 디렉터 메시지로 투영하지 않는다. 저작 대사는 기존
  `eventPause`/DialogueUI가 표시하고, 대화가 끝나면 현재 명령/행동 안내로 돌아간다.
- F와 Shift 반복 keydown은 토글하지 않는다. Shift 조합 여부는 AUTO/연출 스킵의 조기 반환
  전에 기록한다. AUTO 상태 표시와 화면 배율은 위 후속 계약에서 다룬다.
- 전투 이벤트 타이머는 `timerWrites`와 `timerActivityWrites`에 남은 초와 최종 활성 상태를
  기록한다. 복귀하는 결과의 커밋에서 `applyBattleTimerWrites`가 실제 `runtimeTimers`에
  반영한다. 미수정 타이머의 진행은 보존하고 취소/비복귀 패배에는 적용하지 않는다.
- 액터 레벨업은 HP 최대치를 늘리되 HP 0인 참가자를 소생시키지 않는다.
- M2-092 런타임은 리치 폼의 `{target:"actor",actorId}`와 기존 직접 id/party 형식을
  함께 해석한다. 빈 actorId는 파티 전체 변경으로 확장하지 않는다.

회귀 코드는 `battleReviewIntegrity`, `dbToolsIntegrity`, `battleRewardsToSession`,
`gen1RuntimeExactIntegration`에 추가했다. 이번 세션에서 tests/gates/typecheck는 실행하지 않았다.
출하 `player.html` 브라우저 관측과 범위는 `docs/reviews/2026-09-20-battle-review-fixes.md`.

## 공격 효과음 지연 — 샘플 SE 디코드 캐시 (2026-09-15)

- **증상과 원인.** 전투 타격음(샘플 SE)이 임팩트 비트에 맞춰 발화돼도 소리가 늦게 들렸다는
  사용자 보고. 발화 시점은 정확했다 — 원인은 재생 경로였다. `battleJuice.tryPlay` 와
  `battleAnimationDom.playTimingSound` 는 **소리 한 번마다 `new Audio(url)` + `play()`** 를
  했고, HTMLAudioElement 는 새 요소마다 로드를 기다린 뒤에야 소리가 난다. Chromium 루프백
  실측(Attack1.wav): 첫 재생 74.9ms, 반복 재생 6~52ms 가 출력 레이턴시(~10ms) 위에 누적됐다.
  개발 서버 재검증·콜드 캐시·로드가 높은 박스에서는 이 지연이 수백 ms 로 자란다.
- **계약.** `src/player/battleSeSamples.ts` 가 자원 id 별로 `fetch + decodeAudioData` 버퍼를
  캐시하고 `AudioBufferSourceNode` 로 즉시 재생한다(실측 매 타격 0.0~0.2ms). 실패는 비대칭이다:
  WebAudio 부재와 네트워크 실패는 캐시하지 않고 다음 재생에서 재시도, 디코딩 불가 포맷만 영구
  실패(null)로 기록한다. `playBattleSample` 이 false 를 돌려주면 호출부가 기존 요소 경로로
  폴백해 소리를 내므로 **사건 1개 = 소리 1개** 계약과 샘플 볼륨(0.4)은 그대로다.
- **프리로드 지점은 두 개다.** (1) `mountBattleScene` 진입에서 `preloadBattleJuiceSamples()`
  가 `BATTLE_SFX` + `SFX_FALLBACK` 전부를 디코딩해 둔다 — 블라인드 전환(300ms+) 안에 끝나는
  양이라 첫 타격부터 정시에 소리가 난다. (2) `mountBattleAnimationPlayback` 은 저작 애니메이션의
  `soundResourceIds` 를 마운트 시점에 미리 적재한다 — 프레임이 렌더될 때 정시에 난다.
- **합성 보이스와 컨텍스트를 나누지 않는다.** 샘플 캐시는 `battleSfx.battleAudioContext()` 로
  합성 보이스와 같은 AudioContext 를 쓴다 — 컨텍스트가 둘이면 언락 시점이 갈라져 한쪽만
  무음이 된다. 회귀: `test/battleSeSamples.test.ts`(happy-dom 지시자 필수 — 이 저장소 vitest
  기본 환경은 node 라 `window` 가 없고 battleSfx 가드가 항상 단락된다).

## 전투 UI/UX·모션 적대적 리뷰 5축 후속 (2026-09-14)

읽기 전용 리뷰어 5명(전환·인트로 / 커맨드·대상 / 타격 피드백 / HUD·결과 / 스킨·반응형)이 출하 경로
`player.html` 을 프레임 단위로 재서 낸 71건 중 P0 전부와 P1 대부분을 고쳤다. 아래는 그때 바뀐 **계약**이다 —
이 절과 다른 서술이 충돌하면 이 절이 맞다.

- **전환 커버 색은 막대에만 준다.** `_transitions.css` 의 스킨 색은 `--battle-transition-cover` 변수로
  `.battle-transition-blind-bar` 에 들어간다. 컨테이너(`.battle-transition-blinds`)에 배경을 주면 부착 즉시 화면
  전체가 덮여 플래시·블라인드·인트로 안무가 판 뒤에서 소진된다(실측: rm2000 진입이 "파랑 판 1초 → 하드컷").
  커버 기본색은 `#05070c` 이고 편집기 토큰 `--bg-canvas`(연회색)는 **런타임에서 쓰지 않는다** — 그게 종료가
  "거의 흰 화면 스냅" 이던 원인이다. 열림 막대는 닫힘의 역순 계단(230ms + 최대 70ms = REVEAL 300ms 안).
- **인트로 안무는 커버가 걷힌 뒤 시작한다.** `.battle-scene` 의 `--battle-reveal-ms: 300ms` 를 `02-intro-reveal.css`
  와 `_rm2000.css` 인트로 `animation-delay` 가 더한다. `02` 의 필드 페이드는 삭제(커버가 그 일). 합계는
  `BATTLE_INTRO_MS` 1200 안(300 + 480 + 420). `battleFieldDom` 이 `--enemy-index` / `--actor-index` 를 노드에
  심어 다수 등장 스태거가 실제로 돈다.
- **배속 변경은 걸려 있는 지연도 다시 건다.** `battleSequencer.delay` 는 원장(`pending`)을 갖고 `speedMultiplier`
  setter 가 남은 비율만큼 새 배속으로 재스케줄한다. 인트로 홀드 중 확인키(스킵 5배속)가 실제로 단축된다.
  감소 모션은 `delay` 를 10ms 가 아니라 **`min(ms, 250ms)`** 로 접는다(읽기 시간 보존) 고, 팝업은
  `17-sprint-a-polish.css` 의 1ms 전역 규칙에서 빼 정적으로 띄운다. 전환 오버레이도 같은 미디어쿼리로 1ms.
- **이펙트 착탄 = 임팩트 비트.** `hooks.animationImpactMs(animation)`(battleDom → `battleAnimationImpactMs`:
  효과음·플래시·흔들림이 걸린 첫 프레임 × frameMs)만큼 이펙트 마운트를 approach 끝에서 앞으로 당긴다.
  착탄 정보가 없으면 예전처럼 approach 시작에 뜬다. 막타 확정 시 `confirmTargetSelection` 은 시퀀서 전에
  `syncView` 를 부르지 않는다(busy=false 에서 result 디렉터로 찍혀 필드가 전체화면이 되고 그 프레임에 앵커가
  재어져 이펙트가 138px 아래로 갔다). 대상 노드가 없는 스킨(rm2000 아군)의 이펙트는 파티 카드 행 중심에 놓인다.
- **`findBattlerNode` 는 recordId 조회에서 살아 있는 노드를 먼저 고른다.** 동종 둘 중 1번이 죽은 뒤 2번이 공격하면
  죽은 1번이 예고 모션을 하던 결함. `battle-targeted`(피격 플래시)는 `impact` 단계에만 붙고 다른 단계에서 걷는다.
- **적 대상 국면의 「뒤로」는 순환의 마지막 자리다.** ↓(마지막 적)/↑(첫 적)로 커서가 「뒤로」 행에 가고, 확인키는
  커서가 그 행(또는 포커스)에 있으면 취소를 누른다. 루트는 `data-battle-target-cursor="cancel"` 을 노출하고
  rm2000 은 그때 선택 대상 행의 강조를 낮춘다. 대상 행의 순번은 `.battle-target-ordinal` 별도 노드라 이름이
  잘려도 끝에 남는다. 대상 안내 문구는 `disambiguatedBattlerName` 을 쓰고 아군/적 갈래가 같은 어조다.
- **스크롤 큐(▾)는 자기 트랙 높이를 빼고 판정한다** — `contentHeight = scrollHeight − cueHeight`, 끝에 닿으면 끈다.
  포커스: 마운트 직후 씬 루트, 명령 국면 진입 시 커서 버튼, 결과 패널 생성 시 확인 버튼.
- **결과 카드: 첫 확인 = 보상 전부 공개, 둘째 확인 = 닫기.** `revealAllResultRows` 가 `[data-revealed="false"]`
  가 남아 있으면 스테이지를 끝까지 올리고 닫지 않는다. `onResultStage` 는 단조 증가(`Math.max`). 첫 행(경험치)은
  패널과 함께 공개(`stage = min(1, rows)`). rm2000 패널은 `max-height: calc(100% − 32px)`, 키 안내 행이 보인다.
  아이템 드롭은 이름별 한 행에 `×n`. 인트로 배너는 같은 이름을 `이름 ×n` 으로 묶는다.
- **도주음·BGM 정지는 결과가 화면에 도달할 때** — `hooks.onEscapeOutcome(success)` 가 성공이면 `escape` 큐,
  실패면 `hit-miss` 큐. 명령 확정 시점의 `emitSwingJuice` 에 escape 분기는 없다.
- **패배(canLose=false) 종료는 커버를 걷지 않고 넘긴다.** `playSceneBattle` 이 `exitTransition` 소유권을 놓고
  `reveal()` 을 await 없이 시작 → 게임오버가 그 아래에 마운트된 뒤 페이드아웃. 밝은 필드가 300ms 드러나는 일 없음.
- **rm2000 파티 카드는 스냅하지 않는다.** 명령 카드가 숨는 단계는 `display:none` + `grid-column` 토글 대신 씬
  1열 트랙을 `0px` 로 접고(`transition: grid-template-columns 220ms`) 호스트를 `visibility:hidden` 한다.
  `.battle-flash-hit` 의 고정 4px 흔들림은 `.battle-screen-shake` 가 없을 때만(세기 변수 흔들림이 이긴다).
  gauge 행 열은 `48/80/40/72/48, gap 6` 로 4인·명령 국면 416px 에 든다. 격파 적의 명찰 카드는 620ms 뒤 사라진다.
  메시지 창 점멸 캐럿은 접었다(눌러서 계속 관습이 아니다). 급소 팝업은 `06` 의 `battle-damage-critical-pop`.
- **포켓몬 스킨 파일(`_pokemon.css`)은 팔레트만 갖는다.** `!important` 크림 파티 박스와 씬 배경 `#98d0d8` 을 지웠다
  (4인 파티에서 적을 통째로 가리고 하늘색이 틈으로 샜다). 3인 이상 액터 파티는 `20-…css` 가 행을 한 줄로 접는다.
  `.battle-command` 는 flex(▸ 커서가 같은 줄), 서브메뉴 행 34px, 대상 메뉴 1열, 14층의 `transform: scale(1)`
  삭제(포획 흡수 `scale(0)` 이 살아난다), `.battle-enemy-list-panel width` 는 20층 한 곳만. 교체 후
  `syncActorGroup` 이 필드 스프라이트 집합을 다시 만든다(`battle-actor-switched-in`).
- **rm2003 수동 배치 충돌 회피.** `resolveSkinEnemyPositions` 측면 분기는 앞선 적과 24px 안에 겹치면 자동 진형
  자리 → 오른쪽 48 → 아래 40 순으로 비충돌 후보를 쓴다. 아군은 `x: 196 + i*32`.
- **비활성 행에도 커서가 선다(2026-09-15, 보류 항목 해소).** `disabled` 버튼은 포커스를 못 받고, 커서는 포커스를
  따라가므로 예전엔 화살표가 MP 부족·PP 0 행을 통째로 건너뛰었다 — 감독은 기술이 목록에서 사라진 줄 알았고,
  왜 못 쓰는지는 `aria-label` 에만 있어 눈으로는 읽을 수 없었다. 이제 `commandButton` 은 `disabled` 대신
  `aria-disabled="true"` + `data-battle-command-inert` 를 쓴다. 기존 `:not(:disabled)` 선택자가 그대로 매치하므로
  커서 이동 코드는 **한 줄도 안 고쳤다**. 실행 차단은 클릭 리스너를 안 다는 것으로, 확인키는 `handleConfirm` 에서
  거절음(`command-cancel`)만 울리고 메뉴를 연 채 둔다. 사유는 `.battle-command-reason` 으로 눈에도 보이며
  `detail` 과 같은 말이면 중복 출력하지 않는다. 회색 처리는 `17-sprint-a-polish.css` 와 rm2000·vxace 스킨에
  `[aria-disabled="true"]` 형제 선택자를 더해 유지했다.
- **결과 문체 통일(2026-09-15, 보류 항목 해소).** `resultLine` 은 `승리`(명사)·`패배했습니다`(합쇼체)·
  `무사히 후퇴했다`(해라체)로 세 갈래였다. 이 슬롯은 디렉터 첫 줄이자 `.battle-result-title` 에 그대로 찍히는
  **제목**이므로(문장은 바로 아래 `rewardsLine` 담당) 셋 다 명사로 맞췄다 — `승리`/`패배`/`후퇴`.
  전투 로그(`battleSequencer`)의 해라체는 의도된 것이라 건드리지 않았다.
- **터치 입력 차단은 이미 걸려 있었다.** `src/player/player.ts:184` 의 `installPlayPointerBlocker(layout)` 가
  플레이 표면 전체(전투 씬 포함)에서 pointer·touch 이벤트를 막는다. 예외는 `touch-controls` 와 `host-fullscreen`
  소유 표면뿐. 별도 작업이 필요 없어 보류 목록에서 뺀다.
- 당시 남겨 둔 전투 배율 정책은 2026-09-20 후속에서 최대 contain으로 변경했다(위 절).
  포켓몬 뒷모습 슬롯은 별도 아트 과제다.
  증거 스크립트는 리뷰 당시 `verify-shots/adv-review-{1..5}/` 와 `verify-shots/after/` 에 남겼다(커밋하지 않음).

## 몬스터 파티의 전투 회복약 자격 (2026-09-24)

`battleItemEligibility.ts`의 `isBattleItemUserEligible`를 가방 목록, 명령 접수,
아이템 효과 실행에서 함께 사용한다. 전투 인스턴스 ID(`mon:monster_2`)는 DB 액터 ID가
아니므로 `isItemActorEligible`에 직접 넘기면 약이 보이지만 선택이 묵살된다.
일반 액터는 recordId와 실제 classId로 기존 자격 검사를 유지한다. 등록된 종족의
몬스터는 액터/직업 제한이 없는 medicine만 허용하며 book/seed의 액터 전용 계약은 유지한다.
사용 제한·대상·HP/MP 회복량·소모 처리는 기존 전투 아이템 계약을 그대로 따른다.
회귀 항목은 `test/battleMonsterMedicine.test.ts`; 세션 규칙상 vitest/gates는 사용자 요청 없이 실행하지 않는다.
실제 플레이 검증은 약 선택 전후 재고·회복 타임라인과 후속 적 반격을 구분해 확인한다.

## 회복 자원·인트로 배너·타이머 write-back 계약 (2026-09-15)

전투 적대적 리뷰 후속으로 고친 세 계약이다. 이 절과 다른 서술이 충돌하면 이 절이 맞다.

- **회복은 자원을 들고 다닌다.** 아이템 회복 결과 `amount` 에 HP 증가와 MP 증가를 합산하지 않는다.
  `BattleTimelineEntrySnapshot.resource` (`"hp" | "mp"`) 가 표시 계층까지 내려가고,
  `battlePresentation.applyFeedback` 은 `resource === "mp"` 인 healing 을 **HP 원장에 적용하지 않는다**
  (MP 표기는 원장이 아니라 최종 스냅샷에서 바로 읽는다). 실측 결함: 마력약(MP+30/HP+0)을 쓰면 파티 카드
  HP 가 250→280 으로 올다가 다음 커맨드 국면에 250 으로 되돌아갔다. 같은 순간 메시지는
  `주인공에게 30 피해!`(팝업은 `+30`) 였다 — `impactLine` 이 `rolled > 0` 을 피해로 먼저 판정했기 때문이다.
  이제 회복 여부는 부호가 아니라 **타임라인 kind** 로 정해지고, 메시지는 `MP를 30 회복했다!` 처럼 자원을 밝힌다.
  팝업도 MP 회복은 `MP +30` 으로 구분한다. 회귀: `test/battleRecoveryResourceDisplay.test.ts`.
- **상태 유지 회복(`stateRecovery`)도 healing 이다.** `feedbackFromTimeline` 이 kind 를 healing 로 분류하지
  않으면 양수 회복량이 피해로 재생되어 팝업 `-8` / HP 50→42 / 메시지 `8 회복했다` 가 한 화면에 겹친다.
- **인트로 배너는 커버가 걷힌 뒤에 뜬다.** `.battle-message-window` 의 `rm2000-banner-in` 지연은
  `[data-battle-director-step="intro"]` 에만 `--battle-reveal-ms`(기본 300ms)를 더한다. 실측 결함:
  씬 마운트 874ms → 커버 960/960px 인 946ms 에 배너 opacity 0.718 — 판이 닫힌 채 페이드인해서 커버가
  배너 글자를 가로질러 잘라먹었다(글래스 스킨). acting/impact/targetSelect 는 지연 0 을 유지한다 —
  전투 중 메시지까지 늦추면 읽는 리듬이 끊긴다. 계측: `scripts/qa/runtime/battle-adversarial-0915.probe.mjs`.
- **전투 종료 write-back 은 전투가 실제로 쓴 타이머만 되돌린다.** `BattleEventStateSnapshot.timers` 는
  timer 조건 평가를 위해 진입 시점 사본 전체를 유지하지만, 세션 반영은 `timerWrites`(전투 이벤트의 `timer`
  커맨드가 기록한 키만)로 한다. 타이머 진행(tick)은 맵 씬(`playSceneTimers`) 소관이라, 사본 전체를 쓰면
  전투 중 만료된 타이머가 진입 값으로 되살아나고 이후 프레임은 만료된 타이머를 건너뛰므로 자동 교정되지
  않는다. `friendshipWrites`/`relationshipWrites` 와 같은 "쓴 키만" 관례다. `timerWrites` 없는 구 스냅샷은
  예전처럼 `timers` 전체를 병합한다. 회귀: `test/battleRewardsToSession.test.ts` 의 `battle timer write-back`.
- **필드 트랙은 전투를 거쳐도 저작 볼륨을 유지한다.** `playSceneBattle` 은 `enterBattleAudio` 가 돌려주는
  **전한** `BattleAudioSession`(resourceId + volume + loop)을 다. resourceId 만 들고 있으면 복귀 시
  `exitBattleAudio` 의 폴백(`{resourceId, loop:true}`)이 gain 을 안 실어, 저작 `volume: 0`(음소거)·저음량이
  기본 믹서 볼륨(0.7)으로 되돌아온다 — 그리고 그 잘못된 값이 `session.audio.bgm` 에 기록되어 이후
  저장·전투로 전파된다. 회귀: `test/battleResultTransitionFailure.test.ts` 의
  `keeps the authored field volume through the battle round trip` (실제 `playBattle` 경로).
- **종국 패배(canLose=false)는 필드 BGM 을 되리지 않는다.** 전투 결과가 게임 오버로 이어지는 길에서
  `exitBattleAudio` 를 그대로 타면, 살아 있는 파티가 없는 게임 오버 화면 **아래에서** 탐험 BGM 이 다시 돈다
  (실측 A/B: 수정 전 게임 오버 시점 `field-of-dreams.mp3` volume 0.57 재생 → 수정 후 재생 트랙 0개).
  그 경로는 채널만 멈추고 세션 기록만 필드곡으로 되돌린다(재시도·저장 해석이 같은 값을 본다).
  승리·도주·`canLose=true` 패배의 필드 복원은 그대로다. 계측:
  `scripts/qa/runtime/battle-title-bgm-handoff.probe.mjs` 의 `atGameOver`.
- **대상 목록도 커서를 옮기면 따라온다.** `setMenuCursor` 와 `cycleTarget` 은 `syncView()` 뒤 곧바로
  반환해서 메뉴의 `selected.scrollIntoView` 블록이 실행되지 않았다 — 6체처럼 스크롤포트(4행)를
  넘는 목록에서 커서를 옮기면 선택 행이 포트 밖에 남아 플레이어가 자기가 고른 적을 볼 수 없었다
  (실측: enemy-5/6 선택 시 `scrollTop 0`, 행 bottom > 포트 bottom → 수정 후 24px/48px 로 따라옴).
  `followTargetCursor()` 가 다시 그려진 선택 행을 `scrollIntoView({ block: "nearest" })` 로 당긴다.
  회귀: `test/battleDomKeyboard.test.ts` 의 "follows the cursor with the scroll port ..." · 계측:
  `scripts/qa/runtime/battle-target-scroll.probe.mjs`.

## Native event battle admission (2026-09-08)

- `project/battleAdmission.ts` supplies typed missing/empty-troop errors to the
  native editor and runtime constructor. Effective composition follows
  `enemyBattlers`: populated members win, otherwise legacy enemyIds apply.
  Hidden members count; an all-hidden encounter remains available for reveal
  events. The project loader separately normalizes an explicitly authored empty
  members array as authoritative; omit members for legacy enemyIds-only JSON.
- `commandBattle.ts` resolves variable targets explicitly. Valid trimmed string
  IDs and the existing numeric lookup remain compatible: truncate finite numbers,
  try 1-based position, then zero-based position (so 0 aliases the first troop),
  then the existing ID/suffix match. Invalid/missing values now throw instead of
  falling back to the unused fixed troop. The actual resolved troop still goes
  through runtime composition validation. No schema or migration was added.
- `playSceneBattle.ts` owns initialization, audio restoration and runtime cleanup
  across constructor, transition and mounted-host failure. Empty canonical or
  legacy monster-party mode reports missing starters/party members instead of
  returning escape or forcing defeat. Giving a starter permits a corrected retry.
- Foreground event failures report `runtime-error` and end that interpreter without
  resuming branches, subsequent commands or completion callbacks. Parallel failures
  retain the existing stopped-process policy until page/map reactivation; they do
  not repeatedly retry each frame. Action events can retry after correction, and
  a new command battle clears the previous error. Existing random/field callers
  also display typed admission errors rather than leaking their new rejections.
- Autorun keys are claimed only after dialogue readiness and an active scene.
  `PlayScene` waits for Phaser's `create` event when readiness occurs inside
  `create()`: Phaser sets RUNNING after that method returns. Otherwise synchronous
  invalid-variable errors look like shutdown cancellation and silently disappear.
  Cancellation remains null, never a battle outcome; stale rejections do not report
  into replacement sessions. Existing defeat and reward-writeback rules remain.
- The `runtime-error` notice is styled in shipped `runtime/playSurface.css`,
  not editor-only `core.part-1.css`. The old fallback was a static block below
  the scaled canvas (browser RED: y=960 in a 960px viewport). The scoped notice
  is absolutely positioned within crop bounds, inverse-scales its typography,
  wraps long IDs, and does not claim pointer/input ownership. The browser probe
  checks its viewport bounds, nonzero size/alpha, and actual menu after reveal.
- Result confirmation uses the same failure boundary for a synchronous exit
  transition factory/exit-method throw and an asynchronous exit rejection. The
  DOM has already latched resultSent, so escaping that callback would otherwise
  strand the battle promise and foreground lease. `battleResultTransitionFailure`
  mounts real battle DOM/runtime and exercises that callback through the event
  owner, including late rejection after cancellation/session replacement.
- Contracts: `eventBattleFailure`, `battleInitializationAdmission`,
  `npcScheduledBattle`, `npcBattleLifecycle`, `playSceneBattleCancellation`,
  `battleDefeatOutcome`. Exported-player probe and limitations: `testing.md`.

## Supported action authoring (2026-09-07)

2D tile action combat remains supported alongside turn-based combat; the old
deprecation warning and editor label were removed. `action-rpg` is authoring
metadata, not a runtime branch. Its preset enables `system.actionCombat` only,
and each intended map still requires `actionCombat: true`. The canonical
controls text comes from `player/keyBindings.ts` (`ACTION_CONTROL_BINDINGS`,
`ACTION_CONTROLS_GUIDE`) and the action guide NPC uses that same copy.
Enemy/graphic/troop/spawn prerequisites are validated before mutation, and
explicit spawn IDs make retries idempotent. Dodge and guard knobs exposed by
the tool use the existing config normalizer. None of this adds a combat engine.

## 적별 전투 표시 크기 (2026-09-06)

`battleFieldDom.enemyButton`은 해당 적의 `battleScalePercent ?? 100`을 100으로 나눈 값을 노드의 `--battle-enemy-scale`에 넣는다. RM 정면/측면은 `_rm2000.css`의 glass 공용 이미지 크기(다수 160×180, 단독 200×240), 몬스터 대치는 `_battlers.css`의 Pokemon 이미지 크기(148×148)에 곱한다. 부모 이동/피격 `transform`, 이미지 숨쉬기 `scale`, 사망/포획 애니메이션은 변경하지 않는다. 이름·HP 글자 크기와 맵 외형은 배율 대상이 아니다. 기본 100% 이하의 치수·진형은 그대로 둔다. 100% 초과는 `battleEnemyFit.ts`가 필드 논리 크기에서 좌우 16px·상단 32px·하단 24px를 뺀 영역에서 저작 발 앵커 위/좌우 공간에 이미지를 균일 축소한다. 경계 밖 발 앵커만 보정한다(2026-09-20). 저장된 요청 백분율은 그대로이고 `--battle-enemy-fit`만 표현용으로 추가한다. 세 스킨의 `--battle-enemy-base-width/height`가 기본 치수의 단일 원천이다. 이미지 width/height에만 요청 배율×fit을 곱하며 이름·HP는 축소하지 않는다. 이웃 배틀러와의 겹침 방지는 별도 진형 작업이다.

단독 골렘 175% 회귀: 640×360 필드에서 200×240×1.75=350×420 이미지를 발 y≈290에 고정하면 top≈−130이라 머리가 잘렸다. 현재는 253.33×304, top32/bottom336으로 맞춘다. 100%는 200×240과 원래 발 위치를 보존한다. 기존 `syncBattleField`의 mounted render 경로가 매번 저작 진형과 CSS 기본 치수로 다시 계산하므로 fit이 누적되거나 HP 공개로 위치가 바뀌지 않는다. 화면 리사이즈는 기존 `bindBattleStageScale`이 고정 논리 무대 전체를 확대하므로 새 observer/타이머가 없다. controller의 기존 cleanup 그대로이며, 분리된 필드는 레이아웃이 생긴 다음 sync까지 계산하지 않는다.

`test/battleEnemyFit.test.ts`는 실제 `mountBattleScene`/runtime 경로에 측정된 논리 레이아웃만 주입해 175% clipping RED, 세 스킨 100% 보존·300% containment, 125% 발 앵커 유지, 다수 적 진형 보존, hit/HP 안정성, 필드 폭 변경 후 재계산, destroy 후 타이머 정리를 검증한다.

회귀는 `test/enemyBattleScale.test.ts`: 실제 정규화된 프로젝트→전투 엔진→DOM, Gen1의 선두 적 단독 표시, hit/idle 동기화 후 크기 유지, 출하 CSS 치수 선언을 검사한다. happy-dom은 calc 곱셈/`:where` 특정도를 정확히 계산하지 못하므로 CSS는 PostCSS로 선언을 검사하고, 실제 캐스케이드·사각형·동작 검증은 별도 `player.html` 런타임 QA에서 한다.

## Capture-only victory (2026-09-08)

Successful capture hides the target and sets its HP to zero. Outcome resolution must
therefore accept an empty visible-enemy list when the battle has captured participants;
a troop whose members were all hidden from the start still does not auto-win.
Other living visible enemies prevent victory, and captured enemies remain excluded
from EXP/gold/drop rewards. `test/monsterCollection.test.ts` and
`test/battleRuntimeDefects.test.ts` cover all three outcome distinctions.
Scripted nonlethal capture fixtures must control actor criticals and initial equipment,
not merely set the actor's attack curve or rely on a seeded roll.

## Event friendship and live level changes (2026-09-06)

`changeFriendship` snapshots only keys written by the battle, following the
relationship write-set contract. Returning victory, escape and permitted defeat
merge those keys into the captured session; nonreturning defeat does not.
Unrelated session friendship updates are preserved.

`changeLevel` updates the existing mutable battler and calls the existing derived
stat refresher. Current HP/MP, equipment and gauge are retained, with vitals
clamped when maxima decrease. The party HUD updates its existing level node.
The reward bridge copies battler vitals before writing the final event level,
class, and growth state, then refreshes derived maxima without healing. Promotion
lineage and permanent skills transfer as authoritative state, never replayed reclass.

Contracts: `battleEventRepairState.test.ts`, `battleEventRepairHud.test.ts`.
Shipping-player QA: `node scripts/qa-event-command-repairs.mjs --scenario battle-state`.
The VX Ace skin intentionally hides maximum-vital text; screenshots show the
level/current vitals, while DOM/session observations verify the maxima.

## Sequential battle event completion (2026-09-08)

The existing choice frames/API remain intact. `snapshot.eventPause` adds typed
`wait` (`ms`), `inputWait` (`variableId?`), and `text` (body/speaker/face/settings/
autoAdvance/emotion) requests. `resumeEventPause(id, response)` accepts only the
matching kind/id; input responses additionally require an integer key code 0-19.
Stale, duplicate, mismatched, and cancelled responses cannot run a tail.

All native/M2 common calls and troop-page calls retain their frames at these
boundaries. Strict queues/RNG/extra actions and gauge progress stay frozen until
acknowledgement. The sequencer first drains preceding action facts, then schedules
each authored wait separately at its unscaled duration (including reduced motion,
AUTO, and skip speed). Waits no longer pre-execute their tails or become deferred
strict timeline entries. Zero/negative durations continue immediately.

The player uses its real abortable `DialogueUI.showText`; every page must complete.
Face changes are battle-local, including clearing. Text/choices inherit captured
settings and subsequent battle-local changes. Only authored settings changes enter
the returning event write-set: victory/escape/canLose defeat apply them; cancellation
and nonreturning defeat do not. Transparent dialogue owns the message surface only
after earlier beats drain, hiding the old battle director text underneath.

`headlessBattleSnapshot` explicitly bypasses wait/text presentation in balance,
scene, and walkthrough simulations, but throws `BATTLE_EVENT_INPUT_REQUIRED` at
choices/inputWait. Scene/walkthrough reward bridges pass `canLose` so returning
defeat preserves executed event mutations rather than silently discarding them.

Focused contracts: `battleEventSequentialWait`, `battleEventDialoguePresentation`,
`battleEventSequentialHost`, `battleEventTextHost`, `battleEventSimulationInput`,
`battleEventWaitAudio`. Shipping QA extends `scripts/qa-event-command-battle-flow.mjs`
with `--case sequential --port <owned-port>` (optional `--pass`); observations are
read-only and gameplay uses real keyboard input through player.html/export shim.
Evidence and final-browser infrastructure limits:
`output/evidence/event-command-completion/battle/VERIFICATION.md`.

## Battle-event continuation and cancellation (2026-09-06)

Battle execution remains synchronous between input boundaries. `battleEvents.ts`
retains the page scan and per-call frame stacks for native/M2 common calls and
M2 troop-page calls. A choice exposes `snapshot.eventChoice` and phase
`eventChoice`; only `resumeEventChoice(request.id, index)` runs a branch. Invalid,
stale, duplicate, or disposed responses do nothing. `-1` selects an authored
cancel branch only; mapped-option cancellation is resolved by the dialogue UI.
No browser/input host means no implicit first option. Empty saved choices log
unsupported and continue without inventing a branch.

`gameOver`, `killPlayer`, M2 abort and forced escape short-circuit all event
callers and remaining pages. The first terminal wins. Gauge resumes only its
post-action epilogue; strict retains its already-sorted queue, extra-action
count, RNG decisions, and round timeline boundary. A terminal completes only
the executed strict prefix. Wait/text/inputWait now use the sequential contract above.

The sequencer drains preceding timeline facts before requesting input, remains
busy while choices are open, and consumes only appended facts after resumption.
`playSceneBattle` supplies the existing stage `DialogueUI.showChoices` host;
battle keyboard/AUTO/skip handlers yield ownership. Choice signals, hide, and
replacement remove listeners and settle cancellation rather than selecting the
cancel branch. Result presentation is never overwritten by event diagnostics.

`BattleRuntime.cancel()` disposes execution without an outcome. Player-side
`playBattle` returns `null` on cancellation, not defeat/escape. `PlayScene` owns
its abort controller before lazy import and aborts on shutdown, destruction,
and session replacement. DOM destruction also settles the pending battle;
transition destruction settles its waits. State/rewards/autosave commit once,
after cancellable exit/reveal completes, to the captured session only.

Synchronous balance/scene/walkthrough simulations throw/report
`BATTLE_EVENT_INPUT_REQUIRED` instead of exhausting ticks and fabricating defeat.
They do not provide an automatic choice policy. Simulation project-mode flags
are restored in `finally`.

Contracts: `battleEventRepairFlow`, `battleEventChoiceHost`,
`playSceneBattleCancellation`, and `battleEventSimulationInput` tests, plus the
existing strict/sequencer/active-slot/wait/defeat suites. DOM tests use real
runtime/sequencer/dialogue and a controlled clock; they are not evidence of
shipping-player browser QA. That acceptance check uses `player.html` and the
export-store shim, never the editor shell.

## 전투 명령 custom CSS (2026-09-05)

`battleCommandDom.commandPanel`은 프로젝트의 `system.battleCommandCss`를 `mountBattleCommandCss`로 마운트한다. 내부 생성 scope 속성이 각 패널의 메뉴/버튼/라벨/포커스·disabled 상태만 겨냥한다. 패널이 재생성될 때 스타일도 함께 제거되며 타이틀·대화창·편집기 셸에는 적용되지 않는다. 하위 메뉴와 대상 선택도 같은 범위다. 파서는 8,000자 이하의 제한된 시각 속성만 허용하며 URL·CSS 변수·at-rule·임의 선택자를 거부한다. 실패한 스타일은 실행하지 않고 기본 스킨을 유지한다. 검증은 `node scripts/qa-battle-command-css.mjs`로 편집기 저작 후 별도 player.html 하네스에서 수행한다.

## 빈 페이지와 실행 빈도 계약 (2026-09-05)

`battleEvents.ts`는 빈 `commands`를 부작용 없는 페이지로 실행한다. 과거의 첫 적/첫 상태 암묵 적용 폴백은 제거했다. 상태를 부여하려면 실제 명령을 저작해야 한다.

`span:"turn"` 자체가 라운드당 최대 1회 실행을 보장한다. `moment`는 평가마다 실행 가능하며 기존 turn/onRound/everyRound/actorTurn/enemyTurn 조건의 라운드 제한도 유지한다. `runOnce`는 명시 boolean이 우선이고 생략 시 `span === "battle"`가 기본이다. 따라서 `runOnce:false`를 undefined로 바꾸면 안 된다.

적 HP 조건의 `enemy-N`은 N번째 편성 슬롯이다. 동일 몬스터가 두 번 출전해도 슬롯별 HP를 판단한다. 기존 몬스터 레코드 ID 조건은 첫 일치 배틀러를 가리키는 호환 동작을 유지한다. `enemyTurn`은 기존 레코드 ID 의미를 유지한다.

`troopBattlePageTools.ts`의 반복 방지 검증도 turn span을 안전한 라운드 주기로 인정한다. 저작 도구는 실행할 명령을 요구하므로 빈 페이지를 거부하지만, 이미 저장된 빈 페이지가 런타임 부작용을 일으키지는 않는다. HP 조건은 도구에서도 그룹 범위의 슬롯 참조를 허용한다.

검증: `test/monsterBattleAuthoringContract.test.ts` (빈 페이지, span/runOnce 조합, 반복 평가, 슬롯별 HP 및 저장 왕복), `test/troopBattlePageTools.test.ts`.


Battle rules, turn flow, damage, rewards, battle events, snapshots, monster collection, and Gen 1 rules.

For real-time action combat on action maps (`system.actionCombat` + `map.actionCombat`), see **`openwiki/runtime-action-combat.md`**.

### 체공 배율 채널과 착지 눌림 (2026-08-30, PR #297)

체공은 이제 위치(lift) 외에 **배율 두 채널**을 더 쓴다 — 속도에 비례하는 스쿼시/스트레치와
체공 높이에 비례하는 원근(최대 0.35, 4타일 게이트, 착지 시 정확히 1로 닫힘). 그림자 페이드는
고정 2타일이 아니라 **이번 비행의 시작 높이**를 기준으로 정규화하므로(`characterShadow.ts`),
128px 낙하가 하강 전체에 걸쳐 자란다. 단 `SHADOW_FADE_LIFT_PX` 하한이 있어 32px 미만으로
저작된 낙하는 옛 곡선을 쓴다.

**연속 체공 함정.** 착지 눌림은 `HOP_SQUASH_MS` 동안 트윈으로 살아 있는데, 경로는
`!scene.playerHop` 이면 **다음 프레임에 바로** 다음 체공을 시작한다(`playSceneMovement`).
그래서 눌린 동안에도 기준 배율을 `scene.characterHopScales` 에 **남겨 둔다** — 지우면 다음
체공이 캐시 미스로 눌린 값을 읽어 영구 기준으로 굳고 남은 맵 동안 캐릭터가 찌그러진다.
트윈을 끊는 것만으로는 부족하다(스프라이트가 눌린 값에 그대로 머문다). 시작에서 트윈도
끊어 새 체공의 배율과 동시 기록되지 않게 한다. 계약 테스트는
`test/characterHopChainedScale.test.ts` 이고, 두 장치를 각각 지우면 각각 실패한다.

감소 모션에서는 눌림·먼지가 함께 빠지므로 이 경로 자체가 없다.

## 지원 전투 시스템은 둘뿐이다 (2026-08-28, 스킨 부분은 2026-09-25 개정)

- 지원 규칙은 **RM식 턴제** (`system.battleModel` 미설정 또는 `"rm2k3"`, 기본값)와 **포켓몬식** (`"gen1"`)이다. 표시 방식은 **정면** (`rm2000`, 기본값), **측면** (`rm2003`), **몬스터 대치** (`pokemon`) 세 가지다. 규칙 모델과 표시 스킨은 별개다.
- 기본 `rm2000`은 적만 필드에 세우고 아군은 이름·HP·MP 상태창으로 표시한다(`partyFacing: "hidden"`, `showAllySprites: false`). 2026-09-03 연출 추가 때 들어간 뒷모습 파티를 2026-09-06 사용자 요청으로 복구했다. 미설정·`classic`·명시적 `rm2000` 모두 같은 경로다. 측면 `rm2003`의 아군 전투 시트와 `pokemon`의 후면 스프라이트는 유지한다. 회귀: `test/battleFieldAllySprite.test.ts`; 출하 화면: `npm run qa:runtime -- --scenario battle-frontview`.
- **스킨 id 이력 (2026-09-03):** 기존 정면 스킨 `rm2003`을 `rm2000`으로 개명한 뒤, 같은 날 `rm2003`을 별도 측면 스킨으로 되살렸다. 현재 `resolveSkinId("rm2003") === "rm2003"`이며 옛 별칭 `classic`만 `rm2000`으로 간다. 등록 스킨은 12종이다. 두 스킨은 `_rm2000.css`의 유리 HUD를 `family: "glass"`로 공유하고 측면 배치는 `_rm2003.css`가 담당한다. 사용자 노출 라벨은 「유리 창 · 정면 필드」와 「유리 창 · 측면 필드」이며 타사 제품명은 쓰지 않는다(`test/detsukuruBrandStrings.test.ts`).
- **스킨 12종 전부 활성 (2026-09-25).** 2026-08-28 에 지원 종료였던 9종(`octopath`, `chrono`, `bravely`, `dragonquest`, `ff`, `mother`, `goldensun`, `mv`, `vxace`)은
  각자 CSS 파일을 버리고 **유리 뼈대(family glass)의 변형**으로 되살렸다. 이유: 전투 개선이 활성 3종에만 들어가, 2026-09-25 출하 player 촬영에서
  9종 대부분이 이름표·HP 바가 겹치고 명령창이 깨져 있었다. 스킨은 이제 세 값의 조합이다.
  - **구도** `layout`(루트 `data-battle-layout`): `frontview` → `_rm2000.css`, `sideview` → `_rm2003.css`. 두 시트와 `05-poses-motion.css` 의 구도 규칙은
    스킨 id 가 아니라 `[data-battle-skin-family="glass"][data-battle-layout=…]` 로 스코프한다. 배치는 `battlerPlacements.ts` 의 `FRONTVIEW`/`SIDEVIEW` 공유 객체
    (`BATTLER_PLACEMENTS[id] === BATTLER_PLACEMENTS.rm2000|rm2003`). `showAllySprites` 는 구도가 정한다(측면만 true). `firstperson`/`active` 구도는 쓰지 않는다.
  - **HUD** `hudTemplate`(`data-battle-hud`): `rows`(기본 줄) · `boxes`(얼굴 카드: 심야·금갈색) · `ring`(얼굴 둘레 HP 링: 청람) · `minimal`(표면 없는 얇은 줄: 먹빛·세피아).
    CSS 는 `battle-skins/_glass-variants.css`. 링은 `syncBattleParty` 가 행에 심는 `--battle-hp-pct`·`data-hp-state` 를 읽는다.
  - **색** `themeVars`: rm2000·rm2003 을 뺀 스킨은 `_glass-variants.css` 가 `--battle-window-*` → `--rm-floor/card/hairline…` 별칭으로 흘려 넣는다.
    검은 창·코발트 창은 흰 테두리·각진 모서리. 배경 보정은 `--battle-backdrop-filter`.
  - 지운 파일: `_octopath/_chrono/_bravely/_dragonquest/_ff/_mother/_goldensun/_mv/_vxace/_hud-templates.css`(약 1,500줄). 스킨별 ATB 가속
    (`battle/runtime.ts`, chrono 1.18 등)과 전환 연출(`_transitions.css`)은 유지한다.
  - `isDeprecatedBattleSkin`·`(지원 종료)` 드롭다운 경로는 남아 있다(지금은 해당 스킨 없음). 드롭다운 순서는 `ACTIVE_BATTLE_SKIN_IDS`(기본 셋 → 정면 → 측면).
  - `test/fixtures/battleEnemyFeetRatios.json` 의 9종 항목은 해당 구도(rm2000/rm2003) 실측값의 사본이다 — 필드 기하가 같아졌기 때문이다.
- 코드 권위자: `src/battle/skins/registry.ts` (`ACTIVE_BATTLE_SKIN_IDS` / `listActiveBattleSkinIds()` / `isDeprecatedBattleSkin()`), 저작 표면은 `src/editor/panels/databaseSystemView.ts`, 계약 테스트는 `test/battleSystemDeprecation.test.ts`.

## Roguelike run boundary (2026-08-24)

- Battle entry copies `session.roguelikeRun` into the battle-event read snapshot, so troop forks/pages may evaluate `run` conditions consistently with map events.
- `runControl` is intentionally unsupported in troop command execution in Phase 1 and is classified runtime-partial there. Run lifecycle mutations belong to map/common events until an explicit battle-result bridge is designed.

## 연계기 · 위치 범위기 · 기술 포인트 (Chrono Trigger 계열, 2026-09-26)

세 필드 모두 **값이 있을 때만 저장**한다(없는 옛 프로젝트·세이브는 동작·바이트 그대로).

- **연계기** `SkillRecord.comboActorIds`(2~3명, 시전자 포함). 판정 단일 권위는 `battleActorSkillFailure`(`src/battle/battleSkillUse.ts`) —
  런타임 명령 적법성·전투 메뉴·자동 전투가 같은 함수를 쓴다. 동료 전원이 참전·생존·행동 가능·침묵 아님·MP 충분이고
  **준비**(gauge: 게이지 100 / strict: 이번 라운드 미명령)여야 한다. 연계 멤버는 따로 배우지 않아도 목록에 뜬다(`comboSkillIdsFor`),
  동료가 참전하지 않으면 숨고 준비 안 됨이면 사유와 함께 비활성. 사용 시 각자 `mpCost` 소비, 동료 게이지 0 + gauge 사이클 행동 처리,
  strict 는 동료의 대기 명령을 지운다. 위력·명중은 시전자 능력치. 대사는 `A·B의 연계기 — 기술명!`(battleDirectorDom `commandLine`).
- **위치 범위기** `SkillRecord.area {shape: circle|line, radius}`(전투장 px). 단일 대상 스코프(enemy/ally)에서 주 대상이 정해진 뒤
  `areaTargets`(`battleTargetResolver.ts`)가 같은 편 생존 배틀러를 더한다 — circle 은 battleX/battleY 유클리드 거리, line 은 |dy| ≤ radius/2.
  아군 명령·적 AI 실행·적 AI 효용·자동 전투 점수가 모두 이 함수를 쓴다. 좌표는 트룹 `members[].x/y`(>150 은 진형으로 재배치됨 주의).
- **기술 포인트** `EnemyRewards.tp` → `BattleRewardsSnapshot.tp`(트룹 합계). `ActorLearnedSkill.tp`(배우 전용, 직업·종족 습득표에는 없음)가 있으면
  **레벨만으로는 배우지 않고** 누적 TP ≥ tp 이고 level 도 채워야 배운다(`computeTechPointLearning`, `battleLevelUp.ts`). 승리 시 살아남은 보상 대상이
  TP 를 받아 `PlaySession.actorTechPoints` 에 쌓이고(`applyBattleRewardsToSession`, 레벨업 뒤) 배운 기술은 `actorSkillIds` 로 들어간다.
  결과 화면은 `rewards.techLearned` 미리보기로 「기술 포인트 +N」「○○ 기술 습득」 행을 띄운다. 세이브는 `actorTechPoints` 를 저장·복원한다.
- 저작: `upsert_skill` 의 `comboActorIds`·`area`, `upsert_enemy` 의 `rewards.tp`, `upsert_actor` 의 `learnedSkills[].tp`(없는 배우·인원 수·반경·음수 TP 는 ToolError).
- 검증 증거: `node scripts/runtime-qa.mjs --scenario ct-techs`(`scripts/qa/runtime/ct-techs*.m*`), 헤드리스 TP 는 `scripts/qa/runtime/ct-techs-tp.mts`.

## 전투 자원 · 감정 · 장비 부여 (JRPG 레인 L3, 2026-09-27)

전부 **system 에서 켤 때만** 동작하고 값이 있을 때만 저장한다(정규화가 기본값·꺼짐을 생략). 옛 프로젝트는 스냅샷에 게이지 필드조차 없다.

- **리미트** `system.limitGauge {enabled,label?,takenRate?=100,dealtGain?=5}` → 아군 `MutableBattler.limitGauge`(0~100).
  맞으면 `받은 HP / 최대 HP × takenRate` 만큼, 명중시키면 `dealtGain` 만큼 찬다. `SkillRecord.limitSkill` 은 100 일 때만 쓰고(`limitNotReady`) 쓰면 0.
- **기력(제2 자원)** `system.resource2 {enabled,label?,max?=100,start?=0,dealtGain?=5,takenGain?=10}` → `MutableBattler.resource2`,
  `SkillRecord.resource2Cost` 로 소모(`insufficientResource2`). 이름이 tp 가 아닌 이유: 이 저장소의 TP 는 기술 습득 포인트(`rewards.tp`)다.
- **파티 공용 게이지** `system.partyGauge {enabled,label?,max?=100,gainPerHit?=10}` → `BattleSnapshot.partyGauge`. 아군→적 명중마다 차고
  `SkillRecord.partyGaugeCost` 로 추격 연계기가 쓴다(`insufficientPartyGauge`, `battleActorSkillFailure` 의 5번째 인자).
- 충전은 한 곳: `noteDamageHit`(runtime.ts) → `applyBattleHitGauges`(`src/battle/battleGauges.ts`). HP 피해가 0 이면 아무것도 안 찬다. 게이지는 피해 숫자·rng 를 바꾸지 않는다.
- HUD: `battleFieldDom` 배우 행에 `.battle-resource-gauge-{limit|resource2}`(role=meter), 파티 패널 끝에 `[data-testid=battle-party-gauge]`. 켠 자원만 그린다.
- **감정** `StateRecord.emotion {family,tier}` — 배틀러는 감정을 하나만 가진다. 같은 계열을 다시 걸면 한 단계 오르고(최고 단계에서 멈춤) 다른 계열은 바꿔 끼운다
  (`applyStateEffectsWithEmotion`, `src/battle/battleEmotion.ts`). `system.emotionCycle [{attackerFamily,targetFamily,multiplier}]` 은 속성 배율 칸에 곱해진다.
- **약점 추가 행동** `system.weaknessExtraAction` — 아군 공격이 속성 배율 > 1 인 적을 맞히면 그 적이 「쓰러지고」 공격자가 한 번 더 행동한다(행동당 1회).
  쓰러진 적은 제 차례(`executeEnemyAction`)가 오기 전까지 다시 추가 행동을 주지 않는다. gauge 는 `finishGaugeActorCommand`, strict 는 기존 추가 행동 큐 삽입을 그대로 쓴다.
- **장비 부여** `EquipmentRecord.grantsSkillIds` / `grantsCommand` → `EquipmentRuntimeEffects.grantedSkillIds/grantedCommands`. 스킬은 배우지 않아도 `battlerHasSkill` 로 적법,
  메뉴·자동 전투는 `battlerSkillIdsWithGrants`, 명령은 `battleCommandsForActor({grantedCommands})` 가 클래스 명령 뒤에 붙인다.
- **MP 소모 절반** `effectFlags.halfMpCost` 는 이제 살아 있다: `battleSkillMpCostFor` 가 `floor((cost+1)/2)` 로 적법성·소비·메뉴 표시를 모두 맞춘다.
- **장착 장비 제자리 강화** `ItemUpgradeRule.target: "equipment"` — from/to 가 장비 id. 누가 끼고 있으면 그 슬롯을 바로 바꾸고(같은 부위·슬롯 수용 검사), 아니면 가방 한 개를 바꾼다(`applyItemUpgrade`).
- 저작: 시스템 탭 「전투 자원」, 스킬 카드 「전투 자원」, 상태 전투 규칙 패널의 「감정 계열/단계」, 장비 카드 「장착 시 스킬·명령」, 생활·제작 업그레이드 「장비 강화」. AI 도구는 `set_project_settings.battle.*`·`upsert_skill`·`upsert_state`·`upsert_equipment`·`upsert_item_upgrade.target`.
- 테스트: `test/mgL3BattleGauges.test.ts`, `mgL3BattleGaugeHud`, `mgL3BattleEmotion`, `mgL3EquipmentGrants`, `mgL3BattleResourceEditor`.

## Chrono Trigger 전투 엔진: Active ATB · 상태 · 반격 · 자동 부활 · 적 이동 · 승리 포즈 · 필드 배경 (2026-09-26)

전부 **값이 있을 때만 저장**한다(정규화가 기본값을 생략). 옛 프로젝트는 바이트·동작 그대로다.

- **ATB 방식·속도** `system.atbMode?: "active"|"wait"`(기본 wait), `system.atbSpeed?: 1..8`(4 = 기존, 작을수록 빠름 — `atbSpeedMultiplier`, 1 = ×1.45, 8 = ×0.4, 스킨 가속과 곱한다).
  Active 는 **gauge 흐름에서만** 켜진다. 런타임 `tick` 이 `actorCommand`/`targetSelect` 국면에서도 `tickDuringMenu` 로 적 게이지를 채우고
  적만 차례를 받는다(메뉴 주인이 아닌 아군은 게이지만 찬다). 적 행동 뒤 `restoreMenuAfterEnemy` 가 메뉴(대상 선택이면 살아 있는 후보로 좁힌 선택)를 되돌리고,
  메뉴 주인이 쓰러지거나 행동 불가가 되면 명령을 거둔다. 표시 계층 `battleDom` 의 200ms 틱이 메뉴 중에도 `tick` 을 부르고, 그렇게 적이 움직이면
  `battle-scene[data-battle-enemy-acted-during-menu="true"]` 를 남긴다. `data-battle-atb-mode` 로 방식이 보인다. 저작: `set_project_settings battle.atbMode / battle.atbSpeed`.
- **상태 런타임 효과**(`StateRuntimeEffects`, `battleStates.ts`):
  - `freezesGauge`(스톱): 충전 배율 0 — `nextReadyBattler` 는 배율 0 배틀러에게 차례를 주지 않는다. `canBattlerAct` 도 false 라 strict 에서는 행동 불가.
    gauge 사이클 계수(`markGaugeActionCycle`)는 멈춘 배틀러를 기다리지 않고, 사이클이 닫힐 때 멈춘 배틀러의 상태 처리(자연 회복)를 한 번 돌린다.
  - `physicalDefenseMultiplier` / `magicDefenseMultiplier`(프로텍트/실드): `defenseMultiplierForStatesByKind(project, target, "attack"|"mind")` 가 공용 `defenseMultiplier` 에 곱한다.
    통상 공격(아군·적)과 `applySkillHit` 이 스킬의 `effect.statistic` 으로 고른다. 예측·gen1 경로는 공용 배율 그대로다.
  - `forcedAction: "attackRandom"`(버서크): gauge 는 차례가 오면 명령 없이 무작위 적 통상 공격(`berserkAttackCommand`), strict 는 라운드 시작 때 그 명령을 대기열에 넣는다(`queueBerserkStrictCommands`), 적은 `chooseEnemyAction` 이 무작위 아군 통상 공격을 고른다.
  - `elementRates`: 활성 상태의 등급이 레코드 등급을 덮는다(나중에 걸린 상태가 이김, `stateElementRateOverride`). `elementMultiplierFor` 만 읽는다.
  - 저작: `upsert_state` 의 `runtimeEffects` 에 위 필드.
- **반격** `EnemyRecord.reactions?: { trigger: "physical"|"magic"|속성 id; skillId("" = 통상 공격); chance }[]`. 아군의 피해 타격이 **살아 있는** 적에게 명중하면
  (`applySingleActorAttack`·`applySkillHit` → `queueCounter`) 첫 번째로 맞는 반응 하나를 예약한다(타격당 최대 1회). 행동의 모든 타격이 끝난 뒤
  `drainCounters` 가 차례 밖에서 `executeEnemyAction` 으로 쓴다 — 게이지·행동 사이클은 건드리지 않는다. 대상은 때린 배우(없으면 기본 표적).
  타임라인 `counter` 엔트리(대사 「○○의 반격! — 기술」) 뒤에 피해 엔트리가 온다. 반격은 반격을 부르지 않는다(적→아군). 저작: `upsert_enemy.reactions`(trigger·skillId·chance 를 도구가 검증).
- **자동 부활** 장비 `effectFlags.autoRevive?: 1..100`(최대 HP %). 여러 장비면 최댓값(`EquipmentRuntimeEffects.autoRevive`). `resolveOutcome` 첫머리의
  `applyAutoRevives` 가 전투당 배우 1회 되살린다 — 전멸 판정보다 먼저라 패배를 막는다. 타임라인 `revive`(amount = 되살아난 HP), 시퀀서가 회복 피드백으로
  원장(`battlePresentation`)의 쓰러짐을 걷는다. 저작: `upsert_equipment.effectFlags.autoRevive`(0~100 정수, 0 = 해제).
- **적 이동** m2 `m2-218-move-enemy` fields `{target: "enemy-N"|적 id, x, y, durationMs?}`(카탈로그 모던 행, 전투 전용 → 피커 2탭 「전투」, troop 컨텍스트 full)
  와 행동 `EnemyActionPattern.moveTo?: {x, y}`(행동 직전 이동, 400ms). 둘 다 `moveBattler` 로 `battleX/battleY`(위치 범위기가 읽는 값)와 `authoredX/authoredY`
  를 같이 바꾸고 `moved {durationMs, sequence}` 를 단다. 타임라인 `move`. 표시(`resolveEnemyRowPositions`)는 moved 적만 자동 진형·충돌 회피를 건너뛰고
  `resolveSkinEnemyPosition(…, autoAlign=false)` 좌표에 세우며, `.battle-enemy[data-battle-move-sequence]` 의 left/top 트랜지션(`--battle-move-ms`)으로 미끄러진다.
  좌표계는 트룹 `members` 와 같다(측면 스킨 y 는 ×2/3). 저작: `upsert_troop_battle_page` commands 의 m2Command.
  **카탈로그 규모가 125 → 126** 이다 — `test/m2EventCommandCatalog.test.ts`·`test/m2RuntimeSupportCompleteness.test.ts` 의 125 고정값과
  `test/fixtures/m2AliasCoverage.json`·M2 표면 기준선에 새 행이 반영돼야 한다(이 변경에서 테스트는 돌리지 않았다 — 감독자 게이트 몫).
- **승리 포즈** `BattleBattlerPose` 에 `victory`. 승리 결과면 살아 있는 아군 스냅샷이 `victory`(쓰러진 아군은 dead). 칸은 `VICTORY_POSE_FRAME`(행 1 열 2)이고
  `POSE_FRAME` 에는 넣지 않았다(시트 계약 테스트가 POSE_FRAME 칸마다 그림을 요구한다). 기존 생성 시트는 그 칸이 비어 있어 `battleFieldDom.victoryFrameFor` 가
  시트 URL 당 한 번 칸을 실측하고 비었으면 idle 칸을 그린다(`data-battle-pose-frame="victory"|"idle"`). 노드는 `data-battle-pose="victory"`·`.battle-pose-victory`.
- **필드 배경** `system.battleBackdrop?: "field"`. `playSceneBattle` 이 진입 직전 Phaser `renderer.snapshot`(WebGL 버퍼가 비기 전 다음 프레임, 250ms 제한, 실패하면
  트룹 배경)으로 현재 필드 화면(주인공 주변 카메라 시야)을 jpeg dataURL 로 찍어 `mountBattleScene({ fieldBackdropUrl })` 로 넘긴다. `applyFieldBackdrop` 이
  `battle-backdrop[data-backdrop-source="field"]` 로 갈아끼우고, 전투 이벤트가 배경을 바꾸면(changeBattleback) 그쪽이 이긴다.
  진입은 **제자리 페이드**: `createSkinBattleTransition(…, inPlace=true)` 가 막대·소용돌이·스킨 커버를 빼고 180ms 어두워진 뒤 전투 UI 만 페이드 인
  (`battle-scene[data-battle-backdrop-kind="field"]`, 23-entry-exit.css). 필드 위에 전투를 직접 그리는 온맵 전투는 범위 밖이다. 저작: `set_project_settings battle.backdrop: "field"|"default"`.
- 검증 증거: `node scripts/runtime-qa.mjs --scenario ct-engine`(`scripts/qa/runtime/ct-engine*.m*`, 하네스에 `waitForStyleVar`·`repeatUntil` op 추가) —
  필드 배경 · 메뉴를 연 채 적 행동 · 물리 반격 · 자동 부활 · moveEnemy 뒤 렌더 좌표 · 승리 포즈. 헤드리스 수치는
  `scripts/qa/runtime/ct-engine-numbers.mts`(스톱 게이지 0 · 버서크 자동 공격 · 프로텍트/실드 계열별 피해 · 상태 속성 덮어쓰기 · 행동 moveTo 좌표).

## Battle rules & runtime
- Battle rules belong in `src/battle`; scene or DOM code should render/bridge them rather than becoming the source of truth.
- **전투를 시작하는 모든 재진입 경로는 `scene.running = true` + `setInputEnabled(false)` 를 직접 걸고
  `finally` 에서 되돌린다 (2026-08-28 실울).** 전투는 DOM 오버레이일 뿐이므로 Phaser 맵 장면은
  그동안에도 `updatePlayScene` 을 계속 돌린다. 잠금을 걸지 않으려면 전투 중 누를 화살표가 전투 커서와
  맵 이동을 동시에 조작하고, 걸음이 완료될 때마다 `maybeTriggerRandomEncounter` 가 다시 들어와
  `encounterAccumulator` 가 계속 쌓이며 전투가 겹쳐 시작된다.
  - 가드가 걸린 경로: `playSceneFieldSpawns.runFieldSpawnEventBattle`, `playSceneInterpreter.runCommands`
    (이벤트 `battleProcessing` 은 `runCommands` 의 가드를 보고 자기는 안 걸어준다),
    `playSceneMovement.runRandomEncounterBattle`.
  - `if (scene.running) return` 만 쓰면 재진입이 막힐 것으로 보이지만, 전투를 `void` 로 띄우면
    그 함수가 항상 자기 가드를 무효화한다. 회관: `test/encounterInBattleGuard.test.ts`.
  - `src/testing/sceneTestRunner.ts` 의 헤들리스 미러는 `runHeadlessBattle` 이 동기 루프라 구조상
    이 버그가 없다 — 거기에 `running` 을 드리지 않는다.
- Battle DOM is intentionally presentation-only and compact: render the field, message window, command / tool list, party status, target prompt/brackets, and result rewards without duplicating runtime predictions into extra analysis panels.
### 전투 화면 표현 · 전환 · 타임라인 · 연출 타이밍

- Battle presentation for the one authorable classic skin (`rm2000`, renamed from `rm2003` on 2026-09-03) is a **front-view field with a modern glass HUD**: enemies stand on the field, party battlers are not drawn (`partyFacing: "hidden"`, `showAllySprites: false`), the command card sits bottom-left (16px command icons on the root menu, pill cursor), the party card sits bottom-right (name + level badge + HP/MP gauges and tabular numbers in `--runtime-ui-font`, no pixel font; 1–2 actors get 48px two-line rows, 3+ actors 24px rows), cards are glass surfaces from the shared `--runtime-glass-*` tokens framed by `box-shadow` rings (the project windowskin is opted out with `--battle-window-skin-width: 0`), and the message banner is a top glass strip for intro/acting/impact only (hidden on command and result). Round 2 (same day): the single UI accent is amber (`--battle-accent: #f2c063` — cursor, active actor, ATB, confirm, critical popups); a turn chip on the command card names the acting actor (`battleCommandDom` stamps `data-actor-name`, the skin draws it with `attr()`), the strict-flow progress (`.battle-flow-status`) is a right-hand glass chip instead of a grid row; the HUD band shows the blurred battle backdrop through `.battle-scene::before` (`--battle-backdrop-url` mirrored onto the root by `syncSceneBackdropVar`); the skin's bottom fade lives on `.battle-field::before` so the shared hit/critical/victory/defeat flashes on `::after` (15-juice-capture-fx.css) are no longer suppressed; and actor damage in party-hidden skins anchors to the party card row (`showPartyRowDamage`: popup over the HP number + `is-hit` shake/tint for 480ms) instead of floating at the field origin. Enemy sprites are drawn opaque — no radial scrim, no `--battle-sprite-filter` brightness stack, and no `battle-target-pulse` (that animation toggled sprite filters on the selected target and read as transparency). Targeting is the corner reticle only. Window chrome comes from the project windowskin (`_windowskin.css`). Keep `src/player/battleJuice.ts` as the only juice/SFX helper for battle DOM. **전투 오디오는 자료집 → 시스템 → 시작 설정의 「전투 오디오」에서 고른다.** `system.battleBgmResourceId`(전투 BGM) · `battleVictoryMeResourceId`(승리 팡파레 ME) · `battleDefeatSeResourceId` · `battleEscapeSeResourceId`. 슬롯이 비면 런타임 폴백(스타터 전투곡 / 합성 팡파레 / RTP 붕괴·도주음). 승패가 나는 순간 `beginBattleResultAudio` 가 전투 BGM 을 끊고 저작 큐를 재생한다. 씬을 닫을 때 `exitBattleAudio` 는 필드곡을 되돌리거나 — 필드곡이 없으면 — 엔진의 전투곡을 실제로 멈춘다. 대상 선택에서는 메시지 창이 조준을 말하므로 하단 `.battle-target-prompt` 는 이 스킨에서 접는다. 표준 커맨드 라벨은 `battleCommandKindLabel` 이 프로젝트 용어를 쓴다. There is no in-field troop-title element (`.battle-title` was removed) — the intro banner `introDirectorState` announces the troop in the message window. Enemy troop coords that sit too far center (`x>150`) are recentered into a left-side formation in `enemyBattlers`. Front-facing skins must prefer each actor's authored `battleCharacterResourceId`; generic skin warrior/mage art is fallback-only, never actor identity. `BattleBattlerSnapshot` carries the authored battle resource plus the live session `faceResourceId` (a standalone 48×48 face graphic id — there is no face index any more), the rm2000 party card shows the face as a small rounded portrait when the actor has one (20px in compact rows, 40px in two-line rows). Damage feedback is scoped to the single impact beat: approach/recover beats explicitly clear it so one timeline hit creates one popup.
- Battle encounter transition lives in `src/player/battleTransition.ts` and is wired by `playSceneBattle.playBattle`: white double-flash → black blinds close (battle DOM mounts underneath) → blinds open into the intro (backdrop zoom-out, enemies slide in from the left, per `--enemy-index` stagger in `_rm2000.css`). Battle end fades to black, tears down, fades back to the field. Keyboard: Z/Enter confirm, **X/C/Escape are all cancel** one level at a time (target select → its originating skill/item submenu, submenu → command root), and arrows wrap while skipping native-disabled rows. `battleDom.ts` owns one cursor model shared by root/submenu/target controls and keeps pointer, focus, cursor, and selected target synchronized across rerenders. A focused native button's Enter is left to the browser click path; the root/window handlers must not dispatch it a second time. The window fallback identifies root-originated events from `KeyboardEvent.composedPath()` (with a containment fallback), because target navigation may rerender and detach `event.target` before the same event finishes bubbling. The play-shell key handler in `player.ts` treats `battle-scene` as a modal overlay, so ESC/X during battle never opens the field status menu (RM2003 has no field menu in battle). The touch virtual pad is hidden while a battle scene is mounted (`.play-stage:has([data-testid="battle-scene"]) .touch-pad` in touchpad.css) so the d-pad cannot cover command buttons; battle commands are tapped directly. Message/result surfaces are live regions, AUTO/speed expose pressed state, and reduced-motion clamps sequencer delays to `min(ms, 250ms)` (reading time is kept) while CSS disables decorative movement and keeps damage popups static and visible.
- 배틀 씬 루트(`.battle-scene`)의 **불투명 배경은 씬 안에서 맵을 가린다**. 2026-09-20부터 host 전체는 추가 `.battle-stage`가 덮어 비율 차이로 생긴 여백도 가린다. 루트는 `background: #000` 이고 그 뒤에는 필드 Phaser 캔버스가 계속 살아 있으므로, 루트의 `background-color` 를 알파 색으로 애니메이션하거나 루트를 `translate` 하면 그대로 맵이 보인다(실측: `battle-flash-hit` 이 루트 알파를 0.055까지 내려 필드-HUD 4px 거터와 HUD 패널 사이로 마을 타일이 드러났다. 셰이크는 루트를 ±5.9px 밀어 같은 틈을 만들었다). 따라서 히트/크리티컬 플래시 색은 `15-juice-capture-fx.css` 의 `.battle-field::after` 자식 오버레이가 그리고, `battle-screen-shake` 는 `.battle-scene.battle-screen-shake .battle-field` 로 **필드 자식만** 흔든다(`04-anim-damage-layers.css` + `06-damage-flash-targeting.css` 의 `battle-field-shake`). 클래스 이름(`battle-flash-hit|critical|victory|defeat`, `battle-screen-shake`)은 `battleJuice.ts` / `battleAnimationDom.ts` 계약이라 그대로 유지한다. 회귀 잠금: `test/runtime/battle-flash-map.spec.ts`.
- Target authority is centralized in `src/battle/battleTargetResolver.ts`. The authored `SkillRecord.scope` (`self | ally | allAllies | enemy | allEnemies`) is preserved for actor and enemy casters; effect kind must not rewrite it. `self`/all-target scopes resolve immediately, while singular ally/enemy scopes require selection from living battlers on the resolved side. `BattleRuntime.selectTarget` / `setSelectedTarget` and `BattleTargetSelectionSnapshot.targetIds` / `selectedTargetId` are the generic API. `targetEnemyId` and enemy-only methods remain compatibility aliases; ally commands add `targetActorId` and actor target aliases without breaking old callers.
- Battle skill legality is shared through `src/battle/battleSkillUse.ts`: MP cost is `max(0, trunc(flat) + floor(maxMp * percentMax / 100))`, and missing, unlearned, or unaffordable skills are invalid. Direct runtime calls are no-ops for invalid skills; they must never silently become a basic attack. The skill menu uses the same check and exposes native `disabled` plus a reason in title/ARIA.
- `BattleSnapshot.timeline` is the canonical ordered, append-only presentation fact stream. It records actions, damage/healing, misses, captures, switches, state upkeep/add/remove, and incapacitated skips with monotonic sequence values; legacy `actionLog` remains for compatibility. Strict `roundLogs[].timeline` is the exact round slice, including setup upkeep before the first command and a terminal setup slice when outcome resolution ends the battle before command collection. A forced replacement continues that same strict round rather than resetting its timeline boundary. `battleSequencer.ts` starts its consumed cursor at sequence zero and plays every unconsumed pre/post snapshot fact exactly once, including immediate self/all-target commands, multi-hit attacks, and enemy advances. When an action produces a terminal result, its final timeline line remains for `BATTLE_RESULT_HOLD_MS` before the result panel replaces it.
- Battle presentation timing constants live in `src/player/battleSequencer.ts` and are consumed as sequencer `delay` values, not as CSS: `BATTLE_INTRO_MS = 1_200` (intro hold), `BATTLE_KILL_LINE_MS = 660` (kill line dwell), `BATTLE_RESULT_HOLD_MS = 900` (pause before `revealResult`). The result hold was 2_200 and stacked on top of the kill line to produce ~3.1s of dead air after the killing blow; keep the two together under ~1.7s. Intro CSS must settle inside `BATTLE_INTRO_MS`: in `src/styles/runtime/battle/02-intro-reveal.css` every intro animation adds `--battle-reveal-ms` (300ms cover) to its delay: ally `550ms` at `+60ms`, `.battle-enemy-list-panel` / `.battle-party` `420ms` at `+480ms` (ends 1200ms). Do not raise that panel delay — beyond it the panel pops in after the command host becomes visible.
- Generated battle effects (`generated-battle-anim-*`) use the catalog-owned 75ms frame interval in both battle DOM and map `showAnimation`; legacy/authored records retain `BATTLE_ANIMATION_FRAME_MS = 120`. `battleAnimationFrameDurationMs(record)` is the shared authority for playback, total duration, and flash/shake frame-to-ms conversion. Keep these consumers aligned or the visual frames, wait duration, and CSS effects drift apart.
- **생성 이펙트 시트는 384×384 프레임 · `sheet.assetScale` 0.5 다 (2026-09-03, 설계 `docs/superpowers/specs/2026-09-03-battle-effect-hires-design.md`).** 예전 96px 시트는 48 격자를 2배 복제한 것이라 무대에서 한 픽셀이 4 CSS px — 몬스터 배틀러(384px 원본, 밀도 1.6)의 1/10 밀도였다(`probe-battle-anim-frames.mjs --label=before` 실측 0.17). 지금은 밀도 1.33 으로 같은 급이다.
  - `BattleAnimationSheet.assetScale` = 시트 1px 이 차지하는 전투 논리 px. **없으면 2**(320 시대 RM 자산: EasyRPG RTP·Scarloxy). 정규화(`normalizeBattleAnimationRecord`)가 채우므로 저장물 마이그레이션은 없다. `battleAnimationPlayback.ts` 의 `battleAnimationSheetAssetScale / RmScale / Rendering` 이 유일한 파생 지점이다.
  - 런타임(`battleAnimationDom.animationCell`)은 **프레임 비트맵 크기에만** 시트 배율을 곱한다. 셀 오프셋 `cell.x/y` 는 시트 해상도와 무관한 RM px 라 계속 `BATTLE_ASSET_PIXEL_SCALE`(2) 로 환산한다 — 여기에 시트 배율을 곱치면 고해상도 시트의 오프셋이 1/4 로 준다(`test/battleAnimationSheetScale.test.ts`).
  - 축소해 그리는 시트(assetScale < 1)만 `data-rendering="smooth"` → `image-rendering: auto`. 픽셀아트 시트는 그대로 `pixelated`.
  - 편집기 미리보기 3곳(DB 애니메이션 스테이지·스킬 연출 카드·이벤트 showAnimation)과 맵 `showAnimation` 은 RM px 좌표계라 `RmScale`(assetScale/2 → 레거시 1, 신규 0.25)을 곱한다. 레거시는 픽셀 하나도 달라지지 않는다.
  - 생성기: `scripts/lib/effectSheet/raster.mjs`(SDF 안티에일리어싱 프리미티브, float 프리멀티 버퍼, over/add 합성) + `recipes.mjs`(코어·충격파·파편·번개·파티클·마법진·기둥·구름) + `effects/{impact,arcane,monster,utility}.mjs` 34 페인터. 페인터 좌표계는 **전투 논리 px(192 단위)** 라 해상도와 독립이고, 래스터 배율은 카탈로그 `frameWidth / 192` 가 정한다. 프레임 i 는 구간 **가운데** 진행도 `(i+0.5)/n` 으로 그린다 — 끝점 포함으로 뽑으면 p=0 첫 컷이 빈 화면이었다(실측 14종).
  - PNG 는 `pixelPng.writePng(..., { filter: "adaptive" })` + 6비트 양자화(`toStrip`). 글로우 그라디언트는 필터 없는 8비트로 두면 시트 한 장이 1MB 에 가깝다(실측 956KB → 320KB). 34종 합계 약 6.9MB — 몬스터 idle 스트립 한 장(117~346KB)과 같은 급이고, 웹 내보내기는 참조된 시트만 복사한다. 기본 필터는 바꾸지 않았다(다른 생성기의 커밋 바이트 재현성).
  - 전체화면 이펙트(arcane-nova·summon-portal·meteor-fall)는 카탈로그 `cellZoom: 200` 으로 셀 zoom 200 → 무대 384 논리 px 를 덮는다. 나머지는 100.
  - 계약 테스트 `test/generatedEffectSheets.test.ts` 는 slug 당 **한 번** 렌더해 캐시한다(384px 한 장 0.5~3초, 34종 약 30초). 가장자리 2px 띠 알파 < 8 검사가 잘림을 잡는다 — 밖에서 들어오거나 나가도록 의도한 9종(번개·빛기둥·투사체·잎·운석·칼바람·음파·돌진·흡수)만 `EDGE_ENTRY_EFFECTS` 에 이유와 함께 예외다.
  - 시각 증거: `node scripts/qa/probe-battle-anim-frames.mjs --anims=<id,...> --label=<name>` 이 `qa-back-battler.html` 하네스로 실제 전투 화면에서 **가짜 시계**(`page.clock`, 반드시 `pauseAt`)로 프레임마다 한 장씩 찍는다(`verify-shots/battle-anim-overhaul/<label>/<anim>/frames.png`, `metrics.json` 에 밀도). `battle-anim-compare-sheets.mjs` 가 before/after 병치와 34종 카탈로그 시트를 만든다. 픽스처(`editor-authored-demo-v3.json`)의 `anim_heal`/`anim_magic` 은 저작된 3프레임 레거시 레코드라 번들 수렴이 덮지 않는다 — 회복·마법 이펙트를 보려면 `anim_gen_*` id 를 쓴다.
- A normal actor `attack` must attach a `BattleAnimationSnapshot` to the same timeline entry as its damage/miss. `normalAttackAnimationId()` resolves the authored visual in this order: actor `unarmedAnimationId` when no weapon is equipped → effective class `animationId` → actor `unarmedAnimationId` fallback → `skill_attack.animationId`. This is separate from the skill execution path; do not assume the Attack command calls `applySkill`. Double/all attacks attach one animation per hit so the sequencer can play every impact.
- Every generated effect owns one catalog `sound { frameIndex, resourceId }`. `defaultBattleAnimationRecords()` merges sound, flash, and shake that share a frame into one `BattleAnimationTiming`, because battle DOM and map `showAnimation` consume one timing per frame. Do not nest sound under flash: effects such as `earth-spike` require impact audio without a flash.
- Battler display names are disambiguated in one place: `disambiguatedBattlerName(battler, peers)` in `src/player/battleCommandDom.ts` appends ` 1` / ` 2` only when two peers share a name, and returns the bare name otherwise. It is the single source for the HUD row, target button, target label, damage messages (`battleDirectorDom.ts` `impactLine`), and defeat lines (`battleSequencer.ts`); pass `snapshot.enemies` for an enemy target and `snapshot.actors` for an ally. Because it can produce digit-final names, `hasBatchim` in `src/util/josa.ts` reads a trailing arabic digit as its Korean pronunciation (1/3/6/7/8/0 have batchim, 2/4/5/9 do not) so a defeat line renders `슬라임 2를`, not `슬라임 2을`. Covered by `test/josa.test.ts`.
- AUTO command choice belongs to `BattleRuntime.chooseAutoCommand()` / `src/battle/battleAuto.ts` and uses the session-injected RNG, never DOM `Math.random()`. Policy order is forced switch → useful recovery → affordable damaging skill → basic attack → defend; AUTO does not consume items. Enemy AI likewise filters illegal/ineffective skills, scores useful actions and targets (including HP utility), and calls RNG only when the best score is tied.
- Equipment `effectFlags.doubleAttack` repeats the authored attack pass and `effectFlags.attackAll` expands each pass to every living opponent; combining them yields one ordered timeline fact per hit. Multi-target items apply to every resolved target but consume one inventory unit per command.
### 커맨드/대상 메뉴 기하와 글자 가시성 계약

- 커맨드 메뉴는 **고정 행 높이 + 내부 스크롤**이다. 행 높이는 `.battle-scene` 의 `--battle-command-row-height`(기본 23px, `battle/10-compact-hud-stage.css`) 하나로 결정되고, 루트 메뉴·서브메뉴·대상 메뉴가 모두 `grid-auto-rows: var(--battle-command-row-height)` 를 쓴다(`battle/11-compact-hud-row.css`, `battle/17-sprint-a-polish.css`, `battle-skins/_rm2003.css`). 행을 `1fr` 로 늘리는 옛 규칙(`repeat(5, minmax(0,1fr))`, 서브메뉴 `minmax(0,1fr)`, 대상 메뉴 `minmax(30px,auto)`)으로 되돌리지 말 것 — 항목 수에 따라 행이 늘었다 줄었다 했다(실측: 루트 22.9px vs 서브메뉴 12px vs 대상 30px). 넘치는 목록은 메뉴가 `overflow-y: auto` 로 스크롤하고, 키보드 커서는 `battleDom.ts` 의 `scrollIntoView({ block: "nearest" })` 로 따라간다.
- **뒤로(`actor-command-back`)/취소(`battle-target-cancel`) 버튼은 메뉴의 마지막 항목이다** — `.battle-command-panel` 의 형제로 두지 말 것. 패널 그리드 템플릿은 두 행(`minmax(0,1fr) auto`)뿐이라 세 번째 자식이 암시적 행을 만들고, 그 행이 남은 높이를 전부 가져가 메뉴 행(`1fr`)이 **0px 로 굶었다**(실측: `grid-template-rows` 가 `0px 13.5px 106.5px`, 메뉴 `clientHeight 0` / `scrollHeight 238` → 목록이 스크롤도 안 되고 박스 밖으로 흘렀다). 포켓몬 스킨의 뒤로/취소 규칙도 `.battle-command-menu >` 경로를 쓴다(`battle/19-adversarial-review-3.css`).
- **글자 가시성 계약 (2026-08-28): 행 높이는 그 행의 라인박스보다 커야 하고, 스크롤포트 높이는 행 피치의 정수배여야 한다.** 둘 중 하나만 어겨도 글자가 잘린다. 실측으로 확인한 함정들:
  - **행 내용 상자 < 라인박스** → 행마다 넘치며 아랫행에 겹치고, 마지막 행은 스크롤포트 경계에서 세로로 반 잘린다. rm2000(당시 rm2003) 은 라벨을 20px 로 올리는 늦은 재지정(라인박스 24px)이 23px 행(테두리 2px×2 → 내용 19px)에 안 들어가 전 국면이 깨져 있었다. 그 재지정을 삭제해 상위 기본값 16px(라인박스 19.2px)로 돌리고 행을 24px(내용 20px)로 뒀다. **글자를 키우려면 상자도 같이 키워라.**
  - **행 여백도 내용 상자를 깎는다.** `.battle-command` 는 세로 여백 0(`padding: 0 8px`), 대상 행도 같다(`padding: 0 12px`). 행은 이미 고정 높이 + `align-items: center` 로 정렬된다. 이 두 규칙은 **각각** 존재하니(대상 행 선택자가 더 구체적이라 공용 규칙을 덮는다) 한쪽만 고치면 증상이 그대로 남는다.
  - **피치 = 행 높이 + `gap`** 이므로 rm2000 은 커맨드/대상 메뉴 모두 `gap: 0` 이다. 간격이 남으면 어떤 정수배로도 포트를 나눌 수 없다.
  - 포트 높이는 `max-height` 가 아니라 **트랙을 직접** 고정해 맞춘다: `.battle-command-panel { grid-template-rows: calc(5 * var(--battle-command-row-height)) auto }`. rm2000 대상 국면은 프롬프트를 접고 `calc(4 * ...) auto` 다(다른 스킨은 여전히 `auto calc(3 * ...) auto`). `max-height` 는 가용 트랙이 상한보다 작으면 조용히 무효가 된다(실측: `1fr` 이 120px 를 주어 5.71행 → 마지막 행 82.5% 잘림). 패널 `row-gap` 은 4px — 공유 기본값 24px 로는 키 안내 트랙이 2px 로 굶어 `Z 확인 · X 취소` 가 83% 잘렸다.
  - 서브메뉴 행은 이름과 `MP n` 을 **한 줄**에 둔다(flex, 상세는 `flex-shrink: 0`). 세로로 쌓으면 24 + 13 = 37px 가 20px 내용 상자에 못 들어가 MP 가 통째로 사라진다.
  - **잘라내야 할 땐 식별 정보를 마지막에 남긴다.** 대상 행이 생략부호로 이름 끝을 지우면 동명 적의 구분 순번(`초원 슬라임 1/2`)이 사라져 대상을 못 고른다. 명령 레일을 232px 로 넓혀 저작 이름이 잘리지 않게 하고, 대상 프롬프트는 생략부호 대신 줄바꿈을 한다.
  - **파티 HUD 도 같은 산식이다.** `.battle-actor-status` 는 42px 상자에 이름행·수치행·HP/MP 바·ATB 게이지를 다 담아야 해서, 14px 수치(상자 22.5px)를 18px 이름행 안에 넣으면 `Lv`/`HP`/`MP` 숫자가 통째로 밀려난다. 기본 스킨만 멀쩡했고 나머지 11개 스킨이 이 한 가지로 스킨당 200여 건씩 냈다. 계산: 수치·레벨 12px, 수치행 `line-height: 1`(숫자·라틴만 다룬다), 이름행 `line-height: 1.125`(=18px — 한글 받침 때문에 1 은 금지), 스탯 바 4px, 게이지 8px, `gap: 0`.
  - 계측 하네스: `npm run qa:runtime -- --scenario battle-text`(출하 경로 player.html, 국면별 PNG + 판정 JSON)와 12스킨 전수 스윕 `node scripts/qa/battle-text-audit.mjs [--skins a,b] [--long-labels]`. 판정 산식은 순수 함수 `classifyInkGeometry`(`scripts/lib/battleTextAudit.mjs`)에 있고 `test/battleTextAuditGeometry.test.ts` 가 박는다. 기하는 `Range.getBoundingClientRect()` 로 재는데, 씬이 `transform: scale` 로 축소돼 마운트되므로 `clientHeight` 같은 논리 px 만 보면 화면 실측과 어긋난다.
  - 판정은 **세 갈래를 구분**한다: `clipped`(`overflow: hidden` 밖 — 영구), `sliced`(스크롤포트 경계에 걸침 — 반 잘려 그려진다), 스크롤로 도달 가능(결함 아님). 이걸 섞으면 커서가 데려오는 행을 결함으로 올리고 실제로 반 잘린 행은 놓친다(초판이 그랬다). 도입부 릴 애니메이션 중의 `opacity: 0`/0×0 과 `.defeated` 적(죽으면 `battle-death-fade` 가 `forwards` 로 0 에서 멈춘다)은 연출이므로 세지 않는다.
  - **알려진 한계**: 다른 요소에 **가려진**(occluded) 글자는 이 하네스가 판정하지 못한다. `elementFromPoint` 는 `pointer-events: none` 인 요소를 건너뛰는데 메시지 창이 바로 그렇다(`_rm2000.css`) — 그래서 창 안의 글자를 찍으면 뒷배경이 잡혀 오판한다. `occludedRatio` 는 기록만 하고 게이트로 쓰지 않는다. 실제로 남아 있는 사례: 대상 선택 국면에서 선택된 적의 HUD 카드 제목이 상단 메시지 창 밑에 들어간다. 제대로 잡으려면 힙테스트가 아니라 픽셀 비교가 필요하다.
- 행 설명(`.battle-command-text small`)은 **한 토막**만 보인다: 스킬 행은 `MP n`(`skillMpDetail`), 아이템/뒤로 행은 비어 있다. 범위·위력·상태 부여 같은 전체 설명은 `commandButton(..., hint)` 로 `title`/`aria-label` 에만 실린다. `MP 8 · 적 1명 · 위력 30 · 화상 부여` 식 합성 문구를 행에 되돌리지 말 것. 계약: `test/e2e/_battle-menu-fixed.spec.ts` (패널/행 높이 동일, 메뉴 박스 붕괴 금지, 설명에 `·` 금지, 오버플로 스크롤 + 커서 추적).
### 스킨 CSS 캐스케이드와 저작 가능 스킨

- Battle CSS cascade contract (2026-08-27): `src/styles/runtime/index.css` imports 18 battle leaves into `layer(runtime)` in source order and carries **zero importance flags**; per-skin files in `src/styles/runtime/battle-skins/` load after it, so a skin rule scoped to `[data-battle-ui-style="classic"][data-battle-skin="<id>"]` already wins on specificity + source order. `_rm2000.css` is therefore **flag-free**, and `test/battleRm2000PixelGrid.test.ts` audits three invariants for it: no forced declarations, every px literal even, and at most four even font-size steps (26 / 20 / 16 / 12 px — the 640x480 logical stage is drawn at half-integer device scales, so odd logical px land on half device pixels). When a shared or other-skin rule must keep its forced declaration for the other 11 skins, narrow it away from rm2000 with a **specificity-neutral** `:not(:where([data-battle-skin="rm2000"]))` / `:not(:where([data-battle-skin="rm2003"] *))` instead of raising specificity — that is what the generic battler sizes in `_battlers.css` do (`.battle-skin-actor-image`, `.battle-enemy-image`), and it is why the other skins stayed byte-identical when the 279 rm2003(now rm2000) flags were deleted. The consolidated classic layout lives in `_rm2000.css` scoped to `[data-battle-ui-style="classic"][data-battle-skin="rm2003"]`. An absolutely-positioned grid child uses its **grid area** as containing block — the message window spans `grid-column/row: 1 / -1` so `top` anchors to the scene, not the HUD row. `--battle-stage-inset-top` is declared **exactly once** (`battle/01-scene-base.css`) as `var(--battle-stage-skin-inset-top, 48px)`; a skin retunes the stage only through that knob (`_rm2000.css` sets `48px`), so the battler groups (`battle/07-640-scene-turn-ribbon.css`), `.battle-animation-layer` and `.battle-effects-layer` always resolve to the same box and the percentage `--battle-node-x/y` anchors land on the same point. The shared "compact HUD layer" in the battle leaves owns the 320x240 stage geometry (scene grid `1fr + var(--battle-hud-height)` = 96px, HUD row placement, victory box sizing) **and the typography floor**: all battle text sits on the runtime pixel grid (9px primary / 7px secondary Galmuri11, never sub-7px) - the old 2.5-7px "cram-to-fit" pass was removed because it rendered as unreadable smudge at integer stage scale. The root command menu shows one-line entries (`small` detail hidden unless the menu has a `.battle-submenu-header`), and `.battle-command-panel` is pinned to `height:100%` of its `battle-command-host` grid cell so larger type compresses rows instead of overflowing the HUD.
- Battle UI skin is project-level presentation. **All 12 registered skins are authorable since 2026-09-25** — 11 are glass-skeleton variants (layout × HUD × palette) and one is `pokemon` (see "지원 전투 시스템은 둘뿐이다" above for the exact contract). `system.battleUiStyle` (default `rm2000` via `DEFAULT_BATTLE_SKIN_ID` — unset/unknown resolve to the default, legacy `classic` → `rm2000`, legacy `rm2003` → `rm2000`, `pokemon` → `pokemon`). DOM stamps `data-battle-ui-style` in `battleDom.ts`; CSS under `src/styles/runtime/index.css` plus per-skin overrides in `src/styles/runtime/battle-skins/` own layout. Do **not** author per-map-event skins. If a fight needs a different skin later, override at `battleProcessing` / troop (same layering as `battleFlow`), not on every event row. Keep rules in `src/battle`; skins stay presentation-only. Pokemon skin uses its own 1:1 staging (enemy upper-right / ally lower-left) and does not reuse classic left-right columns.
### Gen 1(포켓몬식) 규칙 모델

- Gen1 rule model is authored as `system.battleModel` (`rm2k3` default, or `gen1`) and stamped on `body[data-battle-model]`. It gates **rules only**, never presentation. Exact cartridge-oriented authorities live in `src/battle/gen1/{rng,damage,capture,status}.ts`; `runtime.ts` adapts the injected `[0,1)` session RNG to bytes and calls those modules. Strict flow orders switch → field command → move priority → paralysis-adjusted Speed, and consumes randomness only for a real tie. Do not confuse `SkillRecord.movePriority` with `EnemyActionPattern.priority` (AI weight). The rm2k3 path must remain unchanged.
- Gen1 runtime damage uses `resolveGen1DamagingMove`, not the legacy `applySkillLike` approximation. Physical/special class comes from `DatabaseElementRecord.kind`; the formula preserves nested floors, paired quarter-scaling above 255, critical-level substitution, burn on noncritical physical Attack only, authored state Attack/Defense multipliers, STAB then each defender-type floor, `217..255` damage bytes, and the nominal-100%-accuracy `255` miss. Gen1 has no defend-halving step. Player PP is consumed exactly once only after pre-action status permits the move; `{kind:"attack"}` is accepted as Struggle only when no usable move remains, then uses 50-power Normal and `max(1,floor(damage/2))` recoil. Auto battle and enemy fallback must choose a learned usable move before Struggle. Red/Blue non-link enemies have unlimited PP. `battlePredict.predictSkillDamage` and enemy AI use the same damage class and modifier order with deterministic prediction values.
- Gen1 capture runtime uses `attemptGen1Capture`: ball classes select the original Rand1 domain, status applies the byte offset, HP derives W/X, and Rand2 plus the original shake thresholds decide the result. Trainer battles are rejected before item consumption or RNG. Rejection sampling stays exact for advancing RNGs and has a bounded deterministic fallback for pathological constant injected RNGs. Successful snapshots clamp HP to the captured species maximum, preserve persistent major status/turns, four moves, and PP, and drop `removeOnBattleEnd` buffs. `captureSuccessRate(..., {model:"gen1"})` remains a compatibility/preview helper and is not the runtime verdict.
- Gen1 major status is authored through `StateRecord.gen1MajorStatus`. `applyGen1MajorStatus` permits only one poison/burn/sleep/freeze/paralysis state; post-hit chances use the cartridge `floor(percent*255/100)+1` boundary while 100% effects are unconditional after the move hits. Poison-type targets reject poison; damaging burn/freeze/paralysis side effects reject a target sharing the move type; Electric status moves reject Ground. Sleep lasts 1..7 turns and its wake turn loses the action. Freeze has no natural thaw, but a successful Fire move carrying a burn side effect clears freeze instead of applying burn (Fire Spin-like moves without that effect do not). Paralysis blocks 63/256 actions and quarters ordering Speed, and poison/burn deal `max(1,floor(MaxHP/16))` after the attempted action. The generic RM2K3 `runStateUpkeep` path is bypassed for Gen1. Pure golden contracts are `test/gen1DamageGolden.test.ts`, `test/gen1CaptureGolden.test.ts`, and `test/gen1StatusGolden.test.ts`; live wiring is pinned by `test/gen1RuntimeExactIntegration.test.ts`.
- Gen1 defaults to one active party monster when no option/troop/system `activeSlots` is authored; RM2K3 keeps its whole-party fallback. Cartridge type meaning does not require literal English ids: `typeChart.gen1CanonicalTypeForId` recognizes canonical ids, common prefixes such as `type_fire`, and the bundled Korean labels, while damage still indexes the author's actual chart ids.
- Gen1 presentation trim lives in `src/styles/runtime/battle/21-gen1-hud-type-badge.css`: the Pokemon skin hides MP text/bars and every ATB fragment (`display: none`) while leaving the DOM in place, because `setVitalNode`/`statBar` sync values through those nodes for all skins. Skill submenu buttons get a `.battle-command-tag` badge from `SkillRecord.elementId` (label resolved through `database.elements`, so the demo authors Korean type names and adds the missing `grass` record); typeless skills get no badge. `sendOutDirectorState` adds a second intro beat (`가라, X!`) when the lead ally carries `monsterInstanceId`, so a monster-party intro costs `2 x BATTLE_INTRO_MS` before the command prompt. Unit contract: `test/gen1IntroTypeBadge.test.ts`; browser evidence: `test/e2e/gen1-hud-trim.spec.ts`.
### 플레이 모드 런타임 (이 절에 섞여 있는 비전투 항목)

- Play-mode map depth (`src/player/characterDepth.ts`, `playSceneMapRuntime.ts`): characters use `PRIORITY_DEPTH_BASE + worldY` (`same` = 200k). **★ upper tiles** (passable overlays / tree canopy) stay on `upperTileLayer` at 250k. **× solid upper tiles** (furniture) share same-priority y-sort with the player so standing in front of a desk draws above it; tracked on root and destroyed on re-render. Tests: `test/characterDepthYSort.test.ts`.
- **Airborne characters (jump / dropIn) lift the sprite origin, never `sprite.y`** (`src/player/characterHop.ts`). `originY = 1 + liftPx / (height × scaleY)` renders the sprite higher while the ground line stays put, because `sprite.y` is the input to `characterDepth` (TILE_SIZE=16 means 16px of `y` is exactly one depth row), to `startFollow(player)` camera tracking, to `spriteToTilePosition` light-source tiles, to five `Math.floor(sprite.y / 16)` tile probes, and to action-combat knockback tweens. **Call-order contract:** Phaser `setFrame` calls `updateDisplayOrigin()` and wipes the lift, so `applyHopFrame` must run *after* the frame update. `characterHopRuntime.ts` is the single glue both the player (`playSceneMovement.ts`) and NPCs (`playSceneAutonomous.ts`) use: `applyHopFrame` per frame, `finishHop` on the landing frame, `abortHop` on interrupts (map reset, `stopCommandMovement`, sprite destroyed). Airborne-only ground shadow (`characterShadow.ts`) is a runtime canvas ellipse on the root display list at depth `50_000 + groundY` (the empty band under `below` characters). **Draw the ellipse into a detached canvas first and hand the finished canvas to `textures.addCanvas`** — the `textures.createCanvas` + draw-later + `refresh()` shape renders nothing here (measured 2026-08-29: the image had `visible=true`, correct alpha, depth inside the band and sat inside the camera, yet no pixels reached the frame; the same `add.image` with an already-loaded texture key rendered fine, so the GL texture from the empty canvas was never updated). landing impact (`characterLanding.ts`) is a pure plan (shake ms/ratio scaled by height, dust, SE) plus a sink, and `prefers-reduced-motion: reduce` drops shake and dust but keeps the SE. `__oprnCharacterSprites` reports `liftPx` per sprite (the inverse of the origin formula) since the lift is invisible in x/y. Tests: `test/characterHop.test.ts`, `test/runtimeCharacterHop.test.ts`, `test/runtimePlayerHop.test.ts`. Knockback (`applyKnockback`) tweens an event sprite's `x`/`y` while `updateActiveNpcMove` also writes position every tick, so a knocked-back mover finishes at its original route target and only re-syncs on its next step — that desync predates hops and applies to walking movers identically. The lift itself is safe: `finishHop` always runs at the end of the flight, so a knockback mid-air cannot leave a character stuck in the air.
- Editor URL project deep-link: `?project=<legacyDb-project-id>&name=<title>` (`src/project/projectUrl.ts`). `project` wins over localStorage/env project id on load; successful remote load/reconnect/reload rewrites the bar with id + `meta.title`. Legacy `?projectId=` is still read.
- Play boot diagnostics (`src/player/playBootDiagnostics.ts`): each test-play/new-game boot stage (`engine`/`map`/`ready`/`refresh`/`error`/`timeout`) is recorded best-effort to the existing AI activity path — local ring buffer, LegacyDb `ai_activity_logs` (or `ai_analysis_runs` fallback), and DEV disk mirror. Console: `[play-boot] …`. Browser: `window.__rpgzzuPlayBootLog()`. Loading overlay is removed as soon as `PlayScene.create` reports ready so a heavy `refreshRuntimeSurfaces` cannot leave the UI stuck on “준비 완료”.

- `PlayScene` is the play-mode scene entry point. It wires map loading, player input, runtime overlays, battle entry, and scene-level helpers, but it should not own game rules.
- Play-mode map rendering shares default Combined Town terrain quarter composition with editor previews through `src/project/defaults/terrainQuarterAutotile.ts`; `terrainQuarterSources()` returning `null` means the saved tile should be drawn as one raw tile.
- Play mode uses a 320x240 logical play stage scaled by the largest integer that fits entirely inside the available viewport. The viewport stays black for letterboxing, the scaled stage stays centered, and stage-mounted DOM overlays should respect the crop-safe CSS variables from `playSurface.ts`; those crop values are normally zero except for sub-320x240 degenerate viewports.
- Zone feedback is scene-local presentation owned by `src/player/zoneFeedback.ts` and `src/player/playSceneZoneFeedback.ts`. It consumes only UI entries appended after the active scene/session cursor, so saved `m2Runtime.ui` history never replays after load or remount; late creation of the runtime UI array still consumes its first new entry. Banners, checkpoint toasts, incomplete objective chips, and a facing action prompt mount on the dialogue host and are suppressed by dialogue, battle, title, game-over, main/status menu, shop, inn, chest, and ending overlays. The standalone/editor CSS closure is `src/styles/runtime/playerRuntime.css` -> `zoneFeedback.css`; do not import the module a second time from an entrypoint.
- The play status menu is a stage-mounted, map-preserving edge-dock UI owned by `src/player/playerStatusMenuController.ts`, `src/player/playerStatusMenuDetails.ts`, and the final `src/styles/runtime/statusMenuEdgeDock.css` cascade. The primary dock remains exactly six entries (items, skills, equipment, party, record, system) and since 2026-09-03 it is a **left-anchored vertical rail** (`--status-rail-*` / `--status-area-*` tokens at the top of `statusMenuEdgeDock.css`): rail left 7px width 56px, party glance folds to a 2×2 grid top-right of the rail, the full detail panel fills the right area below the party, and party/record/system disclose their nested commands in a **vertical fly-out tray** (width 104px) anchored bottom-left of the right area beside the rail. 예전 배치(하단 가로 독 bottom 16 h46 + 상단 4열 파티)로 되돌리지 말 것 — 아이템·상세 창이 두 띠 사이에 끼었다. 기하 회귀는 `node scripts/qa/runtime/status-menu-layout.probe.mjs` (레일 세로·비겹침·잔림 판정 + 스샷 5장, `verify-shots/runtime-qa/status-menu-layout/`). Full work panels appear only after a concrete command is selected. **작업 패널은 쇼케이스를 갖는다 (2026-09-03):** `renderStatusMenuDetailPanel({ showcase: true })` 가 커서가 올라간 항목의 그림(아이콘 28px / 얼굴 32px)·이름·수치·설명 전문을 목록 오른쪽 86px 칸(`status-menu-detail-showcase`, 패널 `has-showcase`)에 그린다. 트레이·확인 카드는 `showcase:false`. 설명을 행 안에 다시 넣지 않는 계약(행 높이 2배 사고)은 그대로다 — 쇼케이스는 목록 바깥이다. 목록 행 아이콘은 10→14px, 행 22px, 스냅 단계 `--oprn-menu-row-step: 24px`(행+간격, 실측값 — 놓치면 마지막 행이 잘린다). 파티 얼굴 22→30px. 본문 글자는 8→7px(설명 6.5px) — 스테이지 3~4배 확대에서 8px 가 크다는 피드백. 회귀: `test/playerStatusMenuEdgeDock.test.ts`(쇼케이스 DOM), 프로브(쇼케이스 그림·설명 미잘림·행 정수배·7px). 파티 카드·상세 패널·명령 독은 **저작 윈도스킨을 그리지 않는다** (2026-08-30, PR #301). `--runtime-window-*` 토큰이 `src/styles/runtime/system.css` 의 `--runtime-glass-*` 를 가리키게 재정의되어, 런타임 인터페이스 전체가 rm2003 전투 HUD 의 글래스 크롬 하나로 통일된다. 즉 **데이터베이스 → 시스템에서 고른 윈도스킨은 전투 창 5개에만 적용된다** — 필드·메뉴·상점·타이틀은 글래스 고정이며 이것이 의도된 제품 결정이다(사용자 확인 완료). 배관과 프로젝트 데이터는 그대로 살아 있어 `--runtime-window-skin` 은 여전히 심어지고(`test/runtimePlayWindowSkins.test.ts:224-232` 가 고정), `_windowskin.css` 의 전투 5창 계약도 그대로다(`:95-110`). 메뉴는 여전히 불투명 전체 화면 창이 아니라 무대에 마운트된 맵 보존 엣지 독이다. Returning to title is destructive: the system tray exposes a visible warning and the controller requires a second confirmation in a compact confirmation card before leaving play. The primary dock or active detail list keeps real DOM focus after every render and exposes its selected child through `aria-activedescendant`; keep that state synchronized with roving child `tabIndex` and `aria-current`. Its keyboard cancel stack is one level at a time: item target or equipment candidate list -> slot/actor list -> group context tray or command rail -> close. Detail cursors are preserved per submenu key, and invalid Enter on empty/disabled detail lists should emit the menu invalid feedback without changing state.
- **ESC 메뉴 모션은 켜고 끌 때만 (2026-09-01).** `.oprn-status-menu` 에 `juice-menu-open` / `juice-menu-close` 만 움직임을 준다. 커서·결정·뒤로·거절은 소리와 클래스만 남기고 오버레이 `filter`/`transform`/`outline` 을 걸지 않는다 — 부모가 움직이면 `backdrop-filter` 가 맵을 같이 흔든다. 상점 행 거절 흔들림(`.juice-menu-invalid` 가 행에 붙음)은 그대로다. 선택 표시는 독 `.selected` 배경·밑줄과 상세 행 inset 막대만 쓴다. 커서 이동 때 오버레이 루트를 제거하지 않는다(`adoptStatusMenuPanel`) — 통째로 갈아끼우면 맵이 한 프레임 드러난다. 회귀: `test/runtimeJuiceSelectCss.test.ts`, `test/playerStatusMenuClosingGuard.test.ts`.
- **아이템 탭은 소지 장비도 보여 준다 (2026-09-01).** 예전 목록은 `database.items` 인벤토리만 그려서 장착 중인 검·갑옷이 안 보였다. 목록 맨 위 `장착 중` 행(`status-menu-owned-equipment-worn`)은 보기 전용이라 첫 결정 칸은 회복약 같은 아이템에 남긴다. 가방에만 있는 장비는 `N개` 행으로 아이템 아래에 붙이고 Enter 는 그 부위 장비 화면으로 간다. `status-menu-item-*` 접두와 분리해 아이템 행 수 단정을 깨지 않는다. 회귀: `test/playerStatusMenu.test.ts`.
- Player save slots are runtime-session snapshots in `src/player/saveSlots.ts`. Optional slot metadata such as `mapName`, `partyLevel`, and `playTimeSeconds` is non-breaking and must remain load-compatible with older snapshots that omit those fields.
- Exported web players set the save-slot localStorage namespace to `oprn-export:<projectId>` before showing the title screen (saves left under the pre-2026-09 `rpgzzu-export:` namespace are copied to the new one on the first boot, old keys kept), so standalone builds do not collide with editor/dev save slots. Keep `setSaveSlotStorageNamespace()` in `src/player/saveSlots.ts` compatible with the existing default `oprn:save-slot:*` keys.
- Session checkpoints live in `src/player/checkpoints.ts` as a single WeakMap-backed slot per active `PlaySession`. `checkpointSave` stores a save-slot-style snapshot for retry, but checkpoints are intentionally not serialized into save files or project JSON; normal save/load starts without a checkpoint.
- Game over is now a retry loop when a checkpoint exists: `killPlayer` zeros the party, marks death state, and opens the game-over overlay with `다시 시도` plus `타이틀로`; without a checkpoint only title return is available. Keep keyboard behavior on the same terminal cursor/menu conventions as existing overlays.
- **패배 결말은 호스트 한 곳에서만 결정한다 (2026-08-28 실측 수정).** `canLose=false` 전투의 `defeat` 는 게임 오버다: `src/player/playSceneDefeat.ts` 의 `applyBattleDefeat` 가 파티 HP 를 0 으로 만들고 `state_death` 를 붙인 뒤 게임 오버 오버레이를 띄우며, **이벤트 전투·랜덤 인카운터·필드 스폰 접촉이 모두 이 한 경로를 쓴다.** 이전에는 필드 스폰만 처리했고 (1) 이벤트 `battleProcessing`(`playSceneInterpreter.ts`)은 결과를 `session.battleResult` 에만 적고 이벤트를 계속 실행했으며, (2) 랜덤 인카운터(`playSceneMovement.ts`)는 `void scene.playBattle(...)` 로 결과를 통째로 버렸다. `battleRewardsToSession` 이 `canLose=false` 패배의 write-back 을 건너뛰므로 파티는 전투 전 HP 로 멀쩡히 걸어나갔다 — 즉 **패배해도 아무 일도 일어나지 않았다**. 헤드리스 하네스(`sceneTestRunner.ts`, `walkthroughRunner.ts`)는 처음부터 `defeat + !canLose` 를 파티 사망/게임 오버로 모델링하고 있었으므로 출하물이 자기 하네스와 어긋난 상태였다. `canLose=false` 패배는 이벤트를 그 자리에서 종료한다(`{ kind: "done" }`) — 전멸한 파티로 뒷 커맨드가 이어지면 게임 오버의 `다시 시도`(`restoreCheckpoint`)와 살아 있는 인터프리터가 충돌한다. `canLose=true` 패배는 기존대로 게임 오버 없이 필드로 복귀하고 `defeatBranch` 를 실행한다. 랜덤 인카운터도 결과를 `session.battleResult` 에 적는다(페이지 조건·`fork(battleResult=...)` 의 SSOT). 회귀: `test/battleDefeatOutcome.test.ts`, 실기 증거: `npm run qa:runtime -- --scenario battle-defeat`.
### 전투 흐름 · 몬스터 수집 · 트룹 이벤트 · 보상

- The interpreter is the command / tool executor for in-play events. Keep command / tool resolution, branching, pauses, and step results in the interpreter layer; let `PlayScene` only consume those results.
- Battle runtime lives under `src/battle` and should stay self-contained. `PlayScene` can launch battles and render the battle UI, but battle state, turn flow, damage, rewards, and result resolution belong in battle runtime.
- Troop enemy placement is authored once as canonical side-view coords (`TroopMemberRecord.x/y`, left anchor x≈84 — `classicEnemyFormation` in `src/battle/battlerPlacements.ts`) and resolved per skin by `resolveSkinEnemyPositions` (same module) — the single function the battle DOM and the DB troop preview both call over **authored** x/y. `MutableBattler`/`BattleBattlerSnapshot` carry `authoredX/authoredY` alongside the legacy SC12 `battleX/battleY`. `autoAlign=true` returns `BATTLER_PLACEMENTS[skin].enemy(i,n)` unchanged (feet-ratio fixture stays locked); manual side-view/active recenters x>150 into the classic left formation (same rule as legacy SC12, now skin-aware); manual frontal/first-person shifts the whole row uniformly from the troop mean-x deviation (damped 0.5, nameplate spacing preserved). DB preview renders skin `party()` seats in the same 0..160 space and warns when authored x diverges from the rendered seat. Contract: `test/troopSkinPlacement.test.ts`.
- Battle flow is authored as `system.battleFlow` with optional `troop.battleFlow` and battle-start/runtime option override; when none is set the runtime falls back to `"strict"` (was `"gauge"` before the 2026-08 default flip). `"gauge"` preserves the semi-active charge flow; `"strict"` starts a round by collecting one command / tool from each acting party member, chooses enemy AI, then resolves actions by agility with actor-side ties before enemy-side ties and side-local index order. Strict flow has a round cap (`STRICT_MAX_ROUNDS = 200`): if neither side can end the battle (e.g. all actors permanently incapacitated and enemy cannot kill), the battle resolves as a stalemate escape instead of recursing without bound. Strict flow does NOT support `wait` pause (synchronous — `pendingWaitMs` is never consumed) or `m2-108 actionTimes` extra actions (round-based — extra actions cannot be granted mid-round); both log `unsupported` when authored in strict.
- `turn`·방어·커맨드 적법성의 의미는 두 플로우에서 통일됐다(2026-09-12, 11판 실플레이 적대 리뷰 후속). `turn` = **완료된 행동 사이클 수**: strict 는 라운드 완료 시 +1, gauge 는 생존 배틀러 전원이 행동(또는 행동 불가 스킵) 슬롯을 한 번씩 소비할 때 +1(`gaugeCycleActed`/`markGaugeActionCycle` — 사망한 배틀러는 대기 목록에서 빠진다). 예전에는 gauge 가 적 행동 1회마다 +1 이라 `turn`/`everyRound` 트룹 조건과 적 행동 패턴의 `turn` 조건이 모델마다 다른 케이던스로 발화했다. 방어(`defending`)는 **다음 자기 행동까지** — gauge 에서는 `applyActorCommandEffect`·`executeEquipmentUse` 진입 시 해제되고, strict 의 라운드 유지와 같은 가치를 갖는다(예전 gauge 는 적 1회 행동마다 전원 해제 — 적 3체 기준 1/3 성능이었다). 커맨드 적법성은 `actorCommandLegality` 하나가 `beginActorCommand`(대상 선택 전)와 `isValidActorCommand`(실행 시) 양쪽을 가린다 — gen1 에서 사용 가능한 기술이 남은 액터의 통상 공격은 대상 선택을 열지 않고, 커맨드 카드에서는 inert+사유(`battleCommandDom.commandControl`)로 그려진다. `predictSkillDamage` 의 rm2k3 분기는 런타임과 같은 상태 배율·`MIN_DAMAGE_RATIO` 하한·방어 자세 반감 순서를 쓰고, 4행 스크롤 커맨드 카드에는 넘침이 있으면 `▾` 큐(`.battle-command-scroll-cue`)가 뜬다. 회귀 계약: `test/battleAdversarialFixes.test.ts` 후반 describe + `test/battleDomKeyboard.test.ts` 말미.
- Active battle slots are authored as optional `system.activeSlots` or `troop.activeSlots`, with runtime option override. When omitted, the whole party remains active for legacy behavior. When set, only the first N party members are active; reserves stay in `BattleSnapshot.reserveActors` and are not serialized into save/project runtime state beyond normal session party/vitals. In monster-party battles, `participatingActorIds` is the reward authority: reserve snapshots do not receive monster EXP or appear in monster level-up previews until they actually enter battle. Regular actor-party battles retain the legacy rule that the live companion-monster party receives EXP and previews as a whole.
- Actor command / tool kind `"switch"` swaps an active actor with a living reserve. Strict flow resolves switch actions before speed ordering in the same round; gauge flow applies the switch immediately and resets outgoing/incoming gauges. If an active actor is defeated while a living reserve exists, the next command / tool phase exposes `forcedSwitchActorId` and accepts only a valid switch before normal battle flow resumes.
- Class battle commands are runtime data. `classes[].battleCommands` is consumed by the battle DOM in authored order, with fallback to attack/skill/item/defend/escape only when a class has no usable runtime command. `skillSubsetName` filters the skill submenu by `SkillRecord.type`, `skillId` invokes a specific skill, and `guard` is a supported alias for the existing `defend` action.
- Class battle commands use `"switch"` for 교체; legacy `"event"` is still accepted as a compatibility alias but should not be authored for new data.
- Monster collection is gated by `system.monsterCollection`. When enabled, runtime actor commands may expose `"capture"` and class command / tool rows can author it; when omitted or false, default battle command / tool UI does not add capture.
- Monster species are authored in optional `database.monsterSpecies[]` records with species id, name, monster graphic, optional `types` (max two), base stats, optional EXP curve, capture rate, level skill list, and optional `evolutions`. Battle `EnemyRecord.speciesId` links an enemy battler to a collectable species without making enemy records become player-owned monsters. In a monster-party game, an enemy with no damaging action gets that species' moves learned by its level (`upsert_enemy` writes them; `enemyBattlers` fills an empty list at battle time) so the fight and a later capture use the learnset instead of Struggle with no moves. Troop `uncapturable:true` blocks capture attempts for bosses or scripted fights.
- Monster evolution records use `{ toSpeciesId, requires }`, where requirements can include `level`, consumable `itemId`, and `friendshipAtLeast`. Victory reward application grants EXP to the live monster party and runs deterministic level-up evolution checks after EXP/skill updates. `evolveMonster { instanceId, toSpeciesId? }` is the explicit event-command / tool path for item/scripted evolution; it keeps nickname, level, EXP, friendship, caughtAt, and instance id, recalculates HP from the old current-HP ratio, swaps species id, and merges newly available target-species level skills.
- `system.typeChart` is an optional authored Pokemon-style type matrix with `{ types, multipliers }`. When absent, battle damage stays legacy-neutral. When present, `SkillRecord.elementId` doubles as the attack type: damage multiplies attack type versus each defender species type, then applies 1.5 STAB when the attacking enemy species has the same type. Actor/enemy battles without linked monster species or typed skills remain unaffected.
- Capture uses battle RNG and item `captureProfile.multiplier` with `captureRate * (1 - currentHp / maxHp * 0.7) * multiplier`, clamped to 0..1. A valid failed attempt consumes the capture item and the actor turn; success hides/removes the target, records a captured monster snapshot, and excludes that enemy from EXP rewards.
- New monsters created by `giveMonster` without explicit EXP start at `totalExpForLevel(species.expCurve ?? DEFAULT_MONSTER_EXP_CURVE, clampedLevel)`. EXP is cumulative, so starting a high-level capture at zero incorrectly delays its next level. Explicit EXP (including zero) is preserved; existing instances and saves are not migrated. Regression contract: `test/monsterInitialExperience.test.ts`.
- `PlayScene` bridges successful battle captures into the live session through `giveMonster`, using the current map/tile as `caughtAt`. Headless `simulate_battle` accepts strict-script `"capture"` actions with `captureItemId` and returns first-sample `capturedMonsters` plus `capturedCount`.
- Runtime class changes live on `PlaySession.classOverrides`, not on `ActorRecord.classId`. `Change Actor Class` and `promoteActor` preserve level, clamp current HP/MP to the new class maximums, keep existing session-learned skills, immediately add class skills up to the current level, and save/load the override. Status menu, equipment permission checks, battle actor construction, level-up growth, learned skills, and class battle commands should all resolve through the effective class helper rather than reading `actor.classId` directly.
- Class promotions are authored as `ClassRecord.promotions[]` with deterministic requirements: `level`, `switchId`, `itemId` consumed on success, and `variableId` plus `atLeast`. `promoteActor { actorId, toClassId? }` selects the first satisfied promotion when `toClassId` is omitted and runs success/failure branches without pausing the interpreter.
- Strict battle snapshots include `roundLogs` for headless replay and tool assertions. `roundLogs[].participatingActorIds` and top-level `participatingActorIds` record actors that were active at least once, including actors switched in mid-round, so later reward policies can distribute from data without changing current reward payout behavior. Gauge UI elements should be hidden for strict snapshots rather than predicted from CSS.
- Troop battle events execute in `src/battle/battleEvents.ts`. Battle pages support message logs, choices (auto-following the first branch in headless runtime), common event calls, switch/variable/item changes, actor HP/MP changes, recover-all, `changeGold`, `changeExp` (party or single actor; amount may be `VariableOperand`), `changeLevel`, `learnSkill` (`action` learn/forget; empty/`party`/`all` actorId = whole party), `changeParty`, and the full M2 battle command set through `src/battle/battleM2CommandExecutor.ts`. `m2-098` 적 HP 변경, `m2-099` 적 MP 변경, `m2-100` 적 상태 변경, `m2-101` Enemy Encounter, `m2-102` Change Battleback, `m2-103` Show Animation(런타임 lastAnimation 세팅), `m2-104` Battle Events(같은 트룹 페이지 재귀 호출), `m2-105` Abort Battle(전투 즉시 중단 → escape 결과), `m2-106` Call Common Event, `m2-107` Force Escape, `m2-108` Action Times+ 가 전부 런타임에 구현되어 `editorOnly`/`unsupported`가 아닙니다. `wait` 명령은 런타임 `pendingWaitMs`를 적립해 tick이 일시정지하며, 한 tick이 wait 시간을 전부 소진하면 남은 deltaMs로 게이지 충전을 이어갑니다(전투가 잠깐 쉬는 연출). `playAudio`/`stopAudio`는 `BattleRuntimeOptions.playAudio`/`stopAudio` 콜백으로 호스트(`playSceneBattle.ts` → `playAudioCommand`/`stopAudioCommand`)에 위임해 실제 오디오 엔진을 구동하고 `session.audio.bgm`을 동기화합니다. `inputWait`만 여전히 acknowledged 로그만 남깁니다(전투 중 입력 대기는 UI 연동 과제). Tier-1 커맨드(2026-08-20 Step 3)도 실제 실행됩니다: `label`/`gotoLabel`/`loop`/`breakLoop` 는 pc 기반 프레임 머신으로 페이지(호출 본문) 로컬 실행 — 라벨 탐색은 맵 gotoLabel(`src/player/interpreter/stack.ts`)과 동형의 활성 프레임 스택 탐색이라 fork 분기 안에서 상위 라벨로 점프는 되지만 미진입 분기 안의 라벨은 unsupported 로그(missing label), 루프 반복/라벨 점프는 각 10,000회 상한 가드(동기 실행이라 맵의 100,000보다 엄격). `setFlag`/`timer` 는 배틀 이벤트 state(flags/timers 스냅샷 사본)에 기록되고 전투 종료 시 `applyBattleRewardsToSession` 이 세션에 write-back(타이머 진행/정지는 맵 씬 `playSceneTimers` 소관 — 배틀은 남은 초만 관리). `showAnimation` 은 m2-103 과 같은 `showBattleAnimation` 콜백으로 lastAnimation 을 세팅합니다("player" 타깃 → 행동 중 액터의 배틀러 id). `gameOver`/`killPlayer` 는 `abortBattle` 과 대칭인 `endBattleAsDefeat` 콜백으로 defeat 결과에 매핑되며(killPlayer 는 액터 HP 0 포함), defeat 이후 게임오버 vs 패배 복귀는 canLose 의미론(`battleRewardsToSession`/호스트)이 결정합니다. `changeFace`/`displayTextSettings` 는 메시지 스트립 프레젠테이션 상태를 이벤트 로그 detail(message)로 남깁니다. Step 3d(2026-08-20): RM2K3 배틀 허용 커맨드 `changeEquipment`/`promoteActor` 도 실제 실행됩니다 — 맵과 같은 전이 권위자(`transitionActorEquipment`/`sessionClass.promoteActor`)를 배틀 이벤트 state 오버레이(`actorEquipment`/`classOverrides` 세션 스냅샷 사본)로 실행하고, 해당 액터 배틀러의 파생 스탯(공/방/정신/민첩·최대 HP/MP·chargeRate·equipmentEffects)을 `battleBattlers.refreshActorBattlerDerivedStats` 로 재계산합니다. 스탯 산식은 배틀러 생성 로직과 단일 함수(`actorDerivedStats`)를 공유하며, 현재 HP/MP·게이지·상태이상은 보존(새 최대치 클램프만)합니다. 전직은 클래스 스킬 즉시 학습·승급 요구 아이템 소모·success/failure 분기(fork 와 같은 활성 프레임)·`flags.promoteActorSuccess` 까지 맵 의미와 동일하고, 배틀 커맨드 메뉴는 갱신된 `snapshot.classId` 로 새 클래스에서 해석됩니다. 전투 종료 시 `applyBattleRewardsToSession` 이 세션 `actorEquipment`/`classOverrides` 로 write-back 하며(전직 write-back 은 바이탈보다 먼저 `changeActorClass` 로 세션 최대치를 갱신), canLose=false 패배는 미반영(기존 의미론). 조건 평가는 `Condition` 유니온 전체(`battleResult`/`all`/`any`/`not` 포함)를 커버합니다. Unsupported battle-event commands must produce runtime `unsupported` logs and editor/lint partial-support badges instead of being silently ignored. Gold/party/skill/exp/level mutations live on the battle event state snapshot and are written back through `applyBattleRewardsToSessio…
- Change Battle Commands (`m2-092`) writes `session.actorBattleCommands[actorId]` (add/remove/set). Battle UI resolves menus through `battleCommandsForActor(..., { overrideCommandIds })`. Overrides persist in save slots.
- Side-view battler presentation uses `BattleBattlerSnapshot.pose` (`idle`/`attack`/`hit`/`defend`/`dead`) from `src/battle/battlePose.ts`, driven by `lastActionResult` until the next command / tool phase. Hit-feel uses `hitFeel` on the snapshot plus sequencer hit-stop (`BATTLE_HITSTOP_MS`) and `battleJuice` SFX/shake.
- Battle backdrop priority is owned by `resolveBattleBackdrop` in `src/battle/battleBackdrop.ts`: explicit override → troop `previewBackgroundResourceId` → terrain tag at the battle location (`tileset.terrain` / `tileMeta.terrainTag` → `database.terrains[tag-1].battleBackgroundResourceId`) → forest field fallback. Night-sky / dimension-rift panoramas are rewritten to the forest field.
- Battle event conditions support switch/variable legacy conditions plus round cadence (`turn`, `onRound`, `everyRound`), `enemyHpBelow`, enemy/actor HP ranges, enemy/actor turn, and actor command. Round cadence pages are de-duplicated per page/round; `runOnce` keeps a page battle-wide single-shot even when its condition remains true.
- `battleResult` 페이지 조건은 `src/project/io/pageResolution.ts`에서 `session.battleResult`(직전 전투 처리 결과: `victory`/`defeat`/`escape`)와 비교해 실제 평가합니다. 필드 몬스터 처치 후 페이지 전환, 보스전 분기 등 RM2K3 "직전 전투 결과" 시나리오가 작동합니다. `battleResult`는 `PlaySessionLike`·`PlaySession`·save slot에 포함되며 `fork(battleResult=...)` 명령 분기와 동일한 SSOT를 씁니다.
- `simulate_battle` accepts `activeSlots` and strict-script `"switch"` commands, and returns first-sample `participatingActorIds`, `roundLogs`, and `eventLogs` for AI/tool assertions.
- Enemy battle actions are runtime rules, not editor-only data. `EnemyRecord.actions` is interpreted by `src/battle/runtime.ts` with priority weights, turn conditions, skill MP checks, and post-action switch effects; `skillIds` is only the normalized legacy projection.
- Item use is path-specific. Menu use (`src/player/playerItemUse.ts`) applies `hpRecovery`/`mpRecovery`, cures states from `healStateIds` plus remove-`stateEffects`, **inflicts add-`stateEffects` (2026-09-04)**, and teaches `learnedSkillId` (book items) without reading linked attack skills.
  - **Add-op state effects in the field menu (2026-09-04):** before this, menu use read only remove-ops (`healStateIdsOf`), so an item that grants a state was permanently "효과가 없습니다" outside battle even though the schema, the mutators and `applyItem` all supported it. `canApplyItemEffects` now also counts an add candidate the target does not yet carry, and `applyItemEffects` rolls the authored `chance` per effect. The field path has no equipment-resistance / state-resistance model, so it rolls the raw `chance` (battle's `applyStateEffects` additionally multiplies state resistance) and skips ids absent from `database.states` — a deleted state id must not be planted into the session. A roll that fails leaves `changed=false`, so the shared `commitSuccessfulUse` never runs and no copy is consumed. Contract: `test/playerItemUse.test.ts` (guaranteed inflict consumes / already-carried refuses / zero-chance keeps the copy). Battle use (`applyItem` in `src/battle/runtime.ts`) prefers native medicine recovery/state cures when `type` is `medicine` or recovery/heal fields are present; `special` (and equipment-typed) items invoke `activateSkillId ?? skillId`. Capture items stay on the capture path. Default catalog medicines are typed `medicine`, offensive throwables/`guard` as `special`, skill manuals as `book` with `learnedSkillId`, and key/material goods as `normalGoods` with `occasion:"never"`.
- Actor battlers must be built from live session state when available: levels, vitals, permanent parameter bonuses, current equipment, session-learned skills, state ids, and current party order. DB `initialEquipment` and level-learned/class-learned skills are fallbacks for editor/test starts.
- State records can expose structured `runtimeEffects` for action restriction, stat multipliers, battle-end removal, and turn HP damage. Runtime state behavior should prefer those structured fields and only use ontology/id fallbacks for legacy records, avoiding Korean display-string comparisons as rule authority.
- Battle end removes battle-only states before snapshots are handed back to session reward application. Session `actorStateIds` should be updated from the battle snapshot together with HP/MP and battle event state.
- Battle rewards are paid only for enemies that actually appeared in battle; unrevealed hidden troop members do not contribute EXP, gold, or drops.
- `system.rewardPolicy` can opt into `participationOnly` and `levelGapPenalty`. Omitted policy preserves legacy full-party EXP; participation-only filters EXP recipients by battle `participatingActorIds`; level-gap penalty compares actor level to collected enemy level and pays 50% EXP at a 5+ level gap and 10% at a 10+ gap.
- State-rate grades use the RM2K3 percentages A=100, B=80, C=60, D=40, E=20. Newly created actors seed `state_death` and `state_poison` at C; new enemies/classes seed `state_death` at C. Other omitted rates mean 100% effect chance (no extra resistance), so beneficial states do not randomly fail. An explicitly persisted empty rate map remains empty for stable project round trips.
- Runtime equipment effects are aggregated from authored equipment fields already in the DB shape. `effectFlags.doubleAttack` resolves attack commands twice, `elementalDefenseIds` halves matching elemental damage, and `stateDefenseIds` with `stateDefenseMode:"resist"` plus `stateResistanceChance` can block state infliction. Do not invent new equipment effect fields without updating schema, editor, runtime, save expectations, and tests together.

## Starter hero battle sheets (2026-08-29)
- 액터 6인의 전투 시트(`public/assets/generated/starter/hero-0{1..6}-battle.png`)는 **144×384 = 48px 셀 3열×8행**이다. `battleFieldDom.ts` 의 `actorBattleImage` 가 `battle-actor-sprite` 로 심고 `applyBattlerPose` 가 `backgroundPosition` 을 **X 와 Y 둘 다** 움직인다. 프레임 표의 정본은 `src/battle/battlePose.ts` 의 `POSE_FRAME` 이고, 런타임·계약 테스트·생성기(`scripts/asset-gen/battlerPrompt.mjs` 의 `POSES`)가 같은 좌표를 본다.

  | | 열 0 | 열 1 | 열 2 |
  |---|---|---|---|
  | **행 0** | idle | attack | hit |
  | **행 1** | defend | dead | 예약(victory, 비어 있음) |
  | 행 2~7 | 투명 | 투명 | 투명 |

  2026-08-29 까지는 Y 가 항상 0 이라 `defend` 가 idle 칸을, `dead` 가 hit 칸을 돌려 썼다. 행 1 에 전용 그림이 들어가 5포즈가 5칸을 쓴다. 행 2~7 은 계속 투명으로 비워 둔다 — 뭔가 그려 두면 시트를 읽는 사람만 속는다.
- 서 있는 네 포즈(idle/attack/hit/defend)는 **왼쪽을 보는 사이드뷰 전투 포즈**여야 한다. 파티는 오른쪽에 서서 왼쪽 적을 마주보므로, 오버월드 걷기 시트의 정면·후면 프레임을 그대로 넣으면 안 된다(회귀 전 실측: 4장 모두 뒤통수 보행 프레임이라 48px 셀에서 내용이 23~31px 로 떠 있고 위아래 여백에 인접 행 잔상이 줄로 남았다). 각 프레임은 셀을 꽉 채우고 무기·실루엣으로 직업이 읽혀야 한다. `dead` 만 예외로 **누운 그림**이라 세로가 짧고(실측 fill 29~32%), 그래서 생성기가 셀 **바닥에 붙인다**(`bottomAlignFrame`) — 정사각 크롭이 세로 중앙에 놓으면 시체가 공중에 뜬다.
- 계약 테스트는 `test/heroBattleSheetContract.test.ts` 다: 시트 크기, 5포즈 각 칸의 불투명 픽셀 수 하한, 행 0 세 칸의 픽셀 차이, **행 1 의 실루엣 차이**(defend↔idle, dead↔hit, defend↔dead 를 마스크 XOR/합집합으로 재고 20% 하한 — 행 0 칸을 복사해 넣으면 걸린다), 행 1 열 2 가 비어 있는지, **행 2~7 전체가 투명한지**, 서 있는 포즈 중 최대 실루엣이 셀 높이의 90% 이상인지, `dead` 가 바닥에 붙었는지를 검사한다. 회귀 시점 원본 4장은 채움 조건에서 4/4 실패했다.
- 예전에 있던 "행 0 바로 아래 8px 띠가 투명" 가드는 **없앴다**. 그건 Y 가 항상 0 이라는 전제의 오슬라이스 방어선이었고 행 1 을 쓰면 반드시 깨진다. 대신 방어선을 그림에서 **산식**으로 옮겼다: `test/battlerPoseFrame.test.ts` 가 5포즈의 `backgroundPosition` 문자열을 정확히 단정한다. 0 에는 음수 부호를 붙이지 않는다 — CSSOM 이 `-0px` 를 `0px` 로 정규화한다(실측: happy-dom).
- 전투 화면의 아군 스프라이트 위아래에 보이는 연한 가로선은 **시트 오슬라이스가 아니다** — `battleFieldDom.ts` 가 배틀러마다 붙이는 `.battle-actor-platform` span 이다. 교체 전후 스크린샷에 동일하게 있으니 이걸 잡상 버그로 추적하지 말 것.
- 시트 규격은 `src/assets/resourceSlicing.ts` 의 `battleCharset` 이 정본이다: 48px 셀 `columns: 3, rows: 8, count: 24, sheetWidth: 144, sheetHeight: 384`. `imageSpec` 이 `sheetWidth/sheetHeight` 를 `expectedWidth/expectedHeight` 로 승격시키므로 **144×384 가 아닌 전투 캐릭터셋은 리소스 매니저 import 에서 거부된다**(`resourceManager.ts` 의 `validateResourceDimensions`). chipset·charset·battleWeapon 과 같은 취급이다. 사본이 `scripts/legacy-db-resource-root/catalog.mjs` 에도 있고 `test/resourceProfiles.test.ts` 가 두 사본의 동일성을 강제한다.
- 재생성 경로는 `scripts/asset-gen/gen-hero-battle-grok.mjs`(grok `image_gen` → 마젠타 키잉 → 48px 축소 → 셀 합성). `--tag`, `--only=hero-02,hero-04`, `--poses=defend,dead` 로 프레임 단위 재생성이 되므로 30장을 매번 다시 뽑지 않는다. 중간 산출물은 `.omo/asset-gen-tmp/` (gitignore).
- 기본 동작은 **병합**이다: 출력 PNG 가 있으면 읽어서 **이번에 성공한 셀만** 덮어쓴다. `--fresh` 로 전체 재합성. 병합할 때 셀을 먼저 투명으로 비우고 합성한다 — `Jimp.composite` 는 알파 블렌딩이라 그냥 얹으면 새 프레임의 투명 여백으로 이전 포즈 실루엣이 비친다. hero-01~04 의 행 0 은 번들 캐릭터셋에서 잘라낸 승인된 그림이므로 캐시 프레임으로 채우지 않는다(그러면 그 그림이 조용히 교체된다). 그래서 플랜의 `promptVersion` 이 `bundled-charset-extract-v1+grok-row1-v1` 처럼 두 패스를 함께 적는다.
- 새 포즈를 그릴 때 **마진 게이트**를 통과해야 한다: 피사체가 1024px 원본의 네 변에 닿으면 테두리에서 시작하는 flood fill 이 막혀 JPEG 로 번진 마젠타가 살아남고 48px 에서 분홍 프린지로 굳는다. `dead` 처럼 가로로 긴 포즈는 프롬프트에서 "더 작게 그려 네 변에 여백을 남겨라" 를 명시해야 통과한다(실측: 안 넣으면 content 1024×535 로 좌우 변에 닿아 실패).
- `processSprite(input, output, size, filter?)` 의 네 번째 인자는 축소 필터이고 기본값은 기존 호출자를 위해 `RESIZE_NEAREST_NEIGHBOR` 그대로다. **48px 전투 프레임처럼 20배 이상 줄일 때만 가중 평균 필터를 넘긴다** — 니어리스트는 셀당 한 픽셀만 찍어 칼날 같은 얇은 형태를 잃고 JPEG 노이즈를 굳힌다(실측: 48px 결과에 705색). 16~96px 아이콘·몬스터는 축소율이 작아 니어리스트가 여전히 가장 선명하므로 기본값을 바꾸지 말 것.
- 증거 스크린샷은 `verify-shots/runtime-qa-{before,after}/` (`node scripts/runtime-qa.mjs --scenario battle`, 시나리오는 `scripts/qa/runtime/battle.scenario.mjs`).

## Per-actor back battlers (2026-08-29)
- 후면 구도 스킨(`BATTLER_PLACEMENTS[...].partyFacing === "back"`, 포켓몬 등)은 여태 파티 전원에게 **`bskin-ally-creature-back` 한 장**을 돌려 줬다 — 어느 액터를 넣어도 같은 보라색 생물이 뒤통수를 보였다. 액터마다 하나씩 그려 끊었다: `public/assets/generated/battle-skins/sprites/hero-0{1..6}-back.png`, 리소스 id `generated-actor-hero-0N-back`.
- **규격은 712×712 통짜 이미지**다(기존 `ally-creature-back.png` 실측치). 3×8 전투 캐릭터셋이 **아니므로** `oprnGeneratedAssetPlan.json` 에 넣지 않았다 — 기존 `bskin-*` 스프라이트가 전부 리졸버 전용이고, 플랜에 넣으면 `battleCharset` 규격(144×384)으로 검증돼 거부된다. 등록 지점은 `src/assets/generatedAssetResourceResolver.ts` 한 곳이다.
- 선택 순서는 `skinPartySpriteUrl` 과 `actorNode`(`battleFieldDom.ts`)에 있고 **네 단계**다. 위에서 먼저 맞는 것을 쓴다:
  1. `actor.speciesId` 가 있으면 종족 그래픽(파티 몬스터). 뒷모습보다 우선한다.
  2. `partyFacing === "front"` 면 저작된 전투 시트(`actor.battleCharacterResourceId`).
  3. `partyFacing === "back"` 이고 `generated-actor-<slug>-back` 이 **리졸브되면** 그 액터의 뒷모습. `data-actor-back-battler="true"` 가 붙는다.
  4. 나머지는 예전 공용 폴백(포켓몬은 `bskin-ally-creature-back`, 그 외는 전사/마법사 두 장 교대).
- 슬러그는 **`battleCharacterResourceId` 에서 유도**한다(`generated-actor-hero-03-battle` → `generated-actor-hero-03-back`). 스키마에 필드를 더하지 않은 이유: 뒷모습은 같은 인물의 다른 시점이라 파생 관계가 이미 id 에 있고, 필드를 더하면 스키마·에디터·직렬화·픽스처가 다 따라와야 하며 두 칸이 어긋날 여지도 생긴다. **id 를 만들었다는 것만으로 쓰지 않는다** — 리졸브까지 성공해야 3단계로 간다(안 그러면 없는 파일을 `src` 에 박는다).
- 계약 테스트는 `test/battleFieldAllySprite.test.ts` 다: 액터별로 어느 파일이 붙는지, 6인이 서로 다른 파일을 쓰는지, 슬러그를 못 뽑는 시트와 리졸브 안 되는 슬러그가 공용 폴백으로 떨어지는지, 정면 스킨은 저작 시트를 그대로 쓰는지. **렌더 성공만 보면 회귀가 조용히 난다** — 뒷모습이 빠져도 공용 한 장으로 그려지긴 하기 때문이다.
- 재생성 경로는 `scripts/asset-gen/gen-hero-back-grok.mjs`. 출하된 전투 시트의 **idle 셀을 384px 로 확대해 세션 cwd 에 `reference.png`** 로 깔고 grok 이 그 파일을 읽어 인물을 고정한다(자세는 유지, 시점만 180° 돌린다 — `REFERENCE_BACK_VIEW`). 캐시는 두 단계다: 처리 완료 스탬프가 있으면 출하만 다시 하고, 세션의 `raw.png` 만 있으면 **생성을 건너뛰고 후처리만** 다시 돌린다(파이프라인을 고쳐 재시도할 때 3분짜리 생성을 다시 태우지 않는다).
- 프롬프트에서 실패한 두 가지가 프롬프트로 못 박혀 있다:
  - **정면이 나온다.** 참조 컷이 정면이라 모델이 그걸 거의 그대로 베꼈다(실측: 눈·코·입이 다 보이는 정면 3/4). 공통 `NEGATIVE` 에는 "정면 **보행** 스프라이트 금지" 만 있어 정면 **전투** 포즈를 아무것도 막지 않았다. 그래서 (a) 시점 요구를 참조 문단보다 **앞에** 한 번, 저장 지시 바로 **앞에** 한 번 더 두고, (b) `NEGATIVE_BACK` 으로 얼굴·눈·정면·측면 프로필을 명시적으로 금지하고, (c) `who` 가 정면 기준 서술임을 알려 카메라를 앞으로 끌어당기지 않게 했다.
  - **세로를 꽉 채운다.** "여백을 남겨라" 를 두 번 강화해도 content 높이가 1024/1024 로 나왔다. 프롬프트로 싸우지 않고 `padWithBackground()` 로 원인을 없앤다 — 원본 주위에 배경색 띠를 8% 두르면 flood fill 이 네 방향 모두 배경에서 출발한다.
- `padWithBackground` 는 **순수 `#FF00FF` 가 아니라 원본에서 샘플링한 배경색**으로 덧대야 한다. `processSprite` 는 배경 기준색을 **테두리 중앙값**에서 뽑으므로(`sampleBackground`, 이 목적으로 export 했다), 순수 마젠타로 덧대면 기준색이 순수 마젠타로 바뀐다. 모델이 칠하는 마젠타는 그것과 꽤 다를 수 있어(실측: `rgb(216,39,217)`, 거리 67 > 허용 오차 62) flood fill 이 **덧댄 띠에서 멈춘다**. 그러면 결과물이 마젠타 사각 덩어리인데도 전체 keyed 비율이 띠 면적만으로 26% 를 찍어 게이트를 통과했다. 그래서 게이트를 하나 더 뒀다: **띠를 뺀 원본 영역 안에서** 지워진 비율(`MIN_INNER_KEYED` 15%) — 성공 컷은 51~72%, 실패 컷은 0.0% 였다.
- 마젠타 프린지를 잴 때 쓰는 거친 판정식(`r>140 && b>140 && g<110 && …`)은 **보라색 피사체에서 거짓 양성**이다. 마도사(hero-03)의 뒷모습은 2134 픽셀이 걸리지만 전부 로브·머리의 연보라이고, 실제 배경색 `rgb(247,52,218)` 과 허용 오차 안에 있는 픽셀은 **0** 이다. 프린지 판정은 그 이미지의 **실제 배경색**과의 거리로 해야 한다.
- 미러링 주의: 포켓몬 스킨은 아군 스프라이트를 `transform: scaleX(-1)` 로 렌더한다(`src/styles/runtime/battle/18-pokemon-layout-redesign.css`). 그래서 원본은 머리가 **좌상단**을 보게 그리고(`COMPOSITION_BACK`), 미러링 후에 우상단 적을 보는 방향이 된다. 부작용으로 손 좌우가 뒤집혀 정면 시트와 무기 손이 반대가 된다 — 후면 구도에서만 보이는 화면상 차이이고, 두 시점은 서로 다른 스킨 경로라 한 화면에 같이 서지 않는다.

## Battle input and visibility P0 contract (2026-07-30)
- `battleDom.ts` owns one `commandCursorIndex` for the current root/submenu. Arrow keys update that index, `data-battle-command-cursor="true"`, roving `tabIndex`, `aria-current`, and DOM focus together; Z/Enter clicks that same button. Focus changes update the index. Do not restore an attack-only confirm path or CSS `:first-of-type` selection. Root keydown handling records the actual `KeyboardEvent` in a `WeakSet`; the window fallback must skip that same event even if synchronous rendering detached its original button target. A `root.contains(event.target)` check alone is insufficient and caused Enter to open a submenu and immediately activate its first entry.
- Cancel remains a stack: X/C/Escape closes the current submenu first, or cancels target selection back to the command root. A menu-key change resets the command cursor to its first enabled non-preview button; disabled/preview-only rows are excluded.
- Target selection is field-centric **in the classic ui-style**: no duplicate target prompt or enemy-button list, and the message window carries only concise controls. The selected field enemy always owns the ring/brackets and DOM focus. **The gameplay runtime is keyboard-only (director decision, 2026-08-03)** — classic battle commands and field targets deliberately pass pointer events through (`battle.css` keyboard-only rule); Z/Enter drives buttons via `.click()` dispatch. **Pokemon ui-style exception (2026-08-02 adversarial review §11):** command and target buttons accept pointer clicks, and the bottom band keeps a target menu synchronized with the field ring. Duplicate enemy display names receive stable 1-based suffixes in the enemy HUD, target prompt, and target buttons. Submenu Back and target Cancel are direct command-panel footer controls outside the scrollable list, above the key-hint footer. The message window shows a short situational line ("○○을 노린다").
- Canonical generic `cmd_attack`, `cmd_skill`, and `cmd_item` labels resolve through project terms even when old class data retains stale generic names. Custom skill-subset command names remain authored data. The common auto control is labelled `자동 (A)` in the Korean runtime/reference surface.
- **배틀러 배치(`BATTLER_PLACEMENTS`, `src/player/battleFieldDom.ts`)는 저작 y = 노드의 바닥이다.** 노드가 `translate(-50%, -100%)` 로 앉고, 좌표계는 필드에서 `--battle-stage-inset-top`(rm2000 8px / 나머지 10종 48px) 만큼 들어간 배틀러 그룹 박스의 백분율이다. 따라서 스프라이트 상자가 큰 스킨은 y 가 작을 때 **필드 위로 잘리고**(`.battle-field { overflow: hidden }`), 백드롭 그라디언트가 필드 높이 33% 에 지평선을 두므로 발(이미지 bottom)이 그보다 위면 몬스터가 하늘에 뜬 것으로 보인다. 2026-08-28 실측으로 6종을 정정했다: rm2003 78→96(두 줄 모두, 아군도 같은 줄 — 사이드뷰 대치 구도), pokemon 다마리 분기 90→100, chrono 48→86, ff 76→82, mother 62→84, mv 86→96. rm2003 의 안전 구간은 90..104 뿐이다(앞줄 상단 ≥ 필드 상단, 뒷줄 바닥 ≤ 필드 바닥).
- **스킨 CSS 에서 `.battle-enemy` 의 `left`/`top` 을 `!important` 로 고정하면 안 된다.** `_mv.css`·`_rm2000.css`·`_dragonquest.css` 가 "단일 적을 가운데" 목적으로 한 점(`left: 50%` + `top: NN%`)에 고정하고 있었는데, 그 상수가 **다마리 트룹 전체를 같은 자리에 쌓아** 3마리가 한 마리로 보였다(실측: 세 rect 가 완전히 동일). 배치 함수가 이미 단일 적을 x=160(=50%)에 두므로 세 선언 모두 제거했고, 배치는 `--battle-node-x/y` 하나로만 정한다. 겹침은 이제 `battlerGeometry` 의 중심 거리 축이 잡는다(더 작은 스프라이트 상자의 25% 미만이면 실패).
- 적 이름표·HP 게이지는 공용 노드(이름 18px, `.battle-enemy-hud { min-width: 104px }`)라 **적 간격이 좁은 스킨에서는 옆 적 것과 겹친다**. mv 는 간격을 44→52 로 넓히고 `_mv.css` 에서 자기 스프라이트 열 폭(60px, 이름 10px)으로 좁혔다.
- MV is a front-view template, not a color-only compact-HUD variant: 448px field/party + 192px command rail, field row above a four-column party status row, command host on the full right rail. The shared compact layer uses later `!important` rules, so `_mv.css` must reassert its field/host/party/message placement with matching `!important` declarations and style the current `.battle-actor-status` DOM (not legacy `.battle-actor`). The host is layout-only (`pointer-events:none`); the visible panel and field enemies receive pointers.
- Browser regression evidence is split by behavior: `battle-keyboard-input.spec.ts` must drive the real test-play window with keyboard only and prove root cursor/focus movement, submenu confirm/cancel, and target confirm/cancel without pointer clicks. `battle-skins-visual-qa.spec.ts` covers layout: command phase asserts no command/party rectangle intersection and zero visible command/status text intersections; target phase uses `document.elementFromPoint()` at the enemy center and requires the hit to be the enemy or its descendant. `qa-pokemon-dom.spec.ts` uses the current Scarloxy starter species, proves a complete monster-party attack changes HP and returns to actor command, and checks root-command label intersections at 375/768/1280 widths. At widths up to 480px the Pokemon surface hides the keyboard-only hint; pointer-capable commands remain available. These focused Playwright tests must pass in addition to overflow checks.

## 배틀러 idle 애니메이션 (2026-08-30)
- 전투 화면에서 움직이는 것이 이펙트·플래시·셰이크뿐이라 아무 일도 없는 동안 배틀러가 정지 그림이었다. 이제 **카탈로그에 등록된 배틀러만** 제자리 idle 애니메이션이 돈다. 정본은 `src/assets/battlerIdleAnimations.ts` 하나다. 등록되지 않은 리소스 id 는 지금까지의 정적 렌더 그대로다 — 몬스터 그래픽이 140여 종이라 옵트인이 아니면 유지 비용이 폭발한다. **필드 적(`.battle-enemy-image`)은 idle 스트립을 쓰지 않는다.** 스트립은 영상에서 키잉한 프레임이라 반투명 픽셀이 섞이고, CSS 가 `object-position: -99999px` 로 정적 `src`(원본은 mid-alpha 0%)를 밀어 그 스트립만 보여 몬스터가 반투명해 보였다. 파티 몬스터·액터 시트 idle 은 그대로다.
- **두 티어.** 성질이 다른 두 배틀러 경로를 각자의 좌표계로 돌린다.

  | 티어 | 대상 | 셀 | 좌표 | 소스 |
  |---|---|---|---|---|
  | `image-strip` | 적·파티 몬스터 (`<img>`) | 192px 정사각 | 백분율 | 영상 클립에서 프레임 추출 |
  | `image-strip` | 후면 액터 (`<img>`) | 290×280 (표시 상자 비율) | 백분율 | 영상 클립에서 프레임 추출 |
  | `sheet-cell` | 정면 액터 전투 캐릭터셋 (`.battle-actor-sprite`) — 2026-09-03 부터 **192px 고해상도 짝**(`starter/hires/idle/`) | 192px(원본 48px 를 xBR 4배) | px | 절차 생성 + 결정적 업스케일 |

- **왜 `<img>` 를 span 으로 바꾸지 않았나.** 스킨별 width/height `!important` 규칙(적 56×64, 포켓몬 148×148)은 intrinsic 크기를 가진 치환 요소를 전제로 걸려 있고, rect 프로브(`scripts/lib/runtimeQaRun.mjs`)·`naturalWidth` 대기(`scripts/capture-ice-grand-adventure.mts`)·`src` 계약(`test/battleEnemyGraphicFidelity.test.ts`)이 모두 이 엘리먼트를 본다. 그래서 `<img>` 와 `src`(정적 원본)를 그대로 두고, CSS 가 `object-position: -99999px` 로 **내용 이미지만 상자 밖으로 밀어** 배경 스트립을 보이게 한다. 치환 요소의 내용은 콘텐츠 상자에서 잘리므로 그려지지 않고, 배경은 정상적으로 칠해진다(브라우저 실측). `opacity`/`filter` 는 배경까지 함께 지우므로 쓸 수 없다.
- **왜 `steps(N, jump-none)` 인가.** 기본 `steps(N)` 은 첫 프레임을 건너뛴다. `jump-none` 이라야 0% 와 100% 를 모두 포함해 N 프레임에 N 번 멈춘다(실측: 8프레임에서 1/7 = 14.2857% 간격).
- **백분율 함정.** `background-position` 백분율은 (엘리먼트 폭 − 배경 폭)에 대해 계산된다. 배경이 N배 넓으므로 `0% → 100%` 가 곧 첫 → 마지막 프레임이다. `-100% × N` 으로 밀면 배틀러가 상자 밖으로 나가 **화면에서 사라진다**(처음 그렇게 썼고 브라우저에서 잡혔다).
- **전투 방식 3종은 자료집 시스템 탭에서 고른다 (2026-09-03, 감독 지시 "정면식·측면식·몬스터식").** 활성 스킨은 `ACTIVE_BATTLE_SKIN_IDS = ["pokemon", "rm2000", "rm2003"]` — 드롭다운 라벨은 「흰 창 · 박스 HUD」(몬스터 대치) · 「유리 창 · 정면 필드」(rm2000) · 「유리 창 · 측면 필드」(rm2003). 라벨에 타사 제품·프랜차이즈 이름은 못 쓴다(`test/detsukuruBrandStrings.test.ts`, 법무). 위치: 자료집 → 시스템 → 「전투 규칙」 카드 → 「시작 설정」의 「전투 UI 스타일」(`db-field-system-battle-ui-style`). 계약: `test/battleSkinRegistry.test.ts`, e2e `test/e2e/battle-skin-trio-select.spec.ts`(드롭다운 항목 셋 + 각 방식으로 전투 진입).
  - **rm2003 = 측면 전투.** 오전에 rm2000 으로 풀리던 옛 id 를 같은 날 측면 스킨으로 되살렸다(`LEGACY_SKIN_ALIASES` 에서 빠짐, `classic` 만 남음). 적은 왼쪽 두 줄(y 112/124, 간격 48), 아군 전투 시트(48px 셀, 고해상도 짝)는 오른쪽 사선 열(x 220+22i · y 84+25i, 발끝 기준 1.25 배)에 서서 마주 본다 — `BATTLER_PLACEMENTS.rm2003`. 첫 판 간격 18/18 · 1.35 배는 넷이 한 덩이로 겹쳤다(실측). 발 비율 픽스처 `battleEnemyFeetRatios.json` 은 `scripts/qa/measure-battler-feet.mjs --skin=rm2003 --write=1` 로 잰다(하네스 qa-back-battler.html, 3마리 troop_bat_swarm).
  - **유리 HUD 는 한 파일을 두 스킨이 나눠 쓴다.** `_rm2000.css` 의 205 개 선택자를 `[data-battle-skin="rm2000"]` → `[data-battle-skin-family="glass"]` 로 바꿨다(특정도 동일). 레지스트리 `family: "glass"`, `battleDom` 이 루트에 `data-battle-skin-family`(묶음 없으면 id)를 심는다. `_battlers.css` 의 콩알 크기 강제 규칙(`:not(:where(…))`)과 `17-sprint-a-polish` 의 HP 노출도 묶음으로 제외/포함한다. 구도만 `_rm2003.css` 가 뒤에서 덮는다(타격 방향 가로 `--hit-dir`, 시트 배율, 적 깊이 `z-index: var(--battle-depth)`). 정면 전용 lunge/knockback(05-poses-motion 의 `[data-battle-skin="rm2000"]`)은 묶음이 아니라 rm2000 에만 남겨 측면은 공용 가로 모션을 쓴다.
- **전투 연출 5종 (2026-09-03, "전투가 너무 심플하다" 후속).** 한 번의 타격이 「대사 + 이펙트 1장 + 숫자」였던 것을 다섯 층으로 늘렸다. 설계 노트 `docs/superpowers/specs/2026-09-03-battle-effect-hires-design.md` 「후속 — 연출」 절.
  - **뒷모습 파티(rm2000).** `battleFieldDom` 배치표의 rm2000 이 `partyFacing: "back"` 이 되어 액터별 back 배틀러(290×280)가 필드 하단에 선다. 슬롯은 `RM2000_PARTY_SLOTS`(인원수별, 가운데 적 자리를 비움), 발끝 y=160. 상자 크기는 `_rm2000.css` `[data-party-facing="back"]` 규칙. 레지스트리 `showAllySprites: true`. 계약: `test/battleFieldAllySprite.test.ts`, `test/battleEnemyPlacementGeometry.test.ts`.
  - **타격 세기(`src/player/battleHitIntensity.ts`).** 피해/최대 HP 비율로 graze(<8%)·normal·heavy(≥30% 또는 급소)·crushing(≥60% 또는 막타). `battleDom.onDamageFeedback` 이 `applyHitIntensity` 로 대상 노드에 `data-hit-intensity` + `--hit-knockback/--hit-squash`, 루트에 `--hit-punch` 를 심고, heavy 이상은 `battle-field-punch`(`.battle-field` 의 `scale` transition — animation 슬롯은 흔들림이 쓴다)와 화면 흔들림(`flashBattleField(root, kind, intensity)`, 진폭 `--battle-shake-x/y`)을 건다. **넉백·찌그러짐은 juice 키프레임 안에 있다**(`battle-juice-hit/critical`, `rm2000-juice-hit/critical`) — 노드의 `animation` 이 정적 `.battle-motion-knockback` transform 을 이기기 때문이다. 방향은 `--hit-dir-x/y`(기본 적 (-1,0)·아군 (1,0), rm2000 은 적 (0,-0.45)·뒷모습 파티 (0,0.45)).
  - **격파.** 페이드 대신 `battle-death-dissolve`(하얗게 타올라 위로 흐려짐) + `spawnDeathShards`(조각 12개, 인덱스 결정적, `.battle-death-shard`). 조각 출발점은 `offsetHeight`(레이아웃 px)로 잰 몸통 중심 — `getBoundingClientRect` 는 무대 배율이 곱해져 머리 위로 올라갔다(실측). 숨쉬기 일시정지 규칙은 `.defeated` 를 제외해야 dissolve 가 멎지 않는다.
  - **적 예고.** `planEnemyActionBeats` 가 `windup`(300ms × weight) → impact(lunge) → recover 세 비트를 낸다(`ENEMY_WINDUP_MS`). `battle-motion-windup` 은 살짝 키우고 어둡게. 모션 규칙은 `.battle-scene[data-battle-skin] …` 로 (0,5,0) — 스킨의 `.battle-scene[ui][skin] .battle-enemy { transform }` (0,4,0) 에 지지 않기 위해서다. rm2000 은 적이 아래로 내리찍고 뒷모습 파티는 위로 뛰어든다.
  - **앰비언트.** idle 스트립이 없는 적 이미지는 `battler-breathe`(`scale` 속성, 2.6초, 적마다 `--breathe-delay` 위상)로 숨 쉬고, `.battle-backdrop` 은 38초 주기로 4% 드리프트한다. 둘 다 감속 모드에서 꺼진다.
  - **연출 합성(`BattleAnimationRecord.followUps`).** `{ animationId, startFrame }[]` — 본체가 startFrame 에 닿으면 같은 앵커에 후속을 겹쳐 시작한다(`battleAnimationDom.scheduleFollowUps`, 본체 엘리먼트 안 `.battle-animation-followup` — `inset:0; position:absolute` 가 없으면 시트 아래 240px 로 밀린다(실측)). 전체 길이는 `battleAnimationChainDurationMs`(`src/battle/animationTiming.ts`, 규칙 층이라 DOM 없음)이고 스냅샷 `durationMs` 로 실려 시퀀서가 `recoverMsForAnimation` 으로 recover 비트를 늘린다. 카탈로그 `followUps` 로 fire-burst→smoke-vanish@6 등 8종이 잔향을 갖는다. 계약: `test/battleAnimationFollowUps.test.ts`.
  - **대상 플래시는 SVG 필터다(`src/player/battleFlashFilter.ts`).** `flash.target === "target"` 이면 `.battle-animation-target-flash` 아래 `.battle-enemy-image/.battle-actor-image/.battle-actor-sprite` 에 `filter: url("#battle-flash-tint")` 가 걸린다(05-poses-motion.css, 특정도 (0,6,0) — 스킨의 `filter: none` (0,5,0) 을 이긴다). 필터는 `feFlood(var(--battle-flash-color)) → feComposite(in, SourceAlpha) → feComposite(over, SourceGraphic)`: 색을 그려진 알파로 오려 원본 위에 섞는다 — RM2000 의 대상 플래시 산식이고 정적 원본·idle 스트립·48px 시트 어느 티어든 따른다. 예전 `::after` 상자 오버레이는 투명한 노드 상자를 통째로 밝혀 슬라임 둘레에 사각형이 떴다(실측). `feFlood` 의 var() 는 **feFlood 의 조상**(씬 루트)에서 풀리므로 `battleAnimationDom.applyTimingEffects` 가 루트에도 색 변수를 쓴다. 정의는 `mountBattleScene` 이 루트에 한 번 심는 `svg.battle-fx-defs`.
  - **타이밍 효과는 `durationFrames` 창 동안 산다(`animationTiming.activeTimingEffects`).** 플래시·흔들림 클래스가 시작 프레임에만 걸려 4~8 프레임짜리가 한 프레임(100ms)만 보였다. 같은 종류가 겹치면 나중에 시작한 것이 이기고, 비정상 durationFrames 는 한 칸이다. 계약: `test/battleAnimationTimingEffects.test.ts`.
  - **rm2000 적 정보 카드는 한 장이다.** 이름표·상태 배지·HP 줄을 `.battle-enemy-chrome` 유리 카드 하나(≈40px)로 묶고 `top: calc(100% - 22px)` 로 스프라이트 투명 여백에 올린다. 뒷모습 파티(머리 = 필드 78%)와 발밑 카드(60px)가 겹쳐서다. 적 y 는 접지 띠 게이트(`test/fixtures/battleEnemyFeetRatios.json`)로 고정이라 카드 쪽을 줄였다. 홀수 px·`!important` 리터럴(주석 포함)은 `test/battleRm2000PixelGrid.test.ts` 가 막는다.
  - **캡처.** `probe-battle-anim-frames.mjs --beats=1 [--enemy-hp=6] [--beats-confirms=4]` 가 연출 표식(넉백·펀치·조각·예고·후속)이 바뀔 때마다 한 장씩 `beats/` 에 찍는다. 라운드는 파티 전원이 명령을 넣어야 풀리고, 게이지 흐름에서 적의 턴은 자동 명령을 멈춘 뒤에 온다.
- **영웅 48px 시트는 고해상도 짝으로 그린다 (2026-09-03).** `src/assets/battlerHiresSheets.ts` 카탈로그가 `generated-actor-hero-0N-battle`(+레거시 `hero`)을 `starter/hires/hero-0N-battle.png`(576×1536, 192px 셀)로 보내고, `battleFieldDom.actorBattleImage` 는 등록된 시트면 그 URL 을 쓰며 `data-rendering="smooth"` 를 심어 `image-rendering: auto` 로 축소한다(01-scene-base.css, rm2003 스킨은 자기 pixelated 규칙을 다시 덮는다). **화면 크기는 그대로다** — `background-size` 가 `48 × 2 × 열/행` 논리 px 로 고정돼 있어 시트 해상도와 무관하다. 밀도만 0.5 → 2.0 으로 몬스터(1.9)와 같은 급. 시트는 `scripts/asset-gen/gen-battler-hires-sheets.mjs` 가 `scripts/lib/pixelUpscale.mjs`(xBR 2배 커널 ×2, 이미지 밖은 가장자리 복제 — 투명으로 보면 칸에 잘린 검 끝이 둥글려진다)로 **셀 단위** 로 키운다. 셀 단위라 idle 스트립 프레임 0 == 시트 idle 칸 계약이 4배에서도 성립한다. 등록되지 않은 시트(사용자 저작 캐릭터셋)는 지금까지처럼 원본을 pixelated 로 그린다. 내보내기: 이 경로들은 리소스 id 가 아니라 `webExportRuntimeAssets.ts` 의 조건부 그룹(`usesGeneratedHeroBattlers`)이 `runtimeAssets.json` 에서 싣는다 — 48px 원본 idle 스트립도 같은 그룹에 넣었다(예전엔 어디에도 실리지 않아 내보낸 게임의 사이드뷰 idle 이 빈 상자였다). 계약: `test/battlerHiresSheets.test.ts`.
- **포즈가 이긴다.** `sheet-cell` 티어는 idle 에서만 스트립을 쓴다. attack·hit·defend·dead 는 정적 시트의 `POSE_FRAME` 칸으로 즉시 돌아간다. 애니메이션은 `background-position-x` 만, 포즈 행은 인라인 `background-position-y` 만 건드려 롱핸드가 겹치지 않는다 — CSS 애니메이션이 인라인 스타일을 이기기 때문에 같은 롱핸드를 쓰면 포즈가 죽는다. 포즈 산식 계약은 `test/battlerPoseFrame.test.ts` 가 그대로 지킨다.
- **파일이름 규약.** 스트립은 원본과 **같은 파일명**으로 `public/assets/generated/starter/idle/` 아래 둔다. 그래야 배경 URL 이 원본 파일명을 포함해서 "이 배틀러가 자기 자산을 쓰고 있다" 를 재는 기존 부분문자열 계약(`test/battleFieldAllySprite.test.ts`)이 애니메이션에도 성립한다. 실제로 `hero-03-battle-idle.png` 로 뒀다가 그 계약이 깨지는 것을 먼저 확인했다.
- **프레임 간격은 실측값이다.** 영상 티어는 (루프 구간 프레임 수 ÷ 24fps ÷ 뽑은 장수): 슬라임 219ms, 박쥐 104ms, 골렘 62ms. 임의로 고르면 슬라임이 경련하고 골렘이 슬로모션이 된다. 절차 티어는 `BATTLE_ANIMATION_FRAME_MS`(120ms)를 그대로 쓴다.
- **세 번째 티어: 후면(뒷모습) 배틀러** (2026-08-31). 포켓몬·골든선 계열 후면 구도에서 아군은 `.battle-skin-actor-image` 로 그려지고, 액터별 뒷모습이 있으면 그걸 쓴다(`skinPartySpriteUrl`). 이 티어는 셀이 **정사각이 아니다**(290×280): 표시 상자가 `145px × 140px` 로 **가로가 더 넓어서**, 정사각 셀을 쓰면 가로를 상자폭에 묶는 산식이 칸 높이를 상자보다 크게 만들어 머리·발을 잘라낸다. 셀 종횡비를 상자에 맞춰 굽고, 브라우저 실측으로 렌더된 칸 높이(210.0px)가 상자 높이(210.0px)와 같은지 잰다. 런타임 코드 변경은 없었다 — 이 경로는 이미 `applyIdleAnimationToImage` 로 배선돼 있었고 에셋과 카탈로그 항목만 없었다.
- **프레임 선택의 1순위는 의상 색 충실도다.** 영상 모델은 클립이 진행되며 색을 흘린다. 실측: hero-01 첫 클립은 **파란 튜닉이 갈색으로 바뀌었고**, 루프 이음매만 보고 고른 초기 패킹이 그 갈색 프레임을 실었다 — 즉 "다른 옷을 입은 주인공". 색 집합 비교(팔레트 포함 여부)로는 안 잡힌다: 방패·검에 이미 파란 계열이 있어 1% 차이로 묻힌다. 색 **계열별 지분**(파랑·빨강·**녹색**·따뜻한색·밝은색·어두운색·luma)을 재되, **상대** 편차로 본다 — 상한과 실측값은 아래 계약 절에 있다. `green` 버킷이 없었을 때는 녹색 튜닉과 그것을 덮은 갈색 망토가 **둘 다 `warm`** 으로 묻혀 교체가 거의 드러나지 않았다.
- **의상을 프롬프트에 명시해야 한다.** 두 번째 재생성은 내가 드리프트된 프레임을 원본으로 착각해 "brown tunic" 이라 적어서 더 나빠졌다(편차 0.133). 원본을 직접 보고 "BLUE tunic, BLUE shorts, RED shoulder pads…" 로 못 박은 세 번째 클립이 편차 0.018 로 떨어졌다.
- **선택 제약은 네 개고, 넷 다 상대값이다.** 절대 상한은 이 티어에서 전부 틀린 계약이었다.
  1. **색: 원본에서 2% 이상 존재하는 성분의 상대 편차 ≤ 0.15.** 절대 편차(≤0.08)로는 지분이 작은 성분이 사라져도 통과한다 — 실측: hero-04 클립은 갈색 두건 망토가 자라 녹색 튜닉을 덮었는데 녹색이 피사체의 8% 라 절반이 덮여도 절대 편차 0.035 로 조용히 통과했다. 상대로 재면 0.42 다. **실측은 칸 0 이 아니라 테스트와 같은 전 칸 worst 로 적는다** — 칸 0 만 보면 실린 값이 실제보다 좋아 보인다. 전 칸 worst: 0.071 / 0.075 / 0.080 / 0.092. 상한 0.15 는 **불량 쪽에서** 정했다 (망토 0.42, 갈색 튜닉 0.999 → 가장 가까운 불량과 2.8배).
  2. **모션: 인접한 모든 칸의 변화 ≥ 2% — 최대값이 아니라 최소값으로 잰다.** 최대값으로 재면 8칸 중 한 쌍만 움직여도 통과한다. 실측: 초기 hero-01 패킹은 최대 1.9%·최소 0.01% 로 사실상 정지 화면이었고, `steps()` 는 같은 그림 위에서도 배경 위치를 옮기므로 런타임 검사로도 안 잡힌다.
  3. **루프 이음매 ≤ 평소 최대 걸음 × 1.5.** 절대 상한(2%)은 진폭이 큰 모션을 부당하게 떨어뜨린다 — 실측: hero-03 은 이음매 9.6% 지만 평소 걸음이 14.8% 라 눈에 안 띈다. 감길 때 튀는지는 **걸음 대비**로만 판정된다. 실린 값: 1.17 / 0.25 / 0.65 / 0.71.
  4. **머리: 머리 영역만(피사체 상단 30%) 같은 7버킷으로 재서 상대편차 ≤ 1.0.** 전신 지표는 **고개 돌림을 못 잡는다** — 실측: hero-04 v3 은 의상을 지키면서 고개를 돌려 얼굴을 보였는데 머리가 피사체의 일부라 전신 편차 0.125 로 통과했다. (그때 오른 초록은 "포즈에 따라 튜닉이 더 보인다"가 아니라 **머리띠에 생긴 밝은 녹색 이물**이었다 — 전신 지표만 보면 오진한다.) 같은 버킷을 머리 영역에 걸면 1.941 이다. 상한 1.0 의 여유는 **두 방향으로 따로 적어야 한다**: 알려진 불량 1.941 은 상한의 1.94배 **위**(`1.941/1.0`), 실린 칸 최악 0.665 는 상한의 1.50배 **아래**(`1.0/0.665`). 한 숫자로 뭉치면 산식이 틀린다. 실린 값: 0.526 / 0.167 / 0.337 / 0.665. **이 계약은 얼굴 검출기가 아니다** — 고개를 돌리면 잡히는 이유는 머리카락 지분이 무너져서이고(얼굴 구간 60~76 을 패킹하면 2.452, 주도 버킷 `green`), 머리색·살색 대비가 약한 배틀러에서는 덜 두드러질 수 있다. 실린 자산에서 실제로 잡아낸 결함은 머리띠의 밝은 녹색 이물이었다. **회귀 증명은 음성 픽스처로 고정했다**(`test/fixtures/battler-idle/hero-04-back-head-turned.png`): 실린 칸만 검사하면 상한을 2.0 으로 올려도 통과하므로, 한때 실렸던 결함 스트립을 픽스처로 두고 머리 계약이 그것을 떨어뜨리는 동시에 전신 색 계약은 통과시키는 것(0.125 < 0.15)을 CI 가 매번 확인한다.
- **루프가 안 닫히면 핑퐁으로 감는다.** hero-04 는 세 클립 모두 충실한 구간이 짧아 그 안에 호흡 한 주기가 안 들어갔다 — 어떤 연속 창도 이음매 계약을 통과하지 못했다(최선 1.68). 서로 다른 5칸을 `[a,b,c,d,e,d,c,b]` 로 되짚으면(최종 픽 `91,96,101,106,111` 핑퐁, 간격 5프레임 = 208ms) 이음매가 **정의상 한 걸음**이 되고, 충실한 구간 안에만 머문다. 패커의 `--pick` 은 중복 인덱스를 그대로 받는다.
- **드리프트는 클립마다 형태가 다르다.** hero-04 는 세 번 갈렸다: v1 은 갈색 두건 망토가 자라 녹색 튜닉을 덮었고, 망토를 금지한 v2 는 대신 **탠 가죽 하네스가 녹아 없어지고 녹색 튜닉이 치마처럼 길어졌으며**, 하네스까지 못 박은 v3 은 옷은 지켰지만 **고개를 돌려 얼굴을 보였다**(뒷모습 배틀러엔 색 드리프트보다 나쁘다). 그래서 프롬프트 잠금은 "없어야 할 것"(망토·후드)만으로 부족하고 **"있어야 할 것이 매 프레임 보인다"**(탠 하네스가 상체에 계속 보인다, 튜닉은 허리에서 끝난다)까지 적어야 한다. v3 에서 처음 고른 창(25~33)은 전신 색 계약을 통과했지만(0.125 < 0.15) **머리 계약에서 떨어졌다** — 실제로 고개가 돌아 귀·볼이 보이고 머리띠에 녹색 이물이 있었다. 같은 집계로 그 스트립의 머리 편차는 **전 칸 worst 1.941**(칸 4)이다. vitest 가 처음 보고하는 1.398 은 **위반이 나온 첫 칸**(칸 1)의 값이지 worst 가 아니다 — 실패 메시지의 첫 숫자를 그대로 문서에 옮기면 집계가 어긋난다. 그 스트립은 지금 음성 픽스처로 레포에 남아 있다. 머리 계약을 세운 뒤 클립 전체를 다시 훑어 머리가 깨끗한 구간(91~111)으로 옮겼다. 그 구간은 모션 진폭이 작아(최소 2.36%) 하한 2% 에 가깝지만 네 계약을 모두 통과한다.
- **정지 화면은 티어마다 다르게 되돌린다.** 감속 모드(`prefers-reduced-motion`)·고대비(`forced-colors`)·인쇄에서 `<img>` 티어는 밀어냈던 내용 이미지를 제자리로 돌려 **정적 `src`** 를 보여준다 — 영상에서 뽑은 프레임 0 은 원본과 같은 순간이 아니기 때문이다(실측: 슬라임 상대높이 0.313 대 원본 0.526, 그 순간 눌려 있다). 프레임 0 을 세워두는 것으로는 이전 화면이 되지 않는다. 48px 시트 액터는 절차 생성기가 프레임 0 을 원본 idle 칸과 픽셀 단위로 같게 만들므로 첫 칸에 멈추면 된다(`test/battlerIdleAnimation.test.ts` 가 픽셀 비교로 못 박는다).
- **칸의 종횡비를 지킨다.** `background-size` 의 세로는 `auto` 다. `100%` 로 묶으면 정사각 칸이 상자 종횡비(적 `56×64`, 실측 `180×210`)로 늘어나, 정적 경로의 `object-fit: contain` 레터박스와 다른 그림이 된다. 가로만 `N × 상자폭` 으로 묶어야 `0%→100%` 스텝이 칸 경계에 정확히 떨어진다. 크로미엄은 세로가 `auto` 면 computed 값을 한 값으로 직렬화한다(실측: 8프레임 → `800%`).
- **실루엣 배율은 피크로 맞춘다.** 개별 프레임이 아니라 프레임 전집합에 맞춰야 한다. 한 프레임에 맞추면 날개를 접은 순간이 기준이 되어 박쥐가 원본의 절반으로 줄어든다. 피크 상대폭 실측: 슬라임 0.651·박쥐 0.906·골렘 0.818 대 원본 0.651·0.906·0.815.
- **죽은 배틀러는 숨을 쉬지 않는다.** `<img>` 티어는 포즈마다 속성을 갈아끼우지 않으므로 사망만 CSS(`.battle-pose-dead`)로 끊는다. 적은 620ms 뒤 `battle-death-fade` 로 사라지지만 파티 몬스터에는 그 페이드가 없어 시체가 계속 호흡했다.
- **스트립 로딩 실패**에는 `data-battler-anim` 을 걷어 정적 `src` 로 돌아간다. 배경만 보이는 구조라 스트립이 404 면 빈 상자가 되기 때문이다.
- **새 배틀러를 붙이는 절차는 `openwiki/battler-idle-playbook.md` 에 있다.** 이 쪽은 런타임 계약·CSS·폴백의 *이유*를 적고, 플레이북은 *만드는 순서*를 적는다. 창 탐색은 눈으로 하지 말고 `scripts/asset-gen/select-battler-idle-window.mjs` 를 쓴다 — 계약 지표는 `scripts/asset-gen/battlerIdleMetrics.mjs` 가 정본이고 테스트와 선택기가 같은 파일을 import 한다.
- **생성기.** 절차 티어는 `scripts/asset-gen/gen-battler-idle-strips.mjs`(Jimp, 상진 60% 만 1px 눌러 발은 고정), 영상 티어는 `scripts/asset-gen/pack-battler-idle-strip.mjs`(키드 프레임 → 정적 원본의 알파 박스에 폭 기준으로 맞춰 셀에 앉힌다). 폭 기준인 이유: 날개짓처럼 상하 진폭이 큰 모션은 전집합 박스가 세로로 길어져, 높이로 맞추면 실루엣 폭이 정적 배틀러보다 명함하게 작아진다(실측: 박쥐 상대폭 0.906 → 0.380).
- 계약 테스트: `test/battlerIdleAnimation.test.ts`(카탈로그 정합·`<img>` 유지·포즈 우선·CSS steps/감속/`!important` 래칫).


- **커스텀 프로퍼티로 길이를 넘길 때 `0` 이 아니라 `0px` 을 써라 — 단위 없는 0 은 `calc()` 를 죽인다(2026-08-30).**
  `_rm2003.css`(현 `_rm2000.css`) 가 `--battle-field-border-width: 0` 을 단위 없이 선언하고 있었다.
  `04-anim-damage-layers.css` 는 그 변수를
  `calc(var(--battle-field-border-width) + var(--battle-stage-inset-top))` 로 소비한다.
  CSS `calc` 는 단위 없는 0 과 길이를 더할 수 없으므로 `calc(0 + 8px)` 는 **invalid** 이고,
  그러면 `.battle-animation-layer` 의 `inset` 선언이 통째로 버려진다. 절대배치 레이어는 남은
  `auto` 로 **0×0 수축**하고, 그 위에서 풀리는 모든 백분율(`--battle-node-x/y`)이 0 이 되어
  이펙트가 무대 좌상단에 쌓인다.
  실측 2026-08-30(출하 `player.html`, 기본 스킨 rm2003(현 rm2000), 1024×768):
  레이어 `computed width 0px height 0px`, 사용된 inset `top 0 right 640 bottom 304 left 0`,
  씬 `grid-template-rows 304px 176px 0px`, 필드 `640×304` — **필드는 정상인데 레이어만 접혔다.**
  이펙트 중심이 대상 스프라이트에서 가로 −0.971 · 세로 −0.911(스프라이트 높이 배수) 벗어났다.
  이것이 "전투 애니메이션 좌표가 이상함" 의 근본 원인이었고, 앵커 계약만 고쳐도 이 수축 때문에
  측정이 실패해 옛 경로로 떨어졌다.
  **왜 `04-anim-damage-layers.css` 의 검증 주석은 이걸 놓쳤나**: 그 주석의 계산 검증은
  vxace(`--battle-field-border-width` = 기본 2px) 기준이었다. 기본 스킨 rm2000 은 그 변수를
  0 으로 덮으므로 검증한 스킨에서만 성립했다. 무대 기하 주석을 고칠 때는 **기본 스킨에서**
  실측하라.
  `--battle-window-skin-width: 0` 은 `border-image-width` 가 소비하는데 그 속성은 단위 없는
  배수를 받으므로 옳다 — 모든 0 에 단위를 붙이라는 규칙이 아니라, **`calc()` 에 길이로 들어가는
  변수**에 한한 규칙이다.
  회귀 가드: `test/runtime/battle-target-anim.spec.ts` 가 `data-animation-anchor-why` 를 읽어
  컨테이닝 블록이 접혔는지 이름 대고 실패한다.
- **전투 애니메이션 앵커는 대상 스프라이트를 실측해서 정한다(2026-08-30).** 산식은 순수 함수
  `battleAnimationAnchor`(`src/player/battleAnimationAnchor.ts`)에 있고, `battleAnimationDom.positionAnimation`
  이 `.battle-animation-layer` 와 대상 스프라이트(`battlerSpriteNode`: `.battle-enemy-image` /
  `.battle-actor-image` / `.battle-actor-sprite`)의 `getBoundingClientRect` 를 넣어 **레이어 박스에 대한
  백분율**을 받는다. 저작 스키마의 `BattleAnimationPosition` 이 세로 위치를 정한다 — `head` = 스프라이트
  상단, `center`(기본) = 세로 중심, `feet` = 접지선, `screen` = 무대 중심. `scope: "screen"` 은 대상을
  무시하고 무대 중심에 놓는다. **px 이 아니라 백분율을 쓰는 이유**: `.battle-scene` 에
  `transform: scale(var(--battle-stage-scale))` 이 걸려 있어 rect 는 배율이 곱해진 시각 px 인데, 같은
  레이어 rect 로 나눈 비율에서는 배율이 약분된다(데미지 팝업이 이미 쓰는 방식과 동일).
  예전에는 대상 노드의 `--battle-node-x/y` 문자열을 그대로 복사했다 — 그 값은 배틀러의 **발**을
  가리키고 `.battle-animation` 이 `translate(-50%, -55%)` 로 12px 만 올려 줬으므로, 144px 급 스프라이트에서
  이펙트가 발목 높이에 찍혔다. 그 백분율 복사는 애니 레이어와 배틀러 그룹의 컨테이닝 블록이 픽셀
  단위로 같아야만 성립했고(과거 실측 72px 어긋남), `position`/`scope` 는 `data-*` 로 찍히기만 했다.
  기준은 **요소의 실제 컨테이닝 블록**(`offsetParent`)의 **패딩 박스**다 — 레이어 엘리먼트를
  그대로 쓰지 않는 이유는 위 0×0 수축 사례이고, 경계 박스가 아니라 패딩 박스인 이유는
  `left`/`top` 백분율이 패딩 박스에서 풀리기 때문이다. **붙인 뒤에 잰다** — 순서가 뒤였을 때
  레이어 박스가 0×0 으로 잡혔다.
  실측 못 하는 환경(레이아웃 없는 happy-dom, 아직 로드 전이라 rect 0×0)에서는 옛 복사 경로가 폴백으로
  남고 `data-animation-anchor="fallback"` 이 찍힌다 — 가드는 이 속성으로 폴백 회귀를 잡는다.
  **남은 간극**: `scope: "allTargets"` 의 N개 동시 재생은 아직 없다. `BattleAnimationSnapshot` 이
  `targetId` 하나만 싣기 때문이며, 좌표 결함이 아니라 별개의 미구현 기능이다.
- **대상 표시는 코너 리티클 + 스프라이트 펄스 두 겹이고, 노드를 감싸는 흰 사각형은 쓰지 않는다(2026-08-30).**
  `06-damage-flash-targeting.css` 의 `.battle-target-selected` / `.battle-targeted` 에 있던
  `outline: 4px solid var(--oprn-battle-window-light)`(#e7f2ff) 를 지웠다. 노드 박스는 스프라이트
  실루엣이 아니고(아군 노드는 `176×192` 고정 그리드 박스), 기본 스킨 rm2000 은 같은 노드에 코너
  리티클(`.battle-target-brackets`)을 이미 그려 조준점이 두 개로 읽혔다. pokemon 스킨은 이미 그 사각형을
  무효화하고 화살표 + 스프라이트 깜빡임으로 갈아탄 상태였으므로, 기본 경로만 옛 표현에 남아 있었던 것이다.
  **선언만 지우면 안 된다 — UA 기본 포커스 링이 그 자리를 메운다.** 흰 사각형 규칙을 지웠을 때
  선택된 적의 계산된 outline 이 `1px auto` 로 남았다(실측 2026-08-30). 즉 옛 규칙은 브라우저
  기본 링을 덮고 있었을 뿐이고, 얇아진 사각형이 그대로 보인다. 그래서
  `.battle-enemy:focus/-visible`, `.battle-actor:focus/-visible` 에 `outline: 0` 을 **명시**한다.
  접근성 판단: 이 전투는 키보드 전용 + 자체 커서 모델이고, 선택 상태는 리티클 + 스프라이트 펄스
  두 겹으로 1px 링보다 강하게 표시되며 `battleFieldDom` 이 `aria-selected` 를 함께 갱신한다.
  커맨드 버튼의 `:focus-visible` 스타일(03/08/13/17)은 건드리지 않는다.
  대체 연출 `@keyframes battle-target-pulse` 는 **노드가 아니라 스프라이트**에 건다 — `.battle-enemy` 의
  `filter` 는 접지 그림자(`07-640-scene-turn-ribbon.css`)가 이미 쓰고 있어 노드에 걸면 그림자가 함께
  깜빡인다. 윤곽 색은 `--oprn-battle-window-light` 토큰을 쓴다(하드코딩 hex 는 CSS 예산 래칫이 잡는다).
  **두 키프레임 모두 `--battle-sprite-filter` 를 먼저 깔아야 한다.** `.battle-enemy-image` 에는
  배경 분리용 `brightness(1.4) contrast(1.5) saturate(1.4)` 가 상시로 걸려 있고
  (01-scene-base.css), CSS 애니메이션은 `filter` 속성을 **대체**하므로 `filter: none` 키프레임이
  0.62초마다 그 보정을 날려 선택된 적만 배경에 묻혔다 깨어나듯 깜빡였다. 중립값
  (`brightness(1) saturate(1)`)으로도 해결되지 않는다 — 기본 사슬 자체를 다시 깔아야 한다.
  `.battle-has-result` 에서는 노드와 스프라이트 **양쪽** 을 꺼야 승리 화면에서 죽은 적이 계속 깜빡이지 않는다.
  하단 대상 메뉴 행은 `08-640-target-panels.css` 의 자기 규칙(금색 그라데이션 + `outline: 0`)이 있어
  아무것도 잃지 않는다.
- 위 두 계약의 증거 경로: 산식은 `test/battleAnimationAnchor.test.ts`(rect 리터럴, 타이밍 없음), 화면은
  `test/runtime/battle-target-anim.spec.ts`(출하 `player.html` 경로에서 계산된 스타일과 비율로 판정 +
  `.omo/evidence/battle-anim-target/*.png`). **편집기 셸을 타는 `test/e2e/` 전투 스펙은 기준선에서도
  `startNewGameFromTitle` 이 런타임 부팅에 실패해 돌지 않는다**(실측 2026-08-30: 손대지 않은
  `oprn-battle-system-targeting.spec.ts` 도 같은 지점에서 실패). `test/e2e/battle-animation-anchor.spec.ts`
  는 계약을 새 앵커 기준으로 갱신해 뒀지만, 그 경로가 되살아날 때까지는 실행 가능한 정본이 아니다.

## 필드 아이템 상태 부여 복구 (2026-09-05)

`playerItemUse.ts`는 `stateEffects`의 `add`를 필드 메뉴에서도 적용한다. 존재하는 상태 중 아직 걸리지 않은 상태만 판정하고, 부분 확률은 저장 가능한 세션 `battle` 난수 스트림을 사용한다. 0%·100%·이미 걸린 상태·삭제된 상태는 난수 스트림을 전진시키지 않는다. 모든 효과가 실패하면 아이템과 충전을 유지하며, 아군 전체 적용은 성공한 대상 수와 관계없이 `transitionItemState`를 한 번만 호출한다. 전투의 저항률 모델은 필드에 적용하지 않는다. `test/playerItemUse.test.ts`가 실제 상태 변경, 소비, 난수 재현, 없는 상태 및 파티 충전을 검증한다.

## Authored combat rules (feature16, 2026-09-21)

- `SkillRecord.damageFormula?` is bounded arithmetic, parsed by `battle/damageFormula.ts` without JavaScript execution. Grammar: decimal numbers, `+ - * / %`, unary signs, parentheses, and the documented `power`, `a.*`, `b.*` variables. Input ≤512 characters, nesting ≤32, intermediate magnitude ≤1e12; nonfinite/divide-by-zero is invalid. Negative final values clamp to zero. A formula replaces base damage **including defense**, then existing element/variance/critical/guard/formation modifiers apply. Malformed imported formulas fall back to the model's legacy formula; the editor refuses invalid edits visibly.
- Optional `criticalRate` 0–100, `criticalMultiplier` 1–10, `cooldownTurns` 0–99, `hitSequence` 1–16 ordered multipliers 0–10 are preserved by normalization and editor mutation. Omission retains legacy behavior. Existing `hitRate` remains 0–100. Damage/healing runs each hit separately and records its timeline; MP/PP is consumed once outside the hit loop. Damage stops after target death; healing can still revive an admitted dead target. A healing skill removing `state_death` admits defeated allies through both UI target selection and direct commands.
- `skillCooldowns` is battle-local mutable/snapshot state, never project or persistent monster state. Casting sets N+1; the casting round's completion decrements to N. N complete subsequent rounds are blocked. Strict round completion and gauge whole-party action-cycle completion each decrement once, including incapacitated rounds. `battleSkillUseFailure` is the shared action/menu/auto check. Enemy Gen1 moves retain unlimited PP but still start authored cooldowns.
- Exact Gen1 retains its accuracy bytes, type/STAB ordering, critical stat choice and pre-action status admission. Optional percent crit overrides its speed-based chance; explicit multiplier replaces doubled-level critical scaling. A formula replaces base only, with default formula critical multiplier 2. Legacy omitted fields preserve the exact existing path. Ordered multipliers apply after model calculation, before formation/resource mutation.
- `predictSkillDamageFor` reports total ordinary-hit sequence damage (variance/crit/miss excluded, as before), stops lethal chains, updates HP/MP between formula hits, and exposes hitChance/criticalChance/cooldownRemaining. Auto combat, enemy authored-skill utility, balance views and `simulateBattle` consume shared runtime/prediction paths. Legacy enemy utility is kept when all new authored rules are omitted.
- Enemy AI conditions: inclusive HP/MP percent ranges (zero max MP counts as 0%), state present/absent, number of living visible teammates excluding self, and session switch equality, plus legacy always/turn. `combatConditionMet` is deterministic and consumes no RNG.
- `EnemyRewards.drops?` replaces the legacy drop only when present; `[]` means no items. Up to 64 rows, each itemId/ratePercent 0–100/quantity 1–99/condition. At victory conditions see the defeated enemy's final state, final living teammates, current battle turn and battle-session switches. Every eligible positive-rate row rolls once in author order; quantities repeat item IDs for existing inventory consumers. No eligible row means no RNG draw. The omitted-array path retains legacy pity logic; capture/hidden exclusions remain.
- Formation helper is owned by `battleFormation.ts` (battle UI feature); combat invokes `formationDamage` once after multipliers and before HP/MP mutation. Snapshot prediction uses the same boundary. Runtime passes party `rows` to actor battler creation.

Supervisor validation (not executed by the implementation agent):
`npm test -- test/feature16CombatSchema.test.ts test/feature16CombatRules.test.ts test/feature16CombatRuntime.test.ts`
Existing focused regression candidates: `test/battleRuntimeSuccessRate.test.ts`, `test/battleStrictRuntime.test.ts`, `test/gen1RuntimeExactIntegration.test.ts`.
## Battle reports and physical formation (2026-09-21)

Completed runtime timelines persist into bounded session reports accessible from Esc → 기록 → 전투 기록. Existing actor rows feed physical-only outgoing/incoming multipliers, with front/legacy unchanged and raw stats preserved. Troop authoring predictions stay in the editor. Exact ownership hooks, UI paths and parent verification: `openwiki/feature16-battle-ui.md`.

## Combat correctness hardening (2026-09-21)

- Strict queued skill actions (including troop-event extra actions) recheck `battleSkillUseFailure` immediately before execution. A newly cooling, silenced or unaffordable queued cast is discarded without MP/PP consumption or another cooldown start. Decrement remains once per completed strict round or gauge action cycle.
- Victory rewards evaluate against the pre-cleanup enemy states. Only afterward are battle-end states removed. `rewardTurn` tracks the actual strict round/gauge cycle containing the action or upkeep; gauge cycle completion must not add another turn when evaluating conditional drops.
- Skill prediction clones vitals, state counters and MP/PP/cooldown maps, consumes one cast cost on the clone, and recomputes every hit against evolving state/vitals. Self targets share the cloned caster. Gen1 enemy unlimited PP is preserved. Ordinary-hit previews apply **guaranteed** state transitions between hits (including RM hit recovery, Gen1 immunity/major-status exclusivity and fire defrost); probabilistic procs remain excluded, just like variance, misses and criticals. No runtime RNG or snapshot data is mutated.
- HP versus MP is retained for both damage and healing in Gen1/RM timeline → sequencer feedback → popup/director text. The HP presentation ledger ignores **all** MP feedback, so MP damage cannot animate HP loss/death. MP gauges continue using authoritative snapshots, as before.
- Parent-only command: `npm test -- test/feature16CombatHardening.test.ts`. Coverage: actual strict extra-cast rejection; gauge cooldown cycles; strict/gauge state/turn drops; cost-aware evolving formula and ordinary-formula predictions; sequencer-to-ledger MP damage; exact Gen1 MP timeline. Implementation agent did not run tests, typecheck, server or browser.

## Gen1 교체 후 이전 적 HUD 잔류 (2026-09-24)

`runtime.visibleEnemies()`는 Gen1의 현재 적 한 마리만 반환한다. 필드 갱신은 새 노드를
추가하면서 이전 노드를 제거하지 않아, 첫 상대를 쓰러뜨린 뒤 다음 명령 화면에 이전
몬스터와 HP 띠가 남았다. `syncEnemyGroup`과 별도 HP 목록의 `syncEnemyListPanel`은 전달받은 snapshot의 배틀러 ID에 없는
노드를 정리한다. `battleDom.syncView`의 `retainDepartedEnemies: sequenceBusy`로
진행 중 타격·포획 연출의 대상은 유지하고, 시퀀스 종료 후 정리한다. 생존 여부만으로
삭제하면 RM 전투의 쓰러짐 연출과 현재 snapshot의 사망 적까지 지우므로 그렇게 하지 않는다.
회귀 계약은 `test/battleEnemyRosterDom.test.ts`이며 이번 세션에서는 vitest를 실행하지 않았다.

## 트레이너 전투의 도입 문구 (2026-09-24)

`introDirectorState`는 snapshot.troopId의 `trainerBattle`을 먼저 확인한다. 명시된 트레이너 팀은
팀 이름으로 「승부를 걸어왔다!」를 표시하며, 그렇지 않은 팀만 기존 종족 기반 야생 판정을 따른다.
적 이름에 소유자 이름이 있다는 이유만으로 트레이너라고 추정하지 않는다. 포획 차단 조건은 그대로다.
새솔 라이벌 실전에서 몬스터 종족만 보고 「야생의 세린의 …」로 소개하던 불일치를 확인했다.

## 포획 불가 전투의 가방 목록 (2026-09-25)

`battleCommandDom.captureItems`는 `snapshot.troopId`의 `trainerBattle` 또는
`uncapturable`이 true이면 빈 목록을 반환한다. 몬스터식 가방과 일반 포획 하위 메뉴,
가방 수량 표시가 동일 정책을 쓴다. 회복 아이템은 유지하고 야생전의 볼은 그대로 표시한다.
엔진 `runtime.ts`의 포획 거부 검사는 계속 필요하다. UI 필터는 엔진 검증을 대체하지 않는다.
새솔 약품 회수 트레이너전에서 포획 버튼이 가방에 나타난 것을 전용 플레이어로 재현했다.
회귀 정의: `test/gen1BattleCommandDom.test.ts`의 두 제한 유형과 기존 야생전 경로.
이번 세션에서는 Vitest를 실행하지 않았다.


## 특수 명령 · 입력 기술 · 다부위 적 (명작 공백 #4 #8 #10, 2026-09-27)

- **특수 효과** `SkillEffect` 에 네 종류가 더해졌다(`src/battle/battleSpecialEffects.ts`):
  `steal`(대상 `EnemyRecord.stealItems [{itemId,rate}]` 를 차례로 굴려 하나를 빼앗는다, 적마다 1회) ·
  `scan`(라이브라 — HP/MP·약점을 전투 메시지로 알리고 `BattleBattlerSnapshot.scanned` 로 HP 바를 드러낸다) ·
  `learnEnemySkill`(청마법 — 대상의 `SkillRecord.learnable` 기술 중 모르는 것 하나를 배운다. 그 기술을 아는 배우는 learnable 기술에 맞아도 배운다) ·
  `randomSkillFrom {skillIds}`(흉내·춤·슬롯).
- **입력 커맨드** `SkillRecord.inputSequence {keys, timeLimitMs, successMultiplier?, failMultiplier?}` — 전투 UI 가 키를 순서대로 요구하고(`battleInputSequence.ts`, `24-input-prompt.css`)
  시간 안에 맞히면 성공 배율, 틀리거나 늦으면 실패 배율을 위력에 곱한다. 자동 전투·적은 입력 없이 기본 위력이다.
- **홀드 차지(액션 전투)** `ActionSkillProfile.chargeTiers [{holdMs,multiplier}]` — 캐스트 키를 누른 시간이 넘은 가장 높은 단계의 배율. 생략하면 즉시 발동(기존).
- **다부위 적** `TroopMemberRecord.partOf`(본체 인덱스)·`partTag`. 본체가 쓰러지면 부위도 쓰러지고, 부위가 파괴되면 본체 행동 중 `requiresPart` 가 같은 것은 쓰지 않는다.
  **부위 손실 상태** `StateRecord.disablesEquipSlot` — 그 상태인 동안 해당 장비 슬롯의 능력치 보너스를 잃는다(F&H 팔 절단).
- 테스트: `test/mgL4SpecialCommands.test.ts`, `mgL4InputCharge`, `mgL4MultiPartEnemies`.

## 롤링 HP · 움직이는 배경 · 화면 색 필터 (명작 공백 #15 #37, 2026-09-27)

- **롤링 HP** `system.battleRollingHp`(+ `battleRollingHpPerSecond`, 기본 40) — 규칙 엔진은 피해를 즉시 확정하고 `src/player/rollingHp.ts` 가 **표시와 결산만** 바꾼다.
  표시 HP 가 실제 HP 쪽으로 흘러가고, 실제 0 인데 미터가 남은 아군은 「쓰러지는 중」이다. 결과 화면이 뜨는 순간 미터를 멈추고 승리·도주면 남은 HP 로 살아남는다. 패배는 결산하지 않는다.
- **움직이는 전투 배경** `TroopRecord.backdropAnimation {scrollX, scrollY, waveAmplitude, waveFrequency, paletteCycleSeconds}`(0/생략 = 끔, 범위는 `project/battleBackdropAnimation.ts`).
  `player/battleBackdropMotion.ts` 가 그린다. `prefers-reduced-motion` 이면 정지 배경.
- **화면 색 필터** Tint Screen(m2-046)에 `saturation 0~200 · grayscale 0~100 · sepia 0~100`(`project/eventCommands/screenFilter.ts`). 필드는 `.play-stage` 오버레이 backdrop-filter, 전투는 `.battle-field` filter.
  필드가 없는 옛 명령은 중립값(100/0/0)이라 예전과 같다. 세이브에 들어간다.
- 테스트: `test/mgL5bvisRollingHp.test.ts`, `mgL5bvisBackdropMotion`, `mgL5bvisScreenFilter`.

## 전투 개시 형태 · 동료 작전 · 패배 규칙 · 피해 전가 · 도주 가산 (명작 공백 #3 #11 #20 #33 #34 #36, 2026-09-27)

모두 옵트인이다. 필드가 없는 옛 프로젝트의 전투 결과는 바뀌지 않는다.

- **개시 형태(#3)** — `BattleStartFormation` = normal / preemptive / backAttack / pincer / surprise(`src/battle/battleFormation.ts`).
  `battleProcessing.formation`으로 지정하거나, `system.battleFormationRoll`이 켜져 있으면 파티·적 민첩과 심볼 접촉 방향으로 굴린다. 끄면 항상 보통이다.
  선제는 적 게이지가 0에서 출발하고, 백어택·협공은 아군 대열을 뒤집고 방어가 약해진다.
- **동료 작전(#11)** — `ActorOptions.autoBattle`(배우 또는 직업)이면 명령 메뉴 없이 스스로 행동하고, `autoTactic`으로 성향을 고른다:
  attackAll / healFirst(HP 70% 아래 회복) / conserveMp(MP 0 기술만) / followOrders. 생략하면 기존 균형 AI다.
- **패배 규칙(#20)** — `StateRuntimeEffects.incapacitates`(석화처럼): 이 상태는 행동하지 않고, 아군 전원이 쓰러졌거나 이 상태면 패배다. 스캔은 `SkillEffect scan`(아래 #10 절).
- **피해 전가(#33)** — `StateRuntimeEffects.damageToMpRate`: 받는 HP 피해의 이 비율을 MP로 먼저 갚는다(MP가 모자라면 나머지는 HP로).
- **도주 가산(#34)** — `system.escapeBonusPercent`: 도주에 실패할 때마다 다음 확률에 %p를 더한다. **생략 = 0(가산 없음, 예전 식 그대로)**.
  스냅샷의 `failedEscapeAttempts`가 전투 중 누적 횟수다.
- **최후의 일격(#36)** — `EnemyReaction.trigger: "onDeath"`: 아군 타격으로 쓰러진 적이 전투당 한 번 `skillId`를 쓰고 쓰러진다. 아군이 전멸했으면 패배가 우선한다.

검증: `test/mgL2Bflow{Formation,Tactics,Defeat,DamageToMp,Escape}.test.ts`, 화면은 `scripts/qa/runtime/masterpiece-battle.scenario.mjs`(선제 배너).

## 리미트 · 기력 · 파티 게이지 · 감정 상성 · 장비 부여 (명작 공백 #7 #9 #16 #21 #23, 2026-09-27)

- **리미트(#9)** — `system.limitGauge { enabled, label?, takenRate?, dealtGain? }`: 받은 피해의 최대 HP 대비 비율(×takenRate%)과 명중마다 dealtGain으로 찬다.
  `SkillRecord.limitSkill`은 게이지가 가득일 때만 쓸 수 있고, 쓰면 비운다.
- **두 번째 자원(#21)** — `system.resource2`(TP식, 피해로 찬다) + `SkillRecord.resource2Cost`.
- **파티 게이지(#16)** — `system.partyGauge`(OMORI Energy식 공용 게이지) + `SkillRecord.partyGaugeCost`(추격 연계기).
  세 게이지 모두 `battleGaugeHud`가 전투 HUD에 그린다(`data-testid` `battle-limit-*` / `battle-resource2-*` / `battle-party-gauge`).
- **감정 상성(#23)** — `StateRecord.emotion { family, tier }`: 같은 family를 다시 걸면 tier가 오른다. `system.emotionCycle [{attackerFamily, targetFamily, multiplier}]`이 피해 배율이다.
- **장비 부여(#7)** — `EquipmentRecord.grantsSkillIds` / `grantsCommand`: 장착 중에만 스킬·명령이 전투 메뉴와 자동 전투에 뜬다.
  `effectFlags.halfMpCost`를 MP 계산이 실제로 소비하고, `ItemUpgradeRule.target: "equipment"`는 끼운 장비를 그 자리에서 강화한다.

검증: `test/mgL3{BattleGauges,BattleGaugeHud,BattleEmotion,BattleResourceEditor,EquipmentGrants}.test.ts`, 화면은 `masterpiece-battle`(게이지 비트).
