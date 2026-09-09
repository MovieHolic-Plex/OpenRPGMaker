# F2 — 코드 품질 독립 검토

판정: **APPROVE** (Meta Muse Spark 1.3, 8분 2초, 도구 24회)

## 검토자가 확인해 준 것

- `git diff --check` 출력 없음(exit 0)
- 비밀정보·토큰·개인 절대경로 스캔 무결(`ghp_`, `AKIA`, `/home/…`, `xox[bpas]-` 등 무매치)
- 죽은 코드 없음 — 새로 넣은 `exempt`/`referencedSpecs`/`expand`/`rendered`/`snap` 전부 사용됨
- 보고서 과장 없음 — 한계 절이 유지되고 정산·저장 주장이 강화된 단정과 일치
- **분류기 정규식이 실제 vitest 출력과 매치됨을 실측 확인** (`FAIL` 7줄 + `❯` 5줄) — 내가 우려한 "조용히 0건 매치"는 사실이 아니었다
- 브랜치 변경이 스위트를 **엄격하게 조이는 방향**임

## 검토자가 바로잡아 준 내 착각

내가 4개 파일이 바뀌었다고 적었으나, 실제로 `origin/main` 대비 변경은
`scripts/qa/audit-life-coverage.mjs` 와 `test/runtime/life-full.spec.ts` **2개뿐**이다.
나머지 2개는 이미 main 에 병합돼 동일하다.

## 지적과 조치

| 지적 | 위험 | 조치 |
| --- | --- | --- |
| `classify-gates.mjs` — `TOUCHED_FILES` 미설정 시 **무조건 exit 0**. 호출자가 빠뜨리면 회귀가 있어도 통과 | **실제 false negative 경로** | 미설정이면 **exit 2 로 거부**. 경로 `./` 접두사도 정규화 |
| `audit-life-coverage.mjs` — `artifacts: ""` 는 undefined/null 이 아니라 통과 | 조용한 통과 | 빈/공백 문자열도 실패 |
| 참조 스펙 정규식이 `.mts/.cts` 미포함 | 잠재 | `[cm]?[tj]sx?` 로 확장(분류기도 `.spec` 포함) |

### 반례 검증

| 반례 | 결과 |
| --- | --- |
| `C1.artifacts = ""` | FAILED — `C1 has a missing or blank artifacts field` |
| `TOUCHED_FILES` 미설정 | **exit 2** — 판정 거부 |
| `TOUCHED_FILES` 설정 후 실제 실행 | exit 0, `newlyFailingAndTouchedByThisBranch=0` |

## 남긴 지적 (조치 안 함, 이유 명시)

- **낡은 기준선 기반 분류의 한계**: 검토자 말대로 2026-09-02 기준선이 959커밋 뒤라 per-file 비교가 과다 보고한다(`eventEditorM2Surface` 등 2건은 main 계열 변경). **그래서 최종 귀속은 분류기가 아니라 브랜치 vs main 전체 스위트 직접 대조로 했다**(87 vs 77, 브랜치 전용 19, 격리 18/19 통과, 마지막 1건 main 동일). 검토자도 이 우회를 옳다고 확인했다. 기준선은 재기록하지 않는다.
- 와일드카드 매칭이 실제 glob 보다 관대함, 다중 중괄호 미지원 — 현재 데이터로는 미발동(15개 스펙 전부 단일 그룹). 잠재 위험으로 기록만 한다.
- 중복 기부 재시도 후 settle 대기 없음 — 지연된 부수효과를 놓칠 수 있다는 지적. 다만 커서 도달 불가 단정이 별도 축으로 있어 거부 자체는 증명된다.
