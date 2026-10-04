# 실제 조수 오프닝 제작과 출하 재생

## 실제 제작

기존 게임 「멈춘 시계의 기억」을 실제 조수 UI로 수정했다. 새 프로젝트의 자동 첫 제작 성공률을
입증하는 기록은 아니다. 요청 원문은 `task.txt`, 실제 tool_start/end 결합 기록은
`assistant-receipt.json`, 일반 재로드는 `completion.json`과 `reloaded.json`이다.

- 텍스트 모델: gemini-3.8-flash / 이미지: openai-codex, codex-image-default.
- 새 배경5장 + 실제 투명 전경2장, 6컷·저작 duration 합계30.1초.
- 타이핑 서문, 페이드·디졸브, 가로 초점 이동, 흐림·상승 자막, 독립 전경 부유/회전/불투명도.
- BGM 후보 비교 후 원곡 「기억의 태엽소리」 생성: 78BPM, 16마디, 49.23초,
  piano/bell/strings/bass. 조수 악보 + 내장 합성의 실제 stereo16bit/22.05kHz WAV다.
- 이번에는 후보가 어느 정도 맞아도 원곡을 요청했다. 후보가 전혀 없을 때의 자동 fallback
  성공률을 입증하지 않는다. MIDI 범위와 장면 스키마 오류를 도구가 거부하고 조수가 수정했다.
- 전경 실제 투명 픽셀 비율91.84%/80.83%, 불투명 대상 픽셀도 존재한다.
  `asset-measurements.json`의 실제 WAV 피크0.79999/RMS0.13689는 음질의 주관적 합격 판정이 아니다.

## 정본 저장

- project id: `f25d1f04-88f9-475b-92ee-95a891286d33`
- 호스트 폴더 id: `ed85bb3b-e221-4955-8fd6-e0afdc2ce590`
- 저장 대상: `output/qa/first-presentation/project/.oprn-projects/ed85bb3b-e221-4955-8fd6-e0afdc2ce590/project.sqlite` + 같은 폴더 `assets/`.
- 조수 저장/일반 reload revision62, 편집기 너비 변경→reload→원래 값 복원→reload revision65.
  최종 조회 revision66에서 같은 오프닝을 확인했다(`canonical-final.json`).
- 기존 타이틀과 maps hash를 보존했다. 메모리 fixture나 JSON export를 정본 저장 증거로 대체하지 않았다.

## 출하물과 실제 재생

`canonical-export.json`은 실제 편집기 메뉴로 받은 ZIP이다. 새 폴더에 그대로 풀었으며 파일을
수정하지 않았다. `package-provenance.json`: 검증한 플레이어 source `fc209412f3`,
artifact `b82153a2d97f7da6`, ZIP380,346,628bytes. 새 그림·음악은 SQLite asset-ref의 SHA/bytes와
출하 파일을 모두 비교했다(`gameplay.json`). 편집기 play를 거치지 않은 `player.html`/export shim이다.

일반 키보드, 정상 motion, 오프닝 자동 진행을 유지한 두 선택 모두 실제 엔딩까지 도달했다.
런타임 에러0, 각12비트 실패0. 실제 전경의 computed 위치/회전/불투명도 변화와 실제 음악의
재생 시간/PCM을 관찰했다. 음악 준비 캐시를 재사용했고 맵 인계 중에도22개 표본에서 PCM을
확인했다. native audio의 재생 경로를 녹음용 analyser로 연결했으며 오디오 소유권 오류0이다.

`opening-to-game.gif`(무음)와 `opening-to-game.mp4`(소리)는 같은 연속 native browser recording에서
추출했다. 속도 변경·장면 재구성·합성 프레임·악보를 나중에 덧씌우는 처리는 없다.
`media.json`에 원본 영상/오디오 SHA와 crop/clip/음성 시작 시계 정렬을 기록했다.
오디오와 screencast의 정렬은 캡처 시작 시계에 따른 근사값이다. software WebGL의 첫 준비와
장면 사이 decode/paint 대기, 실제 도입 대사까지 포함하므로 영상은 저작 duration30.1초보다 길다.

## 독립 그림 경계 확인

`edges/SUMMARY.md`를 먼저 읽는다. 별도 fixture이며 실제 게임 저작 결과와 구별한다.
실제 저장 그림/음악을 같은 출하 플레이어에 전달했다.

- 다음 전경 지연: 이전 레이어 위치/회전/불투명도를 동결, 준비 후 새 장면 시계 시작.
- 마지막 다중 그림: 논리 좌표를 화면 해상도로 확대하여 합성하고 네 모서리 alpha255 확인.
- HTTP 캐시 비활성화 상태에서도 오프닝 WAV 요청1회. 실제 맵 ready까지 음악 유지 후 정리.
- reduced motion: 가장 선명한 지점의 정지 그림. 늦은 그림/음악을 기다리다가 skip해도 재생이 부활하지 않음.
- 전경404: 상태 안내→R재시도→실제 게임 시작.

최종 다중 그림의 해상도 보정은 `layer-package-provenance.json`의 별도 최신 UI ZIP에서
`edges/result.json`으로 확인한다. 자연 게임 녹화의 마지막 컷에는 독립 전경이 없으므로,
이 보정 전후의 녹화·두 선택지 검증은 위의 고정된 출하물 provenance를 유지한다.
합성할 때 독립 그림의 DOM 순서보다 실제 CSS z-index 순서를 따른다. 마지막 정렬 보정은
코드 검토로 확인했다. 위 fixture는 마지막 컷에 전경 하나를 사용하는 해상도/인계 확인이다.

## 한계와 검증 범위

그려진 인물 자체는 정지 원화다. 독립 그림의 이동/회전/크기/불투명도이며 관절·표정 영상
애니메이션을 제공한다는 뜻이 아니다. 내장 음색은 외부 음악 모델·보컬·관현악이 아니다.
HTTP/디코드/엔진 모듈은 미리 준비하지만 Phaser 씬/텍스처 등록은 실제 시작 때 남는다.
ZIP 크기와 편집기 cold load도 이번에 줄이지 않았다. 편집기 저작은 Canvas 브라우저로 수행했고
출하 게임은 WebGL로 확인했다. 세션 규칙에 따라 Vitest/전체 typecheck/npm gates는 실행하지 않았다.
Vite app/player 빌드와 실제 브라우저 QA를 수행했다. CI 통과로 이를 대체해서 주장하지 않는다.

시각 설명은 실제 녹화를 포함한다. `visualization.json`: 736/360px, 장면 선택에 따른 실제
video seek/설명 갱신, 가로 overflow없음, 브라우저 오류0.
