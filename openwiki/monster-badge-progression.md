# 몬스터 수집: 배지 진행 게이팅 (2026-10-16)

체육관 배지 수로 길·전투를 잠그는 세 부품. 모두 선택 기능이고 기본은 꺼짐(기존 프로젝트 저장 바이트 불변).

## 배지 스위치 규칙 (정본)
- 배지 N 의 스위치 id 는 **`mx_badge_N`**(N 은 1부터). 실제 id 의 정본은 `system.monsterCampaign.badges[i].switchId` 다.
- 켜는 것은 관장전 승리 분기(`battle()` 의 승리 스위치). 이 스위치를 읽는 모든 것(문·길 잠금·NPC 대사·HM 장애물 `requiresBadge`)은 번호를 문자열로 짓지 말고 캠페인 정의를 읽는다.
- 「켜진 배지 수」는 `project/badgeProgress.ts` 의 `earnedBadgeCount(switches, campaignBadgeSwitchIds(project))` 하나가 센다.

## 1. 이벤트 조건 `badgeCount`
`{kind:"badgeCount", op:">="|"=="|…, value:N}` — 켜진 캠페인 배지 스위치 수 비교. 정의가 없는 프로젝트는 `mx_badge_N` 규약 스위치를 센다. 해석할 배지가 없으면 0.
- 소비처: `types/events.ts`(ActorQueryCondition) · `commandKindRegistry.CONDITION_KINDS` · `conditionActorQueries`(평가·`ACTOR_QUERY_CONDITION_KINDS`) · `session.evalCondition` · `io/pageResolution` · `battle/battleEvents` · `shapeCommandFields`·`commandReferenceValidation`·`storyEventExplain`·`eventDraftValidator` · 이벤트 편집기(`actorQueryConditionForm` 모드·기본값·문장·힌트·폼, 페이지 조건 표면 8곳) · `schemaShapes.CONDITION_SCHEMA`.
- 프로젝트가 아는 배지 목록은 지연 해석기 `badgeSwitchIds`(`badgeContext(project)`)로 들어간다 — `partySkillContext` 가 `partySkillIds` 와 함께 싣기 때문에 이미 `partySkillContext` 를 쓰는 호출처(런타임 이벤트 상태·인터프리터·장면 시험·자동 플레이)는 코드 변경이 없다.
- 이벤트 편집기 표면 스냅샷(`test/fixtures/eventEditor*Surface.baseline.json`)에 새 종류가 들어갔다(모드 선택 +1, `fork:badgeCount` 표면 신설).

## 2. 도구 `place_badge_gate`
`{mapId,x,y,badges:N,name?,lockedLine?,openLine?,graphic?,facing?,cells?:[{x,y}]}` — 「배지 N개 이상이어야 지나가는」 문지기(`editor/tools/badgeGateTools.ts`). 막힘(통행 불가·말을 걸면 「배지를 N개…」) → 확인(`badgeCount >= N`, 말을 걸면 비켜 주고 셀프 스위치 A) → 열림(투명·통행 가능) 세 페이지. 넓은 길은 `cells` 로 같은 문지기를 나란히 세운다. 캠페인 배지 수보다 큰 N 은 영영 안 열리므로 거부. 그림은 몬스터 테이밍 트레이너 도트를 먼저 고른다. 조수 노출: 능력 색인 `monster-badge-gate`, find_tools 별칭(「배지 문·챔피언로드·문지기」), `MONSTER_GAME_INITIAL_TOOLS`.
- HM(필드 기술) 장애물은 `place_field_obstacle` 이 맡는다(별개 게이트).

## 3. 원작식 복종 레벨 상한 `obedienceLevelCaps`
`system.monsterCampaign.obedienceLevelCaps?: {enabled, caps:[{badges,maxLevel}], refuseLine?}` — 켜면 현재 배지 수의 상한(`badges ≤ 현재 수` 인 마지막 항목, 없으면 첫 항목)을 넘는 **내 파티 몬스터**가 전투에서 **기술 명령을 거부**한다(`battle/runtime.ts` `prepareGen1CombatAction` → `monsterRefusesOrders` → `recordSpecial` 거부 문장, 행동 상실 + 잔여 처리). 아이템·교체·도망·포획·방어는 막지 않는다. gen1 전투 모델(몬스터 파티 전투)에서만 동작한다. 거부 문장 기본 넷(말을 듣지 않는다/제멋대로 굴고 있다/딴청을 피운다/지시를 따르지 않는다)을 돌려 쓰고 `refuseLine` 의 `{name}` 으로 바꿀 수 있다. 상한 사다리는 도구 기본 20+5×배지 수.
- 스키마·검증: `types/database.ts ObedienceLevelCaps` · `io/shapeMonsterCampaign` (badges 오름차순·maxLevel 1..100·켜면 caps≥1). 필드는 꺼진 상태에서는 저장에 나타나지 않는다.
- 도구: `configure_monster_campaign {obedienceLevelCaps:{enabled, caps?, refuseLine?}}`(`enabled:false` = 필드 제거). 화면: DB 「시스템」 설정의 「복종 레벨 상한」 체크박스 + 기본 상한 Lv·배지당 증가(캠페인이 있을 때만; 세부 사다리는 도구).

## QA
`bun src/harnesses/assistant-capability/node/buildMonsterBadgeGateFixture.ts /tmp/g.json` → `node scripts/qa/runtime/monster-badge-gate.mjs /tmp/g.json [outDir]`(크로미움이 백지면 `unshare -rn` 으로 감싼다). 문지기 앞 배지 0개 말 걸기·걷기 막힘 → 배지 3개 켜고 말 걸기·통과, 선두 Lv14 로 관장전을 열어 상한 8 초과 거부 문장을 찍는다. 디버그 쓰기(맵 텔레포트·배지/퍼즐 스위치·선두 레벨)는 SUMMARY 에 적힌다.
