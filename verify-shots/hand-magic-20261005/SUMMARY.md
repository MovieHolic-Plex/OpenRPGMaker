# 화염·빙결·번개·소환 직접 도트 확인

## 확인된 범위

| 대상 | 확인 | 근거 |
|---|---|---|
| 공용 PNG 4종 | 40칸 전체 RGBA가 원본 격자와 일치 | docs/experiments/hand-magic-20261005/manifest.json |
| 파이어볼 | 새 착탄 10칸, 투사체, 피해 표시, 효과음 사건 3개 | runtime/report.json |
| 블리자드 | 적3명 새 빙결, 눈 층, 피해 표시, 효과음 사건3개 | runtime/report.json |
| 연쇄 번개 | 새 번개3개 노드, 피해 표시, 효과음 사건2개 | runtime/report.json |
| 소환 | 주인공이 같은 용권 계약 차용, 새 시트12칸, 256px pixelated, 브레스, 효과음 사건5개 | runtime-summon-hero-confirmed/report.json |
| 대화 비교 | 4종 선택/이전/다음, 단회/반복, 736/320px 무넘침, 두 테마, 페이지 오류0 | preview/observations.json |

무음 GIF의 효과음 사건은 재생 코드가 실행되었음을 확인한다. 녹음된 오디오 검수는 아니다.
원래 무도가 파티는 타이틀 시간 초과/페이지 충돌로 녹화하지 못했으며, 동일 계약의 소환 그림은
주인공 사본에서 확인했다. 실패한 원래 녹화가 PASS인 것처럼 합산하지 않는다.
gates/vitest/전체 typecheck 미실행. 사용자 미감 승인 대기.

## 즉시 확인할 그림

- `runtime/impact-samples.png`: 화염의 착탄, 빙결의 성장/파쇄, 낙뢰의 전투 화면.
- `runtime-summon-hero-confirmed/impact-samples.png`: 새 용의 등장/날개/브레스.
- `preview/summon.png`: 수정 전 공용 효과와 새 소환의 동 프레임 비교.
- `preview/light-320.png`: 밝은 테마의 모바일 비교와 제어 영역.

GIF는 각 성공한 녹화 폴더의 `skill-*.gif`다. 실패 상세는 각 폴더의 SUMMARY/report에 보존한다.
