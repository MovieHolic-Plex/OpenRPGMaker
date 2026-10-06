# 공용 손 도트 · 확인 범위

**이 그림 묶음은 사용자 반려다.** 아래는 반려 이전의 기술 확인 이력이며 그림 품질 합격이 아니다.
24종의 공용 기본값 배선은 철회했고 소환 시트/생성기는 작업 전 HEAD로 복원했다.
반려 자산/원본/배선 스냅샷: `docs/experiments/shared-hand-fx-20261005/rejected-release/`.

## 기본값과 격자

- 새 시트 24종 × 8칸 = 192칸, 소환 v2 12칸: 이번 저작 204칸.
- 등록 PNG 25장과 전체 문자 격자는 동일하다. 불투명 색 ≤16, 알파 0/255.
  원본/시트/접촉 시트/GIF/해시: `docs/experiments/shared-hand-fx-20261005/`.
- `defaults.json`: 새 기본 스킬 24행, `anim_px_*` 41행, 기본 연출 계약 24개, 참조 문제 0건.
  빠진 행만 추가, 기존 저자 스킬/애니메이션 보존, 재수렴 변화 없음, 빠진 재생 상태의 의존성 복원.
  「공용 손 도트」 검색 24건, 「수정 방벽」 시트 검색은 `hand_guard_crystal`을 반환한다.
- `preview/observations.json`: 25선택/25썸네일, 모든 효과의 프레임 넘기기가 그림을 바꾼다.
  736/320px 화면에서 가로 넘침 없음. 재생 후 8/8에서 정지, 반복 기본 꺼짐, JS 오류 없음.

## 실제 전투 · 대표 5종

전용 `player.html` + export store shim, 녹화용 주인공 fixture로 확인했다.
스킬·대상·모션·시트와 소리 재생 이벤트를 기록한다. GIF에는 소리 트랙이 없다.

| 효과 | 근거 | 보인 층 / 노드 | 소리 사건 |
|---|---|---|---|
| 쇄격 | `runtime/report.json` | 1 / 1 | 2 |
| 치유의 이슬 | `runtime/report.json` | 1 / 1 | 2 |
| 혜성 낙하 | `runtime/report.json` | 1 / 3 | 2 |
| 용 소환 v2 | `runtime/report.json` | 2 / 2 | 5 |
| 수정 방벽 (수정 후) | `runtime-support-final/report.json` | 1 / 1 | 2 |

처음 `runtime/SUMMARY.md`는 수정 방벽의 대상 층 누락 때문에 FAIL이다. 그 결과를 덮어쓰지 않았다.
일반 support를 준비 동작으로 취급하던 `buildPlan`을 고친 뒤 수정 방벽만 다시 기록했고
`runtime-support-final/SUMMARY.md`가 PASS 1/1이다. 위 5종을 한 번에 재실행했다는 뜻은 아니다.
새 24종 전부의 전투/상태 규칙/부활/마력 흡수를 전수 확인한 결과도 아니다.

## 즉시 확인할 그림

1. `runtime/samples-skill_hand_summon_review.png`: 머리·목·앞발·두 날개와 브레스가 실제 전투 위에 뜬다.
2. `runtime-support-final/samples-guard-crystal.png`: 아군에 수정 그림이 뜨고 프로텍트가 적용된다.
3. `preview/library-wide.png`: 전체 25개 선택과 확대 프레임.

`runtime-support-fixed/`, `runtime-support-confirmed/`는 초기화 타임아웃/모듈 로드 실패로 녹화가 없는 시도다.
최종 보호 녹화는 전용 캐시와 초기 화면 재로드 후 성공했다.
편집기 초기 캡처에서는 Chromium `ERR_NETWORK_CHANGED`가 다수 발생했으므로 기존 A2 캡처와 같은
`--disable-features=NetworkChangeNotifier` 옵션을 캡처 스크립트에 적용했다.
이후에도 전체 셸 촬영은 네트워크 오류/브라우저 종료로 완료하지 못했다.
기본값·검색 조회는 실제 Vite 모듈을 브라우저에서 읽어 확인한다. `capture-shared-hand-fx.mjs`의
기본 실행은 이 조회만 수행한다. `--ui`는 전체 편집기 화면을 추가 촬영하는 선택 경로다.

공용 코드/에셋 작업이며 사용자 SQLite·원격 DB에 콘텐츠를 저장한 작업이 아니다.
gates/vitest/전체 typecheck는 세션 규칙에 따라 실행하지 않았다.
