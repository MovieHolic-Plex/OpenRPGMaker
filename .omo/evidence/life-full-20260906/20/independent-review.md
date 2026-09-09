# 독립 검토 결과와 조치

## 위임 가용성

이번 세션 내내 `omo-senpi-code-reviewer`, `oracle`, `deep`, `ultrabrain`, `unspecified-high` 는
모두 `opencodex/gpt-6-astra` 로 라우팅되어 **사용량 제한**으로 즉시 실패했다.
`quick` 카테고리만 다른 모델(Meta Muse Spark 1.3)로 실행되어 **실제 독립 검토를 받았다.**

## 검토 대상과 판정

`scripts/qa/audit-life-coverage.mjs` → **REQUEST_CHANGES**

지적은 정확했다. 감사기에 조용한 통과 구멍이 있었다:

| 지적 | 실태 | 조치 |
| --- | --- | --- |
| `if (row.artifacts)` 가 필드 부재/null 시 검사를 통째로 건너뜀 | **F03 가 실제로 `artifacts: null` 인데 통과하고 있었다** | 필드 부재는 실패. null 은 `exemptArtifacts` 에 사유를 적은 경우에만 허용 |
| findings 는 존재만 확인하고 증거는 안 봄 | F01..F13 전부 증거 검사 없이 통과 | `liveEvidence` 필수, `artifacts` 명시 필수 |
| 증거 문자열의 스펙 경로를 디스크와 대조 안 함 | 오타난 경로도 "증거"로 통과 | 참조된 스펙 파일 실재 검증 추가(현재 5개) |

## 조치 후 반례 재검증

| 반례 | 결과 |
| --- | --- |
| `C1.artifacts` 필드 삭제 | FAILED — `C1 has no artifacts field` |
| 존재하지 않는 스펙 참조 | FAILED — `referenced spec does not exist` |
| `F05.artifacts = null` (면제 미등록) | FAILED — `F05 ... not listed in exemptArtifacts` |
| 복원 | ok — 51 rows, 13 findings, 14 artifact groups, **5 referenced specs** |

## F03 면제 (숨기지 않고 명시)

craftingFailure 는 이번 실행에서 라이브로 돌리지 않았으므로 가리킬 아티팩트가 없다.
계약은 모듈 테스트로만 덮인다. `rows.exemptArtifacts.F03` 에 사유를 기록했다.

## 내 자체 감사에서 잡은 것

리뷰어에게 요청한 항목을 스스로도 점검해 **1번 런타임 테스트가 가시성 단정만 5개**이고
내용·상태 단정이 없음을 발견했다(빈 껍데기여도 통과 가능). 장부가 실제 품목("야생 부추")을
렌더하는지, 저장 슬롯이 "비어 있음" 상태 문자열을 보이는지 추가했고 **5/5 통과**를 유지했다.
