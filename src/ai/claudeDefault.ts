// 조수의 Claude 기본 모델 — 한 곳(오너 결정 2026-11-23: 「조수는 sonnet 5.5 high 만 쓰게」).
// 지난 기본: 2026-11-16 Opus 5.5 · medium(「조수의 기본 model 을 opus 5.5 medium 으로」).
//
// Claude 로 도는 모든 길(Claude Code CLI 구독 · Anthropic 키 · 편집기 안 계정)의 주 작업과, 조수가 스스로 부르는
// 곁 호출(화면 검수 VQA · 독립 검토자 · 팀장)이 기본으로 이 모델 · 이 강도를 쓴다. 사용자가 고른 모델은 그대로 이긴다.
// 기본값을 적는 곳은 모두 이 상수를 읽는다 — ohMyPiProviders(CLAUDE_DEFAULT_MODEL) · localCliEngine(LOCAL_CLI_DEFAULT_MODELS.claude) ·
// planDefaults(CLAUDE_SUBSCRIPTION_ENGINE) · teamApply(구독 CLI 강도) · v2/judge/vqa(LOCAL_CLI_REVIEWERS) · scripts/lib/localCliAgent/claude.ts(MODELS·defaults).
// JSON 표(assistantRoleMatrix.json)는 import 할 수 없어서 test/aiDefaultClaudeSonnetHigh.test.ts 가 같은 값인지 묶는다.
//
// 의존이 없는 모듈이다 — 브라우저 번들과 순수 Node(동반 서비스) 양쪽이 상대 경로 + 확장자로 읽는다.
// 2026-11-16 실모델 확인 r7a(N6): 주 모델과 화면 검수 곁 호출이 따로 박혀 있어 서로 다른 모델로 갔다 — 그래서 한 곳으로 모았다.

/** 정식 ID 를 쓴다 — 별칭(`sonnet`)이 가리키는 세대는 Claude Code CLI 판마다 다르다. */
export const ASSISTANT_CLAUDE_MODEL = "claude-sonnet-5-5";
export const ASSISTANT_CLAUDE_EFFORT = "high" as const;
