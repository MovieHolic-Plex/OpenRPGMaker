# 생활 7개 탭 실동작 감사

조사일: **2026-09-05** · 소스 기준: **`32ef1bcd66476d09486a8a09893da02184d2ebd5`**

## 결론

**생활 데이터 저작 UI와 여러 상태 처리기는 존재하지만, 7개 탭 전체를 "게임에서 완주 가능한 생활 시스템"으로 승인할 근거는 없다.** 농사 조사, 주민 선물·대화, 출하·꾸러미·동물 돌봄·공간 배치·박물관 장부의 제품 호출 연결은 정적으로 확인했다. 그러나 **낚시 실행과 생성 채집물 줍기는 제품 호출자가 없고, 가공 설비의 분 단위 완료는 날짜 전환에만 연결되어 있다.** 생활 기술을 끄는 설정이 대응 기술을 사용하는 수확 자체를 취소하는 연결도 있다.

현재 집중 테스트는 **406 통과 / 4 실패, 57파일 중 53 통과 / 4 실패, 종료 코드 1**이다. 이는 감독자의 [현재 실행 기록](EXECUTION.md)에 근거하며 이 합성 작업이 재실행한 결과가 아니다. 후속 [RUNTIME.md](RUNTIME.md)는 **기존 원격 저장본의 읽기 전용 GET 성공**, 빈 상태와 저장본이 표시된 편집기 7개 탭, 같은 JSON을 공급한 출하용 `player.html`의 제한된 실동작을 기록한다. 브라우저 증거를 **B-empty / B-loaded / B-play**로 구분하며, 원격 읽기를 이번 작업의 저장 성공으로 바꾸어 표현하지 않는다.

**B-play로 확인된 범위:** 출하 예치·회수, 보리 먹이·쓰다듬기와 당일 버튼 비활성화, 박물관 기부의 재고·골드 변화와 도감 반영, 재료 부족 가공 거절 시 자원 보존, 기존 러그 회전, 조사 입력에 따른 감자 씨앗 3→2의 파종, 기존 잠자리 이벤트로 봄 1일→2일 아침 전환과 HUD 비→맑음, 전날 돌본 보리의 준비 생산물 1개 확인과 달걀 0→1 회수다. 필드/HUD와 일부 장부는 표시만 확인한 범위를 별도 구분했다. 물주기 입력 화면은 있으나 watered 상태 성공은 미확정이며, 단일 취침 경로 외 날짜 전환의 실패/재시도 전체·수확 완주·게임 저장/재개·원격 저장 성공은 입증하지 않았다. 상세 입력 방식·수치·이미지는 5절에 한정해 기록한다. 정적 결함은 이 제한된 성공으로 승격하거나 철회하지 않고 **S**로 유지한다.

추천 판정은 **조건부 사용 / 전체 완료 승인 보류**다. 아래 연결된 기능도 저작·세션·시간·아이템·이벤트 조건을 갖춰야 하며, API 테스트 통과를 필드 플레이 성공으로 확대해서는 안 된다.

## 1. 범위, 기준, 증거 읽는 법

- 작업 계약은 [SCOPE.md](SCOPE.md), 집중 테스트·초기 환경은 [EXECUTION.md](EXECUTION.md), 후속 원격 읽기·브라우저 실측은 [RUNTIME.md](RUNTIME.md)다. 이 문서는 Phase 1의 근거 문서이며 Phase 2 HTML이나 병합 승인을 대신하지 않는다.
- 지정 조사 워크트리는 `/home/main/z-project/rpg-zzu-life-audit-p1`이다. 합성 경로 `/home/main/.herdr/worktrees/rpg-zzu/wish-html`와 지정 워크트리의 HEAD가 위 기준과 같음을 확인했고, 지정 워크트리 상태에서는 보고서 디렉터리만 미추적 변경으로 나타났다. 제품 소스 수정, 게임 콘텐츠 생성, DB 쓰기, 커밋·PR·병합은 하지 않았다.
- 상위 수집 결과 `st_01a07282`(농사·주민), `st_01a07283`(제작·경제·날씨), `st_01a07284`(동물·공간·수집)를 읽었다. 그대로 사실로 승격하지 않고 아래 인용 소스와 `src` 호출 검색을 대조했다. 다른 세션의 테스트 실행 제안은 실행 증거로 세지 않았다.
- 소스 링크는 **이 문서에서 저장소 루트로 두 단계 올라가는 상대 경로**이며 `#L시작-L끝`은 기준 코드의 실제 행 범위다. 수집 결과의 잘못된 가정인 `src/project/characters.ts`는 인용하지 않는다. 실제 프로필은 `characterProfiles.ts`와 관련 모듈에 분산된다.

| 표기 | 의미 | 이 문서에서 인정하는 범위 |
|---|---|---|
| **B-empty** | 현재 빈 상태 편집 UI, 감독자 기록에 귀속 | `editor-*.png` 7개. 빈 상태 표시이며 저작·저장·게임 행동 성공 증거 아님 |
| **B-loaded** | 현재 기존 저장본을 로드한 편집 UI, 감독자 기록에 귀속 | `project-*.png` 7개. 읽어 온 원격 JSON을 기존 훅에 주입해 탭 이동·레코드 표시 확인. 폼 변경·저장·재로드 증거 아님 |
| **B-play** | 현재 출하용 `player.html` 실행, 감독자 RUNTIME.md에 귀속 | 5절에 명시한 실제 행동·관측값만 인정. 필드/HUD·장부 표시만 확인한 항목은 별도 제한. API 직접 호출 테스트와 구별 |
| **T-현** | 현재 집중 자동 테스트의 감독자 기록 | EXECUTION.md의 정확한 57파일/410테스트 실행 집합만 해당. 자식 작업은 재실행하지 않음 |
| **S** | 직접 읽은 소스와 호출 연결의 정적 확인 | UI 값, 조건, 분기, 상태 저장 구조. 실제 브라우저 재현이라고 부르지 않음 |
| **H** | 과거 보고서·과거 실행 주장 | 현재 결과와 합산하지 않음 |
| **U** | 현재 미검증 | 낚시·새 채집물 회수, 가공 완료 수령, 물주기 watered 상태, 날짜 전환의 실패/재시도 전체·수확 완주, 주민 관계/일정 완주, 게임 저장/재개, 원격 저장 성공 |

아래 51개 하위 기능 행은 **S 수준의 저작·소비자·조건 매트릭스**로 보존한다. 여기에 추가된 **B-loaded는 7개 탭의 표시·이동에만**, **B-play는 5절에서 행 ID와 대응한 관측 범위에만** 적용한다. 예를 들어 L10의 재료 부족 거절을 실측했어도 같은 행의 성공 가공·시간 경과·수령까지 검증된 것은 아니다. A5는 후속 기록의 보리 한 마리 생산·회수까지 인정하되 모든 종/주기/실패 조건으로 확대하지 않는다. 정적 결함 F-01~F-12는 S(미실측 영향은 U), 자동 테스트 계약 F-13은 T-현+S로 유지한다. 브라우저 관측은 감독자 RUNTIME.md에 귀속하며 합성 작업의 독립 재실행/픽셀 판독 결과라고 주장하지 않는다. T-현의 관련 파일은 6절에 따로 대응시키며 통과 개수를 플레이 성공으로 배분하지 않는다.

## 2. 심각도 순 발견사항

심각도는 이번 감사의 사용자 영향 기준이다. **높음**은 주요 생활 루프 단절·자원/진행 영향, **중간**은 특정 저작 조건의 의미 불일치·복구 불가, **낮음**은 표시·설명·검증 계약 문제다. 기존 패키지 이름 P0/P1/P2와 혼동하지 않는다. 전체 프로젝트 손상이나 전면 플레이 불능으로 확정할 최상위 결함은 이번 증거에서 입증하지 않았다.

### F-01 · 높음 · 낚시 실행과 계절 채집물 회수의 제품 진입이 끊겼다 [S]

낚시 API는 [fishing.ts:17-73](../../src/project/fishing.ts#L17-L73)에 있지만 `attemptFishingCatch`를 호출하는 `src` 소비자는 없다. 채집 스폰은 [dayTransition.ts:115-118](../../src/player/dayTransition.ts#L115-L118)에서 [seasonalForage.ts:17-77](../../src/project/seasonalForage.ts#L17-L77)로 연결되지만 `collectForageAt` 역시 정의 외 제품 호출자가 없다. 조사 입력은 [playSceneMovement.ts:489-526](../../src/player/playSceneMovement.ts#L489-L526)에서 농사로 들어가고, 설치물 수확은 [farming.ts:382-410](../../src/player/farming.ts#L382-L410)의 `tree/rock` 분기뿐이다. 생성된 `kind: "forage"`는 [playScenePlaceables.ts:42-55](../../src/player/playScenePlaceables.ts#L42-L55)의 등록 그림에도 없다.

**영향:** 어종·낚시터·계절 표·채집 구역을 등록해도 현재 일반 조사 입력으로 어획하거나 새 채집물을 줍는 완성 루프가 되지 않는다. API 내부의 성공·원자성은 그 단절을 메우지 못한다. 기존 나무의 `seasonalDrops` 수확은 별개 경로다. 호출 부재는 아래 6절 검색으로 확인했으며, 브라우저에서 실패 장면을 재현했다는 주장은 하지 않는다.

### F-02 · 높음 · 생활 기술 비활성화가 대응 수확을 취소한다 [S]

[생활 기술 토글 UI:460-469](../../src/editor/panels/databaseLifeCraftingView.ts#L460-L469)는 "경험치가 쌓이지 않는다"고 설명한다. 실제로는 [farming.ts:230-250](../../src/player/farming.ts#L230-L250)가 해당 종류의 첫 기술을 찾아 XP를 지급하고, [lifeSkillProgress.ts:40-42](../../src/project/lifeSkillProgress.ts#L40-L42)의 `disabled` 실패가 [farming.ts:163-165](../../src/player/farming.ts#L163-L165)에서 전체 수확 draft 폐기로 이어진다.

**성립 조건:** farming/mining/foraging 레코드가 남아 있고 `skillSystem.enabled`만 false인 경우. 해당 레코드 자체가 없으면 XP를 건너뛰므로 같은 문제가 아니다. **정적 반례:** 성숙 작물과 수확 여유가 있어도 farming 레코드를 남긴 채 토글을 끄면 `invalid-life-skill`로 수확이 확정되지 않는다. 에너지와 아이템이 부분 소모되는 문제는 아니지만 진행 차단이다.

### F-03 · 높음 · "가공 시간(분)"은 당일 완료 갱신에 연결되어 있지 않다 [S]

[UI:690-700](../../src/editor/panels/databaseLifeCraftingView.ts#L690-L700)에서 분을 저작하고 [makers.ts:62-141](../../src/project/makers.ts#L62-L141)가 절대 분과 ready 상태를 처리한다. 그러나 `advanceMakers`의 제품 호출은 [dayTransition.ts:125-139](../../src/player/dayTransition.ts#L125-L139)뿐이다. [lifeLedger.ts:458-488](../../src/player/lifeLedger.ts#L458-L488)는 processing이면 버튼을 비활성화하며 메뉴를 열 때 시간을 재평가하지 않는다.

**정적 반례:** 06:00에 30분 가공을 시작해 당일 06:30을 지나도 다음 날짜 경계를 밟기 전에는 processing이다. 일반 분 진행 분기는 [dayTransition.ts:64-68](../../src/player/dayTransition.ts#L64-L68)에서 시계만 바꾼다. [p0Makers.test.ts:52-55](../../test/p0Makers.test.ts#L52-L55)는 갱신 함수를 직접 호출하고, [p0LifeLedgerUi.test.ts:123-128](../../test/p0LifeLedgerUi.test.ts#L123-L128)는 ready를 직접 대입하므로 이 연결 누락의 반증이 아니다.

### F-04 · 높음 · 콘텐츠 변경 뒤 저장 재개는 자원 환급을 보장하지 않는다 [S]

[saveSlots.ts:509-538](../../src/player/saveSlots.ts#L509-L538), [1070-1113](../../src/player/saveSlots.ts#L1070-L1113)는 출하를 끄면 큐·기록을 비우고, 현재 허용 목록 밖의 큐 및 삭제된 가공 설비/꾸러미/해금을 걸러낸다. 이미 투입·기부한 재료를 환급하는 분기는 없다. 이는 손상/낡은 참조 정리 정책이며, 동일 콘텐츠의 정상 재개에서 무조건 손실한다는 뜻은 아니다.

**영향:** 출하에 넣거나 설비에 투입한 뒤 프로젝트 규칙을 변경해 재개하면 자원이 사라질 수 있다. 반대로 살아 있는 세션에 부적격 출하 큐·설비·동물 상태가 남으면 [dayTransition.ts:102-152](../../src/player/dayTransition.ts#L102-L152)의 전체 거래가 실패하여 날짜도 진행되지 않는다. 소스상 원자성 방어와 사용자상 진행 차단을 함께 기록해야 한다.

### F-05 · 중간 · 생활 판매 가격표는 일반 상점의 기본 판매가에 연결되지 않았다 [S]

[UI:585-589](../../src/editor/panels/databaseLifeCraftingView.ts#L585-L589)는 상점 판매 기준값으로도 쓴다고 설명한다. 실제 출하는 [shipping.ts:105-112](../../src/project/shipping.ts#L105-L112)에서 `resolveSellPrice`를 사용하지만, 상점은 [playSceneShop.ts:516-522](../../src/player/playSceneShop.ts#L516-L522) → [playSceneShopDom.ts:203-205](../../src/player/playSceneShopDom.ts#L203-L205) → [playSceneShopGoods.ts:137-140](../../src/player/playSceneShopGoods.ts#L137-L140)의 상품 가격 절반(양수일 때 최소 1)을 사용한다. 표를 읽는 `resolveShopSellUnitPrice`는 제품 호출자가 없다.

**정적 반례:** 상품 기준가 100, 생활 판매가 90, 별도 흥정 없는 경우 출하 단가는 90이고 상점 기본 판매가는 50이다. 또한 출하 설명의 "판매 가격이 없으면 0G"는 [upgrades.ts:47-53](../../src/project/upgrades.ts#L47-L53)의 DB 가격 절반 폴백과 다르다.

### F-06 · 중간 · 도구 행동 UI에서 선택 가능한 값이 실행 의미와 다르다 [S]

[UI:595-619](../../src/editor/panels/databaseLifeCraftingView.ts#L595-L619)와 [toolActions.ts:44-47,87-139](../../src/project/toolActions.ts#L44-L139)의 대조 결과:

- 사용자 표가 1행이라도 있으면 괭이/물뿌리개/도끼/곡괭이 기본 표 **전체를 대체**한다. 한 행동만 추가하는 것이 아니다.
- 아이템·도구 종류를 둘 다 비우면 "모든 도구"가 아니라 매칭 실패다. 둘 다 있으면 아이템 ID가 우선하여 도구 종류를 추가 검사하지 않는다.
- 경작 구역 체크 해제는 `false`가 아니라 `undefined`를 저장하므로 till/water의 기본 경작 조건을 해제하지 못한다. 농사 상위 분기에도 경작 영역 조건이 있다.
- `fish`·`harvest` 선택지는 있으나 실제 도구 규칙 요청은 till/water/chop/mine이다. **작물 수확 자체가 없다는 뜻이 아니라 `toolActions.harvest`가 소비되지 않는다는 뜻**이다.

### F-07 · 중간 · 작물 수확 수량·재수확 일수에 의미 불일치가 있다 [S]

[작물 UI:509-523](../../src/editor/panels/databaseCropView.ts#L509-L523)와 [farming.ts:311-328,513-536](../../src/player/farming.ts#L311-L536)를 대조했다. [정규화:28,138-141](../../src/project/farmModel.ts#L28-L141)는 수량 0을 허용하지만 수확은 `Math.max(1, ...)`이므로 1개를 지급한다. 재수확은 별도 대기 타이머가 아니라 `max(0, 총성장일 - 재수확일)`로 성장 일수를 되감는다.

**정적 반례:** 총 성장 2일, 재수확 10일이면 수확 뒤 growthDays=0으로 돌아가 매일 급수한 2회 성장 후 다시 성숙한다. "10일마다"가 실현되지 않는다. 현재 브라우저 재현이나 이 반례의 새 테스트는 없다.

### F-08 · 중간 · 미배정 동물은 플레이 장부에서 재배정할 수 없다 [S]

[동물 UI:622-635](../../src/editor/panels/databaseFarmAnimalsView.ts#L622-L635)는 미배정 시작 개체를 허용한다. [farmAnimals.ts:77-104](../../src/project/farmAnimals.ts#L77-L104)의 배정 API에는 제품 호출자가 없고 [장부:313-371](../../src/player/lifeLedger.ts#L313-L371)에는 먹이·쓰다듬기·회수만 있다. 돌봄 API는 미배정을 거부한다. 용량이 줄어든 세이브 복원도 [p1FoundationRecords.ts:206-225](../../src/project/p1FoundationRecords.ts#L206-L225)에서 초과 개체를 미배정으로 만들 수 있다.

**영향:** 저작 단계에서 유효한 종·축사·용량을 배정해야 한다. 등록된 표시 이벤트 ID는 자동 동물 렌더/상호작용의 보증이 아니다. 이는 동물 생산 코드가 전부 없는 것과 구별한다.

### F-09 · 중간 · 같은 "수용량"도 동물 축사와 범용 건물은 별개다 [S, 설계 경계]

[types/database.ts:859-877](../../src/project/types/database.ts#L859-L877)는 범용 건물 용량을 동물 주거 용량과 **명시적으로 독립**시킨다. 동물은 `system.farmAnimalBuildings.capacity`를 검사하고([farmAnimals.ts:87-98](../../src/project/farmAnimals.ts#L87-L98)), 범용 건물의 `database.farmBuildingTypes.levels[].capacity`는 [장부:149-177](../../src/player/lifeLedger.ts#L149-L177)에 표시된다. 범용 건물을 배치·업그레이드해도 동물 축사 용량이 늘어나는 연결은 없다.

이는 타입 계약상 의도된 분리다. 다만 사용자가 "축사 그림 배치 → 동물 수용"으로 이해하면 기능적으로 실패한다. 범용 건물의 문·실내 이동이나 시설 효과도 별도 이벤트 저작 없이는 만들어지지 않는다.

### F-10 · 중간 · 출하 전체 허용에서 개별 1개 해제 시 나머지도 금지된다 [S]

[UI:810-826](../../src/editor/panels/databaseLifeCraftingView.ts#L810-L826)에서 전체 허용은 `allowedItemIds === undefined`인데, 개별 변경은 `new Set(current ?? [])`에서 시작한다. 따라서 모두 허용 상태에서 A 하나를 해제하면 A를 뺀 전체가 아니라 빈 배열이 저장된다. [shipping.ts:145-151](../../src/project/shipping.ts#L145-L151)는 빈 배열을 아무것도 허용하지 않는 것으로 소비한다. 브라우저 클릭 재현은 없으며 코드 경로상의 반례다.

### F-11 · 중간 · 공간 배치 검사는 플레이어·NPC·작물 점유를 보지 않는다 [S/U]

장부의 건물 배치 위치는 [lifeLedger.ts:135-143](../../src/player/lifeLedger.ts#L135-L143)의 현재 플레이어 좌표다. [spatialOccupancy.ts:51-88](../../src/project/spatialOccupancy.ts#L51-L88)는 지형, 기존 건물·장식·설치물·상자만 검사한다. **점유 검사 누락은 S**, 그 결과 넓은 건물에 플레이어가 갇히는지·NPC/밭 겹침이 실제 화면에서 어떻게 나타나는지는 **U**다. 실측하지 않은 소프트락을 확정 결함으로 부르지 않는다.

### F-12 · 낮음~중간 · 표시·입력 경계와 실행 계약이 어긋난다 [S]

| 항목 | 확인된 차이 | 근거 |
|---|---|---|
| 생일 | UI는 1~99일, 기본 달력은 계절당 28일. 달력보다 큰 생일은 발생하지 않고 HUD에서도 제외 | [주민 UI:598-611](../../src/editor/panels/databaseCharacterView.ts#L598-L611), [gameTime.ts:51-53](../../src/project/gameTime.ts#L51-L53), [HUD:43-53](../../src/player/lifeCalendarHud.ts#L43-L53) |
| 프로필 이름 | UI의 이벤트 메시지 이름 안내와 달리 선물/대화 보상 화자는 첫 이벤트 페이지 이름 | [주민 UI:543-559](../../src/editor/panels/databaseCharacterView.ts#L543-L559), [playSceneGift.ts:44-52](../../src/player/playSceneGift.ts#L44-L52), [playSceneInterpreter.ts:122-128](../../src/player/playSceneInterpreter.ts#L122-L128) |
| 성장 그림 라벨 | 편집 라벨은 맵에 출력되지 않음. "단계 번호 배지" 안내의 폴백은 실제로 색 사각형 | [작물 UI:649-676](../../src/editor/panels/databaseCropView.ts#L649-L676), [playSceneFarming.ts:160-184](../../src/player/playSceneFarming.ts#L160-L184) |
| 예보·강도 생략값 | UI 3일/0.65, 런타임 1일/0.5. 명시 저작된 기본값과 생략된 값은 구별해야 함 | [날씨 UI:334-337,374](../../src/editor/panels/databaseDailyWeatherView.ts#L334-L374), [dailyWeather.ts:17-18,120-123](../../src/project/dailyWeather.ts#L17-L123) |
| 날씨 규칙 수 | UI 추가/변경에 128행 제한 없음, 런타임은 앞 128개 소비, JSON 경계는 초과 거부 | [날씨 UI:645-655](../../src/editor/panels/databaseDailyWeatherView.ts#L645-L655), [dailyWeather.ts:89-101](../../src/project/dailyWeather.ts#L89-L101), [shapeDatabaseFields.ts:574-578](../../src/project/io/shapeDatabaseFields.ts#L574-L578) |
| 기술 보상·레벨 | 기본 레벨 1이므로 레벨 1 보상은 상승 보상 순회에서 발생하지 않음. XP 곡선은 최대 10; 정규화도 10으로 제한하므로 높은 숫자 입력을 확장 성장으로 믿으면 안 됨 | [기술 UI:465-489](../../src/editor/panels/databaseLifeCraftingView.ts#L465-L489), [lifeSkillProgress.ts:45-64](../../src/project/lifeSkillProgress.ts#L45-L64), [skillModel.ts:10-18,33-49](../../src/project/skillModel.ts#L10-L49) |

### F-13 · 검증 차단 · 현재 자동 테스트는 all-green이 아니다 [T-현 + S]

[EXECUTION.md](EXECUTION.md)의 실패 4건을 숨기지 않는다. 공간 테스트의 `dataset.count === "0"` 기대([test:36-49](../../test/p2SpatialEditorAuthoring.test.ts#L36-L49))와 현재 공용 탭의 **0이면 속성을 삭제**하는 구현([database.ts:572-590](../../src/editor/panels/database.ts#L572-L590))은 명백히 서로 다른 계약이다. 이를 공간 배치 거래 실패라고 판정하지 않는다. 나머지 3개 byte-stable 실패의 정확한 변경 필드 및 정상화 정책의 정당성은 현재 기록만으로 확정하지 못했다. 자세한 실패 범위는 6절에 보존한다.

## 3. 7개 탭 전수 하위 기능 매트릭스

등록의 단일 기준은 [database.ts:98-104,150](../../src/editor/panels/database.ts#L98-L150)이다. 아래 **7/7**을 모두 조사했다. 여기서 "연결"은 S 수준의 호출 연결이며 작동 완료 인증이 아니다.

| 번호 | 탭 ID / 사용자 표시 | 데이터 축 | 현재 판정 |
|---|---|---|---|
| 1 | `crops` / 농사·작물 | `database.crops`, 맵 `farmableArea` | 조사·성장·수확 연결, F-02/F-07 조건 주의 |
| 2 | `characters` / 주민 관계 | 루트 `characters`, 이벤트 `characterId`·일정 | 선물·대화·관계·일정 조건부 연결, NPC 생성과 별개 |
| 3 | `lifeCrafting` / 생활 기술·제작 | 기술 DB + 기술 토글 및 9개 system 설정 | 10개 세부 영역 존재, 일부 소비자/타이밍 단절 |
| 4 | `dailyWeather` / 계절·날씨 | `system.dailyWeather` | 추첨·예보·화면·날짜 경계 급수 연결, 시간 설정은 외부 |
| 5 | `farmAnimals` / 동물·축사 | 종 DB + 축사 system + 시작 개체 session | 장부 돌봄·생산 연결, 재배정·표시 이벤트 연결 없음 |
| 6 | `farmSpatial` / 농장 건물·집 꾸미기 | 유형 DB + 시작 배치 session | 장부 배치/이동/강화/회수와 렌더·충돌 연결, 동물과 독립 |
| 7 | `lifeCollections` / 낚시·채집·박물관 | 어종 DB + fishing/forage/collections/museum | 도감·기부 연결, 낚시 실행·채집 회수 단절 |

**저장 표기:** 아래 J는 전체 프로젝트 JSON/로드 검증(4.1절), P는 플레이 snapshot/복원(4.2절)이다. UI 변경은 J의 저작 값을 바꾸며 P의 현재 플레이 진행을 즉시 바꾸는 것과 다르다. 어떤 행에도 원격 저장 성공을 뜻하는 표기는 없다.

### 3.1 농사·작물 (`crops`)

| ID / 하위 기능 | 편집 UI·저작값 → 소비자 | 실제 트리거·작동 조건·판정 (S) | 저장 |
|---|---|---|---|
| C1 목록·검색·추가·복제·삭제·스타터 | [UI:69-136,239-347](../../src/editor/panels/databaseCropView.ts#L69-L347), [스타터:408-446](../../src/editor/panels/databaseCropView.ts#L408-L446) → `database.crops` | 스타터는 단계·그림 배선이지 씨앗 아이템 생성/지급이 아님. 새 레코드의 씨앗·수확물은 첫 아이템 기준. 작물 삭제는 기존 세이브 밭을 삭제하지 않음 | J/P |
| C2 준비 카드·경작 영역·연결 이동 | [UI:142-230](../../src/editor/panels/databaseCropView.ts#L142-L230) → [farming.ts:126-129](../../src/player/farming.ts#L126-L129)의 맵 `farmableArea` | 시간·맵·도구 DB 등록/아이템 참조 카드. "준비됨"은 플레이어 소지, 통행, 활성 이벤트까지 보증하지 않음. 영역 그림/씨앗/도구는 별도 준비 | J |
| C3 괭이질·씨앗 선택·파종·물주기 | [UI:499-515](../../src/editor/panels/databaseCropView.ts#L499-L515) → [farming.ts:175-209,255-308,332-380](../../src/player/farming.ts#L175-L380) | 조사 정면→발밑. 이벤트·상자가 우선. 장착 씨앗은 `type=seed`와 seedItemId 일치, 빈손은 첫 제철 보유 씨앗. 도구는 소지/장착+행동 규칙 필요. 파종 1개 소모, 기력도 조건부 차감 | J/P |
| C4 단계별 일수·계절·고사 | [UI:514-620](../../src/editor/panels/databaseCropView.ts#L514-L620) → [farming.ts:469-510](../../src/player/farming.ts#L469-L510) | 자동 성장은 시간 활성화와 날짜 경계 필요. 물 준 생존 제철 작물만 성장 +1 후 물 해제. 계절 밖이면 고사, 봄 복귀만으로 부활하지 않음. 전체 계절 해제는 봄으로 복원 | J/P |
| C5 수확·재수확·수량 | [UI:509-523](../../src/editor/panels/databaseCropView.ts#L509-L523) → [farming.ts:311-328,513-536](../../src/player/farming.ts#L311-L536) | 성숙하면 씨앗·괭이·물뿌리개를 들어도 수확. 지급 넘침 시 유지. 비재수확은 빈 경작지로. 수량 0/재수확일>총성장일은 F-07 | J/P |
| C6 범위 도구·에너지·수확 XP | [강화 UI:534-572](../../src/editor/panels/databaseLifeCraftingView.ts#L534-L572) → [farming.ts:131-172,230-250](../../src/player/farming.ts#L131-L250) | 성공한 칸만 반영, 비용=성공칸×배율 올림(최소 1). XP는 작물/바위/나무 수확당 해당 첫 기술에 10; 경작·파종·급수는 없음. 기력/XP 실패면 전체 draft 취소 | P |
| C7 성장 그림·프레임·라벨·원문/고정 | [UI:624-704](../../src/editor/panels/databaseCropView.ts#L624-L704) → [playSceneFarming.ts:160-184](../../src/player/playSceneFarming.ts#L160-L184) → [실제 렌더 호출:211](../../src/player/playSceneMapRuntime.ts#L211) | undefined 자동 배선 / 빈 배열 명시 거부 / 저작 배열을 구분. 자동 그림은 고정 전 저장 안 됨. 최종 그림은 성숙 전용, 라벨은 편집용. 폴백은 색 사각형 | J |
| C8 추가 성장·날짜 커서·고사/삭제 복구 | [farming.ts:419-461,544-549](../../src/player/farming.ts#L419-L549) | 추가 성장 명령도 급수 조건 유지, 달력 커서는 이동 안 함. 날짜 커서 없는 옛 세이브는 현재 날짜 설정만, 소급 성장 안 함. 고사/삭제 작물은 괭이로 정리 | P |

### 3.2 주민 관계 (`characters`)

| ID / 하위 기능 | 편집 UI·저작값 → 소비자 | 실제 트리거·작동 조건·판정 (S) | 저장 |
|---|---|---|---|
| R1 목록·검색·프로필 생성/삭제·고아 복구·이벤트 이동 | [UI:68-143,279-350](../../src/editor/panels/databaseCharacterView.ts#L68-L350), [고아/사용처:510-531,754-816](../../src/editor/panels/databaseCharacterView.ts#L510-L816) → `characters` / 이벤트 `characterId` | 프로필 생성은 NPC 맵 배치가 아님. 프로필 삭제도 이벤트 ID를 지우지 않음. 사용처 이동으로 실제 이벤트 저작 필요 | J |
| R2 동일 주민 키·표시 이름 | [UI:543-559](../../src/editor/panels/databaseCharacterView.ts#L543-L559) → [프로필 해석:7-13](../../src/project/characterProfiles.ts#L7-L13), [호감 목록:267-289](../../src/project/friendship.ts#L267-L289) | 같은 characterId는 호감·일일 기록 공유. 이름은 호감 목록에 사용. 선물/대화 피드백 이름은 첫 이벤트 페이지 이름이므로 F-12 | J/P |
| R3 선물 취향 3분류·기본 neutral·반응 6종 | [UI:632-750](../../src/editor/panels/databaseCharacterView.ts#L632-L750) → [characterProfiles.ts:20-31](../../src/project/characterProfiles.ts#L20-L31), [friendship.ts:17-33,57-126](../../src/project/friendship.ts#L17-L126) | action 이벤트+giftSystem+characterId+해석된 취향/반응 객체가 있어야 선물 메뉴. 이름/생일만으로 안 생김. 이벤트 객체는 프로필과 병합하지 않고 통째로 우선. loved/liked/neutral/disliked = +80/+45/+20/-20 | J/P |
| R4 선물 선택·소모·취소·하루 제한 | [playSceneInterpreter.ts:73-80,139-141](../../src/player/playSceneInterpreter.ts#L73-L141) → [playSceneGift.ts:15-101](../../src/player/playSceneGift.ts#L15-L101) | 소지한 DB 아이템을 선택, 성공만 1개 차감. 취소/당일 재선물은 소모 없음. 시간 없으면 `no-time` 키가 고정되어 새 날짜로 한도가 풀리지 않음([session.ts:679-682](../../src/project/session.ts#L679-L682)) | P |
| R5 생일·보너스·다가오는 생일 HUD | [UI:566-629](../../src/editor/panels/databaseCharacterView.ts#L566-L629) → [friendship.ts:80-84,107-110](../../src/project/friendship.ts#L80-L110), [lifeCalendarHud.ts:37-68](../../src/player/lifeCalendarHud.ts#L37-L68) | 날짜 일치 시 선물 증감 모두 ×2(싫은 선물 -40 포함). 시간/달력 길이 필요. 이벤트 생일이 프로필 우선; 같은 ID 이벤트별 생일이 다르면 HUD 대표값과 개별 선물 판정도 다를 수 있음 | J/P |
| R6 일일 대화·호감 분기·연애 상태 | 이벤트 `talkFriendship` → [playSceneInterpreter.ts:99-113](../../src/player/playSceneInterpreter.ts#L99-L113), [friendship.ts:148-182](../../src/project/friendship.ts#L148-L182); [relationshipState.ts:1-64](../../src/project/relationshipState.ts#L1-L64) | 대화 명령 뒤 action 경로에서 하루 +10/지정 delta. 선물 일일 기록과 독립. 호감 증가만으로 dating/engaged/married 자동 승격 안 됨. 별도 `setRelationship` 명령·분기 이벤트 필요 | J/P |
| R7 NPC 일정의 조건·순서·목적지·방향·활동 | 주민 탭 밖 [일정 UI:57-199](../../src/editor/panels/eventEditor/eventScheduleEditor.ts#L57-L199) → [npcSchedule.ts:19-79](../../src/project/npcSchedule.ts#L19-L79), [npcSchedules.ts:67-176](../../src/player/npcSchedules.ts#L67-L176) | 시간 필요. 첫 일치 행, 시각 끝값 제외, 미일치 원위치. 활동은 도착 전에 설정되어 길 막힘/이동 중에도 work 등 조건이 참일 수 있음. 맵 간 일정은 경계 이동/순간이동 | J/P |
| R8 생활 이동과 일정의 경계 | [npcSchedules.ts:200-233](../../src/player/npcSchedules.ts#L200-L233), [npcLivingTravel.ts:110](../../src/player/npcLivingTravel.ts#L110) | 일정과 `living` 경로를 같은 시스템으로 설명하지 않음. 후자는 npcEnabled 연결 필요. 일정 실패 재시도 캐시는 [npcSchedules.ts:182-198](../../src/player/npcSchedules.ts#L182-L198)의 씬 WeakMap으로 비영속 | J/P 일부 |

### 3.3 생활 기술·제작 (`lifeCrafting`)

**10개 설정 영역(기술, 제작법, 강화, 판매 가격, 도구 행동, 에너지, 출하, 지역 해금, 꾸러미, 가공)을 모두 포함한다.**

| ID / 하위 기능 | 편집 UI·저작값 → 소비자 | 실제 트리거·작동 조건·판정 (S) | 저장 |
|---|---|---|---|
| L0 검색·추가·복제·삭제·ID 참조·패키지 생성/제거 | [UI:260-300](../../src/editor/panels/databaseLifeCraftingView.ts#L260-L300), [패키지:716-778](../../src/editor/panels/databaseLifeCraftingView.ts#L716-L778), [레코드 변경:1037-1189](../../src/editor/panels/databaseLifeCraftingView.ts#L1037-L1189) | 이벤트·기술/꾸러미 참조로 일부 삭제/이름 변경 차단. 빈 꾸러미 요구품/가공 outputs는 작동 준비 완료가 아님. UI CRUD와 세이브 이력 변경은 별개 | J |
| L1 기술·종류·최대 레벨·보상·활성화 | [UI:450-500](../../src/editor/panels/databaseLifeCraftingView.ts#L450-L500) → `database.lifeSkills`, `system.skillSystem` → [lifeSkillProgress.ts:33-89](../../src/project/lifeSkillProgress.ts#L33-L89) | 이벤트 `changeLifeSkillExp` 또는 작물/바위/나무 수확. 해당 종류 첫 기술만 자동 XP. 유효 스위치/제작법 보상 필요. 기술 토글 F-02, 레벨1/10상한 F-12. combat 자동 XP는 이번 조사에서 제품 연결을 확인하지 못함 | J/P |
| L2 제작법·재료·수량·골드·해금 | [UI:504-530](../../src/editor/panels/databaseLifeCraftingView.ts#L504-L530) → `system.craftRecipes` → [craftRecipes.ts:34-76](../../src/project/craftRecipes.ts#L34-L76) | `craftRecipe` 이벤트 필요; DB만으로 제작 버튼/작업대 안 생김. 재료 중복 합산·결과 넘침 검사. [commandCatalog.ts:735-737](../../src/player/interpreter/commandCatalog.ts#L735-L737)는 실패 반환값을 버리고 계속하므로 후속 성공 대사/별도 보상은 작가가 통제해야 함 | J/P |
| L3 강화·전후 아이템·비용·범위·배율 | [UI:534-572](../../src/editor/panels/databaseLifeCraftingView.ts#L534-L572) → `system.itemUpgrades` → [upgrades.ts:56-108](../../src/project/upgrades.ts#L56-L108) | `applyItemUpgrade` 이벤트, 전 도구·재료·골드 필요. 강화 결과 farmTool을 손에 들어야 범위 적용. 이력 아닌 toItemId 조회라 직접 지급된 결과 도구도 능력 사용. 동일 결과 ID는 첫 규칙 우선. [명령:738-740](../../src/player/interpreter/commandCatalog.ts#L738-L740)도 실패 결과를 버림 | J/P |
| L4 판매 가격 | [UI:574-592](../../src/editor/panels/databaseLifeCraftingView.ts#L574-L592) → `system.sellPrices` → [upgrades.ts:47-53](../../src/project/upgrades.ts#L47-L53) | 출하 단가에 사용. 일반 상점 기본 단가는 별도(F-05). 미등록 가격은 DB 구매가 절반 | J |
| L5 도구 행동 6종·아이템/종류·경작/대상 조건 | [UI:595-619](../../src/editor/panels/databaseLifeCraftingView.ts#L595-L619) → `system.toolActions` → [toolActions.ts:37-139](../../src/project/toolActions.ts#L37-L139) | 조사 입력과 도구 보유 필요. 실제 till/water/chop/mine만 호출. 전체 기본표 대체, 빈 조건/체크 해제/우선순위는 F-06 | J/P 손 슬롯 |
| L6 에너지 최대·초기·일일 회복 | [UI:756-778](../../src/editor/panels/databaseLifeCraftingView.ts#L756-L778) → `system.energy`; [초기화:375-377](../../src/project/session.ts#L375-L377), [농사 소비:153-160](../../src/player/farming.ts#L153-L160), [회복:120-123](../../src/player/dayTransition.ts#L120-L123) | 설정 없으면 농사 기력 차감 없음. 성공 파종/수확도 비용 대상. 자동 회복은 시간/날짜 전환 필요, 0 회복 허용. 낚시 소비는 API 내부까지만 연결 | J/P |
| L7 출하 활성·허용품·넣기/꺼내기·정산·보관 | [UI:782-831](../../src/editor/panels/databaseLifeCraftingView.ts#L782-L831) → `system.shipping` → [shipping.ts:32-123](../../src/project/shipping.ts#L32-L123), [장부:371-407](../../src/player/lifeLedger.ts#L371-L407) | 장부에서 1개씩, 하루 끝/수면에 정산(자정 고정 아님). undefined=전체, []=없음. 골드 상한이면 `total`과 `credited`가 다르고 물건은 전량 정산. 기록은 최근 정산 N건. 개별 해제 F-10 | J/P |
| L8 지역 해금·연결 스위치 | [UI:623-639](../../src/editor/panels/databaseLifeCraftingView.ts#L623-L639) → `system.worldUnlocks` → [bundles.ts:138-153](../../src/project/bundles.ts#L138-L153) | 꾸러미 등 보상이 unlockedRegionIds/스위치 기록. 실제 통행·다리·광산 개방은 그 스위치를 소비하는 이벤트 페이지/이동 저작 필요. 이름만 등록해 지도 지형이 바뀌지 않음 | J/P |
| L9 꾸러미 요구품·부분 기부·일회 보상 | [UI:644-686](../../src/editor/panels/databaseLifeCraftingView.ts#L644-L686) → `system.bundles` → [bundles.ts:28-100](../../src/project/bundles.ts#L28-L100), [장부:414-432](../../src/player/lifeLedger.ts#L414-L432) | 요구품별 1개 기부, 완료/보상 영수증으로 중복 차단. 빈 요구품은 완료 불가. 보상 참조/넘침 검사. 기부와 보상이 같은 최대 스택 아이템이면 순증가 0이어도 사전 `current+reward` 검사에서 거부 가능([122-125](../../src/project/bundles.ts#L122-L125)) | J/P |
| L10 가공 입력·출력·시간·시작/수령 | [UI:690-711](../../src/editor/panels/databaseLifeCraftingView.ts#L690-L711) → `system.makers` → [makers.ts:62-141](../../src/project/makers.ts#L62-L141), [장부:449-495](../../src/player/lifeLedger.ts#L449-L495) | 시간·재료·생산품 필요. 장부는 정의당 `ledger:id` 한 인스턴스; 설비 아이템 소유나 맵 설치는 검사 안 함. ready 뒤 전량 수령, 넘침이면 유지. 생산품은 수령 시 현재 정의 사용. 분 갱신 단절 F-03 | J/P |

### 3.4 계절·날씨 (`dailyWeather`)

| ID / 하위 기능 | 편집 UI·저작값 → 소비자 | 실제 트리거·작동 조건·판정 (S) | 저장 |
|---|---|---|---|
| W1 계절 목록·검색·규칙 추가/삭제·가중치·비율·강도 | [UI:187-215,374-445](../../src/editor/panels/databaseDailyWeatherView.ts#L187-L445) → `system.dailyWeather.seasons` → [dailyWeather.ts:27-44,89-118](../../src/project/dailyWeather.ts#L27-L118) | 날짜·시드·현재 확률표로 결정적 추첨, 세션 RNG 스트림 미소비. 비율은 UI 가중치 파생 표시. 빈/유효 규칙 없는 계절은 맑음, 맑음 강도 0. 128행/생략 강도 차이 F-12 | J |
| W2 활성화·기본 확률 생성/리셋 | [UI:334-344,578-615](../../src/editor/panels/databaseDailyWeatherView.ts#L334-L615) → [dailyWeather.ts:71-85](../../src/project/dailyWeather.ts#L71-L85) | 시간·날짜 필요. 기본 리셋은 네 계절뿐 아니라 enabled=true, forecastDays=3도 덮어씀. 계절 길이·시계·취침 규칙은 이 탭이 아닌 system.timeSystem | J/P |
| W3 예보 1~7일·현재 날씨·생일 HUD | [UI:337](../../src/editor/panels/databaseDailyWeatherView.ts#L337) → [dailyWeather.ts:51-68](../../src/project/dailyWeather.ts#L51-L68), [lifeCalendarHud.ts:17-34](../../src/player/lifeCalendarHud.ts#L17-L34), [실제 HUD 연결:637](../../src/player/playSceneMapRuntime.ts#L637) | 예보는 내일부터, 저장 아닌 재계산. 시간 없으면 표시할 달력 없음. 생략 일수 차이 F-12; 현재 표를 바꾸면 같은 시드/날짜도 예보가 달라질 수 있음 | J/P 현재값 |
| W4 화면 날씨·이벤트 setWeather | 날짜 전환 [dayTransition.ts:108-111](../../src/player/dayTransition.ts#L108-L111) → [playSceneWeather.ts:75-109](../../src/player/playSceneWeather.ts#L75-L109) | 일일 날씨는 화면 상태에 전달됨. 별도 setWeather는 화면 상태만 바꾸므로 일일 날씨/HUD/낚시 필터와 다를 수 있음 | P |
| W5 비·폭풍 급수·성장·날씨 필터 | [dayTransition.ts:108-114](../../src/player/dayTransition.ts#L108-L114) → [farmingWeather.ts:8-27](../../src/player/farmingWeather.ts#L8-L27), [farming.ts:487-510](../../src/player/farming.ts#L487-L510) | 목적 날짜 rain/storm·강도>0이면 기존 생존 경작 밭 급수 후 성장, 이후 다시 마름. 실시간 지속 급수 아님; 첫날/당일 새 파종 자동 급수로 오해 금지. 낚시 필터는 [API:62-73](../../src/project/fishing.ts#L62-L73)까지만 연결(F-01) | P |

### 3.5 동물·축사 (`farmAnimals`)

| ID / 하위 기능 | 편집 UI·저작값 → 소비자 | 실제 트리거·작동 조건·판정 (S) | 저장 |
|---|---|---|---|
| A1 목록·검색·종/축사/개체 추가·삭제·기본값 | [UI:271-274,438-540](../../src/editor/panels/databaseFarmAnimalsView.ts#L271-L540), [기본값/추가:864-949](../../src/editor/panels/databaseFarmAnimalsView.ts#L864-L949) | 기본값은 기존 아이템을 찾아 종·축사·시작 개체를 추가. 먹이/생산품 아이템 신규 생성·재고 지급은 아님. 종/축사는 참조 중 삭제 제한, 시작 개체는 별도 삭제 | J |
| A2 종 이름·먹이·생산물·수량·주기·친밀도 | [UI:438-461](../../src/editor/panels/databaseFarmAnimalsView.ts#L438-L461) → `database.farmAnimalSpecies` → [farmAnimals.ts:107-269](../../src/project/farmAnimals.ts#L107-L269) | 종만으로 개체 안 생김. 유효 개체·축사·아이템 필요. 친밀도는 쓰다듬기 증가/장부 표시이며 생산량·품질 조건은 아님 | J/P |
| A3 축사 맵/좌표·용량·허용 종 | [UI:493-540](../../src/editor/panels/databaseFarmAnimalsView.ts#L493-L540) → `system.farmAnimalBuildings` → [farmAnimals.ts:77-104](../../src/project/farmAnimals.ts#L77-L104) | 용량/종 실제 검사. 맵 좌표는 돌봄 거리 검사나 축사 스프라이트 생성이 아님. 장부에서 다른 맵 동물도 돌봄 가능. 범용 건물과 독립(F-09) | J/P 배정 |
| A4 시작 개체·이름·종·축사·표시 이벤트 | [UI:606-638](../../src/editor/panels/databaseFarmAnimalsView.ts#L606-L638) → `project.session.farmAnimals` → [session.ts:386](../../src/project/session.ts#L386), [p1FoundationRecords.ts:245-252](../../src/project/p1FoundationRecords.ts#L245-L252) | 새 게임은 친밀도/생산진행/준비품 0. eventId 저장 연결을 자동 표시·행동 연결로 보증하지 않음. 미배정은 플레이 복구 진입 없음(F-08) | J/P |
| A5 일일 먹이·쓰다듬기·생산·전량 회수 | [장부:313-371](../../src/player/lifeLedger.ts#L313-L371) → [farmAnimals.ts:107-269](../../src/project/farmAnimals.ts#L107-L269), [dayTransition.ts:141-152](../../src/player/dayTransition.ts#L141-L152) | gameTime 필요. 하루 먹이 1개·쓰다듬기 1회. 같은 원천 날짜 양쪽 돌봄 영수증이 있어야 생산진행 +1. 주기 도달 시 누적. 회수 넘침이면 보존. 잘못된 동물 상태는 전체 날짜 거래를 막을 수 있음 | P |
| A6 복원·재배정 | [p1FoundationRecords.ts:169-225](../../src/project/p1FoundationRecords.ts#L169-L225), [배정 API:77-104](../../src/project/farmAnimals.ts#L77-L104) | 시작 개체 먼저 생성 후 저장 진행 병합, 현재 호환 종/축사/용량 적용. 초과는 미배정으로 정리. API 존재와 플레이 재배정 UI 부재를 구분 | P |

### 3.6 농장 건물·집 꾸미기 (`farmSpatial`)

| ID / 하위 기능 | 편집 UI·저작값 → 소비자 | 실제 트리거·작동 조건·판정 (S) | 저장 |
|---|---|---|---|
| S1 목록·검색·종류 필터·유형/배치 CRUD·참조 | [UI:112-125](../../src/editor/panels/databaseFarmSpatialView.ts#L112-L125), [변경:1201-1283](../../src/editor/panels/databaseFarmSpatialView.ts#L1201-L1283) | 건물/장식 유형과 시작 배치를 분리 저작. 유형 참조 보호 있음. 빈 개수 배지 계약은 F-13이며 내용 생성 기능 실패와 다름 | J |
| S2 범용 건물 이름·ID·허용 맵·레벨·크기·용량·비용 | [UI:471-599](../../src/editor/panels/databaseFarmSpatialView.ts#L471-L599) → `database.farmBuildingTypes` → [spatialPlacementTransactions.ts:32-87](../../src/project/spatialPlacementTransactions.ts#L32-L87) | 장부 배치는 현재 위치/down/Lv1. 건설·다음 레벨 강화는 비용+공간 검사 후 확정, 이동 무료, 철거 환급 없음. 용량은 동물과 무관, 레벨 이름은 장부 레벨 숫자와 별개 | J/P |
| S3 장식 아이템·크기·차단·방향·허용 맵 | [UI:608-699](../../src/editor/panels/databaseFarmSpatialView.ts#L608-L699) → `database.homeDecorationTypes` → [거래:89-142](../../src/project/spatialPlacementTransactions.ts#L89-L142) | 장부에서 배치 아이템 1개 차감/회수 1개 반환. 회수 넘침이면 유지. 이동 무료, 허용 방향 순환 회전. 건물 회전 버튼과 혼동 금지 | J/P |
| S4 시작 배치 유형·레벨·맵·좌표·방향 | [UI:707-800](../../src/editor/panels/databaseFarmSpatialView.ts#L707-L800) → `project.session.farmBuildingPlacements/homeDecorationPlacements` → [session.ts:387-388](../../src/project/session.ts#L387-L388) | 시작 배치는 플레이 건설 거래가 아니어서 비용을 지불하지 않음. 장부 조작은 별도 runtime record 변경. 문/실내/축사/가공 인스턴스를 자동 생성하지 않음 | J/P |
| S5 기본/방향별 그래픽·회전 크기·렌더 | [UI:551-560,673-687](../../src/editor/panels/databaseFarmSpatialView.ts#L551-L687) → [playScenePlaceables.ts:78-122](../../src/player/playScenePlaceables.ts#L78-L122), [호출:212](../../src/player/playSceneMapRuntime.ts#L212) | 방향별 리소스 우선, 없으면 기본. 회전한 footprint로 크기/깊이 적용. 실제 리소스 픽셀 로드/겹침 장면은 U | J/P |
| S6 보행 차단·배치 중첩·원자성 | [spatialOccupancy.ts:28-88](../../src/project/spatialOccupancy.ts#L28-L88), [거래:149-199](../../src/project/spatialPlacementTransactions.ts#L149-L199), [장부:135-230](../../src/player/lifeLedger.ts#L135-L230) | 건물은 항상 보행 차단. 장식 blocksMovement=false도 다른 배치와 중첩 불가. 지형/건물/장식/설치물/상자 검사, 플레이어/NPC/작물 제외(F-11). 이동/회전/강화 실패는 기존 위치·비용 유지 | P |

### 3.7 낚시·채집·박물관 (`lifeCollections`)

| ID / 하위 기능 | 편집 UI·저작값 → 소비자 | 실제 트리거·작동 조건·판정 (S) | 저장 |
|---|---|---|---|
| K1 목록·검색·종류 필터·CRUD·기본값·4종 토글 | [UI:97-103](../../src/editor/panels/databaseLifeCollectionsView.ts#L97-L103), [설정:609-643](../../src/editor/panels/databaseLifeCollectionsView.ts#L609-L643), [생성/삭제:1031-1139](../../src/editor/panels/databaseLifeCollectionsView.ts#L1031-L1139) | 기본값은 기존 맵·아이템 재사용, 기능 활성화/표 생성이며 어획/줍기 입력 연결은 아님. 물고기 삭제는 어획 규칙 및 비게 된 낚시터도 정리. 저장된 보상 영수증과는 별개 | J |
| K2 어종 이름·지급 아이템·XP | [UI:347-352](../../src/editor/panels/databaseLifeCollectionsView.ts#L347-L352) → `database.fishSpecies` → [fishing.ts:27-59](../../src/project/fishing.ts#L27-L59) | 성공 API는 1개 지급+어획 기록+기력+XP+RNG를 함께 확정. 양수 XP인데 대응 낚시 기술 없거나 비활성/잘못된 보상이면 전체 실패. 일반 플레이 트리거 없음(F-01) | J/P |
| K3 낚시터 맵/영역·가중치·계절/시간/날씨·최소 숙련·기력 | [UI:379-405,618-619](../../src/editor/panels/databaseLifeCollectionsView.ts#L379-L619) → `system.fishing` → [fishing.ts:17-73](../../src/project/fishing.ts#L17-L73) | 첫 겹치는 영역 사용. 대응 기술 없으면 레벨 0, 최소 1 규칙은 불가. 시간/날씨 필터는 세션 값 소비. 활성화만으로 낚시 버튼/미니게임/조사 경로 안 생김 | J/P |
| K4 계절 채집 영역·스폰 수/상한/주기/소멸·가중치/계절 드롭 | [UI:455-502](../../src/editor/panels/databaseLifeCollectionsView.ts#L455-L502) → `system.seasonalForage` → [seasonalForage.ts:17-77](../../src/project/seasonalForage.ts#L17-L77) | 시간/날짜 전환에 결정적 생성, 같은 날 중복 금지. 주기는 절대 날짜 기준. 공간/계절 드롭 부족이면 목표 수 미달. 계절 변경·수명 만료 정리. 신규 첫날 초기화가 아니라 날짜 전환 호출 | J/P |
| K5 생성 채집물 표시·회수·XP | [seasonalForage.ts:80-103](../../src/project/seasonalForage.ts#L80-L103) → provenance 검증/아이템+1/기술 있을 때 XP+1/설치물 삭제 | 회수 API 제품 호출자와 forage 렌더 등록이 없음(F-01). 나무/바위 수확을 대신 성공 증거로 쓰지 않음 | P, 진입 단절 |
| K6 도감 활성·추적·발견·출하/어획/기부 기록 | [UI:622,634-640](../../src/editor/panels/databaseLifeCollectionsView.ts#L622-L640) → `system.collections` → [장부:255-311](../../src/player/lifeLedger.ts#L255-L311), [session.ts:366-372,580-589](../../src/project/session.ts#L366-L589) | 메뉴→기록→생활 장부. trackedItemIds는 표시 집합 일부이며 어종/채집/박물관/세션 기록과 합집합. 도감 토글 꺼도 낚시·채집·박물관이 켜져 있으면 상태 생성. 어획 카운터 존재는 실제 낚시 성공 증거 아님 | J/P |
| K7 박물관 대상·최소 개수·필수 품목·보상·중복 방지 | [UI:552-598,628-631](../../src/editor/panels/databaseLifeCollectionsView.ts#L552-L631) → `system.museum` → [museum.ts:10-89](../../src/project/museum.ts#L10-L89), [장부:274-297](../../src/player/lifeLedger.ts#L274-L297) | 장소/NPC 없이 장부에서 품목당 1개·1회. 최소 개수는 서로 다른 적격 품목 수, 필수 품목과 AND. 둘 다 없으면 첫 성공 기부에서 자격 충족. 새 보상 모두 즉시, 영수증 중복 차단. 골드/아이템 넘침은 거부. 지역/제작법 보상 API는 있으나 이 탭 편집 UI에는 없음 | J/P |

## 4. 저장·날짜 전환·실패/재시도 경계

### 4.1 저작 저장 (J)

폼 변경은 [store.ts:757-768](../../src/project/store.ts#L757-L768)의 프로젝트 복제·변경·자동 저장 예약으로 연결된다. [serialize.ts:17-42](../../src/project/io/serialize.ts#L17-L42)는 프로젝트 전체 JSON을 직렬화하고 로드 시 버전별 검증/마이그레이션한다. **폼에서 값이 보인다 → 저장 예약됨 → 실제 저장됨 → 다시 로드 가능함**은 서로 다른 증거 단계다.

[store.ts:1096-1124](../../src/project/store.ts#L1096-L1124)의 원격 설정 상태는 `not-configured`, `disabled`, `saved-local` 등으로 갈린다. 특히 [devProjectPersistence.ts:46-53,75-84](../../src/project/devProjectPersistence.ts#L46-L84)는 `blankProject/freshProject` 위치에서 개발용 저장을 건너뛴다. **B-empty 캡처를 저장 성공 증거로 사용할 수 없는 소스상 이유도 있다.** 감독자는 기존 원격 프로젝트를 GET으로 읽었고 그 JSON을 편집기와 출하용 플레이어에 공급했다([RUNTIME.md](RUNTIME.md), 5.1절). **원격 행에 쓰기·저장·업서트는 없었다.** B-loaded는 기존 저장본 표시이며 새 폼 값의 저장/재로드 검증이 아니다.

### 4.2 플레이 저장 (P)

[saveSlots.ts:323-377](../../src/player/saveSlots.ts#L323-L377)에 에너지, 출하 큐·정산, 꾸러미·보상 영수증, 지역/제작법 해금, 설비, 날씨, 동물, 공간 배치, 도감, 박물관 영수증, 채집 커서, NPC 이동·활동·일정, 기술, 밭·날짜 커서, 호감·관계·일일 기록·손 슬롯·설치물이 포함된다. 복원은 [saveSlots.ts:509-653](../../src/player/saveSlots.ts#L509-L653)이다. 장부 행동 성공과 실제 저장소 기록 성공은 동일하지 않다.

| 경계 | 복원/재시도에서 유지되는 것과 달라질 수 있는 것 |
|---|---|
| 농사·관계 | 밭/성장 커서/호감/관계/일일 기록 복원. 현재 작물 DB를 다시 참조하므로 작물 삭제 후 세이브는 괭이 정리 경로가 필요. 프로필 삭제가 호감 이력 삭제를 뜻하지 않음 |
| 기술 | 현재 정의의 XP 상한/레벨로 재계산([saveSlots.ts:1116-1127](../../src/player/saveSlots.ts#L1116-L1127)). 변경한 레벨 표의 과거 상태 그대로 재생 아님 |
| 출하·꾸러미·설비 | 현재 정의/허용품으로 필터링, 비활성 출하 큐 삭제. 설비 시각은 저장하나 복원만으로 processing→ready 승격 안 됨(F-03/F-04) |
| 날씨 | 복원 날짜·시드와 **현재 확률표**로 재계산([saveSlots.ts:635-653](../../src/player/saveSlots.ts#L635-L653)). 같은 세이브라도 표가 바뀌면 달라질 수 있음 |
| 동물 | 시작 개체+저장 진행 병합, 현재 종/축사/용량으로 정리. 초과 미배정은 F-08. 생산 주기 변경 후 기존 진행값 적합성은 별도 실측 필요 |
| 공간 | 파싱된 배치를 복원. 명시적 빈 객체는 철거 상태를 유지하고 누락 필드는 시작 배치와 구별([saveSlots.ts:589-595](../../src/player/saveSlots.ts#L589-L595)). 부적격/겹침 정리의 구체적 손실은 실제 재개로 별도 확인 필요 |
| 도감·박물관·채집 | 알려진 아이템/유효 카운터만 복원. 보상 영수증 ID는 삭제된 보상도 남을 수 있는 tombstone. 채집 provenance는 재검증하지만 복원 코드에서 현재 날짜 기준 수명 만료까지 계산하지 않음([saveSlots.ts:660-721](../../src/player/saveSlots.ts#L660-L721)) |
| NPC | 이동·일정 상태는 저장하나 실패 재시도 WeakMap은 씬 전용. 위치/일정 저장이 경로 실행의 모든 상태 보존은 아님 |

### 4.3 날짜 경계는 공통 거래이지만 모든 관련 이벤트가 동일하지 않다

정적 호출 흐름(S). RUNTIME.md는 기존 잠자리의 단일 취침·날짜/HUD 전환과 보리 생산·회수를 추가 실측했다(5.3절). 이는 아래 모든 내부 단계의 상태·원자성·실패/재시도를 브라우저에서 검증했다는 뜻은 아니며, 급수 상태는 여전히 U다:

```text
PlayScene 프레임 → updateGameTime → advanceTimeAcrossDayBoundaries
수면 / 강제 수면 → sleepUntilMorningScene → transitionToNextDay

복제 session에서:
출하 정산 → 다음 날 아침 → 일일 날씨 → 비 급수 → 작물 성장
→ 계절 채집 생성/정리 → 에너지 회복 → 설비 갱신 → 동물 생산
→ 마지막 날짜 영수증 → 실제 session 확정
```

근거: [PlayScene.ts:348-353](../../src/player/PlayScene.ts#L348-L353), [playSceneTime.ts:40-69,112-152](../../src/player/playSceneTime.ts#L40-L152), [dayTransition.ts:23,52-79,87-166](../../src/player/dayTransition.ts#L23-L166).

- 어떤 필수 단계가 실패하면 실제 session 확정 전 종료한다. 날짜·골드·기력의 부분 적용을 막는 구조다. 동일 날짜 중복 영수증과 stale key도 거절한다.
- **수면의 `onDayEnd` 공통 이벤트와 일반 시계 경과는 동일하지 않다.** 수면은 사전 검사, 훅 실행, 거래, 실패 복구를 거치지만 일반 날짜 경계는 그 훅을 호출하지 않는다. 침대/수면 명령 자체도 작가가 플레이 진입으로 마련해야 한다.
- 비는 목적 날짜 날씨로 급수한 뒤 성장하고 다시 마른다. 가공은 이 경계에서만 갱신된다. 동물은 원천 날짜의 먹이+쓰다듬기 영수증을 사용한다. 세 기능 모두 "하루 지나면 된다"는 한 문장으로 묶으면 조건을 잃는다.
- 재시도·중복 방지와 브라우저 입력·화면 전환 복구는 다른 검증 층이다. 이번 증거는 전자의 코드/집중 테스트 기록을 포함하지만 후자의 전체 7탭 플레이 완주를 포함하지 않는다.

## 5. 현재 원격 읽기·브라우저 증거

이 절의 실측 사실은 감독자의 [RUNTIME.md](RUNTIME.md)에 귀속한다. 합성 작업은 기록과 실제 이미지 링크를 대조했으며, 별도로 브라우저 행동을 재실행하지 않았다. **이 합성 경로는 이미지 픽셀을 해석할 수 없으므로 독립 시각 판독을 주장하지 않는다.** 아래 이미지는 기존 감독자 산출물이다. 이미지 파일명만으로 성공을 판정하지 않으며 새 캡처를 만들거나 기존 이미지를 수정하지 않았다.

### 5.1 기존 원격 저장본의 읽기와 실행 출처

- 대상은 `rpg-zzu-stardew-demo`, 제목 **별빛 농장 마을**이다. 편집기 `/legacyDb/rest/v1/projects` 프록시에서 `Accept-Profile: rpg_zzu`와 설정된 인증으로 GET했다. 최초 무인증 요청은 401, 인증된 요청은 **HTTP 200, 1행**이었다. 인증 키 자체는 보고서에 기록하지 않는다.
- 맵 2개, 작물 8종, 생활 기술 5종, 시작 동물 2마리, 어종 2종이며 박물관이 활성화돼 있다. 저장본의 `current_sha256`은 **`bd9b8c08c077808ff3de43cde16939d2354c1f7445ec5eecb572e47d1cde2641`**이다. 이는 조회된 행의 값이며 이 합성 작업이 원격 JSON 해시를 독립 재계산한 결과라고 주장하지 않는다.
- **원격 프로젝트 행에 쓰기·저장·업서트는 없었다.** 과거 저장본의 현재 조회 성공이며 이번 작업의 신규 콘텐츠 저장 영수증이 아니다.
- 편집기는 `http://127.0.0.1:40059/`의 격리 브라우저 세션에서 읽은 JSON을 기존 `__RPG_ZZU_E2E_PROJECT__` 훅에 주입했다. 따라서 B-loaded는 그 저장본의 탭 이동·레코드 표시 증거이지 편집기의 일반 원격 열기 흐름 전체를 검증한 것은 아니다.
- 플레이어는 `scripts/lib/runtimeQaRun.mjs`의 `startPlayerQaServer()`를 올바른 cwd의 전용 워크트리 프로세스에서 실행한 **`http://127.0.0.1:44685/player.html`**이다. 편집기 테스트플레이가 아니다. `__OPENRPG_BOOT__`의 프로젝트 URL 요청에 같은 원격 JSON을 그대로 공급했고, 저장 네임스페이스 `life-audit-readonly-20260905`와 QA 계측을 사용했다. 네임스페이스 설정 자체는 게임 저장/재개 성공 증거가 아니다.
- Playwright Chromium의 편집기 화면은 1440×1000, 플레이어 화면은 1280×960이다. **QA 계측 때문에 일부 디버그 이벤트 라벨이 DOM에 존재**한다. 아래 플레이 캡션은 이 환경을 전제로 한다. 장부/농사 행동은 분리된 브라우저 플레이 세션 상태만 바꿨다.

### 5.2 편집기 7개 탭: B-empty와 B-loaded

감독자는 기존 `?blankProject=1` 빈 상태를 먼저 캡처한 뒤 기존 저장본을 공급한 편집기에서 데이터베이스 생활 그룹의 7개 탭을 직접 클릭했다. B-loaded 화면에는 프로젝트 제목과 데이터가 표시되었다. **폼 변경·저장·재로드는 검증하지 않았다.** B-empty의 빈 레코드를 미구현으로, B-loaded의 기존 데이터를 이번 작업의 신규 저작 콘텐츠로 설명하지 않는다.

| 탭 / 정적 매트릭스 | B-empty: 빈 상태 | B-loaded: 기존 저장본 표시 | 증명 한계 |
|---|---|---|---|
| 농사·작물 / C1-C8 | [빈 탭](images/editor-crops.png) | [작물 표시](images/project-crops.png) | 표시·탭 이동. 저작/저장·전체 농사 주기 아님 |
| 주민 관계 / R1-R8 | [빈 탭](images/editor-characters.png) | [주민 표시](images/project-characters.png) | 표시·탭 이동. 선물·연애·일정 완주 아님 |
| 생활 기술·제작 / L0-L10 | [빈 탭](images/editor-life-crafting.png) | [기술·제작 표시](images/project-life-crafting.png) | 표시·탭 이동. 제작·가공 완료·정산 아님 |
| 계절·날씨 / W1-W5 | [빈 탭](images/editor-daily-weather.png) | [날씨 설정 표시](images/project-daily-weather.png) | 표시·탭 이동. 날짜 전환·비 급수 검증 아님 |
| 동물·축사 / A1-A6 | [빈 탭](images/editor-farm-animals.png) | [동물·축사 표시](images/project-farm-animals.png) | 표시·탭 이동. 생산·회수 완주 아님 |
| 농장 건물·집 꾸미기 / S1-S6 | [빈 탭](images/editor-farm-spatial.png) | [건물·장식 표시](images/project-farm-spatial.png) | 표시·탭 이동. 건설 거래·충돌 안전 아님 |
| 낚시·채집·박물관 / K1-K7 | [빈 탭](images/editor-life-collections.png) | [수집 설정 표시](images/project-life-collections.png) | 표시·탭 이동. 낚시·새 채집물 회수 성공 아님 |

### 5.3 B-play: 실제 행동과 관측 범위

감독자는 `Enter`로 새 게임을 시작했다. 생활 장부 진입은 **`Escape → ArrowDown 4회 → ArrowRight → ArrowDown 2회 → Enter`**였다. 장부에서는 DOM의 `data-action-index`를 읽고 현재 커서에서 방향키로 이동한 뒤 `Enter`로 행동했다. **버튼 함수를 직접 호출하거나 포인터 차단을 해제하지 않았다.** 아래 각 행만 B-play의 행동 증거이며 해당 매트릭스 행 전체의 다른 기능까지 승격하지 않는다.

| 매트릭스 대응 / 행동 | 입력·전제 | RUNTIME.md의 실제 관측 | 실제 이미지·한계 |
|---|---|---|---|
| L7 / 출하함 넣기 | 기존 야생 부추 1개, 출하 탭에서 선택 후 Enter | 보유 행이 `출하함 1 · 1개 꺼내기`로 변경, `출하함에 넣었습니다` 표시 | [예치](images/runtime-shipping-deposited.png). 날짜 정산·판매 단가 지급 아님 |
| L7 / 출하함 회수 | 같은 품목 꺼내기 선택 후 Enter | runtime-state의 야생 부추 인벤토리 다시 1개 | 별도 회수 이미지 없음. [RUNTIME.md](RUNTIME.md)의 상태 기록과 이후 기부 전제에 근거. 없는 회수 캡처를 만들지 않음 |
| A5 / 보리 먹이 | 기존 건초 8개, 먹이 주기 선택 | 건초 **8→7**, 당일 먹이 버튼 비활성 | [돌봄](images/runtime-animals-cared.png). 이 화면은 당일 돌봄 증거. 다음날 생산·회수는 아래 별도 관측 |
| A5 / 보리 쓰다듬기 | 쓰다듬기 선택 | 친밀도 **0→15/1000**, 당일 쓰다듬기 버튼 비활성 | [돌봄](images/runtime-animals-cared.png). 비활성 버튼의 표시를 관측했으며 우회 재호출 차단까지 실측한 것은 아님 |
| K7 / 박물관 기부 | 출하에서 회수한 야생 부추 1개 기부 | 부추 **1→0**, 골드 **0→150**, 기부 버튼 비활성 | [기부](images/runtime-museum-donated.png). 저장 재개 뒤 보상 중복 방지까지 검증한 것은 아님 |
| K6 / 도감 반영 | 기부 뒤 수집 도감 탭 | 야생 부추 `발견 / 기부 완료`, 보상 주화 발견 표시 | [도감](images/runtime-ledger-collections.png). 어획/채집 성공의 증거 아님 |
| L10 / 재료 없는 가공 거절 | 감자 재고 없이 절임통 가공 시작 | **`insufficient-input`**, 골드 **150 유지**, 인벤토리 전후 동일 | [가공 거절](images/runtime-maker-rejected.png). 성공 가공·시간 경과·수령 아님. F-03은 S 유지 |
| S3 / 기존 장식 회전 | 기존 해님 러그 회전 선택 | **`아래 · 2×1`→`왼쪽 · 1×2`**, 회전 완료 메시지 | [회전](images/runtime-decoration-rotated.png). 건물 배치·강화나 F-11의 겹침/갇힘 반례 재현 아님 |
| C3 / 농사 파종 | 밭 `(4,5)` 앞 `(4,4)`에서 빈손 조사 입력 2회 | 첫 입력 뒤 씨앗 **3개 유지**, 둘째 입력 뒤 감자 씨앗 **3→2** | [첫 입력](images/runtime-farm-tilled.png), [파종](images/runtime-farm-planted.png). 파종 관측 범위이며 watered·성장·수확 완주 아님 |
| W3-W4, A5 및 4.3절 / 취침·날짜·HUD 전환 | 기존 잠자리 `(3,3)` 앞 `(3,4)`에서 위쪽 조사 후 대화 확인 | **봄 1일 오전→봄 2일 아침**, HUD **비→맑음** | [다음날](images/runtime-next-morning.png). 단일 기존 잠자리 경로만 실측. 비 급수·날짜 거래의 모든 단계/실패 조건·세이브 성공 아님 |
| A5 / 보리 생산과 회수 | 전날 먹이·쓰다듬기 완료한 보리를 다음날 장부에서 확인 후 생산물 받기 | **받을 물품 1**, 달걀 인벤토리 **0→1** | [달걀 회수](images/runtime-animal-egg-collected.png). 보리의 해당 주기 관측이며 다른 종·주기·넘침·저장 재개 검증 아님 |

농사 파종의 위치·방향 준비는 하네스와 같은 **`__oprnDebug.teleport` / `__oprnInput.face`**를 사용했고, 행동은 **`__oprnInput.action()`으로 실제 프레임 조사 경로**에 전달했다. 장부의 키보드 입력과 구별한다. 인벤토리를 주입하거나 수확 함수를 직접 호출하지 않았다. 첫 입력 이미지의 파일명 `tilled`만으로 공개되지 않은 밭 상태 값을 추가 확정하지 않는다.

세 번째 물주기 입력의 [화면](images/runtime-farm-watered-input.png)은 **입력·화면 산출물**이다. 공개 runtime-state에 밭의 `watered` 값이 없어 **물주기 성공의 상태 검증은 U**다. B-play 파종 성공에 물주기 성공을 묶지 않는다. 이 물주기 입력 화면으로 비 급수·작물 성장/수확·가공 완료를 추가 주장하지 않는다.

후속 수면은 기존 **`ev_bed`의 대화→`sleepUntilMorning` 이벤트**로 실행했다. 대화 직후 즉시 snapshot에는 이전 날짜가 남았으며, **이후 실제 상태 갱신에서 봄 2일을 확인**했다. 수면 함수나 날짜를 직접 대입하지 않았다. 준비 생산물 1개와 달걀 회수는 다음날 장부에서 따로 확인했다. 이 단일 성공은 자동 세이브 성공, 다른 날짜 전환 경로, 전체 내부 단계의 원자성/실패 복구를 증명하지 않는다.

### 5.4 B-play 중 표시만 확인한 범위

| 표시 / 매트릭스 대응 | 감독자 관측과 실제 이미지 | 확인하지 않은 행동 |
|---|---|---|
| 시작 필드·HUD / W3, R5 일부 | [필드](images/runtime-field.png): `map_farming_demo`, `(4,4)`, 봄 1일의 시계·날씨/예보/다가오는 생일 HUD | 날짜 경계 추첨의 결정성·급수, 생일 선물 보너스, 주민 일정 완주 |
| 꾸러미 / L9 | [요구품·진행 표시](images/runtime-ledger-bundles.png) | 기부·완료·보상 수령 |
| 기술 / L1 | [5개 기술 Lv.1 / 경험치 0](images/runtime-ledger-skills.png) | XP 획득·레벨업·보상 적용 |
| 가공 설비 / L10 | [두 설비 시작 항목](images/runtime-ledger-makers.png) | 재료 있는 가공 성공·완료 수령. 거절만 5.3절에서 실측 |
| 건물·꾸미기 / S2-S4 | [기존 건물/장식과 배치·이동·회수·강화·회전 항목](images/runtime-ledger-spaces.png) | 항목 표시가 각 거래의 성공은 아님. 러그 회전만 5.3절에서 실측 |
| 출하 / L7 | [초기 장부](images/runtime-ledger-shipping.png) | 초기 표시 자체는 정산 성공 아님. 예치·회수는 5.3절의 별도 관측 |

## 6. 현재 테스트·재현 가능성·검증 한계

### 6.1 감독자가 현재 실행한 것

명령 형식은 지정 워크트리의 `npm test -- <57개 파일 전체>`이며 **정확한 전체 파일 목록과 모니터 ID는 [EXECUTION.md](EXECUTION.md)**에 보존되어 있다. 이 문서는 그 결과를 요약하며 로그 원문 전체를 직접 확보했다고 주장하지 않는다.

```text
Test Files  4 failed | 53 passed (57)
Tests       4 failed | 406 passed (410)
exit code: 1
```

| 실패 파일 / 확인한 assertion | 현재 실패 출력 요지 | 판정 |
|---|---|---|
| [p0ProjectSchema.test.ts:64-75](../../test/p0ProjectSchema.test.ts#L64-L75) | keeps old projects free of newly invented optional fields and byte-stable: 직렬화 문자열 동일성 실패 | 새 P0 필드 없음 검사 뒤 전체 문자열 비교. 정확한 차이 필드/정규화 정책 원인 U |
| [p1FoundationSchema.test.ts:124-139](../../test/p1FoundationSchema.test.ts#L124-L139) | keeps legacy projects byte-stable without optional P1 authored fields: 같은 동일성 실패 | 생활 전체 기능 실패로 일반화 금지. 공통 구형 프로젝트 정규화 계약 대조 필요 |
| [p2ProjectSchema.test.ts:61-71](../../test/p2ProjectSchema.test.ts#L61-L71) | keeps legacy projects byte-stable without P2 fields: 같은 동일성 실패 | 어종/낚시/채집/도감/박물관 없음 검사와 전체 문자열 안정성은 다른 계약 |
| [p2SpatialEditorAuthoring.test.ts:36-49](../../test/p2SpatialEditorAuthoring.test.ts#L36-L49) | `tab.dataset.count`: expected `"0"`, received `undefined` | 현재 공용 탭은 0 속성 삭제. 테스트 계약과 현재 UI 정책 불일치 S. 공간 거래 실패의 증거 아님 |

7개 영역에 대한 T-현 관련 범위(전체 목록은 EXECUTION.md):

| 영역 | 현재 실행 목록에 포함된 대표 파일 | 인정하지 않는 확대 해석 |
|---|---|---|
| 농사 | `p0SafetyHardening`, `p0ToolCapability`, `p0LifeSkillProgress`, `p1DayTransitionIntegration` | 기본 농사 전용 `farmingRuntime`, `databaseCropView`의 현재 실행 결과까지 있다고 보지 않음 |
| 주민 | `characterProfiles`, `friendshipGiftsShop`, `editorNpcSchedule`, `npcSchedule`, `npcScheduleReferenceIntegrity` | 실제 필드 선물/일정/관계 저장 완주 또는 `databaseCharacterView`의 현재 실행을 뜻하지 않음 |
| 제작·경제 | `databaseLifeCraftingView`, `p0Energy`, `p0Shipping`, `p0Bundles`, `p0Makers`, `p0LifeLedgerUi`, `p0SessionPersistence` | 직접 API 호출·ready 주입이 당일 타이머 갱신/원격 저장 성공을 증명하지 않음 |
| 날씨 | `p1WeatherCalendar`, `p1WeatherDayTransition`, `p1DayTransitionIntegration` | 실제 화면 강우와 모든 파종 칸 급수의 필드 재현 아님 |
| 동물 | `p1FarmAnimals`, `p1HostileAudit`, `p1RuntimeUi`, `p1SessionPersistence` | 배정 API 검사만으로 플레이 재배정 버튼이 존재하는 것은 아님 |
| 공간 | `p2SpatialTransactions`, `p2SpatialPlayIntegration`, `p2SpatialRuntimeUi`, `p2SpatialPersistence` | 함수/씬 스텁 통과가 모든 실제 맵 충돌·탈출 안전의 증거 아님 |
| 수집 | `p2LifeRuntime`, `p2HostileAudit`, `p2DayTransition`, `p2LifeLedgerUi`, `p2SessionPersistence` | 낚시/회수 API 통과와 사용자가 누를 제품 트리거 존재는 별개 |

대표 이름은 모두 `test/<이름>.test.ts`다. 테스트 내용과 소스는 변경하지 않았고, 실패를 삭제/건너뛰거나 산문 고정 테스트를 만들지 않았다. 현재 실패는 이 보고서 작성 이전 소스 기준의 결과다.

### 6.2 이 합성 작업에서 직접 재확인한 정적 호출 검색

실행 위치: `/home/main/.herdr/worktrees/rpg-zzu/wish-html`(동일 HEAD). 다음 검색을 실제 수행했다.

```bash
rg -n 'attemptFishingCatch|resolveFishingAvailability|collectForageAt|assignFarmAnimalToBuilding|advanceMakers|resolveShopSellUnitPrice' src
```

결과는 낚시 두 함수의 정의/낚시 모듈 내부 호출, `collectForageAt`·배정·상점 가격 도우미의 정의, `advanceMakers` 정의와 dayTransition의 import/두 호출이었다. 일반 플레이 트리거 부재 판정은 이 검색과 조사 입력/장부/렌더 소스 대조에 기반한다. 테스트가 직접 호출하는 함수를 제품 호출자로 세지 않았다.

현재 실측 환경은 [EXECUTION.md](EXECUTION.md)와 [RUNTIME.md](RUNTIME.md)에 귀속한다. 편집기는 `http://127.0.0.1:40059/`, 출하용 플레이어는 `http://127.0.0.1:44685/player.html`이다. 예정 편집기 포트 9841/19441 점유, Bun.WebView main-thread 제약 뒤 기존 Playwright Chromium을 사용했다. 후속 편집기 로컬 모듈의 `ERR_NETWORK_CHANGED`는 재로드 뒤 정상 표시되었고, 첫 플레이어 서버 시도의 cwd/Vite 허용 경로 403은 올바른 cwd의 별도 프로세스로 해결됐다. 이 환경 오류를 생활 기능 결함으로 분류하지 않는다. 편집기 재로드는 네트워크 오류 복구이지 폼 저장/재로드나 게임 세이브 재개 검증이 아니다. 서버의 현재 생존 여부는 합성 작업이 별도로 확인하지 않았다.

문서 LSP 진단도 요청했으나 `.md` 서버가 구성되지 않아 실행할 수 없었다. 이 문서에 대해 타입 검사/빌드가 통과했다고 대체 표현하지 않는다.

### 6.3 현재 실행되지 않았거나 입증되지 않은 것

- **B-play를 넘어선 생활 루프:** 낚시 성공, 새 계절 채집물 줍기, 가공 시간 경과 뒤 수령, 작물 수확 완주, 주민 선물·연애·일정 완주, 건물 배치·업그레이드 전체, 게임 세이브 후 재개는 U다. 단일 잠자리 이벤트의 날짜/HUD 전환과 보리 생산·회수는 5절에서 인정하지만 모든 날짜 전환 경로의 원자성·실패/재시도 또는 watered 상태 성공으로 확대하지 않는다. 5절의 실제 행동 수치와 달리 F절의 정적 수치 반례는 브라우저 재현이 아니다.
- **원격 저장 성공:** U. 원격 **읽기**는 인증된 GET의 HTTP 200/1행으로 확인됐지만 원격 쓰기·저장·업서트가 없으므로 새 콘텐츠 저장이나 쓰기 후 읽기 왕복을 증명하지 않는다. 별도의 GitHub 프록시/PR·병합 접근 문제와 LegacyDb 읽기 성공을 혼동하지 않는다.
- **`npm run gates`, 빌드, 전체 E2E:** 이 문서가 읽은 현재 EXECUTION.md에는 성공 결과가 없다. 감독자 담당 게이트를 완료한 것으로 기록하지 않는다.
- **과거 완료 보고서:** SCOPE.md가 언급한 `reports/stardew-p0-p2-implementation-report.html`의 완료·원격 저장·테스트 수치는 H다. 현재 406/4 기록, B-empty/B-loaded/B-play 증거에 과거 성공을 합산하지 않는다.
- **독립 시각 판독:** 합성 작업은 이미지 파일과 감독자 기록을 대조했으며 픽셀 판독 제한은 5절에 공개했다. 감독자가 확인한 표시·행동은 그 기록에 귀속한다. 모바일 크기, 넘침, 가독성의 독립 판독은 U이며 이후 HTML 실측 범위다.

## 7. 독립 검토용 최종 판정

1. **7/7 탭, 51개 하위 기능 행**을 작성했다(C 8 / R 8 / L 11 / W 5 / A 6 / S 6 / K 7; L0 공통 CRUD 포함). 각 행은 저작 위치, 소비자, 진입/조건, 저장 경계를 갖는다. 농사/주민의 외부 이벤트·시간 연결도 포함하며 탭 폼에 없는 부분을 탭 자체 기능으로 꾸미지 않았다.
2. **연결된 기능을 사용할 때:** 시간·재고·참조·이벤트/장부 진입을 준비하고 F-02/F-04 같은 설정/재개 경계를 고려해야 한다. 특히 작물·주민 프로필·종/유형의 등록만으로 맵 콘텐츠나 플레이 소지품이 생기지 않는다.
3. **현재 믿으면 안 되는 완료 주장:** 일반 낚시/계절 채집 회수, 당일 분 단위 설비 완료, 생활 판매표의 일반 상점 적용, 범용 건물의 동물 수용 확장, 미배정 동물의 플레이 재배정. 각각의 단절/분리 근거는 F-01~F-10에 있다.
4. **현재 실행으로 확인한 경계:** 인증된 원격 GET, B-empty/B-loaded 7개 탭, 5절의 출하 예치·회수/보리 돌봄/기부·도감/가공 재료 부족 거절/러그 회전/파종/기존 잠자리의 다음날·HUD 전환/보리 생산·달걀 회수는 감독자 RUNTIME.md의 증거로 인정한다. 이는 기존 원격 저장본을 공급한 분리 플레이 세션의 관측이며 원격 저장 영수증이 아니다.
5. **검토에 남은 경계:** 세 문자열 안정성 실패의 원인 확정, 위 관측 밖의 낚시·채집·가공 완료·물주기 상태·날짜 전환의 실패/재시도 전체·수확·주민 관계/일정·건설 루프, 게임 저장/재개, 독립 이미지 판독과 감독자 게이트다. 일부 실제 성공/거절 관측을 없었던 것으로 표현하지도, 전체 생활 완주나 정적 결함 재현으로 확대하지도 않는다. 이 문서는 미실행 영역의 성공이나 병합 승인을 선언하지 않는다.
