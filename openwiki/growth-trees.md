> 저장소 전환 안내(2026-09-21): 아래 옛 원격 DB·설정·명령은 과거 기록이다. 현재 저장·이관 지침은 [프로젝트 저장 전환](storage-retirement.md)과 AGENTS를 따른다.

# 직업 승급 트리와 스킬 트리 (2026-09-05)

## 소유권과 데이터

데이터베이스 **파티 → 직업 승급 트리 / 스킬 트리**는 별도 저작 화면이다.
`src/editor/panels/growthTree/studio.ts`가 목록·캔버스·인스펙터·미리보기를,
`src/editor/panels/growthTree/canvas.ts`가 SVG 연결선·포인터 이동·확대·키보드 이동을 소유한다.
`src/editor/panels/growthTree/actions.ts`는 스냅샷과 라벨 있는 `store.update`를 통과한다.
노드 드래그는 포인터를 놓을 때 한 번만 저장한다. Ctrl+휠/± 확대, Alt+방향키 이동.

표현은 기존 `src/styles/database/growth-tree.css`가 소유한다. 목록은 중립색,
캔버스는 inset, 인스펙터는 흰색이며 선택·포커스는 공통 indigo 토큰을 쓴다.
확대/자동 배치는 캔버스의 별도 하단 grid 행이다. 떠 있는 툴바로 되돌리지 말 것:
1024/1280/1440 실측에서 기존 툴바가 승급 노드와 겹쳤다. 노드 이름은 고정 좌표·크기를
유지하기 위해 두 줄로 제한하되 전체 이름은 aria-label과 인스펙터 제목에 보존한다.

승급 간선의 정본은 기존 `ClassRecord.promotions`다. 새 필드로 복사하지 않는다.
위치만 `Project.growth.classPositions`에 저장하며, 위치가 없는 기존 직업은
결정적 위상 배치를 사용한다. 단순히 탭을 열어서는 프로젝트를 바꾸지 않는다.
기존 직업 폼의 승급 조건·`define_promotion`·`promoteActor`와 같은 간선을 쓴다.
새 간선은 자기 참조·순환을 거부한다. 기존 순환은 배치가 멈추지 않고 표시된다.

`Project.growth`는 선택적인 v4 확장이다. 없으면 기존 프로젝트를 그대로 읽는다.
`skillTrees`는 스킬 레코드를 참조하는 노드와 양수 능력치 패시브 노드를 갖는다.
스킬 위력·연출은 기존 스킬 레코드의 소유다. 스킬 노드는 1등급, 패시브는 1~99등급이다.
선행 노드는 **모두** 1등급 이상이어야 한다. 빈 `classIds`는 공용 트리이며,
여러 직업을 지정하면 기본적으로 현재 직업이 그 목록에 있을 때만 효과가 활성화된다.
`inheritOnPromotion: true`인 트리는 실제 승급 경로의 직업과 교차하면 계승된다.
이 필드가 없거나 false인 기존 트리는 현재 직업 전용 동작을 유지한다.

## 성장 트리 그림 (Phase 1, 2026-09-05)

`src/assets/growthTreeArt.ts`는 편집기와 플레이어가 공유하는 순수 의미 아이콘 선택기다.
`ClassRecord`와 `SkillRecord`에는 그림 필드가 없으며 새 필드를 추가하지 않는다.
직업은 한국어/영어 이름의 역할(전사·마법사·성직자·궁수·도적·기사), 기존 방어/쌍수 옵션,
습득 스킬의 효과 순으로 기존 번들 아이콘을 고른다. 알 수 없는 직업은 스킬 책으로 표시한다.
스킬은 회복 HP/MP, 물리/마법 공격, 지원, 스위치, 이동/탈출 효과를 구별하고,
패시브는 HP/MP/공격/방어/정신/민첩의 여섯 그림을 쓴다.
트리 목록은 연결 직업 → 첫 노드 → 스킬 책 순이다. 이름이나 그림 선택은 저작 데이터를 바꾸지 않는다.

`databaseRecordThumbnails.ts`의 액터 얼굴/애니메이션 크롭은 이 화면에 복사하지 않는다.
플레이어의 기존 `StatusMenuDetailEntry.icon`은 단일 이미지 계약이므로 전체 애니메이션 시트를
축소해서 넣지 않고 양쪽 모두 의미 아이콘을 쓴다. URL은 `resolveAssetResourceUrl`을 거쳐
기존 인라인 자산 표를 존중한다. 실제 ZIP/단일 HTML에는 코드에서 파생한 아이콘도 포함돼야 하므로
내보내기 런타임 자산 목록에 등록되어 있는지 확인해야 한다.

편집기 그래프·목록·선택 인스펙터는 `growthTree/art.ts`로 그림을 만들며 로드 실패 시 글자 배지로
교체한다. 그림은 장식이며 접근 가능한 이름은 기존 버튼/제목에 남는다. 기본 이미지 드래그와
포인터 히트 테스트를 끄고 기존 180×98 노드, 선택, 포커스, 이동, 확대 계약을 유지한다.
새 프리셋 UI·스키마·콘텐츠·원격 저장은 이 단계에 포함하지 않는다.

회귀: `test/growthTreeArt.test.ts`(역할·효과·파라미터·커스텀/누락 레코드),
`test/growthTreeArtSurfaces.test.ts`(실제 편집기 DOM·이미지 실패·플레이어 아이콘·인라인 해석).
Phase 1 증거 위치: `output/evidence/growth-presets/p1`.

## 명시적 프리셋 추가 (Phase 2, 2026-09-06)

양쪽 스튜디오는 **프리셋 버튼을 누르기 전부터** 미적용 노드/간선을 표시한다.
저작 캔버스가 위에서 기본 선택/편집을 유지하며 아래 264px 영역은 별도 미리보기다.
`growthTree/presetBrowser.ts`는 `createGrowthPresetPreview(presetId)`의 분리된 템플릿을
그린다. 이 Project-shaped drawing context는 저장/플레이용 프로젝트가 아니며, 현재
프로젝트·할당·여유 공간을 읽지 않는다. 실제 추가 사전 검증만 현재 프로젝트 복제본에
`applyGrowthPreset`을 적용한다. 목적지 캔버스가 가득 차도 미리보기는 계속 보인다.
프리셋 선택·노드 검사·확대·스크롤·취소·Escape는 저장/dirty/스냅샷이 없다.
헤더의 프리셋 버튼은 같은 선택을 큰 그래프와 조건 목록으로 펼친다. 표지가 아니라
기존 180×98 노드 그림이 중심이며 100%에서 시작한다. 나머지 가지는 자체 스크롤로 읽는다.
명시적 추가만 현재 데이터에 라벨 있는 `editGrowth` 경계 하나를 만든다. 기존 내용·설정을
보존하고 반복 추가는 독립 사본이다. 새 승급 루트 또는 스킬 트리/루트를 선택해 화면 안으로 이동한다.
할당 사전 검증 실패는 표시하며 빈 되돌리기 항목을 만들지 않는다.
승급 배치 사전 검증은 추가할 직업·간선을 합친 `arrangeTree`에서 **기존 직업만** 점유로 계산하고,
고아 예약 키를 포함한 기존 수동 좌표를 덮어 적용한다. 지원되는 가져온 순환은 새 비순환 계층 뒤로
자동 좌표가 이동하므로 추가 전 배치를 쓰면 겹친다. 계산·빈 공간 확인은 기록/설정 변경 전에 끝내며
기존 수동 좌표는 바꾸지 않는다.
표지는 편집기 전용이고 그래프 그림은 Phase 1 선택기를 재사용한다.
기존 독립 스킬 프리셋은 공용·초기화 허용으로 추가된다. 연결 묶음은 직업별 계승 트리다.
기존 포인트 예산(0 포함)을 바꾸지 않으며
설정이 처음 생길 때만 라이브러리의 시작 2 / 레벨당 1을 쓴다. 승급은 주인공을 자동 전직시키지 않는다.
수동 빈 트리 생성은 유지한다. 성장 시뮬레이션에서는 프리셋·새 트리·포인트 설정·노드 이동·자동 배치를 비활성화한다.
데이터/ID/참조는 라이브러리, 투자·전직은 런타임 소유다. 자동 시드·AI·장르 연결·직접 DB 쓰기는 없다.
회귀: `test/growthPresetStudio.test.ts`, `test/growthPresets.test.ts`. 원격 저장/재로드 QA는 후속 통합 검증 소유다.

## 런타임과 저장

`src/project/growth/runtime.ts`가 투자·비용·환급·활성 효과의 순수 권위자다.
게임 메뉴의 **스킬 → 주인공 → 사용 스킬 / 스킬 트리 / 직업 승급**으로 진입한다.
`src/player/playerGrowthMenu.ts`는 기존 메뉴의 키보드·취소·포커스 계약을 재사용한다.

포인트 예산은 시작 포인트 + (현재 레벨 - 1) × 레벨당 포인트 + 이벤트 보너스 변수다.
보너스 변수 값은 각 주인공에게 독립적으로 주어진다. 이벤트의 기존 변수 변경 명령으로 지급한다.
투자는 `PlaySession.growthProgress[actorId][treeId][nodeId] = {rank, spent}`에 저장한다.
`spent`는 실제 지불액이다. 저작 비용을 고쳐도 초기화는 과거 지불액만 환급한다.
전직은 투자 기록을 지우지 않는다. 비활성 트리도 초기화 허용 시 메뉴에서 환급 가능하다.
저작자가 삭제한 트리/노드는 포인트 계산에서 빠져 기존 투자액을 자동 환급한다.

트리 스킬과 패시브를 `actorSkillIds` / `actorParamBonuses`에 영구 삽입하지 않는다.
`growthEffects`를 전투 생성·전투 중 직업 변경·필드 액션 스킬·메뉴에 합성한다.
따라서 초기화가 다른 경로로 습득한 스킬이나 영구 능력치 보너스를 지우지 않는다.
`src/project/growth/vitals.ts`는 최대 HP/MP를 다시 계산하고 현재치는 회복하지 않으며 상한만 제한한다.
`saveSlots.ts`는 투자 원장을 저장·검증·복원한다. 프로젝트 설정과 세이브 진행을 혼동하지 말 것.

`src/project/growth/validation.ts`는 셰이프·범위·ID 중복과 스킬/직업/변수 참조·순환을 검사한다.
스킬·직업·보너스 변수 삭제는 트리 참조를 먼저 해제하도록 기존 삭제 가드에 연결돼 있다.
이미 연결된 승급 경로를 다시 연결해도 기존 승급 조건을 보존한다.

## 통합 성장 런타임 (2026-09-06)

승급과 임의 전직은 다르다. `promoteActor`는 현재 직업의 `promotions`만 평가하며,
목적지 생략 시 첫 번째 조건 충족 간선을 선택한다. `changeActorClass`는 조건 없는
이벤트 전직이다. 저작 간선이 있어도 암묵적 승급으로 바뀌지 않는다.

`PlaySession.promotionLineage?: Record<ActorId, ClassId[]>`는 현재 **실제 승급 경로**의
중복 없는 집합이다. 승급은 출발·도착 직업을 더하고, 다른 직업으로 임의 전직하면
도착 직업만 남긴다. 같은 직업 전직은 경로와 투자를 유지한다. 고급 직업 시작·옛 세이브는
현재 직업만 인정하며 조상 직업을 만들지 않는다. 삭제된 override는 원래 직업/주인공 곡선으로
일관되게 돌아가고 무관한 경로를 활성화하지 않는다. 저작 간선 수정은 획득 경로를 바꾸지 않는다.
기존 승급 순환은 계속 읽지만 스튜디오의 새 순환 연결은 막는다.

`SkillTree.inheritOnPromotion`은 새 수동 트리에서 true다. 계승 트리는 효과와 투자가 계속
활성화되지만 직업 곡선·명령·장비 옵션은 현재 직업만 제공한다. 유효한 명시적 override 전에는
주인공 곡선을, 이후에는 목적지 직업 곡선을 쓴다. 전직 전에 현재 레벨까지의 주인공·직업 스킬을
영구 목록으로 보존하고 목적지 스킬을 더한다. 이전 직업의 미래 스킬은 자동 습득하지 않는다.
트리 스킬/패시브는 계속 파생 효과이며 영구 스킬/보너스 원장에 넣지 않는다.

`NodeRankRequirement { treeId, nodeId, rank }`는 트리로 한정된 노드 식별자다.
`SkillTreeNode.requiredNodes`와 기존 `prerequisites`(같은 트리, 1등급)는 모두 AND다.
승급의 `requires`는 기존 조건에 `requiredSkillIds`, `requiredNodes`,
`requiredTreePoints: { treeId, points }[]`를 AND한다. 스킬 소유는 영구/현재 자동 습득/활성 트리의
중복 없는 합집합이며 MP·상태·사용 장소와 무관하다. 등급은 비활성 투자도 인정하되 현재
`maxRank`로 제한한다. 포인트는 아직 저작된 노드의 과거 `spent` 합계이며 현재 가격으로
재계산하지 않는다. 새 조건은 소비하지 않고 기존 필요 아이템만 1개 소비한다.

초기화는 다른 트리의 투자된 노드가 해당 트리를 선행 조건으로 사용하면 차단하고 의존 노드를
표시한다. 의존 트리를 먼저 초기화해야 한다. 승급 조건은 입장 조건이므로 초기화로 강등하지 않는다.
투자/초기화 메뉴는 `refreshGrowthVitals`를 호출한다. 승급/전직도 최대치만 갱신하고 현재
HP/MP는 하향 제한만 하며 회복하지 않는다. 기존 레벨업 회복 정책은 별도다.
메뉴 장비 미리보기와 필드 액션 능력치는 전투의 `actorDerivedStats`를 공유한다.

전투는 경로·투자·영구 스킬을 시드/스냅숏으로 보존한다. `battleRewardsToSession`은 종료 상태를
권위자로 복사하며 임의 전직을 재실행하지 않는다. 한 전투에서 여러 번 승급하거나 순환해서
최종 직업 ID가 같아도 경로·중간 습득 스킬을 옮긴다. 스킬 잊기 이벤트는 영구 사본만 제거하고
활성 트리의 독립 부여는 유지한다. 세이브 파서는 present-but-malformed 경로/투자 필드를
손실 없이 거부한다. 예전 세이브에서 선택 필드가 없는 것은 유효하다.

정규화는 새 승급 필드를 복사하기 **전에** 형태를 검사한다. `growthIssues`는 스킬·트리·노드
참조, 최대 등급과 qualified identity를 사용하는 전체 선행 그래프 순환을 검사한다.
`skillTreeDeletionBlocker`는 외부 노드/승급 조건의 참조를 보호한다. 같은 트리 내부 참조는
노드 삭제 시 해제되며, 복제에서는 자기 트리 ID만 새 ID로 매핑하고 외부 참조는 유지한다.

### Runtime review corrections (2026-09-06)

- Battle `changeLevel` synchronizes the battler level and derived stats/skills immediately;
  a later promotion therefore uses the final event level. Write-back restores battle damage
  and event state before recomputing maxima, without healing. Victory preview reads that same
  battle-owned party, levels, XP and class overrides; reward level-up gain healing stays separate.
- Save restoration recomputes HP/MP maxima only after class, lineage, growth and permanent
  bonuses are restored. Lowered ranks, deleted nodes and invalid overrides clamp current vitals
  downward without changing historical rank/spent; unchanged projects preserve current vitals.
- Empty and nonexistent present class overrides both discard unrelated effective lineage.
  Missing overrides retain the existing optional-field semantics.
- Native prerequisite Add and tree switching exclude self/dependent nodes using the same
  qualified graph as authoring validation. A cyclic first candidate cannot block access to
  valid other-tree selectors. Promotion gates (no dependent node) keep all candidates.
- Regression seams: `test/growthIntegratedFixes.test.ts` and the R4 native-control cases in
  `test/growthIntegratedStudio.test.ts`. Preset files and `studio.ts` are not changed by this fix.

### 통합 API

- 타입: `project/growth/types.ts`의 `NodeRankRequirement`, `PromotionLineage`와 위 선택 필드.
- `project/growth/lineage.ts`: `effectiveActorClassId`, `validActorClassOverride`, `effectivePromotionLineage`.
  기존 `sessionClass.effectiveActorClassId` 재수출은 유지한다.
- `promotionRequirementsMet(session, actorId, requires, project?)`와
  `promotionRequirementBlocker(session, actorId, requires, project?)`: 새 조건 평가 시 project 필수.
  기존 3인자 호출은 기존 조건만 지원하며 새 조건이 있으면 fail-closed다.
- `growth/runtime.ts`: 기존 투자/초기화 API와 `actorOwnedSkillIds`, `permanentActorSkillIds`,
  `retainedNodeRank`, `treeSpentPoints`, `nodeRequirementsBlocker`, `skillTreeResetBlocker`.
- `growthTree/actions.ts`: `setSkillNodeRequirements(project, treeId, nodeId, requirements)`,
  `skillTreeDeletionBlocker(project, treeId, nodeId?)`, `deleteSkillTree(project, treeId)`,
  `duplicateSkillTree(tree, newId)`. `connectSkillNodes`/`deleteSkillNode`의 마지막 선택 project 인자는
  외부 참조/순환 검사에 필요하며 실제 스튜디오는 전달한다.
- `renderGrowthTreeTab(host, mode, onNavigateToSkills?, onNavigate?)`: 직업 인스펙터의 연결 트리 열기는 목적지
  선택을 보존한 뒤 Database 탭 이동 콜백을 사용한다. 양쪽 스튜디오는 동일 런타임으로 승급을
  시뮬레이션하며 임의 직업 선택기는 실제 `changeActorClass` 의미를 사용한다.

기존 native control/section으로 계승 설정, 스킬·등급·투자 포인트 조건과 qualified 선행
트리/노드/등급을 편집한다. 실패는 런타임 blocker를 표시하고 저작 쓰기/undo를 만들지 않는다.
네 번째 navigation callback은 `promotion | skill | actors`를 받으며 세 번째 legacy callback은
유지한다. Database는 목적지 탭 캐시를 비우고 같은 호스트의 선택을 다시 그린다.
주인공 경로는 기존 `db-picker-class`에 초점만 옮기며 직업/곡선을 자동 변경하지 않는다.

## 연결 프리셋과 그래프 (2026-09-06)

- `GROWTH_PRESETS`: `bundle-vanguard`, `bundle-arcane`, `bundle-ranger`가 양쪽에 추가된다.
  기존 `promotion-{vanguard,arcane,ranger}`, `skill-{vanguard,arcane,ranger}` 여섯 개는 그대로다.
  metadata kind는 `bundle | promotion | skill`, 화면 mode는 `GrowthStudioMode`다.
- 묶음마다 직업 5개(루트 → 두 갈래 → 각 최종 직업), 계승 트리 5개, 스킬 3개, 트리 노드 10개다.
  각 직업은 비어 있지 않은 자기 트리를 갖고 `inheritOnPromotion: true`다. 클래스의 자동
  습득 스킬 목록은 비어 있으므로 트리 스킬과 겹치지 않는다.
- 트리마다 기초 2등급(각 1 P)과 스킬 1등급(1 P)이 있다. 승급은 출발 트리의 기초 2등급,
  출발 트리 스킬, 실제 투자 3 P를 모두 요구한다. 첫 승급 Lv.5에 누적 3 P, 최종 승급
  Lv.12에 누적 6 P이므로 새 예산 2 + (레벨−1)에서 양쪽 경로가 모두 도달 가능하다.
  최종 직업의 트리까지 모두 익혀도 Lv.12에 9/13 P다. 목적지 전용 스킬을 입장 조건으로 쓰지 않는다.
- 각 다음 트리의 기초는 직전 트리의 기초 2등급을 요구한다. 로컬 선행과 자기 트리 rank 조건도
  함께 쓴다. 템플릿은 일부러 같은 `root`/`technique` 로컬 ID를 쓰고, applicator는
  `(treeId,nodeId)` identity로 모든 노드/직업/스킬/트리/승급 gate를 remap한다.
  반복 추가는 완전히 독립된 참조와 좌표를 할당한다.
- `GrowthPresetApplication`의 addedClassIds/addedTreeIds/addedSkillIds/addedNodeIds는
  템플릿 순서이고 루트가 먼저다. ID 문자열을 분해하지 말고 결과 배열을 사용한다.
- `skillGraph.ts`는 로컬 선행과 qualified 선행의 간선을 중복 없이 합치고 외부 트리에는
  점선 테두리 portal node를 만든다. 트리 이름·노드·필요 등급이 보이고 클릭하면 원본 트리로
  이동한다. 미리보기와 실제 저작 캔버스가 같은 규칙을 쓴다. 외부 노드는 이동/편집하지 않는다.
- 새 그래프 testid prefix는 `growth-preset-*`이며 실제 캔버스의 `growth-*`와 구별한다.
  미리보기 상태는 호스트/모드에 보존되고 가져온 묶음의 선택은 양쪽 모드에 공유한다.
  `growth-bundle-skills`, `growth-bundle-promotion`, `growth-bundle-assign-actor`는 추가가 아닌 이동이다.
- 실제 에디터 QA: `node scripts/qa/growth-connected-studio.mjs`. 포트 **9897을 직접 시작/종료**하며
  점유된 서버를 재사용하지 않는다. 원격 쓰기를 차단하고 3개 화면 크기에서 실제 노드 크기,
  이미지 로드, pane/node 겹침, 포커스/확대/Escape, 무변경 preview, Apply 1 undo,
  같은 묶음 탭 이동, 시작 직업 경로, 반복 독립 추가를 검증한다. sleep/polling 없이 MutationObserver와
  bounded deadline을 사용한다(일반 15초, cold Vite boot 120초).
  `.omo/evidence/growth-integrated/browser-presets/report.json`과 screenshots가 근거다.
  `applied-bundle.json`은 실제 UI 추가 결과이며 주인공을 자동 지정하지 않은 별도 QA 입력이다.
  LegacyDb 별도 QA 프로젝트 저장/재로드와 출하 플레이어 최종 증거는 lead 소유다.
  이미지 도구가 unsupported이므로 이 증거는 주관적 시각 승인으로 주장하지 않는다.

## 검증

- `growth-connected-studio.mjs`는 전용 포트뿐 아니라 `VITE_CACHE_DIR`도 자신의
  증거 디렉터리 아래로 격리하고 `E2E_FREEZE_DEV_SERVER=1`로 실행한다. 공유
  `node_modules/.vite` 재최적화 때문에 다른 워크트리의 QA 기동이 멈추는 것을 피한다.
- `test/databaseClassPromotionRequirements.test.ts`: 기존 직업 폼의 레거시 입력이
  현재 성장 조건을 보존하며, 변수 선택 전 임계값 입력과 변수 삭제/재선택도
  화면의 임계값을 함께 저장한다. 직렬화·실제 승급 판정 및 브라우저 QA로 검증한다.
- `test/growthConnectedPresets.test.ts`: 연결/반복 적용의 모든 참조, 0 예산/기존 기록 보존,
  wire roundtrip, 실제 runtime 투자/승급으로 세 역할의 두 가지 경로 도달 가능성.
- `test/growthConnectedStudio.test.ts`: 기본 노드, 꽉 찬 목적지에서도 분리 preview,
  단일 undo/탭 이동, qualified portal 및 실제 좌표 범위 보존.
- 기존 `growthPresets`, `growthPresetStudio`, `growthTreeArtSurfaces`는 여섯 독립 preset 또는
  `.growth-body` 범위로 명시해 기존 동작 검증을 그대로 유지한다.
- `test/growthIntegrated.test.ts`, `test/growthIntegratedBoundaries.test.ts`: 다이아몬드 실제 경로,
  고급 시작/옛 저장, 모든 새 gate 경계, 비활성 등급/실제 지불액, 순환/참조/형태 거부,
  전투 연속 승급 write-back, 메뉴 능력치, 원격 DB와 무관한 실제 세이브 슬롯 왕복.
- `test/growthIntegratedStudio.test.ts`: native 입력→저작/undo, 실제 승급/전직 시뮬레이션,
  외부 참조 삭제 차단과 자기 참조 복제. 전체 gates/build와 실제 브라우저 표면 검증은 lead 소유다.
- `test/growthTrees.test.ts`: 기존 v4 무변경 로드, 프로젝트/세이브 왕복, 잘못된 참조,
  순환, 등급/레벨/포인트/선행 조건, 다른 직업 비활성화, 실제 전투 스탯과 스킬, 독립 습득 보존.
- `node scripts/qa/growth-tree-studio.mjs`: 실제 편집기 CRUD·연결·순환 거부·드래그·
  키보드 이동·미리보기·닫기 보호·탭 왕복·1600/1280/1024 화면 계측. `GROWTH_QA_BASE`로 전용 서버 지정.
- `node scripts/qa/growth-tree-runtime.mjs`: `startPlayerQaServer` + `runRuntimeQa`를 쓰는
  출하 플레이어 검증. `verify-shots/runtime-qa/growth-tree/SUMMARY.md`부터 읽는다.
- 브라우저 QA 기본값은 Firefox다. 이 호스트의 Chromium localhost 요청은
  `ERR_NETWORK_CHANGED`로 실패할 수 있다(`openwiki/testing.md`의 기존 기록 참조).
  `GROWTH_QA_BROWSER=chromium`으로 변경 가능하며 DB 전체 계측은 `PROBE_BROWSER=firefox`를 지원한다.
- 위 두 브라우저의 데이터는 기존 하네스를 확장한 최소 계약 fixture이며 제품 데모가 아니다.
  사용자의 LegacyDb 프로젝트를 변경하지 않는다. 실제 게임 콘텐츠를 저작할 때는 기존 DB 저장 규칙을 따른다.

병합 검증 (2026-09-05): `growthTrees.test.ts`의 저장 슬롯 왕복은 성장 투자와 `horror` 추격·은신 상태를 한 세션에 넣어 실제 저장·파싱·복원 모두에서 두 확장을 보존하는지 확인한다.
