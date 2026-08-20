# AI glass 도크 — 디자인 스펙

- 생성일: 2026-08-20
- 작성자: 브레인스토밍 세션 (사용자 승인)
- 목업: `output/evidence/ai-float-left-brainstorm/docks.html`

## 목표

사용자가 AI 패널 자리를 **glass / side / float** 중에서 고른다. glass는 좌패널 오른쪽, 맵 위에 겹치는 반투명 세로 카드다. 맵을 보면서 짧은 대화를 남긴다.

## 도크 모델

`ChatDock = "float" | "side" | "glass"`.

| 값 | 위치 | 내용 |
|---|---|---|
| `glass` | 캔버스 `chat-float-host` 안, 맵 왼쪽 | 조수 얼굴 + 짧은 로그 + 입력. 반투명 유리 |
| `side` | 오른쪽 1/3 컬럼 | 지금과 동일. 불투명 작업 로그 |
| `float` | 맵 아래 커맨드바 | 지금과 동일. 입력만 |

순환: **glass → side → float → glass**. 한 버튼(`toggleChatDock`, `chat-dock-toggle`).

저장: `rpg-zzu:editor-layout:v4`의 `chatDock`만 확장. **레이아웃 캐시 버전을 올리지 않는다** — 기존 float/side 사용자를 glass로 강제하지 않는다.

기본값: 저장값이 없거나 `chatDock`를 모를 때만 **glass**. 저장된 `float`/`side`는 유지.

UI 모드(초보/표준/전문가)와 도크는 독립이다. 세 모드 모두 세 도크를 고를 수 있다.

## glass 배치

- 좌패널·초보 레일은 가리지 않는다. 카드는 맵 영역 왼쪽 위에만 겹친다.
- 초보 타일/맵 플라이아웃이 겹치면 플라이아웃이 위(`--z-rail`). 타일 클릭이 카드에 먹히면 안 된다.
- 카드 박스 안 클릭은 조수. 박스 밖은 맵 칠하기/선택.
- 유리가 비쳐 보여도 카드 픽셀은 뚫어 칠하지 않는다.
- 패널 셸은 `pointer-events: none`, 카드·입력·로그·버튼만 `auto`. 예전 float rising overlay가 맵/보내기를 삼킨 사고를 재발시키지 않는다. glass는 전체 폭 rising overlay를 쓰지 않는다.

## glass 내용

- 플레이트 이름 **조수**. side/float 플레이트는 기존 **감독**을 유지한다. 시스템 프롬프트 일괄 교체 없음.
- 평소(`is-glass-idle`): 조수 줄 + 입력만. 로그 접힘.
- 보내는 중·답이 있거나 제안 핀이 있으면 짧은 로그 펼침. 긴 로그는 카드 안 스크롤.
- 시작 화면 카드는 float와 같이 glass에서 숨긴다.

## 명시적 비범위

- side 컬럼 삭제 없음.
- “감독” 전역 리네임 없음.
- 새 localStorage 키 없음.
- 레이아웃 버전 스탬프 범프 없음.

## 검증

- 단위: `parseChatDock`, `cycleChatDock`, 레이아웃 로드가 glass 기본 / float·side 보존.
- 패널: glass에서 로그가 float host 안에 있고, idle이면 로그가 접힘.
- e2e `chat-dock-switch`: 빈 저장 → glass, 토글 순환, 입력 포커스, 사이드 폭. 저장된 float는 float로 부팅.
