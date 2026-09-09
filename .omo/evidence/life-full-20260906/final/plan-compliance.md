# F1 — 계획 준수 감사

감사 시각: 2026-09-09T17:33:12.531Z · HEAD `30318595`

## 체크박스

계획 파일의 체크박스 **81개 중 75개 완료**. 남은 6개는 이 최종 웨이브(36, F1..F4, 37) 자신이다.
구현 task 20개와 그 하위 항목은 전부 `[x]`.

## 51행 / F01..F13

`node scripts/qa/audit-life-coverage.mjs` → **ok — 51 rows, 13 findings, 14 artifact groups, 5 referenced specs verified**

이 감사는 문구를 고정하지 않고 기계가 소비하는 사실만 본다. **반례로 물린다는 것을 확인**했다:

| 반례 | 결과 |
| --- | --- |
| 행 하나 삭제 | FAILED (id 지목) |
| 스크린샷 하나 은닉 | FAILED (파일명 지목) |
| `artifacts` 필드 삭제 | FAILED (`C1 has no artifacts field`) |
| 존재하지 않는 스펙 참조 | FAILED (`referenced spec does not exist`) |
| 면제 미등록 `null` | FAILED (`F05 ... not listed in exemptArtifacts`) |

앞의 두 개는 초기 버전에서, 뒤의 세 개는 **독립 검토가 REQUEST_CHANGES 로 지적한 구멍을 막은 뒤** 확인했다.

## 승인 정책 대조 (파일명이 아니라 실행으로)

`npx vitest run` 6파일 → **48/48 통과**

| 정책 | 대응 테스트 | 결과 |
| --- | --- | --- |
| 철거·축소 시 동물 보존, 건물-instance 주거 연결 | `animalHousingAuthoringUi`, `animalHousingConfirmationLifecycle`, `animalHousingSummaryMetrics` | 통과 |
| 입증 자원만 **정확히 한 번** 복구, overflow 보관, 불명 원본 보존 | `lifeRecoveryLedgerUi` — "collects a known item claim exactly once and rejects a duplicate retry with zero inventory", "keeps unknown-item and quantity-cap refusals as raw claims" | 통과 |
| 거래 원자성·정산 1일 1회·골드 상한·이력 불변 | `p0Shipping` — "settles one day exactly once, caps gold, and bounds immutable history" | 통과 |
| Save4→Save5 forward load, 새 키 분리, 원문 보존 | `appStorageMigration` | 통과 |

## 실제 표면 증거 (모듈 통과와 별개)

| 요구 | 증거 |
| --- | --- |
| 실제 editor 검증 | `test/e2e/life-full-authoring.spec.ts` — 생활 7탭 × 2해상도, 스크린샷 14장 |
| 실제 player.html 검증 | `test/runtime/life-full.spec.ts` — **5 passed / 48.6s / 재시도 0** |
| 저작 → 플레이 → 하루 전환 → 저장/재개 | 경작·파종·급수·수면·수확(영수증 1..7) → 출하 투입 → `day 1 gold 0` → `day 2 gold 28` → 저장 → 로드 복귀 |
| 격리 project id 로 실제 저장 + 재로드 | `rpg-zzu-life-full-01a08046-verify` sha `f793ee07…`, 재로드 데이터로 플레이 재현 |
| 기존 데모 보존 | `rpg-zzu-stardew-demo` sha `bd9b8c08…`, `updated_at 2026-08-24` **불변** |

## 판정

**APPROVE** — 단, 아래 한계가 계획 대비 미달인 채로 남아 있으며 축소하지 않고 기록한다.

1. 행별 **happy + failure** 중 라이브 failure 는 `기부중복` 하나뿐. 나머지 실패·경계 계약은 `rows.json` 이 행마다 지목하는 모듈 테스트로만 덮인다.
2. `복구` 탭은 세션에 클레임이 없어 렌더되지 않는다(실측). 계약은 모듈 테스트로만.
3. `F03` craftingFailure 는 라이브 미실행 — `rows.exemptArtifacts` 에 사유를 명시.
4. `L7` 업그레이드는 렌더만 확인, 실행 안 함.
5. `npm run gates` 는 저장소 기존 red 로 exit 1. 기준선(2026-09-02)은 **재기록하지 않았다.**

이 다섯은 "PASS 로 표시하되 근거 없음"이 아니라 **미달로 표시**한 것이다.


---

## 갱신 — 독립 검토 3회를 거친 뒤

이 감사를 처음 쓴 뒤 독립 검토를 세 번 받았고, **두 번은 REQUEST_CHANGES 였다.**
그 지적들이 내 검증의 실제 구멍을 드러냈으므로 아래를 기록한다.

| 회차 | 대상 | 판정 | 결과 |
| --- | --- | --- | --- |
| 1 | `audit-life-coverage.mjs` | REQUEST_CHANGES | `artifacts` 부재/null 조용한 통과, findings 무검증, 스펙 경로 미검증 → 전부 수정 |
| 2 | `life-full.spec.ts` | REQUEST_CHANGES | 정산액·9탭 상이성·주민 게이팅·재개 복원·중복 기부 부수효과 **5개 단정이 깨진 제품도 통과** → 전부 강화 |
| 3 | 강화 후 재검토 | 5/6 FIXED | 남은 박물관 진행도 + 약한 자극 → 두 축으로 분리해 해소 |
| 4 | 코드 품질(F2) | **APPROVE** | `TOUCHED_FILES` 미설정 시 무조건 통과하던 false negative 수정 |

**중요**: 2회차 지적은 이 문서의 초판이 "정산 28G 가 단가와 일치"라고 적었을 때
그 일치를 **코드가 강제하지 않고 있었다**는 뜻이다. 지금은 장부에서 단가를 파싱해
`gold_before + 단가` 와 정확히 일치할 때만 통과한다.

또한 저장/재개는 이제 **실제 페이지 재로딩**을 사이에 두고 전체 인벤토리·골드·날짜
복원을 요구한다. 초판의 같은 세션 로드는 직렬화를 거치지 않아 증명이 약했다.

최종 실행: 런타임 **5 passed / 재시도 0**, 커버리지 감사 **exit 0**(반례 5종으로 물림 확인).
