# 직업 승급 트리와 스킬 트리 (2026-09-05)

## 소유권과 데이터

데이터베이스 **파티 → 직업 승급 트리 / 스킬 트리**는 별도 저작 화면이다.
`src/editor/panels/growthTree/studio.ts`가 목록·캔버스·인스펙터·미리보기를,
`src/editor/panels/growthTree/canvas.ts`가 SVG 연결선·포인터 이동·확대·키보드 이동을 소유한다.
`src/editor/panels/growthTree/actions.ts`는 스냅샷과 라벨 있는 `store.update`를 통과한다.
노드 드래그는 포인터를 놓을 때 한 번만 저장한다. Ctrl+휠/± 확대, Alt+방향키 이동.

승급 간선의 정본은 기존 `ClassRecord.promotions`다. 새 필드로 복사하지 않는다.
위치만 `Project.growth.classPositions`에 저장하며, 위치가 없는 기존 직업은
결정적 위상 배치를 사용한다. 단순히 탭을 열어서는 프로젝트를 바꾸지 않는다.
기존 직업 폼의 승급 조건·`define_promotion`·`promoteActor`와 같은 간선을 쓴다.
새 간선은 자기 참조·순환을 거부한다. 기존 순환은 배치가 멈추지 않고 표시된다.

`Project.growth`는 선택적인 v4 확장이다. 없으면 기존 프로젝트를 그대로 읽는다.
`skillTrees`는 스킬 레코드를 참조하는 노드와 양수 능력치 패시브 노드를 갖는다.
스킬 위력·연출은 기존 스킬 레코드의 소유다. 스킬 노드는 1등급, 패시브는 1~99등급이다.
선행 노드는 **모두** 1등급 이상이어야 한다. 빈 `classIds`는 공용 트리이며,
여러 직업을 지정하면 현재 직업이 그 목록에 있을 때만 효과가 활성화된다.

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

## 검증

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
  사용자의 Supabase 프로젝트를 변경하지 않는다. 실제 게임 콘텐츠를 저작할 때는 기존 DB 저장 규칙을 따른다.
