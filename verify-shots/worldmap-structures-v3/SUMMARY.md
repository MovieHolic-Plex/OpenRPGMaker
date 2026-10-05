# 월드맵 시각 수정판

사용자가 지적한 임시 배경 재사용·옛 지형·반복 숲길·같은 빈 방·문자 표식을 교체한 실제 프로젝트/지도 PNG다.

- 여섯 유형, 실제57개 새 맵. 새 공용32px 지형136칸(지형64+사람 승인 거점 화소72).
- 정본: `/home/main/.local/share/oprn/worldmap-structures-v3-20261005/<structure>/project.sqlite`.
- project id·revision·저장 위치: `canonical-projects.json`. 닫기/같은 DB 재로드/실제문·착지·관문·대륙8거점 도달성: `canonical-reload.json`.
- 기존 프로젝트에도 새 번들/참고문서가 추가됨을 확인했다. 새 프로젝트는 기본 자산 생성 경로를 거쳐 같은 번들을 갖는다.
- 공용 DB: `/home/main/.local/share/oprn/shared-content.sqlite`, pack `worldmap-navigation-structures-v1`. 정본PNG바이트·새 타일셋·참고문서/전체연결정의도 저장했다. `shared-library.json`, `shared-image-readback.json`의6개 바이트 해시가 실제PNG와 같다.
- 화면: `all-six.png` / `<structure>.png`. 실제 지형과 공용 지도 렌더러에서 생성했다. 전체PNG는 검토용으로 모든 방을 표시한다. 런타임은 발견한 방만 표시한다.
- player.html: `runtime/<structure>/SUMMARY.md` 먼저 읽는다. 여섯 유형44비트, 실패0/JS오류0. 문·관문·핀·M/Esc·지도중정지, 방 사다리로6칸 오르기. 디버그 위치 이동은 조작 경로를 짧게 만든 것이며 전체 게임 완주가 아니다.
- `assistant-tool-handoff.json`: 실제Pi도구 어댑터가 수정된 전체참고문서와 동일PNG바이트를 전달했다. 모델서버연결은2026-10-05현재 여전히불가(HTTP000); 자연어로 조수가 새 게임을 완성한 근거로 해석하지 않는다.
- 이 그림은 원작 게임의 완성된 미술·전투·전체 코스 재현물이 아니다. 연결 레시피는 유형별 고정이고 seed는 지형 군집 배치를 바꾼다.

생성: `bun scripts/content/author-worldmap-structures.mts --root <new-root> --out <new-out>`.
자료와 공용DB: `bun scripts/content/prepare-worldmap-structure-references.mts <out> --publish`.
