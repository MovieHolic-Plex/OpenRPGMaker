# 컨셉 마을 3종 · 창문 개정10 근거 — 2026-09-23

- `storage-proof.json`: 정본 SQLite `44d88b94-…` revision 19 저장·재오픈 전체 일치(맵 7개). 참고문서는 번들 두 분류와 동일(v9 는 배포 개정 기록으로 교체).
- `validation.json`: 일곱 맵 정상 0오류, 고장 22종 정확 좌표 검출(새 `mixed-windows`, `landmark-sealed`).
- `region-browser-proof.json`, `*-region.png`: 실제 앱 자료집 → 지역 7개 AI 행·미리보기·다운로드 일치. `places`: 장소 카드 4개(두 폭포 강마을 + 새 셋) AI 행 일치, `*-place.png`.
- `reference-panel-proof.json`, `reference-concept*.png`: `renderTilesetReferences` 로 `diverse-villages-windows-v10`·`concept-villages-v1` 누락 0.
- `distribution-proof.json`: 새 프로젝트·기존 프로젝트 백필(두 분류, 빈 라벨 채움), 저자 편집 보존, 멱등, 내보내기 왕복.
- 기존 네 맵의 하위·상위 배열은 개정9와 바이트 동일(바뀐 것은 칩셋 라벨과 집 창 메타).

tsc(app) 통과. 관련 vitest 13파일 중 실패 5건(`forestHarmonyPersistence`·`forestGroves`·`aiOutdoorTilesetDefaults`)은 origin/main 에서도 같은 5건 실패 — 기존 실패.
폭포는 번들 칩셋 한계로 정지 그림. 문 전이·NPC·실내 없음.
