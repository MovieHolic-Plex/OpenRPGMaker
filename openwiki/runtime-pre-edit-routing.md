## 카메라 스크롤은 캔버스 픽셀 격자에 맞춘다 (2026-10-23)

`playSceneCamera.ts` `snapCameraScrollToCanvasPixels` 가 맵 카메라의 `clampX/clampY` 를 감싸 스크롤을 `1/zoom` 세계 픽셀 단위로 반올림한다.
따라가기 러프(0.2)가 남기는 소수 스크롤이 캔버스 반 픽셀에 떨어지면(zoom 2, 스크롤 x.25) 타일 층이 반 픽셀 밀려 칸 줄마다 1px 실선이 생겼다.
Phaser `preRender` 는 경계가 있으면 따라가기·패닝 뒤 clamp 를 부르고, 경계는 `syncRuntimeCameraBounds` 가 늘 건다. 경계를 끄는 경로를 만들면 이 반올림도 빠진다.
재현·확인: `node scripts/qa/astra-horizon/seam-probe.mjs <out> route-1-meadow mx_map_home 9 9` (`SEAM_STEPS` 로 스크롤 값 지정, 결과 PNG 의 칸 경계 가로줄을 센다).

## 지상 격자 위로 돌출한 원본 구조 (2026-10-06)

`GameMap.visualTopOverhangPx`는 지상 y=0보다 북쪽으로 그려지는 실제 구조의 여유(원본 픽셀)다.
`mapVisualBounds.ts`가 양수 정수 최대4096으로 정규화하고, 없거나0이면 키를 남기지 않는다.
`playSceneCamera.ts`는 relief 돌출과 이 값의 최댓값으로 북쪽 카메라 경계를 넓힌다.
지상 칸 수·통행·이벤트 좌표를 바꾸지 않으며 이미지를 이동하거나 확대하지 않는다.
예: 23×14 지상 맵의 궁륭이 y=-32까지 올라가면32로 지정한다. 그림 스프라이트는 원래 세계 좌표를 쓴다.
이 값은 편집기 맵 캔버스 확장이나 잘못된 소스 crop의 복구를 대신하지 않는다.

## 태양 지형 그림자 (2026-10-04)

선택적 `map.sunlight`는 기본 off, 편집기와 내보낸 게임이 `project/sunlight.ts`를 공유한다.
캐릭터 아래의 줄별 마스크·카메라 창 캐시·타일 제자리 수정 무효화·shutdown 정리는
[sunlight-shadows.md](sunlight-shadows.md)를 읽는다. 통행/시야 계산과 독립이다.

## 내보낸 게임의 화면 배율 (2026-10-04 → 2026-10-20 개정)

**2026-10-20 개정:** 배율은 프로젝트가 정한다 — `resolvePlaySurfaceScaleMode`(`src/project/playSurfaceScaleMode.ts`). 해상도를 저장한 프로젝트(새 기본 480×270)는
정수 배율+여백(FHD 4배·QHD 5배+여백·4K 8배), 옛 320×240(해상도 미저장)은 아래 fit 결정을 유지, 몬스터 수집은 정수 고정, 저작값 `system.playSurfaceScale` 이 있으면 그 값.
`exportEntry.ts`·`testPlayModal.ts` 는 더 이상 `surfaceScaleMode` 를 넘기지 않는다. 아래 문단은 옛 320×240 경로의 근거다.

(이력) `exportEntry.ts`는 `renderPlayer(surfaceScaleMode:'fit')`로 부팅했다. 기존 integer 기본에서는
1280×900 창에 960×720만 그렸다(면적 60%). fit은 원래 화면 비율을 유지하며 창의 최대 contain
배율을 쓴다(320×240이면 1200×900). 게임/UI를 자르거나 늘려 왜곡하지 않는다. 정수 배율을
명시한 다른 호스트의 선택은 유효하다. 단 에메랄드 몬스터 프로젝트(`isEmeraldMonsterStyle`)는 픽셀 격자 계약(`emerald-runtime-surfaces.md`)에 따라 `integer`로 부팅한다(창이 남으면 여백). 오프닝 QA는 reduced-motion이나 ESC로 실제 연출을
넘기지 않고 출하 player.html에서 자연 재생/첫 조작을 녹화한다.

생성 원화 타이틀의 효과 캔버스는 `backgroundRendering:smooth`를 상속하고,
논리 320px가 아닌 무대에 표시되는 부모 크기로 그린다(1920px 상한·소프트웨어 GPU 0.5 배율 유지).
캔버스 자신의 카메라 push 크기로 측정하면 매 프레임 재할당되므로 안정된 부모를 측정한다.
기존 pixelated 설정은 논리 해상도를 유지한다. 오프닝 정지 그림은 cover로 무대를 채우며 영상은 contain이다.

## 그림 아이콘을 조사 물체로 쓴다 (2026-10-04)

기존 `CC0_ICON_ASSETS`의 그림 id는 이벤트 `graphic.sprite`로 사용할 수 있다.
`eventSpriteResources`는 charset frame을 적용하지 않고 `__BASE` 전체 그림을 16px 상자에 맞춘다.
`bundled.ts`는 맵 이벤트/공간 구조가 참조한 아이콘만 로드한다(도감의 아이템 1,000개 그림 전체를 미리 싣지 않는다). `toolImageEventSprites`도 같은 크기/원본 알파로
그린다. `ensureBundledProjectTextures`도 새 사물 참조를 로드하여 편집 직후 재로드 없이 보이게 한다. 기존 공용 그림의 표시 경로를 재사용한다. 회중시계 예: `cc0-jetrel-clock`.

- **도트 대화창 (2026-10-04):** `pixel-cinematic`은 별도 저작 스타일이다(`project/dialogueStyles.ts`, `styles/dialogueStyles.css`). 새 관계·연애 프리셋의 기본이며 기존 프로젝트의 cream/gold를 이관하지 않는다. 각진 반투명 창·Galmuri11 Regular 12px(2026-10-24, 예전 Galmuri9 9px)·25% 높이를 사용하고 긴 본문은 기존 페이지 나누기를 따른다. 선택지 창은 모든 스타일에서 내용 높이로 자란다(2026-10-20): `--runtime-choice-panel-height`는 최소 높이이고 상한은 보이는 화면 높이−8px(`dialogue.css`·`playSurface.css`). 그 상한을 넘을 때만 목록이 스크롤되며 `dialogue.ts`가 선택된 행만 리스트 안으로 옮긴다. 예전엔 25%(480×270에서 67px) 고정이라 질문+3지선다의 셋째가 잘렸다. 검증 `npm run qa:runtime -- --scenario choice-fit-480`(픽스처 `choice-fit-480-fixture.mts`, `CHOICE_STYLE`). DOM 측정값과 scrollTop의 배율이 달라 단계 스케일로 나누며 페이지나 게임 무대를 스크롤하지 않는다. 검증 증거는 `verify-shots/romance-art/SUMMARY.md`; 합성 긴 문구 fixture와 실제 SQLite 장면의 출하 플레이어 증거를 구별한다.
- **도트 글꼴은 격자 크기로만 (2026-10-24):** 갈무리는 정해진 격자에서만 또렷하다 — Galmuri9 = 10px 정수배, Galmuri11·Galmuri11 Bold = 12px 정수배(실측: 그 크기에서 획 가장자리 반투명 화소 0). 무대 배율(정수)을 곱한 화면 크기가 격자 배수여야 한다. 9px·18px·33px 은 획이 2·3px 로 들쭉날쭉하다(에메랄드 18px·타이틀 33px 은 아직 격자 밖). 정수 배율 무대는 화면 px 정수 위치에 둔다(`playSurfaceScale.calculatePlaySurfacePlacement`). Phaser 월드 글자(`playSceneFieldFx.playLootPopup`)는 해상도=카메라 배율, 정수 좌표, origin 0. `Galmuri11 Regular` 는 별도 글꼴 이름이다 — `Galmuri11` 이름으로 들이면 10~11px 스택이 격자 밖으로 바뀐다.

- **런타임 프레임 예산 (2026-09-27, 렉 조사):** 매 프레임·주기 경로에서 아래를 다시 넣지 않는다.
  회귀는 `test/runtimeLagFixes.test.ts`(예전 구현과 같은 답을 내는지 대조한다).
  - QA 상태 미러(`runtime-state-json`)는 **읽을 때만** 만든다(`RuntimeDomOverlay.syncRuntimeStateSource`).
    편집기 테스트 플레이는 항상 계측 부팅이라, 매 프레임 이벤트 뷰 전체·생활 상태 복제·세션 JSON.stringify 가
    편집기에서만 렉이 심한 원인이었다. 매 프레임 몇 값만 필요한 소비자는 노드의 `data-live-flags` 를 읽는다
    (`runtimeDebugPanel`). textContent 를 매 프레임 읽는 코드를 새로 만들지 않는다.
  - 자연 시계는 같은 날 안이면 `reconcileLifeState`(세션 structuredClone)를 건너뛴다(`dayTransition.ts`
    §advanceClockWithinDay). 제작 작업이 사라진 정의·바뀐 시간 기준을 가리키면 예전 경로로 간다.
  - 병렬 이벤트는 한 번의 소비에서 `refreshRuntimeSurfaces` 를 **한 번만** 부른다(명령마다 아니다).
  - `runtimeEventViewById` 는 그 id 하나만 뷰로 만든다. 사각 질의(`findEventOverlappingRect`·`findBlocking*`)는
    앵커가 사각에 닿을 수 없는 이벤트를 뷰 없이 건너뛴다 — 몸 사각 상한(축 8)에서 파생한 범위라, 상한을 바꾸면
    `anchorMayOverlap` 이 따라 바뀐다.
  - 생활 NPC 는 같은 목표로 걷는 중이면 BFS 를 다시 돌리지 않는다(`reusableLivingRouteKey`). 호러 수색이 막히면
    500ms 동안 다시 훑지 않는다(`SEARCH_RETRY_MS`). `nearestPassableTile` 은 고리만 훑는다(결과 순서는 같다).
  - 조명은 어둠 0 이면 마스크를 그리지 않는다. 천둥 잡음 버퍼는 한 번 만들어 재사용한다. 필드 HUD·타이머·시계 HUD·
    픽처 층은 값이 바뀔 때만 DOM 을 쓴다. 구역 안내의 정면 조사 안내는 칸·방향이 같으면 250ms 동안 재사용한다.
  - **타일 그리기의 칸당 판정은 기억한다(2차, `test/runtimeLagFixes2.test.ts`).** `tileGraftsTextureSuffix` 는
    이식 배열 정체성+길이로 기억한다 — **이식 항목을 제자리에서 고치는 코드를 새로 만들지 않는다**(새 배열 대입이나 push).
    `worldCoastAutotileGroup` 은 그룹 내용 사본(이웃 수·멤버·연결·variantMap)과 비교해 기억한다. 그룹은 제자리에서
    고쳐질 수 있어서(`variantMap["255"] = 3`, `test/worldCoastMapping.test.ts`) 정체성으로 보면 안 된다.
    `renderTiles` 는 `withWorldCoastRenderPass` 로 감싸 한 번의 동기 그리기 안에서는 그 비교도 타일셋마다 한 번만 한다.
    100×100 그리기(Node 실측): 이식 553개인 기본 숲 타일셋 3.4초 → 약 40ms, 월드 타일셋(바다 섞임) 약 0.7초 → 약 40ms.
  - 맵 이동의 `mapWithCommittedEvents` 는 이벤트를 두 번 복제하지 않는다(키 순서는 원본 그대로).
  - 첫 사용 생성물은 나눠 굽는다: 구름 모양은 프레임마다 한 장(지금 보이는 장부터, 한 번에 약 300ms 였다),
    안개는 프레임마다 64줄(약 46ms 였다), 분위기 소리는 update 마다 10만 표본(최악 84ms → 약 16ms, 결과 표본은 같다).
    다 될 때까지 그 층은 그리지 않는다. 빗소리 8초 잡음 버퍼는 표본율별로 한 번만 합성해 컨텍스트가 바뀌어도 쓴다.
  - 날씨 입자는 날씨 시계(16ms 걸음)·날씨·화면 크기·줌·밀도가 같으면 다시 그리지 않는다(`weatherDrawSignature`).
    안개 층 위치는 매 프레임 옮긴다.
  - 시간 틴트는 색·알파·화면 크기가 같으면 Graphics 를 다시 비우고 칠하지 않는다(`timeTintPainted`).
    시계가 없거나 낮(알파 0)이라 이미 숨긴 틴트는 매 프레임 `clear` 하지 않는다. 위상 전환 중에는
    보간값이 바뀔 때만 다시 칠한다.
  - 남은 후보(고치지 않음): 자동저장은 동기다(큰 세션에서 스냅샷 약 17–28ms, stringify 약 3ms). `maybeAutosave` 가
    곧바로 true 를 내고 복제 실패를 동기로 던지는 계약(`test/autosave.test.ts`)이 있어 미루지 않았다.
    맵 타일 표시는 아래 「화면 주변 타일 유지」로 바뀌었다(2026-10-01). Phaser Container 는 자식을 깊이로 정렬하지
    않으므로, 칸을 추가한 뒤 원래 행/칸/조각 순서와 농지·설치물의 마지막 순서를 복원해야 한다.
  - **3차(서브에이전트 5명 조사 + 적대적 리뷰, `test/runtimeLagFixes2.test.ts` "3차" 절):**
    - 명령 이력 배열(`m2Runtime.expressions/debug/screenEffects/pathfinding/waits/checkpoints/dialogue/fallbacks`)은
      `pushM2History` 로만 넣는다. 상한 `M2_HISTORY_LIMIT`(64). 상한이 없어서 오래 플레이하면 세션을 복제하는 모든
      경로가 느려졌다(10만 건: 저장 236ms → 1.6ms). `ui`·`regions` 는 커서·게임 상태로 읽으므로 상한을 두지 않는다.
    - 추격 A* 는 막는 이벤트를 `createBlockingEventQuery` 로 **탐색 한 번에 한 번만** 모은다(이벤트 300개 도달 불가
      추격 559ms → 31ms). 판정기를 프레임 넘어 보관하지 않는다 — 앞 NPC 의 이동을 다음 NPC 가 봐야 한다.
    - 지형 성분 색인은 한 방향 턱(`ledgeDirections`)이 있으면 두 방향 중 하나라도 통하면 잇고, 턱 내용을 지문에 섞는다.
      예전 색인은 턱을 끊어 도달 가능한 추격을 "도달 불가" 로 막았다(기존 버그). 생활 NPC BFS 도 이 색인을 쓴다.
    - 조명: 화면과 겹치지 않는 광원은 서명·그리기에서 뺀다. 스프라이트 없는 이벤트 광원은 `runtimeEventViewById`.
    - 안개 굽기 예산은 `scene.game.loop.frame` 기준 **프레임당**, 분위기 소리 예산은 update 한 번 전체가 나눠 쓴다.
    - 생활 상태 파서는 사전을 펼쳐 다시 만들지 않고 own 속성으로 붙인다(제곱 → 선형).
    - 디버그 패널 라이브 줄은 `readLive` 만 읽는다. 전체 `readState` 는 덤프를 펼쳤을 때만.
    - 전투 적 맞춤은 배율 1 이하면 레이아웃을 읽지 않는다(브라우저 실측 전투 진입 작업 51–110ms 의 주범).
    - 미니맵은 해안 렌더 패스로 그리고, 생성 세대 번호로 늦게 끝난 낡은 생성을 버린다.
    - 조사했지만 고치지 않은 것: 이벤트 층 전량 재생성(스프라이트 재사용은 이동 보간·패턴 override·그림자 계약이
      얽혀 별도 작업이었으며 아래 6차에서 해결), 대기 없는 라벨 루프(`gotoLabel` 선형 검색), 빈자리 없는 필드 스폰의 1초 재검사, 빈칸 조사의
      세션 복제(`farming.ts`). 각각 Node 에서 재현은 됐지만 사용자 맵에서 흔한 조건인지 확인되지 않았다.
  - **4차(무작위 탐색 5명: 원숭이·대형 부하·10분 soak·Node 퍼징·차등 퍼징 + 적대적 리뷰 2회):**
    - 지형 성분 색인 지문은 32비트 해시가 아니라 **통행 입력의 정확한 사본**(Int32Array)이다. 해시 충돌 반례(3×3,
      시드 0xf1a62026)에서 열린 길을 "확정 도달 불가" 로 막았다. `terrainRevision(map)` 은 런타임 지형 변경 횟수다.
    - 생활 NPC 경로 재사용은 경로를 깐 때의 `terrainRevision` 과 같을 때만. 달라지면(changeTile) 무버를 새로 만들지
      않고 **남은 걸음만** 갈아 끼운다 — 진행 중인 걸음·방향·타이머를 지킨다. 1차 최적화가 막힌 경로를 재사용하던 회귀.
    - `createBlockingEventQuery` 는 막는 사각을 **정수 격자 버킷**(floor)으로 담는다 — 소수 좌표 이벤트도 같은 칸을
      공유한다. 도달 불가 추격 여러 명이 겹치던 수백 ms 멈춤(브라우저 최대 516ms).
    - 생활 NPC BFS 는 정수 칸·typed array(방문·방향 순서 동일). 맵 연결 BFS 는 출발 맵별 인접 목록(키는 JSON 배열 —
      맵 id 에 구분자가 있어도 섞이지 않는다).
    - 필드 스폰 점유 집합은 틱·초기화 단위로 한 번 만들고 성공한 몸을 더한다(대량 리스폰이 스폰 수의 제곱이었다).
    - QA 마커 DOM 은 값이 다를 때만 쓴다(생활 NPC 500명 테스트 플레이 보행 100ms → 마커 쓰기 제거 시 16.7ms).
    - 상점 메뉴·상태 메뉴 첫 개방은 새 DOM 의 첫 행에 `scrollIntoView` 를 하지 않는다(83~117ms 스파이크). 커서 메뉴는
      호출부가 `freshDom: true` 로 새 DOM 을 보장할 때만 생략한다 — 기존 컨테이너 재사용은 스크롤이 남아 있을 수 있다.
    - soak(10분 × 2 fixture, 맵 이동 61회·전투 31회)에서 DOM·리스너·텍스처·타이머·오디오 누적은 없었다.
    - `gotoLabel` 라벨 색인은 시도했다가 버렸다 — 명령 배열 제자리 편집에서 첫 라벨 규칙이 어긋나는 반례가 퍼징에서
      나왔다. 남은 후보: 단건 이벤트 조회를 NPC 전원에 쓰면 O(N²)(이벤트 2,500개 약 22ms), 이벤트 층 전량 재생성(아래 6차에서 해결).
  - **5차(인터프리터 퍼징·동등성 대조·편집기 플레이·GC 할당·전투/컷신 + 적대적 리뷰 2회):**
    - 단건 이벤트 조회(`runtimeEventViewById`)는 `withEventIdIndexPass` 안에서만 id→첫 이벤트 Map 을 쓴다. 자율 NPC
      패스가 감싸고, 패스 중 이벤트 배열이 바뀌는 경로(`fireEventTouch`→`runEvent`, NPC 맵 이동, 경로 스위치)는
      `invalidateEventIdIndexPass()` 를 먼저 부른다. 항상 켜진 캐시는 버렸다 — 같은 길이 배열의 제자리 대입으로 앞쪽에
      중복 id 가 생기는 반례가 나왔다. 이벤트 2,500개 NPC 전원 조회 31.9ms → 1.8ms.
    - 병렬 이벤트의 한 프레임 16단계 상한에 걸리면 처리하지 않은 결과를 `ParallelProcess.pendingResult` 로 남기고 다음
      프레임에 먼저 처리한다. 예전에는 그 결과를 버려 17번째 명령이 사라지고, 16번째 뒤의 `wait` 가 건너뛰어졌다(기존 버그).
    - 생활 NPC 가 걷는 도중 길이 막히면(`!route`) 같은 페이지의 생활 경로 키가 있을 때만 무버를 남기고 남은 걸음만 비운다
      — 지우면 진행 중 보간이 사라져 스프라이트가 반 칸에 멈췄다. 추격 등 다른 페이지에서 막 넘어온 무버는 예전처럼 지운다
      (strategy 가 chase 로 남아 계속 쫓아가는 리뷰 반례).
    - `fork` 는 조건 트리에 호감도·관계 조건이 있을 때만 소셜 host(characterId)를 프로젝트 전체에서 찾는다
      (`conditionReadsSocialHost`). 병렬 분기마다 이벤트 수만큼 선형 탐색했다(8,000개 ≈ 550ms/틱).
    - 런타임 디버그 패널은 라이브 줄·스위치 값을 값이 바뀔 때만 쓰고, 전체 `readState`·JSON 은 상위 패널과 내부 덤프가
      **둘 다** 열렸을 때만 갱신한다. 같은 값 재대입만으로 스타일 재계산이 프레임당 26ms(편집기 창을 뒤에 둔 테스트 플레이 약 20fps).
    - 생활 NPC 이벤트 막힘 재경로(2026-09-28): 최초 BFS/표면 갱신 재사용은 그대로다. 페이지 생활 무버만
      8회 연속 실패하면 실제 다음 통행 사각을 막는 이벤트가 있는지 확인하고, 그 탐색 동안 모은 이벤트 점유로
      BFS를 한 번 수행한다(`playSceneAutonomous` → `npcLivingTravel.canStep`). 몸 크기·passRows·공간 점유도 지킨다.
      NPC별 시뮬레이션 시간 1초 쿨다운은 탐색 실패에도 적용하며, 성공한 걸음/표면 갱신에서 초기화하지 않는다.
      우회 불가/목적지 점유는 원래 걸음을 소비하지 않고 기다린다. 인접 칸 도착·목표 전진·순간이동은 하지 않는다.
      플레이어만 막는 경우에는 BFS가 없다. 시간표의 8회 재시도 후 걸음 소비와 작가 custom 경로 계약은 그대로다.
      매 갱신 BFS 우회는 금지다. 회귀: `runtimeNpcLivingTravel.test.ts`(3×5 두 주민, 우회 불가/쿨다운,
      목적지 점유, 일시 막힘/플레이어, 300명 무막힘의 초기 BFS 300회·추가 0회).
      전후 실측(`origin/main` 52f752fb의 변경 대상 소스 사본 대조, 80ms × 60틱): 3×5 반례는
      (2,2) 정지·추가 BFS 43회 → (2,4) 도착·추가 BFS 1회. 12×300 맵 주민 300명은 양쪽 모두
      초기 BFS 300회·추가 0회·300명 도착. 초기 등록 뒤의 이동과 표면 갱신을 함께 센 수치다.
      관련 5파일 136개와 `typecheck:app` 통과. 기준선의 기존 129개도 통과하며 새 7개 중 5개는
      기준선 소스에서 실패한다(도착/대기/목적지 점유/플레이어 막힘/큰 이벤트 통행 사각).
      동시 막힘은 프레임당 재탐색 2명 예산으로 나누되 가장 오래 기다린 NPC 부터 준다(맵 순서로 주면 우회 불가 앞쪽 NPC 가 독점해 뒤쪽이 굶었다), (리뷰 반례: 100×100 주민 20명 108ms·50명 220ms → 1.4ms 이하),
      가려는 끝 칸 자체가 이벤트에 점유돼 있으면 BFS 없이 기다린다. 우회 없는 교착은 기다린다.
    - 조사했지만 고치지 않은 것: 폭풍 major GC(대조에서 재현 약함). 첫 전투 focus·타이틀 셰이더·이벤트 층·생활 BFS 교착은 6차에서 고쳤다.
  - **6차 첫 전투 마운트 (2026-09-28):** 인트로 전투는 마운트 때 명령 상태로 `syncView` 를 먼저 하지 않는다 — `startIntro` 가
    인트로 상태로 처음 그린다. 명령 패널 재구성은 시퀀스(`sequenceBusy`) 동안 숨은 버튼에 `focus()` 하지 않는다. 명령 국면이 되면
    `syncView` 가 커서 버튼에 포커스를 준다. 브라우저(SwiftShader, editor-authored-demo-v3, 3회): focus 호출 2→1회,
    focus 합계 55–69 → 37–57ms, 진입 긴 작업 92–104 → 65–87ms. 필수 첫 레이아웃은 남는다. 회귀 `test/battleIntroMountCost.test.ts`.
  - **6차 타이틀 효과:** `openwiki/title-opening-effects.md` 「소프트웨어 WebGL 입자 계산 분리」. 픽셀 동일, SwiftShader 약 16% 감소(60fps 아님).
  - **6차 이벤트 층 재사용 (2026-09-28):** `playSceneMapRuntime.renderEvents` 는 이벤트별 생성 입력
    (해석된 텍스처 키·텍스처 객체 정체성·기본 프레임·fitSize/charset·저작 패턴/override·배율/모드·맵/기준 타일 크기·priority)의
    정확한 값 배열을 스프라이트 WeakMap 에 보관한다. 페이지의 제자리 수정도 비교한다. 방향 프레임·현재 프레임의 크기·
    footprint 픽셀 좌표·depth·배율은 매번 기존 계산식으로 갱신한다. `activeMove.durationMs` 와 가구 밀기 보간이 우선이다.
    타일만 바뀌어도 이벤트를 통째로 버리지 않는다. 이벤트 소멸/그림 제거/그래픽 변경만 해당 스프라이트·그림자를 정리한다.
    - **보수적인 예외:** alpha/visible/blend/tint/flip/rotation/활성 애니메이션/외부 텍스처 변경 또는 트윈 대상은 교체한다.
      기존 갱신은 새 Sprite 기본값으로 돌아갔다. 특히 필드 전투 숨김 복원과 넉백·윈드업·착지 트윈은 객체 참조를 캡처하므로
      재사용하면 늦은 콜백이 새 표시 상태를 덮는다. 트윈 목록은 패스당 한 번만 읽으며 TweenChain·파괴 대기(null targets)도 처리한다.
    - 그림자는 재사용하지만 갱신 직후에는 숨긴다(기존 경로에서는 파괴돼 보이지 않았다). 다음 `applyHopFrame` 이 위치·배율·alpha를
      다시 적용한다. hop 기준 배율 풀은 기존처럼 보존한다. 맵 reset 은 여전히 스프라이트·그림자·hop 풀을 전부 정리한다.
    - 같은 depth 의 그리기 순서를 지키려고 root DisplayList 를 한 번 선형 압축한 뒤 이벤트를 원래 조회 순서대로 뒤에 붙인다.
      DisplayList 객체/배열과 멤버십은 유지하며 stable depth sort 를 요청한다. 이벤트마다 `bringToTop` 을 호출하는 O(N²) 경로는 금지.
    - `eventSprites.get` 소비자 전수 확인: 자율 이동/명령/강제 이동/가구 밀기는 호출마다 조회하고, 맵 애니메이션은 시작 좌표만 복사한다.
      조명·HP 바·대시·사망 고스트·QA 훅도 조회형이다. 대사 anchor 와 이모트는 id 로 매번 조회하므로 부속 객체를 유지한다.
      카메라는 참조를 보관하지만 기존 `applyStoredCameraState`/`rebindEventFollowCamera` 가 교체 시 다시 연결한다.
      인터프리터/병렬 erase 의 직접 destroy/delete 뒤 남은 그림자는 다음 이벤트 패스에서 정리한다.
    - 회귀: `test/eventLayerReuse.test.ts`; 수정 전 함수를 고정한 `test/eventLayerLegacyOracle.ts` 와
      위치·텍스처·프레임·depth·visible·alpha·origin·scale 을 대조한다. Node 실측 재현은
      `npx tsx --tsconfig tsconfig.app.json scripts/bench-event-layer.ts` (실제 Phaser Sprite/Frame/DisplayList,
      생활 NPC 500명·절반 보간 중·50회 워밍업/300회 측정). GPU/브라우저 렌더링·생활 경로 등록·DOM 비용은 측정 밖이다.
      같은 100×100 fixture 의 `refreshRuntimeSurfaces → renderTiles` 측정(`--surface-only`, 수정 전 소스 복원 대조):
      중앙값 **4.022 → 0.937ms**, p95 **6.185 → 2.012ms**, 회당 Sprite 생성/파괴 **각 500 → 0개**.
      Node v24.11.1, 공유 머신의 단일 실행 수치이며 GPU 프레임 시간은 아니다. 재사용 테스트 18건 중 원본 코드에서 6건 실패한다.
      기존 `eventCommandMapRepairs` 날씨 particleCount 4건 실패는 원본에서도 같다(34건 중 30건 통과).
  - **7차 NPC 길찾기 통합(2026-09-28):** 적대 리뷰 4명(생활·추격·명령/시간표·통행 판정)이 22건을 찾았고 세 갈래로 고쳤다.
    합친 뒤 통합 리뷰가 3건을 더 찾아 고쳤다: 양보자는 상대가 사라지거나 비충돌(아래 층·겹침 허용)이 되면 곧바로 원래 경로를
    다시 짜고, 대피 걸음이 다른 NPC 에 막히면 반대편 대피 칸을 다시 고른다. 좌표 이동 명령의 중단 판정은 같은 대상의
    더 새 명령만 본다 — 도착 직후 페이지 자율 이동이 다시 깔린 것을 교체로 보면 정상 도착이 interrupted 였다.
    생활 500명+추격 50명 update 1회(Node): 초기 추격 탐색 82.7→56.1ms(A* 50→2회), 기존 경로 걸음 67.3→63.1ms,
    1×1 생활 경로 500개 origin/main 과 불일치 0. 걸음당 플레이어 몸 해석 2회가 늘었다(측정상 시간 증가 없음).
  - **7차 첫 전투 CSS 준비(2026-09-28):** 첫 전투 마운트의 루트 포커스가 강제하던 스타일·레이아웃 30~50ms(두 번째 전투 5ms)는
    전투 CSS(약 380KB) 첫 매칭 비용이다. `playSceneBattle` 이 진입 커버를 시작할 때 `warmBattleStyles`(battleStyleWarmup.ts)가
    마운트와 같은 빌더로 만든 전투 DOM 을 화면 밖·visibility:hidden·inert 로 한 번 붙였다 뗀다(배경 물결 rAF 도 끊는다).
    SE 디코드 요청도 같은 시점으로 당겼다. 브라우저(SwiftShader, 5회씩, 같은 부하): 마운트 레이아웃 33–42 → 14–28ms.
    손으로 쓴 클래스 뼈대는 효과가 거의 없었다(34–60ms) — 스킨·배틀러·게이지 규칙이 실제 노드 구조에 걸려 있다.
    회귀 `test/battleStyleWarmup.test.ts`(흔적 없음: 호스트 자식·포커스·rAF).

  - **7차 NPC 길찾기 — 생활 이동(pfA, 2026-09-28):**
    - 초기 BFS도 `canMoveFootprint`/passRows와 설치 가구 점유를 따른다. 기본 1×1만 성분 색인을 쓰며 사용자 `canStep`/큰 몸은 제외한다.
      1×1 무가구 경로 500개는 수정 전과 JSON 바이트가 같다. 같은 생활 페이지의 목적지 변경은 남은 걸음만 교체해 activeMove를 보존한다.
    - 지형·가구 막힘도 8회 실패 뒤 재계획한다. NPC별 1초 쿨다운·프레임당 2명·오래 기다린 순서와 플레이어만 막힐 때 탐색 생략을 유지한다.
      첫 출구가 닿지 않으면 현재 맵에서 닿는 대체 출구를 고르고, 표면 갱신은 선택한 출구를 탐색 없이 재사용한다.
      착지 맵의 이벤트 통행 사각/설치 가구가 막으면 transfer 걸음을 보존한다. 비반복은 꺼진 꼬리에서 조건을 기다린다.
    - 같은 상대에게 양쪽이 8회 연속 막힌 생활 NPC 중 작은 event id만 양보한다. 기존 예산 안에서 진행 축에 수직인 바로 옆
      대피 칸을 몸 통행 판정으로 선택한다. 표면 갱신이 대피를 덮지 않으며 상대가 두 칸 이상 이동한 뒤 원래 목적지를 재계획한다.
      대피 칸 없음/고정 이벤트/더 먼 대피 칸만 있음은 대기한다. 일반 무버 보간을 사용하여 순간이동하지 않는다.
    - 회귀: `test/runtimeNpcLivingPathRegression.test.ts`; 재현: `npx tsx --tsconfig tsconfig.app.json scripts/qa/living-path-regression.ts`.
      `runtimeNpcLivingTravel.test.ts`는 성분 색인 대신 `canStep` 경로 계획 진입으로 재탐색 횟수를 센다.
      무막힘 300명은 초기 탐색 300회·추가 재탐색 0회를 유지한다.
  - **7차 NPC 길찾기 — 추격·진영 전투 (2026-09-28, pfB):**
    - 일반 추격도 `pursuitPass`를 사용한다: 양쪽 `passageBounds/passRows`와 설치 가구 점유를 지킨다.
      진영 목표 좌표의 솔리드 이벤트 하나만 탐색 점유에서 제외하며 실제 세션·최종 이동 충돌은 그대로다.
      NPC 목표 접촉은 eventTouch를 발동하지 않는다. 넓은 추격자/플레이어 접촉은 다음 걸음의 통행 사각과
      플레이어 현재/이동 예약 통행 사각의 겹침으로 판단한다(원거리 유지·수색은 접촉 트리거 억제).
    - 추격 주기 재탐색(500ms, 초기 탐색 포함)은 렌더 프레임당 최대 2명, FIFO 대기 순으로 배분한다.
      프레임 번호 없는 헤드리스에서는 update 한 번이 예산 단위다. 예산 거절 시 경로/타이머를 보존하고,
      도달 가능한 경로가 주기 전에 소진되면 즉시 탐색한다. 도달 불가 쿨다운·생활 이동은 그대로다.
      `updateAutonomousNPCs` 진입 래퍼만 예산을 열며 생활 루프 본문은 수정하지 않는다.
    - 회귀 `test/npcChasePathfinding7.test.ts`: 통행/접촉, 예산·공정성·동일 프레임·경로 소진,
      무막힘 300명 추가 탐색 0회. 재현 `scripts/qa/probe-npc-chase-pathfinding.ts`.
      100×100 도달 불가 20명 Node 실측 250–333ms → 33–38ms(공유 머신, 2회 탐색 비용은 여전히 남는다).
  - **7차 NPC 길찾기 — C: 명령 이동·시간표·플레이어 통행 사각 (2026-09-28):**
    - `playScenePathfinding`의 중단 판정은 대상별 요청/루트 소유권을 쓴다. 세션 최신 요청은 공용 성공 플래그만 갱신한다.
      다른 NPC의 병렬 도착은 서로 중단하지 않는다. 목적지 자체의 벽·통행 사각 점유는 `blocked`, 열린 고립 칸은
      `unreachable`이다. 실패 분류에 이웃 목적지 A* 네 번을 추가하지 않고 사각만 검사한다.
    - 플레이어 상대 이동/회전은 `runtimeEventViewById`의 좌표 우선순위를 따른다. NPC 걸음은 플레이어의 현재·이동 중
      목적지 `resolvePlayerBody`/`playerPassageRect`와 겹치면 막는다(상체 제외, through/jump 기존 예외 유지).
      `applyNpcTransfer`는 무버 제거와 함께 명령 이동 id도 정리한다. 착지 점유 검사는 C 변경 범위가 아니다.
    - 시간표 목표가 현재 커밋 위치가 되면 옛 남은 걸음만 비운다. 새 시간표 경로는 시간표 소유 무버의 보간·속도·방향·
      타이머를 유지하며 남은 걸음만 교체한다. 별도 명령 무버는 시간표로 오인하지 않는다. 이미 허용된 걸음은 착지한다.
      기존 시간표 재시도 간격과 생활 경로 쿨다운/프레임 예산은 유지한다. 주기/표면 갱신에 탐색을 추가하지 않는다.
    - 회귀: `test/npcCommandPathfinding7.test.ts`. 재현: `npx tsx --tsconfig tsconfig.app.json scripts/qa/probe-npc-command-moves.ts`.
      실제 병렬 후속 스위치, 시간표 재지정, 큰 플레이어 충돌을 전후 대조한다. 무막힘 300명은 초기 A* 300회 이후
      40회 보행·시간표 갱신의 추가 탐색 0회다.
  - **8차 NPC 길찾기 — 생활 교착·직접 추격·단일 탐색 상한 (lvA, 2026-09-28):**
    - 생활 양보는 관측된 8회 연속 막힘의 방향 그래프에서 순환과 연결된 사슬(최대 32명)을 찾는다.
      33명 이상이 엮이면 그룹 전체를 포기하지 않고 서로 막은 두 명(예전 쌍 양보 범위)만 푼다 — 상한이 양보를 통째로 끄면
      예전에 풀리던 긴 줄이 영원히 선다(적대 리뷰 반례: 33명 한 줄 0/33 → 33/33 도착).
      고정 이벤트로 끝나는 사슬은 양보하지 않고 기존 점유 우회 BFS/대기를 유지한다. 각 후보가 실제로 비킬 수 있는지를
      기존 1초 쿨다운·update당 재탐색 2명 예산 안에서만 검사한다. 무막힘 이동/표면 갱신에 탐색을 추가하지 않는다.
    - 대피 BFS는 최대 6걸음(앵커 최대 85개), 매 걸음 몸 통행/passRows·이벤트·가구·플레이어 점유를 따른다.
      대피 끝의 몸 전체가 상대들의 현재 위치·남은 걸음·끝 칸과 겹치면 선택하지 않는다. 후퇴 중에는 통로를 따라 움직일 수
      있지만 기존 순차 위치 커밋으로 겹침을 금지한다. 대피는 기존 무버 보간/표면 갱신 보호를 재사용한다.
      상대들의 남은 경로가 원래 막혔던 위치를 모두 지난 뒤 원래 목적지를 재계획한다. 대피 중 막히면 같은 예산으로 재선택한다.
      상대가 대피자의 원래 자리에 눌러앉아도(그 자리가 상대 목적지) 지금 자리에서 상대 남은 통로와 겹치지 않는 경로가 열리면
      대피를 끝내고 그 길로 간다(같은 1초 쿨다운 안의 재탐색 1회).
    - `pathfind=false`는 커밋된 직전 칸으로 즉시 돌아가지 않는다. 탐욕 전진이 막히면 첫 우회 걸음에서 벽의 좌우를 고르는 벽 따라가기 최대 16걸음,
      같은 방향 상태 재방문 시 대기한다. 대상 좌표 변경은 기억을 초기화한다. A*나 전역 탐색을 이 모드에 넣지 않는다.
      표적이 바로 옆이면 언제나 그 칸을 낸다(접촉) — 서 있는 표적에 두 번 접촉한 뒤 멈추던 반례를 막는다.
    - 상한은 **추격(`nextChaseDecision`)에만** 건다. `findChasePath` 의 기본 상한은 무한이라 일과 경로(npcSchedules)·좌표 이동
      명령(playScenePathfinding)·문 통과(pursuitDoors/pursuitNavigation)는 긴 정상 경로를 끝까지 찾는다.
      추격 A*는 무버의 `chaseExpansionCap`(기본 2048)에서 중단한다. 상한에 걸려 실패하면 상한을 두 배로 넓히고
      `chaseWidenPending` 으로 다음 판정에서 곧바로 다시 찾는다 — 이 재탐색도 프레임당 2명 예산을 거친다(7차 예산 계약 그대로).
      맵 면적에 닿은 뒤의 실패만 진짜 막힘이라 500ms 를 기다린다. 넓힌 상한은 줄이지 않는다.
      적대 리뷰 반례: 100×100 한쪽 끝만 열린 벽(우회 198칸)에서 고정 2048 상한은 추격자를 영원히 세웠다 → 넓힘 뒤 접촉.
      불완전 탐색으로 지형 성분 색인을 만들지 않는다. 상한 안의 비교자/방향/타이브레이크는 그대로다.
      작은 맵 80개의 수정 전 JSON 경로는 `test/fixtures/npcChasePathfinding8Oracle.json`에 고정했다.
    - 회귀는 `test/npcPathfinding8.test.ts`: 먼 대피 칸·3명 사슬 양 끝·역순·불가능 대기·고정 이벤트·큰 몸·상대 목적지 제외,
      직접 추격 왕복·A* 상한·작은 맵 바이트 동등성을 검사한다. 반경 밖 해법/32명 초과 교착/16걸음 초과 벽 추적은 대기하며
      전역 다중 에이전트 경로 계획은 하지 않는다. 적대 리뷰 반례 4건(긴 우회 추격·인접 접촉·원래 자리 점유 뒤 재개·33명 줄)도
      같은 파일에 있고, 수정 전 코드에서 실패한다.
    - 전후 대조(동일 fixture·수정 전 소스 복원): 새 회귀 13개 중 10개 실패 → 13개 통과. 먼 대피 0/2 → 2/2명 도착,
      3명 사슬 0/3 → 3/3명 도착(양 끝 여유/역순 포함). 직접 추격 60걸음 중 즉시 왕복 59회·미접촉 → 왕복 0회·8걸음 뒤 접촉.
      100×100 이벤트 봉쇄 A* 통행 질의 19,796 → 4,146회. 작은 맵 80개(도달 가능 70개) JSON 불일치 0개.
      무막힘 생활 300명은 초기 BFS 300회·이동/표면 갱신 중 추가 탐색 0회를 유지한다. 고정 이벤트는 전후 모두 우회/대기 계약 통과.
      기존 관련 7파일 175개는 170통과/5실패로 전후 동일(새 실패 0). 좌표 이동 2건은 registry 누락, footprint 1건과 NPC approach 2건은 시간 초과다.
  - **8차 보류 3건·폭풍 GC (lvB, 2026-09-28):**
    - `gotoLabel`은 명령 배열 WeakMap + 길이 + 라벨 위치/객체 정체성/이름을 검증하고 틀리면 선형 재구축한다.
      기존 라벨만 검사하면 앞 일반 명령의 `kind` 변경/같은 길이 앞쪽 대입을 못 잡는다. 그래서 동기 실행 진입,
      일반 명령/콜백/프레임 완료 경계에서는 전체 라벨 구성을 검증한다. 검증을 줄이는 구간은 **콜백 없는 동기
      label/goto 연속 구간뿐**이다. 첫 칸이 목적 라벨이면 원래 O(1)을 유지한다. 앞 중복/이름 변경/종류 변경/
      splice/reverse/희소 배열/배열 교체 20,000회는 옛 선형 검색과 일치한다. 다른 명령을 섞은 루프는 보수적으로
      전체 검증 비용이 남는다. 명령 배열을 freeze/Proxy로 바꾸거나 외부 편집을 막지 않는다.
    - 필드 스폰은 기존 1초 틱에서 점유 집합을 한 번 비교하고, 같은 점유·맵 크기·`terrainRevision`이면
      실패한 영역의 후보 칸을 다시 훑지 않는다. 대기 타이머/결정 순서/스폰 상한은 유지한다. 플레이어·이벤트 이동,
      스폰 이동/제거/처치, 지형 revision 변경은 다시 탐색하게 한다. 씬은 `eventPositions`를 전달한다.
      첫 페이지 몸 크기라는 기존 보수적 점유 규칙을 유지한다. **점유 집합 구성/동등 비교는 필요한 1초 틱에 남는다**.
      매 프레임/표면 갱신에 탐색은 추가하지 않는다. 런타임 지형을 고칠 때 기존 revision 무효화 계약을 지킨다.
    - 빈칸 농사 조사는 범위 내 경작 가능 칸·나무/돌·저작 도구 행동을 읽어서 모두 없으면 복제 전에 반환한다.
      하나라도 후보면 기존 전체 복제 트랜잭션을 유지하여 광역 조작·에너지·XP 실패의 원자적 롤백을 보존한다.
      ignored 전부를 무복제로 바꾼 것은 아니다(경작지에서 실패하는 조작은 기존 경로).
    - 비/폭풍은 `weather/rainBuffer.ts`의 Graphics별 숫자 배열과 사전 계산한 입자 seed를 재사용한다.
      Phaser의 기존 선 스타일/경로/플래시 명령 순서·좌표·강도는 그대로다. 눈/안개는 기존 경로다.
      실제 설치된 Phaser Graphics 메서드 및 고정한 옛 함수와 명령 배열을 비교한다. V8의 double 배열을
      매번 clear/push로 다시 만들지 않는다. 이벤트 뷰는 임시 위치 객체와 두 번째 몸 사각 계산을 제거한다.
      반환 뷰/페이지/몸·통행 사각은 풀링하지 않아 이전 결과의 스냅샷과 별칭 금지 계약을 유지한다.
    - 재현: `npx tsx --tsconfig tsconfig.app.json scripts/qa/bench-runtime-lvB.ts`.
      같은 워크트리에서 수정 전 소스를 파일 사본으로 복원한 대조, Node v24.11.1, 15묶음 중앙값이다.
      2,003명령 배열/1,000명령 실행: 배열 읽기 **1,002,001→4,003**, **14.739→0.340ms**.
      막힌 스폰 60초: 후보 탐색 **60→0회**, 틱 **0.0646→0.00251ms**.
      변수 10,000개 세션의 빈칸 조사: **8.815→0.00962ms**, 힙 증가 **1,379.64→2.39KiB/회**.
      640×480/강도 1 폭풍: 명령 생성 **0.0407→0.0168ms**, 힙 증가 **137.64→2.49KiB/프레임**.
      이벤트 뷰 힙 증가 **0.610→0.555KiB/호출**; 시간은 **0.000397→0.000430ms**로 개선 주장 안 함.
      힙 수치는 묶음 전 GC 후 `process.memoryUsage().heapUsed` 차이이며 정확한 총 할당량이 아니다.
      Phaser WebGL 내부 Path/Point 할당과 GPU 렌더링은 계측 밖이다. 브라우저 major GC 해결/프레임 시간 개선은
      아직 주장하지 않는다. 원자료/원본 사본/패치: `/tmp/lvB-save/`.
    - 회귀 `test/runtimeLag8.test.ts` 8개 중 원본에서 6개 실패(네 결함 모두), 제자리 편집 퍼징은 양쪽 통과.
      `test/weatherBufferPhaser.test.ts`는 설치된 Phaser와의 숫자 명령 동등성 계약이다.
      `eventCommandMapRepairs`의 기존 날씨 실패 4개는 옛 입자 상한 96 기대값을 실제 상한 180으로 바로잡았다.
      관련 10파일 **173/173 통과**, `NODE_OPTIONS=--max-old-space-size=6144 npm run -s typecheck:app` exit 0.
  - **8차 기준선 실패 테스트 수리 — lvC (2026-09-28):**
    - 기준 소스 `ef5375b2f`, 격리 워크트리 `rpg-zzu-lvC`. 대상 8파일의 실패 34건을 먼저 재현했다.
      전부 **(a) 테스트 하네스/기대 계약의 노후화**로 분류했다. 제품 코드 수정은 없고,
      프레임·표면 갱신 탐색, 7차의 쿨다운·프레임 예산·통행 사각 정책은 그대로다. skip/quarantine/시간 제한 상향은 없다.
    - 파일별 원인과 이력(`git log -S`, 타이틀 메뉴 경계·발자국 루프는 `git log -L`로 대조):
      | 테스트 파일 (`test/`) | 원인·수정 및 이력 | 유지하는 회귀 단언 |
      | --- | --- | --- |
      | `coordinateDestinationMove.test.ts` | `ae1a8d447`(09-22) 종료 화면 검사에서 registry가 필요해짐. 씬 대역에 빈 Map registry 추가 | 병렬 이동 결과 변수·스위치, 도착 후 후속 명령, 실패 시 중단 |
      | `p0TransitionControlFlow.test.ts` | 같은 종료 화면 검사에서 `HTMLElement` 사용. 불완전한 document 전역 대역 대신 happy-dom | 미완료 sleep/advance 대기, 성공 뒤 재개, false/reject 뒤 명령 금지 |
      | `factionNpcCombat.test.ts` | `84b57f633`(09-21) 스킬 shutdown 구독과 `d74d200d2`(09-24) 피해 글자 setScale. EventEmitter와 글자 setScale 대역 추가 | 진영 간 피해·보호 1HP·플레이어 보상 배제·평판 1회 |
      | `eventCommandMapRepairs.test.ts` | `040583434`(09-21) 최대 입자 96→180. 강도 0.7/0.8/0.5의 리터럴 기대값 67/77/48→126/144/90 | step·저장 강도 정확 일치, 명시 강도 우선, 0이면 날씨 제거, 렌더 입자 수 정확 일치 |
      | `runtimePlayerHop.test.ts` | `c93489c97`(09-27) held-key tracker가 document/window 필요. happy-dom 사용 | 점프 좌표·높이·맵 경계·낙하 중 다음 이동 소비 금지 |
      | `titleScreen.test.ts` | `839b5ea20`(09-25) 클릭 허용, `6e5a671e3`(09-26) 필수 크레딧·아래 경계 보정. 정확한 배열/선택/콜백 기대 갱신 | 전체 순서와 ID, 표시 설정, resume 조건, 단일 tab stop, 클릭 콜백, 경계·clamp(입력 99) |
      | `playerFootprint.test.ts` | `813fb5d66`(08-29)의 32회 공용 프로젝트 생성 루프를 1회 생성+각 조합 타일 초기화로 변경. `68c87888e`(09-08)의 자동 트리거 dialogue 검사에 필요한 registry도 추가 | 4방향×8벽 조합 32개 전부, 몸/통행 사각·착지·세이브 왕복. 타임아웃 최초 발생 커밋은 부하/카탈로그 증가에 좌우되어 특정하지 않음 |
      | `battleEnemyFit.test.ts` | `f115c53bb`(09-20) 단일 적 앵커 x=245→239. 640px 필드 기대 490→478 | 배율·발끝·종횡비·필드 경계·재동기화·타이머 정리 |
    - 보수적 정책: 제품에 브라우저/Phaser 기능 누락을 무시하는 방어 코드를 넣지 않고 대역이 실제 환경 계약을 제공한다.
      타이틀 클릭은 위쪽 역사 문구의 keyboard-only와 다르지만 09-25의 명시적 `play-ui` 도입과 현재 제품 동작을 유지한다.
      크레딧은 표시 설정과 무관하게 남으며 선택 인덱스도 크레딧을 포함한다. 제품의 입자 밀도·전투 구도를 옛 테스트 값으로 되돌리지 않는다.
    - 파일별 실패 전→후(동일 케이스 수): coordinateDestinationMove **2→0/39**, p0TransitionControlFlow **6→0/9**,
      factionNpcCombat **7→0/10**, eventCommandMapRepairs **4→0/34**, runtimePlayerHop **5→0/5**,
      titleScreen **8→0/23**, playerFootprint **1→0/22**, battleEnemyFit **1→0/13**. 합계 **34→0, 155/155 통과**.
      이전 통과 121건도 유지되었다. 각 최종 파일 명령 exit 0. `NODE_OPTIONS=--max-old-space-size=6144 npm run -s typecheck:app`도 exit 0(진단 0건).
    - 전/후 검증과 재현 로그: `/tmp/lvC-save/*-before.log`, `*-after.log`, `history.txt`, `work.patch`.
      각 파일을 `timeout 600 node scripts/run-vitest.mjs run --configLoader bundle --maxWorkers=1 --minWorkers=1 test/<file>.test.ts`로
      하나씩 실행한다. 기존 실패 테스트 자체가 이번 하네스 수정의 회귀 테스트이며 수정 전 파일에서 위 실패를 재현했다.
      제품 결함이 없으므로 제품 코드를 되돌리는 변이 검사는 해당하지 않는다. 발자국 timeout은 시간 수치 외에
      생성 횟수 32→1, 비교 조합 32→32로 검증한다. 해당 케이스는 27,164→699ms였다(공유 머신 단일 측정).
      기준선의 미처리 registry 예외 6건도 수정 후 0건이다. timeout의 최초 실패 시점은 특정하지 못했다.
  - **8차 타이틀·첫 전투 브라우저(lvD, 2026-09-28):**
    - `titleEffects/renderer.ts`는 이미지 로드 전부터 중지 핸들을 소유한다. `webglcontextlost`에서
      `preventDefault`+rAF 취소, 상태 `lost`로 전환하고 효과 업데이트는 CPU 값만 보관한다.
      `webglcontextrestored`에서 프로그램·이미지/깊이 텍스처·입자 MRT 패스·uniform을 다시 만들고
      최신 효과·기존 애니메이션 시계로 재개한다. freeze/reduced-motion은 정지 프레임을 유지한다.
      명시적 stop/분리 때 리스너·setter를 제거하고 컨텍스트를 해제한다. 늦은 이미지 콜백은 중지/손실/
      이전 프로그램을 확인한다. 컨텍스트 손실 동안 매 프레임 GL 호출을 계속하지 않는다.
    - 품질은 **컨텍스트 생성/복구 사건 때 한 번**만 판정한다. `WEBGL_debug_renderer_info`가 명시적으로
      SwiftShader/llvmpipe라고 알려줄 때만 내부 가로·세로를 각각 절반으로 줄여 CSS 크기로 확대한다.
      실제 GPU/정보 비공개/알 수 없는 렌더러는 기존 DPR·1920px 상한·셰이더 품질을 유지한다.
      매 프레임 탐색/readback/렌더러 조회는 추가하지 않는다. 셰이더 수식은 변경하지 않는다.
      320×240 forestMorning(7효과/70입자), Chromium SwiftShader, 동일 현재 셰이더 전체/절반 해상도
      교대 측정(4회 워밍업+24회×3): 렌더 완료 중앙값 **79.3→22.5 / 78.6→24.8 / 77.7→25.7ms**.
      readPixels 완료 시간이며 60fps/GPU 실기 측정이 아니다. 전체 품질 분기는 렌더러 이름만 가려 실행했고
      구 셰이더와 24개 RGBA 비교 차이 0. 하드웨어 GPU 자체는 이 환경에서 검증하지 못했다.
    - `battleStyleWarmup.ts` 화면 밖 무대는 `left:-100000px` 대신 transform으로 이동한다.
      기존 `inset:0`의 right와 합쳐 폭이 **100640→640px**가 되는 결함을 수정했다(호스트 640px).
      전투 DOM은 기존처럼 한번 붙였다 떼고 포커스·rAF·접근성 흔적을 남기지 않는다.
      Scarloxy Pokemon 표본의 img 2개+inline 배경 1개가 준비 중 실제 요청한 이미지는
      시스템/얼굴 포함 **5개, 37166바이트**. 준비 후 마운트 추가 요청 **0**이며 준비 없이 마운트해도
      동일 URL 5개·동일 전송량이었다. 중복 다운로드가 아니므로 이미지 요청을 제거하지 않는다.
    - 실제 마운트는 새 DOM의 스타일/레이아웃을 여전히 계산한다. 동일 fixture 3회의 동기 마운트
      중앙값 **31.1→30.6ms**, CDP로 둘러싼 마운트 구간 레이아웃 **13.5–34.4→9.5–20.8ms**,
      수정 후 스타일 **4.0–5.6ms**. CDP 구간은 인접 브라우저 작업도 포함하며 공유 머신 변동이 크다.
      큰 추가 가속이라고 해석하지 않는다. contain(layout/style/paint), content-visibility:hidden도
      3회씩 대조했으나 일관된 이득이 없었다. 숨은 자식의 offsetHeight는 계산을 강제하므로
      content-visibility로 준비를 건너뛰거나 실제 전투 DOM을 보관하는 정책은 채택하지 않았다.
    - 회귀: `titleEffectsShader.browser.test.ts`(실제 WEBGL_lose_context, 고정/애니메이션 복구,
      깊이/입자 픽셀, 손실 중 최신 효과, 로드 전 stop, 전체 품질 픽셀, 절반 해상도),
      `battleStyleWarmup.browser.test.ts`(실제 레이아웃 폭·요청 재사용).
      수정 전 renderer로 복원하면 preventDefault=false/복구 픽셀 차이255/손실 중 draw 지속/
      320×240 유지/로드 전 stop 실패. 수정 전 warmup으로 복원하면 폭100640 때문에 회귀가 실패한다.
      기존 titleScreen의 실패8개는 클릭·필수 크레딧·하단 여백 정책에 맞춰 테스트를 정정(23개 통과).
      battleEnemyFit의 Pokemon 좌표 기대값도 현재 저작 x239(640px 화면 x478)에 맞췄다(13개 통과).
      관련 6파일 46개 통과, typecheck:app exit0. 전체 게이트/전체 vitest는 실행하지 않았다.
    - 재현은 `scripts/bench/title-effects.mts`, `scripts/bench/battle-warmup.mts`.
      player.html+vite.player-qa.config.ts 서버를 별도로 시작하고 `PLAYER_QA_URL`로 지정(기본9944),
      브라우저 vitest는 `--config vitest.browser.config.ts`로 해당 파일 하나씩 실행한다.
      QA 기본 watch는 꺼져 있으므로 **소스 복원/수정 뒤 서버를 재시작**해야 구 transform 캐시를 재지 않는다.
      측정/음성 대조 로그·스크린샷은 `/tmp/lvD-save/`에 보관한다. 게임 콘텐츠/정본 DB 변경은 없다.
- **플레이 프리로드는 카탈로그가 아니라 맵이 쓰는 그림만 싣는다 (2026-09-22):**
  `loadBundledAssets` / `collectPlayReferencedStrings` 는 `resourceProfiles` 와, 어떤 맵·명령도
  가리키지 않는 `tilesets` 레코드를 훑지 않는다. 빈 프로젝트도 `ensureBundledTilesets` 로 칩셋
  카탈로그 전체가 들어 있고 프로필은 캐릭셋 텍스처 키를 전부 갖고 있어서, 통째로 보면 시작 맵과
  무관한 시트의 다운로드·색키·타일 프레임 등록이 테스트 플레이 창을 붙잡는다. 맵 `tilesetId` 와
  이벤트·액터·명령이 가리키는 타일셋만 다시 읽는다. 적·종족의 `monsterResourceId` 도 카탈로그다.
  전투 초상은 전투 DOM 이 시작할 때 받고, 플레이 프리로드는 맵 `fieldSpawns` 가 실제로 꺼내는
  생성 몬스터만 싣는다. 대사창·이모트·배치 오버레이 텍스처는 그대로 항상 싣는다.
  내보내기 ZIP 은 다른 계약이다(`webExportAssets` 는 이미지 프로필을 계속 넣는다).
  회귀: `test/playBootAssetSelection.test.ts`.
- **호스트 프로젝트 초기 연결:** `electron/main/sessions.ts`의 세션 오픈은 인라인 `dataUrl`이
  실제로 들어 있는 문서에서만 미디어 분리용 전체 역직렬화를 수행한다. 일반적인 파일 참조
  프로젝트는 `project.load()`가 곧 읽을 5~6MiB 문서를 미디어 검사 때문에 한 번 더 복원하지
  않는다. `electron/main/dispatch.ts`의 `project.load`도 저장된 wire 문자열을 그대로 보내고
  revision/sha는 메타데이터 조회로 채운다 — 메인 프로세스에서 같은 문서를 먼저 복원하지 않는다.
  미디어 분리 계약 자체는 유지하되, 이 경로에 새 전체 프로젝트 스캔을 추가하지 않는다.
  창이 스토어를 여는 중에 닫히면 그 세션은 붙이지 않는다. 다른 창이 같은 폴더를 여는 중이 아니면 SQLite 와 팀 DB 를 닫는다.
  닫을 때 세션이 아직 없으면 `sessions.close` 는 그 키의 세대만 올리고, 이미 시작한 `open` 이 끝나면 `SessionConsumerClosed` 로 돌아간다.
- **호스트 정적 자원·브리지 전송:** `electron/serve/runtime.ts`는 해시가 붙은 `assets/` 파일에
  immutable 캐시를 주고, 1KiB 이상 JSON/JavaScript/CSS/SVG와 프로젝트 브리지 응답은
  `electron/serve/httpBody.ts`의 gzip 경로를 탄다. 브라우저가 매번 다시 받아야 하는 HTML과
  세션별 브리지 의미는 no-store로 유지한다. 프로젝트 JSON을 다시 직렬화하거나 캐시 헤더를
  무효화하는 코드를 호스트 경로에 추가하지 않는다.
- **좌표 목적지 이동의 실패 계약 (OPRN-OUT-013, 2026-09-10):** `playPathfindMove` 는
  이제 `Promise<MovementResult>` 를 돌려준다(도착 + 실패 6종, 정수 코드가 계약이다).
  변수 좌표는 `session.variables[id]` **원시 조회**로 읽어야 한다 — `getVariable` 의 `?? 0`
  은 「변수 없음」과 「값 0」을 지워 나쁜 데이터를 (0,0) 이라는 그럴듯한 목적지로 만든다.
  해석 실패는 이동 단계를 아예 내지 않으므로 대기 명령이 영원히 멈추지 않는다.
  결과는 명령이 지정한 변수/스위치에 쓴다 — `session.flags.pathfindSucceeded` 는 호환용
  전역 한 칸이라 병렬 이벤트가 서로의 결과를 덮는다. `onFailure: "stop"` 은 전경
  (`playSceneInterpreter`)과 병렬(`playSceneSchedulers`) **양쪽**에 있어야 한다.
  `Pathfind Move` 의 `speed` 는 페이지와 같은 1–8 스케일이다(기본 4) — 1–6 으로 묶으면
  페이지 속도 7·8 이 Pathfind 구간에서만 무시된다.
  `MoveRoute.skippable` 은 개별 루트 단계용이라 재사용하지 않았다(사유는 M2 페이지).
  상세: `openwiki/runtime-m2-flow-controls.md`.
- **구역 드나듦 트리거는 걸음 완료·순간이동·이벤트 종료 세 지점에서만 판정한다 (2026-09-10):**
  `{ kind:"locationTransition", locationId, transition }`. 판정의 집은
  `src/project/locationTransitions.ts` 하나이고 「안에 있는가」의 시간 미분이다 — 두 번째
  내부/외부 규칙을 만들면 `insideLocation` 조건과 답이 갈린다. 배선은
  `src/player/playSceneLocationTransitions.ts`: 걸음 완료(`advancePlayerStepFrame` 의 칸 확정
  직후, 접촉 트리거 앞), 순간이동 완료(`transferTo`, 자동 트리거 앞), 이벤트 종료 후 재개
  (`refreshRuntimeSurfaces`). **세 번째가 없으면 문(playerTouch)으로 구역에 들어가는 저작이
  조용히 죽는다** — `transferTo` 가 문 이벤트의 인터프리터 안에서 불려 `scene.running` 이
  참이고 `runEvent` 가 즉시 되돌아 나온다(브라우저 실측). 밀린 것은 **이벤트 id** 로 큐에
  담고(사건으로 담으면 나중 해석 시점의 페이지 조건이 반응 대상을 지운다) 상한 8로 자른다.
  점유 기록(`session.occupiedLocationIds`, ID 만·optional)은 큐와 무관하게 즉시 갱신한다.
  새 스케줄러를 만들지 마라 — 이 트리거는 auto 와 같은 «사건 하나» 성질이다. 계약 전문은
  `openwiki/runtime-project-schema.md` 의 「구역 드나듦 트리거」 절.
- **이벤트 명령 실동작 검토 (2026-09-05):** `docs/reviews/2026-09-05-event-runtime-audit.md`. 「철수의 기억」에서 강제 NPC 방향 전환이 `scene.running` 게이트에 막혀 30초 뒤에야 다음 명령으로 진행됐다. `updatePlayScene`은 NPC 업데이트를 호출하고 `updateAutonomousNPCs`가 대화 중 **명령 루트만** 허용한다. 배경 자율 이동과 병렬 이벤트는 기존 설정대로 정지한다. 직접 NPC updater만 호출하는 테스트로는 이 배선 결함을 잡지 못하므로 `test/runtimeMovementStability.test.ts`의 실제 프레임 디스패치 회귀를 유지한다. 저장된 M2 대화 설정의 강제 기본값 초기화도 수정했다(`test/persistedMessageSettings.test.ts`). `Wait Until`, `Pathfind Move`, 메뉴/로드 화면, 좌표 ID 조회, 저장된 M2 영화 명령의 후속 미구현·오연결도 수정했다. 실행 계약과 제한은 `openwiki/runtime-m2-flow-controls.md`의 2026-09-05 항목을 따른다. 카탈로그 배지나 최종 종료만으로 전체 명령을 검증했다고 보고하지 않는다.
- **실내 화로 불 애니메이션:** `src/editor/tilesetImage.ts`의 `supportsChipsetTileAnimation(tileset,tile)`이 기존 마을 애니메이션과 실내 불 스트립 124/154/184/214만 허용한다. 플레이어 `playSceneMapRuntime.renderTile`과 편집기 `chipsetTileRender.createRawTileObject`가 공통 조건을 쓴다. `isDefaultTilesetTexture`를 넓히면 실내에 마을 길/나무 규칙까지 적용되므로 바꾸지 않는다. `stone_hearth_unlit`의 463은 정지, `stone_hearth_lit`의 아래 가운데 124는 4fps이다. `test/interiorFireRendering.test.ts`는 양 레이어의 실제 렌더 경로를 검사한다.
- **Shipping pointer-exclusion contract (2026-08-28):** `.player-layout[data-play-input-owner="keyboard-only"]` is keyboard-only regardless of `navigator.webdriver`. The capture blocker rejects mouse, pointer, touch, wheel, context-menu, drag, selection, auxiliary, and native trusted-click channels; Phaser mouse/touch managers are disabled. The root prevents selection, dragging, canvas hit testing, browser scroll, and autoscroll. Exactly two pointer owners exist: `[data-play-input-owner="touch-controls"]`, mounted only by explicit `VITE_TOUCH_CONTROLS` / `OPENRPG_PLAYER_TOUCH_CONTROLS`, and `[data-play-input-owner="host-fullscreen"]`, mounted only when `hostFeatures` advertises fullscreen. Ownership never escapes those subtrees, and keyboard-only runtime content has no native `title` tooltips.
- **Mobile touch play (2026-10-24, supersedes the "no auto-mount" sentences nearby).** `exportEntry.ts` passes `touchInput: isTouchDevice()`; on touch devices `player.ts` mounts the D-pad + A (Enter) + B (Escape) pad (`touchPad.ts`, skin `touch`, synthetic keyboard events; hidden in battle/dialogue/title/main menu, B stays in menus), sets `data-play-input-owner="play-ui"` (blocker off, so title/dialogue/choice/shop/ESC menu/save-load are tappable), uses the project scale mode (integer by default since the device-independent UI change; it was `fit` before), and auto-mounts the `host-fullscreen` button when `document.fullscreenEnabled` (`mountHostFullscreenToggle({autoOnTouch})`). Battle command/targets are `pointer-events:none` in the keyboard contract (`09-keyboard-result-panel.css`); `touchpad.css` re-enables them only under `play-ui`. Portrait shows a localized rotate hint (`viewport.dataset.rotateHint`, `playSurface.css`). `audioEngine.ts` unlocks on touchend/pointerup/click too, because iOS ignores touchstart/pointerdown for audio activation. Desktop stays keyboard-only. **Store side:** the fullscreen button only works inside the game iframe if the parent iframe has `allow="fullscreen"` (or `__OPENRPG_BOOT__.hostFeatures: ["fullscreen"]`). Measured (host load ~45, so noisy), iPhone 13 at 4x CPU throttle: walk ~18 fps, battle ~10 fps; unthrottled 38/25. Battle is the weak spot. Not verified: shop taps, real-iOS BGM/SE.
- **Mobile touch play v2 (2026-10-24 later, supersedes the hiding rules above).** Phone testers could not play: (1) Galaxy Fold reported `(pointer: fine)` (pen digitizer) so the old `isTouchDevice()` chose the keyboard-only contract and every tap was blocked except the host fullscreen button; (2) the pad was hidden in dialogue/menu/battle/shop, and the dialogue box's hover-revealed 「기록」 button opened a log whose only exit was "L · Esc"; (3) portrait controls sat at the iframe bottom behind Safari's toolbar with a dead zone above. Now:
  - `isTouchDevice()` = coarse pointer, or touch points + mobile UA (iPadOS via Mac UA + touch points), or any-pointer coarse + no hover, or a remembered first touch (`localStorage oprn-touch-input`). `exportEntry.installTouchUpgrade` reloads once into touch mode when a real touch arrives in keyboard-only mode.
  - Layout: `createPlaySurface(..., { touchUi })` → `calculateTouchLayout` (playSurface.ts) reserves room first, then fits the stage: portrait = stage on top under the safe area, controls (menu row + 112–136px stick + A/B) in the band below; landscape (2026-10-25 v2, user: "landscape buttons are hard to press, the experience is bad — give mobile the desktop experience") = side gutters of `LANDSCAPE_GUTTER` (128px + 60% of the safe inset) hold only the controls (108px stick on the left, A/B + Menu on the right) and the stage is fitted between them, so no control covers the game; A/B/Menu/Run get a hit area ~10px larger than the drawn button. The old overlay rules (`data-touch-overlay`) no longer trigger on phones. Probe: `scripts/qa/runtime/landscape-touch.probe.mjs` (iPhone 13 844×390, Android 915×412, real touch taps, `--video`).
  - The pad (`touchPad.ts`) is mounted on every surface (title, opening, load-from-title, difficulty, game) and never hidden. Floating stick: pressing anywhere in `.touch-stick-zone` centers the stick under the thumb and it follows a long drag. A `메뉴` button (Escape). Keys go to `document.activeElement` (`keyTarget()`), so screens that listen on their own root (shop) receive the pad. A held stick direction, and a held gamepad D-pad or left stick, repeat like a keyboard key (`heldDirectionRepeat.ts`: 500ms, then every 33ms, `repeat: true`). The gamepad left stick uses a radial dead zone (`gamepadStickSector` in `desktopShellBridge.ts`: enter 0.45, hold 0.30) and then the same cardinal-biased sectors as the touch stick — an older per-axis 0.45 gate dropped a 45° push until each axis cleared 0.45 (magnitude about 0.64). Field movement ignores repeats and keeps the hold. Confirm, cancel, and Shift do not repeat.
  - `touchTap.ts`: a short tap on the game backdrop (canvas, stage, title backdrop, dialogue overlay) is Enter; ignored while choices/menu/shop/battle/log are open, and on the field canvas when `system.pointerMovement` walks by tapping. Dialogue log and backlog get a visible 「닫기 ✕」 and close on a tap or a sideways/down swipe; the in-box 「기록」 button is hidden on touch (open the log from the menu).
  - Fullscreen toggle (hostBridge) locks `screen.orientation` to landscape after `requestFullscreen` on touch devices (Android); iOS has no lock, so portrait is laid out to be playable and the Korean rotate hint (「가로로 돌리면 화면이 커져요」) fades after 6 s.
  - Store side (OpenRPGMaker-store): iframe `sandbox` adds `allow-orientation-lock`; play page uses `viewport-fit=cover`, the theater shell follows `visualViewport` height (`--play-vh`) and pads the safe area (the iframe cannot see it); the 「클릭해서 계속」 focus cover never shows on touch; the page's fullscreen button also locks landscape.
  - List rows (`touchListTap.ts`, touch layout only): the first tap on a row of any list that shows a selection mark (`.selected` / `aria-current="true"` / `aria-selected="true"`: status-menu rail and detail rows, items, equip, shop rows, choices, title menu, save slots, battle commands) only moves the cursor; tapping the highlighted row confirms. The window's own cursor model is not touched: the row is first "hovered" (mouseover/mouseenter, which `runtimeCursorMenu` follows), otherwise arrow keys are sent one at a time towards the row's on-screen position. If the list does not take the keys (another pane is active), the keys are undone and the click goes through as before. Tabs (`role=tab`), the name-entry keyboard, the log and the pad are excluded. Mouse clicks are untouched.
  - **Device-independent UI (2026-10-24, replaces the #3347 "narrow touch" enlargement).** Every in-game window is laid out in game px inside the logical resolution and scaled as one piece with the stage, so phones, tablets and desktop show the same layout, only bigger or smaller. `mobileUi.css` no longer re-sizes anything by `--mobile-ui-k` (title, dialogue, ESC menu, battle, shop); it only places the pad and the dock. Touch layout follows the project `scaleMode` (`calculateTouchLayout(..., {scaleMode})`; `integer` floors at ≥1). Pixel ESC menu text is on the font grids: 12px `Galmuri11 Regular` (`--px-menu-font`), 10px `Galmuri9` (`--px-small-font`), rows 16px (`pixelWindows.css`). Shops are mounted outside the stage (`.play-viewport`), so in the player the overlay is a logical-size frame centered on the stage and scaled by `--play-scale-x/y`, with `--play-scale: 1` inside (`shop.css` end). The shop's compact/tiny layouts are chosen by logical resolution (`viewport.dataset.shopFit`, set in `applyPlaySurfaceResolution`) through `@scope` copies of the old viewport `@media` blocks; the originals are scoped `to (.player-layout .play-viewport)` so they only apply outside the player. The emerald shop keeps its own 480×320 frame but is centered on the stage, not the viewport. Do not add viewport `@media`/`vw`/`vh` rules for in-game windows.
  - **Whole rows and measured text (2026-10-25, J21/J22).** Window lists must never show a half row: `keepWholeRows(list)` (`src/player/runtimeTextFit.ts`) measures the real rows (BCR ÷ overlay scale) and caps the list's `max-height` at the last fully visible row; it re-measures when the parent window resizes. It is on the pixel shop goods list and every ESC-menu detail list (the CSS `--oprn-menu-row-step` rounding assumes 16px rows, but pixel rows are ~18.7px). The pixel shop description (`shop-desc-text`) wraps (Korean `keep-all`), puts the equipment stats first (`shop-desc-stats`, 「공격 +8」 — the tiny layout hides the comparison window, so this is the only place stats show), and `fitTextToLines` tries 2 lines → smaller font (≥10px) → 3 lines → whole-glyph line-clamp with the full text in `title`. Save/load with a showcase stack the showcase under the slot list at full width (`:not(.has-side)`, `statusMenuEdgeDock.css` + pixel copy in `pixelWindows.css`), and compact rows that start with a label shrink the label (ellipsis) instead of overflowing the value past the list edge. Known remaining: the pixel skills/items lists with a 128px showcase still squeeze labels to a few glyphs.
  - Dialogue dock (portrait, stage scale < 1, enough free height): the dialogue/choice overlay stays a stage child but is moved below the stage, above the controls, and counter-scaled to 1x (`data-dialogue-dock`, `--dock-top/left` in stage coordinates, `--dock-width/height`, `--dock-unscale`, `--touch-controls-top`; `DIALOGUE_DOCK_MIN_HEIGHT`). Turn it off with `localStorage oprn-dialogue-dock = "0"` to compare with in-canvas dialogue. Menus are not docked.
  - Window panel (portrait, stage scale < 1; added after #3353 because portrait menu text was 8–10 CSS px): the ESC menu (non-emerald skins) and shops are drawn in a fixed 320×300 game-px panel instead of over the stage. The panel sits just above the 메뉴 button row and is 1x (12px text) on phones at least 328px wide with room for it (iPhone SE: 0.97x), so all portrait phones share one layout (`TouchLayout.panel`, `WINDOW_PANEL_WIDTH/HEIGHT`, `data-window-panel`, `--panel-top/left` in stage coordinates + `--panel-unscale` for the menu, `--panel-cx/cy` + `--panel-scale` for the shop; `mobileUi.css` end). In the panel the pixel menu stacks the equip/item showcase under the list, and the shop uses the small (`tiny`) layout. Choices stay in the dialogue dock (already 1x). `localStorage oprn-window-panel = "0"` turns it off.
  - Scale steps: `integer` mode allows 1.5x when 1x would leave more than 35% of the box empty (`INTEGER_FILL_MIN`, iPad mini); 2x and up stay integer. Touch landscape narrows the gutters to the stick width when that is what makes 1.5x fit. Shop layout thresholds are now in game px (`shopFitFor`: ≤360 wide tiny, ≤640 wide or ≤360 tall compact). Note: `@scope` style rules only match descendants of the scope root (an implicit `:scope ` prefix), so the shop copies are rooted at `.play-viewport`, not at the overlay.
  - Shop regression note (fallen-star 1.15 = #3353 without #3359): the logical frame turned shop text into 12 game px, but the compact/tiny `@scope` copies never matched, so the wide-screen rules ran inside 480×270. The party and comparison windows collapsed into an empty area, and the entrance key hints overflowed the frame. #3359 made the copies apply. The pixel shop's party cards now share the panel width by member count (`grid-auto-flow: column`) instead of four fixed slots, which cut names to 「엘…」 at 12px. Check desktop at 2x with `mobile-play2.flow.mjs --only shop --device Desktop [--smith]`.
  - **Mobile feel v3 (2026-10-24, measured with `scripts/qa/runtime/mobile-feel.probe.mjs` — CDP `Input.dispatchTouchEvent` on emulated iPhone 15 / Fold, portrait+landscape; bake `chrono-bell` once with `bake-flagship-demos.mts --out /tmp/mf`).** Latency was already fine (touch → first pixel of movement 1 frame, release → stop finishes the current tile). What felt bad: (1) no tap-to-walk on touch — a map tap sent Enter (talk to whatever you face); (2) the stick's per-axis 0.35 threshold made 54% of all angles diagonal and had no hysteresis → zig-zag on a grid; (3) floating stick: a first touch beside the pad gave no direction until you dragged; (4) knob trailed the thumb by a 60ms transition; (5) Menu button 36px tall; (6) no way to run on touch; (7) cutscene hint said "Esc Esc" on phones. Now:
    - `system.touchControls` (`project/touchControls.ts`: `tapToMove`, `stick: auto|fixed|floating`, `haptics`, `runButton`; defaults all on / `auto`, only non-defaults saved) + device prefs in `playerPreferences` (`touchTapToMove`, `touchStick`, `touchHaptics`, `alwaysRun`) shown in the in-game Options when `data-touch-ui`; DB 시스템 → 「휴대폰: …」 fields; assistant `set_project_settings.touchControls`. Resolve with `player/touchControlSettings.ts currentTouchControls()` (device > authored > default).
    - Tap-to-walk (`playScenePointerMove.ts`): touch taps are judged on pointerup (≤400ms, ≤14px), only on `data-touch-ui`. Map tap → path walk (`playerRoute.pointer = true`); tapping again while walking retargets from the step's landing tile; tapping a person/object (body rect, or the tile under a tall sprite's head) walks to the nearest free side, turns, and fires the action edge (`consumePendingTapAction`, injected **before** `input.update()` because `resetEdges()` clears unconsumed edges at frame end); tapping the hero = A. Any pad/key direction cancels the tap route. `touchTap.ts` no longer sends Enter for taps inside the canvas box when tap-walk is on (the old `target instanceof HTMLCanvasElement` test never matched — the canvas is `pointer-events:none`). A ring (`.touch-tap-ripple`) marks each accepted tap.
    - Stick (`touchPad.ts stickSector`): 8 sectors, cardinals 56°, diagonals 34° (28°–62°), 8° hysteresis, dead zone 12px to start / 8px to release. `auto`: touches within 1.7× the pad radius use the pad center (direction at once), farther ones float the pad under the thumb; `fixed` never moves; `floating` = old behaviour. Knob has no transition while held. Haptics via `navigator.vibrate` (Android; iOS Safari has none). 「달리기」 toggle button = `alwaysRun` pref (Shift inverts it, RPG Maker MZ style). Menu/Run buttons 44px; the portrait control block reserves 52px for that row.
    - Known, not fixed here: skipping a cutscene with Esc Esc / B B can leave the camera parked where the cutscene panned (seen on Fallen Star `fs_hub` march); menu rows in the pixel ESC menu are 14px tall (first tap only moves the cursor, so mis-taps are harmless).
  - **Touch leftovers (2026-10-25, `scripts/qa/runtime/mobile-leftovers.probe.mjs`; battle needs `fallen-battle-fixture.mjs dist/demos/chrono-bell.play.json /tmp/mf/lo/fsb-fixture.json`).**
    - ESC menu command rows: `calculateTouchLayout` returns `menuRow` = ceil(44 / menu scale) game px → `--touch-menu-row`; the **pixel** skin's dock (`--px-dock-h`) and rows use it on `data-touch-ui` (other skins still have their own fixed rails — not yet widened). The portrait window panel grows to the free height (300–400, `panel.height` → `--panel-h`) so gold/location/time still fit; touch landscape hides location/time on the main screen. `touchListTap` excludes `.status-menu-command-rail`: one tap selects **and** opens (lists inside the screens keep first tap = cursor, second = confirm).
    - Fullscreen/home-screen button is 44×44.
    - Cutscene skip (Esc Esc / B B) calls `restoreCameraAfterCutsceneSkip` (playSceneCamera.ts): finishes running pan/zoom effects, bumps a skip generation so the cancelled camera step does not write its "fixed" state afterwards, clears `session.camera` (→ project zoom + follow player) and the letterbox. Before: camera stayed parked 144px off the hero.
    - Landscape overlay: while a dialogue or battle is up, the stick/A/B rise to 0.68× the control line, the stick zone stops above the bottom windows, and they fade to 25% (Run is inert); while the ESC menu or a shop is open they fade and ignore touches (the Menu button = B closes/backs out).
  - **Running on touch (2026-10-25, `scripts/qa/runtime/mobile-run.probe.mjs`).** No separate Run button by default (`system.touchControls.runButton` defaults to false; saved only when true). Like Chrono Trigger mobile, pushing the stick past 70% of the base radius (`STICK_RUN_ENTER`, exit at 60% `STICK_RUN_EXIT`, touchPad.ts) holds Shift = the dash key, with a 6ms buzz; a dashed ring at 70% (`.touch-dpad-base::before`) turns accent while `.touch-stick-zone[data-run]`. Under "always dash" the stick never sends Shift (Shift would invert to walking). Tap-to-walk routes of `TAP_RUN_MIN_STEPS` (5)+ steps set `PlayerRouteState.dash` and run (FF Pixel Remaster / RPG Maker touch-move run); shorter taps walk; always-dash makes every route run. `startPlayerRouteStep` sets `scene.dashing = route.dash === true`.
  - QA driver: `scripts/qa/mobile-play2.flow.mjs` (WebKit iPhone / Chromium Pixel / Fold, portrait/landscape, `--frame` store-like iframe, `--video`). Taps are `page.touchscreen.tap`; stick drags are CDP touch on Chromium and synthesized PointerEvents on WebKit (no touch-move API).
- **The pointer contract has two static enforcement layers, because neither can see the other's surface.** (1) `scripts/lib/playerInputCss.mjs` (`test/playerInputCss.test.ts`) walks the `src/player/player.css` `@import` closure and rejects unowned `:hover`/`:active`/`cursor:pointer` rules while preserving `:focus-visible` keyboard styling — it cannot see attributes set from JS. (2) `scripts/lib/runtimeDomTitleGuard.mjs` (`test/runtimeDomTitleGuard.test.ts`) rejects JS-set native `title` tooltips in `src/player` — CSS parsing cannot see those. Five separate tooltip leaks reached the shipping shop/battle DOM before this guard existed, so do not remove one layer on the grounds that the other passes. The guard decides DOM-versus-data by receiver name, so a data-object `.title` assignment inside `src/player` would false-positive; that is deliberate fail-closed behavior rather than running `tsc` inside the guard.
- **누락 리소스 알림은 경고이고, 무대 안의 px 는 배율만큼 곱해진다 (2026-08-30 실측).** `renderEvents` 는
  `resolveEventSpriteTexture` 가 못 푼 이벤트 스프라이트를 `DEFAULT_EASYRPG_CHARSET_ID` 로 대체해 계속 그리고,
  `scene.missingResources` 를 `RuntimeDomOverlay.syncMissingResourceError` 로 흘린다. 집합은 `clearEventSprites`
  가 매 렌더 경로(`renderTiles` / `renderEventLayer`)에서 비우므로 누적되지 않는다 — 게임은 정상 진행하고,
  이 노드는 **저작 경고**일 뿐이다.
  - **왜 애초에 뜨는가:** 로드 게이트 `collectResourceIds`(`src/project/io/resourceReferenceValidation.ts`)는
    `assets.sprites`·`assets.uploaded`·`resourceProfiles[].assetId`·**모든 타일셋 이미지 id**·EasyRPG RTP 전량
    (칩셋·얼굴·오디오 포함)·CC0 아이콘·BGM/SE 카탈로그까지 알려진 리소스로 받아들인다. 반면 렌더 시점의
    `resolveEventSpriteTexture`(`src/player/eventSpriteResources.ts`)는 `assets.sprites`, 스프라이트류
    `assets.uploaded`, **EasyRPG charset 텍스처 키**, 번들 스프라이트 역참조와 **등록된 생성 몬스터**를 푼다. 그래서 칩셋 이미지나
    아이콘 id 를 이벤트 그래픽으로 지정한 프로젝트는 **역직렬화를 통과하고 부팅도 되면서 알림만** 뜬다.
    두 집합의 폭이 다른 것이 원인이다 — 알림을 지우려면 저작을 charset 으로 바꿔야 한다.
  - **왜 "크게" 떴는가:** 노드는 `transform: scale(var(--play-scale))` 가 걸린 `.play-stage` 의 자식이다.
    1280×960 에서 `--play-scale=4` 이고, 규칙이 `editor/core.part-1.css` 에 있던 시절(13px·padding 8/12px·
    붉은 테두리) 실측 상자는 화면에서 **1232×292px, 실효 글자 52px** — 뷰포트의 39% 였다. 무대 안에 무엇을
    붙이든 px 는 배율만큼 곱해진다는 것을 잊지 말 것.
  - **지금 계약:** 규칙은 `src/styles/runtime/playSurface.css` 에 있다(플레이어·편집기 양쪽 import 폐포에
    들어 있는 유일한 런타임 시트). 모든 치수를 `calc(<px> / var(--play-scale))` 로 나눠 화면상 크기를 고정하고,
    하단 좌측 코너 칩(실측 385×16px, 실효 글자 10px, `--runtime-glass-*` 다크 글래스)으로 뜬다.
    텍스트는 `resourceDisplayName` 으로 자원 이름을 보여주되 프로필이 없으면 **원본 id** 를 그대로 남긴다 —
    `test/e2e/oprn-map-runtime.spec.ts` 와 `test/runtimeDomMissingResource.test.ts` 가 id 를 단정한다.
    회귀: `test/runtimeDomMissingResource.test.ts`, `test/playerRuntimeCss.test.ts`(빌드된 출하 CSS 에
    `.runtime-missing-resource` 가 실리고 모든 길이 선언이 역스케일되는지). 규칙이 편집기 시트에만 있던 동안 출하 플레이어에서는 스타일
    없는 static 블록이 **1280×272px 로 무대 아래(y=960) 에 깔려 `overflow: hidden` 에 잘려 사라졌다** —
    저작자에게 필요한 신호가 출하물에서 통째로 죽어 있었다.
- **생성 몬스터의 필드 외형 (2026-09-05):** `fieldSpawns.defaultFieldSpawnGraphic`이 첫 적의
  `monsterResourceId`를 넘길 때 `generated-enemy-slime-green` 같은 생성 카탈로그 ID도 그대로 그린다.
  `src/assets/generatedMonsterSprites.ts`는 `builtinGeneratedResourceIds()`의 실제 몬스터 항목만 인정한다.
  일반 URL 해석기의 이름 추측 폴백을 허용하지 않아 알 수 없는 생성 ID는 기존 누락 경고/charset 폴백을 유지한다.
  `loadBundledAssets`는 프로젝트에 참조된 생성 몬스터를 `load.image`로 먼저 읽는다(적 DB 참조만 있고
  필드 이벤트는 아직 생성되지 않은 부팅도 포함). URL은 `resolveAssetResourceUrl`을 거쳐 단일 HTML의
  인라인 자산 표를 따른다. 별도 시트 절단 없이 `__BASE` 프레임을 쓰고, `eventSpriteScale`이 원본 비율을
  유지하며 32×32 논리 px 안에 맞춘 뒤 저작 `graphic.scale`을 곱한다. 프레임/방향 변경으로 시트처럼
  잘라 그리지 않는다. 이벤트·동료·이동 루트 외형 교체에 같은 크기 규칙을 적용한다. 기존 프로젝트
  sprite/upload 정의가 같은 ID를 소유하면 그 정의가 우선한다. 회귀: `test/generatedMonsterFieldSprites.test.ts`
  (실제 PNG 치수, 필드 스폰→렌더, 사전 로딩, 내보내기/인라인, 미등록 ID 경고, 기존 소유권).
- **QA instrumentation is an explicit boot capability (2026-08-28).** `__OPENRPG_BOOT__.qaInstrumentation` → `renderPlayer({ qaInstrumentation })` → `createPlayGame` registry → `PlayScene`. When it is off (every normal exported/community player boot) the runtime installs **no** `__oprnDebug`/`__oprnInput`/`__oprnCamera`/`__oprnPlayerSprite`/`__oprnCharacterSprites`/`__oprnActionCombat`/`__oprnSetActorVitals`/`__oprnSetMediaState` globals, creates **no** `runtime-state-json` / `audio-state-json` mirrors and no `.runtime-debug-marker` hitboxes, and never builds or serializes the broad debug snapshot; `syncRuntimeState` takes a narrow visible-HUD path instead (timer, calendar, picture layer keep working). When it is on, all of that is retained unchanged. Opted in by: `scripts/lib/runtimeQaRun.mjs` (the mandated runtime QA harness depends on `__oprnDebug` for `setSeed`/`teleport`/`readState`), editor play mode (`src/app/mode.ts`), and both editor Test Play modals — those are authoring surfaces, not the shipped player, so the existing editor e2e suite keeps its state dump. Regression: `test/runtimeQaInstrumentationBoundary.test.ts`, `test/runtime/instrumentation-boundary.spec.ts`. The QA `teleport` hook must load a changed destination map **exactly once** — a merge once duplicated that branch and loaded it twice.
- **테스트 플레이 부팅 복구 경로 (2026-08-29):** `player.ts` 는 Phaser 기동 전에 `preflightProjectForPlay` 를 실행한다. 예비검사 차단·ready 타임아웃·부팅 예외의 단일 실패 출구는 `playBootRecovery.describeBootFailure` 의 설명을 받은 `playLoadingOverlay.showRecovery` 다. 고친 프로젝트는 세션 생성에 명시적으로 전달되고 `beginReadOnlyProjectSnapshot` 을 통해 `PlayScene` 에 전달된다. 내보내기 대역 `exportProjectStoreShim` 도 `currentProject` 를 복제 스냅숏으로 교체하며, 멱등 해제 시 다른 교체가 없었을 때만 이전 프로젝트를 복원한다. 안전 모드는 auto/parallel 트리거를 action 으로 낮추고 자율 이동·일정을 제거하되 action 이벤트는 유지한다.
- **엔진 조각 fetch 실패는 재시도·한 번 새로고침 (2026-09-02):** `createPlayGame` 의 `import("@/player/PlayScene")` 와 `startEditGame` 의 `EditScene` import 는 Vite 가 `assets/PlayScene-<hash>.js` 로 쪼갠다. 재빌드 뒤 옛 해시 404 또는 일시적 네트워크면 `TypeError: Failed to fetch dynamically imported module` 가 나고, 브라우저는 그 specifier 의 거부를 페이지 수명 동안 캐시한다 — 복구 「다시 시도」가 같은 `import()` 를 부르면 즉시 같은 화면이 된다. `importWithRetry`(`src/util/dynamicImport.ts`) 가 URL 에 `?t=` 를 붙여 캐시를 우회하고, 그래도 실패하면 `moduleLoadRecovery` 가 sessionStorage 가드로 페이지를 한 번만 새로고침한다(`vite:preloadError` 도 같은 손잡이). Phaser `<script>` 로드 실패도 rejected Promise 를 붙잡지 않는다(`ensurePhaser` 가 손잡이를 비우고 한 번 더 받는다). 회귀: `test/dynamicImport.test.ts`, `test/moduleLoadRecovery.test.ts`, `test/phaserRuntime.test.ts`, `test/playBootRecovery.test.ts`.
- Title/load surfaces, status menu, dialogue UI, save slots, and play shell wiring: start in `src/player/player.ts`, `src/player/playerLoadPanel.ts`, `src/player/playerStatusMenu*.ts`, and `src/player/dialogue.ts`. **Desktop title input contract (2026-08-24):** title options use a single roving Tab stop with stable option IDs; Arrow keys synchronize selected/focused/`aria-selected`, and Z, Enter, or Space takes the selected New/Load/Quit path. Title pointer activation is blocked and no title control crosses the play-input boundary. Touch controls do not auto-mount from device capability; only an explicit `VITE_TOUCH_CONTROLS` / `OPENRPG_PLAYER_TOUCH_CONTROLS` true override enables the mobile pad. Test Play keeps the `320×240` canvas in a centered 4:3 fit-without-crop stage. **Play surface scale mode (2026-08-25):** `calculatePlaySurfaceScale` takes an explicit `PlaySurfaceScaleMode`. `integer` (default, shipped/community player) keeps the whole-number stage; `fit` returns the unfloored contain scale and was what the editor Test Play window passed through `renderPlayer({ surfaceScaleMode: \"fit\" })` until 2026-10-20 (now the project rule `resolvePlaySurfaceScaleMode` decides; legacy 320×240 projects still get fit) — with integer-only scaling a 1214×640 window drew the game at 640×480, i.e. 27% of the surface. Fractional scaling relies on `image-rendering: pixelated` on the play canvas; do not remove it. **Status menu update (2026-09-05):** See the first section of `runtime-sessions.md`: one inset workbench, visible inert preview, contextual party information, horizontal focus navigation, stable cursor DOM, and `src/player/playerStatusMenuMotion.ts` exit lifetime. The following edge-dock description is historical. **Status menu contract (2026-08-24):** `src/player/playerStatusMenu.ts` is a non-modal edge dock that keeps the map visible, presents six primary entries, and reveals grouped commands progressively. `playerStatusMenuController.ts` owns the nested cancel stack and title-return confirmation; `playerStatusMenuDetailRenderer.ts` owns roving detail focus while preserving life-ledger tab/panel semantics. Keep `src/styles/runtime/statusMenuEdgeDock.css` as an overlay after the base status-menu CSS.
- **이벤트 저장 메뉴 직접 진입 (2026-09-05):** `player.ts`의 `openSaveMenu` registry 콜백은
  `openEventMenu(layout, statusMenu.openSaveMenu)`로 메뉴 종료까지 이벤트를 기다리고 컨트롤러를 호출한다. 컨트롤러가 이전 커서·덮어쓰기 확인·그룹 복귀
  상태를 초기화하고 `mode="function"`으로 저장 슬롯을 즉시 표시·포커스한다. `reset()` 후
  `renderMenu(undefined, "save")`만 호출하면 메인 레일에서 시스템만 선택되고 상세는 `inert` 미리보기에 머문다. 저장 제한(`map.disableSave`, `m2Runtime.access.save`)은 그대로 적용한다. 취소는 덮어쓰기 확인 →
  저장 슬롯 → 메인 레일 → 닫기 순서다. `test/playerOpenSaveMenu.test.ts`는 내보내기 store 대역과 실제
  registry 콜백·DOM keydown 경로로 즉시 표시, Enter/Z 저장, 방향키 이동, 확인 취소·재진입, 저장 제한을 검증한다.

- **Blocking text/input lifetime (2026-09-08):** `DialogueTextRequest.signal` aborts text with `AbortError`. Hide, close, and surface replacement cancel pending text too; successful page completion still schedules the normal exit. Cancellation detaches keys and cancels entry/typewriter timers. Fresh text advance ignores repeat/composition/text-entry targets and consumes its accepted key. `eventInput.waitForEventKey(signal)` shares the RM2K3 key-code mapping between field and battle input waits, removes its capture listener on settlement, and consumes the accepted event. Field input waits subscribe to shutdown/destroy and verify the captured session before resuming the interpreter. Social gift/talk feedback follows the same ownership rule: cleanup must not reset input/running state or close dialogue after session replacement or scene deactivation, and an abandoned original talk must not grant friendship or open follow-up text. Public `runEvent` consumes only lifecycle `AbortError` (replaced session or inactive scene); genuine failures and active-scene aborts still reject. Contracts: `dialogueTextCancellation`, `playSceneInterpreterCutsceneSkip`, `socialDialogueCancellation` (real DialogueUI and keyboard input through `PlayScene.runEvent`).
 **Export portrait URL contract (R13, uploaded faces 2026-10-27):** `safeResourceImageUrl` accepts resolver-produced HTTP(S) PNG/JPEG/WebP/GIF URLs, root paths with those extensions, PNG/JPEG/WebP/GIF base64 data URLs, and extensionless uploaded-asset addresses (`oprn-asset://<project>/<sha256>`, `/__oprn/asset/.../<sha256>`). Quoted-CSS escape characters and unsafe schemes (`javascript:`, `file:`, `blob:`, SVG) stay rejected. `inlineAssetStore` still owns deployment-base/inline resolution, so do not strip export subpaths in dialogue. `test/dialogueImageUrls.test.ts` exercises real `createDialogueUI` with editor-root, root/nested/encoded exports, inline assets, and uploaded-asset addresses. Dedicated-player image-load proof: `.omo/evidence/dialogue-face-url-r13/README.md`.
- Dialogue escape parsing/playback is owned by `parseDialogueText` + `createDialogueUI` in `src/player/dialogue.ts`, with zero-width controls preserved through `dialoguePagination.ts`. `\v[n]`, `\n[n]`, and `\c[n]` resolve variables/actor names/colors; `\s[n]` sets a clamped 1–20 typing delay (`n × 8ms`); `\.`/`\|` wait 250/1000ms; `\!` pauses until an advance key; `\>`/`\<` enter/leave instant typing; `\$` opens a live-session gold window; and `\^` closes after typing without another input. `\_` becomes a half-width space and `\\` remains a literal backslash. Raw escape syntax must never render in play or the editor preview. When speaker is set, createDialogueUI mounts a floating nameplate (.speaker.speaker-nameplate, testid dialogue-speaker) on the dialogue box rim so the name is visually separated from chat body text. The runtime uses the `--runtime-dialogue-*` dark-glass token family: speaker names mount as compact rim tabs; normal faces stay 48×48 chips drawn from one file per face (no sheet cropping); bust/full resources are stage-logical fixed sizes with left/right text reservation; choices, number input, gold, transparent mode, and top/center/bottom placement remain variants of the same component. Keep `dialogueBodyWidth` deductions synchronized with CSS padding, border, chip gap, and bust/full reserves.
- **초상 모드·출하 글꼴 (2026-10-04).** `project/facePresentation.ts`가 리소스 이름의
  얼굴/흉상/전신 규약을 소유한다. 편집기 `faceDisplayModeOf`와 플레이어 `dialoguePortraitMode`,
  조수 검색의 `portraitMode` 필터가 공유한다. 명시한 presentation은 이 규약보다 우선한다.
  웹·단일 HTML의 `exportEntry.startPlayer`도 `syncProjectFontTheme(project)`를 호출한다.
  편집기 boot만 호출하면 출하 게임의 `system.fonts`가 무시된다. 공통 토큰과 runtime 별칭은
  문서 루트에서 연결한다. 대화창 `joseon`은 스타일 목록과 공유 CSS에 등록하며 기존 페이지 계산을 쓴다.
- **대화창 연출 계약 (2026-08-30).** 「문장 표시」의 `emotion` 은 감정 태그가 아니라 **연출 프로파일 선택자**다.
  `src/player/dialoguePresentation.ts` 가 순수 모델(5종 표 + `reducedMotion` 주입)을 갖고, `dialogue.ts` 는
  프로파일을 상자에 `data-dialogue-emotion` / `-phase` / `-motion` / `-shake` / `-flash` / `-charReveal` 과
  `--dialogue-*-ms` 인라인 변수로 심는다. **지속시간의 진실 공급원은 TS 뿐이다** — CSS 는
  `animation-duration: var(--dialogue-enter-ms)` 로 받아 쓴다(`battleTransition.ts` 는 TS/CSS 이중 기재로
  close 가 260 vs 190 으로 어긋나 있다. 반복하지 말 것). `:root` 폴백이 없으면 var() 가 무효가 되어
  `animation-duration` 이 0s 로 떨어지고 연출이 조용히 죽는다.
  - 연출 상태는 **반드시 상자(.dialogue-box)에** 얹는다. 오버레이는 `resetOverlay()` 가 `className` 을
    통짜로 대입하는 자리라 매 대사마다 지워진다.
  - 생명주기: `cleanup()` 은 상자를 즉시 파괴하지 않고 `phase="exit"` 로 바꾼 뒤 퇴장 길이만큼 **제거를 예약**한다.
    다음 `showText` 는 예약을 취소하고, **진입 시점에 오버레이가 비어 있었을 때만** 진입 연출을 재생한다
    (`overlay.firstChild` 유무가 곧 세션 경계다). 연속 대사는 같은 tick·페인트 전에 예약을 취소하므로
    팝업이 매 줄 반복되지 않고, `wait` 가 끼면 예약이 만료돼 창이 닫히고 다음 대사가 새 세션이 된다.
  - `hide()` 는 **즉시 컷**(맵 전환처럼 창이 남으면 안 되는 자리), `close()` 는 퇴장 연출 후 비움(세션 종료).
    `isDialogueUi`(`playSceneDom.ts`)·`isDialogue`(`playerGuards.ts`) 는 `close` 를 필수로 검사한다 —
    빠진 객체를 통과시키면 이벤트 큐가 끝나는 `finally` 에서 TypeError 가 난다.
  - 상자 keyframes 는 **가로로 커지지 않는다**(`scaleY` 만 쓴다). 전폭 상자를 가로로 부풀리면 1280 뷰포트에서
    좌우 여백 16px 하한이 깨져 `test/e2e/dialogue-modern-skin.spec.ts` 가 무너지고, 대칭으로 몇 px 벌어지는
    변화는 눈에 잡히지도 않는다. `test/dialoguePresentationCss.test.ts` 가 이 제약을 잠근다.
  - **본문은 증분 렌더러가 그린다** (`src/player/dialogueTextRenderer.ts`). 예전 경로는 글자가 하나 늘 때마다
    `clearChildren` + 전량 재생성이라 **이미 떠 있던 글자의 노드까지 매 틱 교체**됐고, 그래서 글자별 CSS
    애니메이션이 프레임마다 처음으로 되감겼다 — 글자 연출을 붙일 수단이 아예 없었다.
    `mountDialoguePage(bodyEl, segments)` 는 페이지마다 새로 마운트하고 `reveal(n)`/`revealAll()` 로
    **뒤에만 덧붙인다.** 이미 붙은 노드는 절대 건드리지 않는다(회귀: `test/dialogueTextRenderer.test.ts` 의
    노드 동일성 단정 + `test/dialogue.test.ts` 의 배선 단정). 선택지·프롬프트는 타이핑이 없으니 일괄
    `renderDialogueSegments` 를 그대로 쓴다(색이 같은 글자를 한 노드로 묶는다).
    - 페이지 전체를 미리 깔고 `opacity:0` 으로 숨기지 **않는다**. 그러면 `.body.textContent` 가 항상
      페이지 전문이 되어 타이핑 회귀 테스트와 스크린 리더가 본문 전체를 먼저 읽는다. 덧붙이기 방식은
      되감김만 정확히 없애고 그 계약은 건드리지 않는다. 리플로 걱정도 없다 — 줄바꿈은 페이지네이터가
      명시 `"\n"` 으로 확정했고 글자는 줄 오른쪽으로만 늘어난다.
    - 글자 연출은 **opacity 만** 쓴다. span 은 인라인 박스이고 인라인 박스는 `transform` 을 무시한다.
      `inline-block` 으로 바꾸면 픽셀 폰트의 베이스라인·줄높이와 줄바꿈 단위가 흔들린다.
    - 글자 연출은 phase 게이트를 걸지 않는다 — 이름표·초상화와 달리 글자는 새로 붙을 때마다 재생되는 것이
      정상이다. 대신 `data-dialogue-char-reveal="1"` 이 게이트고, `reducedMotion` 이면 TS 가 아예 심지 않는다.
      건너뛰기로 한꺼번에 붙는 글자는 `dialogue-char-instant` 로 연출을 뺀다(수십 자가 동시에 밝아진다).
    - 감정별로 변하는 것은 글자 **간격**(`charDelayScale`)이고 한 글자의 페이드 길이는 고정이다 —
      그래서 `--runtime-dialogue-char-ms` 는 이름표 길이와 같은 이유로 TS 가 아니라 `:root` 가 갖는다.
      `\s[n]` 로 명시한 속도는 배율 없이 그대로 이긴다.
  - **화면 단위 연출은 스크림(`.dialogue-scrim`)이 갖는다.** 이 엘리먼트는 `.dialogue-overlay` 의
    **형제**로 `.play-stage` 에 붙는다(z-index 38 — 존 피드백 30 위, 창 39 아래). 오버레이 안에 두면
    화면을 덮을 수 없다 — `position-top`/`bottom` 에서 높이가 화면의 27% 뿐이다. 크롭 inset 은
    `runtime/playSurface.css` 의 `.play-stage > .dialogue-overlay` 목록에 같이 실어 맞춘다.
    익스포트 플레이어(`surfaceScaleMode: "integer"`)로 실측한 결과 **따라갈 크롭이 실은 없다**
    (2026-08-30): 정수 배율은 `Math.floor(containScale)` 이라 무대가 뷰포트를 넘지 못하고
    (`playSurfaceScale.ts:39`) `--play-crop-*` 이 네 변 모두 0 이며, 스크림 사각형이 `.play-stage` 와
    완전히 같다. 남는 여백은 레터박스이고 `.play-stage` 밖이라 스크림이 칠할 경로가 없다.
    목록에 든 것은 cover/crop 모드가 생길 때를 위한 대비다.
    - 평평한 전면 디밍이 아니라 **창이 있는 쪽으로 몰린 비네트**다. 28% 전면 디밍은 모든 대사에서
      맵을 통째로 탁하게 만든다. 위치 클래스(`position-top/center/bottom`)를 스크림에도 실어 방향을 맞춘다.
    - 디밍과 플래시는 각각 `::before`/`::after` 에 둔다. 스크림 자신의 `opacity` 를 애니메이션하면
      놀람의 플래시가 그 값에 눌려 흐려진다(스크림 페이드와 플래시가 동시에 시작한다).
    - 흔들림(분노)은 `[data-dialogue-shake="1"][data-dialogue-phase="shown"]` 게이트다. 진입과 같은
      `phase="enter"` 규칙에 얹으면 둘이 `transform` 을 다투고, **세션 중간의 분노 대사는 진입 없이
      `shown` 으로 뜨므로 아예 흔들리지 않는다.** 좌우 진폭은 3px 로 묶는다 — 전폭 상자의 좌우 여백
      하한이 16px 이고 `test/e2e/dialogue-modern-skin.spec.ts` 가 그 값을 잰다.
      화면 흔들기를 Phaser 카메라(`playSceneMapCommands.ts`)로 하면 DOM 대화창에는 안 먹는다.
    - `reducedMotion` 은 흔들림·글자 등장·플래시를 없애고 **스크림 디밍은 남긴다** — 움직임이 아니라
      분위기·대비 신호다. 이 셋은 phase 가 아니라 자기 dataset 으로 게이트되므로 enter/exit 안전망이
      닿지 않아 미디어쿼리 안전망을 따로 갖는다.
  - `createDialogueUI(host, schedule?)` 의 `schedule` 은 테스트용 타이머 주입 구멍이다
    (`createBattleTransition(host, schedule)` 과 같은 형태).
- **자율 이동 등록·복귀 (2026-08-27 실측 수정, 2026-09-17 속도 계약 추가).** 페이지 이동(무작위/접근/추격/사용자 지정/생활)은
  `src/player/playScenePageMoveRoutes.ts` 의 `registerPageMoveRoutes` 가 등록하고
  `src/player/playSceneAutonomous.ts` 가 매 프레임 굴린다. 다섯 가지 함정이 있다.
  (1) 재등록 판정은 `pageMoveRouteKeys`/`pageMoveRouteEventIds` **와 무버 생존**을 함께 봐야 한다.
  키만 보면, 이동 루트 명령이나 `npcSchedules` 의 teleportNpc 가 무버를 지운 뒤 "이미 등록됨" 분기로
  들어가 NPC 가 맵 재로드까지 영구히 멈춘다(회귀: `test/runtimePageMovementAfterCommandRoute.test.ts`).
  (2) 플레이어 상대 이동(접근/도주/추격)의 위치 조회는 `eventPositions` → `session.eventLocations` →
  원본 이벤트 순이어야 한다. `map.events` 만 보고 못 찾을 때 플레이어 좌표로 대체하면 dx=dy=0 이 되어
  필드 스폰 몬스터와 `spawnEvent` 산출물이 한 칸도 움직이지 않는다(회귀: `test/runtimeSpawnedEventMovement.test.ts`).
  (3) 시간표 무버는 `commandMoveRouteEventIds` 에 들어가 페이지 이동 등록을 막는다 —
  일정이 있는 NPC 에게 이동 유형을 줘도 시간표 구간에서는 무시된다. 의도된 우선순위지만 저작자에게 보이지 않는다.
  (4) 명령 이동(`registerAutonomousMover`)은 페이지 `movement.speed/frequency` 를 물려받아 무버를 만든다 —
  하드코딩 기본값 3 으로 만들면 페이지에서 8(빠름)을 골라도 명령 구간은 400ms/칸으로 걷는다.
  (회귀: `test/runtimeEventPageMovement.test.ts` 의 명령 무버 속도 계승).
  (5) 시간표 무버는 걷는 속도는 페이지 값을 유지하고 걸음 간격만 80ms 로 좁힌다 —
  `configureScheduleMover` 가 속도를 4 로 덮으면 저작 속도가 시간표 구간에서만 무시된다.
- **주인공 이동은 RPG Maker 식 프레임 정량화다 (2026-09-03).** `src/player/playSceneMovement.ts` 는 deltaMs 를
  60Hz 논리 틱으로 바꾸고(`takeLogicTicks`, 반올림 이월 누적기 → 어느 주사율에서도 1초 = 60틱) 틱마다 RM 의
  `Game_Player.update` 한 프레임을 돌린다: 안 걷고 있으면 그 프레임 입력(또는 강제 루트)으로 걸음을 시작, 그 다음
  이번 프레임 이동을 진행. 걸음은 `round(moveDurationMs / 틱)` 프레임(160ms → 10, 대시 1.8배 → 5)에 **정수
  프레임 카운터**(`moveElapsedFrames`)로 정확히 끝나고, 다음 걸음은 다음 틱에 시작한다. 점프·낙하도 같은 틱으로
  간다(`PlayerHopState.elapsedFrames`). 시간 보간·「남은 시간 이월」·「걸음 이어 붙이기(chain)」는 **없다** —
  이전 시간 기반 구현은 이어 붙이기가 걷는 동안 `moving` 을 한 프레임도 내리지 않아 방향키 탭 래치(peek/deferTaps)와
  겹쳐 키를 전부 뗀 뒤에도 벽까지 걷는 결함을 냈다(출하 경로 실측 y 18→7). 입력(`src/player/input.ts`)도 RM 처럼
  프레임당 한 번 `update()` 로 「지금 눌림」을 읽고, 프레임 사이에 시작·종료한 탭만 1회 엣지로 보충한다. **걷는 중 입력은
  보관하지 않는다** — 한 칸 안에서 눌렀다 뗀 키는 RM 처럼 버려지고, 칸 경계 프레임에 눌려 있는 키만 다음 걸음이 된다.
  틱이 0인 프레임(120Hz 의 절반)에서는 입력을 읽지 않아 엣지가 다음 틱 프레임으로 살아 간다. 테스트 하네스는
  `logicTickAccumulatorMs: 0` 을 줘야 하고, `updatePlayScene(scene, 0)` 은 아무 일도 하지 않는다(프레임이 없다) —
  한 프레임은 `1000/60` ms 다. 회귀: `test/runtimeMovementStability.test.ts`(정량화·RM 입력 계약),
  `test/runtimePlayerHop.test.ts`(프레임 단위 점프·낙하); 출하 경로 프로브 `scripts/qa/probe-runtime-hold-release.mjs`
  ([speed] 1초 유지 = 6칸 + 뗀 뒤 정지 5 시나리오).
- **이벤트 접촉 트리거는 양방향이다.** 충돌 발동 규칙은 `src/project/eventTouchRules.ts` 한 곳에만 둔다
  (`firesOnPlayerCollision`). 이전에는 `playSceneMovement.ts` 와 `src/testing/sceneTestRunner.ts` 가
  규칙을 각자 복사해 두고 어긋나 있었고, `eventTouch` 는 NPC 가 플레이어에게 걸어오는 쪽만 발동했다.
  이동 유형이 정지면 무버가 없으므로 그 트리거는 영원히 실행되지 않았다
  (회귀: `test/runtimeEventTouchPlayerCollision.test.ts`).
- **애니메이션 유형.** `fixedGraphic` 은 프레임을 바꾸지 않는다. `fixedDirection`·`fixedDirectionStep` 은
  자율 이동 중에도 페이지 방향을 유지한다(`playScenePageMoveRoutes` 가 `mover.directionFix`).
  `step`·`fixedDirectionStep`·`fourFrame` 은 서 있을 때도 걷기 주기(왼·가운데·오른·가운데)를 재생한다
  (`updateStoppedStepAnimations`). 무버가 없는 정지 이벤트(횃불·깃발)도 같은 시계로 돈다. 주기는 그 페이지
  이동 속도의 한 칸 시간 절반이다. 걷는 중에는 걸음 프레임이 우선하고, `eventGraphicPatternOverrides` 와
  이동 경로의 애니메이션 OFF 는 덮지 않는다.
- **Action combat runtime:** for real-time action combat (`system.actionCombat` + `map.actionCombat`), routing, pure rule modules in `src/battle/action/`, and scene integration in `src/player/playSceneActionCombat.ts`, see `openwiki/runtime-action-combat.md`.

## 게임 화면의 2층·그림자·4층 (MZ식 4층, 2026-09-24)

`playSceneMapRuntime.renderTiles` 는 칸마다 1층 → 1층 스택 → 2층 → 그림자 → 3층 → 3층 스택 → 4층을 만든다.
2·4층은 `renderRawTile` 로 칩 그대로(지형 쿼터·호수 자동타일·받침 경로 없음). `tilesHash` 에 새 배열이 들어 있어
2층만 바뀌어도 다시 그린다.

- 깊이(`src/player/characterDepth.ts`): `OVERLAY_LAYER_DEPTH_OFFSET = 0.01` 은 같은 묶음 안에서 위 층을 조금 올린다 —
  2층 = `y*2 + 0.01`, 4층 = 그 타일의 3층 규칙 값(`mapUpperTileDepth`) `+ 0.01`. `SHADOW_LAYER_DEPTH_OFFSET = 0.02` 는
  그림자(`y*2 + 0.02`, 2층 위·3층 밑). 설계 초안의 `+0.25` 는 × 가구가 같은 줄 캐릭터 앞으로 튀어서 버렸다.
- **lower 컨테이너(`scene.tileLayer`) 안의 깊이는 명목값이다.** Phaser 컨테이너는 자식 depth 로 정렬하지 않으므로
  실제 순서는 넣은 순서(위 칸 순서)다. 1·2층·그림자는 이 컨테이너라 순서가 곧 그리기 순서다.
- 3·4층은 타일 표시 규칙을 따른다: ★ → `upperTileLayer` 컨테이너(고정, 캐릭터 위), ○ → 캐릭터 밑, × → root 에서
  캐릭터와 y 정렬. 그래서 **같은 칸에 3층 ★ + 4층 ×/○ 이면 3층이 위**다(MZ 도 ★ 를 윗 타일맵에 그린다). 캔버스·에디터는
  순서대로 그려 4층이 위라 이 경우만 에디터와 게임 화면이 다르다. 실측: Rasak p02 (7,4) 한 칸(휴리스틱상 ★ 인 B 칸 위의
  × 나무). 같은 규칙끼리는 4층이 +0.01 위다.
- **벽면 ★ 예외(2026-10-22):** ★ 상층이라도 그 칸의 하층이 막혔고(×) 바로 아래 칸 하층이 밟는 칸이면(엘리베이터 문·벽에 박힌
  문틀의 맨 아래 줄) 고정 컨테이너가 아니라 root 에서 제 줄 + 0.5 로 캐릭터와 y 정렬한다(`playSceneMapRuntime.isWallFaceCell`).
  문턱에 선 사람의 머리가 문틀 밑에 짓눌려 보였다(첫사랑 사무실 승강기, #3231 리뷰). 같은 줄(문 안쪽 칸)은 타일이 이겨 문 안의 사람은 계속 가려진다.
- 통행은 `collision.ts` 의 `cellPassability`(4 → 1, ★ 건너뛰기). 게임 쪽 `canMove`/`isPassable` 이 그대로 쓴다.
- 출하 경로 검증: `npm run qa:runtime -- --scenario rasak-layers --project /tmp/... --out /tmp/...` (Rasak 자료는
  재배포 금지라 프로젝트·PNG 는 저장소 밖). 프레임을 멈추고 같은 수만 밀어 합성 판과 4층 판을 비교했다:
  p01·p28·p27b 픽셀 동일, p27a 채널 1 이하(그림자 알파 반올림), p02 는 위 3층 ★/4층 × 한 칸만 다르다.

## 맵별 16/32/48px 좌표

타일 크기 관련 수정은 [tile-geometry.md](tile-geometry.md)를 먼저 읽는다. 원본 아틀라스 슬라이싱과 맵 월드 좌표, 미리보기 표시 크기를 구분한다.

## ESC skill thumbnails (2026-09-06)

`playerStatusMenuDetails.skillEntryIcon` passes the referenced battle animation's sheet geometry
to `playerStatusMenuDetailRenderer`. Skills show pattern 0, not the whole sprite sheet.
The renderer centers a cell-sized background inside the existing icon box, preserving rectangular
cell proportions and excluding neighboring rows/columns at both list and showcase sizes.
Legacy animations without sheet metadata use 96x96 cells and five columns, matching the editor.
Item/equipment images retain whole-image `contain`; missing animation resources retain their placeholder.
Regression coverage: `test/playerStatusMenuEntryIcons.test.ts`; shipping keyboard/screenshot coverage:
`scripts/qa/runtime/esc-menu.scenario.mjs` (`skills`, `next-skill`, `return-to-items`).

## Recovered head emotes (2026-09-05)

`playSceneEmotes.ts` owns transient target-keyed sprites/timers. Interpreter and parallel/common-event scheduler resume immediately after `showEmote`; gift rank and friendship changes use the same sprite path. Head anchoring follows displayHeight × originY, including hop lift. Replacement, target removal, map change and scene teardown cancel timers/tweens together. `runtimeAssets.json` includes the generated sheet for shipping exports; Phaser preload uses `withInlineAsset` for standalone HTML. `__oprnEmotes` is installed only by the existing QA instrumentation boundary.

Validation: `showEmoteCommand`, `showEmoteCommandBody`, `playSceneEmotes`, `emoteSheet` and `commandContracts/showEmote` tests. `npx tsx scripts/qa/emote-runtime.mts` generates a transient minimal engine contract fixture and runs the shipping-player harness; it does not author/persist a demo game. Read `verify-shots/runtime-qa/emote/SUMMARY.md` first.

## 메뉴 입력·불러오기 배율 (2026-09-05)

`player.ts`의 전역 키 처리기는 IME 조합을 양보하고, 결정/취소 키의 OS 반복을 소비하되 실행하지 않는다. 방향키 반복은 목록 탐색에 그대로 사용한다. 이 가드가 없으면 Z 유지가 아이템 목록→대상→소모를 한 번에 실행하고, X 유지가 닫은 메뉴를 다시 열거나 타이틀 복귀 확인까지 통과한다. 전투 화면은 그 전역 처리기 밖이다(`battle-scene` 은 모달로 양보). `battleDom.ts` 가 직접 키를 읽으며, 한글 IME 의 `Process` 도 `keyboardEventKey` 로 물리 키를 복원해 커서·확인·취소·F·Shift 에 쓴다. `isComposing` 만으로 전투 키를 버리면 칸 밖에서 Z 와 방향키가 죽는다. 글자 자체가 온 조합과 입력 칸의 키는 그대로 둔다.

슬롯 로드처럼 하위 화면에서 메뉴가 직접 닫혔으면, 다시 열 때 `selectedCommand`를 `statusMenuRailIdForCommand`로 레일 항목에 맞추고 이전 그룹을 비운다. 그렇지 않으면 화면은 「시스템」을 선택한 채 결정 키가 숨은 「로드」를 실행해 시스템 그룹으로 돌아갈 수 없었다. 일반 취소로 레일에 복귀할 때도 같은 변환을 쓴다.

타이틀에서 여는 `renderLoad`도 `createPlaySurface`의 stage에 붙인다. layout에 직접 붙이면 논리 px를 화면 px로 그려 3배 게임에서 불러오기만 11px 글자가 된다. surface cleanup·호스트 전체화면 제어도 타이틀과 같은 수명을 갖는다. `runtime/title.css`는 불러오기 창 높이를 stage 안으로 제한하고 저장 칸 목록을 스크롤한다. 긴 오류나 자동 저장 카드가 있어도 제목·뒤로는 남고 키보드 커서가 선택 슬롯을 노출해야 한다.

## 가구 밀기 애니메이션 (2026-09-05)

- **가구 밀기는 주인공 걸음과 같은 틱의 별도 표현 상태다 (2026-09-05).**
  `furniturePushAnimation.ts`와 `playSceneMovement.tryStartFurniturePush`가 소유한다.
  조사/방향 입력 모두 몸과 가구가 같은 곡선으로 한 칸 움직인다. 가구 위치를 갱신했다고
  `refreshRuntimeEntities`를 부르면 순간이동/스프라이트 재생성이 돌아온다. 맵 리셋은 표현 상태를
  비우고 `stopCommandMovement`는 양쪽을 취소해야 한다. 자세한 계약과 연속 프레임 QA는
  `horror-authoring.md`의 「가구 밀기 애니메이션」 절을 따른다.

## Recovered head emotes (2026-09-05)

`playSceneEmotes.ts` owns transient target-keyed sprites/timers. Interpreter and parallel/common-event scheduler resume immediately after `showEmote`; gift rank and friendship changes use the same sprite path. Head anchoring follows displayHeight × originY, including hop lift. Replacement, target removal, map change and scene teardown cancel timers/tweens together. `runtimeAssets.json` includes the generated sheet for shipping exports; Phaser preload uses `withInlineAsset` for standalone HTML. `__oprnEmotes` is installed only by the existing QA instrumentation boundary.

Validation: `showEmoteCommand`, `showEmoteCommandBody`, `playSceneEmotes`, `emoteSheet` and `commandContracts/showEmote` tests. `npx tsx scripts/qa/emote-runtime.mts` generates a transient minimal engine contract fixture and runs the shipping-player harness; it does not author/persist a demo game. Read `verify-shots/runtime-qa/emote/SUMMARY.md` first.

## Saved uploaded tilesets in the actual player (2026-09-14)

`tilesetImage.ts` previously mapped every uploaded atlas to `tex_tiles_default`, while
`loadBundledAssets` preloaded uploaded charsets but no uploaded tilesets. A canvas PNG
could therefore look correct and the player could report the correct map ID while
rendering the bundled exterior's unrelated graphics. Field movement gates did not catch it.

`src/assets/uploadedTilesets.ts` now owns uploaded atlas keys, preload, authored frame
geometry/count, and declared animation registration. `loadBundledAssets` /
`registerBundledFrames` call it for saved project tilesets. Texture identity includes the
asset ID, tile size, columns and count, so two images or slicings do not share frames.
`tilesetImage.ts` resolves that same key; baked uploaded textures also register their own
geometry. Both `chipsetTileRender.ts` and `playSceneMapRuntime.ts` use the matching
`tilesetAnimationKeyForTile` name. Bundled texture/animation rules remain separate.

The fixed entry is project boot/reload with uploaded bytes present. This does not claim
that replacing an uploaded asset in a running scene hot-reloads its existing GPU texture.

Regression: `test/uploadedTilesetRendering.test.ts`; actual player pixel checks, waterfall
frame changes, and the original reference-image proof: `openwiki/emerald-fields.md`.
Do not use matching map IDs or a canvas-export PNG alone as evidence for Phaser rendering.
## 맵 배경(패럴랙스) 렌더 (2026-09-14)

- **`map.background` 는 이제 플레이 화면에 그려진다.** 저작 필드(`imageId`/`scrollX`/`scrollY`)와
  편집기 「맵 배경」 탭은 예전부터 있었지만 **소비자가 없었다** — 비어 있는 칸은 플레이 카메라의
  검은 배경(#000)이었다. 새 모듈은 `src/player/playSceneMapBackground.ts` 하나다.
- **계약 넷.** (1) depth `MAP_BACKGROUND_LAYER_DEPTH = -100_000` — 하층 타일(0) 아래라
  빈 칸이 뚫린 창이 되고 타일이 깔린 칸은 배경을 가린다(「절벽 뒤로 먼 풍경」이 이 순서다).
  (2) `scrollFactor 0` 화면 고정 — 카메라를 따라 흐르지 않고 자기 속도로만 움직인다
  (RM2K3 배경에는 「맵에 맞춰 스크롤」 플래그가 없다). (3) 스크롤 단위는 **60Hz 논리 프레임당 px**
  (`advanceMapBackgroundScroll`). (4) 그림은 무한 반복 타일이다.
  화면 고정 객체는 카메라 줌만큼 확대되므로 `mapBackgroundLayout` 이 위치 `halfSize·(1-1/zoom)`,
  크기 `뷰포트/zoom` 으로 보정한다 — **보정이 없으면 배율 < 1 에서 가장자리에 검은 띠가 드러난다**
  (배율 > 1 은 객체가 화면보다 커져 가려지므로 증상이 안 보인다).
- **텍스처는 공용 로더로 뒤늦게 싣는다.** `src/player/playSceneImageTexture.ts` 가 «같은 키를 두 번
  로드하지 않는다» 를 소유하고, 맵 애니메이션(`playSceneMapAnimations`)과 배경이 같이 쓴다.
  preload(`loadBundledAssets`)에 배경 그림은 없다 — 프로젝트에 참조된 것만 그때 싣는다.
- **이벤트 명령 「먼 배경 변경」(m2-069)도 같은 레이어를 쓴다.** 예전에는 세션에 값만 쓰고
  소비자가 없었다. 이제 `resolveMapBackgroundImageId` 가 **그 맵에 기록된** 오버라이드를 먼저
  본다 — 명령은 맵의 배경을 바꾸므로 `m2Runtime.ts` 가 명령을 실행할 때 `session.currentMapId`
  를 함께 적는다(안 적으면 맵을 건너간 뒤에도 이전 맵의 하늘이 따라온다). `mapId` 가 빈 기록
  (맵을 적기 전에 저장된 세이브)은 모든 맵에 적용한다. 맵을 다시 싣지 않고 명령이 들어오는
  경로가 있으므로 `updateMapBackground` 가 매 프레임 «해석 결과 ≠ 적용/로드 중 id» 를 보고
  그 자리에서 다시 건다 — 그 비교가 없으면 명령이 다음 맵 전환까지 아무 일도 안 한다.
  형제 명령 둘은 **여전히 소비자가 없다** — 「타일셋 변경」(`map.tileset_override`)과
  「인카운터율 설정」(`map.encounter_rate`)은 같은 모양(`{mapId,x,y,value}`)으로 세션에만 적힌다.
  같은 방식으로 붙이려면 «어느 맵에 적용되는가» 를 먼저 정하라(배경은 명령 시점의 현재 맵으로 정했다).

## 맵 배경 다중 레이어 (2026-09-21)

- **`map.background.layers`(최대 3장, optional)가 생겼다.** 기존 계약은 유지된다 — 첫 장은 예전과 같이 `map.background.imageId`가 그리고, `layers` 배열(앞이 아래)이 그 위에 순서대로 얹히는 구조다. `resolveMapBackgroundLayers` 반환 값이 1장에서 최대 4장 스택으로 늘었고, 렌더·시그니처·스프라이트 재사용 로직은 배열 길이에 맞춰 이미 동작한다(스택으로 짜여 있던 렌더러가 그대로 이어받는다).

- **명령 「먼 배경 변경」(m2-069)은 첫 장만 대체한다** — 추가 레이어(구름·산)는 그대로 유지된다. 명령이 구름까지 지우면 빈 자리가 개어 배경이 깨진다.

- **정규화**: `normalizeMapBackgroundLayers`(`src/project/mapBackground.ts`)가 슬라이스·무효 레이어 제거를 담당한다. 유효한 레이어가 없으면 필드 자체를 생략한다(레거시 JSON 바이트 유지).

- **CraftPix 레이어 팩**(OGA-BY 3.0, 35장 — 4세트 × 합성본+레이어)가 `public/assets/oga/craftpix-horizontal/` 에 들어갔다. 등록은 `src/assets/ogaCraftpixBackgrounds.ts`, 참조 검증·피커·검색에 같이 연결됐다. 편집기 「맵 배경」 탭의 **레이어 세트 선택**(map-bg-layer-set)이 세트를 통째로 얹는 정규 경로다. 합성본은 레이어 합성과 픽셀 수준에서 정확히 대응하지 않는다(업스트림 리샘플 흔적, 불일치 14~21%)—합성본을 레이어 대용으로 쓰면 미묘한 차이가 남는다.

- 참조 검증(`resourceReferenceValidation`)에 카탈로그 35개 id를 등록했다 — 빠지면 역직렬화가 던진다.

- **편집기 캔버스 미리보기도 스택 전체를 그렸다(2026-09-21).** EditScene 미리보기가 첫 장만 그리던 것을 플레이와 같은 구조(첫 장 + layers, depth 순서)로 바꿨다. 저작 화면의 검증 경로(카드 피커 → 적용 → 캔버스 토글)에서 게임 상태를 그대로 보는 것이 증거로 고정됐다: verify-shots/layer-set-picker/evidence-0*.png. 인게임 하늘색 (83,188,198) = CraftPix pines sky.png 원본과 일치.

- **fit(그림 맞추기)이 생겼다 — 없으면 큰 배경 아트가 화면 밖으로 나간다(2026-09-21 실측).** CraftPix 레이어 아트는 1920x1080인데 게임 논리 뷰포트는 320x240이다. 1:1로 그리면 아트 좌상단 22%만 보이고 지면(rocks_1 아트 y=747)과 나무(pines y=953)는 240px 창에 들어올 수 없다. fit: "cover"는 뷰포트를 덮는 최소 배율(16:9 → 4:3이면 240/1080 = 0.2222)로 그린다. native(기본)는 배율 1이라 였 프로젝트 픽셀이 바뀌지 않는다. EasyRPG 640x480 파노라마도 같은 결함이 있었다(절반만 보임).
- **스크롤 단위와 tilePosition의 관계**: 저작 스크롤은 논리 px/프레임이고 Phaser의 tilePosition은 타일 배율 단위다. 배율 0.2222에서 논리 60px를 움직이려면 tilePosition을 270 올려야 한다(mapBackgroundTilePosition).
- **레이어 상한이 3에서 8로 올랐다.** CraftPix 세트는 5~9장이라 3장 상한이면 소나무 숲(9장)이 4장으로 잘려 나무와 새가 빠졌다.
- **고해상도 + 확대 = 도트 개선의 정석(2026-09-22).** 해상도는 픽셀 밀도이고 보이는 범위는 카메라 배율이 정한다. 캔버스 크기를 올리면 CSS 변환이 그만큼 줄어 화면에 보이는 픽셀 수가 같다(실측: 320x240은 matrix(4,0,0,4), 1280x960은 matrix(1,0,0,1), 둘 다 표시 1280x960). 해상도만 올리면 도트만 선명해지고 시야는 그대로다.
- 배경 아트를 무손실(1:1)로 쓰는 해: 1920x1080 아트에 **1440x1080 + 배율 4.5**. 1440/(16x4.5)=20타일, 1080/72=15타일로 320x240과 동일 시야이고, 배경 배율 0.2222x4.5=1.0이다. 그래서 배율 상한을 4에서 6으로 올렸다(CAMERA_ZOOM_LIMITS, src/player/playSceneCamera.ts). 상한 4로는 시야가 22x17이 되어 클래식과 어깋난다. 증거: verify-shots/layer-set-picker/OPTIMAL-*.
- **프로젝트 기본 카메라 배율 system.cameraZoom(2026-09-22).** 줌은 원래 연출 상태(session.camera.zoom, 이벤트 명령 m2-201)로만 존재했다. 그래서 고해상도 배경을 1:1로 쓰려면 맵마다 auto 이벤트를 심어 줌을 걸어야 했고 새 맵에서는 1로 돌아갔다. 이제 기본값은 프로젝트가 정하고(생략=1, 1은 저장 안 함) 연출 명령은 그 위에 일시적으로 덮어쓴다.
- 적용 지점: applyStoredCameraState 가 세션 상태가 없을 때 resolveCameraZoom(store.system) 을 쓴다(예전에는 centerRuntimeCamera가 1로 리셋한 값이 그대로 남았다). 배율 범위의 정본은 src/project/cameraZoom.ts(CAMERA_ZOOM_LIMITS 0.25~6)이고 런타임이 그것을 import 한다 — 둘이 달라지면 「저장은 됐는데 플레이에서는 다른 배율」이 된다.
- AI: set_project_settings.cameraZoom(0.25~6). 해상도와 함께 서야 시야가 유지된다 — 1440x1080 + 4.5 → 20x15타일(320x240과 동일). 증거: verify-shots/layer-set-picker/SYSTEMZOOM-*.
- **파노라마는 창 타일에서만 보인다 — RM2K 방식으로 바꿨다(2026-09-22).** 이전에는 하층 타일이 없는 칸이 전부 뚫린 창이 되어 배경이 다 보였다. RM2K 는 반대다: 배경은 레이어 뒤에 깔리고 **완전 투명 타일(파노라마 창)을 깐 칸에서만** 비치며 빈 칸은 가려진다.
- 창 타일 정본: scripts/generateChipsetTransparency.mjs 가 알파가 모든 픽셀에서 0 인 칸을 따로 뽑는다 → COMBINED_TOWN_PANORAMA_WINDOW_TILES(합본 마을은 #233·#258 두 칸, 원래 "빈 슬롯"이던 자리). 판정은 isPanoramaWindowTile(chipsetMapping).
- 가리기: playSceneMapRuntime 의 renderEmptyCellCover 가 하층이 비어 있고 창 타일도 없으면 카메라 배경색 사각형을 깐다(배경 -100k 위, 하층 타일 0 아래). 빈 칸이 있는 맵에서만 만들고 컬링 추적에 넣는다.
- 인게임 실측(같은 행): 빈칸 (0,0,0) 검정 / 창233 (83,188,197) 하늘 / 잔디240 (84,176,67) 잔디. 증거 verify-shots/layer-set-picker/WINDOW-rm2k-panorama.gif.
- 편집기 캔버스는 체커가 "바닥 없음" 신호라 이 계약을 그대로 그리지 않는다(미리보기 토글도 창 판정을 반영하지 않음) — 캔버스에서 창을 눈으로 확인하려면 별도 작업이 필요하다.
- **아직 안 되는 것(알고 있어야 할 경계).**
  - 편집기 **캔버스**는 배경을 그리지 않는다. 빈 칸은 `editSceneRender.createEmptyTile` 의
    **불투명** 체커 사각형이고, 그 체커는 "여기 바닥이 없다" 를 보이게 하는 **의도된 신호**
    (2026-08-27, 사용자가 유지를 요구)라 배경을 보이게 하려면 그 신호를 약화시켜야 한다 —
    그래서 캔버스는 건드리지 않았다. 배경을 눈으로 확인할 자리는 「맵 배경」 탭의 미리보기
    (`map-bg-preview`, `mapProps.renderBackgroundTab`)와 플레이 화면이다.
  - AI 검수 표면(`show_map_region` 타일 프리뷰)도 못 그린다 → `mapVisualEvidenceUnavailable` 의
    거부는 **유지**한다(런타임이 그린다는 이유로 풀면 안 된다).
  - 내보내기는 배경 PNG 를 **이미 싣는다**(실측 2026-09-14: 빈 프로젝트도 배경 프로필 13개를
    등록해 내보내기 자산 688개에 `assets/easyrpg/backdrop/*.png` 가 들어 있다). 그래서 이 기능에
    내보내기 자산 작업은 필요 없었다 — `runtimeAssets.json`(플레이어 SDK 목록)은 별개다.
    회귀: `test/webExportMapBackground.test.ts` 가 «런타임이 만드는 URL = 내보낸 경로» 와
    스탠드얼론 인라인 표 치환을 잠근다.
- **검증.** 단위: `test/mapBackgroundRuntime.test.ts`(depth·배치·스크롤 단위·로드 1회·프레임 진행·
  명령 오버라이드 우선/맵 한정/예전 세이브) + `test/webExportMapBackground.test.ts`(내보내기 경로).
  출하 표면: `npm run qa:runtime -- --scenario map-background`. 픽스처 생성기
  `scripts/qa/runtime/map-background-fixture.mjs` 가 시작 맵 위 6행을 비워 하늘 띠를 만든다 —
  `--no-background`(대조군) · `--zoom 0.5`(배율 보정) · `--override-id <id>`(이벤트 명령 경로).
  샷 비교는 `scripts/qa/runtime/map-background-diff.mjs`. 2026-09-14 실측:
  하늘 띠 평균 RGB 4,3,2 → 32,96,200(대조군 → 배경), 타일 띠 차이 0.0000(배경이 타일을 덮지
  않는다 = 절벽 뒤에만 보인다), 배경 띠 차이 0.9773, 프레임 60개 스크롤 이동 −387px(논리 129px,
  프레임당 2.0~2.1px — 저작 scrollX 는 2px/프레임이고 Phaser TimeStep 이 61~63 프레임을 돈다),
  배율 0.5 가장자리 검은 비율 0, 그리고 `map.background` 없이 명령만으로도 하늘이 뜬다
  (`verify-shots/runtime-qa/map-background-command/`).

## 맵 배경 깊이(카메라 따라가기)·흐름 배율 — 회상 파노라마 (2026-09-27)

- **층마다 `cameraFollow`(0..2, 생략=0)가 생겼다** — `map.background.cameraFollow`, `layers[].cameraFollow`.
  0 은 예전 그대로 화면 고정(RM2K3), 1 은 타일과 같이, 1 초과는 타일보다 빨리 지나가는 전경. 층마다 다르게 주면
  시차(패럴랙스) 스크롤이다. 정규화·상한은 `src/project/mapBackground.ts`, 편집기 입력(%)은 `mapProps.renderBackgroundTab`,
  AI 스키마는 `mapTools.backgroundSchema` — 셋이 같은 상수를 본다.
- **카메라 몫은 맵에 들어온 순간의 카메라 위치 기준이다**(`scene.mapBackgroundCameraAnchor`, `syncMapBackgroundLayers` 가
  loadMap 때 지운다). 절대 스크롤이면 들어오는 자리에 따라 그림이 달라진다 — 실측: 30행 맵 바닥에서 시작하면 scrollY 240 × 깊이만큼
  모든 층이 위로 밀려 산·호수가 화면 밖으로 나갔다. 「먼 배경 변경」 으로 그림만 바뀌면 기준점은 유지한다(층이 튀지 않게).
- **카메라 추적은 Phaser `preRender` 에서 확정된다** — `update` 에서 읽은 scrollX 는 한 프레임 늦다. 그래서 카메라 `followupdate`
  에서 깊이 있는 층을 한 번 더 맞춘다(`realignMapBackgroundToCamera`). 자동 흐름 누적은 tilePosition 이 아니라 스프라이트별
  WeakMap 에 둔다 — tilePosition 에는 카메라 몫이 섞여 있다.
- **레이어 세트를 고르면 기본 깊이가 들어간다**(`defaultLayerCameraFollow`: 하늘 0 → 맨 앞 0.7, 0.05 눈금). 1 을 주지 않는
  이유: 세트의 맨 앞 층도 타일 뒤 풍경이라 1 이면 벽지처럼 붙어 움직인다.
- **명령 「먼 배경 변경」(m2-069)에 `flowPercent`(0..400, 100=저작 속도)·`flowDurationMs` 가 생겼다.** 세션 기록은
  `m2Runtime.map.parallax_flow`(값 `"<percent>|<ms>"`, 그 맵 한정 — `parallax_override` 와 같은 규칙). 렌더러가 지금 배율에서
  목표까지 선형 전환한다(`scene.mapBackgroundFlow`). 흐름 필드가 있는 명령에서 그림을 비우면 **그림 유지**(속도만 바꾸기),
  흐름 필드가 없는 예전 명령은 예전 그대로 빈 그림 = 저작 그림으로 복귀. 흐름은 자동 흐름(scrollX/Y)에만 걸리고 깊이에는 안 걸린다.
  세이브 슬롯은 이 그림·흐름 두 기록만 싣는다(`session.mapBackground`, 2026-10-25). 흐름 100%와 빈 그림은 적지 않고,
  깨진 값은 슬롯을 손상으로 보지 않고 그 필드만 버린다. 불러오면 장면 보간이 없으므로 목표 배율로 바로 선다.
  타일셋 변경·인카운터율처럼 소비자가 없는 `m2Runtime.map` 기록은 여전히 세이브에 넣지 않는다.
- **고친 기존 결함: `fit:"cover"` 가 플레이에서 한 번도 적용되지 않았다.** Phaser 3.60+ TileSprite 는 `texture` 가 자기 채움
  캔버스(키 uuid, 스프라이트 크기 320×240)이고 원본은 `displayTexture` 다. `texture.key` 로 원본 크기를 읽어 cover 배율이
  늘 1 이었다(1920×1080 아트의 좌상단만 확대되어 보임). 같은 이유로 「그림이 바뀌었나」 비교가 늘 참이라 맵을 다시 실을 때마다
  흐름 위상이 0 이 됐다. `displayTextureKey()` 로 고쳤다. 단위 테스트 스텁은 `texture.key` 만 있어 이 결함을 못 잡는다.
- **알아 둘 것:** 기존 `map-background` 시나리오 픽스처는 빈 칸(-1)으로 하늘 띠를 만든다 — RM2K 창 규칙(2026-09-22) 이후로는
  그 띠가 검게 가려져 배경을 증명하지 못한다(게이트는 샷 비교를 안 해서 통과한다). 창 타일(#233)로 바꿔야 한다.
  CraftPix 세트 이름도 그림과 어긋난다: `oga-craftpix-cliffs`(bg3)는 밤 소나무 숲, `oga-craftpix-pines`(bg2)는 낮 산이다.
- **조수 경로(같은 날, 두 번째 PR 단계).** 조수가 이 기능을 스스로 찾아 쓰도록 도구 계층을 이었다.
  - `set_map_properties.background.layerSet`(+`cloudDrift`) 한 칸이 세트를 편다 — 순서·`fit:"cover"`·층별 기본 깊이.
    편집기 「레이어 세트」 도 같은 `mapBackgroundFromLayerSet` 를 쓴다(예전 편집기 적용은 cover 를 안 넣었다).
    예전 스키마는 `fit` 이 없는데 `additionalProperties:false` 라 조수는 cover 를 줄 방법이 없었다.
  - `background.showInEmptyCells`(맵 저작값, 기본 false) — 빈 칸에서도 배경을 비춘다. 창 타일(#233·#258)은 **합본 마을
    칩셋에만** 있어서 숲마을·기후 시트 맵은 이것 없이는 배경을 보일 길이 없다. 렌더 판정은 `renderEmptyCellCover`.
  - `set_map_properties.clearForBackground{x,y,width,height}` 가 사각형의 모든 타일 층을 비운다(하늘 자리).
  - 배경을 설정했는데 비칠 칸이 0 이면 `diff.warnings` 로 알린다(`backgroundVisibleCells` — 렌더러와 같은 판정).
  - `script_cutscene` 에 `background{flowPercent,imageId?,durationMs,wait}` 비트 → m2-069. 컷신 끝(건너뛰기 착지 뒤)에서
    마지막 흐름·그림을 전환 없이 다시 건다(색조 비트와 같은 규칙).
  - 세트 표시 이름을 그림에 맞췄다(id 는 그대로): pines=낮 산등성이, cliffs=밤 소나무 숲, ridge=폭포 계곡. 세트마다 `summary`
    한 줄이 도구 스키마 설명에 들어간다 — 조수는 이름·요약만 보고 고른다.
  - `find_tools` 가 「파노라마 배경」「먼 배경」「시차 스크롤」「회상 장면」「parallax」 로 두 도구를 찾는다(2026-09-27 실측).
- **검증.** 단위: `test/mapBackgroundRuntime.test.ts`(깊이 기준점·층별 이동량·흐름 전환·다른 맵 무시),
  `test/mapBackgroundAssistantTools.test.ts`(layerSet 펴기·fit·0칸 경고·없는 세트·컷신 background 비트·script_cutscene 경유),
  `test/mapBackgroundRules.test.ts`(정규화·왕복·기본 깊이·흐름 인코딩). 출하 표면 GIF:
  `npx tsx scripts/qa/runtime/map-parallax.capture.mjs` → `verify-shots/map-parallax/map-parallax.gif`
  (구름 언덕 7장, 60×30 맵, 창 타일 하늘, 30칸의 밟는 이벤트가 세피아 색조 + 흐름 0%/2500ms).
  `--project <조수가 만든 project.json>` 을 주면 그 프로젝트의 시작 칸에서 오른쪽으로 걸으며 찍는다.

## 맵 배경 사용성 — OPRN 자체 파노라마 견본·움직임 프리셋·게임 화면 미리보기 (2026-10-21)

**감사 결과(이전):** 2026-10-07 저작권 정리로 CraftPix·greggman·EasyRPG 배경이 빠져 「레이어 세트」 창은 비었고
(`OGA_CRAFTPIX_BACKDROP_SETS = []`, 조수 스키마 `layerSet` enum 도 빈 배열), 그림 고르기에는 전투 배경 세 장만 남았다
(하늘·노을·바다·별 없음, 고르기 창에 올리기 없음). 남은 칩셋에는 창 타일(#233·#258)이 없는데 `showInEmptyCells` 기본이 꺼져 있어
**편집기 미리보기는 하늘을 보여 주는데 플레이는 검은 칸**이었다. 기본 20×15 맵은 풀로 꽉 차 있어 지우기 전엔 0칸.
편집기 캔버스 미리보기도 플레이와 같은 `displayTexture` 함정(모서리만 확대)과 편집기 뷰포트 기준 배율을 갖고 있었다.
처음 쓰는 사람이 숲 전투 배경 한 장을 플레이에서 보기까지 약 5분 47초(실측, 단계별 시간은 `~/claude-viz/panorama-usability-1.html`).

**지금:**
- **견본 다섯 세트** `src/assets/oprnPanoramas.ts` — 맑은 하늘·노을(옆에서 본 지평선 640×240, cover 로 320×240 에 배율 1),
  밤하늘·별·바다·구름 바다(위에서 본 면, 사방 이음매 없음, native). 코드 손 도트, 생성기 `scripts/content/panoramas/bake_panoramas.py`
  (결정적, 그림 `public/assets/panoramas/`). 세트마다 층별 권장 흐름·깊이가 들어 있고 `mapBackgroundFromPanoramaSet` 가
  **`showInEmptyCells:true` 로 편다**. 지평선(노을의 해·도시 실루엣, 맑은 하늘의 구름)은 **화면 위쪽 절반·가운데 320px(그림 x 160..480) 안**에 둔다 —
  배경은 화면 고정이라 지붕·절벽 위 윗줄 몇 칸만 비우면 그 위쪽만 비친다(처음 굽기는 해가 맨 아래·x=430 이라 윗줄을 비워도 어두운 보라뿐이었다).
  **「화면에 맞춤」 은 넘치는 축을 가운데 맞춘다**(`mapBackgroundCoverCentre` — 플레이·탭 미리보기·캔버스 공통). 예전에는 왼쪽 위에 붙어 16:9 그림의 오른쪽 1/4 이 늘 잘렸다.
  등록: 자원 해석기·참조 검증·고르기(맨 앞)·검색. 내보내기는 `resolveAssetResourceUrl` 로 자동으로 실린다.
- **움직임 프리셋** `MAP_BACKGROUND_MOTIONS`(`src/project/mapBackground.ts`): 고정·느린 시차(층마다 깊이 0.1→0.5)·가로 흐름·세로 흐름·타일과 같이(깊이 1).
  `applyMapBackgroundMotion` / `detectMapBackgroundMotion`. 숫자 칸은 「세부 조정」 접힘 안으로 옮겼다.
- **비칠 칸 판정** `src/project/mapBackgroundVisibility.ts` — 렌더러 `renderEmptyCellCover` 와 같은 규칙. 창 타일은 합본 마을 칩셋에서만 센다.
  탭의 「플레이에서 N칸에 보입니다 / 한 칸도 안 보입니다」 줄과 고치기 단추, 조수 0칸 경고가 같은 함수를 본다.
- **편집기 「맵 배경」 탭** (`mapProps.ts renderBackgroundTab`): 견본 카드(층을 겹친 썸네일·「옆에서 본 하늘/위에서 본 면」), 다른 그림 고르기,
  **내 그림 올리기**(`backdropUpload.ts`, 자원 관리자와 같은 검사·저장, 올린 그림은 cover), 배경 끄기, 상태 줄, 움직임 단추, 맞추기(큰 그림 1:1 이면 경고),
  빈 칸에도 보이기, **게임 화면 미리보기**(`mapBackgroundLivePreview.ts`: 게임 해상도/카메라 배율 크기 캔버스, 플레이와 같은 cover·반복·흐름·깊이 식,
  카메라가 ±40px 좌우로 흔들려 시차가 보인다, **타일이 가리는 칸은 어둡게** 칠한다 — 시작 칸 기준 첫 화면).
  고친 결함: 「맵 배경」 을 누르면 「기본 설정」 이 열리고 모든 절이 한꺼번에 보이던 것(`.map-props-section-block[hidden]` 이 CSS 에 덮여 있었다).
- **편집기 캔버스 미리보기**(`EditScene.renderMapBackgroundPreview`): 맵 (0,0) 에 고정, 크기는 맵 사각형(반복 끈 축은 그림 크기까지),
  배율은 게임 뷰포트 기준 cover, `displayTexture` 키로 원본 크기를 읽는다. 「빈 칸에도 보이기」 가 꺼져 있으면 캔버스에도 안 그린다 — 플레이와 같은 거짓말 없는 화면.
- **되돌리기·확인(적대 검수 뒤):** 배경 바꾸기·끄기·칸 비우기는 `recordProjectSnapshot(..., {kind:"map"})` 로 Ctrl+Z 가 된다. 칸 비우기는 확인 창(지울 타일 수·그 자리 이벤트)을 거치고
  `clearMapCellForBackground` 로 모든 층·덧칠 더미(`*TileStacks`)·그림자까지 지운다(더미를 남기면 충돌이 막힌 칸으로 본다).
  고치기 단추는 견본 종류를 따른다 — 옆에서 본 하늘은 「윗줄 N줄」(N = ceil(112px/칸 크기), 맵 높이 절반까지), 위에서 본 면은 「물 칸 N개」(없으면 「맵 둘레 2칸」).
  **시작 칸을 비우면 주인공이 첫 칸에서 못 움직인다**(빈 칸 = 통행 불가) — 편집기 단추와 조수 `clearForBackground` 모두 `startPosAfterBackgroundClear` 로 비운 뒤 맵에서 `isPassableLanding` 이 참인(타일이 남았다고 설 수 있는 게 아니다 — 벽 줄), 이벤트 없는 가장 가까운 칸으로 시작 위치를 옮기고 확인 창·도구 경고로 알린다. 설 칸이 하나도 안 남으면 편집기는 경고, 조수 도구는 `start-buried` 오류로 호출 전체를 되돌린다. 시작 위치를 옮기는 비우기는 프로젝트 스냅숏이라 Ctrl+Z 한 번에 타일과 시작 위치가 같이 돌아온다.
  탭 미리보기는 **맵이 화면보다 클 때만** 카메라를 흔들고(시작 화면에서 갈 수 있는 거리까지), 타일 덮개는 카메라와 함께 움직이며 불투명하다.
  캔버스 「배경 보기」 는 **시작 화면 기준**(시작 칸이 그 맵이면 그 칸을 가운데 둔 첫 카메라)으로 그린다 — 그 화면 밖은 근사.
- **조수**: `set_map_properties.background.preset`(OPRN 다섯 + 남아 있으면 CraftPix; `layerSet` 은 같은 뜻의 옛 이름), `motion`, `showInEmptyCells` 기본 true,
  `clearForBackground{water:true}` 는 그 맵의 물 타일 칸을 비운다(섬 바깥 바다를 배경으로). 이벤트 도구 힌트도 preset 을 가리킨다.
  `get_project_summary` 의 `maps[].background`(preset·그림·층·빈 칸·보이는 칸 수)로 결과를 다시 읽는다(전에는 읽을 도구가 없었다). `backdrop:` 접두 id 도 받는다.
  지평선 견본인데 위쪽 빈 줄이 7줄(112px)보다 적으면 경고와 정확한 clearForBackground 를 돌려준다. 빈 enum 이던 `layerSet` 은 스키마에서 뺐다(실행기는 옛 이름을 계속 받는다).
- **검증(2026-10-21):** 출하 플레이어 1배(320×240) `scripts/qa/runtime/map-panorama.scenario.mjs` — 노을 지붕·맑은 하늘 절벽·섬 바깥 바다·우주 발판 네 장면,
  제자리·걸은 뒤·더 걸은 뒤 세 장. 모서리 확대·검은 빈칸 없음, 층마다 다른 이동. 이 박스는 크롬이 ERR_NETWORK_CHANGED 라 `unshare -rn` 안에서 돌렸다.
  `map-background-fixture.mjs` 기본값도 사라진 `easyrpg-backdrop-sky1` 대신 노을 세트(`--set <id>`). 단위 `test/mapBackgroundPanoramas.test.ts`(실행 안 함).
- **남은 한계:** 맵에 처음 들어갈 때 배경 그림은 비동기로 실린다 — dev 서버 첫 로드에서는 첫 몇 프레임이 검을 수 있다(예전부터, 미리 싣기 없음).
  배경 흐름·깊이는 플레이에서만 움직이고 편집기 캔버스는 정지 화면이다(움직임은 탭 미리보기에서 본다). 칸을 비운 가장자리는 해안·절벽 타일 없이 각지게 잘린다(조수·편집기 모두 가장자리 마감은 하지 않는다). 지평선 세트는 화면 고정이라 맵 아래쪽에서 하늘을 보이게 하면 지평선 아래(물) 부분이 보인다.
  `map-parallax.capture.mjs` 는 아직 빈 CraftPix 세트를 쓴다.

## 맵 배경 조수 경로 — 견본 고르기 정확도·새 배경 생성 generate_map_background (2026-10-22)

실조수 시험(Sonnet 5.5 high, 실제 입력창 Pi 경로 `local-cli:claude`, 9장면, `~/claude-viz/panorama-assistant-1.html`)에서 고친 것:
- **의도 분류**(`intentDeclaration.ts`): 맵 배경(하늘·섬 바깥 바다·창밖 별)은 `set_map_properties`, 견본에 없는 새 배경은 `generate_map_background`. 다시 칠하거나 맵을 새로 짓지 않는다.
  도구 색인 레시피 `map-background`(`toolCapabilityIndex.ts`)·별칭(파노라마·맵 배경·창밖·시차 배경, `toolAliases.ts`).
- **배치 품질 재촉 오판**(`piAgent/layoutQuality.ts`): `paintedShare` 가 비운 칸(-1)을 칠한 칸으로 셌다 → 하늘 7줄을 비우면 「맵이 비었다」 재촉이 붙어 지붕 위를 다시 칠했다. 이제 새 타일이 ≥0 인 칸만 센다.
- **`set_map_properties.background.speed`**(0.1–4): 모든 층 흐름 배율. 움직임 프리셋 뒤에 곱하고, 명시한 scrollX/Y·cameraFollow 는 프리셋 뒤에 다시 얹는다(전에는 「느리게」 가 프리셋에 덮였다).
  요약 줄에 층별 흐름 px/프레임. **한 화면 맵**(맵 ≤ 뷰포트)이면 시차가 안 보인다는 주의를 요약·경고 둘 다에, 위에서 본 면 견본을 하늘 띠(윗줄만 비움)에 쓰면 지평선 견본을 권하는 경고.
- **Pi 경로의 `generate_image_asset`** 은 그림을 만들지 않고 「ui-required」 를 성공처럼 돌려줬다 → 정직한 실패로 바꾸고 맞는 도구(배경이면 generate_map_background)를 가리킨다.
- **새 도구 `generate_map_background`**(`src/editor/tools/mapBackgroundGenerationTool.ts` 스키마·검사, 실행은 `scripts/lib/piAgentRuntime.ts`):
  렌더 브로커(`generateOpeningImage`, `panoramaLayer` 표시) → 브라우저 `src/editor/mapPanoramaGeneration.ts` 가 사용자 이미지 계정(용도 backdrop)으로 생성 →
  지평선은 먼 층 640×240·40색 + 가까운 실루엣 층(마젠타 바탕 분리, 24색), 위에서 본 면은 320×256 사방 이음 → 이음 띠(12%) 교차 섞기로 가로(면은 세로도) 반복 이음 →
  `upsert_resource`(kind backdrop) → `set_map_properties`(cover·loopX·showInEmptyCells, 가까운 층 cameraFollow 0.2) + clearForBackground. 층들은 동시에 만든다. 하나라도 실패하면 아무것도 연결하지 않고 견본으로 몰래 대신하지 않는다.
  결과 PNG 를 모델에게 첨부한다(보고는 그림에 보이는 것만). 맵 한정 실행에서는 거부. 헤드리스 도구 run 은 `image-generation-unavailable`. 배경 그림은 object-gate 대상이 아니다.
- **`decodeImage`(`cutsceneArt/imageProcess.ts`)가 `fetch(dataURL)` 을 썼다** → 출하·팀 호스트 CSP `connect-src 'self'` 가 막아 「NetworkError」. data: 는 직접 Blob 으로 푼다(컷신 그림 처리도 같은 함수).
- **Claude Code MCP 도구 시간 제한**: 그림 2장 생성(약 60초)이 기본 제한에 끊겨 모델이 「시간 초과」 로 받았다 → `MCP_TOOL_TIMEOUT=900000`(codex 의 tool_timeout_sec=900 과 같게, `localCliAgent/claude.ts`).
- **보이는 띠에 맞춤(Opus 적대 검수 뒤):** 지평선 배경은 위쪽 빈 줄(비울 사각형 포함, 기본 7줄=112px)만 비친다 — 생성 그림 아래쪽(반영·땅)과
  그림 가운데에 있던 가까운 층은 타일에 가려 한 번도 안 보였다. 이제 실행기가 그 높이(`panoramaVisibleTop`)를 넘기고, 가까운 층은
  `seatSilhouetteBand` 가 띠 바닥을 맵 바닥선에 세운다(아래는 띠 마지막 줄로 채움). 윗선이 평평한 띠(하늘까지 통째로 그린 그림)는 거절하고
  **먼 층만 연결한 뒤 그 사실을 결과에 적는다.** 먼 층 지시는 「달·해·지평선을 그림 위 40% 안」. 모델에게는 `composeVisiblePanorama`
  (플레이어 첫 화면 = 가운데 320px 폭 × 보이는 높이, 가까운 층 겹침)만 첨부한다 — 전체 그림을 주면 가려진 반영까지 보고했다.
- **반복하지 않는 축은 카메라를 따라가지 않는다**(`playSceneMapBackground.placeMapBackgroundLayer`): `cameraFollow` 는 두 축에 같이 걸리는데,
  그림 한 장짜리 축(지평선 loopY:false)이 따라가면 위로 걸을 때 그림이 내려가 위쪽에 검은 띠가 생기고, 실루엣 층은 맵 바닥선을 떠나 아래 채움 줄이 드러났다
  (출하 플레이어 실측). 이제 깊이는 반복하는 축에만 적용 — 지평선은 가로 시차만, 세로는 화면 고정. 편집기 탭 미리보기는 원래 가로로만 흔든다.
- **남은 한계:** `show_map_region` 은 배경을 그리지 못해(설계상 거부) 조수가 배경을 눈으로 검수하지 못한다 — 생성 도구는 그림을 첨부해 대신한다.
  Pi 경로는 되묻기를 건너뛰므로(`executionRoute.ts clarifyBypassed`) 「배경 좀 예쁘게」 는 묻지 않고 해석한다. 칸을 비운 가장자리는 여전히 각지다. 견본 바다·구름 바다는 흐릿한 얼룩 질감이고 노을 견본의 해는 7줄 바닥선에 반쯤 잘린다(견본 그림 문제, 이번 변경 밖). 다리 상판 타일(버들항 3640)은 자기 그림에 물이 있어 다리 밑으로 배경이 비치지 않는다.

## 맵 배경 「다른 맵 보기」 층 `fromMap` (2026-10-24)

- 배경·배경 층에 `fromMap: { mapId, scale?, haze?, desaturate?, hazeColor?, focusX?, focusY?, region?, feather? }` 를 주면 **다른 맵을 줄여 그린 그림**이 그 층이 된다(옥상에서 내려다본 거리, 창밖 마을 등). 타입 `src/project/types/project.ts` 의 `MapBackgroundMapView`, 정규화 `normalizeMapBackgroundMapView`(`src/project/mapBackground.ts`, scale 0.15~1·기본 0.4, feather 0~0.5).
- 렌더 `src/player/mapBackgroundMapView.ts`: 대상 맵(아래층·위층 타일)을 캔버스에 `scale` 배로 그리고 `region`(칸 사각형) 만 자른다. `haze`(안개색 섞기)·`desaturate`·`feather`(위아래 가장자리 알파 페이드)를 화소에 굽는다. 텍스처 키에 맵 id·배율·범위·페더가 들어간다. 이벤트·사람은 그리지 않는다(정지 그림).
- 자리 `playSceneMapBackground.ts` `mapViewFocusOffset`: focus 칸(기본 = 범위 가운데)이 화면 가운데에 오게 민다. `loopY:false` 로 세로 한 장, `cameraFollow` 로 시차. `fromMap` 층은 `showInEmptyCells` 로 친다(편집기 `EditScene` 와 런타임 둘 다).
- 조수: `set_map_properties.background{,layers[]}.fromMap`(`mapTools.ts` `MAP_VIEW_SCHEMA`) — 자기 자신·없는 맵은 거부. 참조 검사 `src/project/io/references.ts`.
- 쓰임: 「첫사랑」 옥상(`firstLoveMaps.ts`) — 거리 맵 북쪽 줄·큰길을 1/3 배로, 난간 바로 뒤에 오게 focusY 계산.

## 8차 맵 진입 (2026-09-28)

`playSceneMapRuntime.renderTiles`의 **한 번의 동기 패스**가 `TileRenderPass`를 소유한다.
서명에서 이미 해석한 텍스처 키와 맵 타일 크기·쿼터 지원 여부를 재사용하고,
타일 id별 받침·애니메이션 키·호수 여부·always-above 판정을 기억한다(null/false도 캐시).
맵 이웃을 보는 해안/지형 합성은 좌표마다 원래 함수를 호출하고 `withWorldCoastRenderPass`를 유지한다.
패스는 함수 지역값이라 종료·예외 뒤 남지 않는다. 전역/WeakMap에 정책 결과를 계속 보관하면
타일 메타·업로드 animationStrips·해안 그룹의 제자리 수정 뒤 낡은 결과를 쓰므로 그렇게 바꾸지 않는다.

생성은 여전히 행→칸→기존 레이어 순서의 동기 전체 생성이다. 컨테이너 삽입 순서, root y-sort,
농지·설치물·그림자·물 스프라이트·컬링 추적과 서명 스킵은 그대로다. 카메라 이동 전에 생성이
끝나므로 미생성 칸이 생기지 않는다. 프레임 분할은 도입하지 않았다: Phaser Container의
그리기 순서를 보존하는 별도 설계 없이 보이는 칸부터 add하면 겹침 결과가 달라질 수 있다.
에디터 증분 재렌더 경로와 공용 정책 함수는 변경하지 않았다.

검증: `test/mapEntryTilePass.test.ts` + 동결된 `test/tileLayerLegacyOracle.ts`.
텍스처·프레임·좌표·depth·visible·부모·삽입 순서와 애니메이션/컬링 상태를 대조한다.
16/32/48px, 2/4층, 그림자, 받침, 물, 농지·설치물, 해안 그룹 및 업로드 애니메이션 메타의
제자리 수정 후 invalidate/rebuild를 포함한다. `MAP_ENTRY_PROJECT=<읽기 전용 JSON>`이면
개인 자료를 저장소에 넣지 않고 해당 사본의 모든 맵도 대조한다(이 작업은 12맵).
100×100 반복 타일 회귀는 텍스처 해석 **20,001→1회**, 받침·애니메이션 판정 **10,000→1회**를 요구한다.
수정 전 소스를 실제 복원하여 실행하면 텍스처 20,001회 assertion에서 실패한다.

실행 및 브라우저 수치: [map-entry-cost/SUMMARY.md](../verify-shots/map-entry-cost/SUMMARY.md).
측정 도구 `scripts/qa/runtime/map-entry-cost.mjs`는 지정 JSON을 route로만 주입한다.
원본 프로젝트 폴더·SQLite에는 접근/쓰기하지 않는다. 결과에는 입력/소스 SHA-256과 모든 프레임 간격을 남긴다.

최종 브라우저(각 3회, 호출마다 최대 프레임의 중앙값): 고요한 숲100 **98.1→81.7ms**, 큰 폭포 숲100 **81.1→80.3ms**, 새 마을64 **77.1→76.9ms**.
전체 동기 생성·파괴/Phaser add와 첫 사용 자산 비용은 남는다. 관련 테스트 통과 67건 +
수정 전과 같은 날씨 입자 실패 4건, 앱 typecheck exit 0. 프레임 예산 준수 또는 모든 맵의 개선을 주장하지 않는다.
최초 /tmp 증거 소실 후 허용된 새 사본으로 다시 측정해 원시 JSON/PNG를 저장소 증거 폴더에 보존했다.
백업/로그는 `/home/main/.cache/a5a8-r8/mapload/`에 둔다.

## 화면 주변 타일 유지 (2026-10-01)

`playSceneMapRuntime.renderTiles`의 실제 런타임 경로는 `RuntimeTileWindow`로 카메라 주변
칸만 유지한다. 여유는 4칸이며 겹치는 칸의 객체는 재사용하고, 창에서 나간 칸의 컨테이너/루트
객체는 파괴한다. 논리 맵 배열·충돌·NPC 시뮬레이션은 전역 상태를 그대로 사용한다.
농지/설치물은 기존 전역 렌더링을 유지한다. 줌을 멀리 빼면 표시 객체 수도 보이는 칸 수에 따라 늘어난다.

- 타일 이미지/스프라이트는 `scene.make.*({add:false})`로 만든 뒤 공식 `Container.add(array)`로
  일괄 등록한다. `list.push`로 대체하면 부모/파괴 리스너/Sprite UpdateList 계약이 사라진다.
  솔리드 upper만 `addToDisplayList`로 루트에 올린다.
- 칸 저장소는 수명만 소유한다. 청크 컨테이너로 묶지 않는다. 평평한 컨테이너 목록을 기존
  행→칸→조각 순서로 정렬하고, 농지/설치물은 마지막에 유지한다. 루트 upper는 depth와 동률 순서를
  복원해 캐릭터와 섞는다. `rootYSortTiles`는 Set이며 퇴거 때 삭제해 파괴된 가구를 붙잡지 않는다.
- 이동/점프/줌/리사이즈는 `PlayScene.update`에서 컬링 전에 동기화한다. `worldView`는 Phaser가
  렌더 단계에서 갱신하므로 `runtimeCameraTileView`는 최신 scroll/zoom으로 뷰를 계산한다.
  낡은 worldView만 사용하면 순간이동 첫 프레임에 도착 타일이 없다.
- 새 물 스프라이트는 남아 있는 동일 애니메이션의 프레임과 누적 시간을 이어받는다.
  표시 객체 추적 목록도 현재 칸으로 다시 만들어 여행 거리만큼 커지지 않는다.
- 타일/밭/설치물 변경은 기존 입력 서명으로 표시 창을 재생성한다. 화면 밖의 변경은 돌아올 때
  전체 논리 배열에서 읽는다. 씬 shutdown/destroy는 `releaseRuntimeTileWindow`로 참조를 정리한다.
- 카메라 없는 최소 렌더 컨텍스트는 기존 전체 맵 경로를 유지한다. 이것을 차등 렌더 오라클로 쓴다.
  편집기의 lazy/chunk 렌더와 공유 컬링 계약은 바꾸지 않는다.

검증: `test/runtimeTileWindow.test.ts`(512/1024 맵의 화면 객체 유지 상한/겹침 재사용/긴 이동/순서/16·32px/줌/
제자리 변경/물 위상/해제), 기존 컬링·NPC 재사용·지형/호수 테스트. 실제 내보내기 플레이어의
픽셀 대조는 `scripts/qa/runtime-tile-window.mjs`, 크기별 전후 실측은
`scripts/qa/map-size-benchmark.mjs`와 `verify-shots/map-size-optimized-20261001/` 참조.
공식 1024 확장 뒤 같은 조건의 512/1024 비교는 `verify-shots/map-size-1024-20261001/`다.

## 자유 크기 인물 프레임의 발 기준점 (2026-10-06)

`SpriteDef.anchor?: {x,y}`는 프레임 안의 원본 픽셀 좌표다. 생략하면 기존 하단 중앙이다.
48×40 행동 프레임의 `{x:24,y:31}`을 보존하여 발 아래 도구 픽셀을 자르거나 그림 전체를
9px 위로 밀지 않는다. 로드 검사는 유한 값·양수 프레임·프레임 안 좌표를 확인한다.
`eventSpriteResources`는 정규화 원점으로 변환하고, 이벤트 생성/재사용·편집기 표시·
조수 지도 이미지가 같은 원점을 쓴다. `characterOrigin`의 별도 기준점 위에 체공량을
더하며 착지/모습 효과 해제 때 저작 기준점으로 돌아온다. 넘어짐은 기존 명시적 포즈
원점을 사용한다. 접지 worldY와 depth/통행 좌표를 옮기지 않는다.
회귀 사례는 `test/spriteFrameAnchor.test.ts`에 추가했으며 이 작업에서 테스트 실행은
요청되지 않아 실행하지 않았다. 실제 테마 프로젝트 설치/플레이 확인은 별도 완료 조건이다.

## Independent opening timelines

See [opening-animatic-authoring.md](opening-animatic-authoring.md) for assistant tools, shared renderer, poses, audio, preview evidence, and entry timing; [opening-reference-study.md](opening-reference-study.md) holds source-qualified research.

## Monster authoring dogfood (2026-10-03)

- `terrainLandingRecovery.ts` recovers only a player footprint whose originally passable authored floor was made solid by `session.mapOverrides`. Completed `changeTile` events call it once after all commands; save restoration calls it after session reconciliation. Vehicles, explicit through routes, intentional authored wall starts, and still-passable enclosed rooms are preserved. Candidate floors are local (radius 8), respect active blocking events and footprint passage, and need an exit. Device flags and changed tiles are never undone. No safe candidate means no relocation. Correct device authoring still keeps the operator outside its changed cells; the campaign pivot is now (8,17).
- `showBattleAdmissionError` marks only `BATTLE_MONSTER_PARTY_EMPTY` overlays as recoverable. Restoring a real party refresh clears that marked error; unrelated errors persist. Applying a new loaded session clears the prior session's transient overlay. Event, wild, field-spawn, and scheduled battles share this presentation.
- Scene simulation intentionally does not use terrain recovery. It must expose an unsafe authored operator position; shipping recovery and corrected authoring are separate safeguards.

이동 경로의 그래픽 교체·동료 생성/재사용에도 같은 기준점을 적용한다. 주인공은 기존에
지원하는 288×256 업로드 charset을 사용하며, upload id와 같은 SpriteDef에 발 기준점을
기록하면 생성/자원 변경/세션 복원에 반영한다. 다른 키의 upload alias 또는 자유 크기
행동 시트가 주인공 걷기 자원이 되는 기능은 포함하지 않는다.

## 위쪽 대사창의 흉상·전신 초상 (2026-10-17 romance-loop-1)

주인공이 화면 아래쪽이면 대사창이 위로 간다(`preventObscuringPlayer`, `effectivePosition`). 흉상(`.dialogue-face-bust`)은 기본적으로 상자 **위**로 서는데
위쪽 상자는 화면 맨 위라 머리가 화면 밖으로 잘렸다(카페 안 유진, 허리까지만 보임). `.dialogue-overlay.position-top` 에서는 흉상을 상자 **아래**로 매달고
글 여백(`padding-inline`)을 없앤다. 전신 초상(`dialogue-face-full`)은 위쪽 상자에서 흉상 크기로 줄인다(아래 절반의 주인공을 덜 가리려고). 규칙은 src/styles/dialogue.css.


### 흉상·전신이 있는 대사는 대사창이 항상 아래 (2026-10-17, vn-bust-bottom-1)

- **규칙.** 흉상·전신 초상이 실제로 그려지는 줄은 저작한 위치(위·가운데, `displayTextSettings`·say `position`·가림 방지 자동)와 상관없이 `position-bottom` 이다. 초상이 없는 줄·48px 작은 얼굴·`hideFace`·말풍선은 저작한 위치를 그대로 따른다. 위·가운데 저장은 막지 않는다.
- **결정은 한 곳.** `src/project/dialoguePortraitPosition.ts`(`portraitForcesBottom`·`positionWithPortrait`·안내 문구 `PORTRAIT_BOTTOM_NOTICE`/`PORTRAIT_BOTTOM_RULE`). 플레이어는 `dialogue.ts` `mount()` 에서 vnLook→초상(`baseFace`/`portraitMode`)을 **먼저** 구한 뒤 `applyTextSettings(…, forceBottom)` → `applyOverlayPosition(…, forceBottom)` 로 넘긴다(순서가 거꾸로면 위치를 먼저 정해 버린다). 스크림 방향도 같은 `position` 을 쓴다.
- **선택지.** (2026-10-22 고정 틀로 대체) 선택지는 같은 세션이면 바로 앞 대사 상자의 자리(`lastBoxPosition`)에 선다 — 흉상 대사 바로 뒤 선택지가 위로 뛰지 않는다. 퇴장 끝·`resetOverlay`/`dispose` 에서 초기화한다. 숫자 입력(`dialogueNumberInput.ts`)은 대사 직후가 아니라 따로 이어 쓰지 않는다.
- **선택지 입력 유예 (2026-10-21, 첫사랑).** `showChoices` 는 열린 뒤 `CHOICE_CONFIRM_GRACE_MS`(300ms) 동안 **실제(isTrusted)** 결정·숫자 키를 버리고, 그 사이 키보드발 클릭(detail 0)도 버린다. 앞 대사를 넘기던 Enter 연타가 선택지가 그려진 바로 그 순간 닿아 플레이어가 읽지 못한 0번이 골라지고, 이어진 연타가 엔딩·타이틀을 넘겨 「새 게임으로 리셋」처럼 보이던 결함의 수정이다(재현 로그: 선택지 등장과 Enter 가 같은 0.1초). 단위 테스트의 합성 이벤트는 isTrusted 가 거짓이라 영향이 없다.
- **호감 변화 알림 (2026-10-21).** `changeFriendship` 은 인터프리터 훅 `onFriendshipChanged` 를 부르고, 관계 메뉴를 쓰는 게임(`usesRelationshipMenu`)에서만 `playSceneRelationshipPulse.ts` 가 오른쪽 위에 「♥ 이름 · 호감이 올랐다/내려갔다」를 3.2초 띄운다(대사 진행을 막지 않음, 스타일 `playSurface.css`). 관계 메뉴 행은 `project.characters[key].note` 한 줄 소개를 함께 보인다.
- **오른쪽 흉상 이름표 (2026-10-21, 첫사랑 r2).** 미연시 룩(`[data-vn-look]`)에서 말하는 흉상이 오른쪽이면(`.bust-right`) 이름표도 오른쪽(`vnLook.css`). 앞 화자 흉상이 왼쪽 「듣는 사람」으로 남는 두 사람 장면에서 왼쪽 이름표가 듣는 사람 이름처럼 읽히던 결함.
- **창이 위아래로 뛰지 않게 (첫사랑 r2).** 「주인공을 가리지 않게」(`preventObscuringPlayer`)가 켜져 있으면 흉상 없는 줄·선택지가 주인공 위치에 따라 위로 뛴다. 고정하려면 줄마다 `position: "bottom"` 과 시작 장면의 `displayTextSettings`(아래·`preventObscuringPlayer:false` — 선택지 창은 줄 위치가 아니라 세션 설정을 따른다) 둘 다. 장소·시각 자막은 같은 자리에서 `context: "narration"`(테두리 없는 짙은 띠·가운데 기울임)으로 모양만 다르게.
- **첫사랑 탐침 (r2).** `scripts/qa/runtime/first-love-probes.mts` — 자동 장면을 갈래마다 흉내 내어 인물 걷기 칸(통행·겹침)·퇴장/등장(출구 옆·같은 칸 교대·검은 화면만 허용)·옮기기 도착 칸과 문 등지기·문 도달·대사 아래 고정·말풍선(showEmote·balloon) 없음·움직이는 탈것 없음을 검사한다. 걷기 길은 데모를 다 지은 뒤 `routeKey` 표식으로 채운다 — 도구 호출(`define_ending` 등)이 프로젝트를 복제해 맵을 갈아 끼우므로 명령 객체를 붙잡으면 빈 길이 된다.
- **첫사랑 음악 (r2).** 판타지 RPG 마을곡(fld-003·town·inn)과 합성 원곡을 버리고 CC0 카탈로그 여섯 곡(wks-001 사무·rad-002 옥상·pon-001 밤·rst-001 회상/타이틀·flt-022 고백/엔딩 B·sea-001 엔딩 A)을 귀 판정(8318 프록시 `gemini-4-argon-high` 에 60초 발췌 `input_audio`, 곡마다 2회)으로 골랐다. 카탈로그 곡은 레포에 없으므로(CDN 미설정 시 로컬 404) 여섯 파일을 `public/assets/cc0/audio/catalog/` 에 `.gitignore` 예외로 싣는다.
- **전환 부드럽게.** 같은 세션에서 초상 규칙이 창 자리를 바꾸는 줄(흉상 없음(위) ↔ 흉상 있음(아래))에서만 `glideFromPreviousBox` 가 Web Animations `translate` 로 앞 창 자리에서 새 자리까지 220ms 미끄러진다. 레이아웃은 즉시 새 자리로 확정되고 출발점은 변환(진입 연출)을 뺀 `offsetTop` 에 호스트 배율을 곱한 값이다 — 배율로 나누지 않으면 화면 배율(3.2배)만큼 어긋나 창이 화면 밖에서 날아온다(실측). 움직임 줄이기에서는 쓰지 않는다. 그 밖의 줄(같은 위치끼리의 높이 변화 등)은 옛 동작 그대로다.
- **옛 위쪽 흉상 CSS.** `.position-top` 흉상 매달기 규칙(위 절)은 `dialogue.ts` 경로에서는 더는 닿지 않는다(흉상이면 아래). 편집기 미리보기·저작 도구가 직접 `position-top` 을 붙일 때를 위해 남겼다.
- **편집기·도구 안내.** 이벤트 명령 「문장 표시 설정」 위치 그룹, 자료집 「메뉴·시스템」 대사창·대사창 룩 카드(`db-menu-system-portrait-bottom-note`), 도구 설명(`schemaShapes` say·displayTextSettings position, `cutsceneStageTools`, `set_dialogue_system`, `set_vn_look`), `gameAuthoringPresets/romance.md` 한 문단. 카탈로그 en/ja/zh 에 안내 문장 한 줄.
- **증거.** `scripts/qa/runtime/vn-bust-bottom.scenario.mjs`(프로필 `bustbottom`): 캡처마다 DOM 을 읽어 흉상 줄은 아래, 흉상 없는 줄은 저작 위치임을 단정하고(어긋나면 비트 실패) 프레임별 창 윗변 궤적(`_trace.json`)을 남긴다. 전 조합은 프로필 `bb` + `VN_POS_PROBE_DIR=<dir>`(캡처마다 `.json` 위치 탐침, `vn-matrix.lib.mjs`).

## 대사창은 고정 틀 (2026-10-22, dialogue-stable-frame)

데모 두 개에서 「대사창이 위로 갔다 아래로 갔다」. 실측(`dialogue-frame` 시나리오, rAF 로 매 프레임 상자 사각): 아스트라 호라이즌은
대사가 위·선택지가 아래로 200px 뛰고 높이도 80→112px, 첫사랑은 선택지가 위로 27px 자랐다. 원인 넷과 고친 곳:

- **가림 피하기를 줄마다 다시 판정.** `effectivePosition` 은 화면 속 주인공이 0.5 를 넘으면 위로 보냈다 — 가리지도 않는 아래 창이 뒤집혔다.
  이제 저작한 자리가 주인공을 **실제로 덮을 때만**(`DIALOGUE_OBSCURE_BAND` 0.36 띠 안) 반대쪽이다. 그리고 열린 세션(`wasOpen`)의 줄은
  `sessionPosition` 을 물려받는다 — 판정은 세션 첫 창에서 한 번. 저자가 그 줄에 못박은 자리(say `position` top·center·bottom,
  가림 피하기를 끈 `displayTextSettings`)는 따르되 세션 자리를 바꾸지 않는다(다음 보통 줄은 원래 자리로). 흉상·전신 줄의 아래 강제는 그대로이고 세션 자리를 아래로 옮긴다.
- **화면 속 높이 계산이 배율 ≠ 1 에서 틀렸다.** `playerScreenYOf`(`playSceneInterpreter.ts`)와 말풍선 기준점(`playSceneDialogueHooks.ts`)이
  `(y - scrollY) * zoom` 을 썼다. Phaser 카메라는 가운데를 기준으로 확대하므로 화면 높이 절반만큼 어긋난다(아스트라 배율 2: 가운데 주인공이 1.00).
  이제 `cameraViewOrigin`(`src/player/cameraScreen.ts`: 스크롤·원점·배율로 화면 왼쪽 위 월드 좌표, 경계 클램프 포함) 기준. 선택지 요청에도 같은 값을 넘긴다.
  `camera.worldView` 를 쓰지 말 것 — preRender 전(자동 실행 첫 프레임)에는 낡아서 폴른 스타가 1.00 으로 읽혀 창이 위로 갔다.
- **선택지가 대사 상자를 갈아 치우고 내용 높이로 자랐다.** `showChoices` 는 앞 대사 상자 자리(`lastBoxPosition`)에 서고, 그 자리에 **틀**
  (`choiceFrame`: 질문이 있으면 질문, 없으면 앞 대사 상자의 사본, 둘 다 없으면 빈 상자; testid `dialogue-choice-frame`)을 남긴다.
  선택지 칸(testid 는 그대로 `dialogue-box`, 목록 `runtime-choices`)은 오버레이 `.choices-framed` 아래에서 `position:absolute` 로 틀 위(위쪽 창이면 아래)에 뜬다 —
  오른쪽 정렬, 미연시 룩·두 전신 무대는 가운데, 오른쪽 흉상이 선 틀이면 왼쪽. 칸 높이 상한은 틀의 230%(넘치면 목록만 스크롤). 소지금 창은 왼쪽으로 비킨다.
  에메랄드(handheld)는 원작처럼 80px 글 상자를 두고 그 위 오른쪽에 예/아니오 칸. CSS: `dialogue.css` 끝 「고정 틀 선택지」, `playSurface.css`, `emeraldSurfaces.css`.
- **얼굴 있는 줄만 63px 로 커졌다.** `.dialogue-box:has(.dialogue-face)` 의 `max(100%, 63px)` 와 같은 바닥(`min-height: 63px`)을 위·아래 오버레이 전체에 준다(두 전신 무대 제외).
  위쪽 자막 한 줄의 내용 높이 규칙(`playSurface.css`)은 **저자가 위에 고정한**(`data-dialogue-position-reason="fixed"`) 세션 첫 창에서만 쓴다.
  가림 피하기로 위에 간 내레이션(폴른 스타 천문대 잠긴 철문 「꿈쩍도 하지 않는다」)이 67.5→25.5px 납작한 자막 상자로 바뀌던 것이 이것이었다.
- **레터박스 띠를 덮었다.** `syncLetterboxInset`(`playSceneFieldStaging.ts`)이 무대에 `data-letterbox`·`--runtime-letterbox-px` 를 걸고,
  `playSurface.css` 「레터박스 안쪽」이 아래 창은 위로·위 창은 아래로 `translate`(띠 높이 − 크롭 여백, 음수면 0)만큼 민다. 전환 애니메이션은 없다
  (띠가 켜진 뒤 열리는 창이 미끄러져 오르면 그것이 곧 「창이 움직인다」). 말풍선은 무대 좌표라 제외.

QA 근거와 재실행: `scripts/qa/runtime/dialogue-frame-fixture.mts`(데모의 실제 대사 명령으로 화자+초상 → 내레이션 → 선택지 → 초상 없는 화자 → … → 저자 top 한 줄),
`dialogue-frame.scenario.mjs`(약 0.2초 띠 + `<out>-rects.json`), `dialogue-frame-measure.py`(줄마다 안정 상태 위·아래와 줄 사이 이동). 스킨 행렬은
`DFRAME_STYLE`/`DFRAME_VN` 또는 같은 픽스처의 `system.dialogueStyle`·`meta.oprnVnLook` 만 바꾼 사본 + `DFRAME_FAST=1`.
`DFRAME_SCENE=door`(천문대 철문 칸에서 화자 → 잠긴 문 안내)·`letterbox`(광장 컷신 그대로). 영상: `QA_RECORD_VIDEO=<폴더>`(runtime-qa.mjs, 컨텍스트 녹화) + `DFRAME_VIDEO=1`, `<out>-t0.json` 으로 자른다(영상 시각 ≈ performance.now + 0.75초). 오버레이의
`data-dialogue-position-reason`(portrait·session·fixed·auto:0.25·previous-box)이 자리를 정한 근거다. 저작 쪽 경고는 `scene-dialogue-position-jump`(`scenePolishLint.ts`).

## 엔딩 카드 글자는 게임 언어 (2026-10-22)

`showEndingScreen`(`playSceneOverlays.ts`)의 배지(HAPPY·NORMAL·BAD·CHARACTER ENDING, 막·장 끝은 「다음 이야기에 계속」)·마지막 장(끝 / 「제1막 끝」)·
기본 kicker·전당 등록·안내·「타이틀로 돌아가기」는 `vnExtrasStrings.ts` 의 `ending.*` 네 언어 표에서 고른다. 언어는 편집기 언어가 아니라
게임 언어(`vnExtrasLanguage`: 저작 vnExtras > `meta.oprnDialogueSystem.language` > ko, auto 는 기기 언어). 막·장 끝 판정은 엔딩 id 의
`act<n>`/`chapter<n>`(`endingSegmentOf`). 엔딩마다 덮기: `EndingPresentation.badge`·`finalTitle`(각 40자, `kicker` 도 40자 상한)
— 엔딩 정의 presentation 과 ending 명령 presentation 둘 다, 검증 `validateEndingPresentation`, 조수 `define_ending` 스키마. 게임 오버 화면 글자는 이번 범위 밖이다.

## 대사창 읽기 보조 — 백로그·오토·스킵·숨기기 (2026-10-17, 미연시 시스템 UI 1단계)

- **옵트인 저작.** `meta.oprnDialogueSystem`(순수 모듈 `src/project/dialogueSystem.ts`)이 없고 관계 중심 게임도 아니면 대사창·ESC 메뉴·설정 화면은 예전과 바이트 단위로 같다(예전 hover 「기록」 단추·세션 로그 포함, 설정은 8줄 그대로). 켜지면 `dialogue.ts` 가 단축키(오토 A · 스킵 S · 백로그 L/PageUp/휠 위 · 숨기기 H, Ctrl 누르는 동안 스킵)와 `dialogueBacklogView`(전체 화면, 휠·방향키·Esc, 캡처 단계에서 키를 삼킴)를 붙인다.
- **대사창 단추 줄 없음 (2026-10-17 사용자 지시).** 예전 `.dialogue-bar`(오토·스킵·백로그·숨기기 단추 + 멈춤 알림)는 흉상·글을 가려 지웠다(`dialogueControlBar.ts`·`bar.*`/`notice.*` 글자·CSS 삭제). 저작된 대사 시스템에서는 옛 「기록」 단추도 그리지 않는다 — 대사창 안에 단추가 하나도 없다. 기능 자체(단축키·백로그·ESC 메뉴·설정)는 남는다. 멈춘 이유는 `overlay.dataset.readingStop` 에만 남는다. `vn-bust-bottom` 탐침은 단추 줄이 다시 생기면 비트를 실패시킨다.
- **저장.** 세션 `dialogueBacklog`(링 버퍼, 항목 line/choice, 저작 limit 20~500 기본 100)와 `dialogueRead`(화자+본문 FNV-1a 키, 상한 4000)는 세이브에 들어가고 저장·불러오기·파싱 모두에서 `normalizeBacklog`/`normalizeReadKeys` 로 다시 자른다(손댄 세이브도 상한을 넘지 못함). 전투 안 대사는 `reading:"off"` 라 합성 세션에 기록하지 않는다.
- **안전 규칙(순수 함수 `skipVerdict`·`stopsReading`·`stepStopReason`).** 오토·스킵은 선택지·숫자 입력·이름 입력·상점·전이·전투 진입·세이브/불러오기 메뉴·타이틀·게임 오버에서 멈춘다. 스킵은 선택지를 대신 고르지 않고, 엔딩 에필로그(인터프리터가 WeakSet 으로 표시, `endingEpilogue`)와 넘기기 금지 글을 넘지 않으며, 범위가 `read` 면 읽지 않은 줄에서 멈춘다(`overlay.dataset.readingStop`). 오토 대기는 글자 수에 비례(`autoAdvanceDelayMs`, 속도 느림·보통·빠름). 숨기기는 아무 키나 누르면 돌아오며 닫힘·장면 전환은 오토·스킵을 끈다.
- **글자 언어.** 편집기 i18n 계층은 에디터 전용이라 런타임은 별도 네 언어 표 `src/player/dialogueUiStrings.ts` 를 쓴다. 언어는 저작 `language`(기본 ko, auto = 기기 언어)가 정하고, 새 글자는 네 언어를 모두 채운다(`test/dialogueSystem.test.ts` 가 빈 칸·자리표시자 불일치를 막는다). 게임 본문은 번역하지 않는다.
- **투명도.** 기기 설정 `windowOpacity` 는 계산된 배경색·그라데이션의 알파를 곱해 적용한다(`dialogueWindowOpacity.ts`). 글자·테두리는 그대로.
- **CSS.** `src/styles/dialogueReading.css`(runtime/index.css 가 `layer(runtime)` 으로 불러옴, `test/playerRuntimeCss.test.ts` 의 RUNTIME_IMPORTS 에 등록). 기존 실패 3건(`retro2003` 스킨·`.status-menu-body` 누락, 임포트 개수 68 대 72)은 main 에서 이미 빨갛다 — 이 변경과 무관.
- **시각 QA.** `npm run qa:runtime -- --scenario romance-vn-system --project <fixture>/project.json`(고정 장면 `scripts/qa/runtime/romance-vn-system-fixture.mts <outDir> [ko|en] [opacity]`). 크로미움이 백지(ERR_NETWORK_CHANGED)면 `unshare -rn` 안에서 실행. 증거 `verify-shots/runtime-qa/romance-vn-system{,-en}/`.

### 대사창 읽기 보조 수리 1 (2026-10-17, 적대 리뷰 D1~D12)

- 저장된 대사 속도: `normalizePlayerPreferences` 가 표식(`textSpeedChosen`) 없는 예전 저장본의 느림/빠름을 한 번 「직접 고른 값」으로 승격한다(연애 기본 시작값에 덮이지 않게). 보통은 구별할 수 없어 저작 시작값을 따른다.
- 입력: H 반복 keydown 은 숨김을 되돌리지 않는다. 휠 위 백로그 열기는 `ctrlKey`(핀치) 무시 · 닫은 뒤 450ms 쿨다운 · 300ms 안 누적 40 문턱(`dialogue.ts` WHEEL_*).
- 앰비언트(흘림·코너·bark) 대사는 세션 백로그(세이브)에 쓰지 않는다 — `recordLog(request, look, false)`.
- 창 투명도: 스킨 그림이 창을 채우는(border-image) 스타일(classic)은 설정 행을 숨기고 `applyWindowOpacity` 도 아무것도 하지 않는다.
- 레이아웃: 예전 단추 줄 터치 면·흉상 비키기 규칙은 단추 줄과 함께 지웠다(위 「대사창 단추 줄 없음」). 시나리오 `romance-vn-system-mobile` 은 좁은 화면에서 단추 줄이 없음을 본다.
- 글자: ESC 메뉴 하단 조작 안내(`statusMenuControls(…, system)`)와 레일 「백로그」 기본 라벨은 대사 시스템이 있는 게임에서 저작 언어로 나온다(없으면 예전 한국어). 죽은 키 `notice.hiddenRestore` 삭제.
- 조수: 시스템 도구 초기 선언 낱말은 `GAME_SYSTEM_REQUEST_PATTERN`(`gameSystemProduction.ts`)에 모았고 영·일·중 낱말을 더했다.
- 알림(릴리스 노트용): 백로그 항목을 저작한 ESC 메뉴가 든 프로젝트는 이전 빌드에서 열리지 않는다. 기존 연애(관계 메뉴) 프로젝트는 저작 없이도 기본 구성이 켜져 대사창 단추 줄·ESC 백로그·설정 3행이 새로 생긴다(비연애 프로젝트는 불변).


## 미연시 추가 화면 — 갤러리 잠금·엔딩 목록·세이브 카드 (2026-10-17, 미연시 시스템 UI 2단계)

- **옵트인 저작.** `meta.oprnVnExtras`(순수 잎 모듈 `src/project/vnExtras.ts`, v1: `language?`, `gallery{enabled,showLocked}`, `endings{enabled,hideUnseen}`, `saveCards{enabled}`)가 없고 관계 중심 게임도 아니면 갤러리·ESC 메뉴·세이브 카드는 예전과 같다(`resolveVnExtras` → undefined). 연애 게임만 저작 없이도 세 기능이 켜지고(`romanceVnExtras`), 연애 프리셋(`romancePreset.ts`)은 저작본을 심는다. 검증은 `validateVnExtras`(모르는 칸·잘못된 값 거절, `shapeResourceFields.ts`).
- **새 그림 0장.** 갤러리 칸은 맵·공통 이벤트의 `showPicture recordInGallery` 를 훑어(`listGallerySlots`, 중첩 branch/fork/loop 포함, WeakMap 캐시, 상한 200) 만든다 — 아직 안 연 칸이 「???/잠김」으로 보인다(`showLocked:false` 면 감춤). 잠긴 줄은 `unavailableReason` 이라 커서가 건너뛴다. 엔딩 회상은 본 엔딩(기기 클리어 기록 `session.clearHistory.endingIds`)의 에필로그 `say` beat 를 백로그 뷰어(`openBacklogView({title})`)로 다시 읽는 읽기 전용이다. 인터프리터를 다시 돌리지 않는다.
- **엔딩 목록.** ESC 메뉴 「엔딩」(`FIELD_MENU_COMMANDS` 에 `endings`, 연애 메뉴에 포함). `project.endings` 를 읽어 자동으로 채운다: 달성/미달성(기기 기록), 인물별 체크리스트(해피·평범·혼자 3종, `friendshipAtLeast.npcKey` 로 인물을 가르고 인물 전용 엔딩이 없으면 「공통」 한 줄, 문턱 `ROMANCE_ENDING_*_AT` 로 결말 구분), 못 본 엔딩 이름은 `hideUnseen` 이면 「???」. 엔딩 정의가 없으면 항목 자체를 숨긴다(빈 화면 금지). 갤러리 항목도 열 칸·열린 그림·본 엔딩이 하나도 없으면 숨긴다.
- **세이브 카드.** `SaveSnapshot.sceneLine`(선택, `saveCards` 가 켜졌을 때만 쓰고, 읽을 때 `normalizeSceneLine` 으로 44자·제어문자 정리)에 저장 시점 마지막 대사(「화자: 글」)를 싣는다. 타이틀 불러오기 카드(`playerLoadPanel` `.oprn-load-slot-scene`)와 ESC 저장/불러오기 상세(날짜+한 줄)에 보인다. 옛 세이브·꺼진 게임은 한 줄이 없을 뿐 바뀌지 않는다. 대사 백로그가 꺼져 있으면 한 줄이 비므로 `review_game_systems` 가 지적한다.
- **글자 언어.** 새 글자는 `src/player/vnExtrasStrings.ts`(네 언어 표, 빈 칸·자리표시자는 `test/vnExtras.test.ts` 가 막음). 언어는 `vnExtrasLanguage`: 저작 `language` > 대사 시스템 언어 > ko. 연애 기본 이름 「갤러리」「엔딩」은 저작자가 바꾸지 않았을 때만 번역한다(`statusMenuCommandLabel`). 저장/불러오기·호감도 등 기존 메뉴 글자는 아직 한국어 하드코딩(미해결).
- **함정(실측).** 갤러리 상세는 `grid-template-rows` 가 없어 큰 그림 칸(`status-menu-showcase-frame` height:100%)이 높이 0 으로 접혀 그림이 안 보이는 기존 결함이 있었다 — `galleryMenu.css` 에서 첫 줄을 `minmax(0,1fr)` 로 고쳤다(옛 갤러리에도 적용됨). 로컬 파일 대신 런타임 QA 에는 `scenario.localStorageSeed`(키의 `{ns}` = 세이브 이름 공간)로 「이 기기에 이미 본 엔딩」을 심는다(`scripts/lib/runtimeQaRun.mjs`).
- **기기 기록 (수리 PR, 2026-10-17).** 엔딩 달성(`{namespace}:clear-record:v1`)과 열린 CG(`{namespace}:gallery-record:v1`, `{version:1, ids:[...]}`, 상한 1000)는 **저장 칸이 아니라 이 기기**에 남는다. 코드는 `src/player/deviceRecords.ts`: `syncSessionWithDeviceRecords` 가 부팅(`player.ts`)과 `PlayScene.applySession`(ESC 불러오기·체크포인트 복원·패배 복구·자동 저장 읽기 모두 통과)에서 `session.clearHistory` 를 기기 기록으로 다시 채우고, CG 는 「기기 기록 ∪ 세션의 칸별 해금」 합집합으로 올려 옛 저장·옛 프로젝트의 칸별 해금을 이관한다(읽기만으로는 쓰지 않고 달라졌을 때만 기록). `showPicture recordInGallery` 는 세션과 기기 양쪽에 기록한다. 세션 상한 200 을 넘으면 지금 프로젝트의 갤러리 칸에 없는 해금부터 버린다(`recordGalleryUnlock(session,id,liveIds)`). **불러오기·새 게임은 열린 그림·본 엔딩을 줄이지 않는다.** 힌트 문구(`gallery.hint`)가 이를 밝힌다.
- **수리 PR 묶음(vn-review-2).** 엔딩 목록 상세는 커서 없는 정보 목록이라 ↑↓ 가 `.status-menu-detail-list` 를 스크롤한다(`moveSelectedDetailAction`). 체크리스트 칸은 그 인물 자신의 엔딩만으로 채우고 공통 엔딩은 「공통」 행으로 따로 둔다(이름 못 찾은 인물은 「???」). 연애 기본 ESC 메뉴 낱말(호감도·일정·소지품·저장·불러오기·설정·타이틀로)과 저장·로드 화면 글자는 `vnUiText` 로 저작 언어를 따른다(기본 메뉴·미연시 프로젝트만; 작가가 쓴 라벨과 몬스터 수집 쇼케이스는 그대로 — 한 화면에 한국어가 섞이는 부분은 알려진 한계). `review_game_systems`: 저작 없는 연애 기본 구성의 「CG 0」 경고는 뺐고(저작으로 켠 경우만), 저작 메뉴에 갤러리 항목이 없으면 짚는다. `configure_field_menu` 는 작가가 저작한 `oprnVnExtras` 의 꺼짐을 되돌리지 않고 알린다. `set_vn_extras {}` 는 아무것도 쓰지 않고, `preset:"default"` 는 함께 준 칸을 무시한다고 알린다. `GAME_SYSTEM_REQUEST_PATTERN` 은 맨 「갤러리」·「gallery」·「저장 칸」을 빼고 VN 낱말(`CG 갤러리`·`갤러리 화면`·`gallery screen` …)만 받는다. `normalizeSceneLine`/`saveSceneLine` 은 BiDi 제어문자를 지우고 글자 묶음(grapheme) 단위로 자른다. `listGallerySlots` 캐시는 맵·이벤트 배열 참조·길이가 달라지면 무효다.
- **휠 스크롤과 QA.** ESC 메뉴는 `.play-stage` 아래 전부 `pointer-events:none` 이고 `installPlayPointerBlocker` 가 휠을 삼켜, 넘치는 상세 목록이 휠로 안 움직였다. 키보드 전용 플레이에서만 `.status-menu-detail-list` 상자가 포인터를 받고(행은 계속 안 받음) 차단기는 그 목록 위 휠만 통과시킨다(`statusMenuEdgeDock.css` 맨 아래, `playInputBlocker.ts`). 대화 기록·백로그(`.dialogue-log-list`, `.dialogue-backlog-list`)도 같은 이유로 휠만 통과한다 — 백로그 안내가 휠 스크롤을 약속한다. 시험: `bun scripts/qa/runtime/romance-vn-ui4-fixture.mts output/qa/vn4 [ko|en]` → `node scripts/runtime-qa.mjs --scenario romance-vn-ui4 --project output/qa/vn4/project.json` (저장→CG 해금→ESC 불러오기→갤러리·엔딩 유지, 12명 체크리스트 키보드·휠 스크롤, 뷰어 닫기). 하네스에 `wheel` op(`{testid|selector, deltaY}`)을 더했다. ESC 메뉴 커서는 마지막 항목을 기억하니 시나리오는 절대 위치가 아니라 상대 이동으로 짠다.
- **시각 QA.** `bun scripts/qa/runtime/romance-vn-ui2-fixture.mts output/qa/vn2 [ko|en]` 후 `unshare -rn node scripts/runtime-qa.mjs --scenario romance-vn-ui2 --project output/qa/vn2/project.json`. 증거 `verify-shots/runtime-qa/romance-vn-ui2{,-en}/`.

## 인물 연출 런타임 — approach·turnToward·대사 자동 돌아보기 (2026-10-22)

- 경로 단계 `approach`·`turnToward` 는 **즉시 명령**이다. NPC 는 `playSceneAutonomousCommands.executeInstantCommand`, 주인공은 `playSceneMovement.applyPlayerRouteCommand` 가 그 순간 `expandApproach`(`playSceneApproach.ts`)로 경로에 보통 `move` + `turnToward` 를 끼워 넣는다(`mover.step-1`·`route.index-1` 자리). 그래서 걸음 속도·막힘·주인공 비켜 가기(`commandRouteDetour`)는 기존 걸음과 같다. 속도 표를 여기서 다시 정하지 않는다(`project/characterMotion.ts`).
- 대사 자동 돌아보기는 인터프리터 `text` 단계가 showText 직전에 부른다(`playSceneDialogueFacing.applyDialogueFacing`). 화자·듣는 인물 규칙은 장면 검사와 같은 `project/staging/dialogueActors.ts` 다 — 한쪽만 바꾸면 검사가 상상한 방향과 게임이 다르다.
- `exitVia`·`enterVia` 도 같은 즉시 펼침이다(`playSceneDoorway.ts`): 걸음 + `doorCue`(문 소리·문 이벤트 방향 프레임, `mover.routeWaitMs` 로 프레임 사이 쉼 — `playSceneAutonomous` 의 wait 처리 옆) + `placeAt`(같은 맵 순간 이동). 문 그림 칸 판정은 `project/staging/doorCells.ts`(장면 검사와 공유 — 검사 모듈은 큰 JSON 을 들고 있어 출하 플레이어가 끌어오면 안 된다).
- `moveEvent` 대상 `"@this"`/`"this-event"` 는 실행 중 이벤트 id 로 묶인다(`bindStageTargets`).
