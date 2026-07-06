# 에이전틱 RPG Maker 2003 v2 — 비판적 분석과 차세대 명세

> 작성: 2026-07-06, Claude Fable 5 (팀 리더). 근거: 5개 영역 병렬 코드 분석(에디터/런타임/이벤트/에이전트/데이터) + handoff.md + docs/specs.
> 상태: **합의 확정** — codex(GPT-5.5)·agy(Gemini) 3단 토론(비판→반론/절충→비준) 완료, 양 패널 만장일치 비준(유보 없음). 합의문은 §6.
> 모든 주장에는 file:line 근거가 있으며, 토론 참여자가 코드베이스에서 직접 검증함.

---

## 0. 요약

rpg-zzu는 이미 "AI 어시스턴트가 달린 RM2003 클론"으로는 완성 단계다(Phase 0~5 완료: 툴 76종, dry-run→lint 게이트→수락, 퀘스트 컴파일러, 헤드리스 워크스루, evals). 그러나 2026년 기준 "**에이전틱 게임 엔진**"으로 보면 다음 6개 구조적 결함이 있다:

1. **성능 절벽**: 편집 1회 = 전체 프로젝트 deep clone + 전체 맵 Phaser 오브젝트 재생성 + 전체 프로젝트 undo 스냅샷. 128×128에서 이미 한계, AI 툴은 상한 없이 500×500 생성 가능.
2. **저작>실행 괴리**: 에디터는 RM2003 명령 108종 저작 가능, 런타임은 39종만 완전 실행(부분 20, 스텁/셸 29). 사용자는 "조용히 무시되는" 명령을 알 수 없음.
3. **에이전트가 브라우저 탭에 갇힘**: 헤드리스 "프롬프트→게임" 파이프라인 없음, MCP 서버 없음, 멀티에이전트 분업 없음, 에셋 생성 없음, 라이브 evals 통과율 25%(소형 모델).
4. **협업 부재**: 인증/RLS 전무(anon key = 전권), 실시간 채널 0, 맵 단위 잠금+저장 시 병합뿐. project_commits 등 git 유사 테이블은 미배선.
5. **결정론 부재**: 필드/전투 RNG가 시드 없는 Math.random() — 리플레이/재현/에이전틱 QA의 신뢰성 기반이 없음.
6. **NPC/전투 AI 1990년대 수준**: fixed/random 무브루트 + 페이지 분기. 몬스터 AI는 "첫 스킬 아니면 평타". RM2003 원본의 행동 패턴 테이블조차 미달.

v2의 방향: **"단일 어시스턴트가 달린 에디터" → "게임을 만들고·검증하고·플레이테스트하는 에이전트 팀의 플랫폼"**. 단, 기존 자산(툴 레지스트리, 커밋 게이트, 워크스루 러너, 인터프리터 코어)은 재구축이 아니라 승격한다.

---

## 1. 현재 상태 — 검증된 사실

### 규모/스택
- Vite + TS + Phaser 3, 프레임워크 없는 바닐라 DOM. 537 파일 / ~92K LOC. 테스트 243파일.
- src/editor 48K(52%), src/project 20K, src/player 14K, src/ai 3.2K, src/battle 2K.

### 이미 구축된 에이전틱 자산 (재구축 금지 — 승격 대상)
- **툴 레지스트리**: 76툴(쓰기 49/읽기 27) + set_build_spec. 순수함수, 헤드리스 실행 가능 설계. `src/editor/tools/toolRegistry.ts:28`, `toOpenAiTools()`.
- **안전 파이프라인**: dry-run → structuredClone draft → `commitChangeset`(`changeset.ts:137`) → projectLint 게이트(error 시 거부) → undo 체크포인트.
- **AssistantSession**(`src/ai/assistantSession.ts:191`): proposal/수락 모델, 자가수정(lint issues 재반환), 스펙 게이트(공간 작업 구역 격리, 3실패 폐기), 멀티모달 비전(타일/맵 이미지 주입), 감사 로그(리플레이 가능).
- **검증 툴**: run_lint, check_reachability, simulate_battle(mulberry32 시드), tune_enemy(데미지 공식 역산), play_walkthrough(브라우저 없는 완주 검증), validate_structure.
- **지식 축적**: 타일 시맨틱/지형 템플릿/클러스터 규칙을 인터뷰·시연으로 학습해 프로젝트에 저장하는 툴군(테치-바이-데모 포함).
- **evals**: 골든 10종 + 오프라인 CI 채점 + 라이브 러너. 라이브 passRate 0.25 (gemini-3.1-flash-lite, 4태스크).
- **인터프리터 코어**: 스택 머신(중첩/루프/라벨/병렬/자동/커먼이벤트), 컴파일타임 kind 레지스트리(`commandKindRegistry.ts`), 순수·동기·완전 단위테스트.

### 축별 상세 결함 (근거 요약)

**에디터** — 파일 분해는 양호하나:
- undo = 전체 프로젝트 스냅샷 ×50 (`src/editor/mapEditHistory.ts:62-67`에서 푸시/MAX_HISTORY 적용, :33은 시그니처 헬퍼), store.update()마다 전체 clone (`src/project/store.ts:178`).
- 매 emit마다 전체 맵 재구축: `editSceneRender.ts:41` removeAll(true) + 전 타일 개별 Image 재생성. 컬링/더티렉트/타일맵 배칭 없음. DB 필드 수정에도 맵이 다시 그려짐(store 리스너 공유).
- i18n 0(한국어 하드코딩 ~3,313개), 커맨드 팔레트/미니맵/스플릿뷰/멀티맵 탭/드래그드롭 임포트 없음. a11y 얇음.
- Supabase 하드 커플링: `store.load()` 실패 시 부팅 게이트(DbConnectionRequiredError) — 오프라인 저작 2급.

**이벤트 명령** — 2티어 구조(네이티브 44종 + m2Command 카탈로그 125종):
- 완전 구현 ~39 / 부분(기록+일부 효과) ~20 / 스텁·셸 ~29. "기록만 하고 계속"(recordFallback, `m2Runtime.ts:98`)은 로드 안정성엔 좋으나 사용자에게 무통보.
- 치명 스텁: Wait for All Movement, Stop All Movement, End Event Processing, Erase Event(흐름 제어!), 탈것 전체, 시스템 리소스 교체, Save/Menu 셸(shellAction은 쓰기만 되고 읽는 곳 0), 맵 애니메이션 표시, 전투 명령 11종 중 6종 미실행.
- 버그성 불일치: Key Input Processing 카탈로그 행이 네이티브 inputWait에 미매핑 — 피커에서 만들면 no-op.
- 파라미터/상태 변경류는 `runtime.actors` 버킷에 기록만 되고 실제 액터에 미반영.

**런타임** — 필드/세션/오디오는 충실. 그러나:
- 전투·메뉴·상점·픽처·날씨 전부 DOM 오버레이(전투 적은 `<img>`) — 픽셀 충실도 이질, Phaser 렌더/타이밍과 분리.
- 결정론 0: 인카운터/크리/도주/상태 Math.random() 직접(`src/player/playSceneMovement.ts:342`, `src/battle/battleDamage.ts:36` 등). 리플레이/입력 로그 없음.
- 전투 틱 setInterval(200ms), 이동 raw deltaMs — 고정 타임스텝 없음.
- 메시지 텍스트 코드(\v \c \n) 런타임 미구현(원문 출력). 게임패드 0, 모바일 봉인, 셰이더/포스트FX 0, 루핑 맵/패럴랙스 없음, Scroll Map 무반응, 팔로워 없음.
- 몬스터 AI = skillIds[0] or 평타 + 첫 생존 액터 타깃(`src/battle/runtime.ts:336-353`). row는 저장·메뉴 편집만 되고 전투 무효과.
- 세이브 = localStorage 3슬롯(프로젝트는 클라우드인데 세이브는 로컬 단말) — 오토세이브/썸네일 없음.

**데이터/협업**:
- Project = 단일 jsonb blob, 검증은 경계에서만(세션 중 뮤테이션 무검증), 삭제는 참조 거부(cascade 없음), dangling ref 1개면 오픈 차단.
- Realtime/CRDT/presence 0건(supabase-js조차 없음, raw PostgREST). 저장 시 맵 단위 3-way 머지(같은 맵 = 충돌). advisory 맵 잠금(TTL 2분, 폴링).
- **인증 없음**: anon key 전권, RLS 없음 — 귀속 있는 팀워크는 보안상 불가. project_commits/project_changes/sync_verification_runs 테이블 미배선.

**에이전트**:
- 브라우저 탭 + 사람 수락에 묶임. 헤드리스 "프롬프트→project.json" 엔드포인트 없음(evals는 채점만).
- MCP 서버 없음 — 외부 에이전트(Claude/Codex)가 76툴에 접근 불가.
- 단일 에이전트/단일 모델. 분업·태스크 보드·에이전트 신원 없음. 에셋 생성(이미지/오디오) 0.
- 스킬 이원화: src/ai/skills.ts(런타임 14종) vs rpg_maker_skills/(문서, 미배선). 프롬프트·툴 설명 한국어 온리.

---

## 2. 2026년 기준 비판 — 핵심 판단 5가지

1. **가장 큰 리스크는 기능 부족이 아니라 '신뢰의 배관'이다.** 에이전트가 만든 게임이 (a) 조용한 no-op 없이 실행되고, (b) 시드로 재현되고, (c) 자동 완주로 증명되어야 "에이전틱 메이커"를 신뢰할 수 있다. 저작>실행 괴리와 비결정론이 이 신뢰를 깬다. → 명령 패리티 + 결정론이 화려한 신기능보다 우선.
2. **성능 기반 없이는 에이전트 스케일도 없다.** 에이전트는 사람보다 빠르게·많이 편집한다(툴 시퀀스 수백 콜). O(project)/edit 구조에서는 에이전트가 곧 DoS가 된다. → structural sharing, per-map 히스토리, 증분 렌더는 에이전틱 기능의 전제조건.
3. **에이전트 플랫폼화는 '노출'이 8할이다.** 76툴+게이트+워크스루는 이미 훌륭한 커널이다. 없는 것은 노출 계층: 헤드리스 러너, MCP/HTTP 서버, 잡 큐. 이는 신규 발명이 아니라 기존 순수함수의 배선이다.
4. **협업은 CRDT부터가 아니라 인증부터다.** auth+RLS 없이 presence/CRDT를 올리는 것은 순서 착오. 잠금+맵 단위 머지는 (개선하면) 초기 팀워크에 충분하며, 진짜 격차는 신원(사람/에이전트 공통)과 변경 이력(미배선 commits 테이블)이다.
5. **NPC AI는 '런타임 LLM'이 아니라 '컴파일 타임 지능'이 기본값이어야 한다.** 비용/지연/오프라인/재현성 때문. LLM은 저작 시 페르소나·스케줄·관계를 생성하고, 런타임은 결정적 산출물(다중 페이지, 스케줄 테이블, 행동트리)을 실행한다. 라이브 LLM 대화는 opt-in 확장.

---

## 3. 차세대 명세 (v2 목표)

### 원칙
- P1. 기존 커널(툴 레지스트리/게이트/인터프리터/워크스루) 재사용 — 리라이트 금지.
- P2. 모든 에이전트 쓰기는 기존 changeset 게이트를 통과한다(사람과 동일 경로).
- P3. 런타임에 넣는 모든 것은 결정적이거나 시드 주입 가능해야 한다.
- P4. "저작 가능 = 실행 가능 or 명시적 미지원 배지" — 조용한 no-op 금지.

### E1. 신뢰의 배관 (Foundation)
- **결정론 RNG**: 세션 시드 1개 + 스트림 분리(encounter/battle/move) 주입. Math.random 직접 호출 0건 (lint 규칙). 입력 로그 → 리플레이 파일.
- **명령 패리티 티어제**: 각 카탈로그 명령에 `runtime-full | runtime-partial | editor-only` 배지를 에디터 UI·툴 결과·lint에 노출. 스텁 중 흐름 제어 4종(End Event Processing, Erase Event, Wait/Stop All Movement) + Key Input 매핑 버그 + 텍스트 코드(\v \c \n)를 최우선 구현.
- **성능**: per-map undo(커맨드 패턴 or 맵 단위 스냅샷), store 이벤트에 scope 태그(맵/DB/시스템)로 선택 재렌더, EditScene 더티렉트+Phaser 타일맵 배칭(또는 청크), create_map/import 크기 상한+대형 맵 전용 경로.

### E2. 에이전트 플랫폼 (Agentic Core)
- **헤드리스 파이프라인**: `authorProject(prompt|spec, seed) → project.json + lint 리포트 + 워크스루 증거`를 Node CLI + HTTP 잡 서버(mdc-server 배치)로. evals 러너를 승격.
- **MCP 서버**: 76툴 + 프로젝트 로드/저장을 MCP로 노출 → Claude/Codex/외부 에이전트가 직접 저작. 권한 스코프(read/write/destructive)와 세션 감사 로그 포함.
- **멀티에이전트 오케스트레이션**: 역할 분업(기획→월드→이벤트/퀘스트→밸런스→QA)을 태스크 그래프로. 각 역할은 같은 툴 API + 구역/컬렉션 스코프 잠금. QA 에이전트는 play_walkthrough+simulate_battle 증거를 첨부해야 머지.
- **모델 계층화**: 계획/검증은 상위 모델, 반복 배치는 소형 모델. evals 매트릭스(모델×태스크) 상시 측정, per-tool 성공 텔레메트리.
- **에셋 생성 파이프라인**: 이미지 생성 모델 훅(generatedAssetHarness 재사용) → RTP 규격 슬라이싱/투명키 검증 → Resource Manager 등록. 프록시 규칙 준수.
- **스킬 통합**: rpg_maker_skills/ 문서를 src/ai/skills.ts 레지스트리로 컴파일(단일 소스).

### E3. 팀워크 (사람×사람, 사람×에이전트)
- 1단계: Supabase Auth + RLS(프로젝트 멤버십) + 에이전트도 신원 주체로. 미배선 project_commits/changes를 changeset 커밋마다 기록(작성자=사람|에이전트, 리뷰 상태).
- 2단계: Supabase Realtime으로 presence(누가 어느 맵) + 잠금/커밋 브로드캐스트(폴링 제거). 맵 단위 잠금 유지하되 이벤트/DB 레코드 단위로 세밀화.
- 3단계(조건부): 동일 맵 동시 편집이 실측 병목일 때만 CRDT 검토. 기본 답은 "맵 단위 소유권 + 리뷰 큐".

### E4. 런타임 현대화 (선별)
- 전투 렌더를 Phaser 캔버스로 이전(장기) 또는 DOM 유지+픽셀 스냅 강화(단기) — 토론 안건.
- 고정 타임스텝(시뮬레이션 틱과 렌더 분리), 게임패드+모바일 터치 활성화, 셰이더 기반 화면 효과(틴트/플래시/CRT 옵션).
- 몬스터 AI를 RM2003 행동 패턴 테이블(조건+레이팅)로, row 전투 효과 반영.
- NPC: 시간대 스케줄 테이블(npcLivingTravel 확장) + 관계/지식 카드(villageInfoDocuments 구조화) → 페이지 컴파일. 라이브 LLM 대화는 별도 opt-in 명령.

### E5. UX
- 커맨드 팔레트(Ctrl+P: 맵/이벤트/DB/툴/스킬 통합 검색), 미니맵, 맵 탭/스플릿, 드래그드롭 임포트.
- AI 제안 고스트 프리뷰(캔버스 반투명 diff) + 전/후 diff 뷰어 + 부분 수락.
- i18n 레이어(ko 기본, en 카탈로그) — 툴 설명 이중화로 모델 선택 폭 확대.
- "실행 불가 명령" 배지(E1 연동), 온보딩 투어.

---

## 4. 로드맵 (Phase 6~10)

| Phase | 이름 | 핵심 산출물 | 의존 |
|---|---|---|---|
| **6** | 신뢰의 배관 | 결정론 RNG+리플레이, 흐름제어 4종+텍스트코드+KeyInput 수정, 패리티 배지, per-map undo, scoped 재렌더, 맵 크기 상한 | — |
| **7** | 헤드리스+MCP | authorProject CLI/잡 서버, MCP 서버(권한 스코프), evals 매트릭스 확장(모델×태스크 30+) | 6(결정론) |
| **8** | 팀워크 v1 | Auth+RLS, 신원(사람/에이전트), commits 배선+리뷰 큐, Realtime presence | 7 부분 |
| **9** | 멀티에이전트 스튜디오 | 역할 분업 오케스트레이터, QA 에이전트 머지 게이트, 에셋 생성 파이프라인 | 7 |
| **10** | 런타임/NPC 현대화 | 행동 패턴 전투 AI, NPC 스케줄/관계 컴파일, 고정 타임스텝, 게임패드/모바일, (전투 캔버스 이전?) | 6 |

각 Phase DoD: 기존 스타일대로 테스트+워크스루+evals 증거. Phase 6이 전부의 전제.

---

## 5. 토론 안건 (codex/agy 3단 토론)

1. **우선순위**: Phase 6(신뢰의 배관)을 최우선으로 두는 판단이 옳은가? 아니면 Phase 7(헤드리스+MCP)이 먼저인가 — "에이전트 스케일이 문제를 드러내기 전에 배관을 깔 것" vs "플랫폼 노출이 가치를 먼저 증명".
2. **에디터 아키텍처**: 92K LOC 바닐라 DOM 유지+계약 강화 vs 부분 프레임워크 도입(예: 신규 패널만 Solid/Preact) vs 리라이트. 성능 절벽 해소에 프레임워크가 필요조건인가?
3. **협업 전략**: "auth+커밋 이력+맵 소유권+리뷰 큐"로 충분한가, CRDT(Yjs)를 초기부터 깔아야 하는가? Project 단일 blob 모델과 CRDT의 궁합.
4. **NPC AI**: 컴파일 타임 지능 기본 + 라이브 LLM opt-in이라는 방침에 동의하는가? 라이브 NPC의 비용/일관성 가드는?
5. **전투 렌더**: DOM 유지+개선 vs Phaser 캔버스 이전 — 비용 대비 효과.
6. **RM2003 패리티 범위**: 스텁 29종 전부 구현할 가치가 있는가, 아니면 "패리티 배지 + 선별 구현(흐름 제어/텍스트 코드)"으로 충분한가? 탈것 등 저사용 명령의 우선순위.
7. **모델 전략**: 단일 소형 모델(현 25% 통과) 대신 계층화(계획=상위, 실행=소형)로 갈 때 evals 설계와 비용 통제.

---

## 6. 3단 토론 합의문 (최종 비준: 2026-07-06, codex 찬성·유보 없음 / agy 찬성·유보 없음)

1. **로드맵**: 6A(신뢰 최소셋) → 7A 병행 → 6B(성능) → 8(권한/커밋) → 7B(write 노출) → 9(멀티에이전트/에셋) → 10(런타임/NPC 현대화).
2. **6A 범위**: 결정론 RNG(세션 시드+스트림 분리)+리플레이 시드, 명령 패리티 배지(runtime-full/partial/editor-only)를 에디터·툴 결과·lint에 노출, 흐름제어 4종(End Event Processing/Erase Event/Wait·Stop All Movement), Key Input Processing 카탈로그 매핑 수정, 메시지 텍스트 코드(\v \c \n) 런타임 구현.
3. **7A 범위(코드 레벨 제한)**: read-only 조회 + dry-run diff + 헤드리스 워크스루/eval만. write 경로는 feature flag로도 차단. 성공 지표 = 계획 품질/툴 호출 정확도/검증 실패 감지율.
4. **6B 범위**: store 이벤트 스코프 태깅, per-map 히스토리, EditScene 청크/타일맵 렌더, 성능 예산 고정값 명시(초안: 128×128 편집 반영 p95<16ms, undo 메모리<100MB, 로드<3s@50맵 — 착수 시 실측 보정), create_map/import 크기 상한.
5. **7B 게이트(양보 불가 조항)**: write MCP/잡 큐는 6A + 8 완료 이후에만 개방 — "에이전트가 조용히 깨진 게임을 양산하는" 실패 모드 차단.
6. **에디터**: v2 기간 UI 프레임워크 도입 금지(신규 패널 포함). 성능 예산 미달 실측 시에만 재논의.
7. **협업**: Auth+RLS+멤버십 → 사람/에이전트 공통 신원 → project_commits 배선(작성자/리뷰 상태) + destructive 승인 권한 모델 + Realtime presence. 잠금은 맵 단위 유지. CRDT는 동일 맵 동시 편집 충돌 실측 후 재평가.
8. **NPC/전투**: NPC는 컴파일타임 지능 기본(스케줄/관계/페르소나→결정적 산출물), 라이브 LLM은 opt-in(시드/로그/토큰 예산/fallback 대사 필수). 전투는 DOM 렌더 유지 + 픽셀 스냅 + Phaser↔DOM 뷰포트 동기화 어댑터 + 고정 타임스텝 전환. 전투 상태는 렌더와 분리된 구조화 read model로 노출(에이전트 관찰용). 캔버스 이전은 v2 범위 외.
9. **패리티/모델/에셋**: 스텁 전량 구현 대신 배지+선별 구현. 모델 계층화(계획=상위, 배치=경량) + evals 4축 분리(계획 품질/툴콜 정확도/lint 자가수정/워크스루 통과) + 고가 모델 예산 게이트. generatedAssetHarness를 에디터 툴로 승격(완료 조건: provenance/seed/prompt/promotion 메타 보존). 오디오 생성은 후속.
10. **운영**: 스키마 버전 호환 테스트+롤백 정책을 각 Phase DoD에 포함. 세션 중 에이전트 쓰기에도 shape 검증 적용. 오프라인 로컬 어댑터(읽기 전용 폴백부터). 관측성 텔레메트리(edit latency/clone 비용/redraw count/워크스루 러닝타임).

### 진행 기록
- **2026-07-07 C.2 웨이브 1 완료** (`feat/phase-6a` 4700149, 1666 tests green, perf:bench 전 항목 PASS): 에이전트 QA 백로그 3건 — ①AI 프로포절 수락 시 대상 맵 자동 포커스+편집 영역 하이라이트(agentFocus.ts, 수동 편집 무영향, 실수락 경로 프로브 실증) ②진짜 빈 프로젝트(createBlankProject 20×15 빈 맵 1개, 예제는 createSampleAdventureProject/"예제로 시작" 분리) ③place_npc SimplePage 관용 파싱+모델 친화 에러(정규화 warning 노출). 감독 통합 교정 2건: bare ?freshProject=1 레거시(예제) 계약 복원 — 빈 프로젝트는 ?blankProject=1 신설(e2e 32개 스펙 보호), W5 로그인 모달이 자동화 부팅에서 클릭 가로채던 회귀 억제. codex 워커 반려 1건(vitest 타임아웃 완화). 잔여 백로그: 흙길 타일, 스펙 게이트 slack, 모델 계층화, 고스트 프리뷰, 완성도 린트.
- **2026-07-07 W5 팀 워크플로 UI 완료** (`feat/phase-6a` 486a46d, 1649 tests green, 비전 QA 11/11 PASS): 로그인 목업 모달(이메일/OAuth 이름/게스트 — 실 인증 없음, 신원 label localStorage만), topbar 신원 표시+라벨 편집 메뉴, 커밋 히스토리 패널(list_project_commits 읽기 전용, 실 Supabase 20행 확인), 맵 잠금 배지 라벨 구체화. 감독 비전 QA 적발 1건 수정: 신원 메뉴 내부 클릭이 document pointerdown 닫기에 삼켜져 라벨 변경/재로그인 불능(실브라우저 전용 — 유닛 fake DOM 미검출). Phase 8 실 Auth/RLS 스위치오버 전까지 목업 전용.
- **2026-07-07 UI/UX 웨이브 완료** (`feat/phase-6a` 6cdfbf6, 1645 tests green): ①대화 페이지네이션(저작 개행 존중+창 폭 래핑+4줄 페이지 분할+▼ 커서) ②Galmuri 픽셀 폰트(런타임 표면 전용) ③윈도우 스킨 9-slice 일괄 교체 ④커버 스케일 max(1,ceil(w/320),ceil(h/240)) — 여백 0 ⑤성문 playerTouch는 ⑦의 증상으로 확정 ⑥e2e 부활(AI 도킹 패널 레이아웃 수정) ⑦readState 세션 스테일 훅 수정. 잔여 리스크 5건은 handoff 참조.
- **2026-07-06 웨이브 4 완료** (`feat/phase-6a` f359ef8, 1628 tests green): ①store.updateMap structural sharing — 페인트 파이프라인 p95 35.7ms→8.1ms, **16ms 예산 복귀**(aliasing 가드 테스트 포함) ②runtime-partial 5종 승격(Change Parameters/State/Damage Processing 세션 실반영, Scroll Map 카메라, Change Actor Graphic) ③**commit_identity 마이그레이션 실 DB 적용 완료**(supabase-db, PostgREST 스모크 통과 — 커밋 이력 라이브) ④Phase8 결정사항 확정 기록(이메일 로그인/owner 백필/viewer read-only/RPC owner 부여).
- **2026-07-06 웨이브 3 완료** (`feat/phase-6a` f344fa5, 1617 tests green): ①성능 벤치 하네스+실측 예산 확정(파이프라인 p95 40ms 잠정/로드 500ms — 16ms 복귀는 전체 clone 제거 최적화 백로그) ②project_commits/changes 실배선 — EditorIdentity(human/agent), AI 수락=approved/직접=direct, fire-and-forget, list_project_commits 툴 ③Auth/RLS DRAFT SQL+롤아웃 5단계 문서(미적용, 열린 질문 5건). **사용자 결정 대기**: commit_identity 마이그레이션 실 DB 적용, Auth 방식(이메일/OAuth), 기존 프로젝트 owner 지정.
- **2026-07-06 Phase 6B+7A 완료** (합의문 조항 3·4 대부분): branch `feat/phase-6a` (c455034), 1614 tests green. ①렌더 계약 — store 변경 스코프 도입, 단일 셀 페인트 16,384→5 오브젝트, DB 편집 시 맵 리드로우 0 (acf279d). ②per-map undo — 50벌 메모리 41.4MB→0.65MB, 맵 256×256 상한+lint (76f1c75, c455034). ③7A 헤드리스 CLI+MCP stdio 서버 — 76툴 노출, 쓰기 49툴 dry-run 강제, commit 경로 정적 부재 가드 (4ce8165). 잔여: 성능 예산 p95 실측 벤치, Realtime/Auth(8단계).
- **2026-07-06 Phase 6A 완료** (합의문 조항 2 전체): branch `feat/phase-6a` (e2efe94). 결정론 RNG(ba7f5fd) + 패리티 배지(b6c97e7) + 흐름제어4/KeyInput/텍스트코드(359e7a1). 1594 tests green, tsc clean, 비전 QA 증거 `evidence/phase-6a-vision-qa/`. 체제: codex 구현 ×3 병렬(worktree 분리) + Claude 감독 리뷰(반려 1건: \v[n] 변수 ID 불일치) + agy 비전 QA.

### 토론 경과 기록
- R1(비판): agy — Phase 7 선행 주장, 프레임워크 혼합 반대, DOM 전투 유지(에이전트가 DOM을 직접 읽어 비전 비용 절감), 누락 3건(세션 중 shape 검증/뷰포트 동기화/오프라인 어댑터). codex — 사실 정정 2건("에셋 생성 0" 부정확: generatedAssetHarness 존재, "단일 blob" 과도), 6A/6B 분할+7A 삽입 대안, 누락 3건(마이그레이션 롤백/승인 권한 모델/성능 수치 예산).
- R2(절충): 리더 절충안(6A→7A 병행→6B→8→7B→9→10) — agy 전면 수용, codex는 7A 코드 레벨 write 차단 + 전투 read model 분리 + 에셋 provenance 완료조건을 수정 요구.
- R3(비준): codex 수정 요구 전부 반영 → 양 패널 만장일치 찬성, 유보 없음.
