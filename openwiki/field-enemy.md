# 필드 적 (눈에 보이는 적, 심볼 인카운트) — `place_field_enemy`

FF6·크로노 트리거식 「필드에 보이는 적」을 조수가 한 마리씩 놓는 도구와 그 런타임 계약이다.
새 런타임 개념은 없다. 이벤트 페이지 셋과 기존 명령만 조합하고, 런타임에는 작은 훅 하나만 더했다.

- 도구: `src/editor/tools/fieldEnemyTools.ts` (`place_field_enemy`, 등록은 `toolRegistry.ts` 의 `FIELD_ENEMY_TOOLS`)
- 런타임 훅: `src/player/commandBattle.ts` `contactEventFormation` — 접촉 트리거(eventTouch·touch·playerTouch) 이벤트의
  `battleProcessing` 은 `symbolContactFormation`(선제/기습) 을 따른다. 명령에 `formation` 이 직접 있으면 그쪽이 이긴다.
  `system.battleFormationRoll` 이 꺼져 있으면 기존처럼 일반 진형이다(도구가 경고한다).
- 검증: `npm run qa:runtime -- --scenario field-enemy` (`scripts/qa/runtime/field-enemy.scenario.mjs` + `field-enemy-fixture.mts`)

## 다른 수단과의 구분

| 필요 | 도구 |
|---|---|
| 걷다 보면 무작위로 전투 | `set_encounter_table` |
| 사냥터 구역에 몬스터가 흩어져 있음(위치는 런타임이 정함) | `make_hunting_ground` (`fieldSpawns`) |
| 정해진 자리에 한 마리, 순찰·시야 추격·소멸/재출현을 저작 | `place_field_enemy` |
| 지나가지 못하게 막는 보스·문지기 | `place_battle_blocker` |
| NPC 순찰 | `configure_npc_patrol` (NPC 전용, 적에게 쓰지 않는다) |

마을·실내에는 놓지 않는다(`buildMapPlacementContext` 의 role 이 town/interior 면 `field-enemy-safe-area` 로 거절).
보스 방은 도구 설명에서 제외한다(이벤트 전투를 직접 저작).

## 필드 그림 = 전투 그림 (2026-10-14)

필드 그림은 charset(걷기 칩), 전투 그림은 도트 몬스터 시트(`monsterResourceId = generated-enemy-<slug>`)라 다른 자산 계열이다.
예전에는 이름으로 charset 을 찾다 못 찾으면 monster 첫 칸(슬라임)으로 말없이 떨어져서, 박쥐를 불렀는데 필드엔 슬라임이 서 있었다.
지금은 **전투 그림(선두 적의 monsterResourceId)이 정본**이다: `src/editor/tools/fieldEnemyGraphics.ts` 의 `FIELD_CELL_BY_SLUG` 가
전투 slug → 같은 종류의 charset 칸을 정한다(슬라임 계열·해골 계열·유령·골렘·미믹·용 …).

- `graphic` 을 안 주면 그 칸이 자동으로 쓰인다. 주면 그 칸과 같아야 한다(`field-enemy-graphic-mismatch`).
- `troopId` 를 생략하고 `graphic` 만 주면 그 칸을 그리는 전투 시트를 선두로 둔 적 그룹을 고른다.
- 대응 칸이 없는 종(박쥐·늑대·거미 등)은 **거절**한다(`field-enemy-no-field-graphic`) — 다른 그림으로 대체하지 않는다. 필드에 놓을 종을 늘리려면 charset 에 같은 종 칸이 생긴 뒤 표에 한 줄을 더한다.

## 걷기 칩이 없는 종: 전투 그림에서 필드 칩을 뽑는다 (2026-10-24)

위 표에 걷기 칩이 없는 종(늑대·거미·도깨비불·멧돼지 … 생성 도트 몬스터 대부분, 사용자가 올린 `monster` 그림)은 이벤트 그림이
전투 그림 그대로(`{sprite:{type:'bundled', id:'generated-enemy-…'}}`)다. 예전 런타임은 이것을 2칸 상자에 줄인 **정지 그림**으로 세웠다
(방향·걸음·그림자 없음 — 사용자 「정말 별로」). 지금 플레이어는 그 텍스처에서 **필드 걷기 칩을 런타임에 뽑는다**
(`src/player/fieldFoeSprite.ts`, `eventSpriteResources.withDerivedFieldFoe`, 호출 `playSceneMapRuntime` 이벤트 갱신):

- 크기: 정확한 정수배 축소(64px → 32px, 약 2칸). 블록 최빈색, 동률이면 밝은 색. 프레임 폭은 24px 칩 제한이 없다 — 텍스처 프레임을
  칩 번호(`charsetFrameIndex`, 0번 캐릭터)로 등록하므로 기존 걷기·제자리걸음·방향 코드가 그대로 돈다(`isCharsetLikeTextureKey`).
  배율은 24px 칩과 같게 잡는다(`EventSpriteTexture.derived`).
- 방향: 오른쪽 = 원본(전투 그림은 오른쪽을 본다), 왼쪽 = 좌우 반전. 위 = 오른쪽 그림, 아래 = 왼쪽 그림(측면 그림뿐).
- 걸음: 열 0 = 1px 눌림, 열 1 = 기본, 열 2 = 1px 들림. 걸을 때 칩 걷기 주기를 그대로 탄다.
- 읽힘: 어두운 1px 외곽선(그림의 가장 어두운 색) + 바깥 1px 밝은 반투명 테 + 두 단 바닥 그림자.
- 덮어쓰기: 이벤트가 걷기 칩(charset)을 지정하면 이 경로를 타지 않는다 — 손으로 찍은 필드 칩이 언제나 이긴다.
- 화소를 못 읽으면(오염된 캔버스 등) 예전 정지 그림으로 떨어진다. 편집기 맵 표시(`editSceneEventMarkers`)는 아직 정지 그림이다.
- 3/4 관문: 새로 그린 그림이 아니라 전투 도트에서 런타임에 파생한 그림이고, 몬스터 전투 도트·캐릭터 칩은 object-gate 대상이 아니다
  (`openwiki/harnesses/object-gate.md` 「대상」). 굽는 파일도 없다.
- 비교·결정 기록: `~/claude-viz/field-foes-1.html`(A 파생 / B 손 도트 / C 심볼 / D 오라 — 사용자가 A 선택), 비교 도구 `scripts/content/field-foes/`.

## 이벤트 모양 (한 마리 = 이벤트 하나, 페이지 셋)

1. `_fight` — 접촉(eventTouch). 움직임은 behavior 에 따라 fixed / 닫힌 경로 custom / chase.
   chase 는 시야(`movement.sight`, 벽 너머 안 봄)·추격(`movement.pursuit`: scope map, 놓친 뒤 `searchMs` 3500 동안 마지막 목격 자리·달아난 방향을 뒤지고 → `onLost:'return'` 으로 **원래 자리 복귀**)
   ·`movement.sightAlert {emote:'exclamation', holdMs:300}`(**시야에 처음 들어온 순간** 머리 위 「!」 를 띄우고 0.3초 멈춘 뒤 쫓는다) 를 갖는다.
   추격 박자·전술은 아래 「추격 박자와 전술」 절.
   `patrol` 을 함께 주면 `movement.route` 로 순찰하다 시야에 들어오면 추격하고, 놓치면 복귀 → 순찰로 돌아간다(`patrolChaseState`, `playSceneAutonomous.ts`).
   접촉 명령: (sightAlert 가 없을 때만 `showEmote` → `wait 520`) → `battleProcessing {canEscape, canLose:false}` → `fork`:
   승리 = `setSwitch(clearSwitch, true)`, 도주 = `setSelfSwitch B`. 패배는 `canLose:false` 라 기존 게임 오버 경로(`applyBattleDefeat`).
2. `_stun` — selfSwitch B. 도주 직후 3초 정지(바로 다시 닿아 전투가 반복되는 것을 막는다) 뒤 B 를 끈다.
3. `_cleared` — 스위치(clearSwitch) 켜짐. 투명·통과·항상 parallel. `respawnSec>0` 이면 N초 뒤 스위치를 꺼서 되돌린다
   (그 맵에 있을 때만 흐른다 — 맵을 떠나 있는 시간은 세지 않는다).

처치 상태는 스위치라서 저장·맵 재진입에서도 유지된다. 스위치 id 를 안 주면 도구가 새로 만든다(`clearSwitchId` 로 한 스위치에 여럿을 묶을 수 있다).

## 이미 놓인 적을 「보면 달려드는」 적으로 — `makeFieldEnemyChase` (2026-10-24)

`src/editor/tools/fieldEnemyTools.ts` 의 `makeFieldEnemyChase(project, map, event, options)` 는 이미 놓인 필드 적(순찰·보초)의 `_fight` 페이지를
추격으로 바꾸는 다시 쓰는 묶음이다(도구 인자 아님 — 데모·생성기 코드용). 순찰 경로(custom route)는 걸음마다 두 박자 쉬는 시야 밖 걸음으로 살리고,
추격은 `pace`(기본 fast: speed 5·frequency 6 → 쫓는 동안 ≈127ms/칸, 주인공보다 빠르고 12칸마다 숨 고름)로 순찰보다 눈에 띄게 빠르다.

- 시야 `sight.facing:'cone'` — `NpcSight` 의 새 값. 이벤트 시선 조건 `eventSeesPlayer` 와 같은 90° 앞쪽 부채꼴(`conditionEventSight.inViewCone`)을
  `npcPerception.npcSeesPoint` 가 쓴다(거리는 맨해튼, 벽 가림 lineOfSight 그대로). 등 뒤로는 못 본다. 편집기 「정면 부채꼴」.
- 들면 `sightAlert`(기본 exclamation, 0.3초) → 쫓다 닿으면 전투 → 놓치면 `pursuit.searchMs`(기본 3500) 두리번 뒤 `onLost:'return'` 으로 제자리 → 순찰.
- 입구(`entryCells`)가 시야+1 안이면 시야를 줄이고, 2칸 밑이면 바꾸지 않는다(들어서자마자 덮치지 않게, `field-enemy-ambush` 와 같은 규칙).
- 폴른 스타는 모든 맵의 `…_foeN` 에 건다(chronoBell.ts — 숲 여섯 맵 포함). 보스·수호자는 제자리.

## 추격 박자와 전술 (2026-10-29 「2배 이상 빠르고 스마트하게」)

정본 `src/project/chaseTempo.ts`(박자·알아챔·지치기·수색 하한, 순수 함수) + `src/player/chaseTactics.ts`(목표 칸 고르기) +
`src/player/playSceneAutonomous.ts §updateChaseNpc`(적용). 헤드리스 지표 `scripts/qa/chase-sim/sim.mts`(vite-node), 실제 플레이 소리 포함 녹화
`scripts/qa/runtime/chase-ai.record.mjs`(+ `chase-ai-fixture.mts`, Xvfb·Pulse, 도망 봇).

- **박자**: 쫓는 동안(시야에 든 뒤·400ms 시야 유예 동안)은 칸 사이에 서지 않고 한 칸을 `chaseCellMs` 동안 미끄러진다(남은 시간 이어받기).
  `chaseStepMs` 를 적은 페이지는 **그 값 그대로**(90..3000). 안 적은 페이지는 예전 한 칸(걸음 트윈 speed + 결정 대기 frequency)을 2.2 로 나눈다(하한 115):
  pace slow 720→327 · normal 480→218 · fast 280→127ms, 공포 추격자 speed 6(240)→115. 수색·복귀는 그 1.15배.
  다가오는 방식(`approachStyle`) 표도 칸당 시간을 절반 이하로 줄였다(질주 130→100, 통통 460→210, 육중 300→150 …, `fieldApproachStyle.ts`).
- **옛 규칙 폐기**: 「pace 는 늘 주인공보다 느려 피할 수 있다」는 버렸다. 피하는 수단은 시야 끊기·엄폐·문·숨는 곳, 그리고 **지치기** —
  주인공(160ms)보다 빠른 추격자는 12칸 달릴 때마다 650ms 숨을 고른다(머리 위 땀 말풍선).
- **알아챔**: 박자를 안 적은 옛 페이지의 `sightAlert.holdMs` 는 350ms 로 줄인다(옛 도구 기본 700 이 저장돼 있다). 새 도구 기본 300.
- **매복**(2026-10-30 「도깨비가 10칸 밖에서 알아보고 3배 빠르게, 닿자마자 전투」): `set_field_detection` 의 `allRound:true`(사방을 봄 — `sight.facing:'any'`)·`lineOfSight:false`(벽·나무가 시선을 안 가림)·`rushStepMs` 하한 30(예전 60, 프로젝트 형식 검사 `shapeEventFields` 도 30~400). 트인 들판의 매복꾼에만 쓴다 — 엄폐로 피하는 맛은 사라진다.
- **목표 칸**(`chooseChaseGoal`): 2칸 안이면 곧장. 나보다 가까운 동료가 있으면 그 반대편 두 칸 자리(감싸기). 주인공이 같은 흐름으로 2칸 이상 달리면
  진행 방향(막히면 마지막으로 꺾은 쪽으로 꺾어 복도를 따라)으로 14칸 내다봐 내가 먼저 닿는 첫 칸(앞질러 막기, 직전 목표는 2칸 여유로 유지).
  지그재그 주인공(흐름 1칸)은 예측하지 않는다 — 좌우로 떨린다.
- **길 찾기**: 쫓을 때 A* 는 같은 길이면 덜 꺾는 길(첫 걸음은 지금 보는 쪽)을 고른다(`straight`) — 계단식 떨림 제거. 표적에 길이 없으면(닫힌 문)
  표적에 가장 가까운 닿는 칸까지 간다(`approachWhenBlocked`). 걸음이 다른 추격자에게 막히면 어긋난 경로를 버리고 약 150ms 뒤 다시 찾는다.
- **놓친 뒤**: 시야가 끊긴 뒤 400ms(`LOS_GRACE_MS`, horrorRuntime) 동안은 간 쪽을 안다. 그 뒤 마지막 목격 자리 → 달아난 방향 6칸 앞(`lastHeading`·`lastTurn`,
  `pursuitNavigation.searchTarget`) → 그 둘레를 뒤진다. 옛 페이지의 수색 시간은 3500ms 아래로 내려가지 않는다(`chaseSearchLimitMs`).
- **입장 유예**: 다른 맵에 들어서면 1200ms 동안 추격자가 움직이지 않는다(`extendChaseSpawnGrace`, transferTo). 시작·불러오기 2000ms 는 그대로.
- **접촉 = 그림이 닿을 때만**(`src/player/chaseContact.ts`, 2026-10-29 「부딪히지도 않았는데 전투가」): 칸 이동은 걸음을 시작할 때 논리 칸을 먼저 옮긴다
  (추격자 `moveAutonomousRuntimePosition`, 주인공 `movingTo` 예약). 예전에는 접촉을 논리 칸으로 봐서, 달아나는 주인공이 막 떠난 칸으로 추격자가 들어서려는 순간
  그림이 1~2칸 떨어져 있어도 전투가 열렸다. 지금은 두 그림(걸음 진행률로 보간한 칸 자리)의 가장 가까운 칸 중심 거리가 `TOUCH_REACH` 1.05칸 이하일 때만 연다
  (옆 칸에 붙어 섬 = 1.0, 대각 1.41 은 아님). 주인공이 떠나는 칸은 뒤따라 들어서고(`followVacated`), 걷는 도중 닿으면 그 프레임에 연다. 앞질러 막기 목표 칸에서 나온
  「닿기」 결정은 걸음으로 바꾼다(그 칸에 주인공이 없으면 전투가 아니다). 주인공이 걸어오는 추격자에 부딪힐 때(`firePlayerTouchEvent`)도 같은 판정을 쓴다.
  헤드리스 sim 의 `catchGap`(잡힌 순간 그림 거리)은 모든 장면에서 1.00~1.05.
- 지표(헤드리스, 같은 맵·같은 시작, 전→후): ㄷ자 벽 돌아오기 8.45s→3.63s(경로/최적 1.00), 기둥 돌기(같은 빠르기 160 명시) 12.7s→1.8s,
  느린 둘 협공 7.7s→1.7s, 벽 뒤로 꺾어 달아남 못 잡음→6.2s, 빠른 추격 1마리 도망 못 잡음→13.1s.

## 안전 장치 (도구가 거절하는 것)

- 문·시작 위치·착지 칸·표지판 등 보호 칸(`protectedCells`) 맨해튼 거리 2 이내: `field-enemy-unsafe-spot`.
- chase 는 입구 칸(`entryCells`) 에서 `sightRange+1` 안이면 `field-enemy-ambush`(입장하자마자 추격 방지).
- 시작·입구에서 걸어서 닿지 못하는 칸: `field-enemy-unreachable`(`walkableFromAnchors`).
- 순찰 경로는 닫힌 왕복이어야 하고 양방향 통행 가능·다른 이벤트 칸 불가.
- 그래픽: 위 「필드 그림 = 전투 그림」. 생성 그림 없음, 말없는 대체 없음.

## 알려진 한계

- 박쥐·늑대·거미처럼 같은 종 charset 이 없는 종은 필드에 못 놓는다(거절). 전투 쪽 도트는 있으나 필드 칩이 없다.
- 복귀는 놓친 뒤 맵을 떠나면 그 맵에서 다시 시작한 위치(`pursuitState.home`)로 간주한다. 맵 밖에서 흐르지 않는다.
- 보호 반경 때문에 아주 작은 맵에서는 자리를 못 찾을 수 있다.
- 시간 기반 재출현은 QA 로 시간을 재지 않았다(구조만 확인).
