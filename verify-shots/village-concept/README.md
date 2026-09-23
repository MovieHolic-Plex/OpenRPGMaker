# 컨셉 마을 3종 · 창문 개정10 근거 — 2026-09-23

- `storage-proof.json`: 정본 SQLite `44d88b94-…` revision 20 저장·재오픈 전체 일치(맵 7개). 참고문서는 번들 두 분류와 동일(v9 는 배포 개정 기록으로 교체).
- `validation.json`: 일곱 맵 정상 0오류, 고장 22종 정확 좌표 검출(새 `mixed-windows`, `landmark-sealed`).
- `region-browser-proof.json`, `*-region.png`: 실제 앱 자료집 → 지역 7개 AI 행·미리보기·다운로드 일치. `places`: 장소 카드 4개(두 폭포 강마을 + 새 셋) AI 행 일치, `*-place.png`.
- `reference-panel-proof.json`, `reference-concept*.png`: `renderTilesetReferences` 로 `diverse-villages-windows-v10`·`concept-villages-v1` 누락 0.
- `distribution-proof.json`: 새 프로젝트·기존 프로젝트 백필(두 분류, 빈 라벨 채움), 저자 편집 보존, 멱등, 내보내기 왕복.
- 기존 네 맵의 하위·상위 배열은 개정9와 바이트 동일(바뀐 것은 칩셋 라벨과 집 창 메타).

tsc(app) 통과. 관련 vitest 13파일 중 실패 5건(`forestHarmonyPersistence`·`forestGroves`·`aiOutdoorTilesetDefaults`)은 origin/main 에서도 같은 5건 실패 — 기존 실패.
폭포는 번들 칩셋 한계로 정지 그림. 문 전이·NPC·실내 없음.

## 수정 (같은 날, 사용자 판정 반영)
- 작은 성: 성벽 조각을 정면도처럼 쌓은 첫 판을 폐기. 공용 지역 「왕궁이 있는 이중 성벽 도시」 내성을 x=49.5 축으로 대칭화하고
  두 레이어가 같은 열·행만 빼서 42×33 으로 줄였다(안뜰 가장자리는 원본 규칙으로 재도색, 정원 밖 원본 칸과 전부 일치). 여울성 나루는 100×92 로 다시 배치.
- 울타리 고리: 오른쪽 변 564·모서리 594 → 호수마을 울타리 마당과 같은 양옆 408, 밑변 …409·410. 바뀐 칸은 교구마을 7·폐촌 18 뿐.
- 성 조각 라벨을 왕궁 도시에서 실제 쓰인 역할로 다시 붙였다(21 윗면 돌바닥, 18~20/78/80/108~110 테두리, 138~143 둥근 탑 등).
