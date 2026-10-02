# 퀘스트 프리셋 증거 — 2026-10-01

이 폴더의 화면은 첫 구현 기록이다. 이후 UI 개편 화면과 동작 근거는
`../quest-presets-redesign/SUMMARY.md`를 따른다. 아래 실행기·SQLite·출하 플레이어 근거는 그대로다.

## 실제 에디터 화면

AI 더보기 → 퀘스트 프리셋 → 심부름 / 분실물 찾기 / 위협 제거.

- `errand.png`, `lost_item.png`, `hunt.png`: 실제 메뉴 클릭과 각 프리셋 선택 후 캡처.
- `composer.png`: 소재와 150G 보상을 포함한 요청을 실제 입력창으로 전달.
- `desktop-1024.png`: 1024×768에서 컨트롤이 화면 안에 배치됨.

`evidence.json`에 브라우저 오류 0건, 입력값 전달, 잘못된 보상 거부,
등록된 `create_quest` 도구의 세 프리셋 생성과 잘못된 구조 거부, 직렬화 왕복을 기록했다.

## 이벤트 실행기 확인

31개 항목 모두 확인. 수락 전 목표 차단, 거절, 수락, 조기 보고 무보상,
목표 완료, 보고 보상, 반복 보상 차단, 완료 대사 전환, 반복 목표 진행도 유지.
분실물은 실제 소지 확인과 반환, 처치는 도주 결과에서 미완료를 확인했다.
전투 결과와 아이템 유실은 실행기에 명시적으로 제공한 계약 검사이며 실제 전투 완주 증거가 아니다.

## SQLite 저장과 재로드

- project id: `ac24cd87-c32d-42ac-adcc-afd5ed40fc59`
- 대상: 이 워크트리의 `output/evidence/quest-presets/sqlite-project/project.sqlite`
- 저장 후 연결을 닫고 다시 열어 3개 퀘스트의 presetId/dialogue와 생성 이벤트의 저장 값을 대조했다.
- 원본 사용자 프로젝트는 수정하지 않았다. `sqlite-proof.json`에 revision/sha256/재로드 근거를 기록했다.

## 출하 플레이어 확인

`qa:runtime --scenario quest-presets`의 7개 비트가 모두 통과했고 런타임 오류는 없었다.
실제 입력으로 의뢰 수락 → 대상 NPC에게 소식 전달 → 돌아와 100G 보상 → 재보고 시 100G 유지까지 확인했다.
별도의 `verify-shots/runtime-qa/quest-presets/SUMMARY.md`와 manifest에 상태/입력/스크린샷을 기록했다.
게임 화면의 미술·공간 구성과 처치 전투 자체를 이 결과로 합격 판정하지 않는다.

## 재현

```bash
npm run dev:worktree
node scripts/qa/quest-presets.mjs http://127.0.0.1:<이 워크트리 포트>
node scripts/qa/quest-presets-persistence.mjs
npm run qa:runtime -- --scenario quest-presets
```

사용자가 요청한 화면 증거를 위한 브라우저 캡처와 전용 플레이어 확인이다.
전체 gates/vitest/typecheck는 실행하지 않았다. 실제 LLM의 자유 생성 품질은 이 증거로 검증하지 않았다.
플레이어 확인 결과는 `verify-shots/runtime-qa/quest-presets/SUMMARY.md`를 별도로 읽는다.
