# AI 조수 렉 — 전/후 실측 (2026-09-28)

도구: `scripts/qa/ai-assistant-lag-perf.mjs` — 실제 편집기·스토어·패널, 전송(`/v1/agent/run`)만 NDJSON 대본(6단계, 단계마다 생각 조각 4개 + 20칸 칠하기 체크포인트).
기준선: `f9bbb5067` 별도 체크아웃(:9955). 수정본: `codex/ai-assistant-perf`(:9954). 같은 머신에서 번갈아 실행(부하 평균 15~30).

| 지표 | 실제 프로젝트 전 → 후 (3회 평균) | 새 프로젝트 전 → 후 |
|---|---:|---:|
| 실행 중 Long Task 합 | 63.6s → 17.7s | 39.9s → 13.3s |
| 가장 긴 멈춤 | 7.6s → 2.8s | 7.3s → 2.6s |
| 단계 적용(체크포인트 → ACK) 중앙값 | 4.2s → 0.58s | 4.2s → 0.35s |
| 실행 전체 벽시계 | 71.9s → 25.3s | 50.1s → 22.8s |

실제 프로젝트: `oprn-hill-forest-harmony-20260918-a4e1`(12맵, 100×100 편집, 읽기 전용 사본에서 시드로 추출). 새 프로젝트: `?blankProject=1`(기본 자료 약 149MB).
정확성: 두 빌드 모두 마지막 체크포인트 타일이 스토어에 그대로 있고, 되돌리기가 원래 타일로 돌린다(`correctness` 필드).
남은 멈춤 약 2.8s 는 전송 직후 요청 본문 gzip·첫 준비다(`after-first-first-profile.txt`).
프로파일: `before-hill-profile.txt`(전), `after-prof-profile.txt`(후).

