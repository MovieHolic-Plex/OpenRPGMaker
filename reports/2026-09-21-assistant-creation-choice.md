# 제작 전 그래픽 선택 — 실제 편집기 확인

마을·집의 생성 요청은 조수와 팀을 함께 큰 창으로 열고, 작은 집 예시에서 그래픽을 확인한 뒤
명시적인 제작 버튼으로 기존 Pi 실행 경로에 전달한다. 추천·선택·캐릭터 변경 중에는 실행하지 않는다.

## 구현 범위

- 한국어/영어 마을·도시·집 생성 표현. 설명/부정/작은 수정, 읽기 전용/계획, 명시적 칩셋 지정은 제외.
- 합본 마을 및 합본 마을+레트로 월드맵 호환 칩셋. 실제 집 조립기 외관 3개, 캐릭터 조합 3개.
- 원문과 칩셋 ID, 집 키트 ID, 캐릭터 리소스 ID·인덱스 전달. 선택한 이미지도 대화에 표시.
- 선택 취소는 원문 복원. 새 대화/프로젝트 교체/패널 해제는 대기를 폐기. 맵이 바뀌면 확인 시 취소.
- 선택을 프로젝트 기본값으로 저장하지 않는다. 던전/실내 전용 선택과 임의 칩셋은 이번 범위 밖이다.

## 검증

`node scripts/qa/ai-creation-choice.mjs` — 실제 Vite 편집기, Chromium, 서비스 워커 차단.
15개 확인 통과, 브라우저 오류 0건. 자동 큰 창, 세 이미지, 확인 전 실행 0건, 선택 전 버튼 비활성,
캐릭터 독립 교체와 이미지 변화, store 불변, 정확히 한 번의 확인된 요청 및 실제 선택 ID 전달,
취소 후 원문 복원, 일반 질문 우회, 창 접기/다시 열기, 390px 가로 넘침 없음,
새 대화 시 대기/참조 제거, 생성 표현의 질문/부정/소규모 수정 제외를 확인했다.

모델 전송은 재현 가능한 NDJSON 응답으로 대체했으며 REST 원격 쓰기는 차단했다.
이 증거는 실제 UI와 실행 요청 전달을 확인한다. 라이브 모델의 마을 완성/원격 저장 성공 증거가 아니다.
미리보기는 UI 비교용 임시 데이터이고 프로젝트 콘텐츠를 생성하거나 저장하지 않았다.

생산 번들: `npx vite build --configLoader runner` 통과 (45.83초; 기존 청크 크기/혼합 import 경고).
전체 typecheck/Vitest/gates는 저장소 세션 규칙에 따라 실행하지 않았다.

## 증거

- `.omo/evidence/assistant-creation-choice/01-choices.png`: 자동 큰 창, 세 외관과 오른쪽 팀 대기
- `.omo/evidence/assistant-creation-choice/02-customize.png`: 큰 집, 캐릭터 교체, 선택 기준과 제작 버튼
- `.omo/evidence/assistant-creation-choice/03-confirmed.png`: 선택 전달 후 기존 실행 화면 (모델 응답은 QA 대체)
- `.omo/evidence/assistant-creation-choice/04-mobile.png`: 390px 표시
- `.omo/evidence/assistant-creation-choice/report.json`: 개별 확인 결과와 전송된 요청
