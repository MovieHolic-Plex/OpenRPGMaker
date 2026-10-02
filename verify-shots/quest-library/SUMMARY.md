# 퀘스트 라이브러리 — 실제 화면과 동작 증거

2026-10-01. **공용 고정 프리셋 27종 + 직접 조합 1종, 목표 원형 9종.**
AI 더보기 → 퀘스트 프리셋 → 퀘스트 만들기.
조사 대상은 Chrono Trigger, Octopath Traveler II, Stardew Valley, CrossCode,
Sea of Stars, Chained Echoes, Undertale. [공식 출처·구조 연결·한계](../../openwiki/quest-preset-research.md).

## 확인 결과

| 증거 | 범위 | 결과 |
|---|---|---|
| `ui-evidence.json` | 실제 메뉴·전용 창, 28개 선택, 검색·6개 분류, 초안 보존, 단계 추가/재정렬, 요청 전달, 1440/1024px | 53항목, 브라우저 오류 0 |
| `tool-evidence.json` | 실제 등록된 create_quest 28회, JSON 왕복, 플레이어 인터프리터로 단계와 보고 실행 | 동작 340항목 통과 |
| `tool-evidence.json`의 rejects | 알 수 없는 ID, 틀린 구조, 없는 아이템/제작법, 자유 순서, 부족한 수집원 | 6종 거절, 적용 대상 변경 없음 |
| `schema-evidence.json` | 저장된 28개 정의의 최종 입력 파서 확인, 생성형 worldChanges 참조 거절 | 28개 통과, 잘못된 참조 거절 |
| `sqlite-proof.json` | 별도 QA SQLite에 저장 → 연결 종료 → 다시 열기 | 28개 메타·모든 맵의 이벤트·제작법 보존 |
| `runtime-proof.json` | 출하 player.html에서 직접 이동·상호작용한 배달 → 동행 → 수수께끼 | 16단계 통과, 오류 0, 최종 300G |

동작 확인에는 수락 전 차단, 선행 의뢰, 단계 건너뛰기 차단, 중복 목표/보상 차단,
물품 수량 부족, 오답 재도전, 결투 도주·패배, 비용 부족, 제작 실패, 실제 배우 영입,
세계 변화, 시간대, 반복 회차, 동행 상한 거절·이탈 후 재합류를 포함한다.

## 실제 사진

- `story-chain.png` / `story-chain-dialog.png`: 대화 → 조사 → 수집 → 전달 → 선택.
- `alternate-solution.png` / `alternate-solution-dialog.png`: 분류와 여러 해결 방법.
- `trade-chain.png` / `trade-chain-dialog.png`: 검색으로 교환 사슬을 찾은 상태.
- `custom-sequence.png` / `custom-sequence-dialog.png`: 실제로 단계를 추가하고 순서를 바꾼 상태.
- `width-1024.png`: 지원하는 데스크톱 최소 폭에서 보이는 입력과 하단 액션.
- `runtime-escort.png`: 출하 플레이어에서 NPC가 실제로 뒤따르는 장면. 직접 열어 확인했다.

에디터 사진은 실제 브라우저 캡처이며 `*-dialog.png`는 같은 시점의 실제 dialog 요소 캡처다.
그림으로 UI를 재현하거나 게임 상태 숫자를 사진에 합성하지 않았다.
런타임은 작게 분리한 잔디맵 fixture이며 완성된 게임 맵의 미술 품질을 주장하지 않는다.

## 저장 대상

- Project ID: `d5b4bd38-872e-49d4-a82d-c9ef7c466026`
- SQLite: `/home/main/.codex/worktrees/39a3/rpg-zzu/output/evidence/quest-library/sqlite-project/project.sqlite`
- `sqlite-proof.json`의 revision/sha256는 실제 다시 연 snapshot에서 읽었다.
- 사용자 프로젝트를 수정하지 않았다. 28개 fixture는 작업 전용 저장소에만 저장했다.

## 증거의 구분

340항목 중 전투 결과·시간대·비용 부족·선행 완료·동행 이탈 등은 명시적인
인터프리터 계약 확인을 위한 상태 입력이다. **28개 실제 물리 완주라는 주장이 아니다.**
출하 플레이어의 16단계는 이동·수락·물품 전달·동행·오답/정답 선택·보고를 실제로 수행했다.
QA 맵 사이를 잇는 보조 이벤트도 네이티브 transfer이며 완료 스위치를 직접 세팅하지 않는다.

실제 LLM 응답 품질/생성 성공은 이 근거에 포함하지 않는다. UI 요청 전달과 결정적 컴파일을 확인했다.
물리 공 퍼즐·낚시 등 별도의 미니게임은 해당 규칙을 추가 구현해야 한다.
전체 gates/vitest/typecheck는 AGENTS의 이 세션 실행 제한에 따라 실행하지 않았다.

## 재현

```bash
node scripts/qa/quest-library-ui.mjs http://127.0.0.1:9898
node scripts/qa/quest-library.mjs http://127.0.0.1:9898
node scripts/qa/quest-library-persistence.mjs
npm run qa:runtime -- --scenario quest-library
```

런타임 재실행 결과는 `verify-shots/runtime-qa/quest-library/SUMMARY.md`를 먼저 읽는다.
이 폴더의 runtime 사진·manifest 사본은 이번 통과 실행의 제출 근거다.
