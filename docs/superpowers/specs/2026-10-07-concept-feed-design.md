# 새 게임 = 컨셉 피드 (2026-10-07)

## 왜

- 게임을 시작하는 입구가 셋이었다(런처 「새 게임」, 메뉴 「새 프로젝트」 모달, 편집기 환영 화면). 모양도 묻는 것도 달랐다.
- AI 경로는 장르 4개 → 장면 질문 5개 → 요약 인터뷰라 「바로 만든다」는 느낌이 없었다.
- 프리셋은 8개 중 3개만 보였고, 「장르 + 설명 한 줄」 카드라 고를 맛이 없었다.
- 「월드맵」은 만들 게임과 무관한 반복 영상(`world-motion.mp4`)이었다.

## 결정 (사용자, 2026-10-07)

| 항목 | 결정 |
|---|---|
| 형태 | 유튜브 홈 같은 컨셉 피드. 썸네일 격자 + 분류 칩 + 위쪽 입력창, 내리면 계속 불러온다(무한 스크롤) |
| 컨셉 수 | 공식 200개 이상. 웹소설 클리셰·패러디(몸이 뒤바뀐 악역영애, TS 금발 라이벌 도련님, 마법사 in 조선, 내가 쓰는 판타지 소설, 파이널 판타지아 999)와 정통 장르(정통 JRPG, 몬스터 수집, 추리 …) |
| 썸네일 | 생성형 이미지, **SNES 16비트 도트 화풍**(애니 일러스트 B안과 비교 후 「도트가 무조건 낫다」) |
| 누르면 | 상세 페이지(큰 키아트, 「이런 게임이 됩니다」, 「살짝 바꾸기」, 비슷한 컨셉, 「▶ 이 게임 만들기」) |
| 컨셉 위치 | 스토어 서버(store.openrpgmaker.com)에서 받는다. 앱에는 오프라인 비상용 20개만 넣는다 |
| 공식 컨셉 제작 | AI가 약 300개를 만들고 **사용자가 받기/버리기**로 고른다. 받은 것만 게시 |
| 공유(2단계) | 사용자가 컨셉 카드(프롬프트·썸네일·제목)를 올리고 남이 그걸로 만든다. 만든 게임 자체 공유는 하지 않는다 |
| 원작 이름 | 원작 이름·고유 색 조합은 쓰지 않는다. 누가 봐도 알아보는 패러디 이름으로 |
| 묻는 것 | 이름·폴더·화면 크기는 묻지 않는다. 이름 = 컨셉 제목, 폴더 = 기본 위치, 화면 = 와이드 |

## 화면

### 피드

- 맨 위 입력창 「만들고 싶은 게임을 적어 보세요」.
  - 치는 동안 검색어로 컨셉을 거른다.
  - 결과 맨 앞에 늘 「✏️ 내가 쓴 걸로 만들기」 카드가 붙는다(입력이 있을 때만).
- 분류 칩: 전체 · 웹소설 · 패러디 · 퓨전 사극 · 정통 JRPG · 몬스터 수집 · 추리 · 연애 · 호러 · 힐링 · 농장 · 액션.
- 런처에서만 「이어하기」 줄: 최근 프로젝트 가로 한 줄(표지 그림 재사용). 편집기 안에서는 숨긴다.
- 격자: 16:9 썸네일, 제목, 한 줄 훅, 장르 틀 배지, `#분류`. 24개씩, 끝에 닿으면 다음 쪽.
- 맨 아래 작은 링크 「빈 프로젝트로 시작」(런처는 추가로 「폴더 열기」·「팀에 참여」를 위 막대에 둔다).

### 상세

- 큰 키아트, 제목, 훅, 설명.
- 「이런 게임이 됩니다」: 장르 틀, 주인공, 무대, 첫 장면.
- 「살짝 바꾸기」(선택, 300자): 예 「주인공을 고양이로」.
- 오른쪽 「비슷한 컨셉」: 같은 분류·같은 틀에서 6개.
- 「▶ 이 게임 만들기」.

### 「내가 쓴 걸로 만들기」

- 입력 문장으로 AI가 컨셉 한 장(제목·훅·설명·틀·주인공·무대·첫 장면·브리프 5칸)을 쓴다. AI 연결이 필요하다.
- 상세 페이지가 바로 열리고, 썸네일은 뒤에서 생성한다(약 45초, 실패하면 틀별 기본 그림). 만들기는 썸네일을 기다리지 않는다.

## 입구 통합

| 입구 | 지금 | 바뀐 뒤 |
|---|---|---|
| 런처 첫 화면(최근 있음/없음) | 로비 히어로 / 인터뷰 | 피드(화면 전체) + 「이어하기」 줄 |
| 런처 「새 게임」 | 예제·AI·빈 프로젝트 → 확인 화면 | 피드 |
| 편집기 메뉴 「새 프로젝트」 | 2단계 모달 | 피드 창(덮는 창) |
| 편집기 환영 화면(빈 프로젝트 첫 부팅) | 장르 포스터 + 입력 | 피드 창. 만들기는 지금 열린 빈 프로젝트에 적용 |

같은 컴포넌트 `src/start/conceptFeed/`를 쓴다. 차이는 「만들기」 처리기만이다.

## 만들기 → 생성

- 컨셉 → `GameDesignBrief`(`conceptBrief(concept, tweak)`):
  - `presetId` = 컨셉의 틀(`GamePresetId` 8개 중 하나).
  - `answers` 5칸 = 컨셉의 브리프 5칸(`source: "recommended"`).
  - `summary` = `gameDesignSummary(answers)` + 「살짝 바꾸기」가 있으면 마지막 줄 `사용자 변경: …`.
  - 새 선택 필드 `concept: { slug, title, hook, tweak? }`. 정규화·저장·재로드를 거친다.
- 이후는 이미 있는 경로를 그대로 쓴다: `generationPending: true` 로 심고 `prepareProjectInterviewStartup` 이 뼈대·저장·팀 첫 생성을 넘긴다.
  - 런처: `bridge.suggestProjectDir({title})` → `bridge.createProject` → `writeStartScreenIntent({startMode:"ai", choiceId: presetId, gameDesignBrief})` → 편집기.
  - 메뉴: `createProjectStartSeed(presetId, title, "ai", "wide")` + brief → `createProjectFolderWithSeed` → 다시 읽기.
  - 환영 화면: 지금 열린 빈 프로젝트의 `system` 을 그 틀의 씨앗으로 바꾸고 brief 를 심는다(`runStartScreenPresetInterview` 의 적용 부분과 같다).
- AI 연결 확인은 지금처럼 만들기 직전 `ensureAiConnectedForPreset` 으로 한다. 거절하면 폴더를 만들지 않는다.
- 「만든 사람」 수: 만들기에 성공하면 스토어에 한 번 알린다(실패해도 무시).

## 컨셉 데이터 (`oprn-concept/1`)

```ts
type GameConcept = {
  slug: string;                 // 소문자·숫자·하이픈, 3~80자
  title: string;                // ≤40
  hook: string;                 // ≤120
  description: string;          // ≤600
  tags: string[];               // 분류 1~4개 (CONCEPT_TAGS 중)
  presetId: GamePresetId;       // 장르 틀
  protagonist: string;          // ≤120
  stage: string;                // ≤120
  firstScene: string;           // ≤160
  brief: Record<GameBriefSlot, string>; // 각 ≤1000, 조수에게 가는 기획 5칸
  tilesetHint?: string;         // 번들 타일셋 id (joseon_baram, wizarding_world, jp_city …)
  thumb: { full: string; card: string }; // 960×540 webp, 480×270 webp (스토어는 blob sha, 번들은 경로)
  locales?: Partial<Record<"en"|"ja"|"zh", { title; hook; description }>>;
  source: "official" | "user";
  author?: { name: string };
  madeCount?: number;
  aiGenerated: true;
};
```

정본 타입·검증은 `src/concepts/format.ts`(순수, 서버·앱·하네스 공용).

## 서버 (store-server)

- `migrations/006_concepts.sql`: `store_concepts`(slug unique, 위 필드, `full_sha`·`card_sha` → `store_blobs`, `status` visible/hidden/pending, `made_count`, `created_at`, `author_id` null=공식).
- 읽기(익명):
  - `GET /api/v1/concepts?tag=&q=&preset=&cursor=&lang=` → `{ items, nextCursor }` 24개씩. 정렬: 공식은 `rank`, 이후 최신.
  - `GET /api/v1/concepts/:slug` → `{ concept, similar[6] }`.
  - `POST /api/v1/concepts/:slug/made` → 204. IP·slug 당 하루 1회만 센다.
- 쓰기:
  - 공식 게시: 운영자 토큰으로 `POST /api/v1/admin/concepts`(그림 blob 은 기존 `POST /api/v1/blobs`).
  - 2단계 사용자 게시 `POST /api/v1/concepts`: 로그인 + 기존 보류 낱말·AI 표시·신고 3명 숨김을 그대로 쓴다. 이번 범위에서는 만들지 않고 표·필드만 준비한다.
- 웹 페이지에도 `/concepts` 목록을 둔다(공유 링크 대상). 이번 범위는 읽기 전용 목록만.

## Electron 중계

- 렌더러는 스토어와 직접 통신하지 않는다(기존 원칙). 채널 `storeConcepts`·`storeConcept`·`storeConceptMade` 를 더하고, 썸네일은 기존 blob 경로(`sha256` 검사, `userData/store` 캐시)를 쓴다.
- 런처 브리지(`window.oprn.start`)에서도 부를 수 있게 같은 함수를 노출한다.
- 웹 편집기·팀 호스트 브라우저: 스토어 중계가 없으므로 번들 20개만 보인다.

## 비상용 번들

- `public/assets/concepts/` 에 받은 컨셉 중 20개(분류마다 고르게)의 `card` 썸네일과 `src/assets/bundledConcepts.json`.
- 오프라인·스토어 오류·웹에서는 이것만 보여 주고 「더 보려면 인터넷 연결」 한 줄을 붙인다.

## 공식 컨셉 하네스 `game-concepts`

`src/harnesses/game-concepts/` (규칙은 `openwiki/harnesses/README.md`).

| 단계 | 하는 일 |
|---|---|
| `produce --count N` | 시드(`harness-data/game-concepts/seed.json`: 분류별 목표 수·예시 제목·금지 원작 낱말)로 AI가 컨셉 JSON 을 쓴다. 중복 제목·slug 거름 |
| `draw` | 컨셉마다 도트 썸네일 생성(앱 그림 경로 `/v1/images/generations`, 인터뷰 그림 규칙 재사용). 960×540/480×270 webp |
| `check` | 형식 검증 + 원작 닮음 검사(금지 낱말, 그림 비전 판정: 원작 고유 색·문장·로고). 실패는 다시 그리기 1회 후 탈락 표시 |
| `serve` | 검수 페이지(받기/버리기, 현재 그림 해시에 묶임). 포트 18321 |
| `status` | 분류별 받음/버림/대기 수 |
| `publish --target staging|prod` | 받은 것만 스토어에 올린다. `prod` 는 명시 스위치 |
| `bundle` | 받은 것 중 20개를 앱 비상용 번들로 굽는다 |

- 데이터는 저장소 밖 `GC_HARNESS_DATA`(기본 `~/oprn-harness-data/game-concepts`)에 둔다. 사람의 선택 정본은 그 안의 `decisions.json`.
- 감독(에이전트)은 대신 고르지 않는다.

## 지우는 것

- UI 에서 내린다: 인터뷰(`projectInterviewDialog` 의 새 게임 경로, `startInterview`), 첫 세계 화면(`firstWorldArrival`), 로비(`startLobby`), 새 프로젝트 모달(`newProjectDialog`), 환영 화면 포스터(`editorWelcome`).
- 더 쓰는 곳이 없으면 파일·테스트·CSS·`world-motion.mp4`·`world-poster.webp` 까지 지운다.
- 남긴다: `NEW_PROJECT_CHOICES`(장르 틀 목록 — 조수 도구 계약이 참조), `gameDesignBrief`·`prepareProjectInterviewStartup`, 메뉴 「게임 기획」 편집(`showProjectInterview` 의 기획 수정 용도).

## 다국어

- 화면 문구는 ko 원문 + en/ja/zh 카탈로그(`openwiki/i18n.md` 절차).
- 컨셉 본문은 `locales` 가 있으면 그 언어, 없으면 한국어.

## 확인

- 브라우저 증거 `verify-shots/concept-feed/`:
  - 런처 피드 → 무한 스크롤 → 상세 → 만들기 → 편집기에서 조수 첫 생성 시작.
  - 메뉴 「새 프로젝트」·환영 화면이 같은 창을 연다.
  - 스토어를 끊으면 비상용 20개 + 안내.
- 정본 저장: 만들기로 생긴 프로젝트의 `gameDesignBrief.concept` 가 `project.sqlite` 저장 → 재로드 뒤 남는다.
- 서버: store-server 통합 테스트에 컨셉 목록·커서·상세·made 카운트.
- 테스트는 쓰되, 워크트리 세션 규칙상 vitest·gates 실행은 사용자가 요청할 때만.

## 범위 밖

- 2단계 사용자 공유 UI·게시(표·필드만 준비).
- 만든 게임 자체 공유·플레이.
- 컨셉 추천 개인화.
