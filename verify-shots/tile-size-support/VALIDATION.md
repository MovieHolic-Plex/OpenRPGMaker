# 16 / 32 / 48px support verification — 2026-09-21

48px 일반 격자 칩셋 가져오기를 추가했다. 선택한 타일 크기는 업로드 메타데이터와 리소스
프로필에 저장되며, UI의 「현재 맵에 적용」을 통해 타일셋과 맵 좌표로 전달된다.
32px와 48px 모두 새 브라우저 세션에서 직접 검증했다. 기존 결과를 재사용하지 않았다.

| 검사 | 결과 |
|---|---|
| 실제 PNG 가져오기 → 크기 선택 → 현재 맵 적용 | 16 / 32 / 48 모두 통과 |
| 원본 프레임 5번의 x·y·너비·높이 | (2s, s, s, s), 세 크기 모두 통과 |
| 실제 포인터로 (5,4)에 5번 타일 칠하기 | 세 크기 모두 통과 |
| Ctrl+Z / Ctrl+Y | 세 크기 모두 원복·재적용 확인 |
| 32px 시트(96×64)에 48px 선택을 제공하지 않음 | 통과 |
| 가져오기 크기 창에서 Escape 취소 | 자산 개수 불변 |
| serialize → deserialize → 파일 저장·재로드 | 맵·타일셋 크기, 칠한 셀, 통행 정보 보존 |
| 전용 player.html 한 칸 이동 | 16 / 32 / 48px 정확히 일치 |
| 벽 앞에서 800ms 연속 입력 | 세 크기 모두 벽 셀에 진입하지 않음 |
| action 이벤트로 32→48→16→32 전환 | 위치·발밑 좌표 모두 일치 |
| 브라우저 pageerror | 0 |

원시 관측은 [checks.json](checks.json), 화면은 [SUMMARY.md](SUMMARY.md)의 「즉시 확인」 목록.
검증 대상 코드 SHA-256은 [source-sha256.json](source-sha256.json).

## 함께 수정한 실제 실패

첫 리소스 가져오기 시 데이터베이스 lazy CSS가 아직 로드되지 않아 크기 선택창이
문서 아래에 나타났고, 리소스 창 배경이 버튼 클릭을 가로막았다. 강제 클릭으로 우회하지
않고 리소스 소유 스타일 `chipset-import.css`를 추가했다. DB를 먼저 열지 않은 상태에서
16·32·48 선택 버튼에 실제 포인터 클릭이 성공했다.

## 자동 검사

- `npm test -- test/tileGeometry.test.ts test/uploadedTilesetRendering.test.ts --maxWorkers=2 --minWorkers=1`
  — exit 0, 2개 파일 / 11개 테스트 통과 (8.67초).
- `npm run typecheck:app` — exit 0.
- `node scripts/check-css-graph.mjs` — exit 0, 누락 import·고아 파일·중복 import 0.
- `node scripts/check-css-budget.mjs` — exit 1. 깨끗한 HEAD를 임시 디렉터리에 추출해 같은
  검사로 비교한 결과 HEAD도 exit 1이며 판정 지표 네 개는 동일하다. 새 위반 0.
  상세: [css-comparison.json](css-comparison.json). 저장소 기준선은 변경하지 않았다.
- `node --check scripts/qa/tile-size-support.mjs`, `git diff --check` — exit 0.

## 재현 및 범위

보정된 워크트리에서 별도 `VITE_CACHE_DIR`와 `DEV_SERVER_NO_TLS=1`로
`npm run dev:worktree`를 실행한다. 소스 변경 뒤에는 서버를 재시작한다.

```sh
TILE_EDITOR_URL=http://127.0.0.1:<worktree-port> node scripts/qa/tile-size-support.mjs
```

하네스는 런타임 검증용 서버를 직접 시작·종료하고, 게임 검증은 전용 `player.html`과
export store shim을 통과한다. 6칸짜리 원본 PNG와 세 맵은 엔진 계약 검증용 데이터다.
Supabase에 게임 콘텐츠를 저작한 작업이 아니며, 원격 저장 검증으로 주장하지 않는다.
전체 스위트 및 모든 편집 기능을 검증했다는 뜻은 아니다. 48px 지원은 일반 격자 아틀라스
지원이며 RPG Maker MV/MZ의 A1–E 오토타일 포맷 가져오기는 포함하지 않는다.
