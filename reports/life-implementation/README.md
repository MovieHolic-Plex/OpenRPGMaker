# 생활 시스템 구현 — 검증된 결과와 한계

본 보고서는 이 실행에서 **실제로 측정된 것만** 기록한다. 미실행 항목은 미실행으로 남긴다.
과거 감사 보고서(`reports/life-audit-2026-09-05/`)는 당시 기준 기록으로 보존하며, 아래 결과가 그 후속이다.

## 실행한 명령과 결과

| 명령 | 종료 코드 | 근거 |
| --- | --- | --- |
| `npm run typecheck:app` | 0 | `.omo/evidence/life-full-20260906/20/build.txt` |
| `npm run build` | 0 | 같은 파일 (`BUILD_EXIT=0`) |
| `npm run gates` | 아래 분류 참조 | `.omo/evidence/life-full-20260906/20/gates.txt` |
| `npm run qa:runtime -- --scenario life-full` | 게이트 통과 | `.omo/evidence/life-full-20260906/18/runtime/` |
| `npm run qa:runtime -- --scenario life-tree-chop` | 게이트 통과 | task81 증거 |
| `vite-node scripts/qa/save-life-full.mts` | ok true | `.omo/evidence/life-full-20260906/19/remote-receipt.json` |

## 실제 표면에서 증명된 것

**편집기 (실물 Chromium, 출하 경로)** — 매트릭스 18/18. 부팅, 프로젝트 가져오기, 이벤트 편집기 제작·업그레이드 설정/해제/재설정, 출하 목록 전체/개별/없음, 실제 `.oprn` 다운로드(sha256 `ca0465f7…`)와 재가져오기 동등성. page/guard/cleanup 오류 0, 스크린샷 9장.

**플레이어 (`player.html`)** — 농사 하루 주기 완주: 경작 → 파종(씨앗 3→2) → 급수 → 수면(기력 97→100, 성장 0→1) → 급수 → 수면(성장 1→2) → 수확(감자 0→1). 영수증 시퀀스 1..7 연속 증가로 낡은 영수증 통과 불가. 벌목: `harvested/tree/item_wood ×1/legacy-axe-chop`, 기력 100→99, 재조사 시 보존.

**원격 왕복** — 격리 ID `rpg-zzu-life-full-01a08046-verify`(sha `fece81ee…`)에 실제 저장 후 재로드, 생활 정의·시작 배치 일치. **재로드한 데이터로 플레이어 시나리오를 다시 실행해 실제 수확까지 도달**(10/10). 기존 `rpg-zzu-stardew-demo` 행은 `updated_at` 2026-08-24 그대로 불변.

**발견·수정한 제품 결함 (1건)** — 개별 출하 아이템 토글이 목록을 실체화하면서 `rerender()`를 부르지 않아, 「판매 가능한 모든 아이템」이 켜진 채 남고 그 상태에서 한 번 누르면 출하 목록이 통째로 비워졌다. RED-first 재현 후 수정.

## 게이트 분류 — 기존 실패와 신규 회귀

게이트 기준선(`.omo/gates-baseline.json`)은 2026-09-02에 총 12,277개 테스트 기준으로 기록됐고 현재 트리는 약 14,150개다. 그 사이 추가된 파일은 기준선에 없어 전부 「새로 실패」로 분류된다.

**총계 비교만으로는 회귀를 놓친다.** 실제로 이 실행에서 파일 단위로 base 커밋(`aac023090`)과 대조한 결과 진짜 회귀 1건이 드러났다:

- `test/handSlot.test.ts` — base에서 12/12 통과, HEAD에서 실패. 원인은 task81이 도끼를 시작 장비로 추가해 손 슬롯이 8개가 됐는데 단언은 7개를 고정하고 있었던 것. 승인된 동작이므로 기대값을 갱신(커밋 `7ab70e33`), 순서 규칙과 나머지 단언은 유지.
- `test/aiActivityLiveRow.test.ts`(2건), `test/forestDensity.test.ts`(2건) — base에서도 동일하게 실패하는 **기존** 문제.

기준선 재기록(`--save-baseline`)은 하지 않았다. 그렇게 하면 위 회귀가 영구히 묻힌다.

## 한계 (미실행·미증명)

이 절은 축소하지 않는다.

1. **출하 투입과 정산** — 미증명. 7회 시도. 커서 이동은 성공(`aria-current`가 `record-menu`에 도달)했으나 주입된 Enter로 접힌 그룹이 펼쳐지지 않아 생활 장부에 도달하지 못했다. `hasLifeLedgerData`는 `true`로 측정되므로 **제품 결함이 아니라 하네스 한계**다.
2. **저장/재개** — 실제 표면에서 미시도.
3. **편집기 7탭 e2e** — `test/e2e/life-full-authoring.spec.ts` 미작성.
4. **51행 / F01..F13 전수** — 매핑은 전수 완료이고 `test/lifeFullFixture.test.ts`가 그 전수성(누락·미지·미사용 0)을 강제하지만, **실제 표면 종단 증명은 농사·하루전환·벌목·편집기 저작/출하목록/왕복에 한정**된다. 나머지 행은 실행되지 않았으므로 실행됐다고 주장하지 않는다.

계획의 Task 20 수용 기준은 F01..F13과 51행 **전부**의 실측/회귀 근거를 요구한다. 위 4번 때문에 **그 기준은 충족되지 않았다.**
