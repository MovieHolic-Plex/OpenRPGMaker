# 2026-07-07 '세계관' 시스템 설계 — 마을 증거 문서의 재개념화

> 사용자 브레인스토밍 합의 (2026-07-07). 배경: 기존 '증거' 개념(aiPreview 기술 증거 + '증거 패킷' 스텁)은
> 에셋 검증 로그일 뿐, 게임의 세계관·개체·관계·AI 참고 지식을 담는 그릇이 없다.
> 이를 LLM wiki + 온톨로지 + AI 제작 참고 문서 + 게임 세계관을 담는 1급 시스템으로 재설계한다.
> 사용자 표면 어휘는 **"세계관"** 하나 — '증거'라는 말은 사용자 눈에서 제거한다.

## 합의된 축 (사용자 확정)
1. **진실 원천**: 온톨로지 우선 + 위키 뷰 (구조화 개체/관계가 원천, 위키 문서는 렌더링된 뷰)
2. **유지 주체**: AI 자동 유지 + 사용자 승인 (에이전트가 게임 개체를 만들 때 세계관 upsert를 같은 프로포절에 동봉)
3. **구속력**: 3단계 lint 연동 (강=참조 무결성 error / 중=설정 모순 warning / 약=톤·규범 info)
4. **범위**: 설정(lore) + 제작 규범(guideline) 통합 — 한 온톨로지, UI 탭만 분리
5. **기존 증거**: 내부화 — 기술 증거는 "생성 검증 상세" 아코디언(기본 접힘)으로 격하, '증거 패킷' 버튼은 '세계관' 버튼으로 교체

## 데이터 모델
저장 위치: `project.world` (project.json에 포함 → Supabase 동기화·버전관리 상속). 코드: `src/project/world/`.

```ts
type WorldEntityType = "character" | "place" | "faction" | "event" | "item" | "concept" | "guideline";

type WorldRef = { kind: "map" | "event" | "item" | "skill" | "actor"; id: string };

type WorldEntity = {
  id: string;                // "w_" prefix
  type: WorldEntityType;
  name: string;
  summary: string;           // 1줄 — LLM 다이제스트에 항상 포함
  body?: string;             // 마크다운 서사 (위키 본문)
  tags?: readonly string[];
  refs?: readonly WorldRef[];        // 실제 게임 개체 링크
  origin: "user" | "ai" | "interview";
  locked?: boolean;          // 사용자 잠금 — AI 덮어쓰기 금지 (upsert 시 거부)
};

type WorldRelationKind = "memberOf" | "locatedIn" | "knows" | "enemyOf" | "allyOf" | "causedBy" | "owns" | "custom";
type WorldRelation = { a: string; b: string; kind: WorldRelationKind; note?: string };

type ProjectWorld = { entities: readonly WorldEntity[]; relations: readonly WorldRelation[] };
```

- `guideline` 타입 = 제작 규범 (톤/문체 가이드, 타일 사용 관례, 연출 규칙). 나머지 6타입 = lore.
- 마이그레이션: `project.world` 부재 시 shape guard가 빈 world로 정규화. 기존 프로젝트 무손상.
- 기존 `src/project/ontology/`(코드베이스 개발 온톨로지)와는 별개 시스템 — dev 전용임을 openwiki에 명확화.

## AX — 에이전트 경로
- **상시 주입**: `contextBuilder`가 세계관 다이제스트(이름+타입+summary 압축, 토큰 상한제)를 매 턴 포함.
- **툴 3종**: `query_world`(필터/텍스트 상세 조회), `upsert_world_entities`, `link_world_ref`.
  전부 기존 프로포절 파이프라인 통과 — 프로포절 카드에 세계관 diff 표시, 수락/거부 대상.
- **자동 유지 규칙**: NPC/맵/아이템 생성 프로포절에 세계관 upsert 동봉. `proposalCompleteness`에
  "세계관 미기재" 경고 추가 (기존 완성도 린트 프레임 재사용).
- **locked 개체**: AI upsert 거부 + 툴 결과에 사유 반환.
- 프로젝트 생성 인터뷰가 초기 세계관(세계 이름, 톤, 핵심 세력) seed. origin="interview".

## UI/UX
- 툴바 '증거 패킷'(menu.ts 스텁) 제거 → **'세계관'** 버튼.
- 세계관 패널: 탭 `[개요 | 인물 | 장소·세력 | 사건 | 제작 노트]`
  - **카드 그리드** — 이미지 리치: character 카드 초상 = refs로 연결된 CharSet 스프라이트 자동 렌더,
    place 카드 = 연결 맵 렌더 썸네일 자동.
  - 카드 클릭 → 위키 뷰: 마크다운 body + 관계 칩 + 역링크 + 연결 게임 개체로 점프(맵 열기/DB 레코드 열기).
  - 전문 검색, 잠금 토글, 사용자 직접 편집(마크다운 에디터).
- 관계 그래프 시각화는 v2.
- aiPreview 기술 증거 라인 → "생성 검증 상세" 아코디언(기본 접힘). 계약/코드 유지.

## 3단계 lint (클러스터 규칙과 동일 문법, run_lint 통합)
| 강도 | 심각도 | 판정 |
|---|---|---|
| 강 | error | 세계관 refs가 가리키는 맵/이벤트/아이템/스킬/액터가 프로젝트에 없음. 삭제 무결성 가드와 같은 계층 — 게임 개체 삭제 시 세계관 참조도 검사·정리 제안 |
| 중 | warning | 세계관 개체가 refs 없이 방치(미구현 설정), 주요 게임 개체(NPC 이벤트·명명 아이템)가 세계관 미등록 |
| 약 | info | guideline 위반 휴리스틱(명명 규칙 등). LLM 판정 기반 톤 검사는 v2 |

## 구현 단계 (각각 codex 위임 단위)
- **W1**: `src/project/world/` 데이터 모델 + shape guard + 다이제스트 빌더 + lint validator 골격 + 테스트 (신규 파일만 — 타 스트림 무충돌)
- **W2**: 세계관 패널 UI (카드 그리드/위키 뷰/검색/잠금/직접 편집)
- **W3**: AI 툴 3종 + contextBuilder 주입 + proposalCompleteness 연동 + run_lint 통합 (dogfix/rules 스트림 머지 후)
- **W4**: 인터뷰 seed + '증거 패킷'→'세계관' 버튼 교체 + 기술 증거 아코디언 격하

## 진행 기록
- 2026-07-07: 설계 합의·문서화. W1 codex 착수 (worktree rpg-zzu-wt-world).
