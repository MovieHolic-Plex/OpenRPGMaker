# 데이터베이스 초보자 중심 적대적 리뷰 — 개선 제안 보고서

캠페인: `.omo/plans/db-beginner-adversarial-qa.md` · 2026-08-19
소스: [통합 발견 원장](db-beginner-adversarial-qa-findings.md) (289건) · [휴리스틱 루브릭](db-beginner-heuristics-rubric.md) (25항목 + S×B) · 큐레이션 증거 `.superpowers/sdd/qa-shots/db-audit/` (14샷)

## 1. 요약 (범위·방법·수치)

- **범위**: 에디터 데이터베이스 모달의 24개 표면 전부, 초보자/전문가 두 크롬, 3개 뷰포트(1024×768/1280×800/1440×900) + 도크 모드 + 150% 줌.
- **방법**: 영구 Playwright 스펙 5개(qa-overview, qa-characters, qa-tilesets, qa-structure-kits, qa-db-beginner-mode — 한 실행에서 14 테스트 전부 녹색) + 적대적 진단 스펙 7개(_db-audit-*) + 150샷 시각 매트릭스 + 루브릭 기반 시각 리뷰. 모든 발견은 S(심각도)×B(초보자 영향) 채점, confirmed는 결정적 재현 + 실존 증거 필수.
- **수치**: 원장 289건 = **P0 3 / P1 5 / P2 20 / backlog 261**(통과 계약 기록 clean 206건 포함). 확정 defect 59건, 시각 미확정 25건, 기준선 유래 pre-existing 8건.
- **한 줄 판정**: 초보자 모드가 데이터베이스에 실제로 주는 것은 **탭 축소(common 6개)와 어휘 교체(plain) 둘뿐**이며, 그 어휘 교체조차 레거시 폼 패밀리(전투 명령/전투 화면/지형)와 도크 레일에서 깨진다. 안전장치(자동저장+Ctrl+Z, 더티 3버튼, 참조 삭제 차단 일부)는 견고하지만, **안내(코치마크·탭 설명·맥락 도움말)는 사실상 부재**하다.

## 2. 초보자 방향 평가 — 25개 휴리스틱 처분

근거 표기: (원장 id) 또는 [큐레이션 샷](../../.superpowers/sdd/qa-shots/db-audit/). 처분: **충족 2 / 부분 15 / 미충족 8**.

| # | 휴리스틱 | 처분 | 근거 |
| --- | --- | --- | --- |
| 1 | task-oriented entry point | **미충족** | 초보 레일에 DB 입구 없음, `toolbar-database` 숨김 — 유일 경로는 도구 메뉴 (R4-no-rail-entry, confirmed). `basicLeftRail.ts`는 'database'를 언급조차 안 함 |
| 2 | progressive disclosure | **충족** | common 6탭 + `db-nav-all` 접힘 계약이 프로브에서 유지 (G2 clean) |
| 3 | useful+safe defaults | 부분 | 신규 레코드 기본값 건전 (A1 clean 다수) / kind=skill에 skillId 없는 행이 무검증 저장 (C6-skill-without-id, P2) |
| 4 | role-based presets | 부분 | 직업 피커+적용 버튼 존재, 직업 탭에 곡선·명령 집중 / 역할 프리셋 칩 없음, 새 주인공 직업 비움 허용 |
| 5 | plain-language tab descriptions | 부분 | 24탭 중 **4탭만** 설명 배너 보유(몬스터/종족/캐릭터/스탬프 — [증거](../../.superpowers/sdd/qa-shots/db-audit/backlog-enemies-beginner-good-banner-clipped-right.png)). 나머지 20탭 무설명, 도크 레일은 무라벨 |
| 6 | user-facing labels over jargon | **미충족** | `저장 위치=database.battleCommands`, `RM2003 데이터베이스 >`, raw enum `attack /`, `easyrpg-system2-system2-c`가 초보자 모드 폼 필드로 노출 ([증거](../../.superpowers/sdd/qa-shots/db-audit/p2-terrain-beginner-legacy-jargon.png)); DB 패널의 uiLabel 호출은 단 1곳 (R3, confirmed) |
| 7 | domain terms defined at first contact | 부분 | 몬스터/종족 배너가 관계를 정의(모범) / A–E 등급·경험치 곡선 공식·'Lv1:20' 무정의 (VQA-elements-grade-letters-undefined 등) |
| 8 | related data navigable in context | 부분 | 캐릭터 탭 '이벤트로 이동' 버튼 존재(모범), G006 동일 인스턴스 유지 확인 / 몬스터→종족 점프 없음(드롭다운만) |
| 9 | inline previews | 부분 | 적 그룹 배경·배치 미리보기, 장비 아이콘 즉시 반영 / 개요 산점도는 점 1개가 우상단에 고정된 빈 차트 ([증거](../../.superpowers/sdd/qa-shots/db-audit/backlog-overview-beginner-scatter-outlier.png)) |
| 10 | downstream-impact visibility | **미충족** | **P0 C9**: `timeSystem.onDayEnd`가 참조하는 공용 이벤트 삭제를 아무도 막지 않음 — `databaseReferences.ts`는 3개 사이트만 검사, timeSystem 참조 0건. A6: 캐릭터 삭제 시 참조 이벤트 이름 미표기 |
| 11 | recognition over recall | 부분 | 대부분 피커/칩 / battleCommands 스킬 id 원시 입력, terrain 원시 리소스 문자열 |
| 12 | search/filter/favorites | 부분 | 주요 목록 검색 존재 / 필터+검색 0건 시 힌트 없음 — 레코드 삭제로 오인 (FAM-filter-search-empty, 양 모드 confirmed); 종족·타일셋 목록은 검색 자체가 없음 |
| 13 | visible location+state | 부분 | 자동저장 바·활성 탭 표시 양호 / **P0 FAM-virtualizer-selection-loss**: 검색 해제 후 선택 행이 DOM에서 소실(80행 임계 초과 시, 4개 레인 독립 재현) |
| 14 | immediate local validation | 부분 | 숫자 입력은 type=number+min/max로 견고(프로브가 'abc' 입력 실패 = 올바른 동작 증거) / 이름 칸은 7+탭 무제한 — 100자 CJK가 행을 10배 오버플로 (**P1 FAM-name-overflow-uncapped**), typeChart 팝오버는 abc가 기존 배율을 지움 (MAT-B2) |
| 15 | error prevention before messages | 부분 | New Game 체크 비활성 유지, 참조 삭제 차단 3사이트 작동 / **P1 C6**: 전투 명령 문서화 상한 6을 넘는 7행 허용, 타입 리스트 비우기가 무경고로 typeChart 삭제 (MAT-B3) |
| 16 | actionable jargon-free errors | 부분 | 삭제 차단문이 레코드 이름 사용(clean) / '(고아 ID)' 문구, D7 죽은 버튼(스위치 0개인데 활성·무설명) |
| 17 | undo/redo + reversible destructive ops | **충족** | 전 표면 상시 '자동 저장됨 — 실수는 Ctrl+Z' 바 + Escape 더티 3버튼 + Discard 스냅샷 복원 (E-레인 clean 다수) |
| 18 | consequence-naming confirmations | **미충족** | typeChart 전체 삭제 무경고 (MAT-B3), 캐릭터 삭제가 참조 이벤트 미명명 (A6), 레코드 삭제 확인은 결과 미서술 |
| 19 | safe experimentation | 부분 | 복제 딥카피 검증 clean / 캐릭터 탭 복제 없음 (A10-characters-no-duplicate), 복제·생성 후 미자동선택 (expert-A7/A10-items) |
| 20 | consistent interaction patterns | 부분 | 리스트+인스펙터 셸은 12+탭 일관 / 레거시 3탭·타일셋·상성은 완전 이질 셸, **P0 E1**: 시스템 섹션 전환이 진행 중 편집을 첫 글자로 절단("비행중섹션전환"→"비") |
| 21 | flexible layout without hiding controls | **미충족** | 도크 레일 = 무라벨 숫자 배지 (**P1 FAM-untitled-dock-tabs**, [증거](../../.superpowers/sdd/qa-shots/db-audit/p1-dock-beginner-rail-unlabeled-counts-only.png)); 150% 줌에서 저장/닫기 이탈 (**P1 FAM-zoom150-overflow**); 1024에서 인스펙터 우측 열 절단 6+탭 ([증거](../../.superpowers/sdd/qa-shots/db-audit/p2-elements-beginner-right-column-clipped-1024.png)); 도크 시스템 탭 멤버 피커 소실 ([증거](../../.superpowers/sdd/qa-shots/db-audit/p2-system-beginner-dock-member-pickers-missing.png)); troops 목록이 버튼 위에 겹침 ([증거](../../.superpowers/sdd/qa-shots/db-audit/p2-troops-beginner-list-overlaps-actions.png)) |
| 22 | contextual help at uncertainty | **미충족** | `db-field-support-notice`는 아이템/장비 2탭뿐(소스 확인), 도움말 버튼 = 단일 일반 토스트 "데이터베이스에서 레코드와 시스템 설정을 조정합니다." |
| 23 | guided first successful outcome | **미충족** | DB 내부 코치마크 0건(소스+프로브 이중 확인). beginner chrome은 맵 코치마크만 켬 |
| 24 | labeled starter/example content | **미충족** | freshProject 샘플 모험(주인공 6·아이템 177·스위치 Q1~)에 예제 표식 전무; crops 빈 상태는 무안내 빈 패널 ([증거](../../.superpowers/sdd/qa-shots/db-audit/backlog-crops-beginner-blank-empty-state.png)) — 스탬프 탭의 모범 배너와 대조적 ([증거](../../.superpowers/sdd/qa-shots/db-audit/backlog-structurekits-beginner-exemplary-empty-state.png)) |
| 25 | realistic novice-task validation | 부분 | 본 캠페인이 영구 스펙 qa-db-beginner-mode로 초보 여정 검증을 신설 / 여정 자체는 전투 명령·도크에서 끊김(상기 P0/P1) |

## 3. 우선 개선 제안 (P0/P1 전건 + 미충족 휴리스틱)

각 제안: 문제 → 증거 → 대상 탭 → 구체 제안 → 초보자 효과 → 공수(S/M/L) → 실행 카테고리.

### P0

**제안 1 — 시간 시스템 참조를 삭제 가드에 편입** (원장 C9-dangling-ondayend, S4×B3)
- 문제: `system.timeSystem.onDayEnd`가 가리키는 공용 이벤트를 삭제해도 차단·경고 없음 → 저장된 dangling id는 로드 시 조용히 프루닝되어 게임 로직이 무단 소멸.
- 증거: 원장 #C9 (재현 스펙 `_db-audit-commands`), 소스 확인 — `src/editor/databaseReferences.ts::commonEventReferenceMessage`는 3개 사이트만 검사하고 timeSystem/onDayEnd 참조가 0건, 소비자는 `src/player/playSceneTime.ts`·`src/project/gameTime.ts`, `src/project/io/references.ts`가 로드 시 무음 프루닝.
- 대상: 공용 이벤트 탭 · 시스템 > 시간 시스템.
- 제안: `commonEventReferenceMessage`에 timeSystem 훅(onDayEnd 등) 스캔 추가, 차단문에 "시간 시스템(하루 끝)이 이 이벤트를 사용합니다" 명시. 로드 프루닝 경로에는 알림 토스트 추가.
- 효과: 초보자의 "이벤트가 안 도는데 이유를 모름"(B3 무귀속 손실) 제거. 공수 **S**. 카테고리: quick.

**제안 2 — 섹션 전환 전 진행 중 편집 커밋** (원장 E1-defect, S3×B3)
- 문제: 시스템 워크벤치에서 제목 입력 중 다른 섹션 클릭 시 입력이 첫 글자로 절단 저장("비행중섹션전환"→"비").
- 증거: 원장 #E1 (재현 `_db-audit-utility-system`, exportedProject diff 첨부).
- 대상: 시스템 탭 7섹션 전부.
- 제안: `src/editor/panels/database.ts` 시스템 섹션 리렌더 직전 활성 input의 blur/commit 강제(IME 조합 종료 포함 — 한국어 우선 제품이므로 compositionend 대기).
- 효과: 조용한 데이터 절단(B3) 제거. 공수 **M**. 카테고리: deep.

**제안 3 — 가상화 목록의 선택 행 보존** (원장 FAM-virtualizer-selection-loss, S3×B3)
- 문제: 검색/필터 해제 후 화면 밖 선택 행이 DOM에서 소실 — 선택 상태가 조용히 죽음(80행 임계 초과 목록: 아이템 177, 스위치/변수 1000). 4개 레인 독립 재현.
- 증거: 원장 #FAM-virtualizer-selection-loss (mergedFrom: expert-X13-virtualizer, X13-selection-missing, X13-defect).
- 대상: 아이템·스위치·변수 등 가상화 전 목록.
- 제안: 가상화 렌더러에 선택 행 핀 고정(항상 마운트) 또는 필터 해제 시 scroll-to-selection 자동 수행 + 선택 유지 assert를 영구 스펙에 추가.
- 효과: "내 레코드가 사라졌다" 오인(B3) 제거. 공수 **M**. 카테고리: deep.

### P1

**제안 4 — 전투 명령 상한 강제** (원장 C6-seventh-accepted, S3×B2)
- 문제: 문서화 상한 6을 넘는 7·8행이 편집 가능하게 추가됨.
- 증거: 원장 #C6 (재현 `_db-audit-commands`).
- 제안: 6행 도달 시 추가 UI 비활성 + "전투 명령은 최대 6개입니다" 인라인 사유. 공수 **S**. quick.

**제안 5 — 이름 칸 상한·행 말줄임 통일** (원장 FAM-name-overflow-uncapped, S3×B2)
- 문제: classes만 maxlength=12(소스: `databaseClassRecordView.ts:79`), 나머지 7+탭 무제한 → 100자 CJK가 목록 행을 10배 오버플로. 같은 칸이 탭마다 3가지 거동.
- 증거: 원장 #FAM-name-overflow-uncapped (mergedFrom 9건).
- 제안: 전 탭 공통 maxlength(예: 24) + 목록 행 CSS `text-overflow: ellipsis` + 남은 글자 힌트. 공수 **S**. quick.

**제안 6 — 도크 탭에 라벨/타이틀 부여** (원장 FAM-untitled-dock-tabs, S2×B3 / 휴리스틱 21·5)
- 문제: `appendTabButton`(`src/editor/panels/database.ts`)이 title을 설정하지 않아 도크 레일이 무라벨 숫자 배지로 퇴화 — 초보자는 어느 배지가 어느 탭인지 알 수 없음.
- 증거: [p1-dock-beginner-rail-unlabeled-counts-only.png](../../.superpowers/sdd/qa-shots/db-audit/p1-dock-beginner-rail-unlabeled-counts-only.png), 원장 #FAM-untitled-dock-tabs.
- 제안: `appendTabButton`에서 `uiLabel` plain 명칭으로 `title`+`aria-label` 설정, 도크 레일에 hover 툴팁. 공수 **S**. quick.

**제안 7 — 모달 푸터 뷰포트 고정** (원장 FAM-zoom150-overflow, S2×B3)
- 문제: 150% 줌 + 1024에서 저장/닫기가 뷰포트 밖으로 밀려남(양 모드).
- 증거: 원장 #FAM-zoom150-overflow.
- 제안: `.database-modal-window`에 max-height:100vh + 내부 스크롤, 푸터 sticky. 공수 **M**. visual-engineering.

**제안 8 — 초보 레일에 자료집 입구 추가** (원장 R4-no-rail-entry, S2×B3 / 휴리스틱 1)
- 문제: 초보 아이콘 레일에 DB 입구가 없고 `toolbar-database`는 숨김 — 유일 경로가 도구 메뉴.
- 증거: 원장 #R4-no-rail-entry, 소스 확인(`basicLeftRail.ts`에 'database' 0건).
- 제안: `basicLeftRail.ts`에 '자료' 레일 항목 추가(`uiCopy.ts` databaseShort plain 재사용). 공수 **S**. quick.

### 미충족 휴리스틱 잔여분 (P0/P1과 미중복)

**제안 9 — jargonStyle을 DB 패널 전체에 배선** (휴리스틱 6 / 원장 R3, VQA-legacy-form-family-jargon, VQA-monsterspecies-raw-ids, VQA-animations-debug-header)
- 문제: DB 패널의 `uiLabel` 호출이 1곳뿐. 레거시 폼 3탭이 `저장 위치=database.terrains` 같은 내부 경로를 폼 필드로 노출, 종족·애니메이션이 raw id/연결 문자열 헤더 노출.
- 증거: [p2-terrain-beginner-legacy-jargon.png](../../.superpowers/sdd/qa-shots/db-audit/p2-terrain-beginner-legacy-jargon.png), [p2-monsterspecies-beginner-raw-ids.png](../../.superpowers/sdd/qa-shots/db-audit/p2-monsterspecies-beginner-raw-ids.png), [p2-animations-beginner-debug-header-crushed-table.png](../../.superpowers/sdd/qa-shots/db-audit/p2-animations-beginner-debug-header-crushed-table.png).
- 제안: DB 라벨 전부 `uiLabel` 경유로 리라우팅; 초보 모드에서 편집/저장 위치 행 숨김; 인스펙터 헤더를 "이름 (번호)" 포맷으로 재구성; 타입 체크박스 한국어화. 공수 **L**. deep.

**제안 10 — 결과 서술형 확인·참조 명명 확장** (휴리스틱 10·18 / 원장 MAT-B3, A6)
- 제안: 파괴 확인문에 대상·영향(누가 깨지는지) 명시 — typeChart 비우기 경고, 캐릭터 삭제 시 참조 이벤트 이름(맵/좌표) 나열(캐릭터 탭 '사용 중인 이벤트' UI 재사용). 공수 **M**. deep.

**제안 11 — 필드 지원 안내 확대 + 맥락 도움말** (휴리스틱 22 / 원장 X5, D7)
- 제안: `databaseFieldSupport.ts`의 `db-field-support-notice`를 스킬/상태/주인공/시스템으로 확장; 0건 결과에 "필터 '약'과 검색어가 함께 적용 중 — [모두 해제]" 빈 상태 카드; D7류 비활성 컨트롤에 사유 툴팁. 공수 **M**. deep.

**제안 12 — DB 첫 성공 코치마크** (휴리스틱 23)
- 제안: `coachMarks.ts` 패턴 재사용, 첫 DB 오픈 시 4단계(주인공 탭 → 추가 → 이름 → 자동 저장 확인) 투어. 공수 **M**. visual-engineering.

**제안 13 — 예제 콘텐츠 표식** (휴리스틱 24)
- 제안: freshProject 샘플 레코드에 '예제' 배지(개요 칩 + 목록 행), crops류 빈 탭에 스탬프 탭 스타일 안내 배너 이식. 공수 **S**. quick.

**제안 14 — 1024 반응형·도크 레이아웃 정비** (휴리스틱 21 잔여 / 원장 VQA-1024-right-column-clipped, VQA-system-dock-member-pickers-missing, VQA-battlecommands-panel-overlap, FAM-troops-layout-intercept)
- 증거: [p2-elements-beginner-right-column-clipped-1024.png](../../.superpowers/sdd/qa-shots/db-audit/p2-elements-beginner-right-column-clipped-1024.png) vs [backlog-elements-beginner-1440-reference-full.png](../../.superpowers/sdd/qa-shots/db-audit/backlog-elements-beginner-1440-reference-full.png), [p2-system-beginner-dock-member-pickers-missing.png](../../.superpowers/sdd/qa-shots/db-audit/p2-system-beginner-dock-member-pickers-missing.png), [p2-battlecommands-beginner-overlap-and-jargon.png](../../.superpowers/sdd/qa-shots/db-audit/p2-battlecommands-beginner-overlap-and-jargon.png), [p2-troops-beginner-list-overlaps-actions.png](../../.superpowers/sdd/qa-shots/db-audit/p2-troops-beginner-list-overlaps-actions.png).
- 제안: 인스펙터 열 min-width+wrap 반응형화, 도크 시스템 탭 피커 복원, battleCommands fieldset 겹침·troops 목록 위치 버그 수정. 공수 **M~L**. visual-engineering.

## 4. 퀵윈 (저공수·고효과)

| 제안 | 공수 | 근거 |
| --- | --- | --- |
| 도크 탭 title/aria-label (제안 6) | S | P1, 한 함수 수정 |
| 초보 레일 자료집 입구 (제안 8) | S | P1, 휴리스틱 1 해소 |
| 전투 명령 6행 상한 (제안 4) | S | P1 |
| 이름 maxlength+말줄임 통일 (제안 5) | S | P1, 9건 병합 근인 |
| timeSystem 참조 가드 (제안 1) | S | **P0**, 스캔 사이트 1개 추가 |
| 0건 빈 상태 힌트 (제안 11 일부) | S | 양 모드 confirmed |
| 예제 배지·빈 탭 배너 이식 (제안 13) | S | 스탬프 탭 패턴 재사용 |

## 5. 비목표·미검증 명시

- **비목표**: 본 캠페인은 무수정 원칙(ZERO src/** edits)이었다 — 모든 항목은 제안이며 구현물이 없다. 기존 기능 축소 제안 없음. LegacyDb 쓰기 없음.
- **시딩 한계로 미검증**: E8 타입 32개 상한(프로브 타임아웃, 재실행 2회 모두), chrome 스펙 F2/F3/F6(테스트 3 900초 타임아웃 — F1/F4/F5/F7은 영구 qa-overview가 증명, R1은 기준선 pre-existing).
- **unconfirmed-vqa 25건**은 기능 프로브 미대응 시각 관찰이다(예: 1024 절단, 도크 피커 소실). S≤2 캡을 적용했고 결함 확정 수에 넣지 않았다 — 후속 구현 플랜에서 기능 재현 스펙으로 승격을 권한다.
- **기준선 유래 8건**(pre-existing)은 캠페인 이전부터 빨간불 — 회귀가 아니다(qa-actors/troops/terrain CRUD 타임아웃, db-desktop-matrix 레코드 카드 미탐지 등).
- 시각 리뷰(todo 15)·원장 통합(16)·본 보고서(17)는 공급자 크레딧 소진으로 워커 위임이 불가해 감독자가 직접 수행했다 — 독립 검증 저하는 F1 감사에서 가중 심사 대상으로 기록되어 있다.
