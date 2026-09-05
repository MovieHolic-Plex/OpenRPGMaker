# Interior Room Session Harness (villager-room-v1)

The LLM-harnessed interior pipeline: start session, advance build per layer, evaluate, and self-repair loop.

## 사용자 타일 정정: 항아리·돌계단·석조 화로

- 235는 주전자가 아니라 **항아리**다. 기존 저장물의 `kettle`/`VR.KETTLE` 식별자는 유지하지만 검색 라벨·태그·가구 이름·시설 물건 설명은 항아리로 쓴다. 141·111·171은 **돌계단**이며 목제라고 설명하지 않는다.
- `402 403 404 / 432 433 434 / 462 463 464`는 낱개 벽·창살이 아니라 **하나의 3×3 석조 화로**다. `stone_hearth_unlit`은 이 배열 그대로다. 아래 가운데 `(1,2)`의 463은 불이 꺼진 화구다.
- `stone_hearth_lit`은 나머지 여덟 셀을 유지하고 463만 124로 바꾼다. 기존 불 스트립 `124→154→184→214`, 4fps를 사용한다. 상태별 가구 정의를 고르는 기능이지 클릭으로 불을 켜는 게임 이벤트를 자동 저작하는 기능은 아니다.
- 9개 석재 셀은 실내 `wall-panel` 그룹에서 빠지고 fixed `stone-hearth` 그룹으로 이동한다. 다른 칩셋의 동일 번호는 다른 그림이므로 건드리지 않는다. 기존 `hearth`(373)와 `stove`(21/51)는 별도 물건이다.
- `InteriorObjectDef.description`은 가구 킷의 `ai.description`으로 저장되고 다시 로드된다. `get_concept_facility`의 vocabulary는 상태 설명과 `tileIds`를 전달한다. 모델은 `stone_hearth_unlit`/`stone_hearth_lit`을 선택해 온전한 화로를 시공할 수 있다.
- 실내 일반 타일 렌더 경로는 불을 정지 그림으로 처리하고 있었다. `supportsChipsetTileAnimation(tileset,tile)`은 실내의 불 스트립만 추가로 허용한다. 마을 전용 길/나무 판정인 `isDefaultTilesetTexture`를 확장하지 않는다. 편집기와 출하 플레이어 양쪽에서 같은 조건을 사용한다.
- `scripts/sync-stone-hearth.mts --apply`는 기존 `rpg-zzu-inn-exploration-v4`의 관련 타일 메타·가구 정의·계단 설명을 저장하고 재로드한다. 맵 타일 배열과 맵 목록은 보존한다. 로컬 `map_hearth_qa`는 실제 도구 시공/애니메이션 검증용이며 원격 콘텐츠로 저장하지 않는다.
- 회귀: `test/stoneHearth.test.ts`(AI 조회·3×3 셀·양 상태·직렬화·통행), `test/interiorFireRendering.test.ts`(실제 플레이어 렌더러의 lower/upper 불 재생). `scripts/qa/stone-hearth.mjs`는 player.html의 실제 Phaser Sprite `animationupdate`를 관찰하고 각 프레임에서 일시정지해 PNG를 남긴다.

## 여관 검수표와 숙박 검증

- `vite-node --script scripts/inspect-inn.mts`는 `rpg-zzu-inn-exploration-v4`를 **읽기만** 한다. 원본 480타일, 저장된 가구 정의(현재 55종)의 셀별 조립, 저장 맵에서 전체 셀이 일치하는 배치 확대 예시를 `output/evidence/inn-inspection-v5`에 생성한다. 사용하지 않은 가구에 임시 시공 예시를 만들어 붙이지 않는다. 같은 그림을 재사용하는 가구가 있어 구조적 일치 수와 저작 물건 수는 다르다.
- 201·408·409·410은 코드/원격 가구 정의·세 여관 맵에서 사용 0을 확인한다. 408·409·410은 시맨틱/하네스 그룹에서도 빠져 있다. 201은 기존 분류에 남아 있지만 조립 미확정이므로 보고서에서 별도로 표시한다. 기존 라벨은 육안 확인 완료를 뜻하지 않는다.
- `node scripts/qa/inn-lodging.mjs`는 같은 해시의 원격 저장본을 전용 `player.html?e2eVitals=1`에서 연다. 실제 접수대까지 걸어가 키보드로 숙박을 실행한다. QA 훅은 준비할 때 세션의 돈/HP/MP만 설정하며 원격 데이터는 수정하지 않는다.
- 20G 숙박의 실측: 100→80G, 20→0G이며 현재 파티의 HP 7→514, MP 3→43. 19G·0G는 돈·HP·MP 보존 및 부족 안내, 아니오·Esc는 상태 보존 후 필드 복귀를 확인했다. 소지품·스위치·변수도 검사한다. 휴식/기상/종료 및 부족 상태는 DOM 변경을 미리 구독하고 고정 sleep 없이 기다린다.
- `node scripts/report-inn-inspection.mjs`는 검수와 숙박 증거의 프로젝트 해시를 비교하고 이미지 내장 HTML `output/evidence/inn-inspection-v5/index.html`을 만든다. 가구/타일 검색, 사용 여부/미확정 필터, 좌표·레이어 보기, 키보드 확대가 있다. `node scripts/qa/inn-inspection-report.mjs`가 1440·900·390px에서 모든 가구 카드·숙박 시나리오·원본 색인을 캡처하고 검색·디코딩·확대·넘침을 확인한다.

## 여관 꾸러미 전면 재구성 (2026-09-06)

- **구조 검토 수정:** `stairs_horizontal`은 3×3 조립으로 벽면 2행과 바닥 1행을 연속해서 잇는다. 바닥에 가로 한 줄만 놓지 않는다. 창문 등 벽걸이의 시작점은 벽면 상단으로 제한하고, 한 칸 벽 장식의 조사 이벤트는 그 아래 행에 두어 바닥에서 닿게 한다.
- double-row는 줄에서 가장 큰 방 높이를 모든 방에 복사하지 않는다. 북쪽 방은 남쪽 문을 기준으로 하단 정렬, 남쪽 방은 북쪽 문을 기준으로 상단 정렬하며 각자의 높이를 보존한다. 독실은 5×8→5×3, 다인실은 9×7→7×4, 상인방은 9×7→7×6, 알코브 객실은 11×8→9×7이다. 맵 높이는 입구 방이 아니라 모든 방의 가장 아래 끝을 포함한다.
- **1×1 계단은 한 개만:** 474와 475는 좌우 조각이 아니라 각각 완성된 단일 타일이다. `stairs_down`은 474 하나만 쓰며 475를 옆에 붙이지 않는다. `convertEntranceToDescent`, 연결 집, 방 연습 프로젝트 스크립트도 같은 규칙이다. 2층 계단참·다락의 실제 계단 앞으로 도착하며, 입구 이벤트 id는 유지하되 위치는 계단으로 옮긴다.
- **입구:** 개념 실내의 하단 출입구에는 통행 가능한 176번 표식을 얹는다. 위층에서 닫는 가짜 출입구에는 이 표식도 지워 계단과 입구가 뒤섞이지 않게 한다.
- **연결 집도 같은 계약:** `author_house`/마을의 `createHouseInteriorMap`은 꾸러미의 올라가는 계단을 착지 보정으로 덮지 않는다. 위층의 저작된 `stairs_down`이 있으면 그 위치를 전이·착지점으로 사용하고, 가짜 입구를 닫아 중복 계단을 만들지 않는다. 저작 계단이 없는 옛 꾸러미만 기존 합성 계단을 사용한다. `test/interiorConceptRoutes.test.ts`가 기본 여관을 공개 facade로 만들고 전체 계단 셀·단일 하강 계단·176 입구·실제 왕복 명령을 확인한다.
- **오분류 제외:** 408·409·410은 시맨틱 검색과 실내 하네스 그룹에서 제외한다. 이전 bundled-default 메타는 재시드할 때 unknown으로 비워지고 사용자 메타는 보존한다. 카운터 자동 배치와 회복센터 생성에서는 이 타일을 더 이상 쓰지 않으며, 확인된 긴 탁자 325·326·327을 접수용으로 재사용한다.
- **209·239:** 현대식 보일러가 아니라 난로 연통의 위·아래로 분류한다. 검색 태그는 flue/stovepipe/chimney이며 `flue` 가구는 1×2 조립이다.
- 현재 기본 여관은 `scratchInnBundle.ts`의 **3층 double-row** 도면이다. 1층은 주방·짐 보관방·식당·난로가 있는 접수 홀, 2층은 다인실·L자 상인방·좁은 독실·알코브 객실과 복도·계단참, 3층은 작은 L자 다락이다. 11개 장소 정의와 1층 자동 복도가 실제 12공간으로 시공된다. 같은 객실을 count로 반복하지 않는다.
- 다인실은 세로 침대 2개, 독실은 세로 침대 1개, 상인방·넓은 객실은 가로 침대 각 1개다. 돗자리/널/나무 바닥, 장부·운송 상자·머리맡 편지·차탁으로 방의 용도를 구분한다. 다락은 여분 침구·옛 간판·주인의 여행 기록을 갖는다.
- 식당은 식사 세트 2석+추가 좌석 2석, 접수 홀은 작은 대기 탁자·두 의자·접수 장부·난로·벽 계단이다. 주방은 화덕·작업대·흰 손질대·선반·곡물·물통이 들어가도록 l 크기를 쓴다. m 크기의 독립 북쪽 주방에는 흰 작업대가 들어가지 않는다.
- `sleep`은 `front_desk` 한 곳에만 붙는다. 침대와 수납장은 조사만 한다. 기존 inn 명령의 유료 회복이며 개별 방 예약/열쇠/NPC 시스템이 추가된 것은 아니다.
- `test/innConceptRebuild.test.ts`는 5개 seed의 방별 침대 수·단일 숙박 거래·경고 0·직렬화 재로드를 검사한다. `test/innExploration.test.ts`는 3층 양방향 전이·비대칭 객실·작은 다락·내려가는 계단 그림을 검사한다. 전체 시설의 조립 가구 검사는 각 room.mapId의 맵을 사용해야 한다.
- 단독 공간만 있는 double-row 층은 불필요한 복도/복제 방을 만들지 않고 고유 크기를 유지한다. `convertEntranceToDescent`는 이벤트와 474 한 칸 계단을 연결한다. 중간층의 저작 transfer 물건은 위로, 생성된 entrance는 아래로 연결되므로 계단 보고서는 모든 이벤트의 명령을 읽어야 한다.
- 제작: `vite-node --script scripts/build-explorable-inn.mts`(미리보기), `--save`(공식 `saveProjectToSupabase`+재로드). **기존 `rpg-zzu-inn-exploration-v4`를 읽고 수정**한다. 저장 직전 동시 변경을 검사하며 수정 전 JSON·층별 이미지를 보존한다. 실내 기본 메타를 갱신하고 계단·접수 탁자·연통 정의와 세 여관 맵을 반영한다. 다른 프로젝트 데이터는 유지한다. `rpg-zzu-house-template-gallery`는 다른 탭의 자동 저장이 여관을 지운 전력이 있어 다시 쓰지 않는다.
- 플레이 검증: `node scripts/qa/inn-exploration.mjs --reloaded`. 편집기 셸 없이 player.html로 저장본을 열고, 충돌 판정을 따르는 이동 경로로 4객실 조사 및 1→2→3→2→1을 검증한다. 순간이동·고정 sleep 없이 runtime-state-json/대화 DOM 변경을 구독한다. 연속 방향 입력은 과부하 프레임에서 목표 칸을 지나칠 수 있으므로 한 칸 move route를 쓴다. Vite QA config는 runner로 읽고 캐시는 작업트리 output 안에 둔다. 이 호스트의 Chromium `ERR_NETWORK_CHANGED` 때문에 로컬 Vite 응답을 Node fetch로 그대로 전달한다.
- 이미지 내장 보고서: `node scripts/report-inn-exploration.mjs` → `output/evidence/inn-exploration-v4/index.html`. 원격 재로드와 실제 플레이 증거가 있어야 생성된다. 이전 단층 보고서 `inn-rebuild-v3`는 비교 자료로 보존한다.

## 실내 의미·형태 검토 반영 (2026-09-05)

- 새 보고서: `output/evidence/concept-v2/index.html`. 기존 `concept-semantic-audit/` 보고서는 **수정 전 감사**이며 보존한다.
- 사용자 정정 반영: 가로 계단 `141 | 111(반복) | 171`, 검 진열 박스 `263/293`, 쓰러진 의자 `384`, 목재 상판 `156~158/186~188/216~218` 및 하단 `198/199/200`, 흰 상판 `159~161/189~191/219~221` 및 하단 `228/229/230`. `201`은 정확한 역할 미확정으로 자동 배치하지 않는다. 종전 deck 그룹 id는 호환성을 위해 유지하되 탁자·통행 차단으로 정정했다.
- 한 칸 계단 `stairs_small`은 444, 가로 계단 `stairs_horizontal`은 141/111/171을 쓴다. `stairs` 465/466/467은 붉은 카펫 대계단이다. 단층 여관 기본 꾸러미에서 목적지 없는 계단을 제거했다. 실제 다층 도면은 명시한 계단 또는 연결기가 만든 소형 계단으로 잇는다.
- `124→154→184→214` 불 애니메이션은 기존 네 프레임 유지. `290/291/292`는 기본값·원격·앱 재로드에서 upper이며 하위 레이어 문제는 재현되지 않았다. `133`은 화장실·세면실용 반복 바닥 후보이고 전용 욕실 구성을 추가한 것은 아니다.
- 카탈로그 55종(단일 하강 계단·연통·화로 양 상태 포함). `interiorTableCells(width,depth,white)`는 lower 상판과 upper 하단을 만든다. 차탁·독서·식사·상담·제단·작업 탁자·교사용 책상은 소품을 upper로 얹은 **원자적 조립 가구**다. 기존 table_chairs의 의자는 서로 탁자를 향한다. 임의 물건 간 `on/near/facing` 관계 엔진은 아직 없다.
- `ConceptPlaceRecord.shape` / `RoomSpec.shape`: `rect|l|alcove`, 생략은 직사각형. `project/interiorRoomFootprint.ts`가 한 의미 공간을 여러 floor rectangle로 펼친다. 작은 직접 좌표 방(w<7 또는 h<5)은 직사각형으로 폴백한다. 도면기는 비직사각 장소에 여유 크기를 주고, row 방은 하단을 맞춘다. 형상 지정은 현재 AI plan/프로젝트 데이터 경로이며 DB 장소 카드에 형상 드롭다운은 없다.
- 벽걸이는 bbox 맨 위 두 행만 보지 않고 실제 북향 벽면을 찾는다. 시계 두 셀 모두 벽에 걸린다. 가구 후보는 배치 전후 도달성을 비교한다. 복도는 직선 통로를 보존하며 일반 방은 문 앞 한 칸과 실제 우회 경로를 확보한다.
- 통행 보정은 조립 가구 일부를 지우지 않는다. 방 재시공도 배치 셀을 보호하고 다른 방을 수리 대상으로 삼지 않는다. 비직사각 북벽 및 두 칸 시계 잔상도 비운다. 경로를 확보할 수 없으면 경고를 반환한다.
- 일반 조사 문구는 저작 물건 라벨을 사용한다. 은행 문서함이 침구장으로, 교회 제단이 맥주 묻은 탁자로 설명되던 고정 문구를 제거했다.
- 계약: `test/interiorConceptAssemblies.test.ts`의 19시설×3seed=57 생성, 상판·소품 전체 셀, 벽시계, shape 저장/로드, 사용자 수정 보존. 검토 미리보기는 별도 맵을 원격에 추가하지 않으며, 19꾸러미·51가구 정의는 `rpg-zzu-house-template-gallery`에 저장하고 raw 프로젝트·tileset mirror·앱 재로드로 확인한다.

## 모든 AI 실내의 개념 꾸러미 계약 (2026-09-05)

- 신규 독립 실내의 기본 경로는 `get_concept_facility` → 요청에 맞는 `plan` → `place_concept`다. 조회 이름이 미등록이거나 생략되면 `sources[]`에 **현재 프로젝트 꾸러미의 시설별 장소·물건 plan**을 반환한다. 모델은 이를 조합해 미등록 실내를 설계한다. 빈 꾸러미 배열은 사용자 삭제이므로 plan을 주더라도 재시드하거나 레거시 가구로 대체하지 않는다.
- 기존 좌표형 도구도 우회하지 않는다. `RoomHarnessKit.preparePlan`을 공유 엔진의 start/run 양쪽에서 **플랜 저장 전에** 호출한다. 실내 킷의 `interiorConceptPlan.bindInteriorConceptPlan`은 rooms 또는 wings를 꾸러미 장소에 연결하고 `concept` 오버레이를 저장한다. 기본 7종 및 외관 용도(shop·workshop·dwelling·manor·inn) theme은 장소 별칭만 가지며 가구 목록은 코드에서 가져오지 않는다. 미등록 장소는 `concept-place-not-found`로 조회·설계 경로를 안내한다. 이미 모델이 설계한 concept 오버레이는 보존한다.
- `author_house`와 마을 하네스는 `createHouseInteriorMap({ project: draft, … })`를 호출한다. 시설은 용도에서 선택(dwelling/manor→민가, shop→상점, inn→여관, workshop→대장간, study→서재)하고 **도면도 꾸러미 장소·크기·개수·층에서** 만든다. 구조물 그림은 해당 프로젝트의 가구 어휘를 읽는다. 외관이 추가 층을 요구하면 같은 꾸러미의 장소를 재사용하고, 명시된 꾸러미 층이 있으면 우선한다. 안팎·층간 전이는 기존 연결기로 연결한다. 프로젝트 없는 저수준 도면/패리티 하네스만 종전 순수 파이프라인을 유지한다.
- 집 내부에도 `roomHarnessPlan`을 남기므로 저장·재로드 후 방 단위 수정이 가능하다. `furnish_interior_space`는 옛 도면을 꾸러미에 연결하고, theme 변경 시 대상 방의 오버레이만 교체한다. 재시공 방의 생성 이벤트만 걷고 칩 이벤트를 다시 붙이며 다른 방 이벤트는 보존한다. 개념 이벤트 id는 기존 맵 id 집합과 충돌하지 않는다.
- `generate_map`의 `rooms` 프로필은 `concept-interior-required`로 개념 경로를 안내한다. 현재 개념 시공의 그림·벽 문법은 `easyrpg_chipset_interior`만 지원하며 다른 칩셋을 무음 대체하지 않는다. 야외·던전 프로필은 기존 경로다.
- 계약: `test/interiorConceptRoutes.test.ts`(수정한 꾸러미의 독립 방/start/집/마을/위층 반영, 직렬화, 미등록 시설 조합, 삭제·우회 차단, 방 이벤트 재시공), `test/generateMap.test.ts`, 기존 `test/interiorRoomPipelineParity.test.ts`.

- **2026-09-05 시설 확장:** 기본 초안은 19시설·51장소 구성. 연결 집은 프로그램 id와 같은 시설을 먼저 찾고 기존 매핑으로 폴백하므로, `manor`는 등록된 귀족 저택을 쓰고 옛 프로젝트는 기존 민가를 계속 쓴다. `test/interiorConceptRoutes.test.ts`가 양쪽을 검증한다.

## Tileset-specific map generation contract

- `generate_map` resolves the requested `tilesetId` through `src/editor/tools/mapGenerationProfiles.ts`. Numeric tile IDs are local to that tileset and must never be reused through a global village/interior palette.
- Bundled tilesets have explicit profile keys and layout grammars (`settlement|dungeon|rooms|ship|world|city|wilds`). `rooms` profiles require concept construction; other generated maps retain the requested `GameMap.tilesetId`.
- A profile owns the passable floor/path tiles, blocked boundary/obstacle tile, accent tile, and topology grammar. `generate_map` applies that passage contract before its reachability repair loop.
- The passage contract updates the project tileset record shared by every map using that `tilesetId`; floor/path/accent stay passable and the profile obstacle stays blocked consistently across those maps.
- The passage contract updates the project tileset record shared by every map using that `tilesetId`; generation therefore treats floor/path/accent as passable and the profile obstacle as blocked consistently across those maps.
- `villager-room-v1` and `dungeon-room-v1` remain the detailed layer/session pipelines for their respective authored workflows. The generic `generate_map` dispatcher does not force every tileset through the interior pipeline.
- Uploaded or unknown tilesets do not silently inherit bundled numeric IDs; generation rejects them until a dedicated profile is authored.

## Interior Room Session Harness (villager-room-v1)


- The interior pipeline is LLM-harnessed via `src/editor/tools/interiorRoomSession.ts`: `start_interior_room_session` (plan args: `wings|rooms(+per-room floorTile)`, `innerDoors`, `door`, `theme`, `seed`, `floorTile`, `wallMaterial: cream|gold-brick|stone-brick`) ??`advance_interior_room_build` per layer (`floor ??walls ??furniture ??entrance ??critique`) ??`evaluate_interior_room`.
- `evaluate_interior_room` mirrors the village harness contract (`villageEvaluate.VillageLookReport`): returns `{ ok, score, issues, metrics, attempt, maxAttempts, feedbackForLlm }`. Checks are theme furniture manifests, door-BFS walkability (furniture treated as obstacles), and quadrant fill balance. On failure the assistant should follow `feedbackForLlm`, patch via `advance_interior_room_build({ forceLayer: "furniture" })` or plan changes, and re-evaluate ??same self-repair loop as `villageSession`.
- The builder guarantees geometry invariants regardless of caller: hard multi-tile sets are never half-placed, room entry cells are reserved during placement (`ENTRY_SENTINEL`), and `enforceWalkability` melts removable single props to keep every open cell reachable from the door. `plan.seed` feeds a mulberry32 RNG (variant/rotation/jitter), so the same plan reproduces and a new seed rerolls furniture placement. After walkability, `fillSparseQuadrants` fills the sparsest quadrant with theme wall-snap goods using place-verify-revert (each placement is BFS-verified and reverted if it blocks a path).
- Space-role harnessing: "interior" is the parent concept; placement decisions are per space. Each `rooms[]` entry carries a role theme (`bedroom|study|dining|kitchen|storage|tavern|corridor`); `corridor` is a walkway role ??no floor-occupying furniture, only wall d챕cor and tall displays (bust/armor), and its cells are exempt from quadrant-density judgement and fillers. `furnish_interior_space({ sessionId, roomId, theme?, seed? })` demolishes and re-furnishes one space (furniture, wall d챕cor row, rugs) with the role grammar, then re-runs map-wide walkability ??the per-space repair/retheme loop for the assistant.
- Contextual prop anchoring: bedroom rugs anchor at the bed's foot (not under table sets), a nightstand (`VR.BOX`) lands beside the bed head via `placeBedsideProp`, and bedroom table sets are excluded from the bed zone (Chebyshev ??2) and rug cells. Kitchen cauldron/kettle anchor next to the stove.
- Editor chatbot integration: the harness tools are registered in `toolRegistry.ts` under the `tile` domain and survive the 40-tool exposure quota in tile mode (regression-fixed in `test/toolExposureQuota.test.ts`); `scripts/check-tool-exposure.mts` probes the live exposure set. The former `build-interior` assistant skill that injected the full playbook (plan grammar: partition spacing, innerDoors, corridor role, wallMaterial/floorTile rules; plus the session → evaluate → `furnish_interior_space` self-repair loop) was removed with the assistant-skill feature (2026-08-27) — the tools and their descriptions are now the only prompt-side source. Session-built maps are auto-registered in `mapTree` so they appear in the editor map list.
- End-to-end reference: `scripts/demo-assistant-interior-build.mts` drives the real tool handlers (requirement ??plan ??session ??per-space furnish ??evaluate ??deploy) against the live Supabase project; `scripts/build-room-practice-project.mts --reroll N` is the batch/script path that bypasses the LLM loop on purpose. The batch script gates `--save` behind per-map evaluation (seed-retry loop, up to 12 rerolls per plan).



## Safe detached draft and approval harness

- Room sessions now live in editor-only `detachedDraftMemory` through `roomHarness/sessionStore.ts`; they are transferred explicitly when assistant/region drafts are cloned and never become `Project` JSON or runtime/session state.
- `roomHarness/engine.ts` records an explicit checkpoint for every layer, including structured location-aware warning/error data. `roomHarness/facade.ts` is the low-level typed API for start/advance/evaluate, room lock/unlock, and seeded room-only reroll; it does not depend on LLM tool exposure or the 40-tool quota. `regionTask/runDirectRoomDraft.ts` is the connected editor coordinator: the region modal's **AI 없이 실내 초안** action offers home/inn/manor presets plus composable theme modifiers, selects an event-free doorway whose adjacent return cell is reachable from the authored start (following existing transfers), builds all layers in detached memory, and creates exterior→interior plus interior→exterior transfers.
- Room-only reroll restores every tile/stack outside the selected room byte-for-byte, preserves all events, uses an explicit integer seed, rejects locked rooms, re-evaluates the resulting room draft, and refreshes the ghost preview/review report.
- Region review runs bounded deterministic isolation repairs and a hard world-navigation preflight before approval. Unreachable auto-generated `ev_inspect_*` flavor events may be removed within the same repair budget; authored objectives, transfer sources/destinations, NPC schedule destinations, and living destinations remain blockers.
- `pendingRegionApply` always compares an authoritative live project fingerprint and always performs a fresh review (using `reviewRegionDraft` as the fallback) for full, replacement/partial, reroll, and NPC-resolution candidates. Structural room/map proposals do not expose tile-only partial apply because that would separate the door from its map/session. A successful approval records exactly one `{ kind: "project" }` history snapshot and performs one store replacement, so one undo removes both the exterior door and generated interior map.

## Interior object catalog is the shape source of truth (2026-08-28)

- 가구 형상은 `src/editor/interiorObjectCatalog.ts` 가 데이터로 선언한다: `INTERIOR_OBJECT_CATALOG` 항목마다 `id`, 한국어 `label`, `role`(`InteriorSemanticTileRole | null`), `width`/`height`, `layer`, `cells`(`{dx,dy,layer,tile}[]`), `themes`, `snap`. 조회는 `interiorObjectById` / `interiorObjectsForTheme`.
- **2026-08-31:** 실내 칩셋을 처음 열거나 하네스가 돌면 그 카탈로그가 `tileset.structureKits`(계보 `interior-catalog`, `ai.snap`/`ai.interiorRole`/`ai.themes`)와 `tileset.interiorRoomKinds` 로 시드된다. 이후 파이프라인은 타일셋 데이터를 읽고, 코드 카탈로그는 시드·폴백이다. 기본 7종(bedroom…) 배치는 여전히 코드 프로그램이고, **없는 방 종류 id** 는 역할·스냅으로 가구를 놓는 일반 배치기를 탄다. 벽·천장 문법은 아직 실내 칩셋 전용이다.
- 파이프라인이 그 데이터를 소비한다: `src/editor/interiorRoomPipeline.ts` 의 `objectCells(id)` + `paintObjectCells(map, cells, ox, oy)` 가 침대(가로/세로)·책장·화덕·긴 탁자·카운터·피아노를 카탈로그 셀로 찍는다. 정의가 없는 id 는 즉시 예외 — 오타가 반쪽 가구로 새지 않는다.
- 셀 모양이 `renderTileCellsToCanvas`(`kitRender.ts`)의 `{dx,dy,layer,tile}` 과 같으므로 에디터 UI(데이터베이스 '구조물' 탭)가 같은 데이터를 그대로 래스터로 그린다. 즉 사용자가 보는 그림과 AI 가 찍는 타일이 한 정본에서 나온다.
- **변경의 심판은 패리티 테스트다**: `test/interiorRoomPipelineParity.test.ts` 가 `test/fixtures/interiorRoomDemoRooms.baseline.json`(데모 방 7종의 `lowerTiles`/`upperTiles`, 변경 전 코드에서 박제)과 바이트 단위로 비교한다. 카탈로그 셀을 하나만 바꿔도 이 테스트가 깨진다 — 배치를 의도적으로 바꿀 때만 픽스처를 다시 박제하고, 그 이유를 커밋 메시지에 남긴다.
- 카탈로그 자체 불변식은 `test/interiorObjectCatalog.test.ts` (셀 경계, 중복 좌표, 역할 타일 포함 관계, 테마 필수 역할 충족, id 규칙).

- **2026-09-05 학습 책상:** `study_desk`는 사각 탁자와 남쪽 걸상을 하나의 1×2 카탈로그 물건으로 정의한다. 교실의 큰 책장은 자료실로 모아 두 세트와 통로 공간을 확보한다. `enforceWalkability`는 단일 소품 타일을 제거할 수 있으므로 「자리 없음」 경고만으로 복합 가구 보존을 판정하지 말고 최종 맵의 모든 구성 셀을 확인한다. 학교 계약은 세 가지 seed에서 책상·걸상 쌍을 직접 검사한다.

## 소품 표면 어휘가 `PlacementZone` 으로 통일됐다 (2026-08-30, PR #316)

`interiorRoomPipeline.ts` 의 `PROP_SURFACE` 표가 쓰던 자체 어휘가 공용 `PlacementZone`
(`src/project/types/base.ts:117-129`)으로 바뀌었다. **다른 세션 코드가 옛 값 이름을 참조하고 있으면
같이 고쳐야 한다** — 값 세 개가 이름을 바꿨고, 새 항목 `STOVE_BOT`/`STOVE_TOP`/`HEARTH` 가 들어왔다.

내장 `kitchen-stove` 그룹(타일 21/51)에는 하드코딩 규칙 `r_interior_stove_north_wall`
(`interiorRoomPipeline.ts:441-458`, `zone: "againstWall"`, `facing: "north"`, `strength: "hard"`)이
붙는다. 하드코딩은 **규칙 자체**뿐이고 벽·바닥 판정은 여전히 `passability` 에서 온다 — 타일 id
목록으로 벽을 정하지 않는다. 이 규칙이 만드는 lint 코드는 `cluster-rule:surface:*` 라서 커밋을
막지 않는다(`openwiki/editor-validation.md` 의 같은 날 항목 참조).


## 개념 시설 시공 — place_concept 경로가 파이프라인에서 다른 점 (2026-09-02)

`InteriorRoomPlan.concept` 가 있으면 파이프라인은 테마 프로그램 대신 나무를 따른다. 데모 방 패리티 픽스처(`test/interiorRoomPipelineParity.test.ts`)는 이 분기를 타지 않으므로 그대로다.

- **도면**은 `src/editor/conceptBundleResolve.ts` 의 `layoutConceptFacility` 가 장소 역할로 만든다: 방 줄(y=4, 가로 1열 파티션) → 3행 파티션 → 복도(3행) → 3행 파티션 → 홀(정문, 남쪽 행 중앙). 내부 문은 파티션 트림 행. 오버레이(`ConceptOverlay.rooms[roomId]`)는 방 인스턴스마다 장소·역할·물건·칩을 싣는다(`interiorKit.parseConceptOverlay`).
- **구성**은 `src/editor/interiorConceptCompose.ts` 의 `composeConceptRoom` 이 방 하나씩 한다. 슬롯 종류: 벽걸이(`wall-any` → 크림 벽면 윗줄, 상위 레이어), 키 큰 가구(시계·갑옷·흉상·거울·진열대·화덕 → 상단이 벽면 아랫줄), 북벽(침대·책장·카운터·피아노), 복도 끝(transfer 칩=계단), 바닥(탁자 — 방 중앙, 좌석군 사이 통로), 구석(1×1 block), 러그(침대 발치, 통로 위 허용). 문에서 방 안으로 곧게 이어지는 **통로**와 정문 좌우는 가구 금지. 벽 물건 사이 1칸 간격은 자리가 모자라면 양보한다. 못 앉힌 물건은 `concept: <물건> 자리 없음 (<장소>)` 경고 — 숨기지 않는다.
- **벽·천장**: 벽 문법은 그대로 쓰고, 그 뒤 `carveOutsideVoid` 가 바닥·벽면에 이웃한 한 겹만 천장으로 남기고 밖을 「암흑 공허」(116)로 비운다. 천장 정본 v2(검정 몸통)에서는 건물 밖과 천장이 같은 검정이라 「벽 위에 천장이 없다」고 읽혔기 때문이다.
- **칩 집행**은 `src/editor/interiorConceptEvents.ts` 의 `attachConceptEvents` 가 furniture 층 끝(통행 확보 뒤)에 한다: transfer > sleep > loot > event 우선순위로 물건마다 이벤트 하나, 앵커는 최하단 행 중앙, `ev_concept_<mapId>_<thing>_<n>`. 개념 시설은 `attachPropInspectEvents`·`fillSparseQuadrants` 를 타지 않는다(나무에 없는 것을 보태지 않는다). `evaluate_interior_room` 의 필수 가구 검사는 개념 필수 물건(`conceptManifestWarnings`)으로 바뀐다.
- **보고서 렌더러**: `scripts/lib/renderInteriorMapPng.mts` 는 에디터와 같은 `chipsetQuarterComposition` 으로 천장·벽 프레임을 그린다. 원시 셀로 그리면 천장이 풀밭 조각으로 찍혀 판정을 오염시킨다(2026-09-02 실측). 계약: `test/placeConceptRender.test.ts`.
- **시설 다양화 (2026-09-02):** 초안 묶음(`src/project/defaults/conceptFacilityTemplates.ts`, 2026-09-05에 19종으로 확장)이 같은 도면 규칙·같은 구성기로 선다. 그 과정에서 바뀐 규칙 — (1) **홀 넓힘**: 복도 없이 방 둘 이상이 홀 바로 위에 서면 홀을 좌우 1열씩 넓힌다(`BAND_SPREAD`). 방문 착지 열이 홀 북벽을 2칸 조각으로 쪼개 카운터·피아노 같은 3칸 가구가 설 자리가 없었다(술집·민가). (2) **구성 순서**: 벽 가구(필수 먼저) → 러그 → 바닥·구석(필수 먼저). 러그는 상위 레이어 가구 밑으로 들어가고(`freeFor` 가 러그 칸을 상위 레이어에만 허용, 하부 레이어 상자·책장은 러그를 덮어 구멍을 내므로 불허) 입구 표지(`ENTRY_SENTINEL`) 위에도 깔린다. 방 전체를 훑어 중앙에 가장 가까운 3×3 을 고른다. (3) **구석 소품**: 네 구석 → 둘레(남·북 행, 서·동 열) → 안쪽 순으로 앉아 창고의 상자·술통 7개가 다 선다. (4) **북벽 앵커 공유**: 북벽 가구·키 큰 가구·복도 끝 계단은 서로를 앵커로 보고 퍼진다 — 안 그러면 흉상 둘이 동쪽에만 나란히 선다(교회). (5) **재질**: 장소 `floor` → `RoomSpec.floorTile`(돌 12·널 102·돗자리 139), 시설 `wall` → `plan.wallMaterial`. 파이프라인이 원래 갖고 있던 리틴트를 그대로 쓴다. (6) 조사 문장은 2026-09-05부터 실제 저작 물건 라벨을 사용한다. 계약: `test/conceptFacilityTemplates.test.ts`(초안마다 plan/walkability 경고 0·자리 없음 0·필수 물건 존재·도면 다양성·재질 리틴트).
- **모델 설계 plan + 배치 seed (2026-09-03):** `place_concept` 이 `plan`(장소·물건 목록)을 받으면 `conceptPlan.parseConceptPlan` 이 합성 꾸러미로 바꿔 같은 도면기·구성기에 넘긴다 — 파이프라인은 템플릿과 설계를 구분하지 않는다. `InteriorRoomPlan.seed` 는 개념 분기에서 `composeConceptRoom({seed})` 로 소비된다(종전엔 테마 가구 RNG 에만 쓰여 개념 시설은 seed 와 무관했다). 도면 문법은 `plan.layout`: `row`(방 줄 → 복도 → 홀, 기본) 또는 `double-row`(북 방 줄 → 복도 → 홀+남쪽 날개, `places[].zone` north|south). 구현 `src/editor/conceptLayoutDoubleRow.ts`. 여관 품질은 `scoreConceptFacility` 가 도달·침대·카운터·계단·자리없음·종횡비·템플릿복사를 채점해 `place_concept` 결과 `review` 에 싣는다. `get_concept_facility(여관)` 은 `variants[]`(시골 단층 / 2층 객실 / 복도 양쪽)와 「수식어가 없어도 설계하라」 designHint 를 준다. 증거: `test/conceptDoubleRowLayout.test.ts` · `test/conceptFacilityScore.test.ts` · `reports/inn-freeform/index.html`.
