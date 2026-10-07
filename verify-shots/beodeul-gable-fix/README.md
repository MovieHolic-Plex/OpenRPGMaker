# 기와 복원 · 돌집의 삼각형 박공 벽 정리

사용자가 첨부한 곳은 기와가 아니라 지붕 아래 박공 벽이다. 직전 기와 변경을 철회했다. 이전 revision 15 그림과 비교하면 민가 4종/성당은 변경 픽셀 0, stone은 박공 벽 마스크 안 660픽셀만 다르다. 기와는 여섯 건물 모두 이전 원본 픽셀과 같다.

박공을 돌벽으로 바꿀 때 회벽 색 일부만 교체해 기존 목재 기둥/사각창이 남아 새 원형창과 겹쳤다. 박공 전체의 돌무늬를 연속으로 채우고 잡티 대비를 줄이며, 기둥/옛 창을 제거하고 중앙 (31,53)에 원형창 하나만 둔다. 하단 벽/문/건물 위치/모든 맵 층·이벤트·통행·우선순위·graft 번호는 유지한다.

- [지적한 부분 전후](gable-comparison.png): 왼쪽 기존 문제 / 오른쪽 수정. 두 그림 모두 복원된 이전 기와.
- [전체 정본 마을](village-overview.png).
- [픽셀 비교](pixel-proof.json).
- [저장·재로드 근거](canonical-proof.json).
- [실제 플레이어](runtime/SUMMARY.md).

## 저장 대상과 재로드

project id: `3dd2427f-38dc-46e5-925b-a717dbe5bb03`

저장 폴더: `/home/main/.local/share/oprn/assistant-house-entry-e7d2-20261004` (`project.sqlite` + `assets/`)

revision 17, SHA-256 `f549255cd96a6272fab2b01a6d5e74fa764e1cd317ff9364704304a6910a4bf0`.

같은 SQLite API에서 저장 후 닫고 다시 열어 loadSnapshot 프로젝트 전체 deepEqual을 확인했다. 새/기존 프로젝트의 공용 박공 참고문서, 각 MD 12만자 제한, 번들 JSON 이미지 바이트 없음, 최종 번들과 저장된 모든 문서 본문 일치를 확인했다.

beodeul-architecture build/validate/review와 실제 원본/수정/차이 PNG 검수를 수행했다. 정상/오류 그림은 원형창을 관통하는 기둥을 실제 복구한 gable-post-through-window다. 전체 테스트/게이트는 실행하지 않았다.
