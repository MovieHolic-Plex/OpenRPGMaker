# 8장르 내부 AI 게임 감사 — 개선 적용 보고서

날짜: 2026-10-08  
범위: 기존 8장르 산출물 보존, 조수 시각 완료 게이트·편집기 저장·플레이어 저장/체크포인트 보정

## 이번에 반영한 것

1. **시각 완료 게이트**
   - `scripts/lib/piAgentRuntime.ts`가 배치 품질 수리 뒤에도 남은 문제를 `visualCompletion`으로 기록한다.
   - `src/ai/piAgent/client.ts`는 `layoutIssues`가 남아 있으면 done을 성공으로 반환하지 않는다.
   - `show_map_region`/실내 이미지 전달 횟수를 완료 메타데이터에 남긴다.

2. **새 프로젝트 첫 저장 안정화**
   - `src/editor/saveActions.ts`가 저장 스냅샷 전에 인라인 업로드를 파일 참조로 승격한다.
   - 첫 저장 직후 호스트가 data URL을 ref로 바꾸며 SHA와 revision을 다시 만드는 경합을 줄인다.

3. **플레이어 저장·재개 경계**
   - 수동/자동 저장에 1단계 체크포인트를 포함하고 Continue로 새 세션을 만들 때 복구한다.
   - 엔딩 보상·플래그를 타이틀 복귀 전에 오토세이브한다.
   - 패배 분기가 transfer를 포함하면 이어지는 `recoverAll`까지 실행한다.
   - System→Save 상세 명령이 접힌 레일의 첫 항목(Items)으로 되돌아가지 않게 했다.

## 남은 검증

이번 변경은 기존 게임 화면을 다시 칠해 합격으로 만들지 않는다. 새 8장르 실행을 다시 만들고, 각 결과에 대해 전체 맵 PNG·native player PNG·상태·SHA를 재수집해야 수정 후 합격/실패를 판정할 수 있다. 현재 HTML은 수정 전 실제 이미지를 기준선으로 보여주며, “재검수 대기”를 명시한다.

## 시각 근거

- 전체 맵 25장 재검토, 실제 native PNG 15장 재검토: `visual-qa/REPORT.md`
- 동굴 전체도·native 동굴·약초 native: `visual-qa/`
- 변경 전 8장르 비교표와 모든 요구사항: `../REPORT.md`
- 이미지 리치 HTML: [internal-ai-game-audit.html](/home/main/.codex/visualizations/2026/10/08/01a1192d-fe97-75a1-9d2e-4ea5e875c1c0/internal-ai-game-audit.html)

## 주의

실제 게임 콘텐츠(동굴을 다시 그린 것, 보상 수치를 임의로 바꾼 것)는 이번 코드 수정에서 건드리지 않았다. 목적은 잘못 만든 콘텐츠를 성공으로 포장하는 것이 아니라, 다음 조수 실행에서 시각적으로 잘못된 맵과 저장 경계를 완료 전에 드러내는 것이다.
