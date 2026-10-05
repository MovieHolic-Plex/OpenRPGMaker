# 세계 지도 이동 구조 6종 — 실제 콘텐츠와 화면

2026-10-05. 코드 계약: [세계 지도 이동 구조](../../openwiki/worldmap-navigation-structures.md).

## 정본

`canonical-projects.json`의 6개 project id/폴더에 실제 57개 맵을 저장했다.
각 project.sqlite를 닫고 다시 열어 지도 정의 동치와 통행·연결 audit.ok를 확인했다(각 revision 1).
전체 지도 PNG는 그 재로드의 실제 맵 타일 그림과 런타임 공용 지도 렌더러로 만든다.
`summary.json`은 재로드/PNG 출처와 각 구조의 연결 수다.
미발견 방까지 보이는 전체 PNG는 저작 검토용이다. 런타임에서는 발견한 방만 표시한다.

`shared-library.json`: 로컬 공용 SQLite의 `worldmap-navigation-structures-v1` 등록과 재로드.
공용 정본 PNG는 `public/assets/worldmap-structures/`, 실행 지침/전체 정의는
`tiledata/worldmap-structures/`와 `src/assets/worldAtlasExamples.json`에도 배포한다.

## 실제 화면 확인

`runtime/<structure>/SUMMARY.md`부터 읽는다. 전용 player.html의 43개 확인 비트가 통과했다.
JS 오류 없음. 지도 열기/닫기, 정지, 핀, 지역/대륙/필드/방의 실제 문 이동,
스테이지/런의 관문 대화와 해금 후 실제 선택 이동을 확인했다.
이벤트 비트의 debug teleport는 문/관문 근처 접근에 사용했다. 전체 게임 완주 근거가 아니다.

`editor-create.png`, `editor-generated.png`, `editor-capture.json`: 편집기 생성 창 6종과 실제 생성.
이 브라우저 세션은 UI 확인용 임시 프로젝트이며 정본 저장 근거는 위 6개 SQLite다.

## 조수

`assistant-tool-handoff.json`: 실제 Pi 도구 응답으로 6종 전체 문서/정의와 PNG image part를 받았다.
이미지 SHA256은 공용 PNG와 같고 지침은 응답 길이 제한으로 잘리지 않았다.
자연어 실호출은 설정된 모델 서버 연결 실패로 2회 모두 생성 전에 중단했다.
`assistant-region/events.json`, `assistant-region-retry/events.json`에 연결 오류를 보존했다.
실모델 생성 성공으로 판정하지 않는다. 테스트 스위트/전체 typecheck/gates는 실행하지 않았다.

## 재현

```sh
bun scripts/content/author-worldmap-structures.mts --phase images
bun scripts/content/prepare-worldmap-structure-references.mts verify-shots/worldmap-structures --publish
bun scripts/qa/capture-worldmap-structures.mts
```

원본 6개 SQLite 폴더는 저장소 밖에 보존한다. 대형 runtime-project.json·내장 이미지 SVG·로그는
로컬 재현 자료이며 커밋하지 않는다. PNG/작은 메타데이터/화면 증거만 커밋한다.
