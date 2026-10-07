# 버들 물굽이 마을

사용자 참고 구도의 큰길/골목 위계, 공유 마당, 물길로 나뉜 건물군과 교회 구역을 기존 버들항 타일로 조립했다. 76×70, 건물 41동(회관/주막/대장간/교회 포함), 원본 아치 다리 3개. 외곽 수관 군락과 전체 줄기 나무, 공용 기초/접점 그림자를 사용한다. 기존 기와/stone 박공 수정과 기존 세 맵은 보존한다. 이번 새 맵은 외부 배치이며 신규 실내/출입 이벤트/NPC는 포함하지 않는다.

## 저장·재로드

- project id: `3dd2427f-38dc-46e5-925b-a717dbe5bb03`
- 저장 대상: `/home/main/.local/share/oprn/assistant-house-entry-e7d2-20261004/project.sqlite`
- revision: 18
- SHA-256: `b5c69f999f7d8525f4ff7fa372112fbcf11ec56eda4202a34ce2783eb7c003b5`
- SQLite 저장을 완료한 뒤 별도 프로세스로 다시 열어 새 맵 모든 층/이벤트, 이전 세 맵, 시작점, 최종 공용 참고문서를 대조했다. 첫 프로세스는 저장 후 추가 snapshot 재로드 중 종료됐으며, 별도 재로드 과정에서 저장 결과를 확인했다.
- `canonical-proof.json`, `output/beodeul-river-town/reloaded-project.json`이 근거다.
- `village-overview.png`는 실제 네 층을 정수 배율로 렌더한 원본 전체 이미지다. 재로드 맵 전체를 이 이미지의 입력 맵과 비교해 일치를 확인했다.

## 이동·시각 확인

- 실제 `canMove`로 저작된 길/마당/다리만 따라 모든 41개 문앞과 6개 다리 둑에 도달한다. 최초 길 확인에서 건물로 끊긴 도로를 발견해 자유 공간으로 연결했다.
- 전용 player.html에서 296칸 이동, 10개 비트 통과, 런타임 오류 0. 세 다리 갑판을 건너 회관/교회/공방 문앞과 우물 복귀를 확인했다.
- `runtime/SUMMARY.md`를 먼저 읽고 지정한 시작 마당/교회 두 PNG를 검토했다. 픽셀 기와/창문/돌벽, 문앞 통행과 기초 그림자가 표시된다. 전체 구도는 참고 그림의 구역 관계를 적용했으며 타일 방향/건물 모양상 사선 블록을 그대로 복제하지 않았다.
- gates/vitest/전체 typecheck는 실행하지 않았다.

## 공용 배포

`tiledata/beodeul-ground/RIVER-TOWN.md`, 정확한 네 층/사용 키트/전체 graft JSON, 실제 정상·다리 갑판 누락 오류 그림을 공용 `beodeulGroundReferences.json`에 배포했다. 새/기존 city·ground 두 타일셋에서 같은 자료를 확인했다. 기본 참고문서 재생성도 이 fragment를 보존한다. 사용자 참고 그림의 픽셀은 게임 소재에 포함하지 않았다.

## 재현 파일

- scripts/content/lib/beodeul-river-town.mts
- scripts/content/build-beodeul-river-town.mts (revision17에서 새 맵 작성)
- scripts/content/prepare-beodeul-river-town-references.mts
- scripts/qa/beodeul-river-town-proof.mts (저작 경로 검사/저장)
- scripts/qa/beodeul-river-town-reload.mts (별도 재로드/대조)
- scripts/qa/runtime/beodeul-river-town.capture.mjs
