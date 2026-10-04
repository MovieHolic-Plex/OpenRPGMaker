# 퀘스트 실제 플레이 증거

2026-10-01. 출하 `player.html`에서 배달·동행·수수께끼를 연속으로 플레이했다.
최종 실행 **22단계 통과, 런타임 오류 0, 소지금 0 → 100 → 200 → 300G**.
등록된 `create_quest`로 만든 이벤트를 사용했고, 사진은 실제 Chromium 화면이다.

| 퀘스트 | 실제 수행 | 관측 결과 |
|---|---|---|
| 물품 배달 | 수락 → NPC까지 이동 → 전달 → 의뢰인에게 복귀·보고 | 지급된 물품 1 → 0개, 완료 스위치 true, 100G. 재보고는 100G 유지 |
| 안전한 동행 | 수락 → NPC 합류 → 직접 목적지까지 이동 → 복귀·보고 | 실제 동행 스프라이트 1 → 0명, 도착 목표 true, 완료 스위치 true, 누적 200G |
| 단서와 수수께끼 | 수락 → 단서 조사 → 오답 → 다시 정답 선택 → 복귀·보고 | 오답은 목표 false·200G 유지, 정답 후 진행 2, 보고 완료 true·누적 300G |
| 플레이어 메뉴 | 돈 화면 확인 → 기록 → 의뢰 목록 → 키로 스크롤 | 돈 300G, 배달 완료 (1/1), 동행 완료 (1/1), 수수께끼 완료 (2/2) |

## 근거

- `manifest.json`: 같은 통과 실행의 각 입력·진행·물품·금액·완료 상태.
- `runtime-summary.md`: 전용 하네스의 최종 22단계 판정.
- `screenshots-sha256.json`: 해당 실행에서 복사한 원본 PNG 14장의 해시.
- `04-delivery-report.png`, `10-escort-report.png`, `18-puzzle-report.png`: 읽을 수 있는 완료 대사.
- `08-escort-join.png`, `09-escort-arrival.png`: 실제 동행과 목적지 도착.
- `15-puzzle-wrong-answer.png`: 오답 재도전 대사.
- `19-reward-total.png`: 게임 메뉴의 돈 300G.
- `20-delivery-quest-log.png`, `21-escort-quest-log.png`, `22-puzzle-quest-log.png`: 실제 목록의 각각 완료 상태.

대사를 읽기 위해 출하 결정 키로 타자기 페이지를 완성했다. 사진에 대사·수치를 합성하지 않았다.
퀘스트 수행 중 좌표 순간이동, 완료 플래그 강제 설정, 재화 강제 지급은 하지 않았다.
맵 사이 QA 이동은 원래 플레이어가 실행하는 네이티브 transfer 이벤트다.

## 저장된 생성 결과와 관계

원본 생성 fixture 28개는 작업 전용 SQLite에 저장하고 다시 열어 확인한 데이터다.
Project ID `d5b4bd38-872e-49d4-a82d-c9ef7c466026`.
저장 대상 `/home/main/.codex/worktrees/39a3/rpg-zzu/output/evidence/quest-library/sqlite-project/project.sqlite`.
재로드 근거는 `../quest-library/sqlite-proof.json`.
이번 실행은 그 데이터의 QA 사본이며 선택한 세 퀘스트의 컴파일된 이벤트 페이지는 유지했다.
의뢰 목록을 읽기 위해 메타 목록에는 플레이한 세 퀘스트만 남겼다. 사용자 정본 프로젝트는 수정하지 않았다.

## 범위

실제 브라우저 완주 증거는 **이 세 프리셋**이다. 27종 전체 물리 완주나 실제 LLM 생성 응답의
성공률을 주장하지 않는다. 나머지 구조의 결정적 실행 확인은 `../quest-library/tool-evidence.json`에 별도 기록했다.
사진의 잔디맵은 기능 확인 fixture이며 완성 게임의 미술 품질을 나타내지 않는다.
전체 gates/vitest/typecheck는 실행하지 않았다.

## 재현

```bash
npm run qa:runtime -- --scenario quest-play-proof
```

재실행은 `verify-shots/runtime-qa/quest-play-proof/SUMMARY.md`를 먼저 읽는다.
이 폴더의 원본 PNG와 manifest 사본은 이번 최종 통과 실행을 보존한다.
