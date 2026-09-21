# 최종 c5f48f0b 대 origin/main 6950be5d 검증 비교

최종 `c5f48f0bcf6f9cc3e4a671c612022df70b43932e`의 실패 169건 중 166건은 `origin/main`의 `6950be5d755c736cb6f5dae3a51c67a4ccf493ec`에서도 실패했다. 나머지 **3건은 원본 전체 실행에만 나타났고, 해당 두 파일을 기준선과 최종에서 집중 실행했을 때 모두 통과했다.** 원본 새 실패 수를 0으로 바꾸지 않았다.

확인한 집중 실행 조건에서 재현되는 새 구체 진단은 없었다. 전체 `npm run gates -- --json`의 직접 종료 코드는 **1**이며, 이 보고서는 전체 게이트가 통과했다는 뜻이 아니다. 모든 추가 테스트 실행은 완료했고 소스·테스트·콘텐츠·DB를 수정하지 않았다.

## 직접 실행 결과와 비교 범위

| 실행 | 직접 exit | 전체 assertion | 통과 | 실패 | pending | 실패 파일 |
|---|---:|---:|---:|---:|---:|---:|
| 최종 전체 Vitest | 1 | 13,266 | 13,082 | 169 | 15 | 93 |
| main6950: 직전 실패 파일 92개 | 1 | 979 | 813 | 166 | 0 | 91 |

기준선은 전체 suite가 아니라 최종 실패 파일을 포함하도록 선택한 파일 실행이다. 최초 92개에 새 DB 개요 두 파일을 추가하여 기준선에서 **94개 파일**을 실제 실행했다. 추가 실행에는 autosave 진단 보완도 포함됐다. baseline raw/status를 덮어쓰지 않고 별도 보완 결과로 보존했다.

최종 typecheck:app exit **0**, 오류 **0**; CSS exit **0**; surface exit **1**. tracked `.omo/gates-baseline.json`은 변경하지 않았다.

## 실패 이름 multiset과 새 파일

- `(상대 파일명, fullName)`의 **multiset**을 비교했다. 공통 실패 occurrence **166**, final-only **3**, baseline-only **0**.
- 새 파일은 `test/databaseOverviewDashboard.test.ts`와 `test/databaseOverviewTab.test.ts` 두 개다. 두 파일의 **19개 테스트는 기준선과 최종 집중 실행에서 모두 통과**했다.
- 직전 3d9 실행과 비교하면 DB view toggle 후반 2건과 UXC 복구 안내 1건이 사라지고, DB 개요 3건이 나타났다. UXC 실패 파일이 빠지고 DB 개요 두 파일이 추가되어 실패 파일 수가 92에서 93으로 바뀌었다.

| 원본 final-only assertion | 원본 최종(ms) | 기준선 focused(ms, pass) | 최종 focused(ms, pass) |
|---|---:|---:|---:|
| Dashboard: HP/attack legend | 15006.518 | 1686.496 | 1521.422 |
| Dashboard: jump button / G006 | 15047.432 | 1817.801 | 1392.321 |
| Tab: overview render | 15021.014 | 1736.042 | 1433.750 |

이 3건의 원본 JSON 진단은 `Error: STACK_TRACE_ERROR`이며 15초 제한 부근에서 끝났다. 양쪽 focused 통과와 실행 시간 변화는 시간 의존적인 실패라는 해석을 뒷받침하지만, 원본 전체 실행의 구체 오류 본문은 수집되지 않았으므로 완전히 같은 원인이라고 단정하지 않는다.

## 구체 진단과 expected/received 비교

체크아웃 절대 경로만 정규화했다. 숫자·파일명·소스 줄 번호·expected/received·시각값은 원본에 보존했다. 첫 줄, 스택 이전 본문, 전체 스택을 따로 비교했다.

- 공통 166건의 첫 줄은 원본 기준 **164건 일치**했다. 다른 2건은 기준선의 placeholder와 최종의 구체 TypeError 차이였고 아래 집중 실행에서 같은 오류로 보완했다.
- **160건**은 구체 진단 본문이 정확히 같다. 본문이 같은 항목 중 5건은 AI 패널 정리 함수의 줄 번호 이동 또는 Vitest/Node 비동기 꼬리 프레임만 다르다.
- **1건** `storePersistence`의 spy 진단은 기대 호출 0 / 실제 호출 1 및 `/__oprn/edit-activity` POST received payload가 같고, 감사 로그 `at` 생성 시각만 다르다.
- **3건**은 원본 양쪽에 `STACK_TRACE_ERROR`만 있다: AI 중단, DB view 클릭/지속성, modeTransitions. 아래에서 집중 실행 결과와 원래 진단의 한계를 구분했다.
- **surface 6개 실패의 default reporter 진단과 expected/received 값이 모두 정확히 일치**한다. 첫 줄만 비교한 결과가 아니다.

| 보완 대상 | 확인 결과 |
|---|---|
| 역할 이름 검사 | Expected `[]`; 양쪽 default reporter Received는 아래 두 항목으로 정확히 같다. 실패 블록 전체도 같다. |
| autosave | 기준선 추가 실행과 최종 원본 모두 `TypeError: Cannot read properties of null (reading 'getItem')`; `databaseRecordViewSession.ts:159:35`에서 발생한다. |
| store fresh project | 기준선 해당 assertion 단독 실행과 최종 원본 모두 `TypeError: Cannot read properties of undefined (reading 'ok')`; `legacyDbProjectSync.ts:221:17`에서 발생한다. |
| AI 중단 | 기준선 원본 default reporter와 최종 focused 모두 `Error: Test timed out in 15000ms.`; 실패 블록 전체가 같다. |
| modeTransitions | 기준선 단독과 최종 focused 모두 `TypeError: Cannot set properties of undefined (setting 'testid')`; `mode.ts:308:17 → :124:7 → test/modeTransitions.test.ts:162:11` 및 실패 블록 전체가 같다. |
| DB view 클릭/지속성 | 기준선 원본은 15초 timeout, 최종 focused는 통과. 원본 최종 placeholder의 구체 원인은 미확정으로 남긴다. |

역할 검사 실제 Received:

```text
src/project/lint/postTileVerify.ts:129  role !== "wall"
src/project/lint/postTileVerify.ts:138  role !== "roof"
```

**남은 한계:** DB 개요 새 실패 3건과 기존 DB view 클릭/지속성 1건은 원본 전체 실행의 구체 오류가 수집되지 않았다. 최종 focused에서는 모두 통과했다. 이 네 원본 실패를 구체 진단 동등성으로 세거나, 원본 새 실패 3건을 삭제하지 않았다. JSON이 expected/received를 생략한 다른 assertion에는 없는 값을 추정하지 않았다.

## 보완 실행과 증거

| 실행 | 직접 exit | 전체 | 통과 | 실패 | pending | 시간(초) |
|---|---:|---:|---:|---:|---:|---:|
| main6950 추가: DB 개요 2파일 + autosave | 1 | 22 | 21 | 1 | 0 | 41.154 |
| main6950 store fresh assertion만 | 1 | 11 | 0 | 1 | 10 | 7.997 |
| main6950 modeTransitions만 | 1 | 1 | 0 | 1 | 0 | 10.212 |
| c5 최종 focused 6파일 | 1 | 48 | 45 | 3 | 0 | 38.768 |

store fresh와 mode 기준선 단독 진단에만 `--testTimeout 60000`을 명시했다. 실제 프로세스는 각각 8.00초와 10.21초에 위 TypeError로 끝났다. 게이트 설정이나 테스트 소스는 바꾸지 않았다.

- [최종 직접 종료 상태](gates-status.json), [최종 전체 gates](gates.json), [최종 스냅샷/해시](gates-snapshot.json).
- [main6950 기준선 argv/직접 종료](baseline-status.json).
- [최종 실패 원문](final-failed-assertions.json), [기준선 실패 원문](baseline-failed-assertions.json).
- [원본 multiset·진단·스택 비교](baseline-comparison.json), [보완 실행별 상세 진단·수신값·직접 종료·해시](diagnostic-resolution.json).
- 보완 실행 원문: `diagnostics/additional-baseline/`, `diagnostics/store-fresh-baseline/`, `diagnostics/mode-baseline/`, `diagnostics/focused-final/`.
- 전체 Vitest 원본과 baseline default reporter는 로컬의 `../worktree-calm-cloud-6e89-jrpg-field-resource-ai-baseline-main194/output/evidence/final-c5f48f0b-comparison/`에 보존했다. PR에는 실패 원문과 상세 비교를 포함한다.
- 마지막 확인: 기준선 HEAD `6950be5d`, 최종 HEAD `c5f48f0b`; 둘 다 clean. 최종 전체 Vitest 원본 SHA256은 focused 후에도 동일하다.

PR 비교 JSON의 거대한 반복 fixture 덤프는 SHA-256으로 대체했다. 진단 비교는 생략 전 원문에서 수행했으며, 상세 원문은 위 로컬 검증 체크아웃에 보존했다.
